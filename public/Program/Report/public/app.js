const HEADERS = [
  'رقم القرار','تاريخ القرار','الاسم','الوظيفة','نوع الترخيص','نوع السلاح', 'الغرض','قسم الشرطة','القرار'
];
const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;

const REFRESH_INTERVAL_MS = 15000;
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';

const ALL_DATASET_KEY = 'all';
const DATASET_GROUP_ORDER = ['civilians', 'police', 'military'];
const REPORT_DATASET_OPTIONS = [
  { key: 'civilians', label: 'مدنيين' },
  { key: 'police', label: 'شرطة' },
  { key: 'military', label: 'قوات المسلحة' }
];
const DATASET_OPTIONS = [
  ...REPORT_DATASET_OPTIONS,
  { key: ALL_DATASET_KEY, label: 'الكل' }
];
const DATASET_STORAGE_KEY = 'report.activeDataset';
let datasetRestoredFromStorage = false;
let currentDataset = (() => {
  try {
    const stored = localStorage.getItem(DATASET_STORAGE_KEY);
    if (stored && DATASET_OPTIONS.some((opt) => opt.key === stored)) {
      datasetRestoredFromStorage = true;
      return stored;
    }
  } catch (_) {}
  return DATASET_OPTIONS[0]?.key || 'civilians';
})();

let datasetSliderButtons = [];
let datasetAutoDetectAttempted = false;

const SPLIT_DECISION_DATASETS = new Set(['civilians','police','military', ALL_DATASET_KEY]);
const DECISION_OPTION_VALUES = ['','الموافقة','الموافقة علي الالغاء','عدم الموافقة'];
const DECISION_FIELD_LABELS = {
  decision: 'القرار',
  decisionManager: 'مدير الامن',
  decisionPublic: 'امن العام'
};

function isSplitDecisionDataset(datasetKey = currentDataset) {
  return SPLIT_DECISION_DATASETS.has(datasetKey);
}

function isAllDatasetMode(datasetKey = currentDataset) {
  return datasetKey === ALL_DATASET_KEY;
}

function getConcreteDatasetOptions() {
  return REPORT_DATASET_OPTIONS.slice();
}

function getConcreteDatasetKeys() {
  return DATASET_GROUP_ORDER.slice();
}

function getDecisionFieldsForDataset(datasetKey = currentDataset) {
  return isSplitDecisionDataset(datasetKey)
    ? ['decisionManager', 'decisionPublic']
    : ['decision'];
}

function getDecisionLabel(key){
  return DECISION_FIELD_LABELS[key] || 'القرار';
}

function getRowKeyFields(datasetKey = currentDataset) {
  return ['date','name','job','license','weapon','purpose','sector','police', ...getDecisionFieldsForDataset(datasetKey), 'recommendation'];
}

function normalizeSectorKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === 'police_unit' || raw === 'army_unit') return raw;
  return resolveReportSectorKey(raw) || raw;
}

function normalizeStationName(value, sectorKey = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!SHARED_REFERENCE_DATA || typeof SHARED_REFERENCE_DATA.resolveStationName !== 'function') {
    return raw;
  }
  const sectorValue = sectorKey && REPORT_SECTOR_KEY_TO_LABEL[sectorKey]
    ? REPORT_SECTOR_KEY_TO_LABEL[sectorKey]
    : sectorKey;
  return SHARED_REFERENCE_DATA.resolveStationName(raw, sectorValue) || raw;
}

function normalizeRowField(value, field) {
  let text = toEnglishNumbers(String(value ?? '').trim());
  if (!text) return '';
  text = text.replace(/\s+/g, ' ');
  if (field === 'date') {
    const canonical = formatDateToYYYYMMDD(value);
    if (canonical) {
      return toEnglishNumbers(String(canonical).trim().replace(/\s+/g, ' '));
    }
  }
  if (field === 'sector') {
    return normalizeSectorKey(text);
  }
  return text;
}

function normalizeReportSearchValue(value) {
  return toEnglishNumbers(String(value ?? ''))
    .replace(/\uFEFF/g, '')
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[هة]/g, 'ه')
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, '')
    .trim()
    .toLowerCase();
}

function createReportSearchQuery(value) {
  const raw = String(value ?? '').trim();
  const normalized = normalizeReportSearchValue(raw);
  const parts = raw.includes('-')
    ? raw.split('-').map((part) => normalizeReportSearchValue(part)).filter(Boolean)
    : [];
  return { raw, normalized, parts };
}

function getReportSearchColumns() {
  const columns = [
    {
      key: 'id',
      label: 'رقم القرار',
      value: (row) => {
        const rowIndex = rows.indexOf(row);
        return getDecisionNumberDisplay(row, rowIndex) || getDecisionNumberValue(row) || row?.id || '';
      }
    },
    { key: 'date', label: 'تاريخ القرار' },
    { key: 'name', label: 'الاسم' },
    { key: 'textIndex', label: 'فهرس البحث', value: (row) => row?._textIndexText || '' },
    { key: 'job', label: 'الوظيفة' },
    { key: 'license', label: 'نوع الترخيص' },
    { key: 'weapon', label: 'نوع السلاح' },
    { key: 'purpose', label: 'الغرض' },
    {
      key: 'sector',
      label: 'القطاع',
      value: (row) => {
        const sectorKey = normalizeSectorKey(row?.sector || '');
        const sectorLabel = sectorKey && REPORT_SECTOR_KEY_TO_LABEL[sectorKey] ? REPORT_SECTOR_KEY_TO_LABEL[sectorKey] : '';
        return [row?.sector || '', sectorLabel].filter(Boolean).join(' ');
      }
    },
    { key: 'police', label: 'قسم الشرطة' },
    ...getDecisionFieldsForDataset().map((key) => ({ key, label: getDecisionLabel(key) })),
    { key: 'recommendation', label: 'توصية' }
  ];
  const seen = new Set();
  return columns.filter((column) => {
    if (!column || !column.key || seen.has(column.key)) return false;
    seen.add(column.key);
    return true;
  });
}

function getReportSearchFieldValue(row, column) {
  if (!row || !column) return '';
  if (typeof column.value === 'function') return column.value(row);
  return row[column.key] ?? '';
}

function rowMatchesReportSearch(row, queryKey, columns) {
  const query = typeof queryKey === 'object' && queryKey
    ? queryKey
    : { raw: String(queryKey || ''), normalized: String(queryKey || ''), parts: [] };
  if (!query.normalized) return true;
  return columns.some((column) => {
    const value = getReportSearchFieldValue(row, column);
    if (column && column.key === 'textIndex' && query.parts.length > 1) {
      return String(value || '').split(/\n+/).some((line) => {
        const lineValue = normalizeReportSearchValue(line);
        return query.parts.every((part) => lineValue.includes(part));
      });
    }
    const normalizedValue = normalizeReportSearchValue(value);
    if (normalizedValue.includes(query.normalized)) return true;
    return query.parts.length > 1 && query.parts.every((part) => normalizedValue.includes(part));
  });
}

function buildTextIndexSearchMap(value) {
  const source = String(value ?? '');
  const normalizedParts = [];
  const indexMap = [];
  for (let index = 0; index < source.length; index += 1) {
    const normalized = normalizeReportSearchValue(source[index]);
    if (!normalized) continue;
    normalizedParts.push(normalized);
    for (let offset = 0; offset < normalized.length; offset += 1) {
      indexMap.push(index);
    }
  }
  return { normalized: normalizedParts.join(''), indexMap };
}

function findNormalizedTextIndexRange(value, normalizedNeedle, offset = 0) {
  const needle = String(normalizedNeedle || '');
  if (!needle) return null;
  const mapped = buildTextIndexSearchMap(value);
  const foundAt = mapped.normalized.indexOf(needle);
  if (foundAt < 0) return null;
  const start = mapped.indexMap[foundAt];
  const last = mapped.indexMap[foundAt + needle.length - 1];
  if (!Number.isFinite(start) || !Number.isFinite(last)) return null;
  return { start: offset + start, end: offset + last + 1 };
}

function getTextIndexLinesWithOffsets(value) {
  const source = String(value ?? '');
  const lines = [];
  const pattern = /([^\r\n]*)(\r\n|\r|\n|$)/g;
  let match;
  while ((match = pattern.exec(source))) {
    const line = match[1] || '';
    const lineBreak = match[2] || '';
    const start = match.index;
    const end = start + line.length;
    if (line || lineBreak) lines.push({ text: line, start, end });
    if (!lineBreak) break;
    if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
  }
  return lines;
}

function findTextIndexMatchRange(text, searchValue) {
  const source = String(text ?? '');
  const query = typeof searchValue === 'object' && searchValue
    ? searchValue
    : createReportSearchQuery(searchValue);
  if (!source || !query.normalized) return null;

  const directMatch = findNormalizedTextIndexRange(source, query.normalized);
  if (directMatch) return directMatch;

  if (query.parts.length > 1) {
    const lines = getTextIndexLinesWithOffsets(source);
    for (const line of lines) {
      const ranges = query.parts.map((part) => findNormalizedTextIndexRange(line.text, part, line.start));
      if (ranges.every(Boolean)) {
        return { start: line.start, end: line.end };
      }
    }
  }
  return null;
}

function getActiveTextIndexSearchValue() {
  return filterNameEl && filterNameEl.value ? filterNameEl.value.trim() : '';
}

function scrollTextIndexEditorToRange(textarea, text, range) {
  if (!textarea || !range) return;
  const beforeMatch = String(text ?? '').slice(0, Math.max(0, range.start));
  const lineIndex = beforeMatch.split(/\r\n|\r|\n/).length - 1;
  let lineHeight = 28;
  let paddingTop = 0;
  try {
    const style = window.getComputedStyle(textarea);
    const parsedLineHeight = parseFloat(style.lineHeight);
    const parsedFontSize = parseFloat(style.fontSize);
    lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : (Number.isFinite(parsedFontSize) ? parsedFontSize * 1.8 : lineHeight);
    paddingTop = parseFloat(style.paddingTop) || 0;
  } catch (_) {}
  const targetTop = Math.max(0, (lineIndex * lineHeight) + paddingTop - (textarea.clientHeight * 0.35));
  textarea.scrollTop = targetTop;
}

function highlightTextIndexSearchMatch(textarea, text, searchValue, statusEl) {
  const range = findTextIndexMatchRange(text, searchValue);
  if (!textarea || !range) return false;
  const applyHighlight = () => {
    try { textarea.focus({ preventScroll: true }); } catch (_) { textarea.focus(); }
    textarea.setSelectionRange(range.start, range.end);
    scrollTextIndexEditorToRange(textarea, text, range);
    textarea.classList.add('text-index-search-highlight');
    if (statusEl) {
      statusEl.textContent = 'تم تحديد نتيجة البحث داخل فهرس +';
      statusEl.classList.add('is-search-hit');
    }
    if (textarea._textIndexSearchHighlightTimer) {
      clearTimeout(textarea._textIndexSearchHighlightTimer);
    }
    textarea._textIndexSearchHighlightTimer = setTimeout(() => {
      textarea.classList.remove('text-index-search-highlight');
      if (statusEl) statusEl.classList.remove('is-search-hit');
    }, 3000);
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(applyHighlight);
  } else {
    applyHighlight();
  }
  return true;
}
try { window.findTextIndexMatchRange = findTextIndexMatchRange; } catch (_) {}

function rowsMatchExact(a, b) {
  if (!a || !b) return false;
  const fields = getRowKeyFields();
  return fields.every((field) => normalizeRowField(a[field], field) === normalizeRowField(b[field], field));
}

const REPORT_UNSAVED_MESSAGE = 'هناك تعديلات لم يتم حفظها بعد. احفظ التغييرات أولاً أو تابع للمغادرة دون حفظ.';
const REPORT_UNSAVED_CLASS = 'report-unsaved';
let reportHasUnsavedChanges = false;
let reportGuardInitialized = false;
let reportUnsavedDialogElement = null;
let reportUnsavedDialogStyleInjected = false;

function ensureReportUnsavedStyle() {
  try {
    if (document.getElementById('report-unsaved-style')) return;
    const style = document.createElement('style');
    style.id = 'report-unsaved-style';
    style.textContent = `body.${REPORT_UNSAVED_CLASS} #saveBtn { background-color: #ea580c !important; border-color: #c2410c !important; color: #fff !important; box-shadow: 0 0 0 3px rgba(234,88,12,0.2); }
body.${REPORT_UNSAVED_CLASS} #saveBtn:hover { filter: brightness(1.05); }`;
    document.head.appendChild(style);
  } catch (_) {}
}

function reportShouldWarn() {
  return reportHasUnsavedChanges;
}

function updateReportUnsavedIndicator() {
  try {
    if (reportHasUnsavedChanges) {
      document.body.classList.add(REPORT_UNSAVED_CLASS);
    } else {
      document.body.classList.remove(REPORT_UNSAVED_CLASS);
    }
  } catch (_) {}
}

function markReportDirty() {
  if (reportHasUnsavedChanges) {
    stopAutoRefresh();
    return;
  }
  reportHasUnsavedChanges = true;
  stopAutoRefresh();
  updateReportUnsavedIndicator();
  try {
    if (saveStatus) {
      saveStatus.textContent = '⚠️ هناك تعديلات غير محفوظة';
    }
  } catch (_) {}
}

function clearReportDirty() {
  reportHasUnsavedChanges = false;
  updateReportUnsavedIndicator();
  if (!autoRefreshTimerId) {
    startAutoRefresh();
  }
}

function injectReportUnsavedDialogStyles() {
  if (reportUnsavedDialogStyleInjected) return;
  try {
    const style = document.createElement('style');
    style.id = 'report-unsaved-exit-style';
    style.textContent = `.unsaved-exit-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;backdrop-filter:blur(2px);} 
.unsaved-exit-overlay.open{display:flex;} 
.unsaved-exit-overlay[data-loading="true"] .unsaved-exit-btn{pointer-events:none;opacity:0.65;} 
.unsaved-exit-modal{background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 24px 56px rgba(15,23,42,0.25);padding:24px 28px;width:min(92vw,420px);max-width:420px;font-family:inherit;} 
.unsaved-exit-modal h2{margin:0 0 12px;font-size:1.35rem;font-weight:700;color:#0f172a;} 
.unsaved-exit-message{margin:0 0 18px;font-size:1rem;line-height:1.7;} 
.unsaved-exit-error{min-height:1.25em;margin:0 0 12px;font-size:0.95rem;color:#dc2626;} 
.unsaved-exit-actions{display:flex;flex-direction:column;gap:10px;} 
.unsaved-exit-btn{font-family:inherit;font-size:1rem;font-weight:600;border-radius:10px;padding:12px 16px;border:0;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;background:#e2e8f0;color:#0f172a;box-shadow:0 6px 16px rgba(15,23,42,0.12);} 
.unsaved-exit-btn.primary{background:#2563eb;color:#fff;box-shadow:0 10px 24px rgba(37,99,235,0.25);} 
.unsaved-exit-btn.primary:hover{background:#1d4ed8;} 
.unsaved-exit-btn.secondary{background:#f8fafc;color:#0f172a;} 
.unsaved-exit-btn.secondary:hover{background:#e2e8f0;} 
.unsaved-exit-btn.ghost{background:#fff;color:#0f172a;border:1px solid #cbd5f5;box-shadow:none;} 
.unsaved-exit-btn.ghost:hover{background:#f8fafc;} 
.unsaved-exit-btn:focus-visible{outline:3px solid rgba(37,99,235,0.45);outline-offset:2px;} 
@media (min-width:480px){.unsaved-exit-actions{flex-direction:row;}.unsaved-exit-btn{flex:1;}}
`;
    document.head.appendChild(style);
    reportUnsavedDialogStyleInjected = true;
  } catch (_) {}
}

function ensureReportUnsavedDialog() {
  if (reportUnsavedDialogElement && document.body.contains(reportUnsavedDialogElement)) {
    return reportUnsavedDialogElement;
  }
  injectReportUnsavedDialogStyles();
  const overlay = document.createElement('div');
  overlay.id = 'reportUnsavedDialog';
  overlay.className = 'unsaved-exit-overlay';
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="unsaved-exit-modal" role="dialog" aria-modal="true" aria-labelledby="report-unsaved-title">
      <h2 id="report-unsaved-title">تأكيد الخروج</h2>
      <p class="unsaved-exit-message"></p>
      <div class="unsaved-exit-error" role="alert"></div>
      <div class="unsaved-exit-actions" dir="rtl">
        <button type="button" class="unsaved-exit-btn primary" data-action="save">💾 خروج مع الحفظ</button>
      <button type="button" class="unsaved-exit-btn secondary" data-action="discard">🚪 خروج من غير حفظ</button>
        <button type="button" class="unsaved-exit-btn ghost" data-action="stay">↩️ رجوع</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  reportUnsavedDialogElement = overlay;
  return overlay;
}

function showReportUnsavedDialog({ message = REPORT_UNSAVED_MESSAGE, onSave, checkDirty } = {}) {
  const overlay = ensureReportUnsavedDialog();
  const messageEl = overlay.querySelector('.unsaved-exit-message');
  const errorEl = overlay.querySelector('.unsaved-exit-error');
  const saveBtn = overlay.querySelector('button[data-action="save"]');
  const discardBtn = overlay.querySelector('button[data-action="discard"]');
  const stayBtn = overlay.querySelector('button[data-action="stay"]');
  const defaultSaveLabel = '💾 خروج مع الحفظ';
  const defaultDiscardLabel = '🚪 خروج من غير حفظ';
  const defaultStayLabel = '↩️ رجوع';

  messageEl.textContent = message;
  errorEl.textContent = '';
  overlay.dataset.loading = 'false';
  saveBtn.textContent = defaultSaveLabel;
  discardBtn.textContent = defaultDiscardLabel;
  stayBtn.textContent = defaultStayLabel;
  saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = false;

  overlay.classList.add('open');
  try { overlay.focus({ preventScroll: true }); } catch (_) { try { overlay.focus(); } catch {} }

  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const cleanup = (result) => {
      if (resolved) return;
      resolved = true;
      overlay.classList.remove('open');
      overlay.dataset.loading = 'false';
      errorEl.textContent = '';
      saveBtn.textContent = defaultSaveLabel;
      discardBtn.textContent = defaultDiscardLabel;
      stayBtn.textContent = defaultStayLabel;
      saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = false;
      overlay.removeEventListener('keydown', keyHandler);
      overlay.removeEventListener('click', outsideHandler);
      saveBtn.onclick = discardBtn.onclick = stayBtn.onclick = null;
      if (previousFocus && typeof previousFocus.focus === 'function') {
        setTimeout(() => {
          try { previousFocus.focus(); } catch (_) {}
        }, 40);
      }
      resolve(result);
    };

    const keyHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup('stay');
      }
    };

    const outsideHandler = (event) => {
      if (event.target === overlay) {
        event.preventDefault();
        cleanup('stay');
      }
    };

    saveBtn.onclick = async () => {
      errorEl.textContent = '';
      if (typeof onSave === 'function') {
        overlay.dataset.loading = 'true';
        saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = true;
        saveBtn.textContent = '💾 جاري الحفظ...';
        try {
          const outcome = await onSave();
          const stillDirty = typeof checkDirty === 'function' ? checkDirty() : false;
          if (outcome === false || stillDirty) {
            throw new Error('SAVE_UNCONFIRMED');
          }
          cleanup('save');
          return;
        } catch (error) {
          const msg = (error && error.message && error.message !== 'SAVE_UNCONFIRMED')
            ? error.message
            : 'تعذر الحفظ. حاول مرة أخرى.';
          errorEl.textContent = msg;
          overlay.dataset.loading = 'false';
          saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = false;
          saveBtn.textContent = defaultSaveLabel;
          return;
        }
      }
      cleanup('save');
    };

    discardBtn.onclick = () => cleanup('discard');
    stayBtn.onclick = () => cleanup('stay');

    overlay.addEventListener('keydown', keyHandler);
    overlay.addEventListener('click', outsideHandler);

    setTimeout(() => {
      try { saveBtn.focus({ preventScroll: true }); } catch (_) { try { saveBtn.focus(); } catch {} }
    }, 30);
  });
}

let duplicateRowDialogEl = null;
let duplicateRowDialogStyleInjected = false;

function ensureDuplicateRowDialogStyles() {
  if (duplicateRowDialogStyleInjected) return;
  duplicateRowDialogStyleInjected = true;
  try {
    const style = document.createElement('style');
    style.id = 'duplicate-row-dialog-style';
  style.textContent = `.duplicate-row-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);display:none;align-items:center;justify-content:center;z-index:11000;padding:18px;backdrop-filter:blur(3px);} 
.duplicate-row-overlay.open{display:flex;} 
.duplicate-row-modal{background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 22px 52px rgba(15,23,42,0.28);padding:28px 36px;width:min(98vw,1240px);max-width:1240px;font-family:inherit;} 
.duplicate-row-modal h2{margin:0 0 14px;font-size:1.28rem;font-weight:700;} 
.duplicate-row-message{margin:0 0 16px;font-size:1rem;line-height:1.6;} 
.duplicate-row-details{margin:0 0 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;max-height:52vh;overflow:auto;} 
.duplicate-row-details table{width:100%;min-width:860px;border-collapse:separate;border-spacing:0;font-size:0.94rem;table-layout:fixed;} 
.duplicate-row-details thead th{background:#e2e8f0;text-align:center;padding:10px;border-bottom:1px solid #d8dee9;font-weight:700;color:#0f172a;} 
.duplicate-row-details tbody th{background:#e2e8f0;text-align:center;padding:10px;border-bottom:1px solid #d8dee9;font-weight:600;color:#0f172a;white-space:nowrap;} 
.duplicate-row-details td{padding:10px;border-bottom:1px solid #eceff5;color:#0f172a;text-align:center;word-break:break-word;} 
.duplicate-row-details tbody tr + tr td,.duplicate-row-details tbody tr + tr th{border-top:4px solid #1e293b;} 
.duplicate-row-details tbody tr:last-child td,.duplicate-row-details tbody tr:last-child th{border-bottom:none;} 
.duplicate-row-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;} 
.duplicate-row-btn{font-family:inherit;font-size:1rem;font-weight:600;border-radius:10px;padding:10px 18px;border:none;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;} 
.duplicate-row-btn.primary{background:#2563eb;color:#fff;box-shadow:0 10px 24px rgba(37,99,235,0.25);} 
.duplicate-row-btn.primary:hover{background:#1d4ed8;} 
.duplicate-row-btn.secondary{background:#e2e8f0;color:#0f172a;} 
.duplicate-row-btn.secondary:hover{background:#cbd5f5;} 
.duplicate-row-btn:focus-visible{outline:3px solid rgba(37,99,235,0.45);outline-offset:2px;}`;
    document.head.appendChild(style);
  } catch (_) {}
}

