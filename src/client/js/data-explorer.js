
class DataExplorer {
  constructor() {
    // Initialize properties
    this.currentTable = null;
    this.tableProfile = null;
    this.recommendations = [];

    // Tracking for visualizations to prevent duplicates
    this.createdVisualizations = new Set();

    // UI elements
    this.explorePanelEl = document.getElementById('explore-panel');
    this.profilePanelEl = document.getElementById('profile-panel');
    this.recsPanelEl = document.getElementById('recommendations-panel');

    // Create visualization containers
    this.createVisualizationPanels();

    // Create toast container for notifications
    this.createToastContainer();

    // Initialize event listeners
    this.initEventListeners();
  }

  // Creates a container for toast notifications
  createToastContainer() {
    // Check if toast container already exists
    if (document.getElementById('toast-container')) return;

    // Create toast container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';

    // Add to document
    document.body.appendChild(toastContainer);
  }

  // Shows a toast notification
  showToast(message, duration = 3000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.backgroundColor = '#333';
    toast.style.color = 'white';
    toast.style.padding = '10px 15px';
    toast.style.borderRadius = '4px';
    toast.style.marginTop = '10px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-in-out';

    // Get toast container
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Add toast to container
    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    // Remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, duration);
  }
  
  createVisualizationPanels() {
    // Create a container for auto-generated visualizations
    this.visualizationsContainer = document.createElement('div');
    this.visualizationsContainer.className = 'auto-visualizations-container';
    this.visualizationsContainer.style.display = 'flex';
    this.visualizationsContainer.style.flexWrap = 'wrap';
    this.visualizationsContainer.style.gap = '20px';
    this.visualizationsContainer.style.marginTop = '20px';

    // Add it to the profile panel
    if (this.profilePanelEl) {
      this.profilePanelEl.appendChild(this.visualizationsContainer);
    }

    // Add some CSS for the profile actions and visualization buttons
    const style = document.createElement('style');
    style.textContent = `
      .profile-actions {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }
      .btn-primary {
        background-color: #4285F4;
        color: white;
      }
      .btn-secondary {
        background-color: #34A853;
        color: white;
      }
      .viz-close-btn:hover {
        color: #ff4444;
      }
      .visualization-actions {
        margin: 20px 0;
      }
      .viz-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      .viz-button {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        background-color: #f8f9fa;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
      }
      .viz-button:hover {
        background-color: #e9ecef;
        border-color: #ced4da;
      }
      .viz-button:active {
        background-color: #dce1e7;
      }
      .viz-button:disabled {
        opacity: 0.7;
        cursor: default;
        background-color: #e9ecef;
      }
      .viz-icon {
        font-size: 1.2em;
        margin-right: 8px;
      }
      .viz-title {
        font-size: 0.9em;
      }
    `;
    document.head.appendChild(style);
  }
  
