// src/data-profiler.js
const dbConnector = require('./db-connector');

/**
 * Helper function to handle different SQLite result formats
 * @param {Object|Array} result - The query result
 * @param {Object} defaultValue - Default value if result is invalid
 * @returns {Object} - Normalized result
 */
function normalizeQueryResult(result, defaultValue = {}) {
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  } else if (result && typeof result === 'object') {
    return result[0] || result;
  }
  return defaultValue;
}

/**
 * Helper function to normalize array results
 * @param {Object|Array} result - The query result
 * @returns {Array} - Normalized array result
 */
function normalizeArrayResult(result) {
  if (Array.isArray(result)) {
    return result;
  } else if (result && typeof result === 'object') {
    return Object.values(result);
  }
  return [];
}

/**
 * Detect and analyze data types in a table
 * @param {string} tableName - The name of the table to analyze
 * @returns {Promise<Object>} - Detailed type information for each column
 */
async function analyzeTableDataTypes(tableName) {
  try {
    // Get table structure for column names
    const query = `SELECT * FROM ${tableName} LIMIT 1000`;
    const sampleData = await dbConnector.executeQuery(query);
    
    if (!sampleData || !sampleData.length || sampleData.length === 0) {
      return {};
    }
    
    // Handle both array and object responses
    const firstRow = Array.isArray(sampleData) ? sampleData[0] : 
                    (typeof sampleData === 'object' ? sampleData[0] || sampleData : null);
    
    if (!firstRow) {
      return {};
    }
    
    const columns = Object.keys(firstRow);
    const columnStats = {};
    
    // Analyze each column
    for (const column of columns) {
      // Extract column values (ignoring nulls for type detection)
      let values = [];
      
      if (Array.isArray(sampleData)) {
        values = sampleData
          .map(row => row[column])
          .filter(value => value !== null && value !== undefined);
      } else if (typeof sampleData === 'object') {
        // Handle object with numeric keys
        values = Object.values(sampleData)
          .filter(row => row && row[column] !== null && row[column] !== undefined)
          .map(row => row[column]);
      }
      
      const typeInfo = detectDataType(values, column);
      
      // Store statistics
      columnStats[column] = typeInfo;
    }
    
    return columnStats;
  } catch (err) {
    console.error(`Error analyzing table ${tableName}:`, err);
    throw err;
  }
}

/**
 * Detect the data type of a column based on sample values
 * @param {Array} values - Sample values from the column
 * @param {string} columnName - Name of the column
 * @returns {Object} - Type information and statistics
 */
