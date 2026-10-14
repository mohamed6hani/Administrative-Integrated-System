const fs = require('fs');
const path = require('path');

const SEGMENT_FILE_RE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
const ARABIC_SEARCH_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_SEARCH_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const RECORD_SEARCH_FIELDS = new Set([
  'name',
  'fullname',
  'requestername',
  'companyname',
  'license',
  'licensenumber'
]);

function normalizeActivitySearchText(value) {
  return String(value == null ? '' : value)
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_SEARCH_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_SEARCH_DIGITS.indexOf(digit)))
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

function normalizeActivityFieldKey(value) {
  return String(value == null ? '' : value)
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

function isRecordSearchChange(change) {
  if (!change || typeof change !== 'object') return false;
  const fieldKey = normalizeActivityFieldKey(change.field);
  const label = String(change.label || '');
  return RECORD_SEARCH_FIELDS.has(fieldKey) || /الاسم|اسم الشركة|رقم الرخصة|رقم الترخيص|رقم القيد/.test(label);
}

function buildActivityRecordSearchText(entry) {
  const details = entry && entry.details && typeof entry.details === 'object' ? entry.details : null;
  if (!details) return '';
  const values = [details.recordName, details.identifierValue];
  const changes = Array.isArray(details.changes) ? details.changes : [];
  changes.filter(isRecordSearchChange).forEach((change) => {
    values.push(change.before, change.after);
  });
  return normalizeActivitySearchText(values.filter(Boolean).join(' '));
}

function matchesActivityRecordQuery(entry, query) {
  const normalizedQuery = normalizeActivitySearchText(query);
  if (!normalizedQuery) return true;
  const searchText = buildActivityRecordSearchText(entry);
  return Boolean(searchText && searchText.includes(normalizedQuery));
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      source: String(parsed.source || ''),
      line: Math.max(Number.parseInt(parsed.line, 10) || 0, 0)
    };
  } catch {
    return null;
  }
}

function readJsonLines(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  } catch {
    return [];
  }
}

function createActivityLogStore(options = {}) {
  const segmentsDir = path.resolve(String(options.segmentsDir || ''));
  const legacyPath = path.resolve(String(options.legacyPath || ''));
  const now = typeof options.now === 'function' ? options.now : () => new Date();
  const sourceLinesCache = new Map();

  function ensureStores() {
    fs.mkdirSync(segmentsDir, { recursive: true });
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    if (!fs.existsSync(legacyPath)) {
      fs.writeFileSync(legacyPath, '', 'utf8');
    }
  }

  function getSegmentName(entry) {
    const occurredAt = entry && entry.occurredAt ? new Date(entry.occurredAt) : now();
    const safeDate = Number.isNaN(occurredAt.getTime()) ? now() : occurredAt;
    return `${safeDate.toISOString().slice(0, 10)}.jsonl`;
  }

  function append(entry) {
    ensureStores();
    const filePath = path.join(segmentsDir, getSegmentName(entry));
    const serializedEntry = JSON.stringify(entry);
    fs.appendFileSync(filePath, `${serializedEntry}\n`, 'utf8');
    const cached = sourceLinesCache.get(filePath);
    if (cached) {
      if (cached.lines[cached.lines.length - 1] === '') {
        cached.lines.pop();
      }
      cached.lines.push(serializedEntry, '');
      try {
        const stats = fs.statSync(filePath);
        cached.size = stats.size;
        cached.mtimeMs = stats.mtimeMs;
      } catch {
        sourceLinesCache.delete(filePath);
      }
    }
    return filePath;
  }

  function getSourceLines(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      sourceLinesCache.delete(filePath);
      return [];
    }

    try {
      const stats = fs.statSync(filePath);
      const cached = sourceLinesCache.get(filePath);
      if (cached && cached.size === stats.size && cached.mtimeMs === stats.mtimeMs) {
        return cached.lines;
      }

      const lines = readJsonLines(filePath);
      sourceLinesCache.set(filePath, {
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        lines
      });
      return lines;
    } catch {
      sourceLinesCache.delete(filePath);
      return [];
    }
  }

  function listSources() {
    ensureStores();
    const segmentNames = fs.readdirSync(segmentsDir)
      .filter((name) => SEGMENT_FILE_RE.test(name))
      .sort((left, right) => right.localeCompare(left));
    const sources = segmentNames.map((name) => ({
      key: `segment:${name}`,
      path: path.join(segmentsDir, name)
    }));
    if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).size > 0) {
      sources.push({ key: 'legacy', path: legacyPath });
    }
    return sources;
  }

  function normalizeStartState(sources, cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return { sourceIndex: 0, line: null };
    const sourceIndex = sources.findIndex((source) => source.key === decoded.source);
    if (sourceIndex === -1) return { sourceIndex: 0, line: null };
    return { sourceIndex, line: decoded.line };
  }

  function findNextMatch(sources, initialState, matcher, sourceLines) {
    let sourceIndex = initialState.sourceIndex;
    let line = initialState.line;
    while (sourceIndex < sources.length) {
      const source = sources[sourceIndex];
      let lines = sourceLines.get(source.path);
      if (!lines) {
        lines = getSourceLines(source.path);
        sourceLines.set(source.path, lines);
      }
      let index = Number.isInteger(line) ? Math.min(line, lines.length - 1) : lines.length - 1;
      for (; index >= 0; index -= 1) {
        const raw = lines[index];
        if (!raw || !raw.trim()) continue;
        try {
          const entry = JSON.parse(raw);
          const nextState = index > 0
            ? { sourceIndex, line: index - 1 }
            : { sourceIndex: sourceIndex + 1, line: null };
          if (matcher(entry)) {
            return { entry, nextState };
          }
        } catch {
          continue;
        }
      }
      sourceIndex += 1;
      line = null;
    }
    return null;
  }

  function readPage(options = {}) {
    const sources = listSources();
    const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 100, 1), 500);
    const username = String(options.username || '').trim();
    const query = String(options.query || '').trim();
    const ignoreEntry = typeof options.ignoreEntry === 'function' ? options.ignoreEntry : () => false;
    const matcher = (entry) => {
      if (!entry || typeof entry !== 'object') return false;
      if (username && String(entry.username || '') !== username) return false;
      if (query && !matchesActivityRecordQuery(entry, query)) return false;
      return !ignoreEntry(entry);
    };

    let state = normalizeStartState(sources, options.cursor);
    const sourceLines = new Map();
    const entries = [];
    while (entries.length < limit) {
      const found = findNextMatch(sources, state, matcher, sourceLines);
      if (!found) break;
      entries.push(found.entry);
      state = found.nextState;
    }

    const nextMatch = entries.length ? findNextMatch(sources, state, matcher, sourceLines) : null;
    const hasMore = Boolean(nextMatch);
    let nextCursor = null;
    if (hasMore && state.sourceIndex < sources.length) {
      nextCursor = encodeCursor({
        source: sources[state.sourceIndex].key,
        line: Number.isInteger(state.line) ? state.line : Number.MAX_SAFE_INTEGER
      });
    }

    return { entries, nextCursor, hasMore };
  }

  return {
    append,
    ensureStores,
    listSources,
    readPage
  };
}

module.exports = {
  buildActivityRecordSearchText,
  createActivityLogStore,
  decodeCursor,
  encodeCursor,
  matchesActivityRecordQuery,
  normalizeActivitySearchText
};
