const { connectToSql, sql } = require('../dbSql');
require('dotenv').config();

async function testConnection() {
    console.log('=== Testing SQL Connection ===\n');
    console.log('Environment Variables:');
    console.log('  DB_SERVER:', process.env.DB_SERVER);
    console.log('  DB_DATABASE:', process.env.DB_DATABASE);
    console.log('  DB_USER:', process.env.DB_USER);
    console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-4) : 'NOT SET');
    console.log('\n');

    try {
        console.log('Attempting to connect...');
        const pool = await connectToSql();
        console.log('✅ Connection successful!');

        console.log('Running test query...');
        const result = await pool.request().query('SELECT 1 as test, GETDATE() as currentTime');
        console.log('✅ Query successful!');
        console.log('Result:', result.recordset);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);

        if (error.code === 'ELOGIN') {
            console.error('\n💡 Login Error - Possible causes:');
            console.error('   1. Incorrect username or password');
            console.error('   2. User does not have access to the database');
            console.error('   3. Azure SQL firewall blocking your IP address');
            console.error('   4. SQL authentication not enabled (Windows auth only)');
            console.error('\n📝 To fix firewall issue:');
            console.error('   - Go to Azure Portal → Your SQL Server → Networking');
            console.error('   - Add your client IP or enable "Allow Azure services"');
        }

        console.error('\nFull error details:', error);
        process.exit(1);
    }
}

testConnection();
