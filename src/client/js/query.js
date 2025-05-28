
class QueryHandler {
    constructor() {
      this.history = [];
      this.historyIndex = -1;

      // Get the current origin for socket connection
      const origin = window.location.origin || 'http://localhost';
      this.socket = io(origin);

      // UI elements
      this.queryInput = document.getElementById('query-input');
      this.runButton = document.getElementById('run-query-btn');
      this.statusEl = document.getElementById('query-status');

      // Initialize with event listeners
      this.initEventListeners();
    }

    initEventListeners() {
      // Run query on button click
      if (this.runButton) {
        this.runButton.addEventListener('click', () => {
          this.executeQuery();
        });
      }

      // Run query on Ctrl+Enter
      if (this.queryInput) {
        this.queryInput.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            this.executeQuery();
          }

          // Query history navigation with up/down arrows
          if (e.ctrlKey && e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateHistory(-1);
          }

          if (e.ctrlKey && e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateHistory(1);
          }
        });
      }

      // Handle query results from socket
      this.socket.on('query-results', (results) => {
        // Results are handled by visualization components
        console.log('Query executed successfully');

        // Update status indicator
        if (this.statusEl) {
          if (results && results.length) {
            this.statusEl.textContent = `Success: ${results.length} rows returned`;
          } else {
            this.statusEl.textContent = `Query executed successfully`;
          }
          this.statusEl.className = 'status success';

          // Auto-hide after 5 seconds
          setTimeout(() => {
            this.statusEl.textContent = '';
            this.statusEl.className = 'status';
          }, 5000);
        }
      });

      // Handle query errors from socket
      this.socket.on('query-error', (data) => {
        console.error('Query error:', data.error);

        // Update status indicator
        if (this.statusEl) {
          this.statusEl.textContent = `Error: ${data.error}`;
          this.statusEl.className = 'status error';
        }
      });
    }

    executeQuery() {
      if (!this.queryInput) return;

      const query = this.queryInput.value.trim();
      if (!query) return;

      // Add to history if not the same as the last query
      if (this.history.length === 0 || this.history[this.history.length - 1] !== query) {
        this.history.push(query);

        // Limit history size to 50 items
        if (this.history.length > 50) {
          this.history.shift();
        }

        this.historyIndex = this.history.length;
      }

      // Show loading state
      if (this.statusEl) {
        this.statusEl.textContent = 'Executing query...';
        this.statusEl.className = 'status loading';
      }

      // Send query to server
      this.socket.emit('run-query', { query });
    }

    navigateHistory(direction) {
      if (this.history.length === 0 || !this.queryInput) return;

      // Calculate new index
      const newIndex = this.historyIndex + direction;

      // Check bounds
      if (newIndex < 0 || newIndex > this.history.length) return;

      this.historyIndex = newIndex;

      // Set input value from history or clear if at the end
      if (this.historyIndex === this.history.length) {
        this.queryInput.value = '';
      } else {
        this.queryInput.value = this.history[this.historyIndex];
      }
    }

    /**
     * Set a query in the input area and optionally execute it
     * @param {string} query - The SQL query to set
     * @param {boolean} execute - Whether to execute the query immediately (default: false)
     */
    setQuery(query, execute = false) {
      if (!this.queryInput || !query) return;

      this.queryInput.value = query;
      this.queryInput.focus();

      if (execute) {
        // Use the main executeQuery function if available, otherwise use our own
        if (window.executeQuery && typeof window.executeQuery === 'function') {
          window.executeQuery(query);
        } else {
          this.executeQuery();
        }
      }
    }

    /**
     * Generate a basic SELECT query for a table
     * @param {string} tableName - The name of the table
     * @param {Array<string>} columns - The column names to include
     * @param {number} limit - The maximum number of rows to return (default: 100)
     * @returns {string} The generated SQL query
     */
    generateSelectQuery(tableName, columns, limit = 100) {
      if (!tableName) return '';

      const columnsStr = Array.isArray(columns) && columns.length > 0
        ? columns.join(', ')
        : '*';

      return `SELECT ${columnsStr} FROM ${tableName} LIMIT ${limit};`;
    }

    /**
     * Generate a GROUP BY query for statistics
     * @param {string} tableName - The name of the table
     * @param {string} groupByColumn - The column to group by
     * @param {string} aggregateColumn - The column to aggregate (optional)
     * @param {string} aggregateFunc - The aggregate function to use (default: 'COUNT')
     * @returns {string} The generated SQL query
     */
    generateGroupByQuery(tableName, groupByColumn, aggregateColumn = null, aggregateFunc = 'COUNT') {
      if (!tableName || !groupByColumn) return '';

      const aggregate = aggregateColumn
        ? `${aggregateFunc}(${aggregateColumn}) as value`
        : `${aggregateFunc}(*) as count`;

      return `SELECT ${groupByColumn}, ${aggregate} FROM ${tableName} GROUP BY ${groupByColumn} ORDER BY 2 DESC LIMIT 100;`;
    }

    /**
     * Generate a summary statistics query for a numeric column
     * @param {string} tableName - The name of the table
     * @param {string} column - The numeric column to analyze
     * @returns {string} The generated SQL query
     */
    generateSummaryStatsQuery(tableName, column) {
      if (!tableName || !column) return '';

      return `
        SELECT
          COUNT(${column}) as count,
          MIN(${column}) as min,
          MAX(${column}) as max,
          AVG(${column}) as mean
        FROM ${tableName}
        WHERE ${column} IS NOT NULL;
      `;
    }
  }

  // Initialize the query handler when the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    window.queryHandler = new QueryHandler();
  });