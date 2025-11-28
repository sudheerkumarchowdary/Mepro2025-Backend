const sql = require('mssql');
require('dotenv').config();

async function detailedTest() {
    console.log('=== Detailed SQL Connection Test ===\n');

    // Test with original settings
    console.log('Test 1: Original config (encrypt: true, trustServerCertificate: false)');
    const config1 = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: {
            encrypt: true,
            trustServerCertificate: false
        }
    };

    console.log('Config:', {
        user: config1.user,
        server: config1.server,
        database: config1.database,
        password: config1.password ? '***' + config1.password.slice(-4) : 'MISSING'
    });

    try {
        const pool1 = await sql.connect(config1);
        console.log('✅ SUCCESS with config 1!');
        await pool1.close();
        process.exit(0);
    } catch (error) {
        console.log('❌ Failed with config 1');
        console.log('Error:', error.message);
        console.log('Code:', error.code);
    }

    // Test with trustServerCertificate: true
    console.log('\nTest 2: With trustServerCertificate: true');
    const config2 = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: {
            encrypt: true,
            trustServerCertificate: true
        }
    };

    try {
        const pool2 = await sql.connect(config2);
        console.log('✅ SUCCESS with config 2!');
        await pool2.close();
        process.exit(0);
    } catch (error) {
        console.log('❌ Failed with config 2');
        console.log('Error:', error.message);
        console.log('Code:', error.code);
        console.log('\nFull error object:');
        console.log(JSON.stringify(error, null, 2));
    }

    // Test without database specified (connect to server only)
    console.log('\nTest 3: Connect to server without database');
    const config3 = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        options: {
            encrypt: true,
            trustServerCertificate: true
        }
    };

    try {
        const pool3 = await sql.connect(config3);
        console.log('✅ SUCCESS with config 3! (Server connection works)');
        console.log('This means: Credentials are correct, but database might not exist or user lacks permissions');
        await pool3.close();
        process.exit(0);
    } catch (error) {
        console.log('❌ Failed with config 3');
        console.log('Error:', error.message);
        console.log('Code:', error.code);

        if (error.code === 'ELOGIN') {
            console.log('\n🔍 ELOGIN Error Analysis:');
            console.log('This usually means:');
            console.log('  1. Wrong username/password');
            console.log('  2. IP not whitelisted in Azure SQL firewall');
            console.log('  3. User doesn\'t have permission to access the server');
            console.log('\nPlease verify:');
            console.log('  - Username:', process.env.DB_USER);
            console.log('  - Server:', process.env.DB_SERVER);
            console.log('  - Your current IP is added to Azure SQL firewall rules');
        }
    }

    process.exit(1);
}

detailedTest();
