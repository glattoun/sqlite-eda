// src/db-connector.js - With direct database access
const Database = require('better-sqlite3');
let db = null;

function initialize(config) {
  if (!config) {
    throw new Error('Database configuration is required');
  }
  
  if (config.type === 'sqlite') {
    if (!config.path) {
      throw new Error('Database path is required for SQLite');
    }
    
    try {
      // Options to improve compatibility
      const options = {
        readonly: false,
        fileMustExist: true,
        verbose: console.log // Enable logging for debugging
      };
      
      db = new Database(config.path, options);
      console.log(`Connected to SQLite database: ${config.path}`);
    } catch (err) {
      console.error(`Error connecting to SQLite database: ${err.message}`);
      throw err;
    }
  } else {
    throw new Error(`Database type ${config.type} not implemented yet`);
  }
}

function executeQuery(query, params = []) {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  if (!query) {
    throw new Error('Query is required');
  }
  
  try {
    // Determine if it's a SELECT query
    const isSelect = query.trim().toLowerCase().startsWith('select');
    
    if (isSelect) {
      const stmt = db.prepare(query);
      return stmt.all(params);
    } else {
      const stmt = db.prepare(query);
      return stmt.run(params);
    }
  } catch (err) {
    console.error(`Error executing query: ${err.message}`);
    throw err;
  }
}

// Add this function to get direct access to the database object
function getDatabase() {
  return db;
}

// Helper method to check if the database is initialized
function isInitialized() {
  return db !== null;
}

// Helper to close database connection when needed
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initialize,
  executeQuery,
  isInitialized,
  close,
  getDatabase // Export the new function
};