function detectDataType(values, columnName) {
  if (values.length === 0) {
    return { 
      type: 'unknown',
      confidence: 0,
      examples: [],
      stats: {}
    };
  }
  
  // Count type occurrences
  const typeOccurrences = {
    number: 0,
    integer: 0,
    float: 0,
    boolean: 0,
    date: 0,
    datetime: 0,
    string: 0
  };
  
  // Count unique values
  const uniqueValues = new Set();
  const examples = [];
  let maxLength = 0;
  let minLength = Infinity;
  let minValue = null;
  let maxValue = null;
  
  // For numeric data
  let sum = 0;
  let count = 0;
  
  for (const value of values) {
    uniqueValues.add(value);
    
    // Keep a few examples
    if (examples.length < 5 && !examples.includes(value)) {
      examples.push(value);
    }
    
    // Detect by trying to parse
    const valueType = getValueType(value);
    typeOccurrences[valueType]++;
    
    // Type-specific statistics
    if (valueType === 'integer' || valueType === 'float') {
      typeOccurrences.number++;
      const numValue = Number(value);
      sum += numValue;
      count++;
      
      if (minValue === null || numValue < minValue) {
        minValue = numValue;
      }
      if (maxValue === null || numValue > maxValue) {
        maxValue = numValue;
      }
    }
    
    // String length stats
    if (typeof value === 'string') {
      maxLength = Math.max(maxLength, value.length);
      minLength = Math.min(minLength, value.length);
    }
  }
  
  // Determine likely data type
  const totalValues = values.length;
  let dominantType = 'string';
  let confidence = (typeOccurrences.string / totalValues) * 100;
  
  // Check for numeric types
  if (typeOccurrences.number / totalValues > 0.8) {
    if (typeOccurrences.integer / typeOccurrences.number > 0.9) {
      dominantType = 'integer';
    } else {
      dominantType = 'float';
    }
    confidence = (typeOccurrences.number / totalValues) * 100;
  }
  
  // Check for date types
  if (typeOccurrences.date / totalValues > 0.8) {
    dominantType = 'date';
    confidence = (typeOccurrences.date / totalValues) * 100;
  } else if (typeOccurrences.datetime / totalValues > 0.8) {
    dominantType = 'datetime';
    confidence = (typeOccurrences.datetime / totalValues) * 100;
  }
  
  // Check for boolean type
  if (typeOccurrences.boolean / totalValues > 0.8) {
    dominantType = 'boolean';
    confidence = (typeOccurrences.boolean / totalValues) * 100;
  }
  
  // Calculate statistics
  const stats = {
    uniqueCount: uniqueValues.size,
    uniqueRatio: uniqueValues.size / totalValues,
    nullCount: totalValues - values.length,
    totalCount: totalValues
  };
  
  // Add type-specific stats
  if (dominantType === 'integer' || dominantType === 'float') {
    stats.min = minValue;
    stats.max = maxValue;
    stats.mean = sum / count;
    
    // Check if this could be a categorical variable with numeric encoding
    if (uniqueValues.size < 10 && totalValues > 20) {
      stats.potentialCategory = true;
    }
  } else if (dominantType === 'string') {
    stats.minLength = minLength;
    stats.maxLength = maxLength;
    
    // Check if this might be a categorical variable
    if (uniqueValues.size < 20 && uniqueValues.size > 1) {
      stats.potentialCategory = true;
    }
  }
  
  return {
    type: dominantType,
    confidence: Math.round(confidence),
    examples,
    stats
  };
}

/**
 * Determine the specific data type of a single value
 */
function getValueType(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  
  if (typeof value === 'boolean' || value === 'true' || value === 'false' || value === '0' || value === '1') {
    if ((value === 'true' || value === 'false' || typeof value === 'boolean')) {
      return 'boolean';
    }
  }
  
  if (typeof value === 'number' || !isNaN(Number(value))) {
    return Number.isInteger(Number(value)) ? 'integer' : 'float';
  }
  
  if (typeof value === 'string') {
    // Check for date formats
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const dateTimePattern = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
    
    if (datePattern.test(value) && !isNaN(Date.parse(value))) {
      return 'date';
    }
    
    if (dateTimePattern.test(value) && !isNaN(Date.parse(value))) {
      return 'datetime';
    }
    
    return 'string';
  }
  
  return 'string'; // Default fallback
}

/**
 * Generate basic statistics for a column
 * @param {string} tableName - The name of the table
 * @param {string} columnName - The name of the column
 * @returns {Promise<Object>} - Statistical information about the column
 */
async function generateColumnStatistics(tableName, columnName) {
  try {
    // Get the data type first
    const typeQuery = `SELECT ${columnName} FROM ${tableName} LIMIT 1`;
    const typeResult = await dbConnector.executeQuery(typeQuery);
    
    if (!typeResult || (Array.isArray(typeResult) && typeResult.length === 0)) {
      return { error: 'No data available' };
    }
    
    const firstRow = normalizeQueryResult(typeResult);
    const value = firstRow[columnName];
    const valueType = getValueType(value);
    
    // Run statistics based on data type
    if (valueType === 'integer' || valueType === 'float') {
      return await generateNumericStats(tableName, columnName);
    } else if (valueType === 'string') {
      return await generateTextStats(tableName, columnName);
    } else if (valueType === 'date' || valueType === 'datetime') {
      return await generateDateStats(tableName, columnName);
    } else {
      // Generic stats for other types
      return await generateGenericStats(tableName, columnName);
    }
  } catch (err) {
    console.error(`Error generating statistics for ${tableName}.${columnName}:`, err);
    return { error: err.message };
  }
}

