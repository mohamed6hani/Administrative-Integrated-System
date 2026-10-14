'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const { DATA_ROOT } = require('../../General/backend/platform-paths');
const { upsertOcrPage, getCachedEntry, deleteByFileKey } = require('./ocr-db');
const { SimpleQueue } = require('./ocr-queue');
const { getQariStatus, runQariOcr } = require('./ocr-qari');

const CACHE_ROOT = path.join(DATA_ROOT, 'Report', 'Links');
const TEMP_DIR = path.join(DATA_ROOT, 'Report', 'ocr-tmp');

// ── Filename pattern: row-{id}[_tag][letter].ext ──────────────────
const FILE_RE = /^row-(\d+)(?:_\d+)?([a-z])?\.(pdf|png|jpg|jpeg|webp)$/i;

// ── Progress singleton ────────────────────────────────────────────
let _prog = createProgress();

function createProgress() {
  return {
    running: false,
    total: 0,
    scanned: 0,   // first-time scan, all pages OK
    skipped: 0,   // cache hit, unchanged
    updated: 0,   // rescanned (file changed), all pages OK
    failed: 0,    // any page OCR failed
    savedPages: 0,
    currentDecision: '',
    currentFile: '',
    currentStartedAt: null,
    log: [],
    startedAt: null,
    finishedAt: null,
    error: null,
  };
}

function addLog(msg) {
  _prog.log.push({ t: new Date().toISOString().slice(11, 19), msg });
  if (_prog.log.length > 400) _prog.log.splice(0, 100);
  console.log('[OCR]', msg);
}

function decorateProgressSnapshot(progress, nowMs = Date.now()) {
  const snap = { ...progress, log: Array.isArray(progress.log) ? progress.log.slice(-60) : [] };
  snap.etaPendingReason = null;
  snap.currentElapsedSeconds = null;

  if (snap.startedAt) {
    const startMs = new Date(snap.startedAt).getTime();
    const endMs   = snap.finishedAt ? new Date(snap.finishedAt).getTime() : nowMs;
    snap.elapsedSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
    const done = snap.scanned + snap.skipped + snap.updated + snap.failed;
    if (snap.running && done > 0 && snap.total > done) {
      const rate = done / Math.max(1, (nowMs - startMs) / 1000);
      snap.etaSeconds = Math.round((snap.total - done) / rate);
    } else {
      snap.etaSeconds = snap.running ? null : 0;
      if (snap.running && snap.total > 0 && done === 0) {
        snap.etaPendingReason = 'waiting-for-first-page';
      }
    }
  }

  if (snap.running && snap.currentStartedAt) {
    const currentStartMs = new Date(snap.currentStartedAt).getTime();
    if (Number.isFinite(currentStartMs)) {
      snap.currentElapsedSeconds = Math.max(0, Math.round((nowMs - currentStartMs) / 1000));
    }
  }

  return snap;
}

function getProgress() {
  return decorateProgressSnapshot(_prog);
}

// ── Helpers ───────────────────────────────────────────────────────
function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function extractYear(dateStr) {
  const s = String(dateStr || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = s.match(/(19|20)\d{2}/);
  return m ? m[0] : '';
}

function makeUploadFileKey(category, year, rowId, letter) {
  const lp = letter ? letter.toUpperCase() : '0';
  const prefix = category ? String(category).trim().toLowerCase() : 'unknown';
  return year ? `${prefix}_${year}_${rowId}_${lp}` : `${prefix}_${rowId}_${lp}`;
}

function getPdfPageCount(filePath) {
  try {
    const size = fs.statSync(filePath).size;
    const buf = Buffer.alloc(Math.min(size, 65536));
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const text = buf.toString('latin1');
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)]
      .map(m => parseInt(m[1], 10)).filter(n => n > 0 && n < 10000);
    if (counts.length) return Math.max(...counts);
  } catch {}
  return 1;
}

function writeCacheFile(year, decisionNumber, letterCounter, pageNumber, text) {
  const ldir = letterCounter ? String(letterCounter).toUpperCase() : '0';
  const dir = path.join(CACHE_ROOT, String(year || '_unknown'), String(decisionNumber), ldir);
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, `page_${pageNumber}.txt`);
  fs.writeFileSync(fp, text, 'utf8');
  return fp;
}