function ensureDuplicateRowDialog() {
  if (duplicateRowDialogEl && document.body.contains(duplicateRowDialogEl)) {
    return duplicateRowDialogEl;
  }
  ensureDuplicateRowDialogStyles();
  const overlay = document.createElement('div');
  overlay.id = 'duplicateRowDialog';
  overlay.className = 'duplicate-row-overlay';
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="duplicate-row-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-row-title">
      <h2 id="duplicate-row-title">تكرار كامل</h2>
      <p class="duplicate-row-message"></p>
      <div class="duplicate-row-details" dir="rtl"></div>
      <div class="duplicate-row-actions">
        <button type="button" class="duplicate-row-btn primary" data-action="confirm">إضافة على أي حال</button>
        <button type="button" class="duplicate-row-btn secondary" data-action="cancel">إلغاء الإضافة</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  duplicateRowDialogEl = overlay;
  return overlay;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderDuplicateRowDetails(container, existingRow, pendingRow) {
  if (!container) return;
  const row = existingRow || {};
  const sectorKey = normalizeSectorKey(row.sector || '');
  const sectorLabel = sectorKey && REPORT_SECTOR_KEY_TO_LABEL[sectorKey] ? REPORT_SECTOR_KEY_TO_LABEL[sectorKey] : (row.sector || '');
  const pending = pendingRow || {};
  const pendingSectorKey = normalizeSectorKey(pending.sector || '');
  const pendingSectorLabel = pendingSectorKey && REPORT_SECTOR_KEY_TO_LABEL[pendingSectorKey] ? REPORT_SECTOR_KEY_TO_LABEL[pendingSectorKey] : (pending.sector || '');
  const fields = [
    { key: 'date', label: 'تاريخ القرار' },
    { key: 'name', label: 'الاسم' },
    { key: 'job', label: 'الوظيفة' },
    { key: 'license', label: 'نوع الترخيص' },
    { key: 'weapon', label: 'نوع السلاح' },
    { key: 'purpose', label: 'الغرض' },
    { key: 'sector', label: 'القطاع' },
    { key: 'police', label: 'قسم الشرطة' },
  ];
  getDecisionFieldsForDataset().forEach((key) => {
    fields.push({ key, label: getDecisionLabel(key) });
  });
  fields.push({ key: 'recommendation', label: 'توصية' });

  const formatValue = (value) => {
    if (!value) return '—';
    return escapeHtml(toArabicNumbers(String(value)));
  };
  const existingValues = {
    ...row,
    date: row.date ? toArabicNumbers(toEnglishNumbers(row.date)) : row.date,
    sector: sectorLabel
  };
  const pendingValues = {
    ...pending,
    date: pending.date ? toArabicNumbers(toEnglishNumbers(pending.date)) : pending.date,
    sector: pendingSectorLabel
  };
  const headerCells = [`<th scope="col">السجل</th>`].concat(fields.map((field) => `<th scope="col">${escapeHtml(field.label)}</th>`)).join('');
  const existingRowHtml = `<tr><th scope="row">المحفوظ</th>${fields.map((field) => `<td>${formatValue(existingValues[field.key])}</td>`).join('')}</tr>`;
  const pendingRowHtml = `<tr><th scope="row">الجديد</th>${fields.map((field) => `<td>${formatValue(pendingValues[field.key])}</td>`).join('')}</tr>`;
  const tableBody = existingRowHtml + pendingRowHtml;
  container.innerHTML = `<table dir="rtl" aria-label="تفاصيل السجل المتكرر"><thead><tr>${headerCells}</tr></thead><tbody>${tableBody}</tbody></table>`;
}

function showDuplicateRowDialog({ existingRow, pendingRow }) {
  const overlay = ensureDuplicateRowDialog();
  const messageEl = overlay.querySelector('.duplicate-row-message');
  const detailsEl = overlay.querySelector('.duplicate-row-details');
  const confirmBtn = overlay.querySelector('button[data-action="confirm"]');
  const cancelBtn = overlay.querySelector('button[data-action="cancel"]');
  messageEl.textContent = 'يوجد سجل بنفس البيانات المدخلة.';
  renderDuplicateRowDetails(detailsEl, existingRow, pendingRow);
  overlay.classList.add('open');
  try { overlay.focus({ preventScroll: true }); } catch (_) { try { overlay.focus(); } catch {} }

  return new Promise((resolve) => {
    let resolved = false;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const cleanup = (result) => {
      if (resolved) return;
      resolved = true;
      overlay.classList.remove('open');
      overlay.removeEventListener('click', outsideHandler);
      overlay.removeEventListener('keydown', keyHandler);
      confirmBtn.onclick = cancelBtn.onclick = null;
      if (previousActive && typeof previousActive.focus === 'function') {
        setTimeout(() => {
          try { previousActive.focus(); } catch (_) {}
        }, 50);
      }
      resolve(result);
    };

    const keyHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup('cancel');
      }
    };

    const outsideHandler = (event) => {
      if (event.target === overlay) {
        event.preventDefault();
        cleanup('cancel');
      }
    };

    confirmBtn.onclick = () => cleanup('confirm');
    cancelBtn.onclick = () => cleanup('cancel');

    overlay.addEventListener('keydown', keyHandler);
    overlay.addEventListener('click', outsideHandler);

    setTimeout(() => {
      try { confirmBtn.focus({ preventScroll: true }); } catch (_) { try { confirmBtn.focus(); } catch {} }
    }, 30);
  });
}

async function confirmReportNavigation(options = {}) {
  if (!reportShouldWarn()) return true;
  const { message = REPORT_UNSAVED_MESSAGE, onSave } = options || {};
  const result = await showReportUnsavedDialog({
    message,
    onSave: typeof onSave === 'function' ? onSave : undefined,
    checkDirty: () => reportShouldWarn(),
  });

  if (result === 'save' || result === 'discard') {
    clearReportDirty();
    return true;
  }
  return false;
}

function handleReportBeforeUnload(event) {
  stopAutoRefresh();
  if (!reportShouldWarn()) return;
  event.preventDefault();
  event.returnValue = REPORT_UNSAVED_MESSAGE;
  return REPORT_UNSAVED_MESSAGE;
}

function enableReportUnsavedGuards() {
  if (reportGuardInitialized) return;
  reportGuardInitialized = true;
  ensureReportUnsavedStyle();
  updateReportUnsavedIndicator();
  try {
    window.addEventListener('beforeunload', handleReportBeforeUnload);
  } catch (_) {}
}

function getDatasetLabel(key) {
  const match = DATASET_OPTIONS.find((opt) => opt.key === key);
  return match ? match.label : key;
}

function getDatasetSortRank(key) {
  const index = DATASET_GROUP_ORDER.indexOf(String(key || ''));
  return index === -1 ? DATASET_GROUP_ORDER.length : index;
}

function getRowDatasetKey(row) {
  return String(row?.__dataset || (isAllDatasetMode() ? '' : currentDataset) || '').trim();
}

function isAggregateRowReadOnly() {
  return isAllDatasetMode();
}

function updateDatasetSliderActive(activeKey) {
  const allActive = isAllDatasetMode(activeKey);
  datasetSliderButtons.forEach((btn) => {
    const isActive = btn.dataset.dataset === activeKey;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('muted-by-all', allActive && !isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateDecisionColumnsVisibility() {
  document.body.classList.toggle('single-decision', !isSplitDecisionDataset());
}

function updateDecisionHeaderLabel() {
  const thManager = document.querySelector('th.col-decision-manager');
  const thPublic = document.querySelector('th.col-decision-public');
  if (!thManager || !thPublic) return;
  if (isSplitDecisionDataset()) {
    thManager.textContent = 'مدير الامن';
    thPublic.textContent = 'امن العام';
  } else {
    thManager.textContent = 'القرار';
    thPublic.textContent = 'امن العام';
  }
}

function updateDatasetModeControls() {
  const aggregate = isAllDatasetMode();
  document.body.classList.toggle('report-all-dataset-mode', aggregate);
  const addBtn = document.getElementById('addRowBtn');
  const saveBtn = document.getElementById('saveBtn');
  const scanBtn = document.getElementById('ocrScanOpenBtn');
  if (addBtn) {
    addBtn.disabled = aggregate;
    addBtn.title = aggregate ? 'اختر مصدر بيانات محدد للإضافة.' : '';
  }
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.title = aggregate ? 'حفظ كل مصدر بيانات في ملفه الأصلي.' : '';
  }
  if (scanBtn) {
    scanBtn.disabled = aggregate;
    scanBtn.title = aggregate ? 'اختر مصدر بيانات محدد لفحص المرفقات.' : '';
  }
  if (aggregate) {
    if (addMode) setAddMode(false);
  }
  updateDeleteButton();
  updateSelectAllCheckbox();
}

async function switchDataset(nextKey, options = {}) {
  const { bypassDirtyCheck = false } = options || {};
  if (addMode) setAddMode(false);
  const candidate = DATASET_OPTIONS.some((opt) => opt.key === nextKey) ? nextKey : DATASET_OPTIONS[0]?.key;
  if (!candidate || candidate === currentDataset) {
    updateDatasetSliderActive(currentDataset);
    return;
  }

  if (reportShouldWarn() && !bypassDirtyCheck) {
    const proceed = await confirmReportNavigation({
      message: 'هناك تغييرات غير محفوظة. هل تريد حفظها قبل تغيير المصدر؟',
      onSave: async () => {
        await save();
        return !reportShouldWarn();
      }
    });
    if (!proceed) {
      updateDatasetSliderActive(currentDataset);
      return;
    }
  } else if (reportShouldWarn() && bypassDirtyCheck) {
    clearReportDirty();
  }

  stopAutoRefresh();
  currentDataset = candidate;
  try { localStorage.setItem(DATASET_STORAGE_KEY, currentDataset); } catch (_) {}
  lastRowsSignature = null;
  lastRowsVersion = null;
  selectedRows.clear();
  rows = [];
  currentViewRows = [];
  pagination.page = 1;
  pagination.totalPages = 1;
  updateDatasetModeControls();
  restrictSectorFilterToPortalUser();
  render();
  if (saveStatus) {
    const label = getDatasetLabel(currentDataset);
    saveStatus.textContent = `يتم تحميل بيانات ${label}...`;
  }
  await load(true);
  startAutoRefresh();
  updateDatasetSliderActive(currentDataset);
  updateDatasetModeControls();
  updateDecisionColumnsVisibility();
  updateDecisionHeaderLabel();
  populateReportSearchColumns();
  if (saveStatus) {
    const label = getDatasetLabel(currentDataset);
    saveStatus.textContent = `تم تحميل بيانات ${label}`;
  }
}

function buildApiUrl(path, params = {}) {
  const rawPath = String(path || '');
  const normalizedPath = rawPath.startsWith('/api/report')
    ? rawPath
    : (rawPath.startsWith('/api/') ? `/api/report${rawPath.slice(4)}` : rawPath);
  const baseOrigin = API_BASE || window.location.origin;
  const url = new URL(normalizedPath, baseOrigin);
  const searchParams = new URLSearchParams(url.search);
  if (!Object.prototype.hasOwnProperty.call(params, 'dataset')) {
    searchParams.set('dataset', currentDataset);
  }
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    searchParams.set(key, value);
  });
  url.search = searchParams.toString();
  const absolute = url.toString();
  if (!API_BASE && absolute.startsWith(window.location.origin)) {
    return absolute.slice(window.location.origin.length);
  }
  return absolute;
}

function readDeleteApprovalInspectTarget() {
  try {
    const raw = sessionStorage.getItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY);
    if (!raw) return null;
    const target = JSON.parse(raw);
    return target && target.programKey === 'report' ? target : null;
  } catch (_) {
    return null;
  }
}

function clearDeleteApprovalInspectTarget() {
  try { sessionStorage.removeItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY); } catch (_) {}
}

async function applyDeleteApprovalInspectTarget() {
  const target = readDeleteApprovalInspectTarget();
  if (!target) return false;
  const targetDataset = String(target.dataset || '').trim();
  if (
    targetDataset
    && targetDataset !== currentDataset
    && DATASET_OPTIONS.some((option) => option.key === targetDataset)
  ) {
    await switchDataset(targetDataset, { bypassDirtyCheck: true });
  }
  const decisionInput = document.getElementById('filterId');
  const searchInput = document.getElementById('filterName');
  const searchColumn = document.getElementById('filterSearchColumn');
  if (decisionInput) decisionInput.value = target.recordNumber || target.license || '';
  if (searchInput) searchInput.value = target.name || '';
  if (searchColumn) searchColumn.value = '__all__';
  pagination.page = 1;
  render();
  clearDeleteApprovalInspectTarget();
  return true;
}
try { window.applyDeleteApprovalInspectTarget = applyDeleteApprovalInspectTarget; } catch (_) {}

function normalizeReportSettings(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return { ocrEnabled: raw.ocrEnabled !== false };
}

function isReportOcrEnabled() {
  return reportSettings.ocrEnabled !== false;
}

function applyReportSettings(nextSettings) {
  reportSettings = normalizeReportSettings(nextSettings);
  document.body.classList.toggle('ocr-disabled', !isReportOcrEnabled());
  const toggle = document.getElementById('reportOcrToggle');
  if (toggle) toggle.checked = isReportOcrEnabled();
  if (!isReportOcrEnabled()) {
    const scanModal = document.getElementById('ocrScanModal');
    const resultsModal = document.getElementById('ocrResultsModal');
    const searchContent = document.getElementById('ocrSearchContent');
    if (scanModal) scanModal.hidden = true;
    if (resultsModal) resultsModal.hidden = true;
    if (searchContent) searchContent.hidden = true;
  }
}

async function loadReportSettings() {
  try {
    const res = await fetch(buildApiUrl('/api/settings', { _: Date.now() }), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    applyReportSettings(json.settings || {});
    return true;
  } catch (error) {
    console.warn('Report settings load failed:', error);
    applyReportSettings(reportSettings);
    return false;
  }
}

async function saveReportSettings(nextSettings) {
  const normalized = normalizeReportSettings(nextSettings);
  const res = await fetch(buildApiUrl('/api/settings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: normalized }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  applyReportSettings(json.settings || normalized);
  return reportSettings;
}

function toggleReportSettingsSidebar(forceOpen) {
  const sidebar = document.getElementById('reportSettingsSidebar');
  if (!sidebar) return;
  const willOpen = typeof forceOpen === 'boolean' ? forceOpen : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', willOpen);
  sidebar.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
}

function initReportSettingsUi() {
  const openBtn = document.getElementById('reportSettingsToggle');
  const closeBtn = document.getElementById('reportSettingsClose');
  const toggle = document.getElementById('reportOcrToggle');
  const status = document.getElementById('reportSettingsStatus');
  openBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    toggleReportSettingsSidebar();
  });
  closeBtn?.addEventListener('click', () => toggleReportSettingsSidebar(false));
  toggle?.addEventListener('change', async () => {
    toggle.disabled = true;
    if (status) status.textContent = 'جاري الحفظ...';
    try {
      await saveReportSettings({ ...reportSettings, ocrEnabled: toggle.checked });
      if (status) status.textContent = 'تم الحفظ';
    } catch (error) {
      toggle.checked = isReportOcrEnabled();
      if (status) status.textContent = `تعذر الحفظ: ${error.message}`;
    } finally {
      toggle.disabled = false;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') toggleReportSettingsSidebar(false);
  });
  applyReportSettings(reportSettings);
}

function getReportTextIndexKey(decisionNumber, name) {
  return `${toEnglishNumbers(String(decisionNumber || '').trim())}\u001f${String(name || '').trim()}`;
}

function getReportTextIndexKeyForRow(row, rowIndex) {
  const decisionNumber = getDecisionNumberDisplay(row, rowIndex) || getDecisionNumberValue(row) || row?.id || '';
  return getReportTextIndexKey(decisionNumber, row?.name || '');
}

function applyReportTextIndexEntries(entries) {
  reportTextIndexByKey = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = getReportTextIndexKey(entry.decisionNumber, entry.name);
    reportTextIndexByKey.set(key, {
      text: entry.text || '',
      fileName: entry.fileName || '',
    });
  });

  rows.forEach((row, rowIndex) => {
    const entry = reportTextIndexByKey.get(getReportTextIndexKeyForRow(row, rowIndex));
    row._textIndexText = entry ? entry.text : '';
    row._textIndexFileName = entry ? entry.fileName : '';
  });
}

async function fetchReportTextIndexEntries(datasetKey = currentDataset) {
  try {
    const res = await fetch(buildApiUrl('/api/text-index', { dataset: datasetKey, _: Date.now() }), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (Array.isArray(json.entries) ? json.entries : []).map((entry) => ({
      ...entry,
      dataset: json.dataset || datasetKey
    }));
  } catch (error) {
    console.warn('Report text index load failed:', datasetKey, error);
    return [];
  }
}

async function refreshReportTextIndexEntries() {
  const entries = await fetchReportTextIndexEntries(currentDataset);
  applyReportTextIndexEntries(entries);
  return true;
}

async function refreshAllDatasetTextIndexEntries() {
  const entryGroups = await Promise.all(getConcreteDatasetKeys().map((datasetKey) => fetchReportTextIndexEntries(datasetKey)));
  applyReportTextIndexEntries(entryGroups.flat());
  return true;
}

async function saveReportTextIndexForRow(rowIndex, text, options = {}) {
  const row = rows[rowIndex];
  if (!row) throw new Error('Row not found');
  const decisionNumber = getDecisionNumberDisplay(row, rowIndex) || getDecisionNumberValue(row) || row.id || '';
  const res = await fetch(buildApiUrl('/api/text-index', { dataset: getRowDatasetKey(row) || currentDataset }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decisionNumber,
      name: row.name || '',
      text: String(text || ''),
      previousFileName: options.previousFileName || row._textIndexFileName || '',
    })
  });
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json || !json.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  row._textIndexText = json.text || '';
  row._textIndexFileName = json.fileName || '';
  const key = getReportTextIndexKeyForRow(row, rowIndex);
  if (row._textIndexText) {
    reportTextIndexByKey.set(key, { text: row._textIndexText, fileName: row._textIndexFileName });
  } else {
    reportTextIndexByKey.delete(key);
  }
  return json;
}

async function probeDatasetRows(datasetKey) {
  try {
    const res = await fetch(buildApiUrl('/api/data', { dataset: datasetKey, _: Date.now(), probe: '1' }), { cache: 'no-store' });
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    return Array.isArray(json.rows) ? json.rows : [];
  } catch (error) {
    console.warn('فشل فحص مصدر البيانات', datasetKey, error);
    return null;
  }
}

async function fetchRowsVersion() {
  try {
    const res = await fetch(buildApiUrl('/api/data-version', { _: Date.now() }), { cache: 'no-store' });
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload || payload.ok === false || !payload.version) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function ensurePdfLibLoaded() {
  if (window.PDFLib && window.PDFLib.PDFDocument) {
    return Promise.resolve(window.PDFLib);
  }
  if (pdfLibLoadPromise) return pdfLibLoadPromise;

  pdfLibLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = typeof window.resolvePlatformAsset === 'function'
      ? window.resolvePlatformAsset('vendor/pdf-lib.min.js')
      : './vendor/pdf-lib.min.js';
    script.async = true;
    script.dataset.pdfLibLoader = '1';
    script.onload = () => {
      if (window.PDFLib && window.PDFLib.PDFDocument) {
        resolve(window.PDFLib);
      } else {
        pdfLibLoadPromise = null;
        reject(new Error('PDF library loaded without PDFDocument'));
      }
    };
    script.onerror = () => {
      pdfLibLoadPromise = null;
      reject(new Error('Failed to load PDF library'));
    };
    document.head.appendChild(script);
  });

  return pdfLibLoadPromise;
}

async function findDatasetWithData() {
  const candidates = getConcreteDatasetOptions().map((opt) => opt.key).filter((key) => key !== currentDataset);
  for (const key of candidates) {
    const rows = await probeDatasetRows(key);
    if (Array.isArray(rows) && rows.length) {
      return key;
    }
  }
  return null;
}

async function autoSwitchToDatasetWithDataIfNeeded() {
  if (datasetAutoDetectAttempted || datasetRestoredFromStorage) {
    return false;
  }
  datasetAutoDetectAttempted = true;
  const fallbackKey = await findDatasetWithData();
  if (fallbackKey && fallbackKey !== currentDataset) {
    await switchDataset(fallbackKey, { bypassDirtyCheck: true });
    return true;
  }
  if (!rows.length && saveStatus) {
    saveStatus.textContent = 'لا توجد سجلات في أي مصدر بيانات. استخدم زر الإضافة أو استورد ملف CSV لتعبئة البيانات.';
  }
  return false;
}

const GENERAL_TOKEN_KEY = 'general.auth.token';
const GENERAL_USER_KEY = 'general.auth.user';
const PORTAL_ADMIN_SECTOR_LABEL = '\u0627\u0644\u0625\u062f\u0627\u0631\u0629';
const REPORT_LEGACY_SECTOR_KEY_TO_LABEL = {
  east: 'شرق',
  west: 'غرب',
  south: 'جنوب',
  north: 'شمال',
  sectorfive: 'القطاع التجريبي الخامس'
};
const REPORT_LEGACY_SECTOR_LABEL_TO_KEY = Object.fromEntries(
  Object.entries(REPORT_LEGACY_SECTOR_KEY_TO_LABEL).map(([key, label]) => [label, key])
);
const REPORT_SHARED_SECTOR_LABEL_TO_KEY = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorLabelToKeyMap === 'function'
  ? SHARED_REFERENCE_DATA.getSectorLabelToKeyMap()
  : {};
const REPORT_SHARED_SECTOR_KEY_TO_LABEL = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorKeyToLabelMap === 'function'
  ? SHARED_REFERENCE_DATA.getSectorKeyToLabelMap()
  : {};
const PORTAL_SECTOR_LABEL_TO_REPORT_KEY = Object.assign(
  {},
  REPORT_SHARED_SECTOR_LABEL_TO_KEY,
  REPORT_LEGACY_SECTOR_LABEL_TO_KEY,
  {
    'وحده الشرطة': 'police_unit',
    'وحده قوات مسلحة': 'army_unit'
  }
);
const ALL_REPORT_SECTOR_KEYS = Array.from(new Set(Object.values(PORTAL_SECTOR_LABEL_TO_REPORT_KEY)));
const REPORT_SECTOR_KEY_TO_LABEL = Object.assign(
  {},
  REPORT_SHARED_SECTOR_KEY_TO_LABEL,
  REPORT_LEGACY_SECTOR_KEY_TO_LABEL,
  {
    police_unit: 'وحده الشرطة',
    army_unit: 'وحده قوات مسلحة'
  }
);
const REPORT_SHARED_SECTOR_KEY_TO_REPORT_KEY = Object.fromEntries(
  Object.entries(REPORT_SHARED_SECTOR_KEY_TO_LABEL).map(([key, label]) => [
    key,
    PORTAL_SECTOR_LABEL_TO_REPORT_KEY[label] || key
  ])
);
const STATION_ALL_KEYWORDS = new Set(['all', 'كل', 'الكل', 'جميع الأقسام', 'جميع الاقسام', 'كافة الأقسام', 'كافة الاقسام']);

function resolveReportSectorKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === 'police_unit' || raw === 'army_unit') return raw;
  if (REPORT_SECTOR_KEY_TO_LABEL[raw]) {
    const label = REPORT_SECTOR_KEY_TO_LABEL[raw];
    return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[label] || raw;
  }
  if (PORTAL_SECTOR_LABEL_TO_REPORT_KEY[raw]) return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[raw];
  if (REPORT_SHARED_SECTOR_KEY_TO_REPORT_KEY[raw]) return REPORT_SHARED_SECTOR_KEY_TO_REPORT_KEY[raw];
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveSectorLabel === 'function') {
    const label = SHARED_REFERENCE_DATA.resolveSectorLabel(raw);
    if (label && PORTAL_SECTOR_LABEL_TO_REPORT_KEY[label]) {
      return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[label];
    }
  }
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveSectorKey === 'function') {
    const sharedKey = SHARED_REFERENCE_DATA.resolveSectorKey(raw);
    if (sharedKey) {
      return REPORT_SHARED_SECTOR_KEY_TO_REPORT_KEY[sharedKey] || sharedKey;
    }
  }
  return '';
}

