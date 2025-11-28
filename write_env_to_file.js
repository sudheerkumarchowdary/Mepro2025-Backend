require('dotenv').config();
const fs = require('fs');

const allKeys = Object.keys(process.env)
    .filter(key =>
        !key.startsWith('npm_') &&
        !key.startsWith('VSCODE') &&
        !key.startsWith('Program') &&
        !key.startsWith('PROCESSOR') &&
        !key.startsWith('Common') &&
        !key.startsWith('Path') &&
        !key.startsWith('ALLUSERS') &&
        !key.startsWith('APPDATA') &&
        !key.startsWith('HOME') &&
        !key.startsWith('TEMP') &&
        !key.startsWith('TMP') &&
        !key.startsWith('WIN') &&
        !key.startsWith('OS') &&
        !key.startsWith('CONDA') &&
        !key.startsWith('PYTHON') &&
        !key.startsWith('POWERSHELL') &&
        !key.startsWith('PSModulePath') &&
        !key.startsWith('SystemRoot') &&
        !key.startsWith('SystemDrive') &&
        !key.startsWith('Driver')
    )
    .sort();

let output = '=== Environment Variables from .env ===\n\n';

allKeys.forEach(key => {
    const value = process.env[key];
    let displayValue;
    if (key.includes('PASS') || key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')) {
        displayValue = value ? `***${value.slice(-4)}` : 'empty';
    } else if (value && value.length > 100) {
        displayValue = value.substring(0, 100) + '...';
    } else {
        displayValue = value || 'empty';
    }

    output += `${key.padEnd(40)} = ${displayValue}\n`;
});

fs.writeFileSync('env_vars.txt', output);
console.log('Environment variables written to env_vars.txt');
console.log(`Total custom variables found: ${allKeys.length}`);
console.log('\nShowing first 20:');
allKeys.slice(0, 20).forEach(key => {
    const value = process.env[key];
    let displayValue;
    if (key.includes('PASS') || key.includes('SECRET') || key.includes('KEY')) {
        displayValue = '***';
    } else {
        displayValue = (value || 'empty').substring(0, 50);
    }
    console.log(`  ${key} = ${displayValue}`);
});
