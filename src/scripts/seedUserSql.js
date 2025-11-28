const { connectToSql, sql } = require('../dbSql');
require('dotenv').config();

async function seedUser() {
    try {
        console.log('🔌 Connecting to Azure SQL Database...');
        const pool = await connectToSql();

        // Check if Users table exists
        console.log('📋 Checking if Users table exists...');
        const tableCheck = await pool.request().query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'Users'
        `);

        if (tableCheck.recordset.length === 0) {
            console.log('⚠️  Users table does not exist. Creating table...');
            await pool.request().query(`
                CREATE TABLE Users (
                    Id INT PRIMARY KEY IDENTITY(1,1),
                    Name NVARCHAR(255) NOT NULL,
                    Email NVARCHAR(255) NOT NULL UNIQUE,
                    Password NVARCHAR(255) NOT NULL,
                    UserType NVARCHAR(50) NOT NULL CHECK (UserType IN ('recruiter', 'talent')),
                    Segment NVARCHAR(100),
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    UpdatedAt DATETIME2 DEFAULT GETDATE()
                );
                CREATE INDEX IX_Users_Email ON Users(Email);
            `);
            console.log('✅ Users table created successfully!');
        } else {
            console.log('✅ Users table already exists.');
        }

        // Get credentials from environment variables
        const adminEmail = process.env.ADMIN_EMAIL || process.env.USER_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD || process.env.USER_PASSWORD;
        const adminName = process.env.ADMIN_NAME || 'Admin User';
        const userType = process.env.ADMIN_USER_TYPE || 'talent';
        const segment = process.env.ADMIN_SEGMENT || 'General';

        if (!adminEmail || !adminPassword) {
            console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
            console.log('   Checked for: ADMIN_EMAIL, USER_EMAIL, ADMIN_PASSWORD, USER_PASSWORD');
            process.exit(1);
        }

        console.log(`📧 Checking for user: ${adminEmail}`);

        // Check if user already exists
        const existingUser = await pool.request()
            .input('email', sql.NVarChar, adminEmail)
            .query('SELECT * FROM Users WHERE Email = @email');

        if (existingUser.recordset.length > 0) {
            console.log('ℹ️  User already exists in database.');
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Name: ${existingUser.recordset[0].Name}`);
            console.log(`   UserType: ${existingUser.recordset[0].UserType}`);
        } else {
            console.log('➕ Inserting new user...');
            await pool.request()
                .input('name', sql.NVarChar, adminName)
                .input('email', sql.NVarChar, adminEmail)
                .input('password', sql.NVarChar, adminPassword)
                .input('userType', sql.NVarChar, userType)
                .input('segment', sql.NVarChar, segment)
                .query(`
                    INSERT INTO Users (Name, Email, Password, UserType, Segment)
                    VALUES (@name, @email, @password, @userType, @segment)
                `);
            console.log('✅ User created successfully!');
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Name: ${adminName}`);
            console.log(`   UserType: ${userType}`);
        }

        console.log('🎉 Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding user:', error);
        process.exit(1);
    }
}

seedUser();