function isAllStationsToken(value) {
  if (value == null) return false;
  const normalized = String(value).trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return STATION_ALL_KEYWORDS.has(normalized) || STATION_ALL_KEYWORDS.has(lower);
}

function normalizePortalStationList(raw, allowedStations, sectorKey = '') {
  const fallback = { list: [], isAll: false };
  const allowed = Array.isArray(allowedStations)
    ? allowedStations.map((station) => normalizeStationName(station, sectorKey)).filter(Boolean)
    : [];
  if (!allowed.length) {
    if (typeof raw === 'string' && isAllStationsToken(raw)) {
      return { list: [], isAll: true };
    }
    if (Array.isArray(raw) && raw.some((value) => isAllStationsToken(value))) {
      return { list: [], isAll: true };
    }
    return fallback;
  }
  const allowedSet = new Set(allowed);
  if (typeof raw === 'string') {
    const token = normalizeStationName(raw, sectorKey);
    if (!token) return fallback;
    if (isAllStationsToken(token)) {
      return { list: allowed.slice(), isAll: true };
    }
    return allowedSet.has(token) ? { list: [token], isAll: false } : fallback;
  }
  if (Array.isArray(raw)) {
    const collected = [];
    const seen = new Set();
    for (const value of raw) {
      const token = normalizeStationName(value, sectorKey);
      if (!token) continue;
      if (isAllStationsToken(token)) {
        return { list: allowed.slice(), isAll: true };
      }
      if (!seen.has(token) && allowedSet.has(token)) {
        seen.add(token);
        collected.push(token);
      }
    }
    if (collected.length >= allowed.length) {
      return { list: allowed.slice(), isAll: true };
    }
    return { list: collected, isAll: false };
  }
  return fallback;
}

function extractStationAccessSource(user) {
  if (!user || typeof user !== 'object') return {};
  if (user.stationAccess && typeof user.stationAccess === 'object' && !Array.isArray(user.stationAccess)) {
    return user.stationAccess;
  }
  if (user.stations && typeof user.stations === 'object' && !Array.isArray(user.stations)) {
    return user.stations;
  }
  return {};
}

function determineSectorKeyFromValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalizedRaw = normalizeSectorKey(raw);
  if (ALL_REPORT_SECTOR_KEYS.includes(normalizedRaw)) return normalizedRaw;
  if (PORTAL_SECTOR_LABEL_TO_REPORT_KEY[raw]) return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[raw];
  const cleaned = raw.replace(/^قطاع\s+/u, '').trim();
  const normalizedCleaned = normalizeSectorKey(cleaned);
  if (ALL_REPORT_SECTOR_KEYS.includes(normalizedCleaned)) return normalizedCleaned;
  if (PORTAL_SECTOR_LABEL_TO_REPORT_KEY[cleaned]) return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[cleaned];
  const withoutArticle = cleaned.replace(/^ال/u, '');
  const normalizedWithoutArticle = normalizeSectorKey(withoutArticle);
  if (ALL_REPORT_SECTOR_KEYS.includes(normalizedWithoutArticle)) return normalizedWithoutArticle;
  if (PORTAL_SECTOR_LABEL_TO_REPORT_KEY[withoutArticle]) return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[withoutArticle];
  const parts = cleaned.split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const token = parts[i];
    const normalizedToken = normalizeSectorKey(token);
    if (ALL_REPORT_SECTOR_KEYS.includes(normalizedToken)) return normalizedToken;
    if (PORTAL_SECTOR_LABEL_TO_REPORT_KEY[token]) return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[token];
    const trimmed = token.replace(/^ال/u, '');
    const normalizedTrimmed = normalizeSectorKey(trimmed);
    if (ALL_REPORT_SECTOR_KEYS.includes(normalizedTrimmed)) return normalizedTrimmed;
    if (PORTAL_SECTOR_LABEL_TO_REPORT_KEY[trimmed]) return PORTAL_SECTOR_LABEL_TO_REPORT_KEY[trimmed];
  }
  return null;
}

let stationRestrictionCache = null;
let stationRestrictionCacheSignature = null;

function resetStationRestrictionCache() {
  stationRestrictionCache = null;
  stationRestrictionCacheSignature = null;
}

function getPortalUserProfile() {
  const raw = sessionStorage.getItem(GENERAL_USER_KEY) || localStorage.getItem(GENERAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse portal user for report app:', error);
    resetStationRestrictionCache();
    return null;
  }
}

function hasPortalAdminAccess(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;
  const sectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : (user.room ? [user.room] : []);
  return sectors.some((label) => label === PORTAL_ADMIN_SECTOR_LABEL);
}

function deriveAllowedReportSectorKeys(user) {
  if (!user) return [];
  const rawSectors = Array.isArray(user.sectors) && user.sectors.length
    ? user.sectors
    : (user.room ? [user.room] : []);
  const keys = rawSectors
    .map((label) => PORTAL_SECTOR_LABEL_TO_REPORT_KEY[label] || determineSectorKeyFromValue(label))
    .filter(Boolean);
  return Array.from(new Set(keys));
}

let rows = []; // {date, name, job, license, weapon, purpose, sector, police, decision, decisionManager, decisionPublic, recommendation} ; id computed
let selectedRows = new Set(); // Track selected row indices
let computedDecisionNumbers = []; // per-year numbering aligned with rows[] order
let availableYearsSignature = null;
let reportTextIndexByKey = new Map();
let reportSettings = { ocrEnabled: true };
const gridBody = document.getElementById('gridBody');
const addFoot = document.getElementById('addFoot');
const saveStatus = document.getElementById('saveStatus');
const visibleDecisionCount = document.getElementById('visibleDecisionCount');
const datasetSlider = document.getElementById('datasetSlider');
if (datasetSlider) {
  datasetSliderButtons = Array.from(datasetSlider.querySelectorAll('button[data-dataset]'));
  datasetSliderButtons.forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = btn.dataset.dataset;
      try {
        await switchDataset(key);
      } catch (error) {
        console.error('Dataset switch error:', error);
      }
    });
  });
}
const tableWrap = document.querySelector('.table-wrap');
// Pagination state
let pagination = { page: 1, size: 50, totalPages: 1 };
// Holds the rows currently rendered on the page (after filtering + paging)
let currentViewRows = [];
// If the page is opened directly via file://, target the local server explicitly
const API_BASE = (location.protocol === 'file:') ? 'http://127.0.0.1:3107' : '';

let autoRefreshTimerId = null;
let lastRowsSignature = null;
let lastRowsVersion = null;
let refreshInFlight = false;
let pendingExternalSaveRefresh = false;
let externalSaveRefreshTimerId = null;
let pdfLibLoadPromise = null;

// Add-mode state (draft row shown in table footer)
let addMode = false;
let addDraft = null;
let pendingAttachmentMoves = [];

enableReportUnsavedGuards();

function newDraftRow(){
  return { id: '', date: '', name: '', job: '', license: '', weapon: '', purpose: '', sector: '', police: '', decision: '', decisionManager: '', decisionPublic: '', recommendation: '' };
}

function normalizeServerRows(dataRows, datasetKey = currentDataset) {
  if (!Array.isArray(dataRows)) return [];
  const splitDecision = isSplitDecisionDataset(datasetKey);
  return dataRows.map((r, sourceIndex) => {
    let weapon = r.weapon || '';
    let purpose = r.purpose || '';
    if (!purpose && weapon && weapon.includes('،')) {
      const parts = weapon.split('،').map((s) => s.trim());
      if (parts.length >= 2) {
        weapon = parts[0];
        purpose = parts.slice(1).join('،');
      }
    }

    let sector = normalizeSectorKey(r.sector || '');
    if (!sector && r.police) {
      sector = detectSectorForStation(r.police) || '';
    }

    return {
      id: r.id || '',
      date: r.date || '',
      name: r.name || '',
      job: r.job || '',
      license: r.license || '',
      weapon,
      purpose,
      sector,
      police: r.police || '',
      decision: splitDecision ? (r.decisionManager || r.decisionPublic || r.decision || '') : (r.decision || ''),
      decisionManager: splitDecision ? (r.decisionManager || r.decision || '') : (r.decisionManager || ''),
      decisionPublic: splitDecision ? (r.decisionPublic || '') : (r.decisionPublic || ''),
      recommendation: r.recommendation || '',
      __dataset: datasetKey,
      __sourceIndex: sourceIndex,
    };
  });
}

function buildRowKey(row) {
  if (!row) return '';
  const datasetKey = getRowDatasetKey(row) || currentDataset;
  return getRowKeyFields(datasetKey).map((field) => normalizeRowField(row[field], field)).join('|');
}

function captureSelectionKeys() {
  if (!selectedRows || selectedRows.size === 0) return null;
  const captured = [];
  selectedRows.forEach((idx) => {
    const row = rows[idx];
    if (!row) return;
    captured.push({ key: buildRowKey(row), idx });
  });
  return captured.length ? captured : null;
}

function restoreSelectionKeys(snapshot) {
  if (!Array.isArray(snapshot) || !snapshot.length) {
    selectedRows = new Set();
    return;
  }
  const nextSelected = new Set();
  const claimed = new Set();
  snapshot.forEach(({ key, idx }) => {
    let matchIndex = -1;
    if (key) {
      matchIndex = rows.findIndex((row, rowIdx) => !claimed.has(rowIdx) && buildRowKey(row) === key);
    }
    if (matchIndex === -1 && Number.isInteger(idx) && idx >= 0 && idx < rows.length && !claimed.has(idx)) {
      matchIndex = idx;
    }
    if (matchIndex !== -1) {
      nextSelected.add(matchIndex);
      claimed.add(matchIndex);
    }
  });
  selectedRows = nextSelected;
}

function computeRowsSignature(rowList) {
  if (!Array.isArray(rowList) || rowList.length === 0) return '[]';
  return JSON.stringify(rowList.map(buildRowKey));
}

function isInlineEditingActive() {
  const active = document.activeElement;
  if (!active) return false;
  if (active.closest('#gridBody') || active.closest('#addFoot')) return true;
  if (active.isContentEditable) return true;
  const tag = active.tagName;
  if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) {
    if (active.closest('#grid') || active.closest('#addFoot')) return true;
  }
  return false;
}

// Utility functions for Arabic numbers and date formatting
function toArabicNumbers(str) {
  if (!str) return str;
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(str).replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
}

function toEnglishNumbers(str) {
  if (!str) return str;
  const arabicToEnglish = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return String(str).replace(/[٠-٩]/g, (digit) => arabicToEnglish[digit] || digit);
}

function formatDateToYYYYMMDD(dateStr) {
  if (!dateStr) return '';
  
  // Convert Arabic numbers to English first
  const englishDate = toEnglishNumbers(dateStr.trim());
  
  // Handle various date formats and convert to yyyy/mm/dd
  let formattedDate = '';
  
  // Check if already in yyyy/mm/dd or yyyy-mm-dd format
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(englishDate)) {
    const parts = englishDate.split(/[\/\-]/);
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    formattedDate = `${year}/${month}/${day}`;
  }
  // Handle dd/mm/yyyy or dd-mm-yyyy format
  else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(englishDate)) {
    const parts = englishDate.split(/[\/\-]/);
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    formattedDate = `${year}/${month}/${day}`;
  }
  // Handle mm/dd/yyyy or mm-dd-yyyy format
  else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(englishDate)) {
    // This is ambiguous, but we'll assume dd/mm/yyyy (more common in Arabic regions)
    const parts = englishDate.split(/[\/\-]/);
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    formattedDate = `${year}/${month}/${day}`;
  }
  // If it's just numbers without separators (ddmmyyyy or yyyymmdd)
  else if (/^\d{8}$/.test(englishDate)) {
    // Assume yyyymmdd if first 4 digits look like a year (19xx or 20xx)
    if (englishDate.substring(0, 4).match(/^(19|20)\d{2}$/)) {
      const year = englishDate.substring(0, 4);
      const month = englishDate.substring(4, 6);
      const day = englishDate.substring(6, 8);
      formattedDate = `${year}/${month}/${day}`;
    } else {
      // Assume ddmmyyyy
      const day = englishDate.substring(0, 2);
      const month = englishDate.substring(2, 4);
      const year = englishDate.substring(4, 8);
      formattedDate = `${year}/${month}/${day}`;
    }
  }
  else {
    // Return as-is if we can't parse it
    formattedDate = englishDate;
  }
  
  // Convert back to Arabic numbers for display
  return toArabicNumbers(formattedDate);
}

function extractYearFromDate(dateStr) {
  const raw = String(dateStr || '').trim();
  if (!raw) return null;
  const english = toEnglishNumbers(raw);
  // yyyy/mm/dd or yyyy-mm-dd
  const m1 = english.match(/^(\d{4})\s*[\/\-]/);
  if (m1) return m1[1];
  // dd/mm/yyyy or dd-mm-yyyy
  const m2 = english.match(/[\/\-]\s*(\d{4})$/);
  if (m2) return m2[1];
  // yyyymmdd or ddmmyyyy
  const m3 = english.match(/^(\d{8})$/);
  if (m3) {
    const eight = m3[1];
    const head = eight.slice(0, 4);
    if (/^(19|20)\d{2}$/.test(head)) return head;
    const tailYear = eight.slice(4, 8);
    if (/^(19|20)\d{2}$/.test(tailYear)) return tailYear;
    return tailYear;
  }
  const m4 = english.match(/(19|20)\d{2}/);
  return m4 ? m4[0] : null;
}

function computeDecisionNumbersPerYear() {
  computedDecisionNumbers = new Array(rows.length);
  const counters = Object.create(null);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const year = extractYearFromDate(row && row.date);
    const bucket = year || '__no_year__';
    counters[bucket] = (counters[bucket] || 0) + 1;
    computedDecisionNumbers[i] = counters[bucket];
  }
}

function getComputedDecisionNumberForRow(row) {
  const idx = rows.indexOf(row);
  if (idx === -1) return null;
  const val = computedDecisionNumbers[idx];
  return Number.isFinite(val) ? val : null;
}

function getDecisionNumberValue(row) {
  const raw = toEnglishNumbers(String(row && row.id || '')).trim();
  const num = parseInt(raw, 10);
  if (Number.isFinite(num) && num > 0) return num;
  return getComputedDecisionNumberForRow(row);
}

function getDecisionNumberDisplay(row, rowIndex) {
  const raw = String(row && row.id || '').trim();
  if (raw) return raw;
  const computed = getComputedDecisionNumberForRow(row);
  const fallback = (rowIndex >= 0 ? rowIndex + 1 : null);
  return String(computed || fallback || '');
}

function getAttachmentIdForRow(row, rowIndex) {
  const display = getDecisionNumberDisplay(row, rowIndex);
  const baseDigits = toEnglishNumbers(String(display || '')).replace(/[^0-9]/g, '');
  const base = baseDigits || String(rowIndex + 1);
  const year = extractYearFromDate(row && row.date);
  if (year && String(year).length >= 2) {
    const yy = String(year).slice(-2);
    return `${base}_${yy}`;
  }
  return base;
}

async function moveRowAttachments(fromId, toId, datasetKey = currentDataset) {
  const source = String(fromId || '').trim();
  const target = String(toId || '').trim();
  if (!source || !target || source === target) return true;
  try {
    const res = await fetch(buildApiUrl('/api/photo-move', { dataset: datasetKey }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId: source, toId: target })
    });
    if (!res.ok) return false;
    return true;
  } catch {
    return false;
  }
}

function getAvailableYearsFromRows() {
  const years = new Set();
  rows.forEach((r) => {
    const y = extractYearFromDate(r && r.date);
    if (y) years.add(String(y));
  });
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

function updateYearToggleLabel() {
  if (!yearToggle || !yearMenu || !filterYearAll) return;
  if (filterYearAll.checked) {
    yearToggle.textContent = 'الكل ▾';
    return;
  }
  const boxes = Array.from(yearMenu.querySelectorAll('input[type="checkbox"][name="year"]'));
  const checked = boxes.filter((b) => b.checked).map((b) => b.value);
  if (!checked.length) {
    yearToggle.textContent = '— ▾';
    return;
  }
  yearToggle.textContent = checked.join(' + ') + ' ▾';
}

function refreshYearDropdownOptions() {
  if (!yearMenu || !filterYearAll) return;
  const years = getAvailableYearsFromRows();
  const signature = years.join('|');
  if (signature === availableYearsSignature) {
    updateYearToggleLabel();
    return;
  }

  // preserve existing selection when possible
  const previouslySelected = new Set();
  if (!filterYearAll.checked) {
    const oldBoxes = Array.from(yearMenu.querySelectorAll('input[type="checkbox"][name="year"]'));
    oldBoxes.filter((cb) => cb.checked).forEach((cb) => previouslySelected.add(cb.value));
  }

  // Remove existing year options (keep the "All" checkbox row)
  Array.from(yearMenu.querySelectorAll('input[type="checkbox"][name="year"]')).forEach((cb) => {
    const label = cb.closest('label');
    if (label) label.remove();
  });

  years.forEach((y) => {
    const label = document.createElement('label');
    label.className = 'choice';
    label.innerHTML = `<input type="checkbox" name="year" value="${y}"> ${toArabicNumbers(y)}`;
    const cb = label.querySelector('input');
    cb.checked = filterYearAll.checked ? false : previouslySelected.has(y);
    yearMenu.appendChild(label);
  });

  if (!yearMenu.dataset.bound) {
    yearMenu.dataset.bound = '1';
    yearMenu.addEventListener('change', (e) => {
      const target = e.target;
      if (!target || target.tagName !== 'INPUT') return;
      if (target.id === 'filterYearAll') {
        if (filterYearAll.checked) {
          Array.from(yearMenu.querySelectorAll('input[type="checkbox"][name="year"]')).forEach((cb) => { cb.checked = false; });
        }
        updateYearToggleLabel();
        onFilterChange();
        return;
      }
      if (target.name === 'year') {
        const boxes = Array.from(yearMenu.querySelectorAll('input[type="checkbox"][name="year"]'));
        const anyChecked = boxes.some((cb) => cb.checked);
        filterYearAll.checked = !anyChecked;
        updateYearToggleLabel();
        onFilterChange();
      }
    });
  }

  availableYearsSignature = signature;
  updateYearToggleLabel();
}

function getSelectedYearsSet() {
  if (!yearMenu || !filterYearAll) return null;
  if (filterYearAll.checked) return null;
  const boxes = Array.from(yearMenu.querySelectorAll('input[type="checkbox"][name="year"]'));
  const selected = boxes.filter((cb) => cb.checked).map((cb) => String(cb.value));
  return new Set(selected);
}

// Util: debounce
function debounce(fn, ms=600){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

function appendDatasetSeparatorRow(datasetKey) {
  if (!gridBody || !datasetKey) return;
  const headerCells = Array.from(document.querySelectorAll('#grid thead th'));
  const columnCount = headerCells.length || 1;
  const visibleHeaderCells = headerCells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => {
      try { return window.getComputedStyle(cell).display !== 'none'; } catch (_) { return true; }
    });
  const anchorIndex = visibleHeaderCells.length
    ? visibleHeaderCells[Math.floor(visibleHeaderCells.length / 2)].index
    : Math.floor(columnCount / 2);
  const tr = document.createElement('tr');
  tr.className = 'report-dataset-separator-row';
  tr.dataset.dataset = datasetKey;
  for (let index = 0; index < columnCount; index += 1) {
    const td = document.createElement('td');
    const sourceClass = headerCells[index]?.className || '';
    td.className = sourceClass;
    if (index === anchorIndex) {
      td.classList.add('report-dataset-separator-anchor');
      const label = document.createElement('span');
      label.className = 'report-dataset-separator-label';
      label.textContent = getDatasetLabel(datasetKey);
      td.appendChild(label);
    }
    tr.appendChild(td);
  }
  gridBody.appendChild(tr);
}

function formatReportCellDisplayValue(value, key) {
  if (key === 'sector') {
    const sectorKey = normalizeSectorKey(value);
    return sectorKey ? (REPORT_SECTOR_KEY_TO_LABEL[sectorKey] || value || '') : '';
  }
  if (key === 'date') {
    const formattedDate = formatDateToYYYYMMDD(value);
    return toArabicNumbers(String(formattedDate || value || ''));
  }
  return toArabicNumbers(String(value ?? ''));
}

// Render table
function render(){
  closeCellDropdown();
  renumber();
  gridBody.innerHTML = '';
  const allRows = getFilteredRows();
  if (visibleDecisionCount) {
    visibleDecisionCount.textContent = `عدد القرارات مكتب تجريبي 13ة: ${toArabicNumbers(String(allRows.length))}`;
  }
  pagination.totalPages = Math.max(1, Math.ceil(allRows.length / pagination.size));
  pagination.page = Math.max(1, Math.min(pagination.page, pagination.totalPages));
  const start = (pagination.page - 1) * pagination.size;
  const end = start + pagination.size;
  const view = allRows.slice(start, end);
  currentViewRows = view;
  let prevYearInView = null;
  let prevDatasetInView = null;
  const aggregateMode = isAllDatasetMode();
  view.forEach((r, idx) => {
    const origIdx = rows.indexOf(r);
    const rowDataset = getRowDatasetKey(r);
    if (aggregateMode && rowDataset && rowDataset !== prevDatasetInView) {
      appendDatasetSeparatorRow(rowDataset);
      prevDatasetInView = rowDataset;
    }
    const tr = document.createElement('tr');
    tr.draggable = !aggregateMode;
    tr.dataset.index = String(origIdx);
    if (rowDataset) tr.dataset.dataset = rowDataset;
    // drag handlers to support reordering
    if (!aggregateMode) {
      tr.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(origIdx));
        e.dataTransfer.effectAllowed = 'move';
        tr.classList.add('dragging');
      });
      tr.addEventListener('dragend', () => { tr.classList.remove('dragging'); });
      tr.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      tr.addEventListener('drop', (e) => {
        e.preventDefault();
        const src = parseInt(e.dataTransfer.getData('text/plain'),10);
        const dest = parseInt(tr.dataset.index,10);
        if (!isNaN(src) && !isNaN(dest) && src !== dest){
          moveRow(src, dest);
        }
      });
    }

    // selection checkbox
    const selectTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
  checkbox.value = String(origIdx);
  checkbox.checked = selectedRows.has(origIdx);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedRows.add(origIdx);
      } else {
        selectedRows.delete(origIdx);
      }
      updateDeleteButton();
      updateSelectAllCheckbox();
    });
    selectTd.appendChild(checkbox);
    tr.appendChild(selectTd);

    // drag handle column
    const dragTd = document.createElement('td');
    dragTd.className = 'col-drag';
    dragTd.innerHTML = `<span class="drag-handle" title="سحب لإعادة الترتيب">☰</span>
      <div class="move-controls">
        <button class="move-up" title="نقل لأعلى">▲</button>
        <button class="move-down" title="نقل لأسفل">▼</button>
      </div>`;
    // wire up up/down buttons
    if (aggregateMode) {
      dragTd.classList.add('aggregate-disabled');
      dragTd.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    } else {
      dragTd.querySelector('.move-up').addEventListener('click', (ev) => { ev.stopPropagation(); moveRow(origIdx, origIdx-1); });
      dragTd.querySelector('.move-down').addEventListener('click', (ev) => { ev.stopPropagation(); moveRow(origIdx, origIdx+1); });
    }
    tr.appendChild(dragTd);

    // decision number (editable only when toggle is on)
    const displayId = getDecisionNumberDisplay(r, origIdx);
    if (reorderToggle && reorderToggle.checked) {
      const tdId = tdEdit(displayId, 'id', origIdx);
      tr.appendChild(tdId);
    } else {
      tr.appendChild(tdText(toArabicNumbers(String(displayId || '')), false));
    }

    const currentYear = extractYearFromDate(r && r.date);
    if (prevYearInView && currentYear && prevYearInView !== currentYear) {
      tr.classList.add('year-break');
    }
    prevYearInView = currentYear || prevYearInView;

    // editable cells
    const editableCell = (value, key) => tdEdit(value, key, origIdx);
    tr.appendChild(editableCell(r.date, 'date'));
    tr.appendChild(tdTextIndexButton(origIdx, r));
    tr.appendChild(editableCell(r.name, 'name'));
    tr.appendChild(editableCell(r.job, 'job'));
    tr.appendChild(editableCell(r.license, 'license'));
    tr.appendChild(editableCell(r.weapon, 'weapon'));
    tr.appendChild(editableCell(r.purpose, 'purpose'));
    tr.appendChild(editableCell(r.sector, 'sector'));
    tr.appendChild(editableCell(r.police, 'police'));
    if (isSplitDecisionDataset()) {
      tr.appendChild(tdDecision(r.decisionManager || '', 'decisionManager', origIdx));
      tr.appendChild(tdDecision(r.decisionPublic || '', 'decisionPublic', origIdx));
    } else {
      const decisionDisplay = r.decision || '';
      tr.appendChild(tdDecision(decisionDisplay, 'decision', origIdx));
      const placeholderTd = document.createElement('td');
      placeholderTd.className = 'decision-placeholder';
      tr.appendChild(placeholderTd);
    }
    tr.appendChild(editableCell(r.recommendation, 'recommendation'));
    tr.appendChild(tdPhotoCell(origIdx, r));

    gridBody.appendChild(tr);
  });
  
  updateDeleteButton();
  updateSelectAllCheckbox();
  renderAddFooter();
  // Update pager controls
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const firstBtn = document.getElementById('firstPage');
  const lastBtn = document.getElementById('lastPage');
  if (pageInfo) pageInfo.textContent = `${toArabicNumbers(String(pagination.page))} / ${toArabicNumbers(String(pagination.totalPages))}`;
  if (prevBtn) prevBtn.disabled = pagination.page <= 1;
  if (nextBtn) nextBtn.disabled = pagination.page >= pagination.totalPages;
  if (firstBtn) firstBtn.disabled = pagination.page <= 1;
  if (lastBtn) lastBtn.disabled = pagination.page >= pagination.totalPages;
}

