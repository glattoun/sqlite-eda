SQLite EDA
A powerful command-line tool for Exploratory Data Analysis of SQLite databases with interactive web-based visualizations.
Features

🔍 Interactive Data Exploration - Browse tables, examine schemas, and query data through a clean web interface
📊 Dynamic Visualizations - Generate charts and graphs using D3.js for immediate visual insights
⚡ Real-time Analysis - Live updates as you explore your data
🌐 Web-based Interface - No desktop app required - works in any modern browser
🚀 Zero Configuration - Just point it at your SQLite file and go

Installation
Global Installation (Recommended)
bashnpm install -g sqlite-eda
Local Installation
bashnpm install sqlite-eda
Quick Start
bash# Analyze any SQLite database
sqlite-eda your-database.sqlite

# The tool will automatically open your browser to the analysis interface
# Default: http://localhost:3000
Usage Examples
bash# Basic usage
sqlite-eda data.db

# Specify a custom port
sqlite-eda data.db --port 8080

# Get help
sqlite-eda --help
What You Can Do

Explore Tables: View all tables in your database with row counts and schema information
Run Queries: Execute SQL queries directly in the web interface
Visualize Data: Generate histograms, scatter plots, bar charts, and more
Export Results: Download query results as CSV or JSON
Schema Analysis: Understand relationships between tables

Development
Setup
bashgit clone https://github.com/YOUR-USERNAME/sqlite-eda.git
cd sqlite-eda
npm install
Run Locally
bashnpm start path/to/your/database.sqlite
Project Structure
sqlite-eda/
├── src/
│   ├── server.js          # Express server
│   └── public/            # Web interface files
├── bin/
│   └── sqlite-eda.js      # CLI entry point
└── package.json
Requirements

Node.js 14 or higher
A SQLite database file
