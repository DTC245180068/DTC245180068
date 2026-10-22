const fs = require('fs');
const md = fs.readFileSync('docs/BAO_CAO_TONG_HOP.md', 'utf8');
const b64 = Buffer.from(md, 'utf8').toString('base64');
let html = fs.readFileSync('docs/view_report.html', 'utf8');
const regex = /const embeddedB64 = "([^"]*)";/;
html = html.replace(regex, `const embeddedB64 = "${b64}";`);
fs.writeFileSync('docs/view_report.html', html, 'utf8');
console.log('Successfully updated docs/view_report.html with new base64 report!');