function tdText(text, editable){
  const td = document.createElement('td');
  td.textContent = toArabicNumbers(String(text ?? ''));
  if (editable) td.contentEditable = 'true';
  return td;
}

function countReportTextIndexLines(text) {
  return String(text || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

function tdTextIndexButton(rowIndex, row) {
  const td = document.createElement('td');
  td.className = 'text-index-cell no-print';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'text-index-btn';
  if (row && row._textIndexText) btn.classList.add('has-text');
  btn.title = 'فهرس بحث إضافي';
  btn.textContent = '+';
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTextIndexModal(rowIndex, { highlightSearch: true });
  });
  td.appendChild(btn);
  const lineCount = countReportTextIndexLines(row && row._textIndexText);
  const counter = document.createElement('span');
  counter.className = 'text-index-line-count';
  counter.textContent = toArabicNumbers(String(lineCount || 0));
  counter.title = `عدد السطور: ${lineCount}`;
  td.appendChild(counter);
  return td;
}

function openTextIndexModal(rowIndex, options = {}) {
  const row = rows[rowIndex];
  if (!row) return;
  const decisionNumber = getDecisionNumberDisplay(row, rowIndex) || getDecisionNumberValue(row) || row.id || '';
  const displayName = row.name || '';
  const overlay = document.createElement('div');
  overlay.className = 'text-index-modal-overlay';
  overlay.innerHTML = `
    <div class="text-index-modal" role="dialog" aria-modal="true" dir="rtl">
      <header class="text-index-modal-header">
        <div>
          <h3>فهرس البحث — قرار ${escapeHtml(toArabicNumbers(String(decisionNumber || '')))}</h3>
          <span>${escapeHtml(displayName || 'بدون اسم')}</span>
        </div>
        <button type="button" class="text-index-close" aria-label="إغلاق">×</button>
      </header>
      <div class="text-index-modal-body">
        <textarea class="text-index-editor" spellcheck="false" placeholder="الاسم - رقم الترخيص - العداد"></textarea>
        <div class="text-index-file-name"></div>
        <div class="text-index-status"></div>
      </div>
      <footer class="text-index-modal-footer">
        <button type="button" class="text-index-cancel">إلغاء</button>
        <button type="button" class="text-index-save">حفظ</button>
      </footer>
    </div>
  `;
  const textarea = overlay.querySelector('.text-index-editor');
  const statusEl = overlay.querySelector('.text-index-status');
  const fileNameEl = overlay.querySelector('.text-index-file-name');
  const saveBtn = overlay.querySelector('.text-index-save');
  const close = () => overlay.remove();
  textarea.value = row._textIndexText || '';
  fileNameEl.textContent = row._textIndexFileName
    ? row._textIndexFileName
    : `${toEnglishNumbers(String(decisionNumber || '0'))}_${displayName || 'بدون اسم'}.txt`;

  overlay.querySelector('.text-index-close')?.addEventListener('click', close);
  overlay.querySelector('.text-index-cancel')?.addEventListener('click', close);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    statusEl.textContent = 'جاري الحفظ...';
    try {
      const saved = await saveReportTextIndexForRow(rowIndex, textarea.value, { previousFileName: row._textIndexFileName });
      statusEl.textContent = 'تم الحفظ';
      if (saved.fileName) fileNameEl.textContent = saved.fileName;
      render();
      close();
    } catch (error) {
      statusEl.textContent = `تعذر الحفظ: ${error.message}`;
      saveBtn.disabled = false;
    }
  });
  document.body.appendChild(overlay);
  const searchValue = options.highlightSearch ? getActiveTextIndexSearchValue() : '';
  const highlighted = searchValue
    ? highlightTextIndexSearchMatch(textarea, textarea.value, searchValue, statusEl)
    : false;
  if (!highlighted) textarea.focus();
}

function tdEdit(value, key, rowIndex){
  if (key === 'decision' || key === 'decisionManager' || key === 'decisionPublic') return tdDecision(value, key, rowIndex);
  if (key === 'sector') return tdSector(value, rowIndex);
  if (key === 'police') return tdPolice(value, rowIndex);
  const td = document.createElement('td');
  td.contentEditable = 'true';
  td.dataset.key = key;
  td.dataset.row = String(rowIndex);
  
  // Display value with Arabic numerals
  let displayValue = value ?? '';
  if (key === 'date') {
    // Format and display date in Arabic numerals
    displayValue = formatDateToYYYYMMDD(displayValue) || displayValue;
  }
  displayValue = toArabicNumbers(displayValue);
  td.textContent = displayValue;
  
  // Save on blur (or Enter)
  td.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); td.blur(); }
  });
  td.addEventListener('blur', () => {
    const idx = parseInt(td.dataset.row, 10);
    const k = td.dataset.key;
    if (!rows[idx]) return;
    const previous = String(rows[idx][k] ?? '');
    const prevAttachmentId = k === 'id' ? getAttachmentIdForRow(rows[idx], idx) : null;
    let val = td.textContent.trim();
    
    // Convert Arabic numbers back to English for storage
    val = toEnglishNumbers(val);
    
    // Special handling for date fields
    if (k === 'date') {
      val = formatDateToYYYYMMDD(val) || val;
      // Update display with formatted Arabic numerals
      td.textContent = toArabicNumbers(val);
    }
    
    const next = String(val ?? '');
    rows[idx][k] = val;
    if (k === 'id') {
      const nextAttachmentId = getAttachmentIdForRow(rows[idx], idx);
      if (prevAttachmentId && nextAttachmentId && prevAttachmentId !== nextAttachmentId) {
        const datasetKey = getRowDatasetKey(rows[idx]) || currentDataset;
        pendingAttachmentMoves.push({ fromId: prevAttachmentId, toId: nextAttachmentId, dataset: datasetKey });
        moveRowAttachments(prevAttachmentId, nextAttachmentId, datasetKey).catch(() => {});
      }
    }
    if (previous !== next) {
      markReportDirty();
      if ((k === 'name' || k === 'id') && rows[idx]._textIndexText) {
        saveReportTextIndexForRow(idx, rows[idx]._textIndexText, { previousFileName: rows[idx]._textIndexFileName })
          .then(() => render())
          .catch((error) => console.warn('Report text index rename failed:', error));
      }
    }
    // Don't auto-save on edit - only save when Save button is clicked
  });
  return td;
}

function getDecisionStatusColor(manager, pub) {
  const isAccepted = (v) => v === 'الموافقة' || v === 'الموافقة علي الالغاء';
  const isRejected = (v) => v === 'عدم الموافقة';
  const mAccepted = isAccepted(manager);
  const pAccepted = isAccepted(pub);
  const mRejected = isRejected(manager);
  const pRejected = isRejected(pub);
  
  if (mAccepted && pAccepted) return 'green';
  if (mRejected && pRejected) return 'red';
  if ((mAccepted || pAccepted) && (mRejected || pRejected)) return 'orange';
  if ((mAccepted && !pub) || (pAccepted && !manager)) return 'green';
  if ((mRejected && !pub) || (pRejected && !manager)) return 'red';
  if ((mAccepted || pAccepted) && (!manager || !pub)) return 'orange';
  return '';
}

function openSplitDecisionModal(rowIndex, onDone) {
  const row = rows[rowIndex];
  if (!row) return;
  
  let tempManager = row.decisionManager || '';
  let tempPublic = row.decisionPublic || '';
  
  const overlay = document.createElement('div');
  overlay.className = 'decision-modal-overlay';
  overlay.innerHTML = `
    <div class="decision-modal" role="dialog" aria-modal="true">
      <header class="decision-modal-header">
        <h3>موافقات</h3>
      </header>
      <div class="decision-modal-body">
        <div class="decision-field" data-field="manager">
          <span class="decision-field-label">مدير الامن</span>
          <button type="button" class="decision-field-btn" data-field="manager">----</button>
        </div>
        <div class="decision-field" data-field="public">
          <span class="decision-field-label">امن العام</span>
          <button type="button" class="decision-field-btn" data-field="public">----</button>
        </div>
      </div>
      <footer class="decision-modal-footer">
        <button type="button" class="decision-modal-done">✓ تم</button>
        <button type="button" class="decision-modal-back">↩ رجوع</button>
      </footer>
    </div>`;
  document.body.appendChild(overlay);
  
  const managerBtn = overlay.querySelector('.decision-field-btn[data-field="manager"]');
  const publicBtn = overlay.querySelector('.decision-field-btn[data-field="public"]');
  const doneBtn = overlay.querySelector('.decision-modal-done');
  const backBtn = overlay.querySelector('.decision-modal-back');
  
  const updateBtnText = (btn, val) => {
    const isRejected = val === 'عدم الموافقة';
    btn.textContent = val || '----';
    btn.classList.toggle('has-value', !!val);
    btn.classList.toggle('has-reject', !!val && isRejected);
  };
  
  updateBtnText(managerBtn, tempManager);
  updateBtnText(publicBtn, tempPublic);
  
  const createDropdown = (btn, currentVal, onSelect) => {
    const existing = overlay.querySelector('.decision-dropdown');
    if (existing) existing.remove();
    
    const dropdown = document.createElement('div');
    dropdown.className = 'decision-dropdown';
    DECISION_OPTION_VALUES.forEach((opt, idx) => {
      if (idx === 0) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'decision-dropdown-item';
      if (opt === currentVal) item.classList.add('selected');
      item.textContent = opt;
      item.addEventListener('click', () => {
        onSelect(opt);
        dropdown.remove();
      });
      dropdown.appendChild(item);
    });
    const clearItem = document.createElement('button');
    clearItem.type = 'button';
    clearItem.className = 'decision-dropdown-item clear-option';
    clearItem.textContent = 'مسح';
    clearItem.addEventListener('click', () => {
      onSelect('');
      dropdown.remove();
    });
    dropdown.appendChild(clearItem);
    
    const rect = btn.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    overlay.appendChild(dropdown);
    
    const closeOnOutside = (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.remove();
        document.removeEventListener('click', closeOnOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside, true), 10);
  };
  
  managerBtn.addEventListener('click', () => {
    createDropdown(managerBtn, tempManager, (val) => {
      tempManager = val;
      updateBtnText(managerBtn, val);
    });
  });
  
  publicBtn.addEventListener('click', () => {
    createDropdown(publicBtn, tempPublic, (val) => {
      tempPublic = val;
      updateBtnText(publicBtn, val);
    });
  });
  
  const close = (save) => {
    overlay.remove();
    if (save) {
      const prevManager = String(row.decisionManager ?? '');
      const prevPublic = String(row.decisionPublic ?? '');
      row.decisionManager = tempManager;
      row.decisionPublic = tempPublic;
      row.decision = tempManager || tempPublic || '';
      if (prevManager !== tempManager || prevPublic !== tempPublic) {
        markReportDirty();
      }
    }
    if (typeof onDone === 'function') onDone();
  };
  
  doneBtn.addEventListener('click', () => close(true));
  backBtn.addEventListener('click', () => close(false));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(false);
  });
}

function tdDecision(value, key, rowIndex){
  const td = document.createElement('td');
  td.dataset.key = key;
  td.dataset.row = String(rowIndex);
  const splitDecision = isSplitDecisionDataset();

  const optionHtml = (selectedValue) => {
    return DECISION_OPTION_VALUES.map((opt, idx) => {
      const label = idx === 0 ? 'اختر الحالة' : opt;
      const selAttr = opt === (selectedValue || '') ? ' selected' : '';
      return `<option value="${opt}"${selAttr}>${label}</option>`;
    }).join('');
  };

  const updateCellColor = () => {
    td.classList.remove('decision-green', 'decision-red', 'decision-orange');
    const currentVal = key === 'decision' ? value : (rows[rowIndex]?.[key] || '');
    const isAccepted = currentVal === 'الموافقة' || currentVal === 'الموافقة علي الالغاء';
    const isRejected = currentVal === 'عدم الموافقة';
    if (isAccepted) {
      td.classList.add('decision-green');
    } else if (isRejected) {
      td.classList.add('decision-red');
    }
  };

  const activateSelect = () => {
    td.onclick = null;
    td.innerHTML = '';
    const sel = document.createElement('select');
    sel.className = 'cell-select decision-select';
    const currentVal = key === 'decision' ? value : (rows[rowIndex]?.[key] || '');
    sel.innerHTML = optionHtml(currentVal);
    td.appendChild(sel);
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.focus();
    const commit = () => {
      const v = sel.value || '';
      const row = rows[rowIndex];
      if (!row) return;
      const prevDecision = String(row.decision ?? '');
      const prevManager = String(row.decisionManager ?? '');
      const prevPublic = String(row.decisionPublic ?? '');
      if (key === 'decision') {
        row.decision = v;
        row.decisionManager = '';
        row.decisionPublic = '';
        value = v;
      } else {
        row[key] = v;
        row.decision = row.decisionManager || row.decisionPublic || '';
      }
      const changed = (row.decision !== prevDecision) || (row.decisionManager !== prevManager) || (row.decisionPublic !== prevPublic);
      if (changed) markReportDirty();
      renderText();
    };
    sel.addEventListener('change', commit);
    sel.addEventListener('blur', commit);
  };

  const renderText = () => {
    td.onclick = null;
    if (splitDecision && (key === 'decisionManager' || key === 'decisionPublic')) {
      const val = rows[rowIndex]?.[key] || '';
      td.innerHTML = `<div class="decision-display" title="انقر للتعديل">${escapeHtml(val || '----')}</div>`;
      td.onclick = (e) => { e.stopPropagation(); activateSelect(); };
      updateCellColor();
      return;
    }
    // single-column mode
    const safe = value ?? '';
    td.textContent = safe;
    td.title = 'انقر للتعديل';
    td.onclick = (e) => { e.stopPropagation(); activateSelect(); };
    updateCellColor();
  };

  renderText();
  return td;
}

// Helper to detect sector from station
function detectSectorForStation(st){
  return detectSectorKeyForStationName(st) || '';
}

function closeCellDropdown() {
  const existing = document.querySelector('.cell-dropdown, .cell-input-popup');
  if (existing) existing.remove();
}

function tdSector(value, rowIndex){
  const td = document.createElement('td');
  td.dataset.key = 'sector';
  td.dataset.row = String(rowIndex);
  td.classList.add('editable-cell');
  let current = normalizeSectorKey(value || '');

  const renderText = () => {
    td.textContent = REPORT_SECTOR_KEY_TO_LABEL[current] || current || '';
    td.title = 'انقر لاختيار القطاع';
  };

  td.addEventListener('click', () => {
    const ownerId = `sector-${rowIndex}`;
    const existing = document.querySelector('.cell-dropdown');
    if (existing && existing.dataset.owner === ownerId) { existing.remove(); return; }
    closeCellDropdown();

    const allowedKeys = getAllowedSectorKeys();
    if (!allowedKeys.length) { alert('لا توجد قطاعات متاحة للتعديل.'); return; }

    const dropdown = document.createElement('div');
    dropdown.className = 'cell-dropdown';
    dropdown.dataset.owner = ownerId;

    allowedKeys.forEach((key) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell-dropdown-item';
      btn.textContent = REPORT_SECTOR_KEY_TO_LABEL[key] || key;
      if (key === current) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        dropdown.remove();
        const prevSector = String(rows[rowIndex].sector ?? '');
        const prevPolice = String(rows[rowIndex].police ?? '');
        rows[rowIndex].sector = key;
        current = key;
        if (rows[rowIndex].police) {
          const stNorm = normalizeStationName(rows[rowIndex].police, key);
          if (!getAllowedStationsForSectorKey(key).includes(stNorm)) rows[rowIndex].police = '';
        }
        if (prevSector !== key || prevPolice !== String(rows[rowIndex].police ?? '')) markReportDirty();
        renderText();
        render();
      });
      dropdown.appendChild(btn);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'cell-dropdown-item clear-option';
    clearBtn.textContent = 'مسح';
    clearBtn.addEventListener('click', () => {
      dropdown.remove();
      const prev = String(rows[rowIndex].sector ?? '');
      rows[rowIndex].sector = '';
      current = '';
      if (prev !== '') markReportDirty();
      renderText();
      render();
    });
    dropdown.appendChild(clearBtn);

    const rect = td.getBoundingClientRect();
    document.body.appendChild(dropdown);
    const dropH = dropdown.offsetHeight || 220;
    const top = (window.innerHeight - rect.bottom < dropH + 8 && rect.top > dropH + 8)
      ? rect.top - dropH - 4
      : rect.bottom + 4;
    dropdown.style.top = top + 'px';
    dropdown.style.left = rect.left + 'px';

    const closeOnOutside = (e) => {
      if (!dropdown.contains(e.target) && e.target !== td) {
        dropdown.remove();
        document.removeEventListener('mousedown', closeOnOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnOutside, true), 10);
  });

  renderText();
  return td;
}

function tdPolice(value, rowIndex){
  const td = document.createElement('td');
  td.dataset.key = 'police';
  td.dataset.row = String(rowIndex);
  td.classList.add('editable-cell');
  let current = value || '';

  const renderText = () => {
    td.textContent = current;
    const sectorValue = rows[rowIndex]?.sector;
    if (!sectorValue) {
      td.title = 'اختر القطاع أولاً';
      td.style.opacity = '0.5';
    } else {
      const allowedStations = getAllowedStationsForSectorKey(sectorValue);
      if (!allowedStations.length) {
        if (sectorValue === 'police_unit' || sectorValue === 'army_unit') {
          td.title = 'اكتب القسم';
          td.style.opacity = '1';
        } else {
          td.title = 'لا توجد أقسام لهذا القطاع';
          td.style.opacity = '0.5';
        }
      } else {
        td.title = 'انقر لاختيار القسم';
        td.style.opacity = '1';
      }
    }
  };

  td.addEventListener('click', () => {
    const ownerId = `police-${rowIndex}`;
    const sectorValue = rows[rowIndex]?.sector;
    if (!sectorValue) { alert('يرجى اختيار القطاع أولاً'); return; }
    if (!isSectorKeyAllowed(sectorValue)) { alert('هذا القطاع غير متاح لك.'); return; }

    const existingAny = document.querySelector('.cell-dropdown, .cell-input-popup');
    if (existingAny && existingAny.dataset.owner === ownerId) { existingAny.remove(); return; }
    closeCellDropdown();

    const rect = td.getBoundingClientRect();

    if (sectorValue === 'police_unit' || sectorValue === 'army_unit') {
      const popup = document.createElement('div');
      popup.className = 'cell-input-popup';
      popup.dataset.owner = ownerId;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.placeholder = 'اكتب القسم';
      popup.appendChild(input);
      document.body.appendChild(popup);
      popup.style.top = (rect.bottom + 4) + 'px';
      popup.style.left = rect.left + 'px';
      input.focus();

      const commitInput = () => {
        const val = input.value.trim();
        const previous = String(rows[rowIndex].police ?? '');
        rows[rowIndex].police = val;
        current = val;
        if (previous !== val) markReportDirty();
        popup.remove();
        renderText();
      };
      input.addEventListener('blur', commitInput);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { popup.remove(); }
      });
      return;
    }

    const allowedStations = getAllowedStationsForSectorKey(sectorValue);
    if (!allowedStations.length) { alert('لا توجد أقسام متاحة لهذا القطاع.'); return; }

    const resolvedCurrent = normalizeStationName(current, sectorValue);

    const dropdown = document.createElement('div');
    dropdown.className = 'cell-dropdown';
    dropdown.dataset.owner = ownerId;

    allowedStations.forEach((station) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell-dropdown-item';
      btn.textContent = station;
      if (station === resolvedCurrent) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        dropdown.remove();
        const previous = String(rows[rowIndex].police ?? '');
        rows[rowIndex].police = station;
        current = station;
        if (previous !== station) markReportDirty();
        renderText();
      });
      dropdown.appendChild(btn);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'cell-dropdown-item clear-option';
    clearBtn.textContent = 'مسح';
    clearBtn.addEventListener('click', () => {
      dropdown.remove();
      const previous = String(rows[rowIndex].police ?? '');
      rows[rowIndex].police = '';
      current = '';
      if (previous !== '') markReportDirty();
      renderText();
    });
    dropdown.appendChild(clearBtn);

    document.body.appendChild(dropdown);
    const dropH = dropdown.offsetHeight || 260;
    const top = (window.innerHeight - rect.bottom < dropH + 8 && rect.top > dropH + 8)
      ? rect.top - dropH - 4
      : rect.bottom + 4;
    dropdown.style.top = top + 'px';
    dropdown.style.left = rect.left + 'px';

    const closeOnOutside = (e) => {
      if (!dropdown.contains(e.target) && e.target !== td) {
        dropdown.remove();
        document.removeEventListener('mousedown', closeOnOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnOutside, true), 10);
  });

  renderText();
  return td;
}