/**
 * Generate numeric column statistics
 */
async function generateNumericStats(tableName, columnName) {
  const stats = {};
  
  // Basic count and nulls
  const countQuery = `
    SELECT 
      COUNT(${columnName}) as count,
      COUNT(*) as total
    FROM ${tableName}
  `;
  const countResult = await dbConnector.executeQuery(countQuery);
  const countData = normalizeQueryResult(countResult, { count: 0, total: 0 });
  
  stats.count = countData.count || 0;
  stats.nulls = (countData.total || 0) - stats.count;
  stats.nullPercent = countData.total ? Math.round((stats.nulls / countData.total) * 100) : 0;
  
  // Min, max, avg
  const statsQuery = `
    SELECT 
      MIN(${columnName}) as min,
      MAX(${columnName}) as max,
      AVG(${columnName}) as mean
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
  `;
  const statsResult = await dbConnector.executeQuery(statsQuery);
  const statsData = normalizeQueryResult(statsResult, { min: null, max: null, mean: null });
  
  stats.min = statsData.min;
  stats.max = statsData.max;
  stats.mean = statsData.mean;
  
  // Get distribution info - percentiles
  const p25Query = `
    SELECT ${columnName} FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    ORDER BY ${columnName}
    LIMIT 1
    OFFSET (SELECT COUNT(${columnName}) FROM ${tableName} WHERE ${columnName} IS NOT NULL) * 25 / 100 - 1
  `;
  const p75Query = `
    SELECT ${columnName} FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    ORDER BY ${columnName}
    LIMIT 1
    OFFSET (SELECT COUNT(${columnName}) FROM ${tableName} WHERE ${columnName} IS NOT NULL) * 75 / 100 - 1
  `;
  
  try {
    // These can fail on some DB engines, so wrap in try/catch
    const p25Result = await dbConnector.executeQuery(p25Query);
    const p75Result = await dbConnector.executeQuery(p75Query);
    
    const p25Data = normalizeQueryResult(p25Result);
    const p75Data = normalizeQueryResult(p75Result);
    
    if (p25Data && p25Data[columnName] !== undefined) {
      stats.percentile25 = p25Data[columnName];
    }
    
    if (p75Data && p75Data[columnName] !== undefined) {
      stats.percentile75 = p75Data[columnName];
    }
  } catch (e) {
    // Skip percentiles if they fail
    console.log('Skipping percentiles calculation due to error:', e.message);
  }
  
  // Get distinct value count
  const distinctQuery = `
    SELECT COUNT(DISTINCT ${columnName}) as distinct_count
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
  `;
  const distinctResult = await dbConnector.executeQuery(distinctQuery);
  const distinctData = normalizeQueryResult(distinctResult, { distinct_count: 0 });
  
  stats.distinctCount = distinctData.distinct_count || 0;
  stats.distinctPercent = Math.round((stats.distinctCount / stats.count) * 100) || 0;
  
  // Get histogram data
  if (stats.min !== null && stats.max !== null) {
    const bucketCount = 10;
    const bucketSize = (stats.max - stats.min) / bucketCount;
    
    stats.histogram = {
      buckets: [],
      counts: []
    };
    
    for (let i = 0; i < bucketCount; i++) {
      const lowerBound = stats.min + (bucketSize * i);
      const upperBound = stats.min + (bucketSize * (i + 1));
      
      // Calculate end points with rounding to make them more readable
      const bucketLabel = `${Math.round(lowerBound * 100) / 100} - ${Math.round(upperBound * 100) / 100}`;
      stats.histogram.buckets.push(bucketLabel);
      
      const bucketQuery = `
        SELECT COUNT(*) as count
        FROM ${tableName}
        WHERE ${columnName} >= ${lowerBound} AND ${columnName} < ${upperBound}
      `;
      
      try {
        const bucketResult = await dbConnector.executeQuery(bucketQuery);
        const bucketData = normalizeQueryResult(bucketResult, { count: 0 });
        stats.histogram.counts.push(bucketData.count || 0);
      } catch (e) {
        // If histogram generation fails, skip it
        console.log('Error generating histogram bucket:', e.message);
        stats.histogram.counts.push(0);
      }
    }
  }
  
  // Get top 5 values
  const topValuesQuery = `
    SELECT ${columnName}, COUNT(*) as count
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    GROUP BY ${columnName}
    ORDER BY count DESC
    LIMIT 5
  `;
  
  const topValuesResult = await dbConnector.executeQuery(topValuesQuery);
  const topValuesArray = normalizeArrayResult(topValuesResult);
  
  stats.topValues = topValuesArray.map(row => ({
    value: row[columnName],
    count: row.count,
    percent: Math.round((row.count / stats.count) * 100) || 0
  }));
  
  return stats;
}

