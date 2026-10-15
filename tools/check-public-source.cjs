const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['node_modules', '.git', '.demo-data', '.platform-build']);
const allowed = new Set(['.js', '.cjs', '.mjs', '.css', '.html', '.json', '.md', '.yml', '.yaml', '.example']);
const failures = [];
let checked = 0;
let reviewedDocuments = 0;
const approvedBrief = 'docs/Administrative-Integrated-System-Overview.pdf';
const approvedBriefSha256 = '2c7de60de7264db8fe85da71380672e6acae93c9686baa2c69d6e670e735a91f';

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const relative = path.relative(root, filename).replace(/\\/g, '/');
    if (fs.lstatSync(filename).isSymbolicLink()) { failures.push(`${relative}: link is not allowed`); continue; }
    if (entry.isDirectory()) { if (!excluded.has(entry.name)) visit(filename); continue; }
    if (relative === approvedBrief) {
      const digest = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
      if (digest !== approvedBriefSha256) failures.push(`${relative}: PDF differs from the reviewed project brief`);
      else reviewedDocuments++;
      continue;
    }
    if (!allowed.has(path.extname(entry.name)) && !['.gitignore', '.gitattributes'].includes(entry.name)) { failures.push(`${relative}: non-source file`); continue; }
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
if (reviewedDocuments !== 1) failures.push('The exact reviewed project brief is required.');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Public source check passed: ${checked} text files and ${reviewedDocuments} reviewed PDF; no copied runtime assets or excluded identifiers.`);