function renumber(){
  // decision number is derived per-year from current row order
  computeDecisionNumbersPerYear();
  refreshYearDropdownOptions();
}

// Move a row from srcIndex to destIndex (absolute indexes in rows[])
function moveRow(srcIndex, destIndex){
  if (srcIndex < 0 || destIndex < 0 || srcIndex >= rows.length || destIndex >= rows.length) return;
  const [item] = rows.splice(srcIndex,1);
  rows.splice(destIndex,0,item);
  // Keep selection set consistent: rebuild based on new indices
  const newSelected = new Set();
  for (const s of selectedRows){
    if (s === srcIndex) {
      newSelected.add(destIndex);
    } else if (srcIndex < s && s <= destIndex){
      // shifted up
      newSelected.add(s-1);
    } else if (destIndex <= s && s < srcIndex){
      // shifted down
      newSelected.add(s+1);
    } else {
      newSelected.add(s);
    }
  }
  selectedRows = newSelected;
  // update pagination counts and render
  pagination.totalPages = Math.max(1, Math.ceil(getFilteredRows().length / pagination.size));
  render();
  markReportDirty();
}

function setAddMode(on){
  if (on === addMode) return;
  if (on) {
    const snapshot = getStationRestrictionSnapshot();
    const allowedSectors = snapshot.isAdmin ? ALL_REPORT_SECTOR_KEYS.slice() : snapshot.allowedSectorKeys.slice();
    if (!allowedSectors.length) {
      alert('لا توجد قطاعات متاحة لإضافة بيانات جديدة.');
      return;
    }
  }
  addMode = on;
  addDraft = on ? newDraftRow() : null;
  // Prefill station from active filter if available
  if (on && addDraft) {
    if (filterSectorEl && isSectorKeyAllowed(filterSectorEl.value)) {
      addDraft.sector = filterSectorEl.value;
    }
    if (filterStationEl && filterStationEl.value) {
      const allowedStations = addDraft.sector ? getAllowedStationsForSectorKey(addDraft.sector) : [];
      const normalizedFilterStation = normalizeStationName(filterStationEl.value, addDraft.sector);
      if (allowedStations.includes(normalizedFilterStation)) {
        addDraft.police = normalizedFilterStation;
      }
    }
  }
  renderAddFooter();
}

function buildDecisionOptions(selected){
  return DECISION_OPTION_VALUES.map((opt, idx) => {
    const label = idx === 0 ? 'اختر الحالة' : opt;
    const sel = (opt || '') === (selected || '') ? 'selected' : '';
    return `<option value="${opt}" ${sel}>${label}</option>`;
  }).join('');
}

function buildAddDecisionSelect(id, label, selected){
  const lbl = label ? `<label class="decision-inline">${label}` : '';
  const closing = label ? '</label>' : '';
  return `${lbl}<select id="${id}">${buildDecisionOptions(selected)}</select>${closing}`;
}

function buildAddDecisionCell(){
  if (isSplitDecisionDataset()) {
    // legacy fallback (unused now that we render two columns)
    return `
      <div class="decision-dual-input">
        ${buildAddDecisionSelect('add_decision_manager', 'مدير الامن', addDraft.decisionManager)}
        ${buildAddDecisionSelect('add_decision_public', 'امن العام', addDraft.decisionPublic)}
      </div>`;
  }
  return buildAddDecisionSelect('add_decision', '', addDraft.decision);
}