/**
 * Generate text column statistics
 */
async function generateTextStats(tableName, columnName) {
  const stats = {};
  
  // Basic count and nulls
  const countQuery = `
    SELECT 
      COUNT(${columnName}) as count,
      COUNT(*) as total
    FROM ${tableName}
  `;
  const countResult = await dbConnector.executeQuery(countQuery);
  const countData = normalizeQueryResult(countResult, { count: 0, total: 0 });
  
  stats.count = countData.count || 0;
  stats.nulls = (countData.total || 0) - stats.count;
  stats.nullPercent = Math.round((stats.nulls / countData.total) * 100) || 0;
  
  // Get distinct value count
  const distinctQuery = `
    SELECT COUNT(DISTINCT ${columnName}) as distinct_count
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
  `;
  const distinctResult = await dbConnector.executeQuery(distinctQuery);
  const distinctData = normalizeQueryResult(distinctResult, { distinct_count: 0 });
  
  stats.distinctCount = distinctData.distinct_count || 0;
  stats.distinctPercent = Math.round((stats.distinctCount / stats.count) * 100) || 0;
  
  // Length statistics - min, max, avg length
  const lengthQuery = `
    SELECT 
      MIN(length(${columnName})) as min_length,
      MAX(length(${columnName})) as max_length,
      AVG(length(${columnName})) as avg_length
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
  `;
  
  try {
    const lengthResult = await dbConnector.executeQuery(lengthQuery);
    const lengthData = normalizeQueryResult(lengthResult);
    
    stats.minLength = lengthData.min_length;
    stats.maxLength = lengthData.max_length;
    stats.avgLength = lengthData.avg_length;
  } catch (e) {
    // Skip length stats if they fail
    console.log('Skipping length calculations due to error:', e.message);
  }
  
  // Get top 5 values by frequency
  const topValuesQuery = `
    SELECT ${columnName}, COUNT(*) as count
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    GROUP BY ${columnName}
    ORDER BY count DESC
    LIMIT 5
  `;
  
  const topValuesResult = await dbConnector.executeQuery(topValuesQuery);
  const topValuesArray = normalizeArrayResult(topValuesResult);
  
  stats.topValues = topValuesArray.map(row => ({
    value: row[columnName],
    count: row.count,
    percent: Math.round((row.count / stats.count) * 100) || 0
  }));
  
  // For categorical data - if there are few unique values, list them all
  if (stats.distinctCount <= 20) {
    stats.isLikelyCategorical = true;
    
    const categoryQuery = `
      SELECT ${columnName}, COUNT(*) as count
      FROM ${tableName}
      WHERE ${columnName} IS NOT NULL
      GROUP BY ${columnName}
      ORDER BY count DESC
    `;
    
    const categoryResult = await dbConnector.executeQuery(categoryQuery);
    const categoryArray = normalizeArrayResult(categoryResult);
    
    stats.categories = categoryArray.map(row => ({
      value: row[columnName],
      count: row.count,
      percent: Math.round((row.count / stats.count) * 100) || 0
    }));
  }
  
  return stats;
}

