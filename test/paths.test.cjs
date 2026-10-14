const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.demo-data'), { recursive: true });
const modulePath = './public/Program/General/backend/platform-paths';

test('external data roots are rejected before any directory is created', () => {
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(modulePath)})`], { cwd: root, env: { ...process.env, PLATFORM_DATA_ROOT: path.join(root, 'outside-demo') }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must stay inside/);
  assert.equal(fs.existsSync(path.join(root, 'outside-demo')), false);
});

test('path traversal and legacy migration are rejected without inspecting source paths', () => {
  const code = `const p=require(${JSON.stringify(modulePath)}); const assert=require('node:assert/strict'); assert.throws(()=>p.dataFile('../escape','fixture.json'), /escapes/); assert.equal(p.copyRecursiveMissing('this-path-is-never-inspected','also-never-inspected'), false); console.log('confined');`;
  const result = spawnSync(process.execPath, ['-e', code], { cwd: root, env: { ...process.env, PLATFORM_DATA_ROOT: path.join(root, '.demo-data', 'path-tests') }, encoding: 'utf8' });
  // A nested data root cannot escape into its parent root through appName traversal.
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /confined/);
});

test('demo root symlinks or junctions are rejected', (t) => {
  const sandbox = fs.mkdtempSync(path.join(root, '.demo-data', 'links-'));
  const target = path.join(sandbox, 'target');
  const link = path.join(sandbox, 'linked');
  fs.mkdirSync(target);
  try { fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir'); } catch (error) { t.skip(`Symlink permission unavailable: ${error.code}`); return; }
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(modulePath)})`], { cwd: root, env: { ...process.env, PLATFORM_DATA_ROOT: link }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symbolic links or junctions/);
  fs.unlinkSync(link);
});
