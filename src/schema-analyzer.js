// src/schema-analyzer.js - Fix for changes/lastInsertRowid issue
const dbConnector = require('./db-connector');

/**
 * Get the complete database schema
 */
async function getSchema() {
  try {
    const tables = await getTables();
    const schema = {};
    
    for (const table of tables) {
      try {
        schema[table] = await getTableStructure(table);
      } catch (err) {
        console.error(`Error getting structure for table ${table}:`, err);
        // Provide an empty array for the table structure if there's an error
        schema[table] = [];
      }
    }
    
    return schema;
  } catch (err) {
    console.error('Error in getSchema:', err);
    throw err;
  }
}

/**
 * Get all tables in the database
 */
async function getTables() {
  try {
    // SQLite-specific query to get all tables
    const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    const tables = await dbConnector.executeQuery(query);
    
    // Handle different response formats
    if (Array.isArray(tables)) {
      if (tables.length > 0) {
        // If tables is an array of objects with name property
        if (typeof tables[0] === 'object' && tables[0] !== null && 'name' in tables[0]) {
          return tables.map(table => table.name);
        } 
        // If tables is an array of strings
        else if (typeof tables[0] === 'string') {
          return tables;
        }
      }
      return []; // Empty array if no tables
    } else {
      console.error('Unexpected format for tables:', tables);
      return []; // Return empty array to avoid breaking
    }
  } catch (err) {
    console.error('Error in getTables:', err);
    throw err;
  }
}

/**
 * Get structure for a specific table by directly using SQLite APIs
 * instead of relying on dbConnector for PRAGMA statements
 */
async function getTableStructure(tableName) {
  try {
    // Use direct SQLite access for PRAGMA calls
    // This direct approach avoids the changes/lastInsertRowid result
    const db = dbConnector.getDatabase();
    if (!db) {
      console.error('Database not accessible');
      return [];
    }
    
    // Directly prepare and execute PRAGMA statement
    try {
      const stmt = db.prepare(`PRAGMA table_info('${tableName}')`);
      const columns = stmt.all();

      // Ensure columns is an array
      if (!Array.isArray(columns)) {
        console.log(`PRAGMA table_info returned non-array result: ${typeof columns}`);

        // Convert object with numeric keys to array if necessary
        if (columns && typeof columns === 'object') {
          const columnArray = Object.values(columns);
          // Map columns to our standard format
          return columnArray.map(col => ({
            name: col.name || '',
            type: col.type || '',
            notNull: col.notnull === 1,
            defaultValue: col.dflt_value || null,
            primaryKey: col.pk === 1
          }));
        }

        return []; // Return empty array if conversion not possible
      }

      // Map columns to our standard format
      return columns.map(col => ({
        name: col.name || '',
        type: col.type || '',
        notNull: col.notnull === 1,
        defaultValue: col.dflt_value || null,
        primaryKey: col.pk === 1
      }));
    } catch (err) {
      console.error(`Error executing PRAGMA table_info for ${tableName}:`, err);
      
      // Fallback to a more general query if PRAGMA fails
      try {
        console.log(`Attempting fallback query for table ${tableName}`);
        const query = `SELECT * FROM ${tableName} LIMIT 1`;
        const row = await dbConnector.executeQuery(query);
        
        if (row && row.length > 0) {
          // Extract column names from the first row
          const columnNames = Object.keys(row[0]);
          return columnNames.map(name => ({
            name,
            type: 'unknown', // We don't know the type from this query
            notNull: false,  // Default to false
            defaultValue: null,
            primaryKey: false // Default to false
          }));
        }
      } catch (fallbackErr) {
        console.error(`Fallback query failed for ${tableName}:`, fallbackErr);
      }
      
      return []; // Return empty array if all methods fail
    }
  } catch (err) {
    console.error(`Error in getTableStructure for table ${tableName}:`, err);
    return []; // Return empty array to avoid breaking
  }
}

module.exports = {
  getSchema,
  getTables,
  getTableStructure
};