/**
 * Generate date/time column statistics
 */
async function generateDateStats(tableName, columnName) {
  const stats = {};
  
  // Basic count and nulls
  const countQuery = `
    SELECT 
      COUNT(${columnName}) as count,
      COUNT(*) as total
    FROM ${tableName}
  `;
  const countResult = await dbConnector.executeQuery(countQuery);
  const countData = normalizeQueryResult(countResult, { count: 0, total: 0 });
  
  stats.count = countData.count || 0;
  stats.nulls = (countData.total || 0) - stats.count;
  stats.nullPercent = Math.round((stats.nulls / countData.total) * 100) || 0;
  
  // Min, max dates
  const statsQuery = `
    SELECT 
      MIN(${columnName}) as min_date,
      MAX(${columnName}) as max_date
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
  `;
  const statsResult = await dbConnector.executeQuery(statsQuery);
  const statsData = normalizeQueryResult(statsResult);
  
  stats.minDate = statsData.min_date;
  stats.maxDate = statsData.max_date;
  
  // Calculate the date range in days
  try {
    const minDate = new Date(stats.minDate);
    const maxDate = new Date(stats.maxDate);
    const rangeDays = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));
    stats.rangeDays = rangeDays;
  } catch (e) {
    console.log('Error calculating date range:', e.message);
  }
  
  // Get distinct value count
  const distinctQuery = `
    SELECT COUNT(DISTINCT ${columnName}) as distinct_count
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
  `;
  const distinctResult = await dbConnector.executeQuery(distinctQuery);
  const distinctData = normalizeQueryResult(distinctResult, { distinct_count: 0 });
  
  stats.distinctCount = distinctData.distinct_count || 0;
  stats.distinctPercent = Math.round((stats.distinctCount / stats.count) * 100) || 0;
  
  // Date distribution by year and month if it spans multiple years
  try {
    // For SQLite, use the built-in date functions
    const yearQuery = `
      SELECT 
        strftime('%Y', ${columnName}) as year,
        COUNT(*) as count
      FROM ${tableName}
      WHERE ${columnName} IS NOT NULL
      GROUP BY year
      ORDER BY year
    `;
    
    const yearResults = await dbConnector.executeQuery(yearQuery);
    const yearArray = normalizeArrayResult(yearResults);
    
    stats.yearDistribution = yearArray.map(row => ({
      year: row.year,
      count: row.count,
      percent: Math.round((row.count / stats.count) * 100) || 0
    }));
    
    // If there are dates within the last 12 months, get month distribution
    const monthQuery = `
      SELECT 
        strftime('%Y-%m', ${columnName}) as month,
        COUNT(*) as count
      FROM ${tableName}
      WHERE ${columnName} IS NOT NULL
      GROUP BY month
      ORDER BY month
      LIMIT 12
    `;
    
    const monthResults = await dbConnector.executeQuery(monthQuery);
    const monthArray = normalizeArrayResult(monthResults);
    
    stats.monthDistribution = monthArray.map(row => ({
      month: row.month,
      count: row.count,
      percent: Math.round((row.count / stats.count) * 100) || 0
    }));
  } catch (e) {
    console.log('Error calculating date distributions:', e.message);
  }
  
  return stats;
}

/**
 * Generate generic statistics for any column type
 */