function getPdfRenderDpi(env = process.env) {
  return Math.max(150, Math.min(600, parseInt(env.QARI_PDF_DPI, 10) || 150));
}

function getErrorMessage(error, maxLength = 1200) {
  return (error && error.message ? error.message : String(error || '')).slice(0, maxLength);
}

// ── PDF tool detection ────────────────────────────────────────────
let _pdfTool = 'unchecked';

function isPdftoppm(cmd) {
  if (!cmd) return false;
  return cmd === 'pdftoppm' || cmd.endsWith('pdftoppm.exe') || cmd.endsWith('/pdftoppm');
}

async function detectPdfTool() {
  if (_pdfTool !== 'unchecked') return _pdfTool;

  const candidates = process.platform === 'win32'
    ? ['pdftoppm', 'gswin64c', 'gswin32c', 'gs']
    : ['pdftoppm', 'gs'];

  if (process.platform === 'win32') {
    // WinGet portable Poppler (oschwartz10612.Poppler)
    const wingetBase = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetBase)) {
      try {
        const popplerPkg = fs.readdirSync(wingetBase).find(d => d.startsWith('oschwartz10612.Poppler_'));
        if (popplerPkg) {
          const pkgDir = path.join(wingetBase, popplerPkg);
          const sub = fs.readdirSync(pkgDir).find(d => d.startsWith('poppler-'));
          if (sub) {
            const exe = path.join(pkgDir, sub, 'Library', 'bin', 'pdftoppm.exe');
            if (fs.existsSync(exe)) candidates.unshift(exe); // prefer over bare 'pdftoppm'
          }
        }
      } catch {}
    }

    // Common Ghostscript install dirs
    for (const base of ['C:\\Program Files\\gs', 'C:\\Program Files (x86)\\gs']) {
      if (!fs.existsSync(base)) continue;
      try {
        const versions = fs.readdirSync(base).sort().reverse();
        for (const ver of versions) {
          const e64 = path.join(base, ver, 'bin', 'gswin64c.exe');
          if (fs.existsSync(e64)) { candidates.push(e64); break; }
          const e32 = path.join(base, ver, 'bin', 'gswin32c.exe');
          if (fs.existsSync(e32)) { candidates.push(e32); break; }
        }
      } catch {}
    }
  }

  for (const cmd of candidates) {
    const args = isPdftoppm(cmd) ? ['-v'] : ['--version'];
    try {
      await execFileAsync(cmd, args, { timeout: 5000, windowsHide: true });
      _pdfTool = cmd;
      addLog(`PDF tool: ${cmd}`);
      return _pdfTool;
    } catch (e) {
      if (e.code !== 'ENOENT') {
        _pdfTool = cmd;
        addLog(`PDF tool: ${cmd}`);
        return _pdfTool;
      }
    }
  }
  _pdfTool = null;
  return null;
}

async function tryAutoInstallPdfTool() {
  addLog('PDF tool not found — attempting auto-install via winget...');

  const packages = [
    { id: 'oschwartz10612.poppler',      name: 'Poppler (pdftoppm)' },
    { id: 'ArtifexSoftware.GhostScript', name: 'Ghostscript' },
  ];

  for (const pkg of packages) {
    addLog(`Installing ${pkg.name}...`);
    try {
      await execFileAsync('winget', [
        'install', '--id', pkg.id,
        '--silent', '--accept-package-agreements', '--accept-source-agreements',
      ], { timeout: 180000, windowsHide: true });
      addLog(`${pkg.name} installed OK`);
    } catch (e) {
      const msg = (e.message || String(e)).slice(0, 120);
      addLog(`${pkg.name} install failed: ${msg}`);
    }
  }

  _pdfTool = 'unchecked';
  const tool = await detectPdfTool();
  if (tool) addLog(`PDF tool ready after install: ${tool}`);
  else addLog('WARNING: Still no PDF tool — PDFs may fail. Install Ghostscript manually.');
  return tool;
}

