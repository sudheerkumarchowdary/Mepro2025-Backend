const { connectToSql, sql } = require('../dbSql');
require('dotenv').config();

async function testRegistration() {
    try {
        console.log('=== Testing Registration Setup ===\n');
        
        console.log('🔌 Connecting to Azure SQL...');
        const pool = await connectToSql();
        console.log('✅ Connected\n');

        // Check if Users table exists
        console.log('📋 Checking Users table...');
        const tableCheck = await pool.request().query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'Users'
        `);

        if (tableCheck.recordset.length === 0) {
            console.log('⚠️  Users table does not exist. Creating...');
            try {
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
                console.log('✅ Users table created successfully!\n');
            } catch (createError) {
                console.error('❌ Failed to create Users table!');
                console.error('Error:', createError.message);
                console.error('Code:', createError.code);
                console.error('\n💡 This might be a permissions issue.');
                console.error('   The user needs db_ddladmin role to create tables.');
                process.exit(1);
            }
        } else {
            console.log('✅ Users table exists\n');
        }

        // Test insert permissions
        console.log('🧪 Testing insert permissions...');
        try {
            const testResult = await pool.request()
                .input('name', sql.NVarChar, 'Test User')
                .input('email', sql.NVarChar, 'test@example.com')
                .input('password', sql.NVarChar, '$2b$10$testhash')
                .input('userType', sql.NVarChar, 'talent')
                .input('segment', sql.NVarChar, 'Test')
                .query(`
                    INSERT INTO Users (Name, Email, Password, UserType, Segment)
                    OUTPUT INSERTED.Id
                    VALUES (@name, @email, @password, @userType, @segment)
                `);
            
            const testId = testResult.recordset[0].Id;
            console.log('✅ Insert test successful! (ID:', testId, ')\n');

            // Clean up test record
            console.log('🧹 Cleaning up test record...');
            await pool.request()
                .input('id', sql.Int, testId)
                .query('DELETE FROM Users WHERE Id = @id');
            console.log('✅ Test record deleted\n');

        } catch (insertError) {
            console.error('❌ Failed to insert test record!');
            console.error('Error:', insertError.message);
            console.error('Code:', insertError.code);
            console.error('\n💡 This might be a permissions issue.');
            console.error('   The user needs db_datawriter role to insert data.');
            process.exit(1);
        }

        console.log('🎉 All tests passed! Registration should work.\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Code:', error.code);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testRegistration();