async function generateGenericStats(tableName, columnName) {
  const stats = {};
  
  // Basic count and nulls
  const countQuery = `
    SELECT 
      COUNT(${columnName}) as count,
      COUNT(*) as total
    FROM ${tableName}
  `;
  const countResult = await dbConnector.executeQuery(countQuery);
  const countData = normalizeQueryResult(countResult, { count: 0, total: 0 });
  
  stats.count = countData.count || 0;
  stats.nulls = (countData.total || 0) - stats.count;
  stats.nullPercent = Math.round((stats.nulls / countData.total) * 100) || 0;
  
  // Get distinct value count
  const distinctQuery = `
    SELECT COUNT(DISTINCT ${columnName}) as distinct_count
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
  `;
  const distinctResult = await dbConnector.executeQuery(distinctQuery);
  const distinctData = normalizeQueryResult(distinctResult, { distinct_count: 0 });
  
  stats.distinctCount = distinctData.distinct_count || 0;
  stats.distinctPercent = Math.round((stats.distinctCount / stats.count) * 100) || 0;
  
  // Get top 5 values
  const topValuesQuery = `
    SELECT ${columnName}, COUNT(*) as count
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    GROUP BY ${columnName}
    ORDER BY count DESC
    LIMIT 5
  `;
  
  const topValuesResult = await dbConnector.executeQuery(topValuesQuery);
  const topValuesArray = normalizeArrayResult(topValuesResult);
  
  stats.topValues = topValuesArray.map(row => ({
    value: row[columnName],
    count: row.count,
    percent: Math.round((row.count / stats.count) * 100) || 0
  }));
  
  return stats;
}

/**
 * Generate table-level profiling summary
 * @param {string} tableName - The name of the table to profile
 * @returns {Promise<Object>} - Table profile with column stats
 */
async function generateTableProfile(tableName) {
  try {
    // Get row count
    const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
    const countResult = await dbConnector.executeQuery(countQuery);
    const countData = normalizeQueryResult(countResult, { count: 0 });
    const rowCount = countData.count || 0;
    
    // Analyze column data types
    const columnTypes = await analyzeTableDataTypes(tableName);
    
    // Get table structure for more detailed info
    const tableStructure = await dbConnector.executeQuery(`PRAGMA table_info('${tableName}')`);
    
    const columns = Object.keys(columnTypes);
    const profile = {
      tableName,
      rowCount,
      columnCount: columns.length,
      columns: []
    };
    
    // Compile detailed information for each column
    for (const column of columns) {
      const typeInfo = columnTypes[column];
      
      // Find matching column in table structure
      let structureInfo = {};
      // Check if tableStructure is an array (expected) or object
      if (Array.isArray(tableStructure)) {
        structureInfo = tableStructure.find(col => col.name === column) || {};
      } else if (tableStructure && typeof tableStructure === 'object') {
        // Handle case where it's not an array but an object with numeric keys
        Object.values(tableStructure).forEach(col => {
          if (col && col.name === column) {
            structureInfo = col;
          }
        });
      }
      
      profile.columns.push({
        name: column,
        type: structureInfo.type || 'unknown',
        sqliteType: structureInfo.type || 'unknown',
        detectedType: typeInfo.type,
        confidence: typeInfo.confidence,
        examples: typeInfo.examples,
        primaryKey: structureInfo.pk === 1,
        nullable: structureInfo.notnull !== 1,
        nullCount: typeInfo.stats.nullCount || 0,
        uniqueCount: typeInfo.stats.uniqueCount || 'Unknown',
        stats: typeInfo.stats
      });
    }
    
    return profile;
  } catch (err) {
    console.error(`Error generating table profile for ${tableName}:`, err);
    throw err;
  }
}

/**
 * Suggest visualizations based on column data types
 * @param {Object} tableProfile - The table profile data
 * @returns {Array} - List of suggested visualizations
 */