async function convertPdfPageToPng(pdfPath, pageNum) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const stamp = `${process.hrtime.bigint()}`;
  const tool = await detectPdfTool();
  const dpi = getPdfRenderDpi();

  if (isPdftoppm(tool)) {
    const prefix = path.join(TEMP_DIR, `p${stamp}`);
    try {
      await execFileAsync(tool,
        ['-r', String(dpi), '-png', '-f', String(pageNum), '-l', String(pageNum), pdfPath, prefix],
        { timeout: 90000, windowsHide: true });
      const files = fs.readdirSync(TEMP_DIR)
        .filter(f => f.startsWith(path.basename(prefix)) && f.endsWith('.png')).sort();
      if (files.length) {
        const dst = path.join(TEMP_DIR, `r${stamp}.png`);
        fs.renameSync(path.join(TEMP_DIR, files[0]), dst);
        return dst;
      }
    } catch {}
  } else if (tool) {
    const outPng = path.join(TEMP_DIR, `g${stamp}.png`);
    try {
      await execFileAsync(tool, [
        '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=png16m',
        `-dFirstPage=${pageNum}`, `-dLastPage=${pageNum}`, `-r${dpi}`,
        `-sOutputFile=${outPng}`, pdfPath,
      ], { timeout: 90000, windowsHide: true });
      if (fs.existsSync(outPng)) return outPng;
    } catch {}
  }
  return null;
}

// ── QARI OCR ──────────────────────────────────────────────────────
async function runPageOcr(inputPath) {
  return runQariOcr(inputPath);
}

// ── Process one file ──────────────────────────────────────────────
async function processFile(file) {
  const { filePath, uploadFileKey, decisionNumber, year, letterUpper, category, originalFileName, forceRescan } = file;

  let fileHash;
  try { fileHash = hashFile(filePath); }
  catch (e) { throw new Error(`Cannot read file: ${e.message}`); }

  const cached = getCachedEntry(uploadFileKey);
  const hadCached = !!cached;
  if (!forceRescan) {
    if (cached && cached.scanStatus === 'completed' && cached.fileHash === fileHash) {
      _prog.skipped++;
      addLog(`Skip (done): ${originalFileName}`);
      return;
    }
    if (cached && cached.fileHash !== fileHash) {
      deleteByFileKey(uploadFileKey);
    }
  } else {
    deleteByFileKey(uploadFileKey);
  }

  addLog(`Scan: ${originalFileName}`);

  const baseRow = {
    year, decisionNumber, letterCounter: letterUpper,
    uploadFileKey, attachmentId: originalFileName,
    originalFileName, filePath, fileHash, category,
  };

  let anyPageFailed = false;
  const isImage = /\.(png|jpg|jpeg|webp)$/i.test(filePath);

  if (isImage) {
    let text = '', error = null;
    try { text = await runPageOcr(filePath); }
    catch (e) { error = getErrorMessage(e); addLog(`  Error: ${error.slice(0, 180)}`); }
    const cachePath = error ? '' : writeCacheFile(year || '0', decisionNumber, letterUpper, 1, text);
    upsertOcrPage({ ...baseRow, pageNumber: 1, extractedText: text, cachePath, confidence: null, scanStatus: error ? 'failed' : 'completed', errorMessage: error || null });
    if (error) anyPageFailed = true; else _prog.savedPages++;
  } else {
    // PDF
    const pageCount = getPdfPageCount(filePath);
    addLog(`  ${pageCount} page(s)`);
    let pdfHandled = false;

    for (let p = 1; p <= pageCount && !pdfHandled; p++) {
      let text = '', error = null, pngPath = null;
      try {
        pngPath = await convertPdfPageToPng(filePath, p);
        if (pngPath) {
          text = await runPageOcr(pngPath);
        } else {
          error = 'No PDF converter (pdftoppm/Ghostscript).';
        }
      } catch (e) {
        error = getErrorMessage(e);
        addLog(`  Page ${p} error: ${error.slice(0, 180)}`);
      } finally {
        if (pngPath) try { fs.unlinkSync(pngPath); } catch {}
      }
      const cachePath = error ? '' : writeCacheFile(year || '0', decisionNumber, letterUpper, p, text);
      upsertOcrPage({ ...baseRow, pageNumber: p, extractedText: text, cachePath, confidence: null, scanStatus: error ? 'failed' : 'completed', errorMessage: error || null });
      if (error) anyPageFailed = true; else _prog.savedPages++;
    }
  }

  if (anyPageFailed) _prog.failed++;
  else if (hadCached || forceRescan) _prog.updated++;
  else _prog.scanned++;
}

