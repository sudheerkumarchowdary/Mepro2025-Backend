require('dotenv').config();

console.log('\n=== Checking Environment Variables ===\n');

// Check for SQL variables with common naming patterns
const sqlPatterns = ['SQL', 'AZURE', 'DB', 'DATABASE', 'MSSQL'];
const allKeys = Object.keys(process.env);

console.log('Looking for SQL-related environment variables...\n');

sqlPatterns.forEach(pattern => {
    const matches = allKeys.filter(key =>
        key.toUpperCase().includes(pattern) &&
        !key.startsWith('npm_') &&
        !key.startsWith('VSCODE')
    );

    if (matches.length > 0) {
        console.log(`\nVariables containing "${pattern}":`);
        matches.forEach(key => {
            const value = process.env[key];
            // Mask passwords
            const displayValue = key.includes('PASS') || key.includes('SECRET') || key.includes('KEY')
                ? '***' + (value ? value.slice(-4) : '')
                : value?.substring(0, 50);
            console.log(`  ${key} = ${displayValue}`);
        });
    }
});

// Check what we need
console.log('\n\n=== Required Variables Status ===\n');
const required = {
    'SQL_SERVER': process.env.SQL_SERVER,
    'SQL_DATABASE': process.env.SQL_DATABASE,
    'SQL_USER': process.env.SQL_USER,
    'SQL_PASSWORD': process.env.SQL_PASSWORD,
    'ADMIN_EMAIL': process.env.ADMIN_EMAIL || process.env.USER_EMAIL,
    'ADMIN_PASSWORD': process.env.ADMIN_PASSWORD || process.env.USER_PASSWORD
};

Object.entries(required).forEach(([key, value]) => {
    const status = value ? '✓ SET' : '✗ MISSING';
    const display = value && (key.includes('PASS') || key.includes('PASSWORD'))
        ? '***'
        : (value || 'not set');
    console.log(`${status.padEnd(10)} ${key.padEnd(20)} = ${display}`);
});

console.log('\n');