function renderAddFooter(){
  if (!addFoot) return;
  if (!addMode){
    addFoot.innerHTML = '';
    return;
  }
  const draftYear = extractYearFromDate(addDraft && addDraft.date);
  // Determine default sector (from selected station in draft or current filter)
  const allowedSectors = getAllowedSectorKeys();
  const totalCols = (typeof reorderToggle !== 'undefined' && reorderToggle && reorderToggle.checked) ? 16 : 15;
  if (!allowedSectors.length) {
    addFoot.innerHTML = `<tr><td colspan="${totalCols}" class="add-restricted-message">لا توجد قطاعات متاحة للإضافة.</td></tr>`;
    return;
  }

  let defaultSector = addDraft.sector || detectSectorForStation(addDraft.police) || (filterSectorEl ? filterSectorEl.value : '') || '';
  if (defaultSector && !allowedSectors.includes(defaultSector)) {
    defaultSector = '';
  }
  addDraft.sector = defaultSector;

  const sectorOptions = ['<option value="">اختر القطاع</option>']
    .concat(allowedSectors.map((key) => `<option value="${key}" ${key===defaultSector?'selected':''}>${REPORT_SECTOR_KEY_TO_LABEL[key] || key}</option>`))
    .join('');

  const isUnitSector = (sec) => sec === 'police_unit' || sec === 'army_unit';
  let stations = defaultSector ? getAllowedStationsForSectorKey(defaultSector) : [];
  if (addDraft.police && !stations.includes(normalizeStationName(addDraft.police, defaultSector))) {
    addDraft.police = '';
  }
  const stationOptions = ['<option value="">اختر القسم</option>']
    .concat(stations.map((station) => `<option value="${station}" ${addDraft.police===station?'selected':''}>${station}</option>`))
    .join('');
  const stationSelectDisabled = (!defaultSector || stations.length === 0) ? 'disabled' : '';
  const stationField = isUnitSector(defaultSector)
    ? `<input id="add_station" type="text" placeholder="اكتب القسم" value="${addDraft.police}" />`
    : `<select id="add_station" ${stationSelectDisabled}>${stationOptions}</select>`;
  // Decide whether to render the drag/select placeholders based on the reorder toggle
  const showDrag = (typeof reorderToggle !== 'undefined' && reorderToggle && reorderToggle.checked);

  const idCellContent = (reorderToggle && reorderToggle.checked)
    ? `<input id="add_id" type="text" inputmode="numeric" placeholder="رقم القرار" value="${toArabicNumbers(addDraft.id || '')}" />`
    : '—';

  if (showDrag) {
    addFoot.innerHTML = `
      <tr>
        <td class="col-drag"></td> <!-- drag placeholder -->
        <td></td> <!-- select checkbox placeholder -->
        <td aria-label="رقم القرار">${idCellContent}</td>
        <td><input id="add_date" type="text" inputmode="numeric" placeholder="yyyy/mm/dd" value="${toArabicNumbers(addDraft.date)}" /></td>
        <td class="text-index-cell no-print"></td>
        <td><input id="add_name" type="text" placeholder="الاسم" value="${addDraft.name}" /></td>
        <td><input id="add_job" type="text" placeholder="الوظيفة" value="${addDraft.job}" /></td>
        <td><input id="add_license" type="text" placeholder="نوع الترخيص" value="${addDraft.license}" /></td>
        <td><input id="add_weapon" type="text" placeholder="نوع السلاح" value="${addDraft.weapon}" /></td>
        <td><input id="add_purpose" type="text" placeholder="الغرض" value="${addDraft.purpose}" /></td>
        <td>
          <select id="add_sector">${sectorOptions}</select>
        </td>
        <td>
          ${stationField}
        </td>
          <td>${buildAddDecisionSelect('add_decision_manager','مدير الامن',addDraft.decisionManager)}</td>
          <td>${buildAddDecisionSelect('add_decision_public','امن العام',addDraft.decisionPublic)}</td>
        <td>
          <input id="add_recommendation" type="text" placeholder="توصية" value="${addDraft.recommendation}" />
        </td>
        <td></td> <!-- photo placeholder -->
      </tr>
      <tr>
        <td colspan="16" class="add-actions">
          <button id="addCancelBtn" type="button">إلغاء</button>
          <button id="addConfirmBtn" type="button">إضافة</button>
        </td>
      </tr>
    `;
  } else {
    // When drag is disabled, do not include the extra drag placeholder; adjust colspan
    addFoot.innerHTML = `
      <tr>
        <td></td> <!-- select checkbox placeholder (first visible col) -->
        <td aria-label="رقم القرار">${idCellContent}</td>
        <td><input id="add_date" type="text" inputmode="numeric" placeholder="yyyy/mm/dd" value="${toArabicNumbers(addDraft.date)}" /></td>
        <td class="text-index-cell no-print"></td>
        <td><input id="add_name" type="text" placeholder="الاسم" value="${addDraft.name}" /></td>
        <td><input id="add_job" type="text" placeholder="الوظيفة" value="${addDraft.job}" /></td>
        <td><input id="add_license" type="text" placeholder="نوع الترخيص" value="${addDraft.license}" /></td>
        <td><input id="add_weapon" type="text" placeholder="نوع السلاح" value="${addDraft.weapon}" /></td>
        <td><input id="add_purpose" type="text" placeholder="الغرض" value="${addDraft.purpose}" /></td>
        <td>
          <select id="add_sector">${sectorOptions}</select>
        </td>
        <td>
          ${stationField}
        </td>
          <td>${buildAddDecisionSelect('add_decision_manager','مدير الامن',addDraft.decisionManager)}</td>
          <td>${buildAddDecisionSelect('add_decision_public','امن العام',addDraft.decisionPublic)}</td>
        <td>
          <input id="add_recommendation" type="text" placeholder="توصية" value="${addDraft.recommendation}" />
        </td>
        <td></td> <!-- photo placeholder -->
      </tr>
      <tr>
        <td colspan="15" class="add-actions">
          <button id="addCancelBtn" type="button">إلغاء</button>
          <button id="addConfirmBtn" type="button">إضافة</button>
        </td>
      </tr>
    `;
  }
  // Focus first input for convenience
  const sectorEl = document.getElementById('add_sector');
  const first = sectorEl || document.getElementById('add_date') || document.getElementById('add_name');
  if (first) first.focus();
  // Scroll footer into view so the dropdowns can open upwards
  try{ addFoot.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch {}
  // Add listeners to populate stations on sector change
  const addSectorEl = document.getElementById('add_sector');
  const addStationEl = document.getElementById('add_station');
  if (addStationEl && addStationEl.tagName === 'INPUT') {
    addStationEl.addEventListener('input', () => {
      addDraft.police = addStationEl.value;
    });
  }
  const addDateEl = document.getElementById('add_date');
  if (addSectorEl && addStationEl){
    addSectorEl.addEventListener('change', () => {
      const sec = addSectorEl.value;
      addDraft.sector = sec;
      if (isUnitSector(sec)) {
        const currentStationEl = document.getElementById('add_station');
        if (currentStationEl && currentStationEl.tagName !== 'INPUT') {
          const input = document.createElement('input');
          input.id = 'add_station';
          input.type = 'text';
          input.placeholder = 'اكتب القسم';
          input.value = addDraft.police || '';
          input.addEventListener('input', () => { addDraft.police = input.value; });
          currentStationEl.replaceWith(input);
        }
        return;
      }
      const allowedStations = sec ? getAllowedStationsForSectorKey(sec) : [];
      const currentStationEl = document.getElementById('add_station');
      if (currentStationEl && currentStationEl.tagName !== 'SELECT') {
        const select = document.createElement('select');
        select.id = 'add_station';
        currentStationEl.replaceWith(select);
      }
      const selectEl = document.getElementById('add_station');
      if (selectEl) {
        selectEl.innerHTML = `<option value="">اختر القسم</option>` + allowedStations.map((station) => `<option value="${station}">${station}</option>`).join('');
        selectEl.disabled = !sec || allowedStations.length === 0;
        selectEl.value = '';
      }
      addDraft.police = '';
      if (allowedStations.length && selectEl) selectEl.focus();
    });
  }
  // Smart date formatter: converts to yyyy/mm/dd format with Arabic numerals
  if (addDateEl){
    addDateEl.addEventListener('keydown', (e) => {
      if (e.key !== '/') return;
      const value = String(addDateEl.value || '');
      const pos = typeof addDateEl.selectionStart === 'number' ? addDateEl.selectionStart : null;
      if (pos === null) return;
      // If there's already a slash at or just before the cursor, don't insert another
      if (value.charAt(pos) === '/' || value.charAt(pos - 1) === '/') {
        e.preventDefault();
      }
    });
    addDateEl.addEventListener('input', () => {
      let v = addDateEl.value || '';
      // Convert Arabic numbers to English for processing
      v = toEnglishNumbers(v);
      v = v.replace(/[^0-9\/]/g, '');
      
      // If user typed single digit followed by slash -> pad to 0d/
      v = v.replace(/^(\d)\/$/, '0$1/');
      // If dd and no slash yet -> add slash
      if (/^\d{2}$/.test(v)) v = v + '/';
      // If ddm digits -> insert slash after dd
      if (/^\d{3}$/.test(v)) v = v.slice(0,2) + '/' + v.slice(2);
      // If dd/m and slash typed -> pad month to 0m/
      v = v.replace(/^(\d{2})\/(\d)\/$/, '$1/0$2/');
      // If dd/mm and no year yet -> add slash when month completed
      if (/^\d{2}\/\d{2}$/.test(v)) v = v + '/';
      // Trim to dd/mm/yyyy max
      v = v.replace(/^(\d{2})\/(\d{2})\/(\d{4}).*/, '$1/$2/$3');
      
      // Convert to Arabic numbers for display
      addDateEl.value = toArabicNumbers(v);
      addDraft.date = toArabicNumbers(v);
    });
    
    // On blur, format the complete date to yyyy/mm/dd if possible
    addDateEl.addEventListener('blur', () => {
      const formatted = formatDateToYYYYMMDD(addDateEl.value);
      if (formatted && formatted !== addDateEl.value) {
        addDateEl.value = formatted;
        addDraft.date = formatted;
      }
    });
  }
}

function updateDeleteButton(){
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const tagBtn = document.getElementById('tagAttachmentsBtn');
  const aggregate = isAllDatasetMode();
  deleteBtn.disabled = selectedRows.size === 0;
  if (selectedRows.size > 0) {
    deleteBtn.textContent = `🗑️ حذف المحدد (${selectedRows.size})`;
  } else {
    deleteBtn.textContent = '🗑️ حذف المحدد';
  }
  if (tagBtn) {
    tagBtn.disabled = aggregate || selectedRows.size === 0;
  }
}

function tdPhotoCell(rowIndex, row){
  const td = document.createElement('td');
  td.className = 'photo-cell';
  let id = getAttachmentIdForRow(row || rows[rowIndex], rowIndex);
  const getCellDatasetKey = () => getRowDatasetKey(row || rows[rowIndex]) || currentDataset;
  const buildCellApiUrl = (path, params = {}) => buildApiUrl(path, { ...params, dataset: getCellDatasetKey() });
  const state = { files: [] };
  const makeAbsolute = (u) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    try{
      if (location.protocol && location.protocol.startsWith('http')){
        return location.origin + u;
      }
    }catch{}
    return u;
  };

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.title = 'المرفقات';
  toggleBtn.textContent = '📎';
  toggleBtn.className = 'btn-photo-toggle';
  td.appendChild(toggleBtn);

  const updateToggleLabel = () => {
    const count = Array.isArray(state.files) ? state.files.length : 0;
    toggleBtn.textContent = `📎 ${count}`;
    toggleBtn.title = `المرفقات (${count})`;
  };

  let modalEl = null;
  let selected = new Set();

  const closeModal = () => {
    if (!modalEl) return;
    modalEl.remove();
    modalEl = null;
    selected = new Set();
  };

  const renderModal = () => {
    const aggregateMode = isAllDatasetMode();
    const rowDatasetKey = getCellDatasetKey();
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div');
    modalEl.className = 'photo-modal-overlay';
    modalEl.innerHTML = `
      <div class="photo-modal" role="dialog" aria-modal="true">
        <header class="photo-modal-header">
          <h3>مرفقات القرار #${id}${aggregateMode ? ` · ${getDatasetLabel(rowDatasetKey)}` : ''}</h3>
          <button type="button" class="btn-photo-close">✖</button>
        </header>
        <div class="photo-modal-body"></div>
        <footer class="photo-modal-footer"></footer>
      </div>`;
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
    modalEl.querySelector('.btn-photo-close').addEventListener('click', closeModal);

    const body = modalEl.querySelector('.photo-modal-body');
    const list = document.createElement('div');
    list.className = 'photo-list';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️ حذف المحدد';
    deleteBtn.className = 'btn-photo-delete';
    deleteBtn.disabled = true;
    const updateDeleteState = () => { deleteBtn.disabled = selected.size === 0; };

    if (!state.files.length){
      const empty = document.createElement('span');
      empty.className = 'photo-empty';
      empty.textContent = 'لا مرفقات';
      list.appendChild(empty);
    } else {
      state.files.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.hidden = aggregateMode;
        checkbox.disabled = aggregateMode;
        checkbox.addEventListener('change', () => {
          if (aggregateMode) return;
          if (checkbox.checked){ selected.add(file.name); } else { selected.delete(file.name); }
          updateDeleteState();
        });
        const name = document.createElement('span');
        name.className = 'photo-name';
        name.textContent = file.name;
        const isPdf = /\.pdf(\?|$)/i.test(String(file.url || ''));
        const view = document.createElement('button');
        view.type = 'button';
        view.title = isPdf ? 'عرض PDF' : 'عرض/طباعة الصورة';
        view.className = isPdf ? 'btn-photo-pdf' : 'btn-photo-view';
        view.textContent = isPdf ? '📄' : '🖼';
        view.addEventListener('click', () => {
          if (isPdf){
            const abs = makeAbsolute(file.url);
            try {
              const newWin = window.open(abs, '_blank');
              if (newWin) { try { newWin.focus(); } catch {} return; }
            } catch {}
            // Fallback: open in same tab to avoid iframe/pdf crashes on older PCs
            try { window.location.href = abs; } catch {}
          } else {
            openPhotoModal(file.url);
          }
        });
        item.appendChild(checkbox);
        item.appendChild(name);
        item.appendChild(view);
        list.appendChild(item);
      });
    }
    body.appendChild(list);

    const footer = modalEl.querySelector('.photo-modal-footer');
    footer.innerHTML = '';
    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.textContent = '➕ اضافة';
    uploadBtn.className = 'btn-photo-upload';
    const ocrBtn = document.createElement('button');
    ocrBtn.type = 'button';
    ocrBtn.textContent = 'OCR';
    ocrBtn.className = 'btn-photo-view-ocr ocr-feature';
    ocrBtn.dataset.decision = id;
    ocrBtn.dataset.category = rowDatasetKey;
    const viewAllBtn = document.createElement('button');
    viewAllBtn.type = 'button';
    viewAllBtn.textContent = 'عرض';
    viewAllBtn.className = 'btn-photo-viewall';
    viewAllBtn.addEventListener('click', async () => {
      const files = Array.isArray(state.files) ? state.files : [];
      if (!files.length) { alert('لا توجد مرفقات لعرضها.'); return; }
      try {
        await ensurePdfLibLoaded();
      } catch (_) {
        alert('مكتبة PDF غير متاحة. تحقق من ملفات التطبيق.');
        return;
      }
      viewAllBtn.disabled = true;
      viewAllBtn.textContent = '⏳ جارٍ التجهيز...';
      try {
        const { PDFDocument } = window.PDFLib;
        const outPdf = await PDFDocument.create();
        const A4 = { w: 595.28, h: 841.89 };

        for (const file of files) {
          const url = makeAbsolute(file.url);
          let res;
          try { res = await fetch(url); } catch { continue; }
          if (!res || !res.ok) continue;
          const bytes = await res.arrayBuffer();
          const contentType = res.headers.get('content-type') || '';
          const isPdf = /pdf/i.test(contentType) || /\.pdf(\?|$)/i.test(url);
          const isPng = /png/i.test(contentType) || /\.png(\?|$)/i.test(url);
          const isJpg = /jpe?g/i.test(contentType) || /\.jpe?g(\?|$)/i.test(url);

          if (isPdf) {
            try {
              const srcPdf = await PDFDocument.load(bytes);
              const pages = await outPdf.copyPages(srcPdf, srcPdf.getPageIndices());
              pages.forEach((p) => outPdf.addPage(p));
            } catch {}
            continue;
          }

          if (isPng || isJpg) {
            try {
              const img = isPng ? await outPdf.embedPng(bytes) : await outPdf.embedJpg(bytes);
              const page = outPdf.addPage([A4.w, A4.h]);
              const scale = Math.min(A4.w / img.width, A4.h / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              const x = (A4.w - w) / 2;
              const y = (A4.h - h) / 2;
              page.drawImage(img, { x, y, width: w, height: h });
            } catch {}
          }
        }

        const pdfBytes = await outPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        if (!win) alert('تعذر فتح نافذة العرض.');
        setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch {} }, 60000);
      } finally {
        viewAllBtn.disabled = false;
        viewAllBtn.textContent = 'عرض';
      }
    });
    uploadBtn.addEventListener('click', () => {
      if (aggregateMode) return;
      openFilePicker();
    });
    deleteBtn.addEventListener('click', async () => {
      if (aggregateMode) return;
      if (!selected.size) return;
      if (!confirm('حذف المرفقات المحددة؟')) return;
      for (const name of selected){
        try { await fetch(buildCellApiUrl(`/api/photo/${id}?filename=${encodeURIComponent(name)}`), { method: 'DELETE' }); } catch {}
      }
      await refresh();
    });
    if (!aggregateMode) footer.appendChild(uploadBtn);
    footer.appendChild(viewAllBtn);
    if (isReportOcrEnabled()) footer.appendChild(ocrBtn);
    if (!aggregateMode) footer.appendChild(deleteBtn);
    updateDeleteState();
  };

  const render = () => {
    if (modalEl) renderModal();
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    id = getAttachmentIdForRow(row || rows[rowIndex], rowIndex);
    renderModal();
  });
  async function refresh(){
    try{
      id = getAttachmentIdForRow(row || rows[rowIndex], rowIndex);
      const res = await fetch(buildCellApiUrl(`/api/photo/${id}`, { _: Date.now() }), { cache: 'no-store' });
      const json = await res.json();
      const tempUrls = Array.isArray(state.files)
        ? state.files.filter((f) => f && f._temp && f._blobUrl).map((f) => f._blobUrl)
        : [];
      state.files = Array.isArray(json?.files) ? json.files : [];
      tempUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) {} });
    }catch{}
    updateToggleLabel();
    render();
  }
  function openFilePicker(){
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    // accept both images and PDFs
    input.accept = 'image/*,application/pdf';
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      for (const file of files){
        id = getAttachmentIdForRow(row || rows[rowIndex], rowIndex);
        try {
          if (!Array.isArray(state.files)) state.files = [];
          const exists = state.files.some((f) => f && f.name === file.name && f._temp);
          if (!exists) {
            const blobUrl = URL.createObjectURL(file);
            state.files.push({ name: file.name, url: blobUrl, _temp: true, _blobUrl: blobUrl });
            updateToggleLabel();
            render();
          }
        } catch (_) {}
        await uploadSingle(file);
        await refresh();
      }
    });
    input.click();
  }
  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try{
          const dataUrl = String(reader.result || '');
          const [prefix, b64] = dataUrl.split(',');
          const mime = (prefix.match(/^data:(.*);base64$/) || [,''])[1] || file.type || 'application/octet-stream';
          resolve({ mime, b64 });
        } catch (e){ reject(e); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  async function uploadSingle(file){
    try{
      const { mime, b64 } = await fileToBase64(file);
      id = getAttachmentIdForRow(row || rows[rowIndex], rowIndex);
      const res = await fetch(buildCellApiUrl(`/api/photo/${id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mime, data: b64, filename: file.name })
      });
      if (res && res.ok) {
        try {
          const json = await res.json();
          if (Array.isArray(json?.files)) {
            state.files = json.files;
            updateToggleLabel();
            render();
          }
        } catch {}
      }
    }catch{}
  }
  function openPhotoModal(url){
    const w = window.open('', '_blank');
    if (!w) return;
    const html = `<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>صورة القرار #${id}</title>
      <style>
        @page { margin: 0; }
        body{margin:0;display:flex;flex-direction:column;height:100vh;background:#fff}
        header{padding:8px;display:flex;gap:8px;justify-content:flex-end;box-shadow:0 1px 0 #ddd}
        img{max-width:100%;max-height:calc(100vh - 48px);object-fit:contain;margin:auto}
        @media print{
          header{ display:none !important; }
          img{ max-height:100vh; }
        }
      </style>
    </head><body>
      <header>
        <button onclick="window.print()" title="طباعة">🖨️</button>
      </header>
      <img src="${url}" alt="صورة القرار"/>
    </body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  }
  // Open PDF in a side panel inside the app (keeps the app open and prevents direct download)
  function openPdfSidePanel(url){
    // Reuse existing panel if present
    let panel = document.getElementById('pdfSidePanel');
    if (!panel){
  panel = document.createElement('div');
  panel.id = 'pdfSidePanel';
  panel.className = 'pdf-sidepanel';
  panel.innerHTML = `<header><div class="title">عرض ملف PDF</div><div class="panel-actions"><button class="open-extern" title="فتح في نافذة جديدة">↗</button><button class="close-btn" aria-label="إغلاق">✖</button></div></header><iframe src="about:blank"></iframe>`;
      document.body.appendChild(panel);
  panel.querySelector('.close-btn').addEventListener('click', () => panel.classList.remove('open'));
  panel.querySelector('.open-extern').addEventListener('click', () => { const iframe = panel.querySelector('iframe'); const src = iframe && iframe.src ? iframe.src : null; if (src) window.open(src, '_blank'); });
      // close when clicking outside (optional): click on overlay won't be added to avoid complexity
    }
  const iframe = panel.querySelector('iframe');
  // Use inline viewer if server serves application/pdf; set src to the direct URL
  iframe.src = url;
  // If the iframe fails to load the PDF (some browsers/plugins/settings), user can open in new tab via the header button
    // open the panel
    panel.classList.add('open');
  }
  refresh();
  return td;
}

function updateSelectAllCheckbox(){
  const selectAllCheckbox = document.getElementById('selectAll');
  if (!selectAllCheckbox) return;
  selectAllCheckbox.disabled = false;
  const view = currentViewRows || [];
  const viewIndices = new Set(view.map(r => rows.indexOf(r)));
  const total = viewIndices.size;
  const selectedInView = Array.from(viewIndices).filter(i => selectedRows.has(i)).length;
  if (total === 0){
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }
  if (selectedInView === total){
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedInView > 0){
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
}

function getConcreteDatasetKeyForRow(row) {
  const rowDataset = getRowDatasetKey(row);
  if (DATASET_GROUP_ORDER.includes(rowDataset)) return rowDataset;
  if (DATASET_GROUP_ORDER.includes(currentDataset)) return currentDataset;
  return DATASET_GROUP_ORDER[0];
}

function stripReportRowMetadata(row) {
  const {
    __dataset,
    __datasetLabel,
    __sourceIndex,
    _textIndexText,
    _textIndexFileName,
    ...clean
  } = row && typeof row === 'object' ? row : {};
  return clean;
}

function groupRowsByDataset(rowList) {
  const grouped = new Map();
  (Array.isArray(rowList) ? rowList : []).forEach((row) => {
    if (!row) return;
    const datasetKey = getConcreteDatasetKeyForRow(row);
    if (!grouped.has(datasetKey)) grouped.set(datasetKey, []);
    grouped.get(datasetKey).push(row);
  });
  return grouped;
}

function compareReportRowsForSave(a, b) {
  const yearA = extractYearFromDate(a && a.date) || '';
  const yearB = extractYearFromDate(b && b.date) || '';
  if (yearA && yearB && yearA !== yearB) {
    return String(yearA).localeCompare(String(yearB));
  }
  if (yearA !== yearB) return yearA ? -1 : 1;
  const numA = getDecisionNumberValue(a) || 0;
  const numB = getDecisionNumberValue(b) || 0;
  return numA - numB;
}

async function flushPendingAttachmentMoves() {
  if (!Array.isArray(pendingAttachmentMoves) || !pendingAttachmentMoves.length) return;
  const remaining = [];
  for (const move of pendingAttachmentMoves) {
    if (!move || !move.fromId || !move.toId || move.fromId === move.toId) continue;
    const ok = await moveRowAttachments(move.fromId, move.toId, move.dataset || currentDataset);
    if (!ok) remaining.push(move);
  }
  pendingAttachmentMoves = remaining;
}

async function deleteAllDatasetRows(recordsToDelete) {
  const grouped = groupRowsByDataset(recordsToDelete);
  if (!grouped.size) return;
  let approvalRequestCount = 0;
  let deletedCount = 0;

  for (const [datasetKey, datasetRows] of grouped.entries()) {
    const cleanRecords = datasetRows.map(stripReportRowMetadata);
    const response = await fetch(buildApiUrl('/api/delete-records', { dataset: datasetKey }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: cleanRecords, dataset: datasetKey })
    });
    const result = await response.json().catch(() => ({}));
    if (result && result.approvalRequired) {
      approvalRequestCount += 1;
      if (window.DeleteApprovalUserNotice) {
        window.DeleteApprovalUserNotice.track(result.request, { message: result.message });
      }
      continue;
    }
    if (!response.ok || (result && result.ok === false)) {
      throw new Error(result?.message || result?.error || `تعذر حذف سجلات ${getDatasetLabel(datasetKey)}.`);
    }
    deletedCount += Number(result.deletedCount || cleanRecords.length || 0);
  }

  selectedRows.clear();
  updateDeleteButton();
  updateSelectAllCheckbox();
  await refreshAllDatasetRows({ preserveScroll: true });
  clearReportDirty();
  if (saveStatus) {
    if (approvalRequestCount && deletedCount) {
      saveStatus.textContent = `تم إرسال ${approvalRequestCount} طلب اعتماد، وتم حذف ${toArabicNumbers(String(deletedCount))} سجل.`;
    } else if (approvalRequestCount) {
      saveStatus.textContent = approvalRequestCount === 1
        ? 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.'
        : `تم إرسال ${toArabicNumbers(String(approvalRequestCount))} طلبات حذف للاعتماد.`;
    } else {
      saveStatus.textContent = `تم حذف ${toArabicNumbers(String(deletedCount))} سجل/سجلات`;
    }
  }
}

async function deleteSelectedRows(){
  if (selectedRows.size === 0) return;
  if (reportShouldWarn()) {
    if (saveStatus) saveStatus.textContent = 'يرجى حفظ التغييرات قبل حذف السجلات.';
    return;
  }
  
  const confirmMessage = `هل أنت متأكد من حذف ${selectedRows.size} سجل؟`;
  if (!confirm(confirmMessage)) return;
  
  const indicesToDelete = Array.from(selectedRows).sort((a, b) => a - b);
  const recordsToDelete = indicesToDelete
    .map((index) => rows[index])
    .filter(Boolean)
    .map((row) => ({ ...row }));
  if (!recordsToDelete.length) return;

  try {
    if (saveStatus) saveStatus.textContent = 'جاري حذف السجلات المحددة...';
    if (isAllDatasetMode()) {
      await deleteAllDatasetRows(recordsToDelete);
      return;
    }
    const response = await fetch(buildApiUrl('/api/delete-records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: recordsToDelete, dataset: currentDataset })
    });
    const result = await response.json().catch(() => ({}));
    if (result && result.approvalRequired) {
      if (window.DeleteApprovalUserNotice) {
        window.DeleteApprovalUserNotice.track(result.request, { message: result.message });
      }
      selectedRows.clear();
      updateDeleteButton();
      updateSelectAllCheckbox();
      if (saveStatus) saveStatus.textContent = result.message || 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.';
      return;
    }
    if (!response.ok || (result && result.ok === false)) {
      throw new Error(result?.message || result?.error || 'تعذر حذف السجلات المحددة.');
    }
    rows = normalizeServerRows(Array.isArray(result.rows) ? result.rows : rows.filter((_, index) => !selectedRows.has(index)));
    selectedRows.clear();
    pagination.page = Math.min(pagination.page, Math.max(1, Math.ceil(rows.length / pagination.size)));
    render();
    clearReportDirty();
    if (saveStatus) saveStatus.textContent = `تم حذف ${result.deletedCount || recordsToDelete.length} سجل/سجلات`;
  } catch (error) {
    console.error('Report delete failed:', error);
    if (saveStatus) saveStatus.textContent = error.message || 'تعذر حذف السجلات المحددة.';
  }
}

async function fetchDatasetRows(datasetKey) {
  const res = await fetch(buildApiUrl('/api/data', { dataset: datasetKey, _: Date.now() }), { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return normalizeServerRows(Array.isArray(json.rows) ? json.rows : [], datasetKey);
}

async function refreshAllDatasetRows(options = {}) {
  const { preserveScroll = true } = options || {};
  const prevScrollTop = preserveScroll && tableWrap ? tableWrap.scrollTop : null;
  const previousPage = pagination.page;
  const datasets = getConcreteDatasetKeys();
  const groups = await Promise.all(datasets.map(async (datasetKey) => {
    try {
      const datasetRows = await fetchDatasetRows(datasetKey);
      return datasetRows.map((row, index) => ({
        ...row,
        __dataset: datasetKey,
        __datasetLabel: getDatasetLabel(datasetKey),
        __sourceIndex: index
      }));
    } catch (error) {
      console.warn('فشل تحميل مصدر بيانات التقرير', datasetKey, error);
      return [];
    }
  }));

  rows = groups.flat();
  await refreshAllDatasetTextIndexEntries();
  const signature = computeRowsSignature(rows);
  lastRowsSignature = signature;
  lastRowsVersion = `all:${signature}`;
  selectedRows.clear();
  pagination.totalPages = Math.max(1, Math.ceil(getFilteredRows().length / pagination.size));
  pagination.page = Math.max(1, Math.min(previousPage, pagination.totalPages));
  render();
  if (preserveScroll && typeof prevScrollTop === 'number' && tableWrap) {
    tableWrap.scrollTop = prevScrollTop;
  }
  return true;
}

async function refreshRows(options = {}) {
  const {
    force = false,
    skipIfEditing = true,
    preserveScroll = true
  } = options;

  if (refreshInFlight) return false;
  if (!force && reportShouldWarn()) return false;
  if (!force && skipIfEditing && typeof document !== 'undefined' && document.hidden) return false;
  if (!force && skipIfEditing && (isInlineEditingActive() || addMode)) return false;

  refreshInFlight = true;
  const selectionSnapshot = captureSelectionKeys();
  const prevScrollTop = preserveScroll && tableWrap ? tableWrap.scrollTop : null;
  const previousPage = pagination.page;

  try {
    if (isAllDatasetMode()) {
      return await refreshAllDatasetRows({ preserveScroll });
    }

    const versionPayload = await fetchRowsVersion();
    if (!force && versionPayload && lastRowsVersion && versionPayload.version === lastRowsVersion) {
      return false;
    }

    const res = await fetch(buildApiUrl('/api/data', { _: Date.now() }), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const normalized = normalizeServerRows(Array.isArray(json.rows) ? json.rows : [], currentDataset);
    const signature = computeRowsSignature(normalized);
    if (!force && lastRowsSignature && signature === lastRowsSignature) {
      if (versionPayload && versionPayload.version) lastRowsVersion = versionPayload.version;
      return false;
    }

    lastRowsSignature = signature;
    lastRowsVersion = versionPayload && versionPayload.version ? versionPayload.version : `rows:${signature}`;
    rows = normalized;
    await refreshReportTextIndexEntries();
    restoreSelectionKeys(selectionSnapshot);

    pagination.totalPages = Math.max(1, Math.ceil(getFilteredRows().length / pagination.size));
    pagination.page = Math.max(1, Math.min(previousPage, pagination.totalPages));

    render();

    if (preserveScroll && typeof prevScrollTop === 'number' && tableWrap) {
      tableWrap.scrollTop = prevScrollTop;
    }

    return true;
  } catch (error) {
    console.error('Load error:', error);
    return null;
  } finally {
    refreshInFlight = false;
  }
}

function canApplyExternalSaveRefresh() {
  if (typeof document !== 'undefined' && document.hidden) return false;
  if (refreshInFlight) return false;
  if (reportShouldWarn()) return false;
  if (isInlineEditingActive() || addMode) return false;
  return true;
}

async function applyPendingExternalSaveRefresh() {
  if (!pendingExternalSaveRefresh) return false;
  if (!canApplyExternalSaveRefresh()) return false;
  const refreshed = await refreshRows({
    force: false,
    skipIfEditing: false,
    preserveScroll: true
  }).catch(() => null);
  if (refreshed === null) {
    pendingExternalSaveRefresh = true;
    scheduleExternalSaveRefresh();
    return false;
  }
  pendingExternalSaveRefresh = false;
  if (externalSaveRefreshTimerId) {
    window.clearInterval(externalSaveRefreshTimerId);
    externalSaveRefreshTimerId = null;
  }
  return refreshed === true;
}

function scheduleExternalSaveRefresh() {
  if (externalSaveRefreshTimerId) return;
  externalSaveRefreshTimerId = window.setInterval(() => {
    void applyPendingExternalSaveRefresh();
  }, 2500);
}

function handleExternalSaveRefresh(event) {
  const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : null;
  if (!detail || detail.kind !== 'save' || detail.programKey !== 'report') return;
  if (detail.dataset && !isAllDatasetMode() && detail.dataset !== currentDataset) return;
  pendingExternalSaveRefresh = true;
  void applyPendingExternalSaveRefresh();
  if (pendingExternalSaveRefresh) {
    scheduleExternalSaveRefresh();
  }
}

window.addEventListener('activity:external-save', handleExternalSaveRefresh);

async function load(initial = false){
  if (initial) {
    console.log('Loading data from server...');
  }
  const updated = await refreshRows({ force: true, skipIfEditing: false, preserveScroll: true });
  if (rows.length === 0) {
    const switched = await autoSwitchToDatasetWithDataIfNeeded();
    if (switched) {
      return;
    }
  }
  if (!updated && rows.length === 0) {
    rows = [];
    render();
  }
}

function startAutoRefresh() {
  if (reportShouldWarn()) return;
  if (autoRefreshTimerId) window.clearInterval(autoRefreshTimerId);
  autoRefreshTimerId = window.setInterval(() => {
    refreshRows({ preserveScroll: true }).catch(() => {});
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimerId) {
    window.clearInterval(autoRefreshTimerId);
    autoRefreshTimerId = null;
  }
}

function handleVisibilityRefresh() {
  if (typeof document === 'undefined' || document.hidden) return;
  refreshRows({ preserveScroll: true }).catch(() => {});
}

async function saveAllDatasetRows() {
  await flushPendingAttachmentMoves();
  const grouped = groupRowsByDataset(rows);
  let savedCount = 0;
  let approvalCount = 0;

  for (const [datasetKey, datasetRows] of grouped.entries()) {
    const sortedRows = datasetRows.slice().sort(compareReportRowsForSave);
    const hasCustomIds = sortedRows.some((r) => String(r && r.id || '').trim());
    const payloadRows = sortedRows.map(stripReportRowMetadata);
    const payload = {
      rows: payloadRows,
      useCustomDecisionNumber: !!(reorderToggle && reorderToggle.checked) || hasCustomIds
    };
    const res = await fetch(buildApiUrl('/api/data', { dataset: datasetKey }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status === 409) {
      let conflictDetails = null;
      try { conflictDetails = await res.json(); } catch (_) {}
      const message = conflictDetails?.error || conflictDetails?.message || `يوجد تعارض في ${getDatasetLabel(datasetKey)}. لم يتم الحفظ.`;
      throw new Error(message);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.error || `تعذر حفظ ${getDatasetLabel(datasetKey)}.`);
    }
    if (json.approvalRequired) {
      approvalCount += 1;
      if (saveStatus) saveStatus.textContent = json.message || `تم إرسال طلب اعتماد ${getDatasetLabel(datasetKey)}.`;
      continue;
    }
    savedCount += 1;
  }

  if (savedCount > 0) {
    await refreshAllDatasetRows({ preserveScroll: true });
  }
  clearReportDirty();
  const t = new Date();
  if (saveStatus) {
    saveStatus.textContent = approvalCount > 0
      ? `تم إرسال ${toArabicNumbers(String(approvalCount))} طلب اعتماد.`
      : `تم حفظ ${toArabicNumbers(String(savedCount))} مصادر بيانات ${t.toLocaleTimeString('ar-EG')}`;
  }
}

async function save(){
  try{
    if (isAllDatasetMode()) {
      await saveAllDatasetRows();
      return;
    }
    if (Array.isArray(rows) && rows.length) {
      rows.sort(compareReportRowsForSave);
    }
    await flushPendingAttachmentMoves();
    console.log('Attempting to save rows:', rows);
  const hasCustomIds = Array.isArray(rows) && rows.some((r) => String(r && r.id || '').trim());
  const payloadRows = rows.map(stripReportRowMetadata);
  const payload = { rows: payloadRows, useCustomDecisionNumber: !!(reorderToggle && reorderToggle.checked) || hasCustomIds };
    console.log('Payload to send:', JSON.stringify(payload));
    
  const res = await fetch(buildApiUrl('/api/data'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Response status:', res.status);
    if (res.status === 409) {
      let conflictDetails = null;
      try { conflictDetails = await res.json(); } catch (_) {}
      const message = conflictDetails?.error || conflictDetails?.message || 'يوجد سجل آخر بنفس الاسم. لم يتم الحفظ.';
      saveStatus.textContent = message;
      return;
    }
    const json = await res.json();
    console.log('Response JSON:', json);
    
    if (json && json.approvalRequired) {
      saveStatus.textContent = json.message || 'تم إرسال طلب الاعتماد إلى المدير والسيكرتير الأول.';
      clearReportDirty();
      return;
    }

    if (json && json.ok){
      const t = new Date();
      saveStatus.textContent = `تم الحفظ ${t.toLocaleTimeString('ar-EG')}`;
      clearReportDirty();
    } else {
      saveStatus.textContent = `تعذر الحفظ: ${json?.error || 'خطأ غير معروف'}`;
    }
  }catch(e){
    console.error('Save error:', e);
    saveStatus.textContent = 'تعذر الحفظ';
  }
}
const saveDebounced = debounce(save, 700);

document.getElementById('addRowBtn').addEventListener('click', () => {
  if (isAllDatasetMode()) {
    if (saveStatus) saveStatus.textContent = 'اختر مصدر بيانات محدد لإضافة سجل.';
    return;
  }
  // Jump to the last page, then enter add mode so the footer appears at the bottom
  const allRows = getFilteredRows();
  pagination.totalPages = Math.max(1, Math.ceil(allRows.length / pagination.size));
  pagination.page = pagination.totalPages;
  render();
  // Enter add mode; do not auto-save until user confirms and later clicks Save
  setAddMode(true);
});

document.getElementById('saveBtn').addEventListener('click', () => {
  save(); // Direct save without debounce
});

document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  void deleteSelectedRows();
});

const tagBtn = document.getElementById('tagAttachmentsBtn');
if (tagBtn) {
  tagBtn.addEventListener('click', async () => {
    if (isAllDatasetMode()) return;
    if (!selectedRows.size) return;
    const ids = Array.from(selectedRows)
      .map((idx) => getAttachmentIdForRow(rows[idx], idx))
      .filter(Boolean);
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) {
      alert('لا توجد مرفقات لوسمها.');
      return;
    }
    tagBtn.disabled = true;
    const originalLabel = tagBtn.textContent;
    tagBtn.textContent = '⏳ جاري الوسم...';
    try {
      const res = await fetch(buildApiUrl('/api/photo-tag'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: uniqueIds, tag: '_26' })
      });
      if (!res.ok) throw new Error('Tag failed');
      await refreshRows({ preserveScroll: true, force: true, skipIfEditing: false });
    } catch (e) {
      alert('تعذر وسم المرفقات.');
    } finally {
      tagBtn.textContent = originalLabel;
      tagBtn.disabled = isAllDatasetMode() || selectedRows.size === 0;
    }
  });
}

document.getElementById('selectAll').addEventListener('change', (e) => {
  const view = currentViewRows || [];
  if (e.target.checked) {
    // Select all rows in current page
    view.forEach(r => selectedRows.add(rows.indexOf(r)));
  } else {
    // Deselect only rows in current page
    view.forEach(r => selectedRows.delete(rows.indexOf(r)));
  }
  render();
});

// CSV download button removed as per request

// Logout: confirm and navigate back to main dashboard instead of stopping the server
document.getElementById('logoutBtn').addEventListener('click', async (event) => {
  try {
    event.preventDefault();
    event.stopPropagation();
  } catch (_) {}
  const proceed = await confirmReportNavigation({
    onSave: async () => {
      await save();
      return !reportShouldWarn();
    }
  });
  if (!proceed) {
    return;
  }
  const logoutBtn = document.getElementById('logoutBtn');
  const originalLabel = logoutBtn ? logoutBtn.textContent : '';
  if (logoutBtn) {
    logoutBtn.disabled = true;
    logoutBtn.textContent = '⏳ جاري الخروج...';
  }
  saveStatus.textContent = 'جاري العودة للقائمة الرئيسية...';
  stopAutoRefresh();

  const target = API_BASE ? `${API_BASE}/main.html` : '/main.html';
  const navigate = () => {
    try {
      window.location.href = target;
    } catch {
      if (logoutBtn) {
        logoutBtn.disabled = false;
        logoutBtn.textContent = originalLabel || '🚪 خروج';
      }
    }
  };

  try {
    setTimeout(navigate, 120);
  } catch {
    navigate();
  }
});

updateDatasetSliderActive(currentDataset);
updateDecisionColumnsVisibility();
updateDecisionHeaderLabel();
updateDatasetModeControls();
initReportSettingsUi();
if (saveStatus) {
  const label = getDatasetLabel(currentDataset);
  saveStatus.textContent = `يتم تحميل بيانات ${label}...`;
}

loadReportSettings()
  .then(() => load(true))
  .then(async () => {
    await applyDeleteApprovalInspectTarget();
    if (saveStatus) {
      const label = getDatasetLabel(currentDataset);
      saveStatus.textContent = `تم تحميل بيانات ${label}`;
    }
  }).finally(() => {
    startAutoRefresh();
  });

document.addEventListener('visibilitychange', handleVisibilityRefresh);
window.addEventListener('beforeunload', stopAutoRefresh);



// Handle Add Footer actions (event delegation)
if (addFoot){
  addFoot.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === 'addCancelBtn'){
      setAddMode(false);
      return;
    }
    if (target.id === 'addConfirmBtn'){
      // Collect values
      const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
      };
      const draft = {
        id: val('add_id'),
        date: formatDateToYYYYMMDD(val('add_date')),
        name: val('add_name'),
        job: val('add_job'),
        license: val('add_license'),
        weapon: val('add_weapon'),
        purpose: val('add_purpose'),
        sector: val('add_sector'),
        police: val('add_station') || '',
        decision: isSplitDecisionDataset() ? '' : val('add_decision'),
        decisionManager: isSplitDecisionDataset() ? val('add_decision_manager') : val('add_decision'),
        decisionPublic: isSplitDecisionDataset() ? val('add_decision_public') : '',
        recommendation: val('add_recommendation'),
      };
      if (isSplitDecisionDataset()) {
        draft.decision = draft.decisionManager || draft.decisionPublic || '';
      }
      if (!draft.sector && draft.police) {
        draft.sector = detectSectorForStation(draft.police) || draft.sector;
      }
      // Basic check: at least one field filled
      const hasAny = Object.values(draft).some(v => v && v.length);
      if (!hasAny){
        // nothing to add
        setAddMode(false);
        return;
      }
      const snapshot = getStationRestrictionSnapshot();
      if (!snapshot.isAdmin) {
        if (!draft.sector || !snapshot.allowedSectorSet.has(draft.sector)) {
          alert('لا يمكنك إضافة بيانات لهذا القطاع.');
          return;
        }
        const allowedStations = getAllowedStationsForSectorKey(draft.sector);
        if (snapshot.hasAnyStationLimits) {
          if (!draft.police) {
            alert('يرجى اختيار القسم المصرح به.');
            return;
          }
        }
        if (draft.police && !allowedStations.includes(normalizeStationName(draft.police, draft.sector))) {
          alert('القسم المختار غير مصرح به.');
          return;
        }
      }
      const duplicateRow = rows.find((entry) => rowsMatchExact(entry, draft));
      if (duplicateRow) {
        const decision = await showDuplicateRowDialog({ existingRow: duplicateRow, pendingRow: draft });
        if (decision !== 'confirm') {
          return;
        }
      }
      const draftYear = extractYearFromDate(draft.date);
      let insertIndex = rows.length;
      if (draftYear) {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const rowYear = extractYearFromDate(rows[i] && rows[i].date);
          if (rowYear === draftYear) {
            insertIndex = i + 1;
            break;
          }
        }
      }
      if (insertIndex >= rows.length) {
        rows.push(draft);
      } else {
        rows.splice(insertIndex, 0, draft);
        if (selectedRows && selectedRows.size) {
          const shifted = new Set();
          selectedRows.forEach((idx) => {
            shifted.add(idx >= insertIndex ? idx + 1 : idx);
          });
          selectedRows = shifted;
        }
      }
      setAddMode(false);
      // jump to last page to show the newly added row
      pagination.totalPages = Math.max(1, Math.ceil(getFilteredRows().length / pagination.size));
      pagination.page = pagination.totalPages;
      render();
      // Automatically save the new row to file
      markReportDirty();
      await save();
      await refreshRows({ force: true, skipIfEditing: false, preserveScroll: true });
    }
  });
}

