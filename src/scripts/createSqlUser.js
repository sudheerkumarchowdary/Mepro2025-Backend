/**
 * Script to help create a new SQL user with proper permissions
 * Run this AFTER you've manually created the login in Azure Portal
 * 
 * Or use Azure Portal Query Editor to run the SQL directly
 */

const sql = require('mssql');
require('dotenv').config();

// This script assumes you can connect with admin credentials
// Update these if you have admin access
const adminConfig = {
    user: process.env.DB_USER || process.env.SQL_USER,
    password: process.env.DB_PASSWORD || process.env.SQL_PASSWORD,
    server: process.env.DB_SERVER || process.env.SQL_SERVER,
    database: 'master', // Connect to master to create login
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function createSqlUser() {
    console.log('=== Creating SQL User Script ===\n');
    console.log('⚠️  NOTE: This script requires admin access to Azure SQL');
    console.log('If you don\'t have admin access, use Azure Portal Query Editor instead\n');

    try {
        console.log('🔌 Connecting to Azure SQL as admin...');
        const pool = await sql.connect(adminConfig);
        console.log('✅ Connected successfully\n');

        const newUsername = 'mepro_app_user';
        const newPassword = 'MeProApp2024!@#'; // Change this to a strong password
        const databaseName = process.env.DB_DATABASE || process.env.SQL_DATABASE || 'yostorage-testing';

        console.log('📝 SQL Commands to run:\n');
        console.log('--- Copy and paste these into Azure Portal Query Editor ---\n');
        
        console.log(`-- Step 1: Create login on server`);
        console.log(`CREATE LOGIN ${newUsername} WITH PASSWORD = '${newPassword}';\n`);
        
        console.log(`-- Step 2: Switch to your database`);
        console.log(`USE ${databaseName};\n`);
        
        console.log(`-- Step 3: Create user in database`);
        console.log(`CREATE USER ${newUsername} FOR LOGIN ${newUsername};\n`);
        
        console.log(`-- Step 4: Grant permissions`);
        console.log(`ALTER ROLE db_datareader ADD MEMBER ${newUsername};`);
        console.log(`ALTER ROLE db_datawriter ADD MEMBER ${newUsername};`);
        console.log(`ALTER ROLE db_ddladmin ADD MEMBER ${newUsername};\n`);

        console.log('--- After running the SQL above, update your .env file: ---\n');
        console.log(`DB_USER=${newUsername}`);
        console.log(`DB_PASSWORD=${newPassword}\n`);

        // Optionally, try to create the login if we have permissions
        try {
            console.log('🔄 Attempting to create login automatically...');
            await pool.request().query(`CREATE LOGIN ${newUsername} WITH PASSWORD = '${newPassword}'`);
            console.log('✅ Login created successfully!');
            
            // Switch to database
            const dbConfig = { ...adminConfig, database: databaseName };
            const dbPool = await sql.connect(dbConfig);
            
            await dbPool.request().query(`CREATE USER ${newUsername} FOR LOGIN ${newUsername}`);
            await dbPool.request().query(`ALTER ROLE db_datareader ADD MEMBER ${newUsername}`);
            await dbPool.request().query(`ALTER ROLE db_datawriter ADD MEMBER ${newUsername}`);
            await dbPool.request().query(`ALTER ROLE db_ddladmin ADD MEMBER ${newUsername}`);
            
            console.log('✅ User created with all permissions!');
            console.log('\n📝 Update your .env file with:');
            console.log(`DB_USER=${newUsername}`);
            console.log(`DB_PASSWORD=${newPassword}`);
            
            await dbPool.close();
        } catch (autoError) {
            console.log('⚠️  Could not create automatically (you may not have admin permissions)');
            console.log('   Please use Azure Portal Query Editor to run the SQL commands above');
        }

        await pool.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\n💡 If you get authentication errors, you may need to:');
        console.error('   1. Use Azure Portal Query Editor instead');
        console.error('   2. Connect as Azure AD admin');
        console.error('   3. Contact your Azure administrator\n');
        process.exit(1);
    }
}

createSqlUser();

