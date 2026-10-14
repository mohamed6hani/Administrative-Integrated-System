const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.demo-data'), { recursive: true });
process.env.PLATFORM_DATA_ROOT = fs.mkdtempSync(path.join(root, '.demo-data', 'test-'));
process.env.DEMO_NO_LISTEN = '1';

const { seedDemo } = require('../tools/seed-demo.cjs');
const { makeDemoAccounts, DEMO_ADMIN_PASSWORD, DEMO_USER_PASSWORD } = require('../public/Program/General/backend/demo-accounts');
const { dataSubdir } = require('../public/Program/General/backend/platform-paths');
let server;
let base;
let admin;
let user;
let adminCookie;

async function api(url, { token, method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}${url}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  return { response, payload };
}

test.before(async () => {
  await seedDemo();
  const app = require('../public/Program/General/backend/server');
  server = await new Promise((resolve) => { const active = app.listen(0, '127.0.0.1', () => resolve(active)); });
  base = `http://127.0.0.1:${server.address().port}`;
  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: DEMO_ADMIN_PASSWORD } });
  assert.equal(login.response.status, 200);
  admin = login.payload.token;
  adminCookie = login.response.headers.get('set-cookie').split(';')[0];
  user = (await api('/api/auth/login', { method: 'POST', body: { username: 'demo-user', password: DEMO_USER_PASSWORD } })).payload.token;
});

test.after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

test('login exposes no password hash and rejects incorrect credentials', async () => {
  const profile = await api('/api/auth/profile', { token: admin });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.payload.user.passwordHash, undefined);
  const invalid = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'incorrect-demo-password' } });
  assert.equal(invalid.response.status, 401);
});

test('protected APIs reject unauthenticated requests', async () => {
  for (const endpoint of ['/api/weapons/csv-data', '/api/renewal/csv-data', '/api/report/data', '/api/request/requests', '/api/accept/records', '/api/seized/records', '/api/storage/files', '/company/api/companies']) {
    assert.equal((await api(endpoint)).response.status, 401, endpoint);
  }
});

test('all eight module APIs load fictional data without production dependencies', async () => {
  for (const endpoint of ['/api/weapons/csv-data', '/api/renewal/csv-data', '/api/report/data', '/api/request/requests', '/api/accept/records', '/api/seized/records', '/api/storage/files', '/company/api/companies']) {
    const result = await api(endpoint, { token: admin });
    assert.equal(result.response.status, 200, `${endpoint}: ${JSON.stringify(result.payload).slice(0, 240)}`);
    assert.match(JSON.stringify(result.payload), /DEMO|تجريبي/, endpoint);
  }
});

test('scoped user is denied disabled modules and privileged global search', async () => {
  for (const endpoint of ['/api/report/data', '/api/accept/records', '/api/seized/records', '/company/api/companies', '/api/global-search?q=demo']) {
    assert.equal((await api(endpoint, { token: user })).response.status, 403, endpoint);
  }
  assert.equal((await api('/api/request/requests', { token: user })).response.status, 200);
});

test('global search finds only the generated fictional records', async () => {
  const result = await api('/api/global-search?q=DEMO', { token: admin });
  assert.equal(result.response.status, 200);
  assert.ok(result.payload.results.length >= 5);
  for (const record of result.payload.results) assert.match(JSON.stringify(record), /DEMO|تجريبي/);
});

test('request creation persists and normalized duplicate names are rejected', async () => {
  const body = { name: 'سجل إختبار جديد', sector: 'شرق', station: 'مكتب تجريبي 01', licenseType: 'ترخيص جديد', notes: 'DEMO ONLY' };
  const created = await api('/api/request/requests', { token: admin, method: 'POST', body });
  assert.equal(created.response.status, 201);
  const loaded = await api(`/api/request/requests/${created.payload.id}`, { token: admin });
  assert.equal(loaded.payload.name, body.name);
  const duplicate = await api('/api/request/requests', { token: admin, method: 'POST', body: { ...body, name: 'سجل اختبار جديد' } });
  assert.equal(duplicate.response.status, 409);
});

test('raw database roots are disabled and static attachments require access', async () => {
  assert.equal((await api('/weapons/data/weapons.sqlite')).response.status, 404);
  for (const endpoint of ['/weapons/slah.csv', '/weapons/tmp/demo.txt', '/report/photoC/demo.txt', '/company/uploads/demo.txt']) {
    assert.equal((await api(endpoint)).response.status, 401, endpoint);
  }
});

test('HttpOnly same-site session cookie supports a synthetic attachment preview only', async () => {
  const directory = dataSubdir('Report', 'photoC');
  fs.writeFileSync(path.join(directory, 'demo-preview.txt'), 'DEMO ONLY: synthetic attachment');
  const preview = await api('/report/photoC/demo-preview.txt', { cookie: adminCookie });
  assert.equal(preview.response.status, 200);
  assert.match(preview.payload, /synthetic attachment/);
  assert.equal((await api('/api/auth/profile', { cookie: adminCookie })).response.status, 401);
  const denied = await api('/report/photoC/demo-preview.txt', { token: user });
  assert.equal(denied.response.status, 403);
});

test('Storage visibility protects an admin-only synthetic file', async () => {
  const { createStorageService } = require('../public/Program/Storage/backend/storage-service');
  const service = createStorageService();
  await service.initialize();
  const accounts = makeDemoAccounts();
  const temp = path.join(service.tmpDir, 'private-demo.txt');
  const text = 'DEMO ONLY — fictional private document';
  fs.writeFileSync(temp, text);
  const record = await service.createFileFromUpload({ file: { path: temp, originalname: 'private-demo.txt', mimetype: 'text/plain', size: Buffer.byteLength(text) }, body: { visibility: 'admins', title: 'Admin-only demo' }, user: accounts[0] });
  await assert.rejects(service.getFileForDownload(record.id, accounts[1]), /access/);
  assert.equal((await service.getFileForDownload(record.id, accounts[0])).id, record.id);
  service.close();
});

test('SQLite adapter rolls back a failed multi-statement transaction', () => {
  const Database = require('../public/Program/General/backend/sqlite-database');
  const db = new Database(path.join(process.env.PLATFORM_DATA_ROOT, 'adapter-test.sqlite'));
  db.exec('CREATE TABLE demo (id INTEGER PRIMARY KEY, value TEXT)');
  const run = db.transaction(() => { db.prepare('INSERT INTO demo VALUES (?, ?)').run(1, 'DEMO'); db.prepare('INSERT INTO demo VALUES (?, ?)').run(1, 'conflict'); });
  assert.throws(run);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM demo').get().count, 0);
  db.close();
});