// Filtering state and logic
const filterIdEl = document.getElementById('filterId');
const filterNameEl = document.getElementById('filterName');
const filterSearchColumnEl = document.getElementById('filterSearchColumn');
const filterDecisionEl = document.getElementById('filterDecision');
const filterSectorEl = document.getElementById('filterSector');
const filterStationEl = document.getElementById('filterStation');
let yearDropdown = document.getElementById('yearDropdown');
let yearToggle = document.getElementById('yearToggle');
let yearMenu = document.getElementById('yearMenu');
let filterYearAll = document.getElementById('filterYearAll');
const reorderToggle = document.getElementById('toggleReorder');

function updateReportSearchPlaceholder() {
  if (!filterNameEl || !filterSearchColumnEl) return;
  const selectedOption = filterSearchColumnEl.selectedOptions && filterSearchColumnEl.selectedOptions[0];
  const selectedLabel = selectedOption ? selectedOption.textContent.trim() : '';
  filterNameEl.placeholder = filterSearchColumnEl.value === '__all__'
    ? 'ابحث في كل الأعمدة'
    : `ابحث في ${selectedLabel || filterSearchColumnEl.value}`;
}

function populateReportSearchColumns() {
  if (!filterSearchColumnEl) return;
  const previous = filterSearchColumnEl.value || '__all__';
  filterSearchColumnEl.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = '__all__';
  allOption.textContent = 'كل الأعمدة';
  filterSearchColumnEl.appendChild(allOption);
  getReportSearchColumns().forEach((column) => {
    const option = document.createElement('option');
    option.value = column.key;
    option.textContent = column.label;
    filterSearchColumnEl.appendChild(option);
  });
  filterSearchColumnEl.value = Array.from(filterSearchColumnEl.options).some((option) => option.value === previous)
    ? previous
    : '__all__';
  updateReportSearchPlaceholder();
}

// Sector -> Stations mapping
const REPORT_FALLBACK_SECTOR_STATIONS = {
  east: ["مكتب تجريبي 01","مكتب تجريبي 02","مكتب تجريبي 03" ,"مكتب تجريبي 04", "مكتب تجريبي 05","مكتب تجريبي 06","مكتب تجريبي 07","مكتب تجريبي 08","مكتب تجريبي 09","مكتب تجريبي 10"],
  west: ["مكتب تجريبي 11","مكتب تجريبي 12","مكتب تجريبي 13","مكتب تجريبي 14","مكتب تجريبي 15","مكتب تجريبي 16","مكتب تجريبي 17","مكتب تجريبي 18","مكتب تجريبي 19"],
  south: ["مكتب تجريبي 20","مكتب تجريبي 21","مكتب تجريبي 22","مكتب تجريبي 23","مكتب تجريبي 24","مكتب تجريبي 25","مكتب تجريبي 26","مكتب تجريبي 27","مكتب تجريبي 28","مكتب تجريبي 29","مكتب تجريبي 30"],
  north: ["مكتب تجريبي 31","مكتب تجريبي 32","مكتب تجريبي 33","مكتب تجريبي 34","مكتب تجريبي 35","مكتب تجريبي 36","مكتب تجريبي 37","مكتب تجريبي 38","مكتب تجريبي 39","مكتب تجريبي 40"],
  sectorfive: ["مكتب تجريبي 41","مكتب تجريبي 42","مكتب تجريبي 43","مكتب تجريبي 44", "مكتب تجريبي 45"]
};

function buildReportSectorStations() {
  const byKey = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorStationsMap === 'function'
    ? SHARED_REFERENCE_DATA.getSectorStationsMap('key')
    : REPORT_FALLBACK_SECTOR_STATIONS;
  const byLabel = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorStationsMap === 'function'
    ? SHARED_REFERENCE_DATA.getSectorStationsMap('label')
    : Object.fromEntries(Object.entries(REPORT_FALLBACK_SECTOR_STATIONS).map(([key, list]) => [
      REPORT_LEGACY_SECTOR_KEY_TO_LABEL[key] || key,
      list
    ]));
  const result = {};
  Object.entries(byKey || {}).forEach(([key, list]) => {
    const stations = Array.isArray(list) ? list.slice() : [];
    if (!stations.length) return;
    const reportKey = resolveReportSectorKey(key) || key;
    result[key] = stations;
    result[reportKey] = stations;
  });
  Object.entries(byLabel || {}).forEach(([label, list]) => {
    const stations = Array.isArray(list) ? list.slice() : [];
    if (!stations.length) return;
    const reportKey = resolveReportSectorKey(label);
    if (reportKey) result[reportKey] = stations;
  });
  Object.entries(REPORT_FALLBACK_SECTOR_STATIONS).forEach(([key, list]) => {
    if (!Array.isArray(result[key]) || !result[key].length) result[key] = list.slice();
  });
  result.police_unit = [];
  result.army_unit = [];
  return result;
}

const sectorStations = buildReportSectorStations();

function detectSectorKeyForStationName(stationName) {
  const target = normalizeStationName(stationName);
  if (!target) return null;
  if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.detectSectorKeyFromStation === 'function') {
    const resolved = SHARED_REFERENCE_DATA.detectSectorKeyFromStation(target);
    if (resolved) return resolveReportSectorKey(resolved) || resolved;
  }
  for (const [key, stations] of Object.entries(sectorStations)) {
    if (Array.isArray(stations) && stations.includes(target)) {
      return resolveReportSectorKey(key) || key;
    }
  }
  return null;
}

function getStationRestrictionSnapshot(forceRefresh = false) {
  const user = getPortalUserProfile();
  let signature = null;
  try {
    signature = JSON.stringify(user);
  } catch (serializationError) {
    console.warn('Unable to serialize portal user snapshot:', serializationError);
  }

  if (!forceRefresh && stationRestrictionCache && stationRestrictionCacheSignature === signature) {
    return stationRestrictionCache;
  }
  const isAdmin = hasPortalAdminAccess(user);
  const allowedSectorKeys = (!user || isAdmin)
    ? ALL_REPORT_SECTOR_KEYS.slice()
    : deriveAllowedReportSectorKeys(user);
  const allowedSectorSet = new Set(allowedSectorKeys);
  const allowedStationsByKey = {};
  const allowedStationSets = {};
  let hasAnyStationLimits = false;

  Object.entries(sectorStations).forEach(([key, list]) => {
    const normalized = Array.isArray(list)
      ? list.map((station) => normalizeStationName(station, key)).filter(Boolean)
      : [];
    allowedStationsByKey[key] = normalized;
    allowedStationSets[key] = new Set(normalized);
  });

  if (user && !isAdmin) {
    const source = extractStationAccessSource(user);
    Object.entries(source).forEach(([identifier, raw]) => {
      const sectorKey = determineSectorKeyFromValue(identifier) || (ALL_REPORT_SECTOR_KEYS.includes(identifier) ? identifier : null);
      if (!sectorKey || !sectorStations[sectorKey]) return;
      const baseList = sectorStations[sectorKey] || [];
      const { list, isAll } = normalizePortalStationList(raw, baseList, sectorKey);
      if (isAll) {
        allowedStationsByKey[sectorKey] = baseList.slice();
        allowedStationSets[sectorKey] = new Set(baseList);
      } else if (list.length) {
        allowedStationsByKey[sectorKey] = list.slice();
        allowedStationSets[sectorKey] = new Set(list);
        if (list.length < baseList.length) hasAnyStationLimits = true;
      } else {
        allowedStationsByKey[sectorKey] = [];
        allowedStationSets[sectorKey] = new Set();
        hasAnyStationLimits = true;
      }
    });
  }

  const unionAllowedStations = new Set();
  Object.entries(allowedStationSets).forEach(([key, set]) => {
    if (!allowedSectorSet.size || allowedSectorSet.has(key) || isAdmin) {
      set.forEach((station) => unionAllowedStations.add(station));
    }
  });

  stationRestrictionCache = {
    user,
    isAdmin,
    allowedSectorKeys,
    allowedSectorSet,
    allowedStationsByKey,
    allowedStationSets,
    hasAnyStationLimits,
    unionAllowedStations
  };
  stationRestrictionCacheSignature = signature;
  return stationRestrictionCache;
}

function getAllowedStationsForSectorKey(sectorKey) {
  const reportSectorKey = normalizeSectorKey(sectorKey);
  if (!reportSectorKey) return [];
  const snapshot = getStationRestrictionSnapshot();
  if (snapshot.isAdmin) {
    return (snapshot.allowedStationsByKey[reportSectorKey] || []).slice();
  }
  if (!snapshot.allowedSectorSet.has(reportSectorKey)) {
    return [];
  }
  return (snapshot.allowedStationsByKey[reportSectorKey] || []).slice();
}

function getAllowedSectorKeys() {
  const snapshot = getStationRestrictionSnapshot();
  const base = snapshot.isAdmin ? ALL_REPORT_SECTOR_KEYS.slice() : snapshot.allowedSectorKeys.slice();
  const extras = [];
  const aggregateMode = isAllDatasetMode();
  if (currentDataset === 'police' || aggregateMode) extras.push('police_unit');
  if (currentDataset === 'military' || aggregateMode) extras.push('army_unit');
  const combined = base.filter((key) => {
    if (key === 'police_unit') return currentDataset === 'police' || aggregateMode;
    if (key === 'army_unit') return currentDataset === 'military' || aggregateMode;
    return true;
  });
  extras.forEach((key) => { if (!combined.includes(key)) combined.push(key); });
  return combined;
}

function isSectorKeyAllowed(sectorKey) {
  const reportSectorKey = normalizeSectorKey(sectorKey);
  if (!reportSectorKey) return false;
  const snapshot = getStationRestrictionSnapshot();
  const aggregateMode = isAllDatasetMode();
  if (reportSectorKey === 'police_unit') return currentDataset === 'police' || aggregateMode;
  if (reportSectorKey === 'army_unit') return currentDataset === 'military' || aggregateMode;
  return snapshot.isAdmin || snapshot.allowedSectorSet.has(reportSectorKey);
}

