const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || process.env.SQL_USER,
    password: process.env.DB_PASSWORD || process.env.SQL_PASSWORD,
    server: process.env.DB_SERVER || process.env.SQL_SERVER,
    database: process.env.DB_DATABASE || process.env.SQL_DATABASE,
    options: {
        encrypt: true, // Use this if you're on Windows Azure
        trustServerCertificate: true // Required for Azure SQL from local dev
    }
};

async function connectToSql() {
    try {
        const pool = await sql.connect(config);
        console.log('Connected to Azure SQL Database');
        return pool;
    } catch (err) {
        console.error('Database connection failed: ', err);
        throw err;
    }
}

module.exports = {
    sql,
    connectToSql
};
