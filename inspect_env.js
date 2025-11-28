require('dotenv').config();
const keys = Object.keys(process.env);
const relevant = keys.filter(k =>
    k.includes('EMAIL') ||
    k.includes('PASS') ||
    k.includes('USER') ||
    k.includes('LOGIN')
);
console.log('Relevant Env Vars:', relevant);