// ── Scan entry point ──────────────────────────────────────────────
function startScan(datasets) {
  if (_prog.running) return { ok: false, error: 'Scan already in progress' };

  _prog = createProgress();
  _prog.running = true;
  _prog.startedAt = new Date().toISOString();

  runScan(datasets).catch(e => {
    _prog.error = e.message || String(e);
    addLog(`Fatal: ${_prog.error}`);
  }).finally(() => {
    _prog.running = false;
    _prog.finishedAt = new Date().toISOString();
    addLog(`Done — scanned:${_prog.scanned} skipped:${_prog.skipped} saved:${_prog.savedPages} failed:${_prog.failed}`);
  });

  return { ok: true };
}

async function runScan(datasets) {
  addLog('Collecting files...');

  const qariStatus = await getQariStatus();
  if (!qariStatus.ready) {
    addLog('ERROR: QARI OCR runtime is not ready.');
    if (!qariStatus.runnerPath) addLog('Missing llama-mtmd-cli. Install llama.cpp or set QARI_LLAMA_CLI.');
    if (!qariStatus.modelExists) addLog(`Missing model: ${qariStatus.modelPath}`);
    if (!qariStatus.mmprojExists) addLog(`Missing mmproj: ${qariStatus.mmprojPath}`);
    _prog.error = 'QARI OCR runtime is not ready';
    return;
  }
  addLog(`QARI runner: ${qariStatus.runnerPath}`);
  addLog(`QARI model: ${path.basename(qariStatus.modelPath)}`);
  addLog(`PDF render DPI: ${getPdfRenderDpi()}`);

  // Ensure a PDF conversion tool is available
  const pdfTool = await detectPdfTool();
  if (!pdfTool) {
    addLog('WARNING: No PDF converter found (pdftoppm/Ghostscript). PDF files will be skipped.');
    addLog('Install Poppler via: winget install oschwartz10612.Poppler');
  }

  const allFiles = [];
  for (const { category, photoDirPath, csvRows, filterIds, forceRescan } of datasets) {
    if (!photoDirPath || !fs.existsSync(photoDirPath)) { addLog(`No dir: ${photoDirPath}`); continue; }
    const yearMap = new Map();
    for (const row of (csvRows || [])) {
      if (row.id) { const yr = extractYear(row.date); if (yr) yearMap.set(String(row.id), yr); }
    }
    for (const filename of fs.readdirSync(photoDirPath)) {
      const m = String(filename).match(FILE_RE);
      if (!m) continue;
      const filePath = path.join(photoDirPath, filename);
      if (!fs.existsSync(filePath)) continue;
      const rowId = m[1];
      if (filterIds && !filterIds.has(rowId)) continue;
      const letter = (m[2] || '').toLowerCase();
      const year = yearMap.get(rowId) || '';
      const letterUpper = letter ? letter.toUpperCase() : '0';
      allFiles.push({
        filename, filePath, rowId, letter, letterUpper,
        ext: m[3].toLowerCase(), year,
        decisionNumber: rowId,
        uploadFileKey: makeUploadFileKey(category, year, rowId, letter),
        category, originalFileName: filename,
        forceRescan: !!forceRescan,
      });
    }
  }

  _prog.total = allFiles.length;
  addLog(`Found ${allFiles.length} file(s)`);
  if (!allFiles.length) return;

  const concurrency = Math.max(1, Math.min(2, parseInt(process.env.QARI_OCR_CONCURRENCY, 10) || 1));
  const queue = new SimpleQueue(concurrency);
  await Promise.all(allFiles.map(file => queue.add(async () => {
    _prog.currentDecision = file.decisionNumber;
    _prog.currentFile = file.filename;
    _prog.currentStartedAt = new Date().toISOString();
    try { await processFile(file); }
    catch (e) { _prog.failed++; addLog(`Error ${file.filename}: ${getErrorMessage(e, 180)}`); }
    finally { _prog.currentStartedAt = null; }
  })));
}

module.exports = { startScan, getProgress, decorateProgressSnapshot, getPdfRenderDpi };