function suggestVisualizations(tableProfile) {
  const suggestions = [];
  
  if (!tableProfile || !tableProfile.columns) {
    return suggestions;
  }
  
  const columns = tableProfile.columns;
  
  // Find numeric columns
  const numericColumns = columns.filter(col => 
    col.detectedType === 'integer' || col.detectedType === 'float'
  );
  
  // Find categorical columns
  const categoricalColumns = columns.filter(col => {
    const stats = col.stats || {};
    return stats.potentialCategory === true || 
           (col.detectedType === 'string' && stats.distinctCount && stats.distinctCount < 20);
  });
  
  // Find date columns
  const dateColumns = columns.filter(col => 
    col.detectedType === 'date' || col.detectedType === 'datetime'
  );
  
  // Suggest bar charts for categorical data
  categoricalColumns.forEach(catCol => {
    numericColumns.forEach(numCol => {
      suggestions.push({
        type: 'bar',
        title: `${catCol.name} by ${numCol.name}`,
        xColumn: catCol.name,
        yColumn: numCol.name,
        description: `Bar chart showing ${numCol.name} values grouped by ${catCol.name}`,
        priority: 'high'
      });
    });
    
    // If no numeric columns, suggest counts
    if (numericColumns.length === 0) {
      suggestions.push({
        type: 'bar',
        title: `Count by ${catCol.name}`,
        description: `Bar chart showing count of records by ${catCol.name}`,
        query: `SELECT ${catCol.name}, COUNT(*) as count FROM ${tableProfile.tableName} GROUP BY ${catCol.name} ORDER BY count DESC`,
        priority: 'high'
      });
    }
  });
  
  // Suggest pie charts for categorical data with few values
  const pieCategories = categoricalColumns.filter(col => 
    col.stats.distinctCount && col.stats.distinctCount <= 10
  );
  
  pieCategories.forEach(catCol => {
    numericColumns.forEach(numCol => {
      suggestions.push({
        type: 'pie',
        title: `Distribution of ${numCol.name} by ${catCol.name}`,
        labelColumn: catCol.name,
        valueColumn: numCol.name,
        description: `Pie chart showing distribution of ${numCol.name} across ${catCol.name} categories`,
        priority: 'medium'
      });
    });
    
    // If no numeric columns, suggest count distribution
    if (numericColumns.length === 0) {
      suggestions.push({
        type: 'pie',
        title: `Distribution by ${catCol.name}`,
        description: `Pie chart showing distribution of records by ${catCol.name}`,
        query: `SELECT ${catCol.name}, COUNT(*) as count FROM ${tableProfile.tableName} GROUP BY ${catCol.name}`,
        priority: 'medium'
      });
    }
  });
  
  // Suggest histograms for numeric data
  numericColumns.forEach(numCol => {
    suggestions.push({
      type: 'histogram',
      title: `Distribution of ${numCol.name}`,
      column: numCol.name,
      description: `Histogram showing the distribution of ${numCol.name} values`,
      priority: 'medium'
    });
  });
  
  // Suggest line charts for time series data
  dateColumns.forEach(dateCol => {
    numericColumns.forEach(numCol => {
      suggestions.push({
        type: 'line',
        title: `${numCol.name} over time`,
        xColumn: dateCol.name,
        yColumn: numCol.name,
        description: `Line chart showing ${numCol.name} values over time`,
        priority: 'high'
      });
    });
    
    // If no numeric columns, suggest counts over time
    if (numericColumns.length === 0) {
      suggestions.push({
        type: 'line',
        title: `Count over time`,
        description: `Line chart showing record count over time`,
        query: `SELECT ${dateCol.name}, COUNT(*) as count FROM ${tableProfile.tableName} GROUP BY ${dateCol.name}`,
        priority: 'high'
      });
    }
  });
  
  // Suggest scatter plots for relationships between numeric columns
  if (numericColumns.length >= 2) {
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        suggestions.push({
          type: 'scatter',
          title: `Relationship between ${numericColumns[i].name} and ${numericColumns[j].name}`,
          xColumn: numericColumns[i].name,
          yColumn: numericColumns[j].name,
          description: `Scatter plot showing relationship between ${numericColumns[i].name} and ${numericColumns[j].name}`,
          priority: 'low'
        });
      }
    }
  }
  
  return suggestions;
}

module.exports = {
  analyzeTableDataTypes,
  generateColumnStatistics,
  generateTableProfile,
  suggestVisualizations
};