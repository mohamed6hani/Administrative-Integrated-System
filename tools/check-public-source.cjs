const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['node_modules', '.git', '.demo-data', '.platform-build']);
const allowed = new Set(['.js', '.cjs', '.mjs', '.css', '.html', '.json', '.md', '.yml', '.yaml', '.example']);
const failures = [];
let checked = 0;

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!excluded.has(entry.name)) visit(path.join(directory, entry.name)); continue; }
    const filename = path.join(directory, entry.name);
    const relative = path.relative(root, filename).replace(/\\/g, '/');
    if (fs.lstatSync(filename).isSymbolicLink()) { failures.push(`${relative}: link is not allowed`); continue; }
    if (!allowed.has(path.extname(entry.name)) && entry.name !== '.gitignore') { failures.push(`${relative}: non-source file`); continue; }
    const contents = fs.readFileSync(filename, 'utf8');
    if (relative !== 'tools/check-public-source.cjs') {
      const forbidden = [new RegExp("PASSWORD\\s*=\\s*['\"]\\d+['\"]"), /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/, /<img\b[^>]*logo\.(?:png|jpg|svg)/i];
      if (forbidden.some((pattern) => pattern.test(contents))) failures.push(`${relative}: excluded branding/credential pattern`);
      for (const match of contents.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
        if (match[0].split('.').every((octet) => Number(octet) <= 255) && match[0] !== '127.0.0.1') failures.push(`${relative}: non-loopback IP literal`);
      }
    }
    checked++;
  }
}

visit(root);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Public source check passed: ${checked} text files; no copied runtime assets or excluded identifiers.`);
