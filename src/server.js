// src/server.js - Fixed version
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const dbConnector = require('./db-connector');
const schemaAnalyzer = require('./schema-analyzer');
const dataProfiler = require('./data-profiler');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'client')));
app.use(express.json());

// API Routes
app.get('/api/schema', async (req, res) => {
  try {
    const schema = await schemaAnalyzer.getSchema();
    res.json(schema);
  } catch (err) {
    console.error('Error getting schema:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/query', async (req, res) => {
  try {
    const { query, params } = req.body;
    const results = await dbConnector.executeQuery(query, params || []);
    res.json(results);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).json({ error: err.message });
  }
});

// New data profiling routes
app.get('/api/profile/:tableName', async (req, res) => {
  try {
    // Sanitize table name to prevent SQL injection
    let { tableName } = req.params;

    // Remove any non-alphanumeric characters except underscores
    tableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    if (!tableName || tableName.length === 0) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Verify table exists first
    const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    const tables = await dbConnector.executeQuery(tablesQuery);

    // Normalize result to array
    const tableList = Array.isArray(tables) ?
      tables.map(t => t.name) :
      Object.values(tables).map(t => t.name);

    if (!tableList.includes(tableName)) {
      return res.status(404).json({ error: `Table '${tableName}' not found` });
    }

    const profile = await dataProfiler.generateTableProfile(tableName);
    res.json(profile);
  } catch (err) {
    console.error(`Error profiling table ${req.params.tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/visualizations/:tableName', async (req, res) => {
  try {
    // Sanitize table name to prevent SQL injection
    let { tableName } = req.params;

    // Remove any non-alphanumeric characters except underscores
    tableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    if (!tableName || tableName.length === 0) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Verify table exists first
    const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    const tables = await dbConnector.executeQuery(tablesQuery);

    // Normalize result to array
    const tableList = Array.isArray(tables) ?
      tables.map(t => t.name) :
      Object.values(tables).map(t => t.name);

    if (!tableList.includes(tableName)) {
      return res.status(404).json({ error: `Table '${tableName}' not found` });
    }

    const profile = await dataProfiler.generateTableProfile(tableName);
    const suggestions = dataProfiler.suggestVisualizations(profile);
    res.json(suggestions);
  } catch (err) {
    console.error(`Error suggesting visualizations for ${req.params.tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/:tableName/:columnName', async (req, res) => {
  try {
    // Sanitize parameters to prevent SQL injection
    let { tableName, columnName } = req.params;

    // Remove any non-alphanumeric characters except underscores
    tableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    columnName = columnName.replace(/[^a-zA-Z0-9_]/g, '');

    if (!tableName || tableName.length === 0) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    if (!columnName || columnName.length === 0) {
      return res.status(400).json({ error: 'Invalid column name' });
    }

    // Verify table exists first
    const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    const tables = await dbConnector.executeQuery(tablesQuery);

    // Normalize result to array
    const tableList = Array.isArray(tables) ?
      tables.map(t => t.name) :
      Object.values(tables).map(t => t.name);

    if (!tableList.includes(tableName)) {
      return res.status(404).json({ error: `Table '${tableName}' not found` });
    }

    // Verify column exists
    const columnQuery = `PRAGMA table_info('${tableName}')`;
    const columns = await dbConnector.executeQuery(columnQuery);

    // Normalize result to array
    const columnArray = Array.isArray(columns) ?
      columns :
      Object.values(columns);

    const columnExists = columnArray.some(col => col.name === columnName);

    if (!columnExists) {
      return res.status(404).json({ error: `Column '${columnName}' not found in table '${tableName}'` });
    }

    const stats = await dataProfiler.generateColumnStatistics(tableName, columnName);
    res.json(stats);
  } catch (err) {
    console.error(`Error generating statistics for ${req.params.tableName}.${req.params.columnName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Real-time updates via Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('run-query', async (data) => {
    try {
      const results = await dbConnector.executeQuery(data.query, data.params || []);
      socket.emit('query-results', results);
    } catch (err) {
      console.error('Socket query error:', err);
      socket.emit('query-error', { error: err.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start the server
function start(port, dbConfig) {
  // Initialize database connection
  try {
    dbConnector.initialize(dbConfig);
    console.log(`Connected to ${dbConfig.type} database: ${dbConfig.path || dbConfig.database}`);
    
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

module.exports = { start };