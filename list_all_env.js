require('dotenv').config();

console.log('\n=== ALL Environment Variables (excluding system) ===\n');

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
        !key.startsWith('PYTHON')
    )
    .sort();

allKeys.forEach(key => {
    const value = process.env[key];
    // Mask sensitive data
    let displayValue;
    if (key.includes('PASS') || key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')) {
        displayValue = value ? `***${value.slice(-4)}` : 'empty';
    } else if (value && value.length > 80) {
        displayValue = value.substring(0, 80) + '...';
    } else {
        displayValue = value || 'empty';
    }

    console.log(`${key.padEnd(40)} = ${displayValue}`);
});

console.log('\n=== End of List ===\n');