  initEventListeners() {
    // Add a global event listener for all close buttons in the explore panel
    document.addEventListener('click', (e) => {
      // Check if this is a close button click
      if (e.target.id === 'close-profile-btn' ||
          e.target.id === 'close-stats-btn' ||
          e.target.classList.contains('close-explorer-btn')) {
        // Hide the explore panel
        if (this.explorePanelEl) {
          this.explorePanelEl.style.display = 'none';

          // Clear any visualizations to prevent memory leaks
          if (this.visualizationsContainer) {
            this.visualizationsContainer.innerHTML = '';

            // Also clear the visualization tracking set
            this.createdVisualizations.clear();
          }

          // Show toast notification
          this.showToast('Closed explorer panel');
        }
      }
    });

    // Add listener to schema tree for quick profile - only when explore panel is active
    document.addEventListener('click', (e) => {
      // Only intercept clicks if explore panel is active
      if (!this.explorePanelEl.classList.contains('active')) {
        return;
      }

      // Find closest table header if clicked on table element
      const tableHeader = e.target.closest('.table-header');
      if (tableHeader) {
        e.preventDefault();
        e.stopPropagation();

        const tableName = tableHeader.textContent.trim();
        this.showTableProfile(tableName);
      }

      // Check for column item clicks - show stats when explore panel is active
      const columnItem = e.target.closest('.column-item');
      if (columnItem) {
        e.preventDefault();
        e.stopPropagation();

        const tableName = columnItem.closest('.table-item').querySelector('.table-header').textContent.trim();
        const columnName = columnItem.querySelector('.column-name').textContent.trim();

        this.showColumnStats(tableName, columnName);
      }
    });
    
    // Listen for explore button clicks
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('explore-table-btn')) {
        const tableName = e.target.dataset.table;
        if (tableName) {
          this.showTableProfile(tableName);
        }
      }
    });
    
    // Add explore buttons to table headers after schema load
    document.addEventListener('schemaLoaded', async (e) => {
      try {
        const schema = e.detail.schema;
        this.addExploreButtons(schema);

        // Show a toast message indicating that the schema is loaded
        const tables = Object.keys(schema);
        if (tables.length > 0) {
          this.showToast(`Schema loaded. ${tables.length} tables found. Click on a table name to explore.`, 5000);
        }
      } catch (err) {
        console.error('Error handling schema loaded event:', err);
      }
    });
    
    // Handle visualization recommendation clicks
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('apply-viz-recommendation')) {
        const recIndex = parseInt(e.target.dataset.index, 10);
        if (!isNaN(recIndex) && this.recommendations[recIndex]) {
          // Apply with execute immediately set to true
          this.applyVisualizationRecommendation(this.recommendations[recIndex], true);

          // Let the user know the visualization is being created
          e.target.textContent = 'Applying...';
          setTimeout(() => {
            e.target.textContent = 'Applied';
            e.target.disabled = true;
          }, 1000);
        }
      }
    });
  }
  
  addExploreButtons(schema) {
    const tableHeaders = document.querySelectorAll('.table-header');
    tableHeaders.forEach(header => {
      const tableName = header.textContent.trim();
      
      // Only add if this is actually a table in the schema
      if (schema[tableName]) {
        // Check if a button already exists
        if (!header.querySelector('.explore-table-btn')) {
          const exploreBtn = document.createElement('button');
          exploreBtn.className = 'explore-table-btn';
          exploreBtn.dataset.table = tableName;
          exploreBtn.title = 'Explore table data';
          exploreBtn.innerHTML = '<span>📊</span>';
          exploreBtn.style.marginLeft = '5px';
          exploreBtn.style.fontSize = '0.85em';
          
          header.appendChild(exploreBtn);
        }
      }
    });
  }
  
  async showTableProfile(tableName) {
    try {
      // Show loading state
      this.profilePanelEl.innerHTML = '<div class="loading">Loading profile for ' + tableName + '...</div>';
      this.explorePanelEl.style.display = 'block';
      this.currentTable = tableName;
      
      // Create a query to quickly show row count while profile loads
      if (window.queryHandler) {
        try {
          // Sanitize table name for safe querying
          const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
          const countQuery = `SELECT COUNT(*) as count FROM "${safeTableName}"`;
          window.queryHandler.setQuery(countQuery, true); // Execute immediately
        } catch (err) {
          console.error('Error executing count query:', err);
        }
      }
      
      // Fetch the table profile
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/profile/${encodeURIComponent(tableName)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status} ${response.statusText}`);
      }

      this.tableProfile = await response.json();
      
      // Render profile data
      this.renderTableProfile();
      
      // Recreate visualization container (clear previous visualizations)
      this.createVisualizationPanels();

      // Clear the visualization tracking set
      this.createdVisualizations.clear();
      
      // Get visualization recommendations
      this.getVisualizationRecommendations();
      
      // Expand the table in the schema tree
      const tableItems = document.querySelectorAll('.table-item');
      tableItems.forEach(item => {
        const header = item.querySelector('.table-header');
        if (header && header.textContent.trim() === tableName) {
          item.classList.add('expanded');
        }
      });
    } catch (err) {
      console.error('Error loading table profile:', err);
      this.profilePanelEl.innerHTML = `
        <div class="error-message">
          <strong>Error loading profile:</strong> ${err.message}
        </div>
      `;
    }
  }
  
  async showColumnStats(tableName, columnName) {
    try {
      // Show loading state
      this.profilePanelEl.innerHTML = '<div class="loading">Loading statistics for ' + columnName + '...</div>';
      this.explorePanelEl.style.display = 'block';
      this.currentTable = tableName;
      
      // First, execute a query to show the data while stats are loading
      if (window.queryHandler) {
        try {
          // Sanitize names for safe querying
          const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
          const safeColumnName = columnName.replace(/[^a-zA-Z0-9_]/g, '');
          
          // Basic query to show column values
          const dataQuery = `SELECT "${safeColumnName}" FROM "${safeTableName}" LIMIT 200`;
          window.queryHandler.setQuery(dataQuery, true);
        } catch (err) {
          console.error('Error executing column data query:', err);
        }
      }
      
      // Fetch the column statistics
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/stats/${encodeURIComponent(tableName)}/${encodeURIComponent(columnName)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
      }

      const stats = await response.json();
      
      // Render column statistics
      this.renderColumnStats(columnName, stats);
      
      // Recreate visualization container
      this.createVisualizationPanels();

      // Clear the visualization tracking set
      this.createdVisualizations.clear();
      
      // No longer automatically create visualizations
      // We'll add buttons for users to explicitly request visualizations
      
      // Store visualization suggestions for buttons instead of auto-applying
      this.columnVisualizationSuggestions = [];

      // Add visualization suggestions based on data type
      if (stats.min !== undefined && stats.max !== undefined) {
        // Numeric data - suggest histogram
        this.columnVisualizationSuggestions.push({
          type: 'histogram',
          title: `Distribution of ${columnName}`,
          columnName: columnName,
          tableName: tableName,
          query: `SELECT "${columnName}" FROM "${tableName}" WHERE "${columnName}" IS NOT NULL LIMIT 1000`,
          tabName: 'histogram'
        });
      }

      if (stats.isLikelyCategorical && stats.categories) {
        // Categorical data - suggest bar chart
        this.columnVisualizationSuggestions.push({
          type: 'bar',
          title: `Frequency of ${columnName} values`,
          columnName: columnName,
          tableName: tableName,
          query: `SELECT "${columnName}", COUNT(*) as count FROM "${tableName}" GROUP BY "${columnName}" ORDER BY count DESC LIMIT 20`,
          tabName: 'bar'
        });
      }

      if (stats.minDate !== undefined && stats.maxDate !== undefined) {
        // Date data - suggest line chart
        this.columnVisualizationSuggestions.push({
          type: 'line',
          title: `${columnName} over time`,
          columnName: columnName,
          tableName: tableName,
          query: `SELECT "${columnName}", COUNT(*) as count FROM "${tableName}" GROUP BY "${columnName}" ORDER BY "${columnName}" LIMIT 100`,
          tabName: 'line'
        });
      }

      // If we have suggestions, show a toast notification
      if (this.columnVisualizationSuggestions.length > 0) {
        this.showToast(`Column visualization options available. Look for the Visualize buttons.`, 4000);
      }
    } catch (err) {
      console.error('Error loading column stats:', err);
      this.profilePanelEl.innerHTML = `
        <div class="error-message">
          <strong>Error loading statistics:</strong> ${err.message}
        </div>
      `;
    }
  }
  
  async getVisualizationRecommendations() {
    try {
      if (!this.currentTable) return;
      
      this.recsPanelEl.innerHTML = '<div class="loading">Generating visualization recommendations...</div>';
      
      // Fetch recommendations from the server
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/visualizations/${encodeURIComponent(this.currentTable)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.status} ${response.statusText}`);
      }

      this.recommendations = await response.json();
      
      // Render recommendations
      this.renderRecommendations();
      
      // No longer automatically apply recommendations
      // Instead, we'll show a message encouraging the user to click on Apply buttons
      if (this.recommendations && this.recommendations.length > 0) {
        this.showToast('Visualization recommendations ready. Click "Apply" to generate charts.', 5000);
      } else {
        this.showToast('No visualization recommendations available for this table.', 3000);
      }
    } catch (err) {
      console.error('Error getting visualization recommendations:', err);
      this.recsPanelEl.innerHTML = `
        <div class="error-message">
          <strong>Error generating recommendations:</strong> ${err.message}
        </div>
      `;
    }
  }
  
  renderTableProfile() {
    if (!this.tableProfile) return;
    
    const profile = this.tableProfile;
    const columns = Object.values(profile.columns);
    
    // Create a table summary
    const html = `
      <div class="profile-header">
        <h3>Table Profile: ${profile.tableName}</h3>
        <div class="profile-meta">
          <span><strong>Rows:</strong> ${profile.rowCount.toLocaleString()}</span>
          <span><strong>Columns:</strong> ${profile.columnCount}</span>
        </div>
        <div class="profile-actions">
          <button id="view-top-100-btn" class="btn-sm btn-primary">View Top 100 Records</button>
          <button id="close-profile-btn" class="btn-sm">Close</button>
        </div>
      </div>
      
      <div class="column-type-summary">
        <h4>Column Types</h4>
        <div class="type-bars">
          ${this.generateTypeDistributionChart(columns)}
        </div>
      </div>
      
      <div class="column-list">
        <h4>Column Details</h4>
        <table class="column-details-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Type</th>
              <th>Unique</th>
              <th>Complete</th>
              <th>Examples</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${columns.map(col => this.renderColumnRow(col)).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="auto-visualizations-container">
        <!-- Visualizations will be added here automatically -->
      </div>
    `;
    
    this.profilePanelEl.innerHTML = html;
    
    // Keep a reference to the container
    this.visualizationsContainer = document.querySelector('.auto-visualizations-container');

    // Add view top 100 records button handler
    document.getElementById('view-top-100-btn')?.addEventListener('click', () => {
      if (window.queryHandler && profile.tableName) {
        // Sanitize the table name to prevent SQL injection
        const safeTableName = profile.tableName.replace(/[^a-zA-Z0-9_]/g, '');
        const query = `SELECT * FROM "${safeTableName}" LIMIT 100;`;

        // Set the query in the query input and execute it
        window.queryHandler.setQuery(query, true);

        // Show a toast notification
        this.showToast(`Viewing top 100 records from ${profile.tableName}`);
      }
    });
    
    // Add column stats buttons handlers
    columns.forEach(col => {
      const btn = document.getElementById(`stats-btn-${col.name}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.showColumnStats(profile.tableName, col.name);
        });
      }
    });
  }
  
  renderColumnRow(column) {
    if (!column) return '';
    
    const nullCount = column.stats.nullCount || 0;
    const totalCount = column.stats.totalCount || 1;
    const completePercent = Math.round(((totalCount - nullCount) / totalCount) * 100);
    
    const uniqueCount = column.stats.uniqueCount || 0;
    const uniquePercent = Math.round((uniqueCount / (totalCount - nullCount)) * 100) || 0;
    
    return `
      <tr>
        <td>
          <span class="column-name" title="Column: ${column.name}${column.primaryKey ? ' (Primary Key)' : ''}">${column.name}</span>
          ${column.primaryKey ? '<span class="badge primary-key" title="Primary Key Column">PK</span>' : ''}
        </td>
        <td>
          <span class="type-badge ${column.detectedType}" title="Data Type: ${column.detectedType}${column.confidence < 80 ? ` (${column.confidence}% confidence)` : ''}">${column.detectedType}</span>
          ${column.confidence < 80 ? `<span class="confidence" title="Type detection confidence: ${column.confidence}%">(${column.confidence}%)</span>` : ''}
        </td>
        <td title="Unique Values: ${uniqueCount.toLocaleString()} out of ${(totalCount - nullCount).toLocaleString()} non-null values (${uniquePercent}%)">${uniqueCount.toLocaleString()} (${uniquePercent}%)</td>
        <td>
          <div class="progress-bar" title="Data Completeness: ${completePercent}% complete (${(totalCount - nullCount).toLocaleString()} values, ${nullCount.toLocaleString()} null values)">
            <div class="progress-fill" style="width: ${completePercent}%"></div>
          </div>
        </td>
        <td>
          <div class="examples-list" title="Sample values from this column">
            ${(column.examples || []).slice(0, 3).map(ex => 
              `<span class="example-value" title="Example value: ${ex}">${this.formatExampleValue(ex, column.detectedType)}</span>`
            ).join('')}
          </div>
        </td>
        <td>
          <button id="stats-btn-${column.name}" class="btn-sm" title="View detailed statistics for ${column.name}">Stats</button>
        </td>
      </tr>
    `;
  }
  
  formatExampleValue(value, type) {
    if (value === null) return 'NULL';
    if (value === '') return '(empty)';
    
    // Truncate long strings
    if (typeof value === 'string' && value.length > 20) {
      return value.substring(0, 18) + '...';
    }
    
    // Format numbers
    if (type === 'integer' || type === 'float') {
      if (typeof value === 'number' || !isNaN(Number(value))) {
        return Number(value).toLocaleString();
      }
    }
    
    return value;
  }
  
  generateTypeDistributionChart(columns) {
    // Count column types
    const typeCounts = {};
    columns.forEach(col => {
      const type = col.detectedType;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    // Define colors for each type
    const typeColors = {
      integer: '#4285F4',
      float: '#34A853',
      string: '#FBBC05',
      date: '#EA4335',
      datetime: '#FF6D01',
      boolean: '#46BDC6',
      unknown: '#7F7F7F'
    };
    
    // Generate the bars
    return Object.entries(typeCounts).map(([type, count]) => {
      const percent = Math.round((count / columns.length) * 100);
      return `
        <div class="type-bar-item" title="Data Type: ${type} - ${count} columns (${percent}% of all columns)">
          <div class="type-bar-label">${type} (${count})</div>
          <div class="type-bar" title="${count} columns of type ${type}">
            <div class="type-bar-fill" style="width: ${percent}%; background-color: ${typeColors[type] || '#999'}"></div>
          </div>
          <div class="type-bar-percent">${percent}%</div>
        </div>
      `;
    }).join('');
  }
  
  renderColumnStats(columnName, stats) {
    if (!stats) return;
    
    let html = `
      <div class="profile-header">
        <h3>Column Statistics: ${columnName}</h3>
        <div class="profile-meta">
          <span><strong>Table:</strong> ${this.currentTable}</span>
          <button id="back-to-profile-btn" class="btn-sm">Back to Profile</button>
        </div>
        <div class="profile-actions">
          <button id="view-column-data-btn" class="btn-sm btn-primary">View Column Data</button>
          <button id="view-top-100-records-btn" class="btn-sm btn-secondary">View Top 100 Records</button>
          <button id="close-stats-btn" class="btn-sm">Close</button>
        </div>
      </div>
    `;
    
    // Check for error
    if (stats.error) {
      html += `<div class="error-message">${stats.error}</div>`;
      this.profilePanelEl.innerHTML = html;
      return;
    }
    
    // Add basic stats section
    html += `
      <div class="stats-summary">
        <div class="stats-card">
          <div class="stats-value">${stats.count?.toLocaleString() || 0}</div>
          <div class="stats-label">Total Values</div>
        </div>
        <div class="stats-card">
          <div class="stats-value">${stats.distinctCount?.toLocaleString() || 0}</div>
          <div class="stats-label">Unique Values</div>
        </div>
        <div class="stats-card">
          <div class="stats-value">${stats.nulls?.toLocaleString() || 0}</div>
          <div class="stats-label">Null Values</div>
        </div>
      </div>
    `;
    
    // Add type-specific stats sections
    if (stats.min !== undefined || stats.max !== undefined) {
      // Numeric stats section
      html += `
        <div class="stats-detail-section">
          <h4>Numeric Statistics</h4>
          <div class="stats-grid">
            ${stats.min !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Min</div>
                <div class="stat-value">${stats.min?.toLocaleString()}</div>
              </div>
            ` : ''}
            ${stats.max !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Max</div>
                <div class="stat-value">${stats.max?.toLocaleString()}</div>
              </div>
            ` : ''}
            ${stats.mean !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Mean</div>
                <div class="stat-value">${(+stats.mean).toLocaleString()}</div>
              </div>
            ` : ''}
            ${stats.percentile25 !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">25th Percentile</div>
                <div class="stat-value">${(+stats.percentile25).toLocaleString()}</div>
              </div>
            ` : ''}
            ${stats.percentile75 !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">75th Percentile</div>
                <div class="stat-value">${(+stats.percentile75).toLocaleString()}</div>
              </div>
            ` : ''}
          </div>
          
          ${stats.histogram ? this.renderHistogram(stats.histogram) : ''}
        </div>
      `;
    } else if (stats.minLength !== undefined || stats.maxLength !== undefined) {
      // Text stats section
      html += `
        <div class="stats-detail-section">
          <h4>Text Statistics</h4>
          <div class="stats-grid">
            ${stats.minLength !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Min Length</div>
                <div class="stat-value">${stats.minLength}</div>
              </div>
            ` : ''}
            ${stats.maxLength !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Max Length</div>
                <div class="stat-value">${stats.maxLength}</div>
              </div>
            ` : ''}
            ${stats.avgLength !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Avg Length</div>
                <div class="stat-value">${Math.round(stats.avgLength * 100) / 100}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (stats.minDate !== undefined || stats.maxDate !== undefined) {
      // Date stats section
      html += `
        <div class="stats-detail-section">
          <h4>Date Statistics</h4>
          <div class="stats-grid">
            ${stats.minDate !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Earliest Date</div>
                <div class="stat-value">${stats.minDate}</div>
              </div>
            ` : ''}
            ${stats.maxDate !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Latest Date</div>
                <div class="stat-value">${stats.maxDate}</div>
              </div>
            ` : ''}
            ${stats.rangeDays !== undefined ? `
              <div class="stats-grid-item">
                <div class="stat-label">Date Range</div>
                <div class="stat-value">${stats.rangeDays} days</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // Add top values section
    if (stats.topValues && stats.topValues.length > 0) {
      html += `
        <div class="stats-detail-section">
          <h4>Top Values</h4>
          <table class="top-values-table">
            <thead>
              <tr>
                <th>Value</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${stats.topValues.map(item => `
                <tr>
                  <td>${this.formatExampleValue(item.value, '')}</td>
                  <td>${item.count.toLocaleString()}</td>
                  <td>
                    <div class="mini-progress">
                      <div class="mini-progress-fill" style="width: ${item.percent}%"></div>
                      <span>${item.percent}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    // Add categorical data if available (used for string columns with few unique values)
    if (stats.isLikelyCategorical && stats.categories && stats.categories.length > 0) {
      html += `
        <div class="stats-detail-section">
          <h4>Category Distribution</h4>
          <button id="viz-categories-btn" class="btn-sm">Visualize Categories</button>
          <table class="top-values-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${stats.categories.map(item => `
                <tr>
                  <td>${this.formatExampleValue(item.value, '')}</td>
                  <td>${item.count.toLocaleString()}</td>
                  <td>
                    <div class="mini-progress">
                      <div class="mini-progress-fill" style="width: ${item.percent}%"></div>
                      <span>${item.percent}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    // Add visualization buttons if we have suggestions
    if (this.columnVisualizationSuggestions && this.columnVisualizationSuggestions.length > 0) {
      html += `
        <div class="visualization-actions">
          <h4>Available Visualizations</h4>
          <div class="viz-buttons">
            ${this.columnVisualizationSuggestions.map((viz, index) => `
              <button class="viz-button column-viz-button" data-index="${index}">
                <span class="viz-icon">${this.getVisualizationIcon(viz.type)}</span>
                <span class="viz-title">${viz.title}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Add container for generated visualizations
    html += `
      <div class="auto-visualizations-container">
        <!-- Visualizations will be added here when user clicks buttons -->
      </div>
    `;
    
    this.profilePanelEl.innerHTML = html;
    
    // Save reference to the container
    this.visualizationsContainer = document.querySelector('.auto-visualizations-container');
    
    // Add event listeners for the back button
    document.getElementById('back-to-profile-btn')?.addEventListener('click', () => {
      this.renderTableProfile();
    });

    // Add event handler for "View Column Data" button
    document.getElementById('view-column-data-btn')?.addEventListener('click', () => {
      if (window.queryHandler && this.currentTable && columnName) {
        // Sanitize names for safe querying
        const safeTableName = this.currentTable.replace(/[^a-zA-Z0-9_]/g, '');
        const safeColumnName = columnName.replace(/[^a-zA-Z0-9_]/g, '');

        // Create a query to view the column data
        const query = `SELECT "${safeColumnName}" FROM "${safeTableName}" LIMIT 200;`;

        // Execute the query
        window.queryHandler.setQuery(query, true);

        // Show a toast notification
        this.showToast(`Viewing data for ${columnName} column`);
      }
    });

    // Add event handler for "View Top 100 Records" button
    document.getElementById('view-top-100-records-btn')?.addEventListener('click', () => {
      if (window.queryHandler && this.currentTable) {
        // Sanitize table name for safe querying
        const safeTableName = this.currentTable.replace(/[^a-zA-Z0-9_]/g, '');

        // Create a query to view top 100 records
        const query = `SELECT * FROM "${safeTableName}" LIMIT 100;`;

        // Execute the query
        window.queryHandler.setQuery(query, true);

        // Show a toast notification
        this.showToast(`Viewing top 100 records from ${this.currentTable}`);
      }
    });

    // Add event handlers for column visualization buttons
    const vizButtons = document.querySelectorAll('.column-viz-button');
    vizButtons.forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.dataset.index, 10);
        if (isNaN(index) || !this.columnVisualizationSuggestions || !this.columnVisualizationSuggestions[index]) {
          return;
        }

        const viz = this.columnVisualizationSuggestions[index];

        // Create a direct visualization
        this.createDirectVisualization({
          type: viz.type,
          title: viz.title,
          description: viz.title,
          query: viz.query
        });

        // Also set the query in the query input and switch to the appropriate tab
        if (window.queryHandler && viz.query) {
          window.queryHandler.setQuery(viz.query, true);

          // Switch to the appropriate tab
          const tab = document.querySelector(`.tab-btn[data-tab="${viz.tabName}"]`);
          if (tab) {
            setTimeout(() => tab.click(), 100);
          }
        }

        // Disable the button after clicking to prevent duplicates
        button.disabled = true;
        button.innerHTML = `<span class="viz-icon">✅</span> <span class="viz-title">Applied</span>`;

        // Show toast notification
        this.showToast(`Visualization created: ${viz.title}`);
      });
    });
    
    // If categorical data exists, add visualization button handler
    document.getElementById('viz-categories-btn')?.addEventListener('click', () => {
      const query = `
        SELECT "${columnName}", COUNT(*) as count 
        FROM "${this.currentTable}" 
        GROUP BY "${columnName}" 
        ORDER BY count DESC
      `;
      
      if (window.queryHandler) {
        window.queryHandler.setQuery(query);
        window.queryHandler.executeQuery();
        
        // Switch to bar chart tab
        const barChartTab = document.querySelector('.tab-btn[data-tab="bar"]');
        if (barChartTab) {
          barChartTab.click();
        }
      }
    });
  }
  
  renderHistogram(histogramData) {
    if (!histogramData || !histogramData.buckets || !histogramData.counts) {
      return '';
    }
    
    return `
      <div class="histogram-container">
        <h5>Value Distribution</h5>
        <div class="histogram">
          ${histogramData.buckets.map((bucket, i) => {
            const count = histogramData.counts[i] || 0;
            const maxCount = Math.max(...histogramData.counts);
            const percent = maxCount > 0 ? (count / maxCount) * 100 : 0;
            
            return `
              <div class="histogram-bar-container" title="${bucket}: ${count}">
                <div class="histogram-bar-value">${count}</div>
                <div class="histogram-bar-column">
                  <div class="histogram-bar-fill" style="height: ${percent}%"></div>
                </div>
                <div class="histogram-bar-label">${bucket}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  renderRecommendations() {
    if (!this.recommendations || this.recommendations.length === 0) {
      this.recsPanelEl.innerHTML = '<div class="message">No visualization recommendations available</div>';
      return;
    }
    
    const html = `
      <div class="recommendations-header">
        <h4>Visualization Recommendations</h4>
      </div>
      <div class="recommendations-list">
        ${this.recommendations.map((rec, index) => `
          <div class="recommendation-card">
            <div class="recommendation-title">${rec.title}</div>
            <div class="recommendation-desc">${rec.description}</div>
            <div class="recommendation-meta">
              <span class="recommendation-type">Type: ${rec.type}</span>
              ${rec.priority ? `<span class="recommendation-priority ${rec.priority}">Priority: ${rec.priority}</span>` : ''}
            </div>
            <button class="apply-viz-recommendation" data-index="${index}">Apply</button>
          </div>
        `).join('')}
      </div>
    `;
    
    this.recsPanelEl.innerHTML = html;
  }
  
  applyVisualizationRecommendation(recommendation, executeImmediately = true) {
    if (!recommendation) return;

    try {
      // Sanitize and validate inputs
      if (!this.currentTable) {
        console.error('No current table selected');
        return;
      }

      // Immediately create a D3 visualization based on the recommendation
      this.createDirectVisualization(recommendation);

      // If the recommendation has a query, use it
      if (recommendation.query && window.queryHandler) {
        // Even for predefined queries, do basic validation
        const safeQuery = recommendation.query.trim()
          .replace(/`/g, '"')  // Replace backticks with double quotes
          .replace(/'/g, "''"); // Escape single quotes
          
        window.queryHandler.setQuery(safeQuery, executeImmediately);
      } else {
        // Otherwise, generate a query from the column specifications
        let query;
        
        // Sanitize table name
        const safeTableName = this.currentTable.replace(/[^a-zA-Z0-9_]/g, '');
        
        switch (recommendation.type) {
          case 'bar':
            // Sanitize column names
            const safeXCol = recommendation.xColumn ? recommendation.xColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'id';
            const safeYCol = recommendation.yColumn ? recommendation.yColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'count';
            
            query = `SELECT "${safeXCol}", "${safeYCol}" 
                    FROM "${safeTableName}" 
                    GROUP BY "${safeXCol}" 
                    ORDER BY "${safeYCol}" DESC 
                    LIMIT 20`;
            break;
            
          case 'pie':
            // Sanitize column names
            const safeLabelCol = recommendation.labelColumn ? recommendation.labelColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'name';
            const safeValueCol = recommendation.valueColumn ? recommendation.valueColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'count';
            
            query = `SELECT "${safeLabelCol}", "${safeValueCol}" 
                    FROM "${safeTableName}" 
                    GROUP BY "${safeLabelCol}" 
                    ORDER BY "${safeValueCol}" DESC 
                    LIMIT 10`;
            break;
            
          case 'line':
            // Sanitize column names
            const safeTimeCol = recommendation.xColumn ? recommendation.xColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'date';
            const safeMetricCol = recommendation.yColumn ? recommendation.yColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'value';
            
            query = `SELECT "${safeTimeCol}", "${safeMetricCol}" 
                    FROM "${safeTableName}" 
                    ORDER BY "${safeTimeCol}" 
                    LIMIT 100`;
            break;
            
          case 'histogram':
            // Sanitize column name
            const safeHistCol = recommendation.column ? recommendation.column.replace(/[^a-zA-Z0-9_]/g, '') : 'value';
            
            query = `SELECT "${safeHistCol}" 
                    FROM "${safeTableName}" 
                    WHERE "${safeHistCol}" IS NOT NULL 
                    LIMIT 1000`;
            break;
            
          case 'scatter':
            // Sanitize column names
            const safeX = recommendation.xColumn ? recommendation.xColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'x';
            const safeY = recommendation.yColumn ? recommendation.yColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'y';
            
            query = `SELECT "${safeX}", "${safeY}" 
                    FROM "${safeTableName}" 
                    WHERE "${safeX}" IS NOT NULL AND "${safeY}" IS NOT NULL 
                    LIMIT 500`;
            break;
            
          default:
            query = `SELECT * FROM "${safeTableName}" LIMIT 100`;
        }
        
        if (window.queryHandler) {
          window.queryHandler.setQuery(query, executeImmediately);
        }
      }
    } catch (err) {
      console.error('Error applying visualization recommendation:', err);
    }
    
    // Switch to the appropriate visualization tab
    const tabType = this.mapRecommendationTypeToTab(recommendation.type);
    const tabSelector = `.tab-btn[data-tab="${tabType}"]`;
    
    if (tabType && executeImmediately) {
      const tabButton = document.querySelector(tabSelector);
      if (tabButton) {
        tabButton.click();
      }
    }
  }
  
  mapRecommendationTypeToTab(recType) {
    switch (recType) {
      case 'bar': return 'bar';
      case 'pie': return 'pie';
      case 'line': return 'line';
      case 'histogram': return 'histogram';
      case 'scatter': return 'scatter';
      default: return 'table';
    }
  }

  // Helper to get an appropriate icon for each visualization type
  getVisualizationIcon(vizType) {
    switch (vizType) {
      case 'bar': return '📊'; // Bar chart
      case 'pie': return '🍩'; // Pie/Donut chart
      case 'line': return '📈'; // Line chart
      case 'histogram': return '📉'; // Histogram
      case 'scatter': return '⚡'; // Scatter plot
      case 'table': return '📋'; // Table view
      default: return '📊';
    }
  }
  
  // Method to create direct D3.js visualizations without query execution
  async createDirectVisualization(recommendation) {
    if (!recommendation || !this.visualizationsContainer) return;

    try {
      // Create a unique key for this visualization to prevent duplicates
      const vizKey = `${recommendation.type}-${recommendation.title}-${recommendation.query || ''}`;

      // Check if this visualization already exists
      if (this.createdVisualizations.has(vizKey)) {
        console.log(`Visualization already exists: ${recommendation.title}`);
        this.showToast(`Visualization already exists: ${recommendation.title}`);
        return;
      }

      // Add to tracking set
      this.createdVisualizations.add(vizKey);

      // Create a container for this visualization
      const vizContainer = document.createElement('div');
      vizContainer.className = 'd3-visualization';
      vizContainer.dataset.vizKey = vizKey; // Store the key for reference
      vizContainer.style.width = '45%';
      vizContainer.style.minWidth = '400px';
      vizContainer.style.height = '300px';
      vizContainer.style.margin = '10px 0';
      vizContainer.style.padding = '15px';
      vizContainer.style.border = '1px solid #dee2e6';
      vizContainer.style.borderRadius = '4px';
      vizContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
      vizContainer.style.position = 'relative'; // Add relative positioning for the close button

      // Add a close button to the visualization
      const closeButton = document.createElement('button');
      closeButton.className = 'viz-close-btn';
      closeButton.textContent = '×';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '5px';
      closeButton.style.right = '5px';
      closeButton.style.border = 'none';
      closeButton.style.background = 'transparent';
      closeButton.style.fontSize = '20px';
      closeButton.style.fontWeight = 'bold';
      closeButton.style.cursor = 'pointer';
      closeButton.style.color = '#666';
      closeButton.title = 'Remove visualization';

      // Add event listener for close button
      closeButton.addEventListener('click', () => {
        // Remove from tracking set
        const key = vizContainer.dataset.vizKey;
        if (key) {
          this.createdVisualizations.delete(key);
        }

        // Remove from DOM
        this.visualizationsContainer.removeChild(vizContainer);

        // Show toast
        this.showToast('Visualization removed');
      });

      vizContainer.appendChild(closeButton);

      // Add a title
      const title = document.createElement('h4');
      title.textContent = recommendation.title || 'Visualization';
      title.style.marginTop = '0';
      title.style.marginBottom = '15px';
      title.style.textAlign = 'center';
      title.style.paddingRight = '20px'; // Add padding to avoid overlap with close button
      vizContainer.appendChild(title);

      // Create the SVG container
      const svg = document.createElement('div');
      svg.className = 'd3-chart-container';
      svg.style.width = '100%';
      svg.style.height = '250px';
      vizContainer.appendChild(svg);

      // Add to the main container
      this.visualizationsContainer.appendChild(vizContainer);
      
      // Fetch the data for this visualization
      let query;
      const safeTableName = this.currentTable.replace(/[^a-zA-Z0-9_]/g, '');
      
      switch (recommendation.type) {
        case 'bar':
          // Sanitize column names
          const safeXCol = recommendation.xColumn ? recommendation.xColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'id';
          const safeYCol = recommendation.yColumn ? recommendation.yColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'count';
          
          query = `SELECT "${safeXCol}", "${safeYCol}" 
                  FROM "${safeTableName}" 
                  GROUP BY "${safeXCol}" 
                  ORDER BY "${safeYCol}" DESC 
                  LIMIT 20`;
          
          // Fetch data
          await this.fetchDataAndRenderBarChart(query, svg, { 
            xColumn: safeXCol, 
            yColumn: safeYCol,
            title: recommendation.title
          });
          break;
          
        case 'pie':
          // Sanitize column names
          const safeLabelCol = recommendation.labelColumn ? recommendation.labelColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'name';
          const safeValueCol = recommendation.valueColumn ? recommendation.valueColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'count';
          
          query = `SELECT "${safeLabelCol}", "${safeValueCol}" 
                  FROM "${safeTableName}" 
                  GROUP BY "${safeLabelCol}" 
                  ORDER BY "${safeValueCol}" DESC 
                  LIMIT 10`;
          
          // Fetch data
          await this.fetchDataAndRenderPieChart(query, svg, {
            labelColumn: safeLabelCol,
            valueColumn: safeValueCol,
            title: recommendation.title
          });
          break;
          
        case 'histogram':
          // Sanitize column name
          const safeHistCol = recommendation.column ? recommendation.column.replace(/[^a-zA-Z0-9_]/g, '') : 'value';
          
          query = `SELECT "${safeHistCol}" 
                  FROM "${safeTableName}" 
                  WHERE "${safeHistCol}" IS NOT NULL 
                  LIMIT 1000`;
          
          // Fetch data
          await this.fetchDataAndRenderHistogram(query, svg, {
            column: safeHistCol,
            title: recommendation.title
          });
          break;
          
        case 'scatter':
          // Sanitize column names
          const safeX = recommendation.xColumn ? recommendation.xColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'x';
          const safeY = recommendation.yColumn ? recommendation.yColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'y';
          
          query = `SELECT "${safeX}", "${safeY}" 
                  FROM "${safeTableName}" 
                  WHERE "${safeX}" IS NOT NULL AND "${safeY}" IS NOT NULL 
                  LIMIT 500`;
          
          // Fetch data
          await this.fetchDataAndRenderScatterPlot(query, svg, {
            xColumn: safeX,
            yColumn: safeY,
            title: recommendation.title
          });
          break;
          
        case 'line':
          // Sanitize column names
          const safeTimeCol = recommendation.xColumn ? recommendation.xColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'date';
          const safeMetricCol = recommendation.yColumn ? recommendation.yColumn.replace(/[^a-zA-Z0-9_]/g, '') : 'value';
          
          query = `SELECT "${safeTimeCol}", "${safeMetricCol}" 
                  FROM "${safeTableName}" 
                  ORDER BY "${safeTimeCol}" 
                  LIMIT 100`;
          
          // Fetch data
          await this.fetchDataAndRenderLineChart(query, svg, {
            xColumn: safeTimeCol,
            yColumn: safeMetricCol,
            title: recommendation.title
          });
          break;
          
        default:
          // For unknown types, show a message
          svg.innerHTML = '<div style="text-align:center;padding:20px;">Unknown visualization type</div>';
      }
    } catch (err) {
      console.error('Error creating direct visualization:', err);
    }
  }
  
  // Helper methods for direct D3 visualization
  async fetchDataAndRenderBarChart(query, container, options) {
    try {
      // Fetch data via API
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">No data available</div>';
        return;
      }
      
      // Prepare container for D3
      container.innerHTML = '';
      
      // Get column names
      const xColumn = options.xColumn || Object.keys(data[0])[0];
      const yColumn = options.yColumn || Object.keys(data[0])[1];
      
      // Setup dimensions
      const width = container.clientWidth;
      const height = container.clientHeight;
      const margin = { top: 20, right: 30, bottom: 60, left: 60 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      // Create SVG
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // X scale
      const x = d3.scaleBand()
        .domain(data.map(d => d[xColumn]))
        .range([0, chartWidth])
        .padding(0.1);
      
      // Y scale
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => +d[yColumn]) * 1.1])
        .nice()
        .range([chartHeight, 0]);
      
      // Create tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'chart-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000);

      // Add gradient
      const gradient = svg.select('svg').append('defs')
        .append('linearGradient')
        .attr('id', 'direct-bar-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', chartHeight + margin.top)
        .attr('x2', 0).attr('y2', margin.top);
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#5c6b8a');
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#a2b8d2');

      // Add bars with hover effects
      svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d[xColumn]))
        .attr('y', d => y(+d[yColumn]))
        .attr('width', x.bandwidth())
        .attr('height', d => chartHeight - y(+d[yColumn]))
        .attr('fill', 'url(#direct-bar-gradient)')
        .attr('stroke', '#5c6b8a')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('fill', '#f07838');
          tooltip.style('opacity', 1)
            .html(`<strong>${d[xColumn]}</strong><br/>${yColumn}: ${(+d[yColumn]).toLocaleString()}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', function(event) {
          tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill', 'url(#direct-bar-gradient)');
          tooltip.style('opacity', 0);
        });
      
      // Handle text labels vs numeric labels differently
      const isNumericX = data.every(row => !isNaN(+row[xColumn]));
      
      const xAxis = svg.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x));
      
      if (!isNumericX) {
        // For text labels, hide them to avoid overlap
        xAxis.selectAll('text').remove();
      } else {
        // For numeric labels, show them and rotate if needed
        xAxis.selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .style('font-size', '11px')
          .style('fill', '#5c6b8a');
      }
      
      // Add Y axis with modern styling
      svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#5c6b8a');
      
      // Add labels with modern styling
      svg.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text(xColumn);
      
      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -margin.left + 15)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text(yColumn);
    } catch (err) {
      console.error('Error rendering bar chart:', err);
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#d9534f;">Error: ${err.message}</div>`;
    }
  }
  
  async fetchDataAndRenderPieChart(query, container, options) {
    try {
      // Fetch data via API
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">No data available</div>';
        return;
      }
      
      // Prepare container for D3
      container.innerHTML = '';
      
      // Get column names
      const labelColumn = options.labelColumn || Object.keys(data[0])[0];
      const valueColumn = options.valueColumn || Object.keys(data[0])[1];
      
      // Setup dimensions
      const width = container.clientWidth;
      const height = container.clientHeight;
      const radius = Math.min(width, height) / 2 - 40;
      
      // Create SVG
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);
      
      // Color scale
      const color = d3.scaleOrdinal(d3.schemeCategory10);
      
      // Pie generator
      const pie = d3.pie()
        .value(d => +d[valueColumn])
        .sort(null);
      
      // Arc generator
      const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);
      
      // Create pie chart
      svg.selectAll('path')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => color(i))
        .attr('stroke', 'white')
        .style('stroke-width', '2px');
      
      // Add labels
      const outerArc = d3.arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);
      
      svg.selectAll('text')
        .data(pie(data))
        .enter()
        .append('text')
        .attr('transform', d => {
          const pos = outerArc.centroid(d);
          const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          pos[0] = radius * 0.95 * (midAngle < Math.PI ? 1 : -1);
          return `translate(${pos})`;
        })
        .style('text-anchor', d => {
          const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          return midAngle < Math.PI ? 'start' : 'end';
        })
        .text(d => {
          const value = d.data[labelColumn];
          return value ? value.toString().substring(0, 15) : '';
        })
        .style('font-size', '10px');
    } catch (err) {
      console.error('Error rendering pie chart:', err);
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#d9534f;">Error: ${err.message}</div>`;
    }
  }
  
  async fetchDataAndRenderHistogram(query, container, options) {
    try {
      // Fetch data via API
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">No data available</div>';
        return;
      }
      
      // Prepare container for D3
      container.innerHTML = '';
      
      // Get column name
      const column = options.column || Object.keys(data[0])[0];
      
      // Extract numeric values
      const values = data
        .map(d => +d[column])
        .filter(v => !isNaN(v));
      
      if (values.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">No numeric data available</div>';
        return;
      }
      
      // Setup dimensions
      const width = container.clientWidth;
      const height = container.clientHeight;
      const margin = { top: 20, right: 30, bottom: 40, left: 40 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      // Create histogram bins
      const x = d3.scaleLinear()
        .domain([d3.min(values), d3.max(values)])
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
      
      // Add X axis
      svg.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x));
      
      // Add Y axis
      svg.append('g')
        .call(d3.axisLeft(y));
      
      // Add X axis label
      svg.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 5)
        .style('text-anchor', 'middle')
        .text(column);
    } catch (err) {
      console.error('Error rendering histogram:', err);
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#d9534f;">Error: ${err.message}</div>`;
    }
  }
  
  async fetchDataAndRenderScatterPlot(query, container, options) {
    try {
      // Fetch data via API
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">No data available</div>';
        return;
      }
      
      // Prepare container for D3
      container.innerHTML = '';
      
      // Get column names
      const xColumn = options.xColumn || Object.keys(data[0])[0];
      const yColumn = options.yColumn || Object.keys(data[0])[1];
      
      // Setup dimensions
      const width = container.clientWidth;
      const height = container.clientHeight;
      const margin = { top: 20, right: 30, bottom: 40, left: 40 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      // Create scales
      const x = d3.scaleLinear()
        .domain([d3.min(data, d => +d[xColumn]) * 0.9, d3.max(data, d => +d[xColumn]) * 1.1])
        .nice()
        .range([0, chartWidth]);
      
      const y = d3.scaleLinear()
        .domain([d3.min(data, d => +d[yColumn]) * 0.9, d3.max(data, d => +d[yColumn]) * 1.1])
        .nice()
        .range([chartHeight, 0]);
      
      // Create SVG
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Add dots
      svg.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => x(+d[xColumn]))
        .attr('cy', d => y(+d[yColumn]))
        .attr('r', 5)
        .attr('fill', '#5D8AA8')
        .attr('opacity', 0.7)
        .attr('stroke', 'white');
      
      // Add X axis
      svg.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x));
      
      // Add Y axis
      svg.append('g')
        .call(d3.axisLeft(y));
      
      // Add labels
      svg.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 5)
        .style('text-anchor', 'middle')
        .text(xColumn);
      
      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -margin.left + 10)
        .style('text-anchor', 'middle')
        .text(yColumn);
    } catch (err) {
      console.error('Error rendering scatter plot:', err);
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#d9534f;">Error: ${err.message}</div>`;
    }
  }
  
  async fetchDataAndRenderLineChart(query, container, options) {
    try {
      // Fetch data via API
      const baseUrl = window.location.origin || 'http://localhost';
      const response = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;">No data available</div>';
        return;
      }
      
      // Prepare container for D3
      container.innerHTML = '';
      
      // Get column names
      const xColumn = options.xColumn || Object.keys(data[0])[0];
      const yColumn = options.yColumn || Object.keys(data[0])[1];
      
      // Setup dimensions
      const width = container.clientWidth;
      const height = container.clientHeight;
      const margin = { top: 20, right: 30, bottom: 40, left: 40 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      // Sort data if possible
      try {
        data.sort((a, b) => {
          const aVal = a[xColumn];
          const bVal = b[xColumn];
          
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        });
      } catch (e) {
        console.warn('Could not sort line chart data');
      }
      
      // Create scales
      let x;
      // Check if date
      const isDate = data.some(d => !isNaN(Date.parse(d[xColumn])));
      
      if (isDate) {
        x = d3.scaleTime()
          .domain(d3.extent(data, d => new Date(d[xColumn])))
          .range([0, chartWidth]);
      } else if (isNaN(+data[0][xColumn])) {
        // Categorical data
        x = d3.scaleBand()
          .domain(data.map(d => d[xColumn]))
          .range([0, chartWidth])
          .padding(0.1);
      } else {
        // Numeric data
        x = d3.scaleLinear()
          .domain(d3.extent(data, d => +d[xColumn]))
          .nice()
          .range([0, chartWidth]);
      }
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => +d[yColumn]) * 1.1])
        .nice()
        .range([chartHeight, 0]);
      
      // Create SVG
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Define line
      const line = d3.line()
        .x(d => {
          if (isDate) return x(new Date(d[xColumn]));
          if (isNaN(+d[xColumn])) return x(d[xColumn]) + x.bandwidth() / 2;
          return x(+d[xColumn]);
        })
        .y(d => y(+d[yColumn]));
      
      // Add line
      svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#4285F4')
        .attr('stroke-width', 2)
        .attr('d', line);
      
      // Add points
      svg.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => {
          if (isDate) return x(new Date(d[xColumn]));
          if (isNaN(+d[xColumn])) return x(d[xColumn]) + x.bandwidth() / 2;
          return x(+d[xColumn]);
        })
        .attr('cy', d => y(+d[yColumn]))
        .attr('r', 4)
        .attr('fill', '#4285F4');
      
      // Add X axis
      if (isDate) {
        svg.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%Y-%m-%d")));
      } else if (isNaN(+data[0][xColumn])) {
        svg.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(x))
          .selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end');
      } else {
        svg.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(x));
      }
      
      // Add Y axis
      svg.append('g')
        .call(d3.axisLeft(y));
      
      // Add labels
      svg.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 5)
        .style('text-anchor', 'middle')
        .text(xColumn);
      
      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -margin.left + 10)
        .style('text-anchor', 'middle')
        .text(yColumn);
    } catch (err) {
      console.error('Error rendering line chart:', err);
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#d9534f;">Error: ${err.message}</div>`;
    }
  }
  
  // Method to handle column-specific visualizations
  createColumnVisualizations(columnName, stats) {
    if (!this.visualizationsContainer) return;
    
    // Create a visualization based on data type
    if (stats.min !== undefined && stats.max !== undefined) {
      // For numeric data, create a histogram
      const histContainer = document.createElement('div');
      histContainer.className = 'd3-visualization';
      histContainer.style.width = '100%';
      histContainer.style.height = '300px';
      histContainer.style.margin = '20px 0';
      histContainer.style.padding = '15px';
      histContainer.style.border = '1px solid #dee2e6';
      histContainer.style.borderRadius = '4px';
      
      const title = document.createElement('h4');
      title.textContent = `Distribution of ${columnName}`;
      title.style.textAlign = 'center';
      title.style.marginTop = '0';
      histContainer.appendChild(title);
      
      const svg = document.createElement('div');
      svg.className = 'd3-chart-container';
      svg.style.height = '250px';
      histContainer.appendChild(svg);
      
      this.visualizationsContainer.appendChild(histContainer);
      
      // Use stats.histogram data if available
      if (stats.histogram && stats.histogram.buckets && stats.histogram.counts) {
        this.renderHistogramFromStats(stats.histogram, svg, columnName);
      } else {
        // Fetch data and render histogram
        const query = `SELECT "${columnName}" FROM "${this.currentTable}" WHERE "${columnName}" IS NOT NULL LIMIT 1000`;
        this.fetchDataAndRenderHistogram(query, svg, { column: columnName });
      }
    } else if (stats.isLikelyCategorical && stats.categories) {
      // For categorical data, create a bar chart
      const barContainer = document.createElement('div');
      barContainer.className = 'd3-visualization';
      barContainer.style.width = '100%';
      barContainer.style.height = '300px';
      barContainer.style.margin = '20px 0';
      barContainer.style.padding = '15px';
      barContainer.style.border = '1px solid #dee2e6';
      barContainer.style.borderRadius = '4px';
      
      const title = document.createElement('h4');
      title.textContent = `Categories in ${columnName}`;
      title.style.textAlign = 'center';
      title.style.marginTop = '0';
      barContainer.appendChild(title);
      
      const svg = document.createElement('div');
      svg.className = 'd3-chart-container';
      svg.style.height = '250px';
      barContainer.appendChild(svg);
      
      this.visualizationsContainer.appendChild(barContainer);
      
      // Render directly from category data
      this.renderCategoriesChart(stats.categories, svg, columnName);
    }
  }
  
  renderHistogramFromStats(histogramData, container, columnName) {
    if (!histogramData || !histogramData.buckets || !histogramData.counts) {
      container.innerHTML = '<div style="text-align:center;padding:20px;">No histogram data available</div>';
      return;
    }
    
    try {
      // Prepare container for D3
      container.innerHTML = '';
      
      // Setup dimensions with more space for labels
      const width = container.clientWidth;
      const height = container.clientHeight;
      const margin = { top: 20, right: 30, bottom: 80, left: 50 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      // Prepare data
      const data = histogramData.buckets.map((bucket, i) => ({
        bucket: bucket,
        count: histogramData.counts[i] || 0
      }));

      // Create tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'chart-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000);
      
      // Create scales
      const x = d3.scaleBand()
        .domain(data.map(d => d.bucket))
        .range([0, chartWidth])
        .padding(0.15);
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) * 1.1])
        .nice()
        .range([chartHeight, 0]);

      // Add gradient
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'column-histogram-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', chartHeight + margin.top)
        .attr('x2', 0).attr('y2', margin.top);
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#5c6b8a');
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#a2b8d2');

      const chart = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Add bars with hover effects
      chart.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.bucket))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.count))
        .attr('height', d => chartHeight - y(d.count))
        .attr('fill', 'url(#column-histogram-gradient)')
        .attr('stroke', '#5c6b8a')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('fill', '#f07838');
          tooltip.style('opacity', 1)
            .html(`<strong>Range:</strong> ${d.bucket}<br/><strong>Count:</strong> ${d.count.toLocaleString()}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', function(event) {
          tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill', 'url(#column-histogram-gradient)');
          tooltip.style('opacity', 0);
        });
      
      // Hide X axis labels to avoid clutter
      chart.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .remove();
      
      // Add Y axis with modern styling
      chart.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#5c6b8a');
      
      // Add labels with modern styling
      chart.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text(columnName);
      
      chart.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -margin.left + 15)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text('Count');

      // Cleanup function
      container.addEventListener('DOMNodeRemoved', function() {
        if (tooltip) tooltip.remove();
      });
    } catch (err) {
      console.error('Error rendering histogram from stats:', err);
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#d9534f;">Error: ${err.message}</div>`;
    }
  }
  
  renderCategoriesChart(categories, container, columnName) {
    if (!categories || categories.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;">No category data available</div>';
      return;
    }
    
    try {
      // Prepare container for D3
      container.innerHTML = '';
      
      // Setup dimensions with more space for labels
      const width = container.clientWidth;
      const height = container.clientHeight;
      const margin = { top: 20, right: 30, bottom: 100, left: 60 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      // Limit to top 12 categories for better readability
      const data = categories.slice(0, 12);

      // Create tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'chart-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000);
      
      // Create scales
      const x = d3.scaleBand()
        .domain(data.map(d => d.value))
        .range([0, chartWidth])
        .padding(0.15);
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) * 1.1])
        .nice()
        .range([chartHeight, 0]);
      
      // Create SVG with gradient
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'column-categories-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', chartHeight + margin.top)
        .attr('x2', 0).attr('y2', margin.top);
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#5c6b8a');
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#a2b8d2');

      const chart = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Add bars with hover effects
      chart.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.value))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.count))
        .attr('height', d => chartHeight - y(d.count))
        .attr('fill', 'url(#column-categories-gradient)')
        .attr('stroke', '#5c6b8a')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('fill', '#f07838');
          const percent = d.percent ? d.percent + '%' : '';
          tooltip.style('opacity', 1)
            .html(`<strong>${d.value}</strong><br/><strong>Count:</strong> ${d.count.toLocaleString()}${percent ? '<br/><strong>Percentage:</strong> ' + percent : ''}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', function(event) {
          tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill', 'url(#column-categories-gradient)');
          tooltip.style('opacity', 0);
        });
      
      // Handle text labels vs numeric labels differently
      const isNumeric = data.every(d => !isNaN(+d.value));
      
      const xAxis = chart.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x));
      
      if (!isNumeric) {
        // For text labels, hide them to avoid overlap
        xAxis.selectAll('text').remove();
      } else {
        // For numeric labels, show them and rotate if needed
        xAxis.selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .style('font-size', '10px')
          .style('fill', '#5c6b8a');
      }
      
      // Add Y axis with modern styling
      chart.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#5c6b8a');
      
      // Add labels with modern styling
      chart.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text(columnName);
      
      chart.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -margin.left + 15)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text('Count');

      // Cleanup function
      container.addEventListener('DOMNodeRemoved', function() {
        if (tooltip) tooltip.remove();
      });
    } catch (err) {
      console.error('Error rendering categories chart:', err);
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#d9534f;">Error: ${err.message}</div>`;
    }
  }
}

// Initialize the data explorer when the DOM is loaded
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

  window.dataExplorer = new DataExplorer();

  // Dispatch a custom event when schema is loaded
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    // Get URL from args
    let url = args[0];

    try {
      // If URL is relative and we're in an extension context, make it absolute
      if (typeof url === 'string' && url.startsWith('/') && window.location.origin) {
        // Make a fully qualified URL using the current origin
        url = `${window.location.origin}${url}`;
        args[0] = url;
      }

      const promise = originalFetch.apply(this, args);

      // Check if this is a schema fetch (handle both relative and absolute URLs)
      if (typeof args[0] === 'string' &&
          (args[0] === '/api/schema' || args[0].endsWith('/api/schema'))) {
        promise.then(response => {
          if (response && response.ok) {
            response.clone().json().then(schema => {
              document.dispatchEvent(new CustomEvent('schemaLoaded', { detail: { schema } }));
            }).catch(err => {
              console.warn('Error parsing schema JSON:', err);
            });
          }
        }).catch(err => {
          console.warn('Error fetching schema:', err);
        });
      }

      return promise;
    } catch (err) {
      console.warn('Error in fetch override:', err);
      // Fall back to original fetch if our override fails
      return originalFetch.apply(this, args);
    }
  };
});