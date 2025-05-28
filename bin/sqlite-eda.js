const { program } = require('commander');
const portfinder = require('portfinder');
const path = require('path');
const server = require('../src/server');

program
  .name('sqlite-eda')
  .description('SQLite Exploratory Data Analysis tool')
  .version('0.1.0')
  .option('-d, --database <path>', 'Path to SQLite database file')
  .option('-p, --port <number>', 'Port to run the server on (default: find available)')
  .option('-t, --type <type>', 'Database type (sqlite, mysql, postgres)', 'sqlite')
  .option('--db-host <host>', 'Database host (for non-SQLite)', 'localhost')
  .option('--db-user <user>', 'Database username (for non-SQLite)')
  .option('--db-pass <password>', 'Database password (for non-SQLite)')
  .option('--db-name <name>', 'Database name (for non-SQLite)')
  .parse(process.argv);

const options = program.opts();

if (!options.database && options.type === 'sqlite') {
  console.error('Error: Database file path is required for SQLite');
  program.help();
}

// Find an available port
portfinder.basePort = options.port || 3333;
portfinder.getPort((err, port) => {
  if (err) {
    console.error('Error finding available port:', err);
    process.exit(1);
  }
  
  const dbConfig = {
    type: options.type,
    path: options.database ? path.resolve(options.database) : null,
    host: options.dbHost,
    user: options.dbUser,
    password: options.dbPass,
    database: options.dbName
  };

  server.start(port, dbConfig);
  console.log(`SQLite EDA running at http://localhost:${port}`);
});