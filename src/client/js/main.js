
document.addEventListener('DOMContentLoaded', () => {
  // Create a global error handler to catch and show console errors cleanly
  window.addEventListener('error', function(e) {
    console.warn('Caught error:', e.message);
    // Only log, don't stop execution or show to user
    return false;
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    console.warn('Unhandled promise rejection:', e.reason);
    // Only log, don't stop execution
    e.preventDefault();
  });

  // Get the current origin for socket connection
  const origin = window.location.origin || 'http://localhost';
  const socket = io(origin);

  // UI elements
  const schemaTree = document.getElementById('schema-tree');
  const queryInput = document.getElementById('query-input');
  const runQueryBtn = document.getElementById('run-query-btn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const explorePanel = document.getElementById('explore-panel');
  const toggleExploreBtn = document.getElementById('toggle-explore-mode-btn');
  const autoExecuteToggle = document.getElementById('auto-execute-toggle');

  // Add debug info element to help with troubleshooting
  const debugInfo = document.createElement('div');
  debugInfo.id = 'debug-info';
  debugInfo.style.display = 'none';
  if (schemaTree && schemaTree.parentNode) {
    schemaTree.parentNode.appendChild(debugInfo);
  }

  // Add schema loaded message
  const schemaLoadedMsg = document.createElement('div');
  schemaLoadedMsg.className = 'schema-loaded-message';
  if (schemaTree && schemaTree.parentNode) {
    schemaTree.parentNode.appendChild(schemaLoadedMsg);
  }

  function showDebug(message) {
    if (!debugInfo) return;
    debugInfo.textContent = message;
    debugInfo.style.display = 'block';
    console.log('Debug:', message);
  }

  function updateSchemaLoadedMsg(numTables) {
    if (!schemaLoadedMsg) return;
    schemaLoadedMsg.textContent = `Schema loaded: ${numTables} tables found`;
  }

  // Handle toggle explore panel button - initially hidden
  if (toggleExploreBtn && explorePanel) {
    toggleExploreBtn.addEventListener('click', () => {
      const isVisible = explorePanel.classList.contains('active');
      if (isVisible) {
        explorePanel.classList.remove('active');
        toggleExploreBtn.textContent = 'Explore Data';
      } else {
        explorePanel.classList.add('active');
        toggleExploreBtn.textContent = 'Hide Explorer';
      }
    });
  }

  // Initialize with schema data
  (async function loadSchema() {
    try {
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/schema`);
      if (!response.ok) {
        throw new Error(`Schema fetch failed: ${response.status} ${response.statusText}`);
      }

      const schema = await response.json();
      const numTables = Object.keys(schema).length;
      updateSchemaLoadedMsg(numTables);
      renderSchemaTree(schema);

      // Dispatch a custom event so other components can know the schema is loaded
      document.dispatchEvent(new CustomEvent('schemaLoaded', { detail: { schema } }));
    } catch (err) {
      console.error('Failed to load schema:', err);
      // Display error in the schema tree area
      if (schemaTree) {
        schemaTree.innerHTML = `
          <div style="padding:10px; background-color:#f8d7da; color:#721c24; border-radius:4px;">
            <strong>Error loading schema:</strong> ${err.message}
            <p>This could be due to:</p>
            <ul>
              <li>Database connection issues</li>
              <li>Invalid database format</li>
              <li>Server-side errors</li>
            </ul>
            <p>Check the console and server logs for more details.</p>
          </div>
        `;
      }
    }
  })();

  // No longer need tab switching since visualizations are auto-rendered

  // Enhanced query execution function (make it globally available)
  window.executeQuery = async function executeQuery(query) {
    if (!query || !query.trim()) return;

    const trimmedQuery = query.trim();
    
    // Show loading state
    const statusEl = document.getElementById('query-status');
    if (statusEl) {
      statusEl.textContent = 'Executing query...';
      statusEl.className = 'status loading';
    }

    try {
      // First try HTTP API approach
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: trimmedQuery })
      });

      if (response.ok) {
        const results = await response.json();
        handleQueryResults(results);
        
        if (statusEl) {
          if (results && results.length) {
            statusEl.textContent = `Success: ${results.length} rows returned`;
          } else {
            statusEl.textContent = 'Query executed successfully';
          }
          statusEl.className = 'status success';
          
          // Auto-hide after 5 seconds
          setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status';
          }, 5000);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (httpError) {
      console.warn('HTTP API failed, trying Socket.IO:', httpError);
      
      // Fallback to Socket.IO
      socket.emit('run-query', { query: trimmedQuery });
    }
  };

  // Handle query results (unified function for both HTTP and Socket.IO)
  function handleQueryResults(results) {
    showDebug(`Query returned ${Array.isArray(results) ? results.length : 'unknown'} results`);

    // Create or update the query results section
    createQueryResultsSection(results);

    // Keep existing visualizations and render new data to them
    if (results && Array.isArray(results) && results.length > 0) {
      // Render to all existing visualization components
      if (typeof TableView !== 'undefined') TableView.render(results);
      if (typeof BarChart !== 'undefined') BarChart.render(results);
      if (typeof LineChart !== 'undefined') LineChart.render(results);
      if (typeof PieChart !== 'undefined') PieChart.render(results);
      if (typeof HistogramChart !== 'undefined') HistogramChart.render(results);
      if (typeof ScatterChart !== 'undefined') ScatterChart.render(results);
    } else {
      // Show message for empty results
      if (typeof TableView !== 'undefined') {
        TableView.renderMessage('Query executed successfully. No results to display.');
      }
    }
  }

  // Create a separate query results section
  function createQueryResultsSection(results) {
    const queryPanel = document.querySelector('.query-panel');
    if (!queryPanel) return;

    // Remove existing query results section
    const existingResults = queryPanel.querySelector('.query-results-section');
    if (existingResults) {
      existingResults.remove();
    }

    // Create new results section
    const resultsSection = document.createElement('div');
    resultsSection.className = 'query-results-section';
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      resultsSection.innerHTML = `
        <div class="results-header">
          <h4>Query Results</h4>
          <span class="results-count">No results</span>
        </div>
        <div class="results-message">Query executed successfully but returned no rows.</div>
      `;
    } else {
      // Limit to 20 results for the preview
      const previewResults = results.slice(0, 20);
      const hasMore = results.length > 20;
      
      resultsSection.innerHTML = `
        <div class="results-header">
          <h4>Query Results</h4>
          <span class="results-count">${results.length.toLocaleString()} row${results.length !== 1 ? 's' : ''} ${hasMore ? '(showing first 20)' : ''}</span>
          <div class="results-actions">
            <button class="btn-xs export-csv-btn">Export CSV</button>
            <button class="btn-xs view-all-btn" ${!hasMore ? 'style="display:none"' : ''}>View All</button>
            <button class="btn-xs close-results-btn">×</button>
          </div>
        </div>
        <div class="results-table-container">
          ${generateResultsTable(previewResults)}
        </div>
      `;

      // Add event listeners
      const exportBtn = resultsSection.querySelector('.export-csv-btn');
      exportBtn?.addEventListener('click', () => exportToCSV(results));

      const viewAllBtn = resultsSection.querySelector('.view-all-btn');
      viewAllBtn?.addEventListener('click', () => {
        const container = resultsSection.querySelector('.results-table-container');
        container.innerHTML = generateResultsTable(results);
        viewAllBtn.style.display = 'none';
        resultsSection.querySelector('.results-count').textContent = `${results.length.toLocaleString()} row${results.length !== 1 ? 's' : ''}`;
      });

      const closeBtn = resultsSection.querySelector('.close-results-btn');
      closeBtn?.addEventListener('click', () => {
        resultsSection.remove();
      });
    }

    // Insert after query controls
    const queryControls = queryPanel.querySelector('.query-controls');
    if (queryControls) {
      queryControls.insertAdjacentElement('afterend', resultsSection);
    } else {
      queryPanel.appendChild(resultsSection);
    }

    // Smooth scroll to results
    setTimeout(() => {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // Generate HTML table for results
  function generateResultsTable(data) {
    if (!data || !data.length) {
      return '<div class="no-results">No data to display</div>';
    }

    const columns = Object.keys(data[0]);
    
    return `
      <table class="query-results-table">
        <thead>
          <tr>
            ${columns.map(col => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${columns.map(col => {
                const value = row[col];
                const displayValue = value === null || value === undefined ? 'NULL' : String(value);
                const isNull = value === null || value === undefined;
                return `<td class="${isNull ? 'null-value' : ''}">${displayValue}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Export results to CSV
  function exportToCSV(data) {
    if (!data || !data.length) return;

    const columns = Object.keys(data[0]);
    const csvContent = [
      columns.join(','), // Header
      ...data.map(row => 
        columns.map(col => {
          const value = row[col];
          const stringValue = value === null || value === undefined ? '' : String(value);
          // Escape quotes and wrap in quotes if contains comma
          return stringValue.includes(',') || stringValue.includes('"') 
            ? `"${stringValue.replace(/"/g, '""')}"` 
            : stringValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }


  // Run query button - Check if element exists
  if (runQueryBtn) {
    runQueryBtn.addEventListener('click', async () => {
      if (!queryInput) return;
      const query = queryInput.value.trim();
      if (!query) return;

      await window.executeQuery(query);
    });
  }

  // Add keyboard shortcut (Ctrl+Enter) for running queries
  if (queryInput) {
    queryInput.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        const query = queryInput.value.trim();
        if (query) {
          await window.executeQuery(query);
        }
      }
    });
  }

  // Handle query results from Socket.IO (fallback)
  socket.on('query-results', (results) => {
    handleQueryResults(results);
  });

  // Handle query errors
  socket.on('query-error', (data) => {
    showDebug(`Query error: ${data.error}`);

    if (typeof TableView !== 'undefined') {
      TableView.renderMessage(`Error: ${data.error}`);
    }

    // Hide visualizations grid and clear charts
    const visualizationsGrid = document.getElementById('visualizations-grid');
    if (visualizationsGrid) {
      visualizationsGrid.style.display = 'none';
    }

    // Clear all visualizations
    if (typeof BarChart !== 'undefined') BarChart.clear();
    if (typeof LineChart !== 'undefined') LineChart.clear();
    if (typeof PieChart !== 'undefined') PieChart.clear();
    if (typeof HistogramChart !== 'undefined') HistogramChart.clear();
    if (typeof ScatterChart !== 'undefined') ScatterChart.clear();
  });

  // Show table information
  async function showTableInfo(tableName) {
    try {
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/profile/${tableName}`);
      
      if (response.ok) {
        const profile = await response.json();
        displayTableProfile(tableName, profile);
      }
    } catch (err) {
      console.error('Error fetching table profile:', err);
    }
  }

  // Display table profile information
  function displayTableProfile(tableName, profile) {
    const tableInfoPanel = document.getElementById('table-info-panel');
    if (!tableInfoPanel) return;

    // Generate column type distribution chart
    const generateTypeDistribution = (columns) => {
      const typeCounts = {};
      columns.forEach(col => {
        const type = col.detectedType || col.type;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      
      const typeColors = {
        integer: '#4285F4',
        float: '#34A853', 
        string: '#FBBC05',
        date: '#EA4335',
        datetime: '#FF6D01',
        boolean: '#46BDC6',
        unknown: '#7F7F7F'
      };
      
      return Object.entries(typeCounts).map(([type, count]) => {
        const percent = Math.round((count / columns.length) * 100);
        return `
          <div class="type-bar-item">
            <div class="type-bar-label">${type} (${count})</div>
            <div class="type-bar">
              <div class="type-bar-fill" style="width: ${percent}%; background-color: ${typeColors[type] || '#999'}"></div>
            </div>
            <div class="type-bar-percent">${percent}%</div>
          </div>
        `;
      }).join('');
    };

    // Generate detailed column information with visualizations
    const generateColumnDetails = (columns) => {
      return columns.map(col => {
        const nullCount = col.nullCount || 0;
        const totalCount = profile.rowCount || 1;
        const completePercent = Math.round(((totalCount - nullCount) / totalCount) * 100);
        const uniqueCount = col.uniqueCount || 0;
        const uniquePercent = Math.round((uniqueCount / (totalCount - nullCount)) * 100) || 0;
        
        // Generate mini histogram for numeric columns
        const generateMiniHistogram = (column) => {
          if (!column.stats || !column.stats.histogram) return '';
          
          const hist = column.stats.histogram;
          if (!hist.buckets || !hist.counts) return '';
          
          const maxCount = Math.max(...hist.counts);
          return `
            <div class="mini-histogram">
              ${hist.counts.map((count, i) => {
                const height = maxCount > 0 ? (count / maxCount) * 20 : 0;
                return `<div class="mini-hist-bar" style="height: ${height}px;" title="${hist.buckets[i]}: ${count}"></div>`;
              }).join('')}
            </div>
          `;
        };

        // Generate examples with type-specific formatting
        const formatExamples = (examples, type) => {
          if (!examples || !examples.length) return '<span class="no-examples">No examples</span>';
          
          return examples.slice(0, 3).map(ex => {
            let formatted = ex;
            if (ex === null) formatted = 'NULL';
            else if (ex === '') formatted = '(empty)';
            else if (typeof ex === 'string' && ex.length > 15) formatted = ex.substring(0, 12) + '...';
            else if ((type === 'integer' || type === 'float') && !isNaN(Number(ex))) {
              formatted = Number(ex).toLocaleString();
            }
            return `<span class="example-value">${formatted}</span>`;
          }).join('');
        };

        return `
          <div class="column-detail-card" data-column="${col.name}">
            <div class="column-header">
              <div class="column-name-section">
                <h5 class="column-name">${col.name}</h5>
                ${col.primaryKey ? '<span class="badge primary-key">PK</span>' : ''}
                <span class="type-badge ${col.detectedType || col.type}">${col.detectedType || col.type}</span>
                ${col.confidence && col.confidence < 80 ? `<span class="confidence-badge">${col.confidence}%</span>` : ''}
              </div>
              <div class="column-actions">
                <button class="btn-xs analyze-column-btn" data-table="${tableName}" data-column="${col.name}">
                  📊 Analyze
                </button>
                <button class="btn-xs visualize-column-btn" data-table="${tableName}" data-column="${col.name}">
                  📈 Visualize
                </button>
              </div>
            </div>
            
            <div class="column-stats-grid">
              <div class="stat-item">
                <div class="stat-label">Unique Values</div>
                <div class="stat-value">${uniqueCount.toLocaleString()} (${uniquePercent}%)</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Completeness</div>
                <div class="stat-value">
                  <div class="progress-bar" title="${completePercent}% complete, ${nullCount} null values">
                    <div class="progress-fill" style="width: ${completePercent}%"></div>
                    <span class="progress-text">${completePercent}%</span>
                  </div>
                </div>
              </div>
              ${(col.detectedType === 'integer' || col.detectedType === 'float') && col.stats ? `
                <div class="stat-item">
                  <div class="stat-label">Range</div>
                  <div class="stat-value">${col.stats.min || 'N/A'} - ${col.stats.max || 'N/A'}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Mean</div>
                  <div class="stat-value">${col.stats.mean ? col.stats.mean.toFixed(2) : 'N/A'}</div>
                </div>
              ` : ''}
            </div>
            
            <div class="column-examples">
              <div class="examples-label">Sample Values:</div>
              <div class="examples-list">
                ${formatExamples(col.examples, col.detectedType || col.type)}
              </div>
            </div>
            
            ${(col.detectedType === 'integer' || col.detectedType === 'float') ? 
              `<div class="column-visualization-preview">
                <div class="viz-preview-label">Distribution Preview:</div>
                ${generateMiniHistogram(col)}
              </div>` : ''
            }
          </div>
        `;
      }).join('');
    };

    const infoHtml = `
      <div class="table-info-enhanced">
        <div class="table-header-section">
          <h3>Table Profile: ${tableName}</h3>
          <div class="table-meta-stats">
            <div class="meta-stat">
              <span class="meta-label">Rows:</span>
              <span class="meta-value">${(profile.rowCount || 0).toLocaleString()}</span>
            </div>
            <div class="meta-stat">
              <span class="meta-label">Columns:</span>
              <span class="meta-value">${profile.columns ? profile.columns.length : 0}</span>
            </div>
            <div class="meta-stat">
              <span class="meta-label">Size:</span>
              <span class="meta-value">${estimateTableSize(profile.rowCount, profile.columns?.length)}</span>
            </div>
          </div>
          <div class="table-actions">
            <button id="view-sample-data-btn" class="btn-primary">View Sample Data</button>
            <button id="export-profile-btn" class="btn-secondary">Export Profile</button>
          </div>
        </div>
        
        <div class="type-distribution-section">
          <h4>Column Type Distribution</h4>
          <div class="type-distribution-chart">
            ${profile.columns ? generateTypeDistribution(profile.columns) : '<div class="no-data">No column data available</div>'}
          </div>
        </div>
        
        <div class="columns-overview-section">
          <h4>Column Details</h4>
          <div class="columns-grid">
            ${profile.columns ? generateColumnDetails(profile.columns) : '<div class="no-data">No column information available</div>'}
          </div>
        </div>
        
        <div class="auto-visualizations-section">
          <h4>Column Visualizations</h4>
          <div id="column-visualizations-grid" class="column-viz-grid">
            <!-- Auto-generated visualizations will appear here -->
          </div>
        </div>
      </div>
    `;
    
    tableInfoPanel.innerHTML = infoHtml;
    tableInfoPanel.style.display = 'block';

    // Add event listeners for the new buttons
    addTableProfileEventListeners(tableName, profile);
    
    // Don't hide the query window - keep it visible so users can see and edit queries
    // The table info panel will show below the query area
  }

  // Helper function to estimate table size
  function estimateTableSize(rows, cols) {
    if (!rows || !cols) return 'Unknown';
    const estimatedBytes = rows * cols * 20; // Rough estimate
    if (estimatedBytes < 1024) return `${estimatedBytes} B`;
    if (estimatedBytes < 1024 * 1024) return `${Math.round(estimatedBytes / 1024)} KB`;
    if (estimatedBytes < 1024 * 1024 * 1024) return `${Math.round(estimatedBytes / (1024 * 1024))} MB`;
    return `${Math.round(estimatedBytes / (1024 * 1024 * 1024))} GB`;
  }

  // Add event listeners for table profile interactions
  function addTableProfileEventListeners(tableName, profile) {
    // View sample data button
    document.getElementById('view-sample-data-btn')?.addEventListener('click', () => {
      if (queryInput) {
        queryInput.value = `SELECT * FROM ${tableName} LIMIT 100;`;
        if (runQueryBtn) runQueryBtn.click();
      }
    });

    // Export profile button
    document.getElementById('export-profile-btn')?.addEventListener('click', () => {
      const dataStr = JSON.stringify(profile, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tableName}_profile.json`;
      link.click();
      URL.revokeObjectURL(url);
    });

    // Analyze column buttons
    document.querySelectorAll('.analyze-column-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const table = btn.dataset.table;
        const column = btn.dataset.column;
        await showDetailedColumnAnalysis(table, column);
      });
    });

    // Visualize column buttons
    document.querySelectorAll('.visualize-column-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const table = btn.dataset.table;
        const column = btn.dataset.column;
        await createColumnVisualization(table, column);
      });
    });

    // Generate automatic visualizations for each column
    generateColumnVisualizations(tableName, profile);
  }

  // Show detailed column analysis
  async function showDetailedColumnAnalysis(tableName, columnName) {
    try {
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/stats/${encodeURIComponent(tableName)}/${encodeURIComponent(columnName)}`);
      
      if (response.ok) {
        const stats = await response.json();
        displayColumnAnalysisModal(tableName, columnName, stats);
      } else {
        showDebug('Failed to fetch column statistics');
      }
    } catch (err) {
      console.error('Error fetching column analysis:', err);
      showDebug(`Error: ${err.message}`);
    }
  }

  // Display column analysis in a modal
  function displayColumnAnalysisModal(tableName, columnName, stats) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'column-analysis-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Column Analysis: ${columnName}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="analysis-stats">
            <div class="stat-card">
              <div class="stat-label">Total Values</div>
              <div class="stat-value">${(stats.count || 0).toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Unique Values</div>
              <div class="stat-value">${(stats.distinctCount || 0).toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Null Values</div>
              <div class="stat-value">${(stats.nulls || 0).toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Completeness</div>
              <div class="stat-value">${Math.round(((stats.count || 0) / (stats.count + stats.nulls || 1)) * 100)}%</div>
            </div>
          </div>
          
          ${stats.min !== undefined ? `
            <div class="numeric-stats">
              <h4>Numeric Statistics</h4>
              <div class="stat-grid">
                <div>Min: ${stats.min}</div>
                <div>Max: ${stats.max}</div>
                <div>Mean: ${stats.mean ? stats.mean.toFixed(2) : 'N/A'}</div>
                ${stats.percentile25 ? `<div>25th Percentile: ${stats.percentile25}</div>` : ''}
                ${stats.percentile75 ? `<div>75th Percentile: ${stats.percentile75}</div>` : ''}
              </div>
            </div>
          ` : ''}
          
          ${stats.topValues && stats.topValues.length > 0 ? `
            <div class="top-values">
              <h4>Top Values</h4>
              <table class="top-values-table">
                <thead>
                  <tr><th>Value</th><th>Count</th><th>%</th></tr>
                </thead>
                <tbody>
                  ${stats.topValues.map(item => `
                    <tr>
                      <td>${item.value}</td>
                      <td>${item.count.toLocaleString()}</td>
                      <td>${item.percent}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn-primary create-viz-btn" data-table="${tableName}" data-column="${columnName}">
            Create Visualization
          </button>
          <button class="btn-secondary modal-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
    });

    modal.querySelector('.create-viz-btn')?.addEventListener('click', (e) => {
      const table = e.target.dataset.table;
      const column = e.target.dataset.column;
      createColumnVisualization(table, column);
      document.body.removeChild(modal);
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  // Create visualization for a specific column
  async function createColumnVisualization(tableName, columnName) {
    try {
      // Create visualization container in table info panel
      const tableInfoPanel = document.getElementById('table-info-panel');
      if (!tableInfoPanel) return;

      // Create or find visualization section
      let vizSection = tableInfoPanel.querySelector('.column-visualizations');
      if (!vizSection) {
        vizSection = document.createElement('div');
        vizSection.className = 'column-visualizations';
        vizSection.innerHTML = '<h4>Column Visualizations</h4>';
        tableInfoPanel.appendChild(vizSection);
      }

      // Create visualization container
      const vizContainer = document.createElement('div');
      vizContainer.className = 'column-viz-container';
      vizContainer.innerHTML = `
        <div class="viz-header">
          <h5>${columnName} Distribution</h5>
          <button class="viz-remove-btn">×</button>
        </div>
        <div class="viz-content" id="viz-${columnName}-${Date.now()}"></div>
      `;

      vizSection.appendChild(vizContainer);

      // Add remove functionality
      vizContainer.querySelector('.viz-remove-btn').addEventListener('click', () => {
        vizSection.removeChild(vizContainer);
      });

      // Generate query and create visualization
      const query = `SELECT "${columnName}" FROM "${tableName}" WHERE "${columnName}" IS NOT NULL LIMIT 1000`;
      const baseUrl = window.location.origin || 'http://localhost';
      
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        const data = await response.json();
        const vizContent = vizContainer.querySelector('.viz-content');
        
        // Determine visualization type based on data
        if (data && data.length > 0) {
          const firstValue = data[0][columnName];
          
          if (typeof firstValue === 'number' || !isNaN(Number(firstValue))) {
            // Create histogram for numeric data
            createHistogramVisualization(data, columnName, vizContent);
          } else {
            // Create bar chart for categorical data
            createCategoricalVisualization(data, columnName, vizContent);
          }
        }
      }
    } catch (err) {
      console.error('Error creating column visualization:', err);
    }
  }

  // Create histogram visualization
  function createHistogramVisualization(data, columnName, container) {
    // Extract numeric values
    const values = data.map(d => Number(d[columnName])).filter(v => !isNaN(v));
    
    if (values.length === 0) {
      container.innerHTML = '<div class="no-data">No numeric data available</div>';
      return;
    }

    // Setup dimensions
    const width = container.clientWidth || 400;
    const height = 250;
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Clear container
    container.innerHTML = '';

    // Create histogram bins
    const x = d3.scaleLinear()
      .domain(d3.extent(values))
      .range([0, chartWidth]);

    const histogram = d3.histogram()
      .value(d => d)
      .domain(x.domain())
      .thresholds(x.ticks(10));

    const bins = histogram(values);

    // Create Y scale
    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length)])
      .nice()
      .range([chartHeight, 0]);

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add bars
    svg.selectAll('rect')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', d => x(d.x0))
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr('y', d => y(d.length))
      .attr('height', d => chartHeight - y(d.length))
      .attr('fill', '#4285F4');

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x));

    svg.append('g')
      .call(d3.axisLeft(y));
  }

  // Create categorical visualization
  function createCategoricalVisualization(data, columnName, container) {
    // Count occurrences
    const counts = {};
    data.forEach(d => {
      const value = d[columnName];
      counts[value] = (counts[value] || 0) + 1;
    });

    // Convert to array and sort
    const chartData = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10

    if (chartData.length === 0) {
      container.innerHTML = '<div class="no-data">No data available</div>';
      return;
    }

    // Setup dimensions
    const width = container.clientWidth || 400;
    const height = 250;
    const margin = { top: 20, right: 30, bottom: 80, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Clear container
    container.innerHTML = '';

    // Create scales
    const x = d3.scaleBand()
      .domain(chartData.map(d => d[0]))
      .range([0, chartWidth])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d[1]) * 1.1])
      .nice()
      .range([chartHeight, 0]);

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add bars
    svg.selectAll('rect')
      .data(chartData)
      .enter()
      .append('rect')
      .attr('x', d => x(d[0]))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d[1]))
      .attr('height', d => chartHeight - y(d[1]))
      .attr('fill', '#4285F4');

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    svg.append('g')
      .call(d3.axisLeft(y));
  }

  // Generate automatic visualizations for all columns
  async function generateColumnVisualizations(tableName, profile) {
    const vizGrid = document.getElementById('column-visualizations-grid');
    if (!vizGrid || !profile.columns) return;

    // Clear existing visualizations
    vizGrid.innerHTML = '';

    // Generate visualization for each column
    for (const column of profile.columns) {
      await createAutoColumnVisualization(tableName, column, vizGrid);
    }
  }

  // Create automatic visualization for a single column
  async function createAutoColumnVisualization(tableName, column, container) {
    try {
      // Create visualization container
      const vizItem = document.createElement('div');
      vizItem.className = 'column-viz-item';
      vizItem.innerHTML = `
        <div class="viz-item-header">
          <h5>${column.name}</h5>
          <span class="viz-type-badge">${column.detectedType || column.type}</span>
        </div>
        <div class="viz-item-content" id="viz-${column.name.replace(/[^a-zA-Z0-9]/g, '_')}">
          <div class="loading-viz">Loading...</div>
        </div>
      `;

      container.appendChild(vizItem);

      const vizContent = vizItem.querySelector('.viz-item-content');

      // Fetch data for this column
      const baseUrl = window.location.origin || 'http://localhost';
      const query = `SELECT "${column.name}" FROM "${tableName}" WHERE "${column.name}" IS NOT NULL LIMIT 1000`;
      
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Clear loading state
        vizContent.innerHTML = '';

        // Generate appropriate visualization based on column type
        if (column.detectedType === 'integer' || column.detectedType === 'float') {
          createInlineHistogram(data, column.name, vizContent);
        } else if (column.detectedType === 'string') {
          createInlineBarChart(data, column.name, vizContent);
        } else if (column.detectedType === 'date' || column.detectedType === 'datetime') {
          createInlineTimeChart(data, column.name, vizContent);
        } else {
          vizContent.innerHTML = '<div class="viz-message">No visualization available for this data type</div>';
        }
      } else {
        vizContent.innerHTML = '<div class="viz-error">Failed to load data</div>';
      }
    } catch (err) {
      console.error('Error creating column visualization:', err);
    }
  }

  // Create inline histogram for numeric data
  function createInlineHistogram(data, columnName, container) {
    const values = data.map(d => Number(d[columnName])).filter(v => !isNaN(v));
    
    if (values.length === 0) {
      container.innerHTML = '<div class="viz-message">No numeric data</div>';
      return;
    }

    const width = 280;
    const height = 120;
    const margin = { top: 10, right: 15, bottom: 25, left: 25 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create histogram bins
    const x = d3.scaleLinear()
      .domain(d3.extent(values))
      .range([0, chartWidth]);

    const histogram = d3.histogram()
      .value(d => d)
      .domain(x.domain())
      .thresholds(x.ticks(8));

    const bins = histogram(values);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length)])
      .nice()
      .range([chartHeight, 0]);

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add bars
    svg.selectAll('rect')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', d => x(d.x0))
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr('y', d => y(d.length))
      .attr('height', d => chartHeight - y(d.length))
      .attr('fill', '#4285F4')
      .attr('opacity', 0.8);

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.0f')));

    svg.append('g')
      .call(d3.axisLeft(y).ticks(3));
  }

  // Create inline bar chart for categorical data
  function createInlineBarChart(data, columnName, container) {
    // Count occurrences
    const counts = {};
    data.forEach(d => {
      const value = d[columnName];
      if (value) counts[value] = (counts[value] || 0) + 1;
    });

    const chartData = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Top 8 categories

    if (chartData.length === 0) {
      container.innerHTML = '<div class="viz-message">No categorical data</div>';
      return;
    }

    const width = 280;
    const height = 120;
    const margin = { top: 10, right: 15, bottom: 40, left: 25 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const x = d3.scaleBand()
      .domain(chartData.map(d => d[0]))
      .range([0, chartWidth])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d[1]) * 1.1])
      .nice()
      .range([chartHeight, 0]);

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add bars
    svg.selectAll('rect')
      .data(chartData)
      .enter()
      .append('rect')
      .attr('x', d => x(d[0]))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d[1]))
      .attr('height', d => chartHeight - y(d[1]))
      .attr('fill', '#34A853')
      .attr('opacity', 0.8);

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .style('font-size', '10px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(3));
  }

  // Create inline time chart for date data
  function createInlineTimeChart(data, columnName, container) {
    // Parse dates and count by month/day
    const dateCounts = {};
    data.forEach(d => {
      const dateStr = d[columnName];
      if (dateStr) {
        try {
          const date = new Date(dateStr);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          dateCounts[monthKey] = (dateCounts[monthKey] || 0) + 1;
        } catch (e) {
          // Skip invalid dates
        }
      }
    });

    const chartData = Object.entries(dateCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12); // Last 12 months

    if (chartData.length === 0) {
      container.innerHTML = '<div class="viz-message">No valid date data</div>';
      return;
    }

    const width = 280;
    const height = 120;
    const margin = { top: 10, right: 15, bottom: 25, left: 25 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const x = d3.scaleBand()
      .domain(chartData.map(d => d[0]))
      .range([0, chartWidth])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d[1]) * 1.1])
      .nice()
      .range([chartHeight, 0]);

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add line
    const line = d3.line()
      .x(d => x(d[0]) + x.bandwidth() / 2)
      .y(d => y(d[1]));

    svg.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#EA4335')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add points
    svg.selectAll('circle')
      .data(chartData)
      .enter()
      .append('circle')
      .attr('cx', d => x(d[0]) + x.bandwidth() / 2)
      .attr('cy', d => y(d[1]))
      .attr('r', 3)
      .attr('fill', '#EA4335');

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x).tickFormat(d => d.slice(-2)))
      .selectAll('text')
      .style('font-size', '10px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(3));
  }

  // Render the schema tree
  function renderSchemaTree(schema) {
    if (!schemaTree) return;
    schemaTree.innerHTML = '';

    // Add expand all button
    const expandAllBtn = document.createElement('button');
    expandAllBtn.textContent = 'Expand All';
    expandAllBtn.className = 'expand-all-btn';
    expandAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.table-item').forEach(item => {
        item.classList.add('expanded');
      });
    });
    schemaTree.appendChild(expandAllBtn);

    // Validate schema
    if (!schema || typeof schema !== 'object') {
      showDebug(`Invalid schema format: ${typeof schema}`);
      schemaTree.innerHTML += '<div class="error-message">Error: Invalid schema format</div>';
      return;
    }

    const tables = Object.keys(schema);
    if (tables.length === 0) {
      schemaTree.innerHTML += '<div class="message">No tables found in database</div>';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'schema-list';

    tables.forEach(tableName => {
      const columns = schema[tableName];

      const tableItem = document.createElement('li');
      tableItem.className = 'table-item';

      const tableHeader = document.createElement('div');
      tableHeader.className = 'table-header';
      tableHeader.textContent = tableName;

      // Toggle expand/collapse and execute query
      tableHeader.addEventListener('click', async () => {
        tableItem.classList.toggle('expanded');
        
        // Set query and auto-execute if enabled
        if (queryInput) {
          queryInput.value = `SELECT * FROM ${tableName} LIMIT 10;`;
          queryInput.focus();
          
          // Show column details in table view
          await showTableInfo(tableName);
          
          // Auto-execute if toggle is checked
          if (autoExecuteToggle && autoExecuteToggle.checked) {
            setTimeout(() => {
              if (runQueryBtn) {
                runQueryBtn.click();
              }
            }, 100);
          }
        }
      });

      tableItem.appendChild(tableHeader);

      // Make sure columns is an array before proceeding
      if (Array.isArray(columns)) {
        // Add quick action to select all columns
        tableHeader.addEventListener('dblclick', () => {
          if (!queryInput) return;

          // Make sure all columns have a name property
          const columnNames = columns
            .filter(col => col && typeof col === 'object' && col.name)
            .map(col => col.name);

          if (columnNames.length > 0) {
            const columnsStr = columnNames.join(', ');
            queryInput.value = `SELECT ${columnsStr} FROM ${tableName} LIMIT 10;`;

            // Focus and optionally auto-run query
            queryInput.focus();
          } else {
            queryInput.value = `SELECT * FROM ${tableName} LIMIT 10;`;
            queryInput.focus();
          }
        });

        const columnsList = document.createElement('ul');
        columnsList.className = 'columns-list';

        columns.forEach(column => {
          // Validate column object
          if (!column || typeof column !== 'object') {
            console.error(`Invalid column in table ${tableName}:`, column);
            return;
          }

          const columnName = column.name || 'unknown';
          const columnType = column.type || 'unknown';
          const isPrimaryKey = column.primaryKey === true;

          const columnItem = document.createElement('li');
          columnItem.className = 'column-item';
          columnItem.innerHTML = `
            <span class="column-name">${columnName}</span>
            <span class="column-type">(${columnType})</span>
            ${isPrimaryKey ? '<span class="primary-key">PK</span>' : ''}
          `;

          // Add click handler to insert column name into query
          columnItem.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering table expand/collapse

            if (!queryInput) return;

            // Insert column name at cursor position or append
            const cursorPos = queryInput.selectionStart;
            const currentValue = queryInput.value;

            if (cursorPos !== undefined) {
              queryInput.value = currentValue.substring(0, cursorPos) +
                                columnName +
                                currentValue.substring(queryInput.selectionEnd);
              // Move cursor after inserted column name
              queryInput.selectionStart = queryInput.selectionEnd = cursorPos + columnName.length;
            } else {
              // Fallback to append
              queryInput.value += columnName;
            }

            queryInput.focus();
          });

          columnsList.appendChild(columnItem);
        });

        tableItem.appendChild(columnsList);
      } else {
        // Handle case where columns is not an array
        console.error(`Columns for table ${tableName} is not an array:`, columns);

        // Create a special message for this case
        const errorList = document.createElement('ul');
        errorList.className = 'columns-list error';

        const errorItem = document.createElement('li');
        errorItem.className = 'column-item error';
        errorItem.textContent = `Could not load columns. Double-click to query table.`;

        errorList.appendChild(errorItem);
        tableItem.appendChild(errorList);

        // Still allow querying the table
        tableHeader.addEventListener('dblclick', () => {
          if (!queryInput) return;
          queryInput.value = `SELECT * FROM ${tableName} LIMIT 10;`;
          queryInput.focus();
        });
      }

      ul.appendChild(tableItem);
    });

    schemaTree.appendChild(ul);
  }
});