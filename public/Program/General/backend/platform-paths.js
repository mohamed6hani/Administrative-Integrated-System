const fs = require('node:fs');
const path = require('node:path');
const PROGRAM_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_ROOT = path.dirname(PROGRAM_ROOT);
const PROJECT_ROOT = path.dirname(PUBLIC_ROOT);
const DEMO_ROOT = path.join(PROJECT_ROOT, '.demo-data');
const DATA_ROOT = path.resolve(process.env.PLATFORM_DATA_ROOT || DEMO_ROOT);

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

if (!isInside(DEMO_ROOT, DATA_ROOT)) {
  throw new Error('Public demo data must stay inside this checkout\'s .demo-data directory.');
}

function rejectLinkedParents(target) {
  let current = path.resolve(target);
  while (isInside(PROJECT_ROOT, current) && current !== path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error('Public demo data paths cannot use symbolic links or junctions.');
    }
    if (current === PROJECT_ROOT) break;
    current = path.dirname(current);
  }
}
rejectLinkedParents(DATA_ROOT);

function ensureDirSync(dirPath) {
  if (!isInside(DATA_ROOT, dirPath)) throw new Error('Data directory escapes the isolated demo root.');
  rejectLinkedParents(dirPath);
  fs.mkdirSync(dirPath, { recursive: true });
}

function demoPath(...parts) {
  const result = path.resolve(DATA_ROOT, ...parts);
  if (!isInside(DATA_ROOT, result)) throw new Error('Data path escapes the isolated demo root.');
  rejectLinkedParents(result);
  return result;
}

function appDataDir(appName) {
  const result = demoPath(appName);
  ensureDirSync(result);
  return result;
}
function dataSubdir(appName, relativeDir) {
  const result = demoPath(appName, relativeDir);
  ensureDirSync(result);
  return result;
}
function dataFile(appName, relativeFile) {
  const result = demoPath(appName, relativeFile);
  ensureDirSync(path.dirname(result));
  return result;
}
// Compatibility shim: legacy paths are never inspected or copied in the public demo.
function copyRecursiveMissing() { return false; }
module.exports = {
  PROGRAM_ROOT, PUBLIC_ROOT, PROJECT_ROOT, DEMO_ROOT, DATA_ROOT,
  ensureDirSync, copyRecursiveMissing, appDataDir, dataSubdir, dataFile,
  programPath: (...parts) => path.join(PROGRAM_ROOT, ...parts),
  publicPath: (...parts) => path.join(PUBLIC_ROOT, ...parts),
  projectPath: (...parts) => path.join(PROJECT_ROOT, ...parts)
};
