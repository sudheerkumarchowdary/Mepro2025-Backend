const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
try {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('--- ENV CONTENT START ---');
    console.log(content);
    console.log('--- ENV CONTENT END ---');
} catch (err) {
    console.error('Error reading .env:', err);
}