function renderReportSectorStripes() {
  const container = document.getElementById('reportSectorStripes');
  if (!container || !filterSectorEl) return;
  const options = Array.from(filterSectorEl.options)
    .filter((option) => option.value)
    .map((option) => ({ value: option.value, label: option.textContent.trim(), disabled: option.disabled }));
  container.innerHTML = '';
  options.forEach((option) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sector-stripe sector-stripe--${option.value}`;
    btn.dataset.value = option.value;
    btn.textContent = option.label;
    btn.disabled = !!option.disabled || filterSectorEl.disabled;
    btn.classList.toggle('is-disabled', btn.disabled);
    btn.classList.toggle('is-active', filterSectorEl.value === option.value);
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const next = filterSectorEl.value === option.value ? '' : option.value;
      filterSectorEl.value = next;
      filterSectorEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    container.appendChild(btn);
  });
}

function syncReportSectorStripes() {
  const container = document.getElementById('reportSectorStripes');
  if (!container || !filterSectorEl) return;
  Array.from(container.querySelectorAll('.sector-stripe')).forEach((btn) => {
    const active = btn.dataset.value === filterSectorEl.value;
    btn.classList.toggle('is-active', active);
  });
}

function renderReportStationButtons(stations) {
  const container = document.getElementById('reportStationButtonsContainer');
  if (!container || !filterStationEl) return;
  const items = Array.isArray(stations) ? stations : [];
  container.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('span');
    empty.className = 'station-empty-text';
    empty.textContent = filterSectorEl && filterSectorEl.value ? 'لا توجد أقسام' : 'اختر قطاع';
    container.appendChild(empty);
    return;
  }

  items.forEach((station) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'station-btn';
    btn.dataset.value = station;
    btn.textContent = station;
    const selected = normalizeStationName(filterStationEl.value, filterSectorEl.value) === normalizeStationName(station, filterSectorEl.value);
    btn.classList.toggle('is-selected', selected);
    btn.addEventListener('click', () => {
      const isSelected = normalizeStationName(filterStationEl.value, filterSectorEl.value) === normalizeStationName(station, filterSectorEl.value);
      filterStationEl.value = isSelected ? '' : station;
      filterStationEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    container.appendChild(btn);
  });
}

function syncReportStationButtons() {
  const container = document.getElementById('reportStationButtonsContainer');
  if (!container || !filterStationEl) return;
  const sector = filterSectorEl ? filterSectorEl.value : '';
  Array.from(container.querySelectorAll('.station-btn')).forEach((btn) => {
    const value = btn.dataset.value || '';
    const selected = value && normalizeStationName(filterStationEl.value, sector) === normalizeStationName(value, sector);
    btn.classList.toggle('is-selected', selected);
  });
}

function rowPassesStationRestrictions(row) {
  if (!row) return false;
  const snapshot = getStationRestrictionSnapshot();
  if (!snapshot || snapshot.isAdmin) {
    return true;
  }

  const sectorKey = normalizeSectorKey(row.sector || detectSectorForStation(row.police) || '');
  const stationName = normalizeStationName(row.police, sectorKey);

  const rowDataset = getRowDatasetKey(row) || currentDataset;
  if (sectorKey === 'police_unit') return rowDataset === 'police';
  if (sectorKey === 'army_unit') return rowDataset === 'military';

  if (sectorKey && !snapshot.allowedSectorSet.has(sectorKey)) {
    return false;
  }

  if (!stationName) {
    if (!sectorKey) return false;
    if (!snapshot.allowedSectorSet.has(sectorKey)) return false;
    return !snapshot.hasAnyStationLimits;
  }

  if (!snapshot.unionAllowedStations.has(stationName)) {
    return false;
  }

  if (sectorKey) {
    const allowedSet = snapshot.allowedStationSets[sectorKey];
    if (allowedSet && allowedSet.size && !allowedSet.has(stationName)) {
      return false;
    }
  }
  return true;
}

function restrictSectorFilterToPortalUser() {
  if (!filterSectorEl) {
    return;
  }

  const snapshot = getStationRestrictionSnapshot();
  const previousSector = filterSectorEl.value;
  const previousStation = filterStationEl ? filterStationEl.value : '';
  const allowedKeys = getAllowedSectorKeys();
  const allowedSet = new Set(allowedKeys);

  filterSectorEl.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  if (!snapshot.isAdmin && !allowedKeys.length) {
    placeholder.textContent = 'لا توجد قطاعات متاحة';
    placeholder.selected = true;
    filterSectorEl.appendChild(placeholder);
    filterSectorEl.disabled = true;
    if (filterStationEl) {
      filterStationEl.innerHTML = '<option value="">لا توجد أقسام متاحة</option>';
      filterStationEl.value = '';
      filterStationEl.disabled = true;
    }
    renderReportSectorStripes();
    renderReportStationButtons([]);
    if (previousSector || previousStation) {
      onFilterChange();
    }
    return;
  }

  placeholder.textContent = snapshot.isAdmin || allowedKeys.length > 1 ? 'اختار القطاع' : 'القطاع الوحيد المتاح';
  placeholder.selected = true;
  filterSectorEl.appendChild(placeholder);

  allowedKeys.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = REPORT_SECTOR_KEY_TO_LABEL[key] || key;
    filterSectorEl.appendChild(option);
  });

  filterSectorEl.disabled = false;

  let nextSector = '';
  if (previousSector && (snapshot.isAdmin || allowedSet.has(previousSector))) {
    nextSector = previousSector;
  } else if (!snapshot.isAdmin && allowedKeys.length === 1) {
    nextSector = allowedKeys[0];
  }

  if (nextSector) {
    filterSectorEl.value = nextSector;
    placeholder.selected = false;
  } else {
    filterSectorEl.value = '';
    placeholder.selected = true;
  }

  const stationChanged = populateStations();
  renderReportSectorStripes();
  syncReportSectorStripes();
  const sectorChanged = filterSectorEl.value !== previousSector;
  const stationNow = filterStationEl ? filterStationEl.value : '';

  if (sectorChanged || previousStation !== stationNow || stationChanged) {
    onFilterChange();
  }
}

function populateStations(){
  if (!filterSectorEl || !filterStationEl) return false;

  const previousValue = filterStationEl.value;
  const sector = filterSectorEl.value;
  let stations = [];
  if (sector) {
    stations = getAllowedStationsForSectorKey(sector);
  }
  const hasStations = stations.length > 0;
  const baseLabel = sector ? (hasStations ? 'الكل' : 'لا توجد أقسام متاحة') : 'الكل';
  const options = [`<option value="">${baseLabel}</option>`];
  if (hasStations) {
    options.push(...stations.map((station) => `<option value="${station}">${station}</option>`));
  }
  filterStationEl.innerHTML = options.join('');

  const normalizedPrevious = normalizeStationName(previousValue, sector);
  if (normalizedPrevious && stations.includes(normalizedPrevious)) {
    filterStationEl.value = normalizedPrevious;
  } else {
    filterStationEl.value = '';
  }

  filterStationEl.disabled = !sector || !hasStations;
  renderReportStationButtons(stations);
  return previousValue !== filterStationEl.value;
}

function getFilteredRows(){
  let list = Array.isArray(rows) ? rows.filter(rowPassesStationRestrictions) : [];
  const splitDecision = isSplitDecisionDataset();
  // decision number (رقم القرار)
  const idVal = filterIdEl && filterIdEl.value ? parseInt(toEnglishNumbers(filterIdEl.value),10) : null;
  if (idVal && idVal > 0) {
    list = list.filter((row) => getDecisionNumberValue(row) === idVal);
  }

  // Years dropdown checklist filter
  const selectedYears = getSelectedYearsSet();
  if (selectedYears) {
    if (selectedYears.size === 0) {
      list = [];
    } else {
      list = list.filter((row) => {
        const y = extractYearFromDate(row && row.date);
        return y && selectedYears.has(String(y));
      });
    }
  }
  const nameVal = filterNameEl && filterNameEl.value ? filterNameEl.value.trim() : '';
  if (nameVal){
    const q = createReportSearchQuery(nameVal);
    const selectedColumnKey = filterSearchColumnEl ? (filterSearchColumnEl.value || '__all__') : '__all__';
    const allColumns = getReportSearchColumns();
    const searchColumns = selectedColumnKey === '__all__'
      ? allColumns
      : allColumns.filter((column) => column.key === selectedColumnKey);
    list = list.filter((row) => rowMatchesReportSearch(row, q, searchColumns.length ? searchColumns : allColumns));
  }
  const decisionVal = filterDecisionEl ? filterDecisionEl.value : 'all';
  if (decisionVal && decisionVal !== 'all'){
    // Map any free-text decision to a category
    const categorize = (txt='') => {
      const t = String(txt).trim();
      if (/الموافقة علي الالغاء/.test(t)) return 'cancelled';
      if (/عدم\s*الموافقة/.test(t)) return 'rejected';
      if (/الموافقة/.test(t)) return 'accepted';
      return 'other';
    };
    list = list.filter((r) => {
      const targets = splitDecision ? [r.decisionManager, r.decisionPublic] : [r.decision];
      return targets.some((val) => categorize(val) === decisionVal);
    });
  }
  // Sector/Station filter (by station value)
  const chosenStation = filterStationEl ? filterStationEl.value.trim() : '';
  if (chosenStation){
    list = list.filter((r) => normalizeStationName(r.police, r.sector) === normalizeStationName(chosenStation, filterSectorEl ? filterSectorEl.value : ''));
  } else if (filterSectorEl && filterSectorEl.value){
    const sectorKey = filterSectorEl.value;
    const allowedStations = getAllowedStationsForSectorKey(sectorKey);
    const fallbackStations = sectorStations[sectorKey] || [];
    const targetStations = allowedStations.length ? allowedStations : fallbackStations;
    if (targetStations.length) {
      const stationSet = new Set(targetStations.map((station) => normalizeStationName(station, sectorKey)));
      list = list.filter((r) => stationSet.has(normalizeStationName(r.police, sectorKey)));
    } else {
      list = list.filter((r) => normalizeSectorKey(r.sector) === sectorKey);
    }
  }
  if (isAllDatasetMode()) {
    list = list.slice().sort((left, right) => {
      const datasetDelta = getDatasetSortRank(getRowDatasetKey(left)) - getDatasetSortRank(getRowDatasetKey(right));
      if (datasetDelta) return datasetDelta;
      const leftSource = Number(left?.__sourceIndex);
      const rightSource = Number(right?.__sourceIndex);
      if (Number.isFinite(leftSource) && Number.isFinite(rightSource)) return leftSource - rightSource;
      return rows.indexOf(left) - rows.indexOf(right);
    });
  }
  return list;
}

function onFilterChange(){ pagination.page = 1; render(); }

const FILTER_INPUT_DEBOUNCE_MS = 200;
let filterInputDebounceTimer = null;
let filterInputComposing = false;
function scheduleFilterChange(){
  if (filterInputComposing) return;
  if (filterInputDebounceTimer) clearTimeout(filterInputDebounceTimer);
  filterInputDebounceTimer = setTimeout(() => {
    filterInputDebounceTimer = null;
    onFilterChange();
  }, FILTER_INPUT_DEBOUNCE_MS);
}
function applyFilterChangeNow(){
  if (filterInputDebounceTimer) {
    clearTimeout(filterInputDebounceTimer);
    filterInputDebounceTimer = null;
  }
  onFilterChange();
}

if (filterIdEl) {
  // Sanitize while typing, then debounce table filtering so the UI stays responsive.
  filterIdEl.addEventListener('input', () => {
      const el = filterIdEl;
      const before = el.value;
      // Allow only Arabic (٠-٩) and ASCII (0-9) digits. Strip everything else.
      const cleaned = before.replace(/[^0-9٠-٩]/g, '');
      // If sanitized differs, update value and attempt to restore caret suitably
      if (el.value !== cleaned) {
        el.value = cleaned;
        try {
          // place caret at end of previous selection to avoid jumping too far
          const pos = Math.min(cleaned.length, el.selectionStart);
          el.setSelectionRange(pos, pos);
        } catch (err) {}
      }
      scheduleFilterChange();
  });

  filterIdEl.addEventListener('blur', (e) => {
    const el = e.target;
    const englishValue = toEnglishNumbers((el.value||'').replace(/[^0-9٠-٩]/g, ''));
    el.value = toArabicNumbers(englishValue);
  });

  // Allow user to press Enter to commit filter immediately
  filterIdEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilterChangeNow();
    }
  });
}
if (filterNameEl) {
  filterNameEl.addEventListener('compositionstart', () => {
    filterInputComposing = true;
  });
  filterNameEl.addEventListener('compositionend', () => {
    filterInputComposing = false;
    scheduleFilterChange();
  });
  filterNameEl.addEventListener('input', scheduleFilterChange);
  filterNameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilterChangeNow();
    }
  });
}
populateReportSearchColumns();
if (filterSearchColumnEl) {
  filterSearchColumnEl.addEventListener('change', () => {
    updateReportSearchPlaceholder();
    onFilterChange();
  });
}
if (filterDecisionEl) filterDecisionEl.addEventListener('change', onFilterChange);
if (filterSectorEl) filterSectorEl.addEventListener('change', () => {
  populateStations();
  syncReportSectorStripes();
  onFilterChange();
});
if (filterStationEl) filterStationEl.addEventListener('change', () => {
  syncReportStationButtons();
  onFilterChange();
});

// Pager buttons
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const firstPageBtn = document.getElementById('firstPage');
const lastPageBtn = document.getElementById('lastPage');
function scrollTableToTop(){
  if (tableWrap) tableWrap.scrollTop = 0;
  try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { window.scrollTo(0, 0); }
}
if (prevPageBtn) {
  prevPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (pagination.page > 1) {
      pagination.page -= 1;
      render();
      scrollTableToTop();
    }
  });
}
if (nextPageBtn) {
  nextPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (pagination.page < pagination.totalPages) {
      pagination.page += 1;
      render();
      scrollTableToTop();
    }
  });
}
if (firstPageBtn) {
  firstPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (pagination.page !== 1) {
      pagination.page = 1;
      render();
      scrollTableToTop();
    }
  });
}
if (lastPageBtn) {
  lastPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (pagination.page !== pagination.totalPages) {
      pagination.page = pagination.totalPages;
      render();
      scrollTableToTop();
    }
  });
}

// Initialize dependent dropdown
restrictSectorFilterToPortalUser();
populateStations();

// Years dropdown interactions
if (yearDropdown && yearToggle && yearMenu && filterYearAll){
  yearMenu.hidden = true;
  let yearMenuOpen = false;
  const resetMenuStyle = () => {
    yearMenu.style.position = '';
    yearMenu.style.top = '';
    yearMenu.style.right = '';
    yearMenu.style.left = '';
    yearMenu.style.minWidth = '';
    yearMenu.style.maxHeight = '';
    yearMenu.style.zIndex = '';
  };
  const applyMenuPosition = () => {
    if (!yearMenuOpen) return;
    const rect = yearToggle.getBoundingClientRect();
    yearMenu.style.position = 'fixed';
    yearMenu.style.top = `${Math.round(rect.bottom + 8)}px`;
    yearMenu.style.left = 'auto';
    yearMenu.style.right = `${Math.max(window.innerWidth - rect.right, 12)}px`;
    yearMenu.style.minWidth = `${Math.max(rect.width, 220)}px`;
    yearMenu.style.maxHeight = '70vh';
    yearMenu.style.zIndex = '2200';
  };
  const openMenu = () => {
    if (yearMenuOpen) return;
    yearMenu.hidden = false;
    yearMenuOpen = true;
    applyMenuPosition();
    requestAnimationFrame(applyMenuPosition);
  };
  const closeMenu = () => {
    if (!yearMenuOpen) return;
    yearMenu.hidden = true;
    yearMenuOpen = false;
    resetMenuStyle();
  };
  yearToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (yearMenuOpen) closeMenu();
    else openMenu();
  });
  yearMenu.addEventListener('click', (e) => { e.stopPropagation(); });
  yearMenu.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  document.addEventListener('click', () => { closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', applyMenuPosition);
  document.addEventListener('scroll', applyMenuPosition, true);

  // Ensure label is correct on init
  updateYearToggleLabel();
}

// Initialize reorder toggle from localStorage
if (reorderToggle){
  const saved = localStorage.getItem('reorderEnabled');
  const enabled = saved === null ? true : saved === '1';
  reorderToggle.checked = enabled;
  document.body.classList.toggle('no-reorder', !enabled);
  reorderToggle.addEventListener('change', () => {
    const on = reorderToggle.checked;
    document.body.classList.toggle('no-reorder', !on);
    localStorage.setItem('reorderEnabled', on ? '1' : '0');
    // Update add-footer layout to match new column presence
    renderAddFooter();
    render();
  });
}

// ════════════════════════════════════════════════════════════════════
//  OCR
// ════════════════════════════════════════════════════════════════════
(function initOcr() {
  const scanOpenBtn = document.getElementById('ocrScanOpenBtn');
  const scanModal   = document.getElementById('ocrScanModal');
  const modalClose  = document.getElementById('ocrModalClose');
  const startBtn    = document.getElementById('ocrStartBtn');
  if (!scanOpenBtn || !scanModal) return;

  // ── Scan modal open/close ──────────────────────────────────────
  function openScanModal() {
    if (!isReportOcrEnabled()) return;
    scanModal.hidden = false;

    // Resume status if a scan is already running or finished
    fetch(buildApiUrl('/api/report/ocr/status'))
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.progress) return;
        const prog = data.progress;
        renderOcrProgress(prog);
        document.getElementById('ocrProgressWrap').hidden = false;
        document.getElementById('ocrTimeRow').hidden = !prog.startedAt;
        if (prog.running) {
          document.getElementById('ocrCurrentInfo').hidden = false;
          startBtn.disabled = true;
          startBtn.textContent = '⏳ جاري...';
          setOcrStatusAnimated('جاري الفحص…');
          if (!_pollTimer) pollOcrProgress();
          return; // don't show check info while scan is active
        } else if (prog.finishedAt) {
          const ok = (prog.scanned || 0) + (prog.updated || 0);
          setOcrStatus(`✓ اكتمل — جديدة: ${ok} | مخزنة: ${prog.skipped||0} | صفحات: ${prog.savedPages||0} | أخطاء: ${prog.failed||0}`);
          startBtn.disabled = false;
          startBtn.textContent = '▶ إعادة الفحص';
          return;
        }
        // No previous scan — show pre-check info
        showPreScanInfo();
      })
      .catch(() => showPreScanInfo());

    function showPreScanInfo() {
      if (selectedRows.size > 0) {
        const ids = Array.from(selectedRows).map(idx => getDecisionNumberValue(rows[idx])).filter(Boolean);
        fetch(buildApiUrl('/api/report/ocr/check'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIds: ids, category: currentDataset }),
        })
          .then(r => r.json())
          .then(data => {
            if (!data.ok) return;
            const doneCount = data.result.filter(r => r.scanned).length;
            const newCount  = data.result.length - doneCount;
            if (doneCount === data.result.length) {
              setOcrStatus(`✓ كل القرارات المحددة (${doneCount}) تم فحصها مسبقاً — اضغط لإعادة الفحص`);
            } else if (doneCount > 0) {
              setOcrStatus(`${doneCount} تم فحصه مسبقاً (سيُتخطى) ، ${newCount} جديد للفحص`);
            } else {
              setOcrStatus(`${newCount} قرار محدد جاهز للفحص`);
            }
          })
          .catch(() => {});
      } else {
        fetch(buildApiUrl('/api/report/ocr/stats'))
          .then(r => r.json())
          .then(data => {
            if (!data.ok || !data.stats) return;
            const { decisions } = data.stats;
            if (decisions > 0) {
              setOcrStatus(`${decisions} قرار في قاعدة البيانات — المكتملة ستُتخطى تلقائياً`);
            }
          })
          .catch(() => {});
      }
    }
  }
  function closeScanModal() {
    scanModal.hidden = true;
    // Stop UI polling — the server scan keeps running in the background
    clearTimeout(_pollTimer);
    _pollTimer = null;
    stopSpinner();
  }

  scanOpenBtn.addEventListener('click', openScanModal);
  modalClose.addEventListener('click', closeScanModal);
  scanModal.addEventListener('click', e => { if (e.target === scanModal) closeScanModal(); });

  // ── Start scan ────────────────────────────────────────────────
  startBtn.addEventListener('click', async () => {
    if (!isReportOcrEnabled()) return;
    startBtn.disabled = true;
    startBtn.textContent = '⏳ جاري...';
    setOcrStatus('جاري بدء الفحص...');
    try {
      const body = { category: currentDataset };
      if (selectedRows.size > 0) {
        body.rowIds = Array.from(selectedRows).map(idx => getDecisionNumberValue(rows[idx])).filter(Boolean);
      }
      const res = await fetch(buildApiUrl('/api/report/ocr/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'فشل البدء');
      setOcrStatus('جاري الفحص...');
      document.getElementById('ocrProgressWrap').hidden = false;
      document.getElementById('ocrCurrentInfo').hidden = false;
      pollOcrProgress();
    } catch (e) {
      setOcrStatus('خطأ: ' + e.message);
      startBtn.disabled = false;
      startBtn.textContent = '▶ بدء الفحص';
    }
  });

  // ── Helpers ───────────────────────────────────────────────────
  function setOcrStatus(msg) {
    const el = document.getElementById('ocrStatusText');
    if (el) el.textContent = msg;
  }

  function fmtSec(sec) {
    if (sec == null || sec < 0) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // JS-driven activity pulse since CSS animations are globally disabled
  let _spinnerFrame = 0;
  const SPINNER_CHARS = ['◐','◓','◑','◒'];
  let _spinnerTimer = null;
  function startSpinner() {
    clearInterval(_spinnerTimer);
    _spinnerTimer = setInterval(() => {
      const el = document.getElementById('ocrStatusText');
      if (el && el.dataset.base) {
        _spinnerFrame = (_spinnerFrame + 1) % SPINNER_CHARS.length;
        el.textContent = SPINNER_CHARS[_spinnerFrame] + ' ' + el.dataset.base;
      }
    }, 300);
  }
  function stopSpinner() {
    clearInterval(_spinnerTimer);
    _spinnerTimer = null;
  }
  function setOcrStatusAnimated(msg) {
    const el = document.getElementById('ocrStatusText');
    if (el) { el.dataset.base = msg; el.textContent = SPINNER_CHARS[0] + ' ' + msg; }
    startSpinner();
  }

  function renderOcrProgress(prog) {
    const total = prog.total || 0;
    const done  = (prog.scanned || 0) + (prog.skipped || 0) + (prog.updated || 0) + (prog.failed || 0);
    const pct   = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : (prog.running ? 0 : 100);

    // Progress bar
    document.getElementById('ocrProgressBar').style.width = pct + '%';
    document.getElementById('ocrProgressPct').textContent = pct + '%';

    // Time row
    const timeRow = document.getElementById('ocrTimeRow');
    if (timeRow && (prog.startedAt || prog.elapsedSeconds != null)) {
      timeRow.hidden = false;
      document.getElementById('ocrElapsed').textContent = fmtSec(prog.elapsedSeconds);
      const etaEl = document.getElementById('ocrEta');
      if (prog.running && prog.etaSeconds != null) {
        etaEl.textContent = fmtSec(prog.etaSeconds);
      } else if (prog.running && prog.etaPendingReason === 'waiting-for-first-page') {
        etaEl.textContent = 'بعد أول صفحة';
      } else {
        etaEl.textContent = prog.running ? 'جارٍ الحساب' : fmtSec(0);
      }
    }
    document.getElementById('ocrSavedPages').textContent = prog.savedPages ?? '—';

    // Stats
    document.getElementById('ocrTotal').textContent   = total || '—';
    document.getElementById('ocrScanned').textContent = prog.scanned ?? '—';
    document.getElementById('ocrSkipped').textContent = prog.skipped ?? '—';
    document.getElementById('ocrUpdated').textContent = prog.updated ?? '—';
    document.getElementById('ocrFailed').textContent  = prog.failed  ?? '—';

    // Current file info
    document.getElementById('ocrCurrentDecision').textContent = prog.currentDecision || '—';
    const currentFileText = prog.currentFile
      ? `${prog.currentFile}${prog.currentElapsedSeconds != null ? ` · ${fmtSec(prog.currentElapsedSeconds)}` : ''}`
      : '—';
    document.getElementById('ocrCurrentFile').textContent = currentFileText;

    // Log
    const logEl = document.getElementById('ocrLog');
    if (logEl && Array.isArray(prog.log)) {
      logEl.innerHTML = prog.log.map(e => `<div>[${e.t}] ${escapeHtml(e.msg)}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Polling (declared early so closeScanModal can reference it) ──
  let _pollTimer = null;

  async function pollOcrProgress() {
    clearTimeout(_pollTimer);
    if (!isReportOcrEnabled()) return;
    try {
      const res  = await fetch(buildApiUrl('/api/report/ocr/status'));
      const data = await res.json();
      if (!data.ok) return;
      const prog = data.progress;
      renderOcrProgress(prog);

      if (prog.running) {
        const currentElapsed = prog.currentElapsedSeconds != null
          ? ` | الحالي ${fmtSec(prog.currentElapsedSeconds)}`
          : '';
        setOcrStatusAnimated(prog.total > 0
          ? `جاري الفحص… ${(prog.scanned||0)+(prog.skipped||0)+(prog.updated||0)+(prog.failed||0)} / ${prog.total}${currentElapsed}`
          : 'جاري جمع الملفات…');
        _pollTimer = setTimeout(pollOcrProgress, 1500);
      } else {
        stopSpinner();
        const scanned = (prog.scanned || 0) + (prog.updated || 0);
        const el = document.getElementById('ocrStatusText');
        if (el) { delete el.dataset.base; }
        setOcrStatus(
          prog.error
            ? 'خطأ: ' + prog.error
            : `✓ اكتمل في ${fmtSec(prog.elapsedSeconds)} — جديدة: ${scanned} | مخزنة: ${prog.skipped||0} | صفحات: ${prog.savedPages||0} | أخطاء: ${prog.failed||0}`
        );
        startBtn.disabled = false;
        startBtn.textContent = '▶ إعادة الفحص';
      }
    } catch (e) {
      setOcrStatus('خطأ في الاتصال: ' + e.message);
      _pollTimer = setTimeout(pollOcrProgress, 5000);
    }
  }

})();

// ════════════════════════════════════════════════════════════════════
//  OCR — Search Panel
// ════════════════════════════════════════════════════════════════════
(function initOcrSearch() {
  const toggleBtn    = document.getElementById('ocrSearchToggle');
  const content      = document.getElementById('ocrSearchContent');
  const queryInput   = document.getElementById('ocrSearchQuery');
  const decisionInput= document.getElementById('ocrSearchDecision');
  const categorySel  = document.getElementById('ocrSearchCategory');
  const searchBtn    = document.getElementById('ocrSearchBtn');
  const resultsEl    = document.getElementById('ocrSearchResults');
  if (!toggleBtn || !content) return;

  let panelOpen = false;
  toggleBtn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    content.hidden = !panelOpen;
    toggleBtn.textContent = `🔍 بحث داخل المرفقات (OCR) ${panelOpen ? '▾' : '▸'}`;
  });

  const doSearch = async () => {
    if (!isReportOcrEnabled()) return;
    const query    = (queryInput?.value || '').trim();
    const decision = (decisionInput?.value || '').trim();
    const category = categorySel?.value || '';
    if (!query && !decision) {
      resultsEl.innerHTML = '<div class="ocr-no-results">أدخل نص البحث أو رقم القرار</div>';
      return;
    }
    resultsEl.innerHTML = '<div class="ocr-no-results">جاري البحث...</div>';
    try {
      const params = {};
      if (query) params.query = query;
      if (decision) params.decisionNumber = decision;
      if (category) params.category = category;
      const url = buildApiUrl('/api/report/ocr/search', params);
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      renderOcrSearchResults(data.results || [], query);
    } catch (e) {
      resultsEl.innerHTML = `<div class="ocr-no-results">خطأ: ${e.message}</div>`;
    }
  };

  searchBtn?.addEventListener('click', doSearch);
  queryInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  decisionInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  function highlightQuery(text, query) {
    if (!query || !text) return escHtml(text || '');
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map(p => p.toLowerCase() === query.toLowerCase() ? `<em>${escHtml(p)}</em>` : escHtml(p)).join('');
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  const CAT_LABELS = { civilians: 'مدنيين', police: 'شرطة', military: 'قوات مسلحة' };

  function renderOcrSearchResults(results, query) {
    if (!results.length) {
      resultsEl.innerHTML = '<div class="ocr-no-results">لا توجد نتائج</div>';
      return;
    }
    resultsEl.innerHTML = results.map(r => `
      <div class="ocr-result-row" data-decision="${escHtml(r.decisionNumber)}" data-category="${escHtml(r.category)}">
        <div class="ocr-result-meta">
          <b>قرار ${escHtml(r.decisionNumber)}</b><br>
          ${escHtml(CAT_LABELS[r.category] || r.category)}<br>
          ملف: ${escHtml(r.letterCounter || '')} — صفحة ${r.pageNumber}<br>
          <span style="font-size:.75rem">${escHtml(r.originalFileName)}</span>
        </div>
        <div class="ocr-result-snippet">${highlightQuery(r.snippet || '', query)}</div>
      </div>
    `).join('');

    // Click row → open OCR results for that decision
    resultsEl.querySelectorAll('.ocr-result-row').forEach(row => {
      row.addEventListener('click', () => {
        const dec = row.dataset.decision;
        const cat = row.dataset.category;
        openOcrResultsModal(dec, cat);
      });
    });
  }
})();

// ════════════════════════════════════════════════════════════════════
//  OCR — Results Modal (view all pages for a decision)
// ════════════════════════════════════════════════════════════════════
async function openOcrResultsModal(decisionNumber, category) {
  if (!isReportOcrEnabled()) return;
  const modal     = document.getElementById('ocrResultsModal');
  const title     = document.getElementById('ocrResultsTitle');
  const body      = document.getElementById('ocrResultsBody');
  const closeBtn  = document.getElementById('ocrResultsClose');
  if (!modal) return;

  modal.hidden = false;
  title.textContent = `نتائج OCR — قرار #${decisionNumber}`;
  body.innerHTML = '<div class="ocr-loading">جاري التحميل...</div>';

  const onClose = () => { modal.hidden = true; };
  closeBtn.onclick = onClose;
  modal.onclick = e => { if (e.target === modal) onClose(); };

  try {
    const params = { decisionNumber };
    if (category) params.category = category;
    const url = buildApiUrl('/api/report/ocr/results', params);
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    renderOcrResultsBody(body, data.rows || [], decisionNumber, category);
  } catch (e) {
    body.innerHTML = `<div class="ocr-loading" style="color:#d32f2f">خطأ: ${e.message}</div>`;
  }
}

function renderOcrResultsBody(container, rows, decisionNumber, category) {
  if (!rows.length) {
    container.innerHTML = '<div class="ocr-loading">لا توجد نتائج OCR لهذا القرار</div>';
    return;
  }
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.uploadFileKey)) groups.set(row.uploadFileKey, []);
    groups.get(row.uploadFileKey).push(row);
  }
  const CAT_LABELS = { civilians: 'مدنيين', police: 'شرطة', military: 'قوات مسلحة' };
  let html = '';
  for (const [key, pages] of groups) {
    const first = pages[0];
    const catLabel = CAT_LABELS[first.category] || first.category;
    html += `<div class="ocr-file-group">
      <div class="ocr-file-group-header">
        <span>📎 ${escHtmlInline(first.originalFileName)} &nbsp;·&nbsp; ${catLabel} &nbsp;·&nbsp; ${pages.length} صفحة</span>
        <button class="ocr-delete-entry-btn" data-key="${escHtmlInline(key)}">🗑️ حذف وإعادة الفحص</button>
      </div>`;
    for (const pg of pages) {
      const status = pg.scanStatus === 'failed'
        ? `<span style="color:#d32f2f">فشل: ${escHtmlInline(pg.errorMessage || '')}</span>`
        : (pg.extractedText ? '' : '<span style="color:#999">لا نص</span>');
      html += `<div class="ocr-page-block">
        <div class="ocr-page-label">صفحة ${pg.pageNumber}</div>
        <div class="ocr-text-page" dir="rtl">${status || escHtmlInline(pg.extractedText)}</div>
      </div>`;
    }
    html += '</div>';
  }
  container.innerHTML = html;

  container.querySelectorAll('.ocr-delete-entry-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('حذف نتيجة OCR لهذا الملف؟ سيتم إعادة فحصه في المرة القادمة.')) return;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const url = buildApiUrl('/api/report/ocr/entry', { key: btn.dataset.key });
        const res  = await fetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) openOcrResultsModal(decisionNumber, category);
        else { btn.disabled = false; btn.textContent = '🗑️ حذف وإعادة الفحص'; }
      } catch { btn.disabled = false; btn.textContent = '🗑️ حذف وإعادة الفحص'; }
    });
  });
}

function escHtmlInline(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════════════════════════════════
//  OCR — Integrate into Photo Modal (show OCR text button)
// ════════════════════════════════════════════════════════════════════
// Monkey-patch getAttachmentIdForRow usage in photo modal to expose OCR:
// We add an OCR button inside the photo-modal-footer when photos are loaded.
(function patchPhotoModalForOcr() {
  // Override the photo cell render to also inject an OCR view button
  const origTdPhotoCell = typeof tdPhotoCell !== 'undefined' ? tdPhotoCell : null;
  if (!origTdPhotoCell) return;
  // We hook into document body click delegation since photo modal is dynamic
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('.btn-photo-view-ocr');
    if (!btn) return;
    if (!isReportOcrEnabled()) return;
    const decisionId = btn.dataset.decision;
    const category   = btn.dataset.category || currentDataset;
    if (decisionId) openOcrResultsModal(decisionId, category);
  });
})();

// Future: add more filters (date range, job, license, weapon, police, etc.)
