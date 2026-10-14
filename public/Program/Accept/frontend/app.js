// ===== Utilities: Arabic ↔ English digits =====
const EN_TO_AR = { '0':'٠','1':'١','2':'٢','3':'٣','4':'٤','5':'٥','6':'٦','7':'٧','8':'٨','9':'٩' };
const AR_TO_EN = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
function toArabicDigits(s){return String(s).replace(/[0-9]/g,d=>EN_TO_AR[d]||d)}
function toEnglishDigits(s){return String(s).replace(/[٠-٩]/g,d=>AR_TO_EN[d]||d)}

// ===== Data =====
const ROLE_LABELS = { admin:'مدير', secretary:'سكرتير', user:'مستخدم' };
const RANK_OPTIONS = [
  'لواء',
  'لواء مساعد',
  'لواء معاش',
  'عميد',
  'عقيد',
  'مقدم',
  'رائد',
  'نقيب',
  'ملازم اول',
  'ملازم'
];

const RANK_OPTION_PREFIXES = [...new Set(RANK_OPTIONS)].sort((a,b)=>b.length - a.length);
const RANK_OPTION_SIMPLIFIED = new Map(RANK_OPTION_PREFIXES.map((option)=>[
  normalizeText(option).replace(/[أإآ]/g,'ا'),
  option
]));
const RANK_SECOND_WORD_ALIASES = new Set(['اول','أول','اولى','أولى','معاش']);

const SPECIALIZATION_OPTIONS = ['فقط','دكتور','مهندس','شرف','معاش'];
const SPECIALIZATION_CANONICAL = new Map(SPECIALIZATION_OPTIONS.map((option)=>[
  normalizeText(option),
  option
]));

function normalizeSpecialization(value){
  const cleaned = normalizeText(value);
  return SPECIALIZATION_CANONICAL.get(cleaned) || 'فقط';
}

/** Is this text one of the ranks in the list, spelling aside? */
function isKnownRankOption(value){
  const simplified = normalizeText(value).replace(/[أإآ]/g,'ا');
  return simplified ? RANK_OPTION_SIMPLIFIED.has(simplified) : false;
}

function finalizeRankSpecialization(rank, specialization){
  let cleanSpecialization = normalizeSpecialization(specialization);
  let canonicalRank = canonicalizeRank(rank);
  if(!canonicalRank){
    canonicalRank = normalizeText(rank);
  }

  // A rank and a specialization that together spell one of the ranks in the list
  // are that rank: "لواء" + "معاش" is the لواء معاش rank, which filters on its
  // own and is never merged with لواء or لواء مساعد.
  if(cleanSpecialization !== 'فقط'){
    const combined = `${canonicalRank} ${cleanSpecialization}`.trim();
    if(isKnownRankOption(combined)){
      canonicalRank = canonicalizeRank(combined) || combined;
      cleanSpecialization = 'فقط';
    }
  }

  return {
    rank: canonicalRank,
    specialization: cleanSpecialization
  };
}

function splitRankAndSpecialization(rawRank){
  const normalized = normalizeText(rawRank);
  if(!normalized) return { rank: '', specialization: 'فقط' };

  // A rank that carries a specialization word in its own name ("لواء معاش") is
  // a whole rank, so it is never taken apart into rank + specialization.
  if(isKnownRankOption(normalized)){
    return finalizeRankSpecialization(normalized, 'فقط');
  }

  const simplified = normalized.replace(/[أإآ]/g,'ا');
  for(const option of SPECIALIZATION_OPTIONS){
    if(option === 'فقط') continue;
    const optionNormalized = normalizeText(option);
    const optionSimplified = optionNormalized.replace(/[أإآ]/g,'ا');

    const prefix = `${optionNormalized} `;
    const prefixSimplified = `${optionSimplified} `;
    if(normalized.startsWith(prefix) || simplified.startsWith(prefixSimplified)){
      const remainder = normalizeText(normalized.slice(prefix.length));
      return finalizeRankSpecialization(remainder, option);
    }

    const suffix = ` ${optionNormalized}`;
    const suffixSimplified = ` ${optionSimplified}`;
    if(normalized.endsWith(suffix) || simplified.endsWith(suffixSimplified)){
      const remainder = normalizeText(normalized.slice(0, normalized.length - suffix.length));
      return finalizeRankSpecialization(remainder, option);
    }
  }

  return finalizeRankSpecialization(normalized, 'فقط');
}

function composeRankWithSpecialization(rank, specialization){
  const base = normalizeText(rank);
  const cleanSpecialization = normalizeSpecialization(specialization);
  if(cleanSpecialization !== 'فقط'){
    return `${base} ${cleanSpecialization}`.trim();
  }
  return base;
}

function formatRankDisplay(rank, specialization){
  const cleanRank = normalizeText(rank);
  const cleanSpecialization = normalizeSpecialization(specialization);
  if(cleanSpecialization !== 'فقط' && cleanSpecialization){
    return `${cleanRank} ${cleanSpecialization}`.trim();
  }
  return cleanRank;
}

function getEffectiveRank(record){
  if(!record) return '';
  const parts = splitRankAndSpecialization(record.rank);
  const specialization = normalizeSpecialization(record?.specialization || parts.specialization);
  return composeRankWithSpecialization(parts.rank, specialization);
}

const LOCATION_OPTIONS = ['مدينة تجريبية'];
const WEAPON_TYPE_OPTIONS = ['مسدس','بندقية خرطوش','بندقية رصاص'];
const LICENSE_TYPE_LABEL = 'نوع الموافقة شئون الضباط';
const LICENSE_TYPE_OPTIONS = ['اعفاء اول مرة','اضافة','استبدال السلاح','اخرى'];

const SAMPLE_RECORDS = [
  {
    "id": 1,
    "rank": "موظف تجريبي",
    "name": "سجل تجريبي 01",
    "workplace": "الإدارة التجريبية",
    "incomingDate": "2026-01-01",
    "residence": "مدينة تجريبية",
    "licenseType": "اخرى",
    "weaponType": "DEMO-ASSET-001"
  },
  {
    "id": 2,
    "rank": "موظف تجريبي",
    "name": "سجل تجريبي 02",
    "workplace": "الإدارة التجريبية",
    "incomingDate": "2026-01-02",
    "residence": "مدينة تجريبية",
    "licenseType": "اخرى",
    "weaponType": "DEMO-ASSET-002"
  },
  {
    "id": 3,
    "rank": "موظف تجريبي",
    "name": "سجل تجريبي 03",
    "workplace": "الإدارة التجريبية",
    "incomingDate": "2026-01-03",
    "residence": "مدينة تجريبية",
    "licenseType": "اخرى",
    "weaponType": "DEMO-ASSET-003"
  }
];

const API_ENDPOINT = '/api/accept/records';
const VERSION_ENDPOINT = '/api/accept/records/version';
const DELETE_ENDPOINT = '/api/accept/records/delete';
const DELETED_ENDPOINT = '/api/accept/records/deleted';
const RESTORE_ENDPOINT = '/api/accept/records/restore';
const CLEAR_TMP_ENDPOINT = '/api/accept/tmp/clear';
const SORT_CHOICES_ENDPOINT = '/api/accept/sort-choices';
const IMPORT_PREVIEW_ENDPOINT = '/api/accept/import/preview';
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';

const SORTABLE_COLUMNS = ['rank','name','workplace','incomingDate','residence','licenseType','weaponType'];
const DEFAULT_SORT_STATE = Object.freeze({ column: 'incomingDate', direction: 'desc' });
const SORT_COLUMN_LABELS = Object.freeze({
  rank: 'الرتبة',
  name: 'الاسم',
  workplace: 'جهة العمل',
  incomingDate: 'تاريخ الوارد',
  residence: 'محل الإقامة',
  licenseType: LICENSE_TYPE_LABEL,
  weaponType: 'نوع السلاح'
});
const SORT_DIRECTION_LABELS = Object.freeze({ asc: 'تصاعدي', desc: 'تنازلي' });
const sortState = { ...DEFAULT_SORT_STATE };
const sortControls = {
  headers: new Map(),
  toggles: new Map(),
  menus: new Map()
};
let activeSortMenuKey = null;
let records = [];
const selectedRecordIds = new Set();
const draftRecordIds = new Set();
const filterState = {
  name: '',
  ranks: new Set(),
  residences: new Set(),
  specializations: new Set(),
  years: new Set()
};
const FILTER_SET_BY_KEY = Object.freeze({
  rank: 'ranks',
  residence: 'residences',
  specialization: 'specializations',
  year: 'years'
});
let dirty = false;
const PAGE_SIZE = 100;
let currentPage = 1;
let isSaving = false;
let lastSavedAt = null;
const REFRESH_INTERVAL_MS = 15000;
let autoRefreshTimerId = null;
let autoRefreshInFlight = false;
let canAutoRefresh = false;
let officeClockTimerId = null;
let lastRecordsSignature = '';
let lastRecordsVersion = '';
let allowSilentNavigation = false;
let baselineRecordsById = new Map();
let baselineSignatureMap = new Map();
let currentSaveIntent = 'save';
const deletedState = {
  records: [],
  selected: new Set(),
  isOpen: false
};
let lastFocusBeforeModal = null;
let addPanelVisible = false;
let pendingScrollEdge = null;

// ===== Date helpers =====
// During typing: use DD/MM/YYYY with auto slashes & leading zeros for D/M.
// On blur/save: convert to canonical YYYY/MM/DD (Arabic digits for display), while internal storage is YYYY-MM-DD.
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

function clamp2(n){ return String(n).padStart(2,'0').slice(-2); }

function parseDdMmYyyyMasked(value){
  const en = toEnglishDigits(value);
  const digits = en.replace(/[^0-9]/g,'').slice(0,8);
  if(digits.length<8) return null; // incomplete
  const dd = parseInt(digits.slice(0,2),10);
  const mm = parseInt(digits.slice(2,4),10);
  const yyyy = parseInt(digits.slice(4,8),10);
  if(!(dd>=1&&dd<=31&&mm>=1&&mm<=12&&yyyy>=1000)) return null;
  const d = new Date(Date.UTC(yyyy,mm-1,dd));
  if(d.getUTCFullYear()!==yyyy||d.getUTCMonth()!==(mm-1)||d.getUTCDate()!==dd) return null; // invalid date like 31/02
  return {dd,mm,yyyy};
}

function ddmmyyyyToIso({dd,mm,yyyy}){ return `${yyyy}-${clamp2(mm)}-${clamp2(dd)}`; }
function isoToYyyyMmDd(iso){
  // Expect ISO: YYYY-MM-DD
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null; const [,y,mo,d]=m; return `${y}/${mo}/${d}`;
}
function isoToDdMmYyyy(iso){
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null; const [,y,mo,d]=m; return `${d}/${mo}/${y}`;
}

function formatArabicYyyyMmDd(iso){
  // Returns Arabic digits in LTR order with slashes
  const en = isoToYyyyMmDd(iso);
  return toArabicDigits(en);
}

// ===== Rendering =====
const dom = {
  resultCount: document.getElementById('recordCountDisplay'),
  resultsBody: document.getElementById('resultsBody'),
  emptyState: document.getElementById('emptyState'),
  workspaceStateBadge: document.getElementById('workspaceStateBadge'),
  visibleCountMetric: document.getElementById('visibleCountMetric'),
  selectedCountMetric: document.getElementById('selectedCountMetric'),
  deletedCountMetric: document.getElementById('deletedCountMetric'),
  dirtyStateMetric: document.getElementById('dirtyStateMetric'),
  activeSortDisplay: document.getElementById('activeSortDisplay'),
  filterSummaryDisplay: document.getElementById('filterSummaryDisplay'),
  selectionSummaryDisplay: document.getElementById('selectionSummaryDisplay'),
  insightSortLabel: document.getElementById('insightSortLabel'),
  insightFilterSummary: document.getElementById('insightFilterSummary'),
  insightSelectionSummary: document.getElementById('insightSelectionSummary'),
  insightSyncState: document.getElementById('insightSyncState'),
  footerSelectionCount: document.getElementById('footerSelectionCount'),
  footerSyncState: document.getElementById('footerSyncState'),
  officeDateDisplay: document.getElementById('officeDateDisplay'),
  nameSearch: document.getElementById('nameSearch'),
  rankMulti: document.getElementById('rankMulti'),
  residenceMulti: document.getElementById('residenceMulti'),
  specializationMulti: document.getElementById('specializationMulti'),
  yearMulti: document.getElementById('yearMulti'),
  addRowBtn: document.getElementById('addRowBtn'),
  addRecordBtn: document.getElementById('addRecordBtn'),
  addRecordPanel: document.getElementById('addRecordPanel'),
  addRecordForm: document.getElementById('addRecordForm'),
  addFormRank: document.getElementById('addFormRank'),
  rankList: document.getElementById('rankList'),
  addFormSpecialization: document.getElementById('addFormSpecialization'),
  specializationList: document.getElementById('specializationList'),
  addFormName: document.getElementById('addFormName'),
  addFormWorkplace: document.getElementById('addFormWorkplace'),
  addFormIncomingDate: document.getElementById('addFormIncomingDate'),
  addFormResidence: document.getElementById('addFormResidence'),
  residenceList: document.getElementById('residenceList'),
  addFormLicenseType: document.getElementById('addFormLicenseType'),
  addFormWeaponType: document.getElementById('addFormWeaponType'),
  weaponTypeList: document.getElementById('weaponTypeList'),
  addFormResetBtn: document.getElementById('addFormResetBtn'),
  addFormCancelBtn: document.getElementById('addFormCancelBtn'),
  saveAllBtn: document.getElementById('saveAllBtn'),
  saveStatus: document.getElementById('saveStatus'),
  printBtn: document.getElementById('printBtn'),
  importBtn: document.getElementById('importBtn'),
  importFileInput: document.getElementById('importFileInput'),
  deleteBtn: document.getElementById('deleteBtn'),
  restoreBtn: document.getElementById('restoreBtn'),
  deletedOverlay: document.getElementById('deletedOverlay'),
  deletedPanel: document.getElementById('deletedPanel'),
  deletedRecordsBody: document.getElementById('deletedRecordsBody'),
  restoreSelectedBtn: document.getElementById('restoreSelectedBtn'),
  deletedSelectAllBtn: document.getElementById('deletedSelectAllBtn'),
  closeDeletedPanelBtn: document.getElementById('closeDeletedPanelBtn'),
  deletedEmptyState: document.getElementById('deletedEmptyState'),
  paginationBar: document.getElementById('paginationBar'),
  pgFirst: document.getElementById('pgFirst'),
  pgPrev: document.getElementById('pgPrev'),
  pgInfo: document.getElementById('pgInfo'),
  pgNext: document.getElementById('pgNext'),
  pgLast: document.getElementById('pgLast')
};

const multiSelects = {};
const TYPEAHEAD_MAX_RESULTS = 8;

const LETTERS_ONLY_FIELDS = new Set(['name','workplace','residence']);
// Cells whose suggestion list opens above the cell instead of below it.
const DROP_UP_FIELDS = new Set(['weaponType']);
// Cells that accept anything typed; their list is only an autocomplete.
const FREE_TEXT_SELECT_FIELDS = new Set(['weaponType']);
const DIGITS_REGEX = /[0-9٠-٩]/;
const NON_DIGIT_DATE_REGEX = /[^0-9٠-٩/]/;

document.addEventListener('click', (event)=>{
  for(const instance of Object.values(multiSelects)){
    if(!instance || !instance.container) continue;
    if(instance.container.contains(event.target)) continue;
    instance.close?.();
  }
  if(!event.target.closest('.sort-toggle') && !event.target.closest('.sort-menu')){
    closeActiveSortMenu();
  }
});

document.addEventListener('keydown', (event)=>{
  if(event.key === 'Escape'){
    if(deletedState.isOpen){
      toggleDeletedPanel(false);
      event.preventDefault();
    }
    closeAllMultiSelects();
    closeActiveSortMenu();
  }
});

function isSortableColumn(column){
  return SORTABLE_COLUMNS.includes(column);
}

function normalizeSortConfig(config = {}){
  const normalized = { ...DEFAULT_SORT_STATE };
  if(isSortableColumn(config.column)){
    normalized.column = config.column;
  }
  if(config.direction === 'asc' || config.direction === 'desc'){
    normalized.direction = config.direction;
  }
  return normalized;
}

function setSortState(nextState){
  const normalized = normalizeSortConfig(nextState);
  const prevColumn = sortState.column;
  const prevDirection = sortState.direction;
  const changed = prevColumn !== normalized.column || prevDirection !== normalized.direction;

  sortState.column = normalized.column;
  sortState.direction = normalized.direction;

  if(changed){
    if(normalized.column === 'incomingDate'){
      pendingScrollEdge = normalized.direction === 'asc' ? 'bottom' : 'top';
    } else {
      pendingScrollEdge = 'top';
    }
  }

  updateSortIndicators();
}

function applySortChoice(column, direction){
  setSortState({ column, direction });
  renderReset();
  persistSortChoices(sortState).catch((error)=>{
    console.warn('Failed to save sort choices:', error);
  });
}

function closeActiveSortMenu(){
  if(!activeSortMenuKey) return;
  const menu = sortControls.menus.get(activeSortMenuKey);
  if(menu){
    menu.hidden = true;
    menu.removeAttribute('data-open');
  }
  activeSortMenuKey = null;
}

function openSortMenu(columnKey){
  if(!isSortableColumn(columnKey)) return;
  closeActiveSortMenu();
  const menu = sortControls.menus.get(columnKey);
  if(menu){
    menu.hidden = false;
    menu.setAttribute('data-open','1');
    activeSortMenuKey = columnKey;
  }
}

function toggleSortMenu(columnKey){
  if(activeSortMenuKey === columnKey){
    closeActiveSortMenu();
    return;
  }
  openSortMenu(columnKey);
}

function updateSortIndicators(){
  sortControls.headers.forEach((header, key)=>{
    const toggle = sortControls.toggles.get(key);
    const menu = sortControls.menus.get(key);
    const isActive = key === sortState.column;
    if(toggle){
      toggle.dataset.active = isActive ? '1' : '0';
      toggle.dataset.sortDirection = isActive ? sortState.direction : '';
    }
    if(header){
      header.classList.toggle('is-sorted', isActive);
    }
    if(menu){
      const buttons = menu.querySelectorAll('button[data-direction]');
      buttons.forEach((btn)=>{
        const direction = btn.dataset.direction === 'asc' ? 'asc' : 'desc';
        const selected = isActive && direction === sortState.direction;
        btn.classList.toggle('is-selected', selected);
      });
    }
  });
}

function setupSortControls(){
  const headers = document.querySelectorAll('th.sortable[data-sort-key]');
  headers.forEach((header)=>{
    const key = header.dataset.sortKey;
    if(!isSortableColumn(key)) return;
    const toggle = header.querySelector('.sort-toggle');
    const menu = header.querySelector('.sort-menu');
    if(!toggle || !menu) return;
    toggle.addEventListener('click', (event)=>{
      event.preventDefault();
      event.stopPropagation();
      toggleSortMenu(key);
    });
    menu.querySelectorAll('button[data-direction]').forEach((option)=>{
      option.addEventListener('click', (event)=>{
        event.preventDefault();
        event.stopPropagation();
        const direction = option.dataset.direction === 'asc' ? 'asc' : 'desc';
        closeActiveSortMenu();
        applySortChoice(key, direction);
      });
    });
    sortControls.headers.set(key, header);
    sortControls.toggles.set(key, toggle);
    sortControls.menus.set(key, menu);
  });
  updateSortIndicators();
}

async function loadSortChoices(){
  try {
    const response = await fetch(SORT_CHOICES_ENDPOINT, { cache: 'no-store' });
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const choice = payload?.choice || payload;
    if(choice){
      setSortState(choice);
    }
  } catch (error) {
    console.warn('Failed to load sort choices, using defaults.', error);
    setSortState(sortState);
  }
}

async function persistSortChoices(choice){
  const normalized = normalizeSortConfig(choice);
  const payload = JSON.stringify(normalized);
  const supportsBeacon = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
  const isPageHiding = typeof document !== 'undefined' && document.visibilityState === 'hidden';

  try {
    if(supportsBeacon && isPageHiding){
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(SORT_CHOICES_ENDPOINT, blob);
      if(sent) return;
    }

    await fetch(SORT_CHOICES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    });
  } catch (error) {
    console.warn('Failed to persist sort choices.', error);
  }
}

function normalizeText(value){
  return String(value ?? '').replace(/\s+/g,' ').trim();
}

function canonicalizeRank(value){
  const normalized = normalizeText(value);
  if(!normalized) return '';

  const simplifiedFull = normalized.replace(/[أإآ]/g,'ا').replace(/\s*\/\s*/g,'/');
  const [primaryRaw] = simplifiedFull.split('/');
  const simplified = normalizeText(primaryRaw);
  if(!simplified) return '';

  // Written without the space; they stay two distinct ranks.
  const simplifiedNoSpaces = simplifiedFull.replace(/\s+/g,'');
  if(simplifiedNoSpaces === 'لواءمعاش') return 'لواء معاش';
  if(simplifiedNoSpaces === 'لواءمساعد') return 'لواء مساعد';

  for(const option of RANK_OPTION_PREFIXES){
    const optionSimplified = normalizeText(option).replace(/[أإآ]/g,'ا');
    if(simplified === optionSimplified) return option;
    if(simplified.startsWith(`${optionSimplified} `)) return option;
  }

  const parts = simplified.split(' ');
  if(parts.length >= 2 && RANK_SECOND_WORD_ALIASES.has(parts[1])){
    const aliasKey = normalizeText(`${parts[0]} ${parts[1]}`);
    const aliasSimplified = aliasKey.replace(/[أإآ]/g,'ا');
    const mapped = RANK_OPTION_SIMPLIFIED.get(aliasSimplified);
    if(mapped) return mapped;
    return aliasSimplified;
  }

  const baseKey = parts[0].replace(/[أإآ]/g,'ا');
  const mapped = RANK_OPTION_SIMPLIFIED.get(baseKey);
  if(mapped) return mapped;
  return baseKey;
}

function setInlineErrorMessage(element, message){
  if(!element) return;
  const container = element.parentElement;
  if(!message){
    element.classList.remove('has-inline-error');
    const existing = container?.querySelector('.cell-error');
    if(existing) existing.remove();
    return;
  }

  element.classList.add('has-inline-error');
  let errorEl = container?.querySelector('.cell-error');
  if(!errorEl && container){
    errorEl = document.createElement('div');
    errorEl.className = 'cell-error';
    container.appendChild(errorEl);
  }
  if(errorEl){
    errorEl.textContent = message;
  }
}

function clearInlineErrorMessage(element){
  setInlineErrorMessage(element, '');
}

function isValidIsoDate(iso){
  return typeof iso === 'string' && ISO_DATE_RE.test(iso) && isoToYyyyMmDd(iso) !== null;
}

function cloneRecords(list){
  if(!Array.isArray(list)) return [];
  return list.map((record)=>({ ...record }));
}

function normalizeRecords(rawRecords){
  if(!Array.isArray(rawRecords)) return [];
  const usedIds = new Set();
  let maxId = 0;
  return rawRecords.map((item, index)=>{
    let numericId = Number(item?.id);
    if(!Number.isFinite(numericId) || usedIds.has(numericId)){
      numericId = (maxId || 0) + 1;
    }
    usedIds.add(numericId);
    if(numericId > maxId) maxId = numericId;
    const split = splitRankAndSpecialization(item?.rank);
    const specialization = normalizeSpecialization(item?.specialization ?? split.specialization);
    const finalized = finalizeRankSpecialization(split.rank, specialization);
    const iso = isValidIsoDate(item?.incomingDate) ? item.incomingDate : null;
    return {
      id: numericId,
      rank: finalized.rank,
      specialization: finalized.specialization,
      name: normalizeText(item?.name),
      workplace: normalizeText(item?.workplace),
      incomingDate: iso,
      residence: normalizeText(item?.residence),
      licenseType: normalizeText(item?.licenseType),
      weaponType: normalizeText(item?.weaponType)
    };
  });
}

function escapeHtml(value){
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ACCEPT_DUPLICATE_FIELDS = ['name','rank','workplace','incomingDate','residence','licenseType','weaponType'];

function normalizeAcceptFieldForSignature(record, field){
  let rawValue;
  if(field === 'rank'){
    rawValue = getEffectiveRank(record);
  } else {
    rawValue = record ? record[field] : undefined;
  }
  let text = toEnglishDigits(String(rawValue ?? ''));
  text = text.replace(/\s+/g, ' ').trim();
  if(!text) return '';
  if(field === 'incomingDate'){
    if(isValidIsoDate(text)) return text;
    const parsed = parseDdMmYyyyFlexible(text);
    if(parsed){
      return ddmmyyyyToIso(parsed);
    }
    return text;
  }
  return normalizeText(text);
}

function buildAcceptRowSignature(record){
  if(!record) return '';
  const signature = ACCEPT_DUPLICATE_FIELDS.map((field)=>normalizeAcceptFieldForSignature(record, field)).join('|');
  if(!signature.replace(/\|/g, '').trim()){
    return '';
  }
  return signature;
}

function resolveRecordById(recordId){
  if(!Number.isFinite(recordId)) return null;
  return records.find((entry)=>Number(entry?.id) === recordId) || null;
}

function findNextExactDuplicateConflict(list, acknowledgedSignatures = new Set()){
  if(!Array.isArray(list)) return null;
  const acknowledged = acknowledgedSignatures instanceof Set ? acknowledgedSignatures : new Set();
  for(const record of list){
    const signature = buildAcceptRowSignature(record);
    if(!signature || acknowledged.has(signature)) continue;
    const recordId = Number(record?.id);
    const baselineRecord = Number.isFinite(recordId) ? baselineRecordsById.get(recordId) : null;
    const baselineSignature = baselineRecord ? buildAcceptRowSignature(baselineRecord) : null;
    const isNewRecord = !baselineRecord;
    const isChangedRecord = baselineRecord ? signature !== baselineSignature : false;
    if(!isNewRecord && !isChangedRecord){
      continue;
    }
    const baselineMatches = baselineSignatureMap.get(signature);
    if(!Array.isArray(baselineMatches) || baselineMatches.length === 0){
      continue;
    }
    const existingCandidate = baselineMatches.find((candidate)=>Number(candidate?.id) !== recordId) || null;
    if(!existingCandidate){
      continue;
    }
    const existingCurrent = resolveRecordById(Number(existingCandidate?.id)) || existingCandidate;
    const existingCurrentSignature = buildAcceptRowSignature(existingCurrent);
    if(existingCurrentSignature !== signature){
      continue;
    }
    return {
      signature,
      newRecord: resolveRecordById(recordId) || record,
      existingRecord: existingCurrent
    };
  }
  return null;
}

let duplicateNameDialogEl = null;
let duplicateNameDialogStyleInjected = false;

function ensureDuplicateNameDialogStyles(){
  if(duplicateNameDialogStyleInjected) return;
  duplicateNameDialogStyleInjected = true;
  try {
    const style = document.createElement('style');
    style.id = 'accept-duplicate-name-dialog-style';
    style.textContent = `.duplicate-row-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);display:none;align-items:center;justify-content:center;z-index:11000;padding:18px;backdrop-filter:blur(3px);} 
.duplicate-row-overlay.open{display:flex;} 
.duplicate-row-modal{background:#fff;color:#14532d;border-radius:4px;box-shadow:0 22px 52px rgba(11,60,35,0.28);padding:28px 36px;width:min(98vw,1240px);max-width:1240px;font-family:inherit;border:1px solid #a9c8b6;}
.duplicate-row-modal h2{margin:0 0 14px;font-size:1.28rem;font-weight:700;}
.duplicate-row-message{margin:0 0 16px;font-size:1rem;line-height:1.6;}
.duplicate-row-details{margin:0 0 18px;background:#f4faf6;border:1px solid #c9dcd0;border-radius:4px;padding:14px;max-height:52vh;overflow:auto;}
.duplicate-row-details table{width:100%;min-width:860px;border-collapse:separate;border-spacing:0;font-size:0.94rem;table-layout:fixed;}
.duplicate-row-details thead th{background:#107c41;text-align:center;padding:10px;border-bottom:1px solid #0b5c2f;font-weight:700;color:#fff;}
.duplicate-row-details tbody th{background:#e6f2ea;text-align:center;padding:10px;border-bottom:1px solid #c9dcd0;font-weight:600;color:#14532d;white-space:nowrap;}
.duplicate-row-details td{padding:10px;border-bottom:1px solid #c9dcd0;color:#1b3d2a;text-align:center;word-break:break-word;}
.duplicate-row-details tbody tr + tr td,.duplicate-row-details tbody tr + tr th{border-top:4px solid #0b5c2f;}
.duplicate-row-details tbody tr:last-child td,.duplicate-row-details tbody tr:last-child th{border-bottom:none;}
.duplicate-row-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;}
.duplicate-row-btn{font-family:inherit;font-size:1rem;font-weight:600;border-radius:4px;padding:10px 18px;border:1px solid transparent;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;}
.duplicate-row-btn.primary{background:#107c41;color:#fff;border-color:#0b5c2f;}
.duplicate-row-btn.primary:hover{background:#0b5c2f;}
.duplicate-row-btn.secondary{background:#fff;color:#14532d;border-color:#a9c8b6;}
.duplicate-row-btn.secondary:hover{background:#e6f2ea;}
.duplicate-row-btn:focus-visible{outline:3px solid rgba(16,124,65,0.45);outline-offset:2px;}`;
    document.head.appendChild(style);
  } catch (_) {}
}

function ensureDuplicateNameDialog(){
  if(duplicateNameDialogEl && document.body.contains(duplicateNameDialogEl)){
    return duplicateNameDialogEl;
  }
  ensureDuplicateNameDialogStyles();
  const overlay = document.createElement('div');
  overlay.id = 'acceptDuplicateNameDialog';
  overlay.className = 'duplicate-row-overlay';
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="duplicate-row-modal" role="dialog" aria-modal="true" aria-labelledby="accept-duplicate-name-title">
      <h2 id="accept-duplicate-name-title">تكرار كامل</h2>
      <p class="duplicate-row-message"></p>
      <div class="duplicate-row-details" dir="rtl"></div>
      <div class="duplicate-row-actions">
        <button type="button" class="duplicate-row-btn primary" data-action="confirm">إضافة على أي حال</button>
        <button type="button" class="duplicate-row-btn secondary" data-action="cancel">إلغاء الإضافة</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  duplicateNameDialogEl = overlay;
  return overlay;
}

function formatDuplicateNameValue(field, record){
  if(!record) return '—';
  if(field === 'incomingDate'){
    return record.incomingDate ? (formatArabicYyyyMmDd(record.incomingDate) || '—') : '—';
  }
  if(field === 'rank'){
    const display = formatRankDisplay(record?.rank, record?.specialization);
    if(display) return toArabicDigits(String(display));
    const value = getEffectiveRank(record);
    return value ? toArabicDigits(String(value)) : '—';
  }
  const value = record[field];
  if(!value) return '—';
  return toArabicDigits(String(value));
}

function renderDuplicateNameDetails(container, existingRecord, duplicateRecord){
  if(!container) return;
  const fields = [
    { key: 'name', label: 'الاسم' },
    { key: 'rank', label: 'الرتبة' },
    { key: 'workplace', label: 'جهة العمل' },
    { key: 'incomingDate', label: 'تاريخ الوارد' },
    { key: 'residence', label: 'محل الإقامة' },
    { key: 'licenseType', label: LICENSE_TYPE_LABEL },
    { key: 'weaponType', label: 'نوع السلاح' }
  ];
  const headerCells = [`<th scope="col">السجل</th>`].concat(fields.map((field)=>`<th scope="col">${escapeHtml(field.label)}</th>`)).join('');
  const existingRowHtml = `<tr><th scope="row">المحفوظ</th>${fields.map((field)=>`<td>${escapeHtml(formatDuplicateNameValue(field.key, existingRecord))}</td>`).join('')}</tr>`;
  const duplicateRowHtml = `<tr><th scope="row">الجديد</th>${fields.map((field)=>`<td>${escapeHtml(formatDuplicateNameValue(field.key, duplicateRecord))}</td>`).join('')}</tr>`;
  container.innerHTML = `<table dir="rtl" aria-label="تفاصيل السجل المكرر"><thead><tr>${headerCells}</tr></thead><tbody>${existingRowHtml}${duplicateRowHtml}</tbody></table>`;
}

function showDuplicateNameDialog({ existingRecord, duplicateRecord }){
  const overlay = ensureDuplicateNameDialog();
  const messageEl = overlay.querySelector('.duplicate-row-message');
  const detailsEl = overlay.querySelector('.duplicate-row-details');
  const confirmBtn = overlay.querySelector('button[data-action="confirm"]');
  const cancelBtn = overlay.querySelector('button[data-action="cancel"]');
  messageEl.textContent = 'يوجد سجل بنفس البيانات المدخلة. هل ترغب في متابعة الإضافة؟';
  renderDuplicateNameDetails(detailsEl, existingRecord, duplicateRecord);
  overlay.classList.add('open');
  try { overlay.focus({ preventScroll: true }); } catch (_) { try { overlay.focus(); } catch {} }

  return new Promise((resolve)=>{
    let resolved = false;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const cleanup = (result)=>{
      if(resolved) return;
      resolved = true;
      overlay.classList.remove('open');
      overlay.removeEventListener('keydown', keyHandler);
      overlay.removeEventListener('click', outsideHandler);
      confirmBtn.onclick = cancelBtn.onclick = null;
      if(previousActive && typeof previousActive.focus === 'function'){
        setTimeout(()=>{
          try { previousActive.focus(); } catch (_) {}
        }, 50);
      }
      resolve(result);
    };

    const keyHandler = (event)=>{
      if(event.key === 'Escape'){
        event.preventDefault();
        cleanup('cancel');
      }
    };

    const outsideHandler = (event)=>{
      if(event.target === overlay){
        event.preventDefault();
        cleanup('cancel');
      }
    };

    confirmBtn.onclick = ()=>cleanup('confirm');
    cancelBtn.onclick = ()=>cleanup('cancel');

    overlay.addEventListener('keydown', keyHandler);
    overlay.addEventListener('click', outsideHandler);

    setTimeout(()=>{
      try { confirmBtn.focus({ preventScroll: true }); } catch (_) { try { confirmBtn.focus(); } catch {} }
    }, 30);
  });
}

function generateNextId(){
  const maxId = records.reduce((max, rec)=>{
    const num = Number(rec?.id);
    return Number.isFinite(num) && num > max ? num : max;
  }, 0);
  return maxId + 1;
}

function todayIsoDate(){
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const dd = String(now.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

/** The specialization a record carries, whether stored on it or inside its rank. */
function getRecordSpecialization(record){
  const parts = splitRankAndSpecialization(record?.rank);
  return normalizeSpecialization(record?.specialization || parts.specialization);
}

/** Year of the incoming date, in the Arabic digits the table shows. */
function getRecordYear(record){
  const iso = record?.incomingDate;
  if(!isValidIsoDate(iso)) return '';
  return toArabicDigits(String(iso).slice(0, 4));
}

function normalizeOptionList(values){
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value)=>{
    const normalized = normalizeText(value);
    if(!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out.sort((a,b)=>a.localeCompare(b,'ar',{sensitivity:'base'}));
}

function arraysEqual(a,b){
  if(!Array.isArray(a) || !Array.isArray(b)) return false;
  if(a.length !== b.length) return false;
  for(let i=0;i<a.length;i+=1){
    if(a[i] !== b[i]) return false;
  }
  return true;
}

function closeAllMultiSelects(){
  Object.values(multiSelects).forEach((instance)=>{
    instance?.close?.();
  });
}

function computeRecordsSignature(list){
  if(!Array.isArray(list)) return '';
  return list.map((rec)=>[
    rec?.id ?? '',
    rec?.rank ?? '',
    rec?.specialization ?? '',
    rec?.name ?? '',
    rec?.workplace ?? '',
    rec?.incomingDate ?? '',
    rec?.residence ?? '',
    rec?.licenseType ?? '',
    rec?.weaponType ?? ''
  ].map((value)=>String(value ?? '')).join('∎')).join('§');
}

function updateRecordsSignature(list = records){
  lastRecordsSignature = computeRecordsSignature(list);
}

async function fetchRecordsVersion(){
  try {
    const response = await fetch(VERSION_ENDPOINT, { cache: 'no-store' });
    if(!response.ok) return null;
    const payload = await response.json();
    if(!payload || payload.ok === false || !payload.version) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function updateBaselineRecords(list = records){
  baselineRecordsById = new Map();
  baselineSignatureMap = new Map();
  if(!Array.isArray(list)) return;
  list.forEach((rec)=>{
    if(!rec) return;
    const snapshot = { ...rec };
    const numericId = Number(snapshot.id);
    if(Number.isFinite(numericId)){
      baselineRecordsById.set(numericId, { ...snapshot });
    }
    const signature = buildAcceptRowSignature(snapshot);
    if(!signature) return;
    if(!baselineSignatureMap.has(signature)){
      baselineSignatureMap.set(signature, [{ ...snapshot }]);
    } else {
      baselineSignatureMap.get(signature).push({ ...snapshot });
    }
  });
}

function closeOtherMultiSelects(exceptKey){
  Object.entries(multiSelects).forEach(([key, instance])=>{
    if(key === exceptKey) return;
    instance?.close?.();
  });
}

function clearFloatingPanelStyles(panel){
  if(!panel) return;
  panel.style.position = '';
  panel.style.top = '';
  panel.style.left = '';
  panel.style.width = '';
  panel.style.maxWidth = '';
  panel.style.visibility = '';
  panel.style.zIndex = '';
  delete panel.dataset.floating;
}

function positionFloatingMultiSelectPanel(state){
  const panel = state?.panel;
  if(!panel) return;
  // Keep dropdowns as normal, in-card positioned panels.
  clearFloatingPanelStyles(panel);
}

function initMultiSelect(key, container, initialOptions, labels = {}){
  if(!container) return;

  const trigger = container.querySelector('.multi-select__trigger');
  const labelSpan = trigger?.querySelector('.multi-select__label') || trigger;
  const panel = container.querySelector('.multi-select__panel');
  const optionsWrap = panel?.querySelector('.multi-select__options');
  const clearBtn = panel?.querySelector('[data-action="clear"]');
  const closeBtn = panel?.querySelector('[data-action="close"]');

  const state = {
    key,
    container,
    trigger,
    labelSpan,
    panel,
    optionsWrap,
    options: []
  };

  function getTargetSet(){
    return filterState[FILTER_SET_BY_KEY[key]] || filterState.ranks;
  }

  function updateLabel(){
    if(!state.labelSpan || !state.trigger) return;
    const selectedSet = getTargetSet();
    const count = selectedSet.size;
    let text;
    if(count === 0){
      text = labels.allLabel || 'الكل';
    } else {
      const values = Array.from(selectedSet);
      if(count === 1){
        text = values[0];
      } else if(count === 2){
        text = `${values[0]}، ${values[1]}`;
      } else {
        const summaryText = labels.summary ? labels.summary(count, selectedSet) : `تم اختيار ${toArabicDigits(count)}`;
        text = summaryText;
      }
    }
    state.labelSpan.textContent = text;
    state.labelSpan.title = count ? Array.from(selectedSet).join('، ') : (labels.allLabel || 'الكل');
    state.trigger.dataset.selectedCount = String(count);
  }

  function syncSelection(){
    if(!state.optionsWrap) return;
    const selectedSet = getTargetSet();
    const boxes = state.optionsWrap.querySelectorAll('input[type="checkbox"]');
    boxes.forEach((box)=>{
      box.checked = selectedSet.has(box.value);
    });
    updateLabel();
  }

  function setOptions(values){
    if(!state.optionsWrap) return;
    const normalized = normalizeOptionList(values);
    if(arraysEqual(normalized, state.options)){
      syncSelection();
      return;
    }
    state.options = normalized;
    state.optionsWrap.innerHTML = '';
    if(!normalized.length){
      const empty = document.createElement('div');
      empty.className = 'multi-select__empty';
      empty.textContent = labels.emptyLabel || 'لا توجد خيارات';
      state.optionsWrap.appendChild(empty);
    } else {
      normalized.forEach((value)=>{
        const optionLabel = document.createElement('label');
        optionLabel.className = 'multi-select__option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = value;
        checkbox.className = 'multi-select__checkbox';
        const textSpan = document.createElement('span');
        textSpan.textContent = value;
        optionLabel.append(checkbox, textSpan);
        state.optionsWrap.appendChild(optionLabel);
      });
    }
    syncSelection();
  }

  function toggle(open){
    if(!state.trigger || !state.panel) return;
    if(open){
      closeOtherMultiSelects(key);
      clearFloatingPanelStyles(state.panel);
      state.panel.hidden = false;
      container.dataset.open = '1';
      state.trigger.setAttribute('aria-expanded','true');
      requestAnimationFrame(()=>{
        state.panel?.focus?.();
      });
    } else {
      clearFloatingPanelStyles(state.panel);
      state.panel.hidden = true;
      container.dataset.open = '';
      state.trigger.setAttribute('aria-expanded','false');
    }
  }

  trigger?.addEventListener('click', (event)=>{
    event.preventDefault();
    event.stopPropagation();
    const isOpen = container.dataset.open === '1';
    toggle(!isOpen);
  });

  panel?.addEventListener('click', (event)=>event.stopPropagation());

  panel?.addEventListener('keydown', (event)=>{
    if(event.key === 'Escape'){
      event.preventDefault();
      toggle(false);
      state.trigger?.focus?.();
    }
  });

  optionsWrap?.addEventListener('change', (event)=>{
    const target = event.target;
    if(!target || target.type !== 'checkbox') return;
    const value = target.value;
    if(!value){
      target.checked = false;
      return;
    }
    const set = getTargetSet();
    if(target.checked){
      set.add(value);
    } else {
      set.delete(value);
    }
    updateLabel();
    renderReset();
  });

  clearBtn?.addEventListener('click', (event)=>{
    event.preventDefault();
    const set = getTargetSet();
    if(set.size){
      set.clear();
      syncSelection();
      renderReset();
    }
  });

  closeBtn?.addEventListener('click', (event)=>{
    event.preventDefault();
    toggle(false);
    state.trigger?.focus?.();
  });

  multiSelects[key] = {
    key,
    container,
    trigger,
    panel,
    setOptions,
    syncSelection,
    updateLabel,
    getOptions: ()=>state.options.slice(),
    reposition: ()=>positionFloatingMultiSelectPanel(state),
    close: ()=>toggle(false)
  };

  setOptions(initialOptions);
  syncSelection();
  updateLabel();
}

window.addEventListener('resize', ()=>{
  Object.values(multiSelects).forEach((instance)=>{
    instance?.reposition?.();
  });
});

window.addEventListener('scroll', ()=>{
  Object.values(multiSelects).forEach((instance)=>{
    instance?.reposition?.();
  });
}, true);

function updateDynamicFilterOptions(){
  if(!multiSelects.rank && !multiSelects.residence && !multiSelects.specialization && !multiSelects.year) return;

  const rankList = normalizeOptionList(RANK_OPTIONS);
  const rankSet = new Set(rankList);
  const residenceValues = new Set();
  normalizeOptionList(LOCATION_OPTIONS).forEach((value)=>residenceValues.add(value));
  const specializationValues = new Set(normalizeOptionList(SPECIALIZATION_OPTIONS));
  const yearValues = new Set();

  records.forEach((rec)=>{
    const residenceVal = normalizeText(rec?.residence);
    if(residenceVal) residenceValues.add(residenceVal);
    const yearVal = getRecordYear(rec);
    if(yearVal) yearValues.add(yearVal);
  });

  filterState.ranks.forEach((value)=>{
    if(!rankSet.has(value)) filterState.ranks.delete(value);
  });
  filterState.residences.forEach((value)=>{
    if(!residenceValues.has(value)) filterState.residences.delete(value);
  });
  filterState.specializations.forEach((value)=>{
    if(!specializationValues.has(value)) filterState.specializations.delete(value);
  });
  filterState.years.forEach((value)=>{
    if(!yearValues.has(value)) filterState.years.delete(value);
  });

  const applyOptions = (instance, values)=>{
    if(!instance) return;
    instance.setOptions(values);
    instance.syncSelection();
    instance.updateLabel();
  };

  applyOptions(multiSelects.rank, rankList);
  applyOptions(multiSelects.residence, Array.from(residenceValues));
  applyOptions(multiSelects.specialization, Array.from(specializationValues));
  applyOptions(multiSelects.year, Array.from(yearValues));
}

function pruneSelectedRecordIds(){
  if(!selectedRecordIds.size) return;
  const existing = new Set(records.map((rec)=>rec?.id).filter((id)=>Number.isFinite(Number(id))));
  for(const id of Array.from(selectedRecordIds)){
    if(!existing.has(id)){
      selectedRecordIds.delete(id);
    }
  }
}

function updateDeleteButtonState(){
  if(!dom.deleteBtn) return;
  const hasSelection = selectedRecordIds.size > 0;
  dom.deleteBtn.disabled = isSaving || dirty || !hasSelection;
  updateWorkspaceIndicators();
}

function updateRestoreSelectedState(){
  if(dom.restoreSelectedBtn){
    dom.restoreSelectedBtn.disabled = deletedState.selected.size === 0;
  }
  if(dom.deletedSelectAllBtn){
    dom.deletedSelectAllBtn.disabled = deletedState.records.length === 0;
  }
}

function formatDeletedTimestamp(iso){
  if(!iso) return '—';
  try {
    const dt = new Date(iso);
    if(Number.isNaN(dt.getTime())) return iso;
    return toArabicDigits(dt.toLocaleString('ar-EG', { hour12: false }));
  } catch (error) {
    return iso;
  }
}

function renderDeletedPanel(){
  if(!dom.deletedPanel || !dom.deletedRecordsBody || !dom.deletedEmptyState) return;
  dom.deletedRecordsBody.innerHTML = '';
  if(!deletedState.records.length){
    dom.deletedEmptyState.hidden = false;
    updateRestoreSelectedState();
    updateWorkspaceIndicators();
    return;
  }
  dom.deletedEmptyState.hidden = true;

  deletedState.records.forEach((record)=>{
    const tr = document.createElement('tr');
    const recordId = Number(record?.id);
    const isSelected = deletedState.selected.has(recordId);

    const selectTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-select';
    checkbox.value = String(recordId);
    checkbox.checked = isSelected;
    checkbox.addEventListener('change', (event)=>{
      if(event.target.checked){
        deletedState.selected.add(recordId);
      } else {
        deletedState.selected.delete(recordId);
      }
      updateRestoreSelectedState();
    });
    selectTd.appendChild(checkbox);
    tr.appendChild(selectTd);

    const parts = splitRankAndSpecialization(record?.rank);
    const specialization = normalizeSpecialization(record?.specialization || parts.specialization);
    const effectiveRank = formatRankDisplay(parts.rank, specialization);

    const cells = [
      effectiveRank,
      record?.name || '',
      record?.workplace || '',
      (()=>{
        if(isValidIsoDate(record?.incomingDate)){
          const formatted = isoToYyyyMmDd(record.incomingDate);
          return formatted ? toArabicDigits(formatted) : '';
        }
        return record?.incomingDate || '';
      })(),
      record?.residence || '',
      record?.licenseType || '',
      record?.weaponType || '',
      formatDeletedTimestamp(record?.deletedAt)
    ];

    cells.forEach((value)=>{
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    dom.deletedRecordsBody.appendChild(tr);
  });

  updateRestoreSelectedState();
  updateWorkspaceIndicators();
}

async function fetchDeletedRecords(){
  const response = await fetch(DELETED_ENDPOINT, { cache: 'no-store' });
  if(!response.ok){
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  if(payload && payload.success === false){
    throw new Error(payload.message || 'فشل قراءة السجلات المحذوفة');
  }
  return Array.isArray(payload?.records) ? payload.records : [];
}

async function toggleDeletedPanel(forceOpen){
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !deletedState.isOpen;
  if(!dom.deletedPanel || !dom.deletedOverlay) return;

  if(!shouldOpen){
    deletedState.isOpen = false;
    dom.deletedPanel.hidden = true;
    dom.deletedOverlay.hidden = true;
    document.body?.classList?.remove('has-modal');
    deletedState.selected.clear();
    updateRestoreSelectedState();
    try {
      if(lastFocusBeforeModal && typeof lastFocusBeforeModal.focus === 'function'){
        lastFocusBeforeModal.focus({ preventScroll: true });
      }
    } catch (_) {}
    lastFocusBeforeModal = null;
    return;
  }

  try {
    lastFocusBeforeModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const records = await fetchDeletedRecords();
    deletedState.records = records;
    deletedState.selected.clear();
    renderDeletedPanel();
    dom.deletedPanel.hidden = false;
    dom.deletedOverlay.hidden = false;
    document.body?.classList?.add('has-modal');
    deletedState.isOpen = true;
    updateRestoreSelectedState();
    window.requestAnimationFrame(()=>{
      const target = !dom.restoreSelectedBtn?.disabled ? dom.restoreSelectedBtn
        : dom.deletedSelectAllBtn ?? dom.closeDeletedPanelBtn;
      try {
        target?.focus({ preventScroll: true });
      } catch (_) {}
    });
  } catch (error) {
    console.error('Failed to load deleted records:', error);
    setStatus('تعذر تحميل السجلات المحذوفة.', 'error');
  }
}

function formatSavedAt(iso){
  if(!iso) return '';
  try {
    const dt = new Date(iso);
    if(Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString('ar-EG', { hour12:false });
  } catch {
    return iso;
  }
}

function setStatus(message = '', variant = 'muted'){
  if(!dom.saveStatus) return;
  dom.saveStatus.textContent = message;
  dom.saveStatus.dataset.variant = variant;
  updateWorkspaceIndicators();
}

function assignTextContent(node, value){
  if(node){
    node.textContent = value;
  }
}

function formatMetricNumber(value){
  return toArabicDigits(String(Math.max(0, Number(value) || 0)));
}

function describeCurrentSort(){
  const columnLabel = SORT_COLUMN_LABELS[sortState.column] || SORT_COLUMN_LABELS[DEFAULT_SORT_STATE.column];
  const directionLabel = SORT_DIRECTION_LABELS[sortState.direction] || SORT_DIRECTION_LABELS[DEFAULT_SORT_STATE.direction];
  return `${columnLabel} - ${directionLabel}`;
}

function describeActiveFilters(){
  const parts = [];
  const cleanName = normalizeText(filterState.name || '');
  if(cleanName){
    parts.push(`الاسم: ${cleanName}`);
  }
  if(filterState.ranks.size){
    parts.push(`الرتب: ${toArabicDigits(String(filterState.ranks.size))}`);
  }
  if(filterState.residences.size){
    parts.push(`الإقامة: ${toArabicDigits(String(filterState.residences.size))}`);
  }
  if(filterState.specializations.size){
    parts.push(`التخصص: ${toArabicDigits(String(filterState.specializations.size))}`);
  }
  if(filterState.years.size){
    parts.push(`السنة: ${Array.from(filterState.years).join('، ')}`);
  }
  return parts.length ? parts.join(' | ') : 'بدون مرشحات نشطة';
}

function describeSelectionState(){
  const count = selectedRecordIds.size;
  if(!count) return 'لا توجد سجلات محددة';
  if(count === 1) return 'تم تحديد سجل واحد';
  return `تم تحديد ${toArabicDigits(String(count))} سجلات`;
}

function describeWorkspaceSyncState(){
  const variant = dom.saveStatus?.dataset.variant || 'muted';
  const lastMessage = (dom.saveStatus?.textContent || '').trim();

  if(isSaving){
    return {
      short: currentSaveIntent === 'add' ? 'إضافة...' : 'حفظ...',
      long: currentSaveIntent === 'add' ? 'جاري إضافة السجل' : 'جاري حفظ التغييرات',
      variant: 'info'
    };
  }

  if(variant === 'error'){
    return {
      short: 'خطأ',
      long: lastMessage || 'تعذر تنفيذ العملية',
      variant: 'error'
    };
  }

  if(dirty){
    return {
      short: 'غير محفوظ',
      long: 'هناك تغييرات غير محفوظة',
      variant: 'warn'
    };
  }

  if(variant === 'success'){
    return {
      short: 'محفوظ',
      long: lastMessage || 'تم حفظ البيانات',
      variant: 'success'
    };
  }

  if(variant === 'info'){
    return {
      short: 'تشغيل',
      long: lastMessage || 'جاري تنفيذ العملية',
      variant: 'info'
    };
  }

  return {
    short: 'جاهز',
    long: lastMessage || 'جاهز للعمل',
    variant: 'muted'
  };
}

function updateWorkspaceIndicators(filteredCount){
  const visibleCount = Number.isFinite(filteredCount) ? filteredCount : getFilteredRecords().length;
  const selectedCount = selectedRecordIds.size;
  const deletedCount = Array.isArray(deletedState.records) ? deletedState.records.length : 0;
  const filterSummary = describeActiveFilters();
  const selectionSummary = describeSelectionState();
  const sortSummary = describeCurrentSort();
  const syncState = describeWorkspaceSyncState();

  assignTextContent(dom.visibleCountMetric, formatMetricNumber(visibleCount));
  assignTextContent(dom.selectedCountMetric, formatMetricNumber(selectedCount));
  assignTextContent(dom.deletedCountMetric, formatMetricNumber(deletedCount));
  assignTextContent(dom.dirtyStateMetric, syncState.short);
  assignTextContent(dom.activeSortDisplay, `الفرز: ${sortSummary}`);
  assignTextContent(dom.filterSummaryDisplay, filterSummary);
  assignTextContent(dom.selectionSummaryDisplay, selectionSummary);
  assignTextContent(dom.insightSortLabel, sortSummary);
  assignTextContent(dom.insightFilterSummary, filterSummary);
  assignTextContent(dom.insightSelectionSummary, selectionSummary);
  assignTextContent(dom.insightSyncState, syncState.long);
  assignTextContent(dom.footerSelectionCount, `محدد: ${formatMetricNumber(selectedCount)}`);
  assignTextContent(dom.footerSyncState, syncState.short);

  if(dom.workspaceStateBadge){
    dom.workspaceStateBadge.textContent = syncState.long;
    dom.workspaceStateBadge.dataset.variant = syncState.variant;
  }
  if(dom.dirtyStateMetric){
    dom.dirtyStateMetric.dataset.variant = syncState.variant;
  }
  if(document?.body){
    document.body.dataset.workspaceState = syncState.variant;
  }
}

function updateOfficeDateDisplay(){
  if(!dom.officeDateDisplay) return;
  try {
    const now = new Date();
    const datePart = now.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timePart = now.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
    dom.officeDateDisplay.textContent = `${datePart} | ${timePart}`;
  } catch (error) {
    dom.officeDateDisplay.textContent = toArabicDigits(new Date().toLocaleString());
  }
}

function startOfficeClock(){
  updateOfficeDateDisplay();
  if(typeof window === 'undefined') return;
  if(officeClockTimerId){
    window.clearInterval(officeClockTimerId);
  }
  officeClockTimerId = window.setInterval(updateOfficeDateDisplay, 60000);
}

function updateSaveButtonState(){
  const saveDisabled = isSaving || !dirty;
  if(dom.saveAllBtn){
    dom.saveAllBtn.disabled = saveDisabled;
  }
  if(dom.addRecordBtn){
    dom.addRecordBtn.disabled = isSaving;
  }
}

function markDirty(){
  if(!dirty){
    dirty = true;
    setStatus('هناك تغييرات غير محفوظة', 'warn');
    try { document.body?.classList?.add('accept-unsaved'); } catch (_) {}
  } else {
    const variant = dom.saveStatus ? dom.saveStatus.dataset.variant : '';
    if(variant !== 'error' && variant !== 'warn'){
      setStatus('هناك تغييرات غير محفوظة', 'warn');
    }
  }
  updateSaveButtonState();
  updateDeleteButtonState();
  updateWorkspaceIndicators();
}

function clearDirty(){
  dirty = false;
  allowSilentNavigation = false;
  try { document.body?.classList?.remove('accept-unsaved'); } catch (_) {}
  updateSaveButtonState();
  updateDeleteButtonState();
  updateWorkspaceIndicators();
}

function setSavingState(next){
  isSaving = !!next;
  if(dom.addRecordBtn){
    dom.addRecordBtn.textContent = isSaving && currentSaveIntent === 'add' ? 'جاري الإضافة…' : 'إضافة';
  }
  if(dom.saveAllBtn){
    dom.saveAllBtn.textContent = isSaving && currentSaveIntent !== 'add' ? 'جاري الحفظ…' : 'حفظ التغييرات';
  }
  updateSaveButtonState();
  updateDeleteButtonState();
  updateWorkspaceIndicators();
}

function reportSavedAt(iso, intent = 'save'){
  lastSavedAt = iso || null;
  if(lastSavedAt){
    const label = intent === 'add' ? 'تمت الإضافة عند' : 'تم الحفظ عند';
    setStatus(`${label} ${formatSavedAt(lastSavedAt)}`, 'success');
  } else {
    setStatus('', 'muted');
  }
}

function shouldSkipAutoRefresh(){
  if(!canAutoRefresh) return true;
  if(autoRefreshInFlight) return true;
  if(dirty || isSaving) return true;
  if(typeof document !== 'undefined'){
    try {
      if(document.hidden) return true;
      const active = document.activeElement;
      if(active && dom.resultsBody && dom.resultsBody.contains(active)){
        return true;
      }
    } catch (error) {
      console.warn('auto-refresh visibility check failed:', error);
    }
  }
  return false;
}

function startAutoRefresh(){
  if(typeof window === 'undefined') return;
  if(!canAutoRefresh) return;
  stopAutoRefresh();
  autoRefreshTimerId = window.setInterval(()=>{
    refreshRecords().catch(()=>{});
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh(){
  if(typeof window === 'undefined') return;
  if(autoRefreshTimerId){
    window.clearInterval(autoRefreshTimerId);
    autoRefreshTimerId = null;
  }
}

async function refreshRecords(){
  if(shouldSkipAutoRefresh()) return false;
  autoRefreshInFlight = true;
  try {
    const versionPayload = await fetchRecordsVersion();
    if(versionPayload && lastRecordsVersion && versionPayload.version === lastRecordsVersion){
      return false;
    }

    const response = await fetch(API_ENDPOINT, { cache: 'no-store' });
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if(payload && payload.success === false){
      throw new Error(payload.message || 'فشل تحديث السجلات');
    }
    const refreshed = normalizeRecords(payload?.records);
    const signature = computeRecordsSignature(refreshed);
    if(signature === lastRecordsSignature && versionPayload?.version){
      lastRecordsVersion = versionPayload.version;
    }
    if(signature !== lastRecordsSignature){
      records = refreshed;
      draftRecordIds.clear();
      updateRecordsSignature(refreshed);
      lastRecordsVersion = versionPayload?.version || `records:${lastRecordsSignature}`;
      updateBaselineRecords(refreshed);
      render();
      if(payload?.updatedAt || payload?.savedAt){
        reportSavedAt(payload.updatedAt || payload.savedAt);
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to refresh acceptance records:', error);
    return false;
  } finally {
    autoRefreshInFlight = false;
  }
}

const UNSAVED_EXIT_MESSAGE = 'هناك تغييرات غير محفوظة. يرجى اختيار الإجراء المناسب قبل المغادرة.';
let unsavedDialogElement = null;
let unsavedDialogStyleInjected = false;

function injectUnsavedDialogStyles(){
  if(unsavedDialogStyleInjected) return;
  const style = document.createElement('style');
  style.id = 'accept-unsaved-exit-style';
  style.textContent = `.accept-unsaved-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,0.55);backdrop-filter:blur(2px);z-index:9999;}\n.accept-unsaved-overlay.open{display:flex;}\n.accept-unsaved-overlay[data-loading="true"] .accept-unsaved-btn{pointer-events:none;opacity:0.65;}\n.accept-unsaved-modal{background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 24px 56px rgba(15,23,42,0.25);padding:24px 28px;width:min(92vw,420px);max-width:420px;font-family:inherit;}\n.accept-unsaved-modal h2{margin:0 0 12px;font-size:1.35rem;font-weight:700;color:#0f172a;}\n.accept-unsaved-message{margin:0 0 18px;font-size:1rem;line-height:1.7;}\n.accept-unsaved-error{min-height:1.25em;margin:0 0 12px;font-size:0.95rem;color:#dc2626;}\n.accept-unsaved-actions{display:flex;flex-direction:column;gap:10px;}\n.accept-unsaved-btn{font-family:inherit;font-size:1rem;font-weight:600;border-radius:10px;padding:12px 16px;border:0;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,background-color .15s ease;color:#0f172a;background:#e2e8f0;box-shadow:0 6px 16px rgba(15,23,42,0.12);}\n.accept-unsaved-btn.primary{background:#0066cc;color:#fff;box-shadow:0 10px 24px rgba(0,102,204,0.25);}\n.accept-unsaved-btn.primary:hover{background:#0052a3;}\n.accept-unsaved-btn.secondary{background:#f8fafc;color:#0f172a;}\n.accept-unsaved-btn.secondary:hover{background:#e2e8f0;}\n.accept-unsaved-btn.ghost{background:#fff;color:#0f172a;border:1px solid #cbd5f5;box-shadow:none;}\n.accept-unsaved-btn.ghost:hover{background:#f8fafc;}\n.accept-unsaved-btn:focus-visible{outline:3px solid rgba(0,102,204,0.45);outline-offset:2px;}\n@media (min-width:480px){.accept-unsaved-actions{flex-direction:row;}.accept-unsaved-btn{flex:1;}}`;
  document.head.appendChild(style);
  unsavedDialogStyleInjected = true;
}

function ensureUnsavedDialog(){
  if(unsavedDialogElement && document.body.contains(unsavedDialogElement)){
    return unsavedDialogElement;
  }
  injectUnsavedDialogStyles();
  const overlay = document.createElement('div');
  overlay.id = 'acceptUnsavedDialog';
  overlay.className = 'accept-unsaved-overlay';
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="accept-unsaved-modal" role="dialog" aria-modal="true" aria-labelledby="accept-unsaved-title">
      <h2 id="accept-unsaved-title">تأكيد الخروج</h2>
      <p class="accept-unsaved-message"></p>
      <div class="accept-unsaved-error" role="alert"></div>
      <div class="accept-unsaved-actions" dir="rtl">
        <button type="button" class="accept-unsaved-btn primary" data-action="save">💾 خروج مع الحفظ</button>
        <button type="button" class="accept-unsaved-btn secondary" data-action="discard">🚪 خروج بدون حفظ</button>
        <button type="button" class="accept-unsaved-btn ghost" data-action="stay">↩️ البقاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  unsavedDialogElement = overlay;
  return overlay;
}

function showUnsavedDialog({ message = UNSAVED_EXIT_MESSAGE, onSave, onDiscard } = {}){
  const overlay = ensureUnsavedDialog();
  const messageEl = overlay.querySelector('.accept-unsaved-message');
  const errorEl = overlay.querySelector('.accept-unsaved-error');
  const saveBtn = overlay.querySelector('button[data-action="save"]');
  const discardBtn = overlay.querySelector('button[data-action="discard"]');
  const stayBtn = overlay.querySelector('button[data-action="stay"]');
  const defaultSaveLabel = '💾 خروج مع الحفظ';
  const defaultDiscardLabel = '🚪 خروج بدون حفظ';
  const defaultStayLabel = '↩️ البقاء';

  messageEl.textContent = message;
  errorEl.textContent = '';
  overlay.dataset.loading = 'false';
  saveBtn.textContent = defaultSaveLabel;
  discardBtn.textContent = defaultDiscardLabel;
  stayBtn.textContent = defaultStayLabel;
  saveBtn.disabled = discardBtn.disabled = stayBtn.disabled = false;

  overlay.classList.add('open');
  try { overlay.focus({ preventScroll: true }); } catch (error) { try { overlay.focus(); } catch (_) {} }

  return new Promise((resolve)=>{
    let resolved = false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const cleanup = (result)=>{
      if(resolved) return;
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
      if(previousFocus && typeof previousFocus.focus === 'function'){
        setTimeout(()=>{
          try { previousFocus.focus(); } catch (_) {}
        }, 40);
      }
      resolve(result);
    };

    const keyHandler = (event)=>{
      if(event.key === 'Escape'){
        event.preventDefault();
        cleanup('stay');
      }
    };

    const outsideHandler = (event)=>{
      if(event.target === overlay){
        event.preventDefault();
        cleanup('stay');
      }
    };

    overlay.addEventListener('keydown', keyHandler);
    overlay.addEventListener('click', outsideHandler);

    saveBtn.onclick = async ()=>{
      if(typeof onSave === 'function'){
        overlay.dataset.loading = 'true';
        errorEl.textContent = '';
        try {
          const result = await onSave();
          if(result !== false){
            cleanup('save');
          } else {
            overlay.dataset.loading = 'false';
            errorEl.textContent = 'تعذر حفظ التغييرات. حاول مرة أخرى.';
          }
        } catch (error) {
          overlay.dataset.loading = 'false';
          errorEl.textContent = 'تعذر حفظ التغييرات. حاول مرة أخرى.';
        }
      } else {
        cleanup('save');
      }
    };

    discardBtn.onclick = async ()=>{
      if(typeof onDiscard === 'function'){
        overlay.dataset.loading = 'true';
        errorEl.textContent = '';
        try {
          const result = await onDiscard();
          if(result !== false){
            cleanup('discard');
          } else {
            overlay.dataset.loading = 'false';
            errorEl.textContent = 'تعذر تنفيذ الخروج. حاول مرة أخرى.';
          }
        } catch (error) {
          overlay.dataset.loading = 'false';
          errorEl.textContent = 'تعذر تنفيذ الخروج. حاول مرة أخرى.';
        }
      } else {
        cleanup('discard');
      }
    };

    stayBtn.onclick = ()=>cleanup('stay');
  });
}

function navigateToTarget(target){
  if(!target) return;
  allowSilentNavigation = true;
  window.location.href = target;
}

async function clearTemporaryWorkspace(){
  try {
    const response = await fetch(CLEAR_TMP_ENDPOINT, { method: 'POST' });
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn('Failed to clear temporary workspace:', error);
  }
}

async function exitToTarget(target){
  await clearTemporaryWorkspace();
  navigateToTarget(target);
}

function matchesFilters(rec){
  if(filterState.name){
    const target = String(rec?.name ?? '');
    if(!target.includes(filterState.name)) return false;
  }

  if(filterState.ranks.size){
    const rankValue = normalizeText(rec?.rank);
    const recordRankKey = canonicalizeRank(rankValue);
    const isRankMatch = Array.from(filterState.ranks).some((selected)=>{
      const selectedValue = normalizeText(selected);
      if(!selectedValue) return false;
      if(rankValue === selectedValue) return true;
      const selectedRankKey = canonicalizeRank(selectedValue);
      return selectedRankKey && recordRankKey === selectedRankKey;
    });
    if(!isRankMatch) return false;
  }

  const residenceValue = normalizeText(rec?.residence);
  if(filterState.residences.size && !filterState.residences.has(residenceValue)) return false;

  if(filterState.specializations.size && !filterState.specializations.has(getRecordSpecialization(rec))) return false;

  if(filterState.years.size && !filterState.years.has(getRecordYear(rec))) return false;

  return true;
}

function render(){
  detachFloatingLists(); // the rows these belong to are about to be rebuilt
  updateDynamicFilterOptions();
  pruneSelectedRecordIds();
  const filtered = getFilteredRecords();

  // Pagination clamping
  const _totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > _totalPages) currentPage = _totalPages;
  const _pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRecords = filtered.slice(_pageStart, _pageStart + PAGE_SIZE);

  dom.resultsBody.innerHTML='';
  if(dom.resultCount){
    dom.resultCount.textContent = `عدد السجلات: ${filtered.length}`;
  }
  if(dom.emptyState){
    dom.emptyState.hidden = filtered.length > 0;
  }
  updateWorkspaceIndicators(filtered.length);
  updatePaginationUI(filtered.length);

  if(!filtered.length){
    updateDeleteButtonState();
    return;
  }

  pageRecords.forEach((rec, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = rec.id;
    const recordId = Number(rec?.id);
    const isSelected = selectedRecordIds.has(recordId);
    if(isSelected){
      tr.classList.add('is-selected');
    }

    // Row Number Cell
    const rowNumTd = document.createElement('td');
    rowNumTd.className = 'rownum-cell';
    rowNumTd.textContent = String(_pageStart + index + 1);
    tr.appendChild(rowNumTd);

    const selectTd = document.createElement('td');
    selectTd.className = 'select-cell';
    const selectCheckbox = document.createElement('input');
    selectCheckbox.type = 'checkbox';
    selectCheckbox.className = 'row-select';
    selectCheckbox.value = String(recordId);
    selectCheckbox.checked = isSelected;
    selectCheckbox.addEventListener('change', (event)=>{
      const checked = event.target.checked;
      if(checked){
        selectedRecordIds.add(recordId);
      } else {
        selectedRecordIds.delete(recordId);
      }
      tr.classList.toggle('is-selected', checked);
      updateDeleteButtonState();
    });

    selectTd.appendChild(selectCheckbox);

    const rankTd = document.createElement('td');
    rankTd.className = 'col-rank';
    rankTd.appendChild(createRankCompositeCell(rec));

    const nameTd = document.createElement('td');
    nameTd.appendChild(createTextCell('name', rec.name));

    const workTd = document.createElement('td');
    workTd.appendChild(createTextCell('workplace', rec.workplace));

    const dateTd = document.createElement('td');
    dateTd.appendChild(createDateCell(rec));

    const resTd = document.createElement('td');
    resTd.appendChild(createSelectCell('residence', LOCATION_OPTIONS, rec.residence));

    const licenseTd = document.createElement('td');
    licenseTd.appendChild(createSelectCell('licenseType', LICENSE_TYPE_OPTIONS, rec.licenseType));

    const weaponTd = document.createElement('td');
    weaponTd.appendChild(createSelectCell('weaponType', WEAPON_TYPE_OPTIONS, rec.weaponType));

    tr.append(selectTd, rankTd, nameTd, workTd, dateTd, resTd, licenseTd, weaponTd);
    dom.resultsBody.appendChild(tr);
  });

  updateSortIndicators();
  updateDeleteButtonState();
  applyPendingScrollPreference(filtered.length);
}

function applyPendingScrollPreference(totalRows){
  if(!pendingScrollEdge || !totalRows) return;
  const wrapper = dom.resultsBody?.closest('.table-wrapper');
  if(!(wrapper instanceof HTMLElement)){
    pendingScrollEdge = null;
    return;
  }
  const toBottom = pendingScrollEdge === 'bottom';
  wrapper.scrollTop = toBottom ? wrapper.scrollHeight : 0;
  pendingScrollEdge = null;
}

function updatePaginationUI(total) {
  if (!dom.paginationBar) return;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  dom.paginationBar.hidden = total <= PAGE_SIZE;
  if (dom.pgInfo) dom.pgInfo.textContent = toArabicDigits(currentPage) + ' / ' + toArabicDigits(totalPages);
  if (dom.pgFirst) dom.pgFirst.disabled = currentPage <= 1;
  if (dom.pgPrev)  dom.pgPrev.disabled  = currentPage <= 1;
  if (dom.pgNext)  dom.pgNext.disabled  = currentPage >= totalPages;
  if (dom.pgLast)  dom.pgLast.disabled  = currentPage >= totalPages;
}

function renderReset() {
  currentPage = 1;
  render();
}

function goToPage(n) {
  const totalPages = Math.max(1, Math.ceil(getFilteredRecords().length / PAGE_SIZE));
  currentPage = Math.max(1, Math.min(n, totalPages));
  render();
}

function getSortValue(record, column){
  switch(column){
    case 'incomingDate':
      return isValidIsoDate(record?.incomingDate) ? record.incomingDate : '';
    case 'rank':
      return canonicalizeRank(record?.rank || '');
    case 'name':
    case 'workplace':
    case 'residence':
    case 'licenseType':
    case 'weaponType':
    default:
      return normalizeText(record?.[column] ?? '');
  }
}

function compareByColumn(column, a, b){
  const aValue = getSortValue(a, column);
  const bValue = getSortValue(b, column);
  if(column === 'incomingDate'){
    if(aValue && bValue){
      if(aValue > bValue) return 1;
      if(aValue < bValue) return -1;
      return 0;
    }
    if(aValue) return 1;
    if(bValue) return -1;
    return 0;
  }
  return aValue.localeCompare(bValue, 'ar', { sensitivity: 'base' });
}

function compareRecordsForView(a, b){
  const aId = Number(a?.id);
  const bId = Number(b?.id);
  const aIsDraft = Number.isFinite(aId) && draftRecordIds.has(aId);
  const bIsDraft = Number.isFinite(bId) && draftRecordIds.has(bId);
  if(aIsDraft && !bIsDraft) return -1;
  if(!aIsDraft && bIsDraft) return 1;

  const columnKey = isSortableColumn(sortState.column) ? sortState.column : DEFAULT_SORT_STATE.column;
  const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;
  const columnCompare = compareByColumn(columnKey, a, b);
  if(columnCompare !== 0){
    return columnCompare * directionMultiplier;
  }

  const aDate = isValidIsoDate(a?.incomingDate) ? a.incomingDate : null;
  const bDate = isValidIsoDate(b?.incomingDate) ? b.incomingDate : null;
  if(aDate && bDate){
    if(aDate > bDate) return -1;
    if(aDate < bDate) return 1;
  } else if(aDate || bDate){
    return aDate ? -1 : 1;
  }

  if(Number.isFinite(bId) && Number.isFinite(aId)){
    return bId - aId;
  }

  const aName = normalizeText(a?.name || '');
  const bName = normalizeText(b?.name || '');
  return aName.localeCompare(bName, 'ar', { sensitivity: 'base' });
}

function getFilteredRecords(){
  const filtered = records.filter(matchesFilters);
  if(filtered.length <= 1){
    return filtered;
  }
  return filtered.sort(compareRecordsForView);
}

// ===== Printing =====

const PRINT_COLUMNS = [
  { key: 'rank', label: 'الرتبة' },
  { key: 'name', label: 'الاسم' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'incomingDate', label: 'تاريخ الوارد' },
  { key: 'residence', label: 'محل الإقامة' },
  { key: 'licenseType', label: LICENSE_TYPE_LABEL },
  { key: 'weaponType', label: 'نوع السلاح' }
];

const PRINT_STYLES = `
  @page { size: A4 landscape; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  body {
    direction: rtl;
    font-family: "Segoe UI", "Tahoma", "Arial", sans-serif;
    color: #111111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { margin: 0 0 6mm; font-size: 20pt; font-weight: 700; text-align: center; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  thead { display: table-header-group; } /* repeat the header on every page */
  tr { page-break-inside: avoid; break-inside: avoid; }
  th, td {
    border: 1px solid #6b7f72;
    padding: 4px 6px;
    text-align: center;
    vertical-align: middle;
  }
  th { background: #107c41; color: #ffffff; font-weight: 700; }
  tbody tr:nth-child(even) td { background: #f2f8f4; }
  .print-total { margin: 5mm 0 0; font-size: 12pt; font-weight: 700; text-align: center; }
`;

/** Print value for one column, matching what the row shows on screen. */
function printCellValue(record, key){
  if(key === 'rank') return getEffectiveRank(record) || '';
  if(key === 'incomingDate'){
    // A record without a date leaves the cell empty, exactly as the row does.
    return isValidIsoDate(record?.incomingDate) ? (formatArabicYyyyMmDd(record.incomingDate) || '') : '';
  }
  return String(record?.[key] ?? '').trim();
}

/** A standalone page holding every filtered record, not just the page on screen. */
function buildPrintDocument(rows){
  const head = PRINT_COLUMNS.map((column)=>`<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map((record)=>`<tr>${
    PRINT_COLUMNS.map((column)=>`<td>${escapeHtml(printCellValue(record, column.key))}</td>`).join('')
  }</tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>موافقة شئون الضباط</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
<h1>موافقة شئون الضباط</h1>
<table>
  <thead><tr>${head}</tr></thead>
  <tbody>${body}</tbody>
</table>
<p class="print-total">الاجمالي: ${escapeHtml(toArabicDigits(rows.length))}</p>
</body>
</html>`;
}

/**
 * Hand a standalone document to the browser's own print dialog.
 * A hidden iframe keeps the app's styles out of the printout and avoids the
 * popup blocker that a new window would hit.
 */
function printHtmlDocument(html){
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  document.body.appendChild(frame);

  const cleanup = ()=>{ if(frame.parentNode) frame.remove(); };

  const start = ()=>{
    const view = frame.contentWindow;
    if(!view){
      cleanup();
      return;
    }
    view.onafterprint = cleanup;
    view.focus();
    view.print();
    // Some browsers never fire afterprint; do not leave the frame behind.
    window.setTimeout(cleanup, 60000);
  };

  const frameDoc = frame.contentWindow?.document;
  if(!frameDoc){
    cleanup();
    return false;
  }
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  if(frameDoc.readyState === 'complete'){
    start();
  } else {
    frame.addEventListener('load', start, { once: true });
  }
  return true;
}

function handlePrintRecords(){
  const filtered = getFilteredRecords();
  if(!filtered.length){
    setStatus('لا توجد سجلات مطابقة للطباعة.', 'info');
    return;
  }

  try {
    commitVisibleDates();
  } catch (error) {
    setStatus('يرجى تصحيح تاريخ الوارد قبل الطباعة.', 'error');
    return;
  }

  try {
    if(!printHtmlDocument(buildPrintDocument(filtered))){
      throw new Error('print frame unavailable');
    }
    setStatus(`تم فتح نافذة الطباعة لعدد ${filtered.length} سجل.`, 'success');
  } catch (error) {
    console.error('Failed to open the print view:', error);
    setStatus('تعذر فتح نافذة الطباعة. حاول مرة أخرى.', 'error');
  }
}

// ===== Import from Excel =====

function formatImportDate(iso){
  if(!isValidIsoDate(iso)) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Give imported rows ids of their own, then run them through the app's own normalizer. */
function buildImportedRecords(rows){
  let nextId = generateNextId();
  const prepared = (Array.isArray(rows) ? rows : []).map((row)=>({
    id: nextId++,
    rank: row?.rank || '',
    name: row?.name || '',
    workplace: row?.workplace || '',
    incomingDate: isValidIsoDate(row?.incomingDate) ? row.incomingDate : null,
    residence: row?.residence || '',
    licenseType: row?.licenseType || '',
    weaponType: row?.weaponType || ''
  }));
  return normalizeRecords(prepared);
}

const IMPORT_PREVIEW_ROW_LIMIT = 100;

function buildImportFieldLabels(report){
  const labels = new Map();
  (Array.isArray(report?.fields) ? report.fields : []).forEach((choice)=>{
    if(choice?.field) labels.set(choice.field, choice.label || choice.field);
  });
  return labels;
}

function formatImportValue(field, value){
  if(field === 'incomingDate') return formatImportDate(value);
  const text = String(value ?? '').trim();
  return text || '—';
}

/** Ask the server what this file would change, using the mapping shown in the dialog. */
async function requestImportPreview(file, mapping){
  const formData = new FormData();
  formData.append('file', file, file.name);
  if(mapping) formData.append('mapping', JSON.stringify(mapping));

  const response = await fetch(IMPORT_PREVIEW_ENDPOINT, { method: 'POST', body: formData });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if(!response.ok || !payload || payload.success === false){
    throw new Error(payload?.message || 'تعذر قراءة ملف الاستيراد.');
  }
  return payload;
}

/** One picker per column of the file, so the user sets exactly what goes where. */
function buildImportMappingHtml(report){
  const columns = Array.isArray(report?.fileColumns) ? report.fileColumns : [];
  const choices = Array.isArray(report?.fields) ? report.fields : [];
  if(!columns.length) return '';

  const rows = columns.map((column)=>{
    const options = ['<option value="">— تجاهل هذا العمود —</option>']
      .concat(choices.map((choice)=>`<option value="${escapeHtml(choice.field)}"${choice.field === column.field ? ' selected' : ''}>${escapeHtml(choice.label)}</option>`))
      .join('');
    const header = column.header || '(بدون عنوان)';
    return `<tr class="${column.field ? 'is-mapped' : ''}">
      <td class="import-map__letter">${escapeHtml(column.letter || '—')}</td>
      <td class="import-map__file">${escapeHtml(header)}</td>
      <td class="import-map__pick">
        <select class="import-map__select" data-column-index="${escapeHtml(String(column.index))}" aria-label="العمود ${escapeHtml(header)} يذهب إلى">${options}</select>
      </td>
      <td class="import-map__sample">${escapeHtml(column.sample || '—')}</td>
    </tr>`;
  }).join('');

  const missing = Array.isArray(report?.missingColumns) ? report.missingColumns : [];

  return `
    <section class="import-section">
      <h3>ربط الأعمدة</h3>
      <p class="import-note import-note--lead">اختر لكل عمود في الملف أين يذهب داخل البرنامج. أي تعديل هنا يُحدِّث الجداول أسفله فوراً.</p>
      <div class="import-table-wrap">
        <table class="import-table import-table--map">
          <thead>
            <tr>
              <th>عمود Excel</th>
              <th>عنوان العمود في الملف</th>
              <th>يذهب إلى عمود البرنامج</th>
              <th>مثال من الملف</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${missing.length ? `<p class="import-warning">أعمدة البرنامج غير المرتبطة بأي عمود في الملف: ${escapeHtml(missing.join('، '))} — لن تُكتب ولن تُمسح من السجلات الموجودة.</p>` : ''}
    </section>
  `;
}

function buildImportRecordsHtml(report){
  const previewRows = (Array.isArray(report?.newRecords) ? report.newRecords : []).slice(0, IMPORT_PREVIEW_ROW_LIMIT);
  const newCount = report?.newCount ?? previewRows.length;

  if(!previewRows.length){
    return `<section class="import-section">
      <h3>السجلات التي ستُضاف</h3>
      <p class="import-note">لا توجد أسماء جديدة في هذا الملف.</p>
    </section>`;
  }

  return `
    <section class="import-section">
      <h3>السجلات التي ستُضاف <span class="import-count">${newCount}</span></h3>
      <div class="import-table-wrap import-table-wrap--tall">
        <table class="import-table">
          <thead>
            <tr><th>صف الملف</th><th>الرتبة</th><th>الاسم</th><th>جهة العمل</th><th>تاريخ الوارد</th><th>محل الإقامة</th><th>${escapeHtml(LICENSE_TYPE_LABEL)}</th><th>نوع السلاح</th></tr>
          </thead>
          <tbody>
            ${previewRows.map((row)=>`<tr>
              <td>${escapeHtml(String(row.rowNumber ?? '—'))}</td>
              <td>${escapeHtml(row.rank || '—')}</td>
              <td>${escapeHtml(row.name || '—')}</td>
              <td>${escapeHtml(row.workplace || '—')}</td>
              <td>${escapeHtml(formatImportDate(row.incomingDate))}</td>
              <td>${escapeHtml(row.residence || '—')}</td>
              <td>${escapeHtml(row.licenseType || '—')}</td>
              <td>${escapeHtml(row.weaponType || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${newCount > previewRows.length ? `<p class="import-note">يعرض أول ${previewRows.length} سجل من ${newCount} — ستتم إضافتها جميعاً.</p>` : ''}
    </section>
  `;
}

/** Existing people whose details differ from the file, field by field. */
function buildImportUpdatesHtml(report, state){
  const updates = Array.isArray(report?.updates) ? report.updates : [];
  const changedCount = report?.changedCount ?? updates.length;
  if(!changedCount) return '';

  const labels = buildImportFieldLabels(report);
  const previewRows = updates.slice(0, IMPORT_PREVIEW_ROW_LIMIT);
  const rows = previewRows.map((update)=>{
    const changes = update?.changes && typeof update.changes === 'object' ? update.changes : {};
    const cells = Object.keys(changes).map((field)=>`
      <div class="import-change">
        <span class="import-change__field">${escapeHtml(labels.get(field) || field)}</span>
        <span class="import-change__old">${escapeHtml(formatImportValue(field, update?.current?.[field]))}</span>
        <span class="import-change__arrow" aria-hidden="true">←</span>
        <span class="import-change__new">${escapeHtml(formatImportValue(field, changes[field]))}</span>
      </div>`).join('');
    return `<tr>
      <td>${escapeHtml(String(update?.rowNumber ?? '—'))}</td>
      <td>${escapeHtml(update?.name || '—')}</td>
      <td class="import-change__cell">${cells}</td>
    </tr>`;
  }).join('');

  return `
    <section class="import-section">
      <h3>سجلات موجودة بنفس الاسم وبيانات مختلفة <span class="import-count">${changedCount}</span></h3>
      <label class="import-replace">
        <input type="checkbox" data-action="replace"${state?.replaceExisting ? ' checked' : ''} />
        <span>استبدال بيانات هذه السجلات بما في الملف</span>
      </label>
      <div class="import-table-wrap import-table-wrap--tall">
        <table class="import-table">
          <thead>
            <tr><th>صف الملف</th><th>الاسم</th><th>ما سيتغير (الحالي ← من الملف)</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="import-note">لا يتغير الاسم، ولا تُمسح الحقول التي لم يملأها الملف.</p>
      ${changedCount > previewRows.length ? `<p class="import-note">يعرض أول ${previewRows.length} سجل من ${changedCount}.</p>` : ''}
    </section>
  `;
}

function buildImportSummaryHtml(report, state){
  return `
    <h2>تأكيد الاستيراد من ملف Excel</h2>
    <p class="import-source">${escapeHtml(report?.fileName || 'ملف Excel')}${report?.sheetName ? ` — ورقة «${escapeHtml(report.sheetName)}»` : ''} — صف العناوين رقم ${escapeHtml(String(report?.headerRow ?? '—'))}</p>
    ${state?.errorMessage ? `<p class="import-warning">${escapeHtml(state.errorMessage)}</p>` : ''}
    ${report?.blockingMessage ? `<p class="import-warning">${escapeHtml(report.blockingMessage)}</p>` : ''}
    <div class="import-stats">
      <span class="import-stat import-stat--new"><strong>${report?.newCount ?? 0}</strong> سجل جديد سيُضاف</span>
      <span class="import-stat import-stat--update"><strong>${report?.changedCount ?? 0}</strong> بنفس الاسم مع اختلاف البيانات</span>
      <span class="import-stat"><strong>${report?.identicalCount ?? 0}</strong> مطابق لما هو مسجل</span>
      <span class="import-stat"><strong>${report?.invalidCount ?? 0}</strong> صف بدون اسم</span>
    </div>
    ${buildImportMappingHtml(report)}
    ${buildImportRecordsHtml(report)}
    ${buildImportUpdatesHtml(report, state)}
  `;
}

function buildImportConfirmLabel(addCount, updateCount){
  if(addCount && updateCount) return `إضافة ${addCount} وتحديث ${updateCount}`;
  if(addCount) return `إضافة ${addCount} سجل`;
  if(updateCount) return `تحديث ${updateCount} سجل`;
  return 'لا يوجد ما يُطبَّق';
}

let importDialogEl = null;

function ensureImportDialog(){
  if(!importDialogEl){
    importDialogEl = document.createElement('div');
    importDialogEl.className = 'import-overlay';
    importDialogEl.innerHTML = '<div class="import-modal" role="dialog" aria-modal="true" aria-labelledby="importDialogTitle"></div>';
    document.body.appendChild(importDialogEl);
  }
  return importDialogEl.querySelector('.import-modal');
}

/**
 * Confirmation dialog for an import.
 *
 * Every column of the file gets a picker; changing one re-runs the preview so
 * the tables underneath always describe the mapping currently on screen.
 * Resolves with what the user chose to apply.
 */
function showImportDialog(initialReport, file){
  return new Promise((resolve)=>{
    const modal = ensureImportDialog();
    let report = initialReport;
    let replaceExisting = true;
    let errorMessage = '';
    let busy = false;

    const close = (action)=>{
      importDialogEl.classList.remove('open');
      document.removeEventListener('keydown', onKeyDown, true);
      importDialogEl.removeEventListener('click', onBackdropClick);
      modal.removeEventListener('change', onChange);
      modal.removeEventListener('click', onClick);
      resolve({ action, report, replaceExisting });
    };

    const syncActions = ()=>{
      const confirmBtn = modal.querySelector('[data-action="confirm"]');
      if(!confirmBtn) return;
      const addCount = report?.newCount || 0;
      const updateCount = replaceExisting ? (report?.changedCount || 0) : 0;
      confirmBtn.textContent = buildImportConfirmLabel(addCount, updateCount);
      confirmBtn.disabled = busy || (!addCount && !updateCount);
    };

    const renderDialog = ()=>{
      const scrollTop = modal.scrollTop;
      modal.innerHTML = `${buildImportSummaryHtml(report, { replaceExisting, errorMessage })}
        <div class="import-actions">
          <button type="button" class="btn primary" data-action="confirm">تطبيق</button>
          <button type="button" class="btn ghost" data-action="cancel">إلغاء</button>
          ${busy ? '<span class="import-busy">جارٍ إعادة الحساب…</span>' : ''}
        </div>`;
      modal.querySelector('h2')?.setAttribute('id', 'importDialogTitle');
      modal.classList.toggle('is-busy', busy);
      if(busy){
        modal.querySelectorAll('select, input, button').forEach((element)=>{ element.disabled = true; });
      }
      syncActions();
      modal.scrollTop = scrollTop;
    };

    const readMapping = ()=>{
      const mapping = {};
      modal.querySelectorAll('.import-map__select').forEach((select)=>{
        mapping[select.dataset.columnIndex] = select.value;
      });
      return mapping;
    };

    const refresh = async ()=>{
      if(busy) return;
      busy = true;
      errorMessage = '';
      const mapping = readMapping();
      renderDialog();
      try {
        report = await requestImportPreview(file, mapping);
      } catch (error) {
        console.error('Failed to re-read import file:', error);
        errorMessage = error?.message || 'تعذر إعادة قراءة الملف بالربط الجديد.';
      } finally {
        busy = false;
        renderDialog();
      }
    };

    const onChange = (event)=>{
      const target = event.target;
      if(target?.classList?.contains('import-map__select')){
        refresh();
        return;
      }
      if(target?.dataset?.action === 'replace'){
        replaceExisting = Boolean(target.checked);
        syncActions();
      }
    };
    const onClick = (event)=>{
      const action = event.target?.closest?.('[data-action]')?.dataset?.action;
      if(action === 'confirm' || action === 'cancel') close(action);
    };
    const onKeyDown = (event)=>{
      if(event.key === 'Escape'){
        event.preventDefault();
        close('cancel');
      }
    };
    const onBackdropClick = (event)=>{
      if(event.target === importDialogEl) close('cancel');
    };

    modal.addEventListener('change', onChange);
    modal.addEventListener('click', onClick);
    importDialogEl.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onKeyDown, true);

    renderDialog();
    importDialogEl.classList.add('open');
    modal.querySelector('[data-action="confirm"]')?.focus();
  });
}

/**
 * Overwrite existing records from the file, one field at a time.
 * Only the fields the file actually filled are touched, so a column the sheet
 * does not have cannot blank out a value the app already holds.
 */
function applyImportUpdates(updates){
  if(!Array.isArray(updates) || !updates.length) return 0;
  let applied = 0;

  updates.forEach((update)=>{
    const recordId = Number(update?.id);
    const changes = update?.changes;
    if(!Number.isFinite(recordId) || !changes || typeof changes !== 'object') return;

    const index = records.findIndex((record)=>Number(record?.id) === recordId);
    if(index === -1) return;

    const next = { ...records[index] };
    let touched = false;
    Object.keys(changes).forEach((field)=>{
      const value = changes[field];
      if(field === 'incomingDate'){
        if(!isValidIsoDate(value)) return;
        next.incomingDate = value;
      } else if(field === 'rank'){
        next.rank = value;
        delete next.specialization; // let the app re-read it from the new rank text
      } else {
        next[field] = value;
      }
      touched = true;
    });
    if(!touched) return;

    records[index] = normalizeRecords([next])[0];
    applied += 1;
  });

  return applied;
}

function handleImportClick(){
  if(isSaving){
    setStatus('انتظر اكتمال عملية الحفظ الجارية.', 'warn');
    return;
  }
  if(dirty){
    setStatus('احفظ التغييرات الحالية قبل الاستيراد.', 'warn');
    return;
  }
  dom.importFileInput?.click();
}

async function handleImportFileSelected(event){
  const input = event?.target;
  const file = input?.files && input.files[0];
  if(!file) return;
  if(input) input.value = ''; // allow re-picking the same file

  if(!/\.xlsx$/i.test(file.name || '')){
    setStatus('يجب اختيار ملف Excel بصيغة xlsx.', 'error');
    return;
  }

  let report = null;
  try {
    setStatus('جاري قراءة ملف الاستيراد…', 'info');
    report = await requestImportPreview(file, null);
  } catch (error) {
    console.error('Failed to read import file:', error);
    setStatus(error?.message || 'تعذر قراءة ملف الاستيراد. حاول مرة أخرى.', 'error');
    return;
  }

  setStatus('', 'muted');
  const decision = await showImportDialog(report, file);
  if(decision?.action !== 'confirm') return;

  // The dialog may have re-read the file under a different mapping.
  report = decision.report || report;

  const imported = buildImportedRecords(report.newRecords);
  const updatedCount = decision.replaceExisting ? applyImportUpdates(report.updates) : 0;
  if(!imported.length && !updatedCount){
    setStatus('لا توجد تغييرات لتطبيقها من الملف.', 'info');
    return;
  }

  if(imported.length){
    imported.forEach((record)=>{
      const numericId = Number(record?.id);
      if(Number.isFinite(numericId)) draftRecordIds.add(numericId);
    });
    records = imported.concat(records);
  }
  currentPage = 1;
  render();
  markDirty();

  const success = await saveAllChanges({ intent: imported.length ? 'add' : 'save' });
  if(success){
    const parts = [];
    if(imported.length) parts.push(`إضافة ${imported.length} سجل`);
    if(updatedCount) parts.push(`تحديث ${updatedCount} سجل`);
    setStatus(`تم ${parts.join(' و')} من ملف الاستيراد.`, 'success');
  }
}

function removeDraftRecordsById(recordIds){
  if(!Array.isArray(recordIds) || !recordIds.length) return 0;
  let removed = 0;
  recordIds.forEach((id)=>{
    const numericId = Number(id);
    if(!Number.isFinite(numericId)) return;
    const index = records.findIndex((record)=>Number(record?.id) === numericId);
    if(index === -1) return;
    records.splice(index, 1);
    draftRecordIds.delete(numericId);
    selectedRecordIds.delete(numericId);
    removed += 1;
  });
  if(removed){
    pruneSelectedRecordIds();
  }
  return removed;
}

async function handleDeleteSelected(){
  if(isSaving){
    setStatus('انتظر اكتمال عملية الحفظ الجارية.', 'warn');
    return;
  }
  if(dirty){
    setStatus('يرجى حفظ التغييرات قبل حذف السجلات.', 'warn');
    return;
  }
  if(!selectedRecordIds.size){
    setStatus('حدد السجلات التي ترغب في حذفها أولاً.', 'info');
    return;
  }
  const count = selectedRecordIds.size;
  const confirmMessage = `سيتم حذف ${toArabicDigits(count)} من السجلات المحددة، مع حفظ نسخة في ملف الاسترجاع. هل أنت متأكد؟`;
  const confirmed = window.confirm(confirmMessage);
  if(!confirmed) return;

  try {
    setStatus('جاري حذف السجلات المحددة…', 'info');
    const response = await fetch(DELETE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedRecordIds) })
    });
    const result = await response.json().catch(() => ({}));
    if(result && result.approvalRequired){
      if(window.DeleteApprovalUserNotice){
        window.DeleteApprovalUserNotice.track(result.request, { message: result.message });
      }
      setStatus(result.message || 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.', 'info');
      return;
    }
    if(!response.ok){
      throw new Error(result.message || 'فشل حذف السجلات المحددة');
    }
    if(dirty){
      const selectedIds = Array.from(selectedRecordIds);
      const draftsOnly = selectedIds.length && selectedIds.every((id)=>draftRecordIds.has(id));
      if(draftsOnly){
        const confirmed = window.confirm('سيتم إلغاء السجلات الجديدة قبل حفظها. هل تريد المتابعة؟');
        if(!confirmed) return;
        const removedCount = removeDraftRecordsById(selectedIds);
        if(removedCount){
          const signatureMatches = computeRecordsSignature(records) === lastRecordsSignature;
          if(signatureMatches){
            clearDirty();
          } else {
            dirty = true;
            updateSaveButtonState();
            updateDeleteButtonState();
          }
          render();
          setStatus('تم إلغاء السجلات الجديدة المحددة.', 'info');
        }
        return;
      }
      setStatus('يرجى حفظ التغييرات قبل حذف السجلات.', 'warn');
      return;
    }
    if(result && result.success === false){
      throw new Error(result.message || 'فشل حذف السجلات المحددة');
    }
    const updated = normalizeRecords(result?.records ?? []);
    records = updated;
    draftRecordIds.clear();
    updateRecordsSignature(updated);
  updateBaselineRecords(updated);
    selectedRecordIds.clear();
    pruneSelectedRecordIds();
    render();
    setStatus('تم حذف السجلات المحددة بنجاح.', 'success');
    if(Array.isArray(result?.undoRecords)){
      deletedState.records = result.undoRecords;
      deletedState.selected.clear();
      if(deletedState.isOpen){
        renderDeletedPanel();
      }
      updateRestoreSelectedState();
    }
  } catch (error) {
    console.error('Failed to delete selected records:', error);
    setStatus('تعذر حذف السجلات المحددة. حاول مرة أخرى.', 'error');
  } finally {
    updateDeleteButtonState();
  }
}

function handleDeletedSelectAll(){
  if(!deletedState.records.length){
    deletedState.selected.clear();
    updateRestoreSelectedState();
    renderDeletedPanel();
    return;
  }
  const allSelected = deletedState.records.every((record)=>deletedState.selected.has(Number(record?.id)));
  if(allSelected){
    deletedState.selected.clear();
  } else {
    deletedState.records.forEach((record)=>{
      const recordId = Number(record?.id);
      if(Number.isFinite(recordId)){
        deletedState.selected.add(recordId);
      }
    });
  }
  renderDeletedPanel();
  updateRestoreSelectedState();
}

async function handleRestoreSelected(){
  if(isSaving){
    setStatus('انتظر اكتمال عملية الحفظ الجارية.', 'warn');
    return;
  }
  if(dirty){
    setStatus('يرجى حفظ التغييرات قبل الاسترجاع.', 'warn');
    return;
  }
  if(!deletedState.selected.size){
    setStatus('اختر السجلات التي ترغب في استرجاعها.', 'info');
    return;
  }

  const ids = Array.from(deletedState.selected);
  try {
    setStatus('جاري استرجاع السجلات المختارة…', 'info');
    const response = await fetch(RESTORE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if(result && result.success === false){
      throw new Error(result.message || 'فشل استرجاع السجلات المحددة');
    }
    const updated = normalizeRecords(result?.records ?? []);
    records = updated;
    draftRecordIds.clear();
    updateRecordsSignature(updated);
  updateBaselineRecords(updated);
    deletedState.records = Array.isArray(result?.undoRecords) ? result.undoRecords : [];
    deletedState.selected.clear();
    pruneSelectedRecordIds();
    render();
    if(deletedState.isOpen){
      renderDeletedPanel();
    }
    updateRestoreSelectedState();
    const restoredCount = Number(result?.restoredCount ?? ids.length);
    setStatus(`تم استرجاع ${toArabicDigits(restoredCount)} من السجلات المحذوفة.`, 'success');
  } catch (error) {
    console.error('Failed to restore selected records:', error);
    setStatus('تعذر استرجاع السجلات المحددة. حاول مرة أخرى.', 'error');
  }
}

function createSelectCell(field, options, value){
  const cell = document.createElement('div');
  cell.className = 'editable-cell editable-select';
  cell.tabIndex = 0;
  cell.dataset.field = field;
  cell.dataset.placeholder = 'اختر';
  const normalized = normalizeText(value);
  cell.dataset.value = normalized;
  cell.textContent = normalized || '';
  return cell;
}

function createRankCompositeCell(record){
  const container = document.createElement('div');
  container.className = 'rank-composite-cell';

  const displayCell = document.createElement('div');
  displayCell.className = 'editable-cell editable-select rank-composite-display';
  displayCell.tabIndex = 0;
  displayCell.dataset.field = 'rank';
  displayCell.dataset.composite = '1';
  displayCell.dataset.placeholder = 'الرتبة';

  container.appendChild(displayCell);
  syncRankCompositeCell(container, record);
  return container;
}

function syncRankCompositeCell(container, record){
  if(!(container instanceof HTMLElement)) return;
  const displayCell = container.querySelector('.rank-composite-display');
  if(!displayCell) return;

  const parts = splitRankAndSpecialization(record?.rank);
  const specialization = normalizeSpecialization(record?.specialization ?? parts.specialization);
  const finalized = finalizeRankSpecialization(parts.rank, specialization);
  const displayRank = formatRankDisplay(finalized.rank, finalized.specialization);

  displayCell.dataset.value = finalized.rank || '';
  displayCell.dataset.specialization = finalized.specialization || '';
  displayCell.dataset.empty = displayRank ? '0' : '1';
  displayCell.textContent = displayRank || '';

  if(displayRank){
    displayCell.setAttribute('aria-label', `الرتبة: ${displayRank}`);
  } else {
    displayCell.setAttribute('aria-label', 'تعيين الرتبة والتخصص');
  }
}

function refreshRankCompositeForCell(cell, record){
  if(!(cell instanceof HTMLElement)) return;
  const container = cell.closest('.rank-composite-cell');
  if(!container) return;
  const displayCell = container.querySelector('.rank-composite-display');
  if(displayCell){
    displayCell.innerHTML = '';
  }
  syncRankCompositeCell(container, record);
}

function startRankCompositeEditing(cell){
  if(!cell || cell.dataset.editing === '1') return;
  const record = resolveRecordFromInput(cell);
  if(!record) return;

  const parts = splitRankAndSpecialization(record?.rank);
  const specialization = normalizeSpecialization(record?.specialization ?? parts.specialization);
  const finalized = finalizeRankSpecialization(parts.rank, specialization);

  clearInlineErrorMessage(cell);
  cell.classList.remove('invalid');

  const optionPools = {
    rank: getSelectOptions('rank', getSelectFallback('rank')),
    specialization: getSelectOptions('specialization', getSelectFallback('specialization'))
  };

  const editor = document.createElement('div');
  editor.className = 'rank-typeahead-editor';

  const cleanupFns = [];
  const registerCleanup = (fn)=>{
    if(typeof fn === 'function') cleanupFns.push(fn);
  };
  const bind = (target, event, handler, options)=>{
    if(!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(event, handler, options);
    registerCleanup(()=>target.removeEventListener(event, handler, options));
  };

  function createControl(field, placeholder, initialValue){
    const container = document.createElement('div');
    container.className = `typeahead-control typeahead-control--${field}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'typeahead-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.field = field;
    input.dataset.typeaheadInput = '1';
    input.dir = 'rtl';
    input.placeholder = placeholder;
    input.value = initialValue || '';

    const list = document.createElement('ul');
    list.className = 'typeahead-options';
    list.setAttribute('role', 'listbox');

    container.append(input);
    const floating = attachFloatingList(input, list);
    registerCleanup(floating.detach);

    const control = {
      field,
      container,
      input,
      list,
      state: {
        optionPool: optionPools[field] || [],
        filtered: [],
        highlightedIndex: -1
      }
    };

    const renderSuggestions = ()=>{
      const filtered = filterTypeaheadOptions(control.state.optionPool, control.input.value);
      control.state.filtered = filtered;
      if(filtered.length === 0){
        control.state.highlightedIndex = -1;
      } else if(control.state.highlightedIndex === -1 || control.state.highlightedIndex >= filtered.length){
        control.state.highlightedIndex = 0;
      }
      control.list.innerHTML = '';
      if(!filtered.length){
        const emptyItem = document.createElement('li');
        emptyItem.className = 'typeahead-option typeahead-option--empty';
        emptyItem.textContent = 'لا توجد نتائج مطابقة';
        control.list.appendChild(emptyItem);
        floating.reposition();
        return;
      }
      filtered.forEach((option, index)=>{
        const item = document.createElement('li');
        item.className = 'typeahead-option';
        item.dataset.value = option;
        item.setAttribute('role', 'option');
        item.textContent = option;
        if(index === control.state.highlightedIndex){
          item.classList.add('is-active');
          item.setAttribute('aria-selected', 'true');
        }
        control.list.appendChild(item);
      });
      floating.reposition();
    };

    control.render = renderSuggestions;
    control.reposition = floating.reposition;
    renderSuggestions();

    const handleInput = ()=>{
      clearInlineErrorMessage(cell);
      cell.classList.remove('invalid');
      renderSuggestions();
    };

    bind(input, 'input', handleInput);

    return control;
  }

  const rankControl = createControl('rank', 'الرتبة', finalized.rank || '');
  const specializationInitial = finalized.specialization === 'فقط' ? '' : finalized.specialization || '';
  const specializationControl = createControl('specialization', 'التخصص (اختياري)', specializationInitial);

  editor.append(rankControl.container, specializationControl.container);

  function clearCompositeError(){
    clearInlineErrorMessage(cell);
    cell.classList.remove('invalid');
  }

  function showCompositeError(message){
    setInlineErrorMessage(cell, message);
    cell.classList.add('invalid');
  }

  function validateControl(control, { allowEmpty = false } = {}){
    const raw = normalizeText(control.input.value);
    if(!raw){
      if(allowEmpty){
        return { success: true, value: '' };
      }
      showCompositeError(control.field === 'rank' ? 'يجب اختيار رتبة' : 'يرجى اختيار تخصص صحيح');
      requestAnimationFrame(()=>{
        control.input.focus();
        control.input.select();
      });
      return { success: false };
    }
    const matched = findMatchingOption(control.state.optionPool, raw);
    if(!matched){
      showCompositeError(control.field === 'rank' ? 'الرتبة غير موجودة في القائمة' : 'التخصص غير موجود في القائمة');
      requestAnimationFrame(()=>{
        control.input.focus();
        control.input.select();
      });
      return { success: false };
    }
    return { success: true, value: matched };
  }

  // Validates both fields, applies changes, and optionally moves focus to another cell.
  function commitComposite({ moveNext = false, movePrev = false } = {}){
    const rankResult = validateControl(rankControl, { allowEmpty: false });
    if(!rankResult.success) return false;
    const specializationResult = validateControl(specializationControl, { allowEmpty: true });
    if(!specializationResult.success) return false;

    clearCompositeError();
    const specializationValue = specializationResult.value || 'فقط';
    finishRankCompositeEditing(cell, record, rankResult.value, specializationValue, true);

    if(moveNext){
      requestAnimationFrame(()=>focusNextEditableCell(cell));
    } else if(movePrev){
      requestAnimationFrame(()=>focusPreviousEditableCell(cell));
    }
    return true;
  }

  function attemptAdvanceToSpecialization(){
    if(validateControl(rankControl, { allowEmpty: false }).success){
      specializationControl.input.focus();
      specializationControl.input.select();
    }
  }

  function cancelEditing(){
    clearCompositeError();
    finishRankCompositeEditing(cell, record, finalized.rank, finalized.specialization, false);
  }

  const handleKeyDown = (control)=>(event)=>{
    if(event.key === 'ArrowDown'){
      event.preventDefault();
      const list = control.state.filtered;
      if(!list.length) return;
      control.state.highlightedIndex = (control.state.highlightedIndex + 1) % list.length;
      control.render();
      return;
    }
    if(event.key === 'ArrowUp'){
      event.preventDefault();
      const list = control.state.filtered;
      if(!list.length) return;
      control.state.highlightedIndex = (control.state.highlightedIndex - 1 + list.length) % list.length;
      control.render();
      return;
    }
    if(event.key === 'Enter'){
      event.preventDefault();
      if(control.field === 'rank'){
        attemptAdvanceToSpecialization();
      } else {
        commitComposite({ moveNext: true });
      }
      return;
    }
    if(event.key === 'Tab'){
      event.preventDefault();
      if(control.field === 'rank'){
        if(event.shiftKey){
          commitComposite({ movePrev: true });
        } else {
          attemptAdvanceToSpecialization();
        }
      } else {
        if(event.shiftKey){
          if(validateControl(specializationControl, { allowEmpty: true }).success){
            rankControl.input.focus();
            rankControl.input.select();
          }
        } else {
          commitComposite({ moveNext: true });
        }
      }
      return;
    }
    if(event.key === 'Escape'){
      event.preventDefault();
      cancelEditing();
    }
  };

  const handleBlur = ()=>{
    setTimeout(()=>{
      if(cell.dataset.editing !== '1') return;
      const active = document.activeElement;
      if(active && editor.contains(active)) return;
      commitComposite();
    }, 0);
  };

  const handleOptionPointer = (control, event)=>{
    const optionEl = event.target.closest('.typeahead-option');
    if(!optionEl || optionEl.classList.contains('typeahead-option--empty')) return;
    event.preventDefault();
    control.input.value = optionEl.dataset.value || optionEl.textContent || '';
    control.render();
    if(control.field === 'rank'){
      attemptAdvanceToSpecialization();
    } else {
      commitComposite({ moveNext: true });
    }
  };

  bind(rankControl.input, 'keydown', handleKeyDown(rankControl));
  bind(specializationControl.input, 'keydown', handleKeyDown(specializationControl));
  bind(rankControl.input, 'blur', handleBlur);
  bind(specializationControl.input, 'blur', handleBlur);
  bind(rankControl.list, 'pointerdown', (event)=>handleOptionPointer(rankControl, event));
  bind(specializationControl.list, 'pointerdown', (event)=>handleOptionPointer(specializationControl, event));

  cell.dataset.editing = '1';
  cell.classList.add('editing');
  cell.innerHTML = '';
  cell.appendChild(editor);

  // The inputs only have a position once the editor is in the page.
  rankControl.reposition();
  specializationControl.reposition();

  cell.__rankCompositeCleanup = ()=>{
    cleanupFns.splice(0).forEach((fn)=>{
      try {
        fn();
      } catch (_) {}
    });
    delete cell.__rankCompositeCleanup;
  };

  requestAnimationFrame(()=>{
    rankControl.input.focus();
    rankControl.input.select();
  });
}

function finishRankCompositeEditing(cell, record, nextRankValue, nextSpecializationValue, commit = true){
  if(!cell) return;
  const cleanup = typeof cell.__rankCompositeCleanup === 'function' ? cell.__rankCompositeCleanup : null;
  if(cleanup){
    cleanup();
  }

  cell.dataset.editing = '';
  cell.classList.remove('editing');
  cell.innerHTML = '';

  if(!record){
    syncRankCompositeCell(cell.closest('.rank-composite-cell'), record || {});
    return;
  }

  if(!commit){
    syncRankCompositeCell(cell.closest('.rank-composite-cell'), record);
    return;
  }

  const previousRank = normalizeText(record?.rank);
  const previousSpecialization = normalizeSpecialization(record?.specialization);
  const normalizedRank = normalizeText(nextRankValue);
  const normalizedSpecialization = normalizeSpecialization(nextSpecializationValue);
  const finalized = finalizeRankSpecialization(normalizedRank, normalizedSpecialization);

  record.rank = finalized.rank;
  record.specialization = finalized.specialization;

  if(previousRank !== finalized.rank || previousSpecialization !== finalized.specialization){
    markDirty();
  }

  syncRankCompositeCell(cell.closest('.rank-composite-cell'), record);
}

function getSelectOptions(field, fallback = []){
  if(field === 'rank' && multiSelects.rank?.getOptions){
    return multiSelects.rank.getOptions();
  }
  if(field === 'residence' && multiSelects.residence?.getOptions){
    return multiSelects.residence.getOptions();
  }
  if(field === 'specialization'){
    if(Array.isArray(fallback) && fallback.length){
      return fallback.slice();
    }
    return SPECIALIZATION_OPTIONS.slice();
  }
  if(field === 'weaponType') return getWeaponTypeOptions();
  if(field === 'licenseType') return getLicenseTypeOptions();
  return Array.isArray(fallback) ? fallback.slice() : [];
}

/**
 * The four approval types, followed by anything the records already hold, so
 * values entered before this list existed stay editable.
 */
function getLicenseTypeOptions(){
  const options = LICENSE_TYPE_OPTIONS.slice();
  const seen = new Set(options.map(normalizeLooseKey));
  records.forEach((rec)=>{
    const value = normalizeText(rec?.licenseType);
    if(!value) return;
    const key = normalizeLooseKey(value);
    if(!key || seen.has(key)) return;
    seen.add(key);
    options.push(value);
  });
  return options;
}

/**
 * The three weapon types, followed by anything the records already hold, so
 * values entered before this list existed stay editable.
 */
function getWeaponTypeOptions(){
  const options = WEAPON_TYPE_OPTIONS.slice();
  const seen = new Set(options.map(normalizeLooseKey));
  records.forEach((rec)=>{
    const value = normalizeText(rec?.weaponType);
    if(!value) return;
    const key = normalizeLooseKey(value);
    if(!key || seen.has(key)) return;
    seen.add(key);
    options.push(value);
  });
  return options;
}

function getSelectFallback(field){
  if(field === 'rank') return RANK_OPTIONS;
  if(field === 'residence') return LOCATION_OPTIONS;
  if(field === 'specialization') return SPECIALIZATION_OPTIONS;
  if(field === 'weaponType') return WEAPON_TYPE_OPTIONS;
  if(field === 'licenseType') return LICENSE_TYPE_OPTIONS;
  return [];
}

function normalizeOptionKey(value){
  return normalizeText(value).replace(/[أإآ]/g,'ا');
}

/**
 * Comparison key that forgives the spellings people actually type: ة for ه,
 * ى for ي, hamza seats, diacritics and tatweel. "بندقيه" and "بندقية" match.
 */
function normalizeLooseKey(value){
  return normalizeText(value)
    .replace(/[ً-ْـ]/g,'')
    .replace(/[أإآٱ]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/ؤ/g,'و')
    .replace(/ئ/g,'ي')
    .replace(/ة/g,'ه')
    .toLowerCase();
}

function editDistance(a, b){
  if(a === b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index)=>index);
  for(let i = 1; i <= a.length; i += 1){
    const current = [i];
    for(let j = 1; j <= b.length; j += 1){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      current[j] = Math.min(current[j-1] + 1, previous[j] + 1, previous[j-1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

const TYPEAHEAD_MIN_SIMILARITY = 0.72;

/** The option a value spells, spelling differences aside. No guessing. */
function findExactOption(options, value){
  if(!Array.isArray(options)) return null;
  const target = normalizeLooseKey(value);
  if(!target) return null;
  return options.find((option)=>normalizeLooseKey(option) === target) || null;
}

/**
 * The option a typed value means. Exact spelling first, then the closest option
 * when the value is a near miss, so a small typo corrects itself on commit.
 */
function findMatchingOption(options, value){
  if(!Array.isArray(options)) return null;
  const target = normalizeLooseKey(value);
  if(!target) return null;

  const exact = findExactOption(options, value);
  if(exact) return exact;

  let best = null;
  let runnerUp = 0;
  options.forEach((option)=>{
    const candidate = normalizeLooseKey(option);
    if(!candidate) return;
    const longest = Math.max(candidate.length, target.length);
    const score = longest ? 1 - editDistance(candidate, target) / longest : 0;
    if(!best || score > best.score){
      runnerUp = best ? best.score : runnerUp;
      best = { option, score };
    } else if(score > runnerUp){
      runnerUp = score;
    }
  });

  // Only correct when one option is clearly the closest.
  if(best && best.score >= TYPEAHEAD_MIN_SIMILARITY && best.score > runnerUp) return best.option;
  return null;
}

function filterTypeaheadOptions(options, query, { fuzzy = true } = {}){
  if(!Array.isArray(options)) return [];
  const normalizedQuery = normalizeLooseKey(query);
  if(!normalizedQuery){
    return options.slice(0, TYPEAHEAD_MAX_RESULTS);
  }
  const matches = options.filter((option)=>normalizeLooseKey(option).includes(normalizedQuery));
  if(matches.length) return matches.slice(0, TYPEAHEAD_MAX_RESULTS);

  // A free-text cell suggests nothing once the text stops matching: the value is
  // the user's own, and a loose guess must not be offered for Enter to take.
  if(!fuzzy) return [];

  // Nothing contains what was typed: offer the closest options instead of nothing.
  return options
    .map((option)=>{
      const candidate = normalizeLooseKey(option);
      const longest = Math.max(candidate.length, normalizedQuery.length);
      return { option, score: longest ? 1 - editDistance(candidate, normalizedQuery) / longest : 0 };
    })
    .filter((entry)=>entry.score >= 0.5)
    .sort((a, b)=>b.score - a.score)
    .slice(0, TYPEAHEAD_MAX_RESULTS)
    .map((entry)=>entry.option);
}

const TYPEAHEAD_LIST_MAX_HEIGHT = 200; // keep in step with .typeahead-options in the stylesheet
const TYPEAHEAD_LIST_GAP = 2;
const TYPEAHEAD_LIST_MIN_HEIGHT = 72;
const floatingTypeaheadHandles = new Set();

/**
 * Float a suggestion list over the page instead of inside the grid.
 *
 * A list rendered in place gets cut off at the edge of the table: the scroller
 * clips it, and the results card keeps a transform after its intro animation,
 * which makes it the containing block for anything positioned fixed inside it.
 * Moving the list to <body> and placing it against the input's viewport rect
 * escapes both, and it flips to whichever side of the cell has room.
 */
function attachFloatingList(input, list, { preferUp = false } = {}){
  const noop = { reposition(){}, detach(){} };
  if(!(input instanceof HTMLElement) || !(list instanceof HTMLElement)) return noop;

  list.classList.add('typeahead-options--floating');
  document.body.appendChild(list);

  const reposition = ()=>{
    if(!list.isConnected) return;
    const rect = input.getBoundingClientRect();
    if(!rect.width && !rect.height) return;

    const spaceAbove = rect.top - TYPEAHEAD_LIST_GAP;
    const spaceBelow = window.innerHeight - rect.bottom - TYPEAHEAD_LIST_GAP;
    const wanted = Math.min(list.scrollHeight || TYPEAHEAD_LIST_MAX_HEIGHT, TYPEAHEAD_LIST_MAX_HEIGHT);

    let openUp = preferUp;
    const fitsOnPreferredSide = openUp ? spaceAbove >= wanted : spaceBelow >= wanted;
    if(!fitsOnPreferredSide) openUp = spaceAbove > spaceBelow;

    const room = Math.max(TYPEAHEAD_LIST_MIN_HEIGHT, openUp ? spaceAbove : spaceBelow);
    const height = Math.min(TYPEAHEAD_LIST_MAX_HEIGHT, room);

    // `right` must be released explicitly: with left + width + right set, an RTL
    // page drops `left` and throws the box to the opposite edge of the screen.
    list.style.position = 'fixed';
    list.style.right = 'auto';
    list.style.maxHeight = `${height}px`;
    list.style.width = `${rect.width}px`;
    list.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - rect.width - 4))}px`;

    if(openUp){
      // Anchor the bottom edge to the cell rather than guessing a top from the
      // room available: the box then sits tight against the cell whatever its
      // height, and stays there as the list shrinks while typing.
      list.style.top = 'auto';
      list.style.bottom = `${Math.max(4, window.innerHeight - rect.top + TYPEAHEAD_LIST_GAP)}px`;
    } else {
      list.style.bottom = 'auto';
      list.style.top = `${rect.bottom + TYPEAHEAD_LIST_GAP}px`;
    }
    list.dataset.direction = openUp ? 'up' : 'down';
  };

  const handle = {
    reposition,
    detach(){
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      floatingTypeaheadHandles.delete(handle.detach);
      list.remove();
    }
  };

  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  floatingTypeaheadHandles.add(handle.detach);
  reposition();
  return handle;
}

/** Drop any list left over from a cell that is being rebuilt or removed. */
function detachFloatingLists(){
  Array.from(floatingTypeaheadHandles).forEach((detach)=>{
    try { detach(); } catch (_) {}
  });
  floatingTypeaheadHandles.clear();
}

function focusNextEditableCell(cell){
  if(!(cell instanceof HTMLElement)) return;
  const displayCell = cell.closest('.editable-cell');
  const row = displayCell?.closest('tr');
  if(!row || !displayCell) return;
  const cells = Array.from(row.querySelectorAll('.editable-cell'));
  const currentIndex = cells.indexOf(displayCell);
  if(currentIndex === -1) return;
  for(let i = currentIndex + 1; i < cells.length; i += 1){
    const next = cells[i];
    if(!(next instanceof HTMLElement)) continue;
    if(next.offsetParent === null) continue;
    next.focus();
    return;
  }
}

function focusPreviousEditableCell(cell){
  if(!(cell instanceof HTMLElement)) return;
  const displayCell = cell.closest('.editable-cell');
  const row = displayCell?.closest('tr');
  if(!row || !displayCell) return;
  const cells = Array.from(row.querySelectorAll('.editable-cell'));
  const currentIndex = cells.indexOf(displayCell);
  if(currentIndex <= 0) return;
  for(let i = currentIndex - 1; i >= 0; i -= 1){
    const prev = cells[i];
    if(!(prev instanceof HTMLElement)) continue;
    if(prev.offsetParent === null) continue;
    prev.focus();
    return;
  }
}

function startSelectEditing(cell){
  if(!cell || cell.dataset.editing === '1') return;
  const field = cell.dataset.field;
  if(!field) return;
  if(field === 'rank' && cell.dataset.composite === '1'){
    startRankCompositeEditing(cell);
    return;
  }

  clearInlineErrorMessage(cell);
  cell.classList.remove('invalid');

  const isFreeText = FREE_TEXT_SELECT_FIELDS.has(field);
  const optionPool = getSelectOptions(field, getSelectFallback(field));
  const editor = document.createElement('div');
  editor.className = 'typeahead-editor';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'typeahead-input';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.dataset.field = field;
  input.dataset.typeaheadInput = '1';
  input.dir = 'rtl';
  input.value = cell.dataset.value || '';
  input.placeholder = cell.dataset.placeholder || 'ابحث';

  const list = document.createElement('ul');
  list.className = 'typeahead-options';
  list.setAttribute('role', 'listbox');

  editor.append(input);

  cell.dataset.editing = '1';
  cell.classList.add('editing');
  cell.innerHTML = '';
  cell.appendChild(editor);

  detachFloatingLists();
  const floating = attachFloatingList(input, list, { preferUp: DROP_UP_FIELDS.has(field) });
  cell.__typeaheadCleanup = ()=>{
    floating.detach();
    delete cell.__typeaheadCleanup;
  };

  const state = {
    optionPool,
    filtered: [],
    highlightedIndex: -1
  };

  function renderSuggestions(){
    const filtered = filterTypeaheadOptions(state.optionPool, input.value, { fuzzy: !isFreeText });
    state.filtered = filtered;
    if(filtered.length === 0){
      state.highlightedIndex = -1;
    } else if(state.highlightedIndex === -1 || state.highlightedIndex >= filtered.length){
      state.highlightedIndex = 0;
    }
    list.innerHTML = '';
    if(!filtered.length){
      const emptyItem = document.createElement('li');
      emptyItem.className = 'typeahead-option typeahead-option--empty';
      emptyItem.textContent = 'لا توجد نتائج مطابقة';
      emptyItem.setAttribute('aria-live', 'polite');
      list.appendChild(emptyItem);
      floating.reposition();
      return;
    }
    filtered.forEach((option, index)=>{
      const item = document.createElement('li');
      item.className = 'typeahead-option';
      item.dataset.value = option;
      item.setAttribute('role', 'option');
      item.textContent = option;
      if(index === state.highlightedIndex){
        item.classList.add('is-active');
        item.setAttribute('aria-selected', 'true');
      }
      list.appendChild(item);
    });
    floating.reposition();
  }

  /**
   * What the typed text should become.
   *
   * `autocomplete` is the deliberate accept — Enter or Tab — where the
   * highlighted suggestion completes what was typed. Leaving a free-text cell
   * keeps the text exactly as written instead.
   */
  function resolveCandidate({ autocomplete = true } = {}){
    const typed = normalizeText(input.value);
    if(!typed) return '';
    if(!autocomplete) return typed;
    if(isFreeText){
      if(findExactOption(state.optionPool, typed)) return typed;
    } else if(findMatchingOption(state.optionPool, typed)){
      return typed;
    }
    const highlighted = state.highlightedIndex > -1 ? state.filtered[state.highlightedIndex] : null;
    return highlighted ?? typed;
  }

  function tryCommit({ moveNext = false } = {}){
    const committed = finishSelectEditing(cell, resolveCandidate(), { commit: true, moveNext });
    if(!committed){
      requestAnimationFrame(()=>input.focus());
    }
  }

  function handleInput(){
    clearInlineErrorMessage(cell);
    cell.classList.remove('invalid');
    renderSuggestions();
  }

  function handleKeyDown(event){
    if(event.key === 'ArrowDown'){
      event.preventDefault();
      if(!state.filtered.length){
        state.filtered = filterTypeaheadOptions(state.optionPool, input.value);
      }
      if(state.filtered.length){
        state.highlightedIndex = (state.highlightedIndex + 1) % state.filtered.length;
        renderSuggestions();
      }
      return;
    }
    if(event.key === 'ArrowUp'){
      event.preventDefault();
      if(state.filtered.length){
        state.highlightedIndex = (state.highlightedIndex - 1 + state.filtered.length) % state.filtered.length;
        renderSuggestions();
      }
      return;
    }
    if(event.key === 'Enter'){
      event.preventDefault();
      tryCommit({ moveNext: true });
      return;
    }
    if(event.key === 'Tab'){
      event.preventDefault();
      const committed = finishSelectEditing(cell, resolveCandidate(), { commit: true, moveNext: !event.shiftKey });
      if(!committed){
        requestAnimationFrame(()=>input.focus());
        return;
      }
      if(event.shiftKey){
        requestAnimationFrame(()=>focusPreviousEditableCell(cell));
      }
      return;
    }
    if(event.key === 'Escape'){
      event.preventDefault();
      finishSelectEditing(cell, null, { commit: false });
      return;
    }
  }

  function handleBlur(){
    setTimeout(()=>{
      const active = document.activeElement;
      if(active && editor.contains(active)) return;
      if(cell.dataset.editing !== '1') return;
      const candidate = resolveCandidate({ autocomplete: !isFreeText });
      const committed = finishSelectEditing(cell, candidate, { commit: true, moveNext: false });
      if(!committed){
        requestAnimationFrame(()=>input.focus());
      }
    }, 0);
  }

  function handleOptionPointer(event){
    const optionEl = event.target.closest('.typeahead-option');
    if(!optionEl || optionEl.classList.contains('typeahead-option--empty')) return;
    event.preventDefault();
    input.value = optionEl.dataset.value || optionEl.textContent || '';
    const committed = finishSelectEditing(cell, input.value, { commit: true, moveNext: false });
    if(!committed){
      requestAnimationFrame(()=>input.focus());
    }
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeyDown);
  input.addEventListener('blur', handleBlur);
  list.addEventListener('pointerdown', handleOptionPointer);

  renderSuggestions();
  requestAnimationFrame(()=>{
    input.focus();
    input.select();
  });
}

function finishSelectEditing(cell, nextValue, { commit = true, moveNext = false } = {}){
  if(!cell) return true;
  const field = cell.dataset.field;
  const previousValue = normalizeText(cell.dataset.value);
  const record = resolveRecordFromInput(cell);
  // Only run when the cell really closes: a rejected value keeps it in edit.
  const closeEditor = ()=>{
    if(typeof cell.__typeaheadCleanup === 'function') cell.__typeaheadCleanup();
  };

  if(!commit){
    closeEditor();
    cell.dataset.value = previousValue;
    cell.dataset.editing = '';
    cell.classList.remove('editing');
    cell.textContent = previousValue || '';
    clearInlineErrorMessage(cell);
    cell.classList.remove('invalid');
    if(field === 'rank' || field === 'specialization'){
      refreshRankCompositeForCell(cell, record);
    }
    return true;
  }

  const normalizedNext = normalizeText(nextValue);
  if(!normalizedNext){
    closeEditor();
    cell.dataset.value = '';
    cell.dataset.editing = '';
    cell.classList.remove('editing');
    cell.textContent = '';
    clearInlineErrorMessage(cell);
    cell.classList.remove('invalid');
    if(record && field && record[field] !== ''){
      record[field] = '';
      markDirty();
    }
    if(field === 'rank' || field === 'specialization'){
      refreshRankCompositeForCell(cell, record);
    }
    if(moveNext){
      requestAnimationFrame(()=>focusNextEditableCell(cell));
    }
    return true;
  }

  const optionPool = getSelectOptions(field, getSelectFallback(field));
  // A free-text cell takes whatever was typed; it only adopts the list's
  // spelling when the value is that option written differently.
  const isFreeText = FREE_TEXT_SELECT_FIELDS.has(field);
  const matched = isFreeText
    ? (findExactOption(optionPool, normalizedNext) || normalizedNext)
    : findMatchingOption(optionPool, normalizedNext);
  if(!matched){
    setInlineErrorMessage(cell, 'الخيار غير موجود في القائمة');
    cell.classList.add('invalid');
    return false;
  }

  closeEditor();
  clearInlineErrorMessage(cell);
  cell.classList.remove('invalid');

  const finalValue = matched;
  let recordValue = finalValue;
  let displayValue = finalValue;

  if(field === 'specialization'){
    recordValue = normalizeSpecialization(finalValue);
    displayValue = recordValue === 'فقط' ? '' : recordValue;
  }

  cell.dataset.value = recordValue;
  cell.dataset.editing = '';
  cell.classList.remove('editing');
  cell.textContent = displayValue;

  if(record && field && record[field] !== recordValue){
    record[field] = recordValue;
    markDirty();
  }
  if(field === 'rank' || field === 'specialization'){
    refreshRankCompositeForCell(cell, record);
  }

  if(moveNext){
    requestAnimationFrame(()=>focusNextEditableCell(cell));
  }

  return true;
}

function createTextCell(field, value){
  const cell = document.createElement('div');
  cell.className = 'editable-cell editable-text';
  cell.contentEditable = 'true';
  cell.spellcheck = false;
  cell.dataset.field = field;
  cell.dataset.placeholder = '—';
  const initial = sanitizeEditableText(value || '', { trimEnd: true });
  cell.textContent = initial;
  cell.dataset.lastValidValue = initial;
  return cell;
}

function createDateCell(rec){
  const cell = document.createElement('div');
  cell.className = 'editable-cell editable-date';
  cell.contentEditable = 'true';
  cell.dataset.field = 'incomingDate';
  cell.dataset.placeholder = 'DD/MM/YYYY';
  cell.spellcheck = false;
  cell.dataset.iso = rec.incomingDate || '';
  cell.dataset.invalid = '';
  if(rec.incomingDate){
    cell.textContent = formatArabicYyyyMmDd(rec.incomingDate) || '';
  } else {
    cell.textContent = '';
  }
  cell.dataset.lastValidDisplay = isoToDdMmYyyy(rec.incomingDate || '') || '';
  return cell;
}

function sanitizeEditableText(value, { trimEnd = false } = {}){
  const cleaned = String(value ?? '').replace(/[\r\n]+/g,' ').replace(/\u00a0/g,' ');
  return trimEnd ? cleaned.replace(/\s+$/,'') : cleaned;
}

function parseDdMmYyyyFlexible(value){
  const en = toEnglishDigits(value ?? '').trim();
  if(!en) return null;

  const parts = en.split(/[^0-9]+/).filter(Boolean);
  let dayStr;
  let monthStr;
  let yearStr;

  if(parts.length === 3){
    [dayStr, monthStr, yearStr] = parts;
  } else {
    const digitsOnly = en.replace(/[^0-9]/g,'');
    if(digitsOnly.length !== 8) return null;
    dayStr = digitsOnly.slice(0,2);
    monthStr = digitsOnly.slice(2,4);
    yearStr = digitsOnly.slice(4,8);
  }

  if(!dayStr || !monthStr || !yearStr || yearStr.length !== 4) return null;

  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  if(!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if(!(day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000)) return null;

  const check = new Date(Date.UTC(year, month - 1, day));
  if(check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day){
    return null;
  }

  return { dd: day, mm: month, yyyy: year };
}

function finalizeEditableDateValue(element){
  const raw = element.textContent ?? '';
  const cleaned = sanitizeEditableText(raw, { trimEnd: true });
  if(raw !== cleaned){
    element.textContent = cleaned;
  }
  const previousIso = element.dataset.iso || '';
  const previousDisplay = element.dataset.lastValidDisplay || (previousIso ? isoToDdMmYyyy(previousIso) : '') || '';
  if(cleaned && NON_DIGIT_DATE_REGEX.test(cleaned)){
    setInlineErrorMessage(element, 'ارقام فقط');
    element.dataset.invalid = '';
    element.classList.remove('invalid');
  element.dataset.iso = previousIso;
    const fallbackDisplay = previousDisplay ? toArabicDigits(previousDisplay) : '';
    if(element.textContent !== fallbackDisplay){
      element.textContent = fallbackDisplay;
    }
    return;
  }
  clearInlineErrorMessage(element);
  const parsed = parseDdMmYyyyFlexible(cleaned);
  if(parsed){
    const iso = ddmmyyyyToIso(parsed);
    element.dataset.iso = iso;
    element.dataset.invalid = '';
    element.textContent = formatArabicYyyyMmDd(iso);
    element.classList.remove('invalid');
    element.dataset.lastValidDisplay = isoToDdMmYyyy(iso) || '';
  } else {
    element.dataset.iso = '';
    element.dataset.invalid = '1';
    element.classList.add('invalid');
    element.textContent = cleaned;
  }
}

function handleDateCommit(input){
  const record = resolveRecordFromInput(input);
  if(!record) return;

  if(input.dataset.invalid === '1'){
    input.classList.add('invalid');
    setStatus('تاريخ الوارد غير مكتمل. يرجى إدخال اليوم/الشهر/السنة.', 'error');
    return;
  }

  const iso = input.dataset.iso || null;
  input.classList.remove('invalid');
  if(dom.saveStatus && dom.saveStatus.dataset.variant === 'error'){
    setStatus('', 'muted');
  }
  if(record.incomingDate !== iso){
    record.incomingDate = iso;
    markDirty();
  }
}

function resolveRecordFromInput(target){
  if(!target) return null;
  const row = target.closest('tr');
  if(!row) return null;
  const id = Number(row.dataset.id);
  if(!Number.isFinite(id)) return null;
  return records.find((rec)=>Number(rec.id) === id) || null;
}

// Filters
const SEARCH_INPUT_DEBOUNCE_MS = 200;
let searchInputDebounceTimer = null;
let searchInputComposing = false;

function applyNameSearchFilter(){
  filterState.name = normalizeText(dom.nameSearch?.value || '');
  renderReset();
}

function scheduleNameSearchFilter(){
  if(searchInputComposing) return;
  if(searchInputDebounceTimer) clearTimeout(searchInputDebounceTimer);
  searchInputDebounceTimer = setTimeout(()=>{
    searchInputDebounceTimer = null;
    applyNameSearchFilter();
  }, SEARCH_INPUT_DEBOUNCE_MS);
}

dom.nameSearch?.addEventListener('compositionstart', ()=>{
  searchInputComposing = true;
});
dom.nameSearch?.addEventListener('compositionend', ()=>{
  searchInputComposing = false;
  scheduleNameSearchFilter();
});
dom.nameSearch?.addEventListener('input', scheduleNameSearchFilter);
dom.nameSearch?.addEventListener('keydown', (event)=>{
  if(event.key === 'Enter'){
    event.preventDefault();
    if(searchInputDebounceTimer){
      clearTimeout(searchInputDebounceTimer);
      searchInputDebounceTimer = null;
    }
    applyNameSearchFilter();
  }
});

initMultiSelect('rank', dom.rankMulti, RANK_OPTIONS, {
  allLabel: 'كل الرتب',
  summary: (count)=>`تم اختيار ${toArabicDigits(count)}`,
  emptyLabel: 'لا توجد رتب متاحة حالياً'
});

initMultiSelect('residence', dom.residenceMulti, LOCATION_OPTIONS, {
  allLabel: 'كل أماكن الإقامة',
  summary: (count)=>`تم اختيار ${toArabicDigits(count)}`,
  emptyLabel: 'لا توجد أماكن متاحة حالياً'
});

initMultiSelect('specialization', dom.specializationMulti, SPECIALIZATION_OPTIONS, {
  allLabel: 'كل التخصصات',
  summary: (count)=>`تم اختيار ${toArabicDigits(count)}`,
  emptyLabel: 'لا توجد تخصصات متاحة حالياً'
});

initMultiSelect('year', dom.yearMulti, [], {
  allLabel: 'كل السنوات',
  summary: (count)=>`تم اختيار ${toArabicDigits(count)}`,
  emptyLabel: 'لا توجد سنوات متاحة حالياً'
});

if(dom.addRecordForm){
  populateAddFormSelects();
  clearAddRecordForm();
  setAddPanelVisible(false);
  dom.addRecordForm.addEventListener('submit', handleAddFormSubmit);
}

dom.addFormResetBtn?.addEventListener('click', (event)=>{
  event.preventDefault();
  clearAddRecordForm();
});

dom.addFormCancelBtn?.addEventListener('click', (event)=>{
  event.preventDefault();
  setAddPanelVisible(false);
});

// Pagination
dom.pgFirst?.addEventListener('click', () => goToPage(1));
dom.pgPrev?.addEventListener('click',  () => goToPage(currentPage - 1));
dom.pgNext?.addEventListener('click',  () => goToPage(currentPage + 1));
dom.pgLast?.addEventListener('click',  () => goToPage(Math.ceil(getFilteredRecords().length / PAGE_SIZE)));

// Live table interactions
dom.resultsBody?.addEventListener('focusin', handleEditableFocus);
dom.resultsBody?.addEventListener('keydown', handleEditableKeyDown);
dom.resultsBody?.addEventListener('input', handleTableInput);
dom.resultsBody?.addEventListener('blur', handleEditableBlur, true);
dom.resultsBody?.addEventListener('change', handleTableChange);

// Add new row
dom.addRowBtn?.addEventListener('click', handleAddRow);
// Delete & restore workflows
dom.deleteBtn?.addEventListener('click', handleDeleteSelected);
dom.restoreBtn?.addEventListener('click', ()=>{ toggleDeletedPanel(); });
dom.restoreSelectedBtn?.addEventListener('click', handleRestoreSelected);
dom.deletedSelectAllBtn?.addEventListener('click', handleDeletedSelectAll);
dom.closeDeletedPanelBtn?.addEventListener('click', ()=>{ toggleDeletedPanel(false); });
dom.deletedOverlay?.addEventListener('click', (event)=>{
  if(event.target === dom.deletedOverlay){
    toggleDeletedPanel(false);
  }
});

// Save all
dom.saveAllBtn?.addEventListener('click', (event)=>{
  event?.preventDefault();
  saveAllChanges({ intent: 'save' });
});

dom.printBtn?.addEventListener('click', handlePrintRecords);

// Import from an Excel sheet
dom.importBtn?.addEventListener('click', handleImportClick);
dom.importFileInput?.addEventListener('change', handleImportFileSelected);

document.querySelector('.back-button')?.addEventListener('click', async (event)=>{
  event.preventDefault();
  const target = event.currentTarget?.getAttribute('data-target') || '/';
  if(!dirty){
    await exitToTarget(target);
    return;
  }
  await showUnsavedDialog({
    onSave: async ()=>{
      const success = await saveAllChanges({ intent: 'save' });
      if(success){
        await exitToTarget(target);
        return true;
      }
      return false;
    },
    onDiscard: async ()=>{
      await exitToTarget(target);
      return true;
    }
  });
});

// User chip (demo)
(function(){
  const chipName = document.getElementById('userDisplayName');
  const chipRole = document.getElementById('userRole');
  chipName.textContent = '—';
  chipRole.textContent = ROLE_LABELS.user;
})();

function handleEditableFocus(event){
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;

  if(target.classList.contains('editable-select')){
    startSelectEditing(target);
    return;
  }

  if(!target.isContentEditable) return;

  target.classList.add('editing');
  const field = target.dataset.field;

  if(field === 'incomingDate'){
    target.classList.remove('invalid');
    target.dataset.invalid = '';
    const iso = target.dataset.iso || '';
    if(iso){
      const ddmmyyyy = isoToDdMmYyyy(iso) || '';
      if(ddmmyyyy && target.textContent !== ddmmyyyy){
        target.textContent = ddmmyyyy;
      }
    }
  } else {
    const text = sanitizeEditableText(target.textContent || '');
    if(target.textContent !== text){
      target.textContent = text;
    }
  }
}

function handleEditableBlur(event){
  const target = event.target;
  if(!(target instanceof HTMLElement) || !target.isContentEditable) return;
  const field = target.dataset.field;

  if(field === 'incomingDate'){
    finalizeEditableDateValue(target);
    handleDateCommit(target);
  } else if(field){
    const record = resolveRecordFromInput(target);
    if(record){
      const text = sanitizeEditableText(target.textContent || '', { trimEnd: true });
      if(target.textContent !== text){
        target.textContent = text;
      }
      let blocked = false;
      if(LETTERS_ONLY_FIELDS.has(field) && DIGITS_REGEX.test(text)){
        setInlineErrorMessage(target, 'حروف فقط');
        const fallback = target.dataset.lastValidValue ?? String(record[field] ?? '');
        const safeFallback = sanitizeEditableText(fallback, { trimEnd: true });
        if(target.textContent !== safeFallback){
          target.textContent = safeFallback;
        }
        blocked = true;
      } else {
        clearInlineErrorMessage(target);
      }
      if(blocked){
        target.classList.remove('editing');
        return;
      }
      if(record[field] !== text){
        record[field] = text;
        markDirty();
      }
      target.dataset.lastValidValue = text;
    }
  }

  target.classList.remove('editing');
}

function handleEditableKeyDown(event){
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;

  if(target.classList.contains('editable-select')){
    if(target.dataset.editing !== '1' && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')){
      event.preventDefault();
      startSelectEditing(target);
    }
    return;
  }

  if(!target.isContentEditable) return;
  if(event.key === 'Enter'){
    event.preventDefault();
    target.blur();
  }
}

function handleTableInput(event){
  const target = event.target;
  if(target instanceof HTMLInputElement){
    if(target.dataset.typeaheadInput === '1') return;
    const field = target.dataset.field;
    if(!field || field === 'incomingDate') return;
    const record = resolveRecordFromInput(target);
    if(!record) return;
    const value = target.value;
    if(record[field] !== value){
      record[field] = value;
      markDirty();
    }
    return;
  }

  if(!(target instanceof HTMLElement)) return;
  const field = target.dataset.field;
  if(!field) return;
  if(target.classList.contains('editable-select')) return;
  if(!target.isContentEditable) return;

  if(field === 'incomingDate'){
    const value = sanitizeEditableText(target.textContent || '');
    if(value && NON_DIGIT_DATE_REGEX.test(value)){
      setInlineErrorMessage(target, 'ارقام فقط');
      const previousIso = target.dataset.iso || '';
      const previousDisplay = target.dataset.lastValidDisplay || (previousIso ? isoToDdMmYyyy(previousIso) : '') || '';
      const fallback = previousDisplay ? toArabicDigits(previousDisplay) : '';
      if(target.textContent !== fallback){
        target.textContent = fallback;
      }
      target.dataset.iso = previousIso;
      return;
    }
    clearInlineErrorMessage(target);
    target.dataset.iso = '';
    target.dataset.invalid = '';
    target.classList.remove('invalid');
    return;
  }

  const record = resolveRecordFromInput(target);
  if(!record) return;
  const value = sanitizeEditableText(target.textContent || '');
  if(LETTERS_ONLY_FIELDS.has(field)){
    if(DIGITS_REGEX.test(value)){
      setInlineErrorMessage(target, 'حروف فقط');
      const fallback = target.dataset.lastValidValue ?? String(record[field] ?? '');
      const safeFallback = sanitizeEditableText(fallback, { trimEnd: true });
      if(target.textContent !== safeFallback){
        target.textContent = safeFallback;
      }
      return;
    }
    clearInlineErrorMessage(target);
  }
  if(record[field] !== value){
    record[field] = value;
    markDirty();
  }
  target.dataset.lastValidValue = value;
}

function handleTableChange(event){
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;
  if(!(target instanceof HTMLSelectElement) && !(target instanceof HTMLInputElement)) return;
  if(target.dataset.typeaheadInput === '1') return;
  const field = target.dataset.field;
  if(!field) return;
  if(field === 'incomingDate'){
    handleDateCommit(target);
    return;
  }
  const record = resolveRecordFromInput(target);
  if(!record) return;
  const value = target.value;
  if(record[field] !== value){
    record[field] = value;
    markDirty();
  }
}

function setAddPanelVisible(visible){
  if(!dom.addRecordPanel) return;
  const next = !!visible;
  addPanelVisible = next;
  dom.addRecordPanel.hidden = !next;
  dom.addRecordPanel.setAttribute('aria-hidden', next ? 'false' : 'true');
  dom.addRecordPanel.classList.toggle('is-visible', next);
}

function setAddFormFieldValidity(field, isValid){
  if(!field) return;
  if(isValid){
    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');
    return;
  }
  field.classList.add('is-invalid');
  field.setAttribute('aria-invalid', 'true');
}

function resetAddFormValidation(){
  if(!dom.addRecordForm) return;
  dom.addRecordForm.querySelectorAll('.is-invalid').forEach((element)=>{
    element.classList.remove('is-invalid');
    element.removeAttribute('aria-invalid');
  });
}

function collectAddFormValues(){
  if(!dom.addRecordForm) return null;
  resetAddFormValidation();
  const issues = [];
  const values = {
    rank: '',
    specialization: 'فقط',
    name: '',
    workplace: '',
    incomingDate: null,
    residence: '',
    licenseType: '',
    weaponType: ''
  };

  const rankInput = dom.addFormRank;
  const rank = normalizeText(rankInput?.value);
  if(!rank){
    issues.push({ field: rankInput, message: 'يرجى إدخال الرتبة.' });
    setAddFormFieldValidity(rankInput, false);
  } else {
    values.rank = rank;
    setAddFormFieldValidity(rankInput, true);
  }

  const specializationSelect = dom.addFormSpecialization;
  const specialization = normalizeSpecialization(specializationSelect?.value || 'فقط');
  values.specialization = specialization;
  setAddFormFieldValidity(specializationSelect, true);

  const nameInput = dom.addFormName;
  const name = normalizeText(nameInput?.value);
  if(!name){
    issues.push({ field: nameInput, message: 'يرجى إدخال الاسم.' });
    setAddFormFieldValidity(nameInput, false);
  } else {
    values.name = name;
    setAddFormFieldValidity(nameInput, true);
  }

  const workplaceInput = dom.addFormWorkplace;
  const workplace = normalizeText(workplaceInput?.value);
  if(!workplace){
    issues.push({ field: workplaceInput, message: 'يرجى تحديد جهة العمل.' });
    setAddFormFieldValidity(workplaceInput, false);
  } else {
    values.workplace = workplace;
    setAddFormFieldValidity(workplaceInput, true);
  }

  const dateInput = dom.addFormIncomingDate;
  const parsedDate = parseDdMmYyyyFlexible(dateInput?.value);
  if(!parsedDate){
    issues.push({ field: dateInput, message: 'يرجى إدخال تاريخ وارد صالح بالصيغة يوم/شهر/سنة.' });
    setAddFormFieldValidity(dateInput, false);
  } else {
    values.incomingDate = ddmmyyyyToIso(parsedDate);
    setAddFormFieldValidity(dateInput, true);
  }

  const residenceSelect = dom.addFormResidence;
  const residence = normalizeText(residenceSelect?.value);
  if(!residence){
    issues.push({ field: residenceSelect, message: 'يرجى اختيار محل الإقامة.' });
    setAddFormFieldValidity(residenceSelect, false);
  } else {
    values.residence = residence;
    setAddFormFieldValidity(residenceSelect, true);
  }

  // Both fields are optional: older records were entered without them. The
  // approval type comes straight from the list, so nothing to correct.
  const chosenLicense = normalizeText(dom.addFormLicenseType?.value);
  values.licenseType = LICENSE_TYPE_OPTIONS.includes(chosenLicense) ? chosenLicense : '';
  const typedWeapon = normalizeText(dom.addFormWeaponType?.value);
  // Correct a near-miss to the listed weapon type, the way the grid cell does.
  values.weaponType = typedWeapon
    ? (findMatchingOption(getWeaponTypeOptions(), typedWeapon) || typedWeapon)
    : '';

  if(issues.length){
    const firstIssue = issues[0];
    setStatus(firstIssue.message, 'error');
    firstIssue.field?.focus();
    return null;
  }

  return values;
}

function clearAddRecordForm(){
  if(!dom.addRecordForm) return;
  dom.addRecordForm.reset();
  if(dom.addFormSpecialization){
    dom.addFormSpecialization.value = 'فقط';
  }
  if(dom.addFormResidence){
    dom.addFormResidence.value = '';
  }
  resetAddFormValidation();
}

function populateAddFormSelects(){
  if(dom.rankList){
    dom.rankList.innerHTML = '';
    RANK_OPTIONS.forEach((option)=>{
      const opt = document.createElement('option');
      opt.value = option;
      dom.rankList.appendChild(opt);
    });
  }
  if(dom.specializationList){
    dom.specializationList.innerHTML = '';
    SPECIALIZATION_OPTIONS.forEach((option)=>{
      const opt = document.createElement('option');
      opt.value = option;
      dom.specializationList.appendChild(opt);
    });
  }
  if(dom.addFormSpecialization){
    dom.addFormSpecialization.value = 'فقط';
  }
  if(dom.residenceList){
    dom.residenceList.innerHTML = '';
    LOCATION_OPTIONS.forEach((option)=>{
      const opt = document.createElement('option');
      opt.value = option;
      dom.residenceList.appendChild(opt);
    });
  }
  if(dom.addFormResidence){
    dom.addFormResidence.value = '';
  }
  refreshLicenseTypeSuggestions();
  refreshWeaponTypeSuggestions();
}

/** The three weapon types, plus any others the records already use. */
function refreshWeaponTypeSuggestions(){
  if(!dom.weaponTypeList) return;
  dom.weaponTypeList.innerHTML = '';
  getWeaponTypeOptions().forEach((value)=>{
    const option = document.createElement('option');
    option.value = value;
    dom.weaponTypeList.appendChild(option);
  });
}

/** The add form offers the same four approval types the grid cell does. */
function refreshLicenseTypeSuggestions(){
  const select = dom.addFormLicenseType;
  if(!select) return;
  const previous = select.value;
  select.innerHTML = '';

  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '— اختر —';
  select.appendChild(blank);

  LICENSE_TYPE_OPTIONS.forEach((value)=>{
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = LICENSE_TYPE_OPTIONS.includes(previous) ? previous : '';
}

function handleAddRow(event){
  event?.preventDefault?.();
  refreshLicenseTypeSuggestions();
  refreshWeaponTypeSuggestions();
  setAddPanelVisible(true);
  if(dom.addRecordPanel){
    dom.addRecordPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  dom.addFormRank?.focus();
}

async function handleAddFormSubmit(event){
  event?.preventDefault?.();
  if(isSaving){
    setStatus('انتظر اكتمال عملية الحفظ الجارية.', 'warn');
    return;
  }
  const values = collectAddFormValues();
  if(!values) return;
  const rec = {
    id: generateNextId(),
    rank: values.rank,
    specialization: values.specialization,
    name: values.name,
    workplace: values.workplace,
    incomingDate: values.incomingDate,
    residence: values.residence,
    licenseType: values.licenseType,
    weaponType: values.weaponType
  };
  const recId = Number(rec.id);
  if(Number.isFinite(recId)){
    draftRecordIds.add(recId);
  }
  records.unshift(rec);
  render();
  markDirty();
  const success = await saveAllChanges({ intent: 'add' });
  if(success){
    clearAddRecordForm();
    setAddPanelVisible(false);
  }
}

function commitVisibleDates(){
  const dateCells = dom.resultsBody.querySelectorAll('[data-field="incomingDate"]');
  for(const cell of dateCells){
    const record = resolveRecordFromInput(cell);
    if(!record) continue;
    if(cell instanceof HTMLInputElement){
      const parsed = parseDdMmYyyyMasked(cell.value);
      if(parsed){
        const iso = ddmmyyyyToIso(parsed);
        cell.dataset.iso = iso;
        cell.dataset.invalid = '';
        cell.value = formatArabicYyyyMmDd(iso);
        cell.classList.remove('invalid');
        if(record.incomingDate !== iso){
          record.incomingDate = iso;
        }
        continue;
      }

      const iso = cell.dataset.iso || null;
      if(!iso){
        cell.classList.add('invalid');
        cell.focus();
        throw new Error('invalid-date');
      }
      cell.classList.remove('invalid');
      if(record.incomingDate !== iso){
        record.incomingDate = iso;
      }
      continue;
    }

    if(cell instanceof HTMLElement){
      const raw = cell.textContent ?? '';
      const cleaned = sanitizeEditableText(raw, { trimEnd: true });
      if(raw !== cleaned){
        cell.textContent = cleaned;
      }
      const parsed = parseDdMmYyyyFlexible(cleaned);
      if(parsed){
        const iso = ddmmyyyyToIso(parsed);
        cell.dataset.iso = iso;
        cell.dataset.invalid = '';
        cell.textContent = formatArabicYyyyMmDd(iso);
        cell.classList.remove('invalid');
        if(record.incomingDate !== iso){
          record.incomingDate = iso;
        }
        continue;
      }

      const iso = cell.dataset.iso || '';
      if(!iso){
        cell.classList.add('invalid');
        cell.dataset.invalid = '1';
        cell.focus();
        throw new Error('invalid-date');
      }
      cell.classList.remove('invalid');
      cell.dataset.invalid = '';
      cell.textContent = formatArabicYyyyMmDd(iso);
      if(record.incomingDate !== iso){
        record.incomingDate = iso;
      }
    }
  }
}

function buildPayloadRecords(source = records){
  const usedIds = new Set();
  const list = Array.isArray(source) ? source : [];
  let maxId = list.reduce((acc, rec)=>{
    const num = Number(rec?.id);
    return Number.isFinite(num) && num > acc ? num : acc;
    }, 0);
  return list.map((rec, index)=>{
    let numericId = Number(rec?.id);
    if(!Number.isFinite(numericId) || usedIds.has(numericId)){
      maxId += 1;
      numericId = maxId;
    }
    usedIds.add(numericId);
    const baseParts = splitRankAndSpecialization(rec?.rank);
    const specialization = normalizeSpecialization(rec?.specialization || baseParts.specialization);
    const rankValue = composeRankWithSpecialization(baseParts.rank, specialization);
    return {
      id: numericId,
      rank: normalizeText(rankValue),
      specialization,
      name: normalizeText(rec?.name),
      workplace: normalizeText(rec?.workplace),
      incomingDate: isValidIsoDate(rec?.incomingDate) ? rec.incomingDate : null,
      residence: normalizeText(rec?.residence),
      licenseType: normalizeText(rec?.licenseType),
      weaponType: normalizeText(rec?.weaponType)
    };
  });
}

async function saveAllChanges(options = {}){
  const requestedIntent = options?.intent === 'add' ? 'add' : 'save';
  const previousIntent = currentSaveIntent || 'save';
  if(isSaving) return false;
  if(!dirty){
    if(requestedIntent === 'add'){
      setStatus('لا توجد تغييرات لإضافتها.', 'info');
    }
    return true;
  }
  currentSaveIntent = requestedIntent;
  try {
    commitVisibleDates();
  } catch (error) {
    setStatus(requestedIntent === 'add' ? 'يرجى تصحيح تاريخ الوارد قبل الإضافة.' : 'يرجى تصحيح تاريخ الوارد قبل الحفظ.', 'error');
    currentSaveIntent = previousIntent;
    return false;
  }

  const payload = buildPayloadRecords();
  const acknowledgedDuplicateSignatures = new Set();
  while(true){
    const conflict = findNextExactDuplicateConflict(payload, acknowledgedDuplicateSignatures);
    if(!conflict) break;
    const decision = await showDuplicateNameDialog({
      existingRecord: conflict.existingRecord,
      duplicateRecord: conflict.newRecord
    });
    if(decision !== 'confirm'){
      setStatus(requestedIntent === 'add' ? 'تم إلغاء الإضافة.' : 'تم إلغاء الحفظ.', 'info');
      currentSaveIntent = previousIntent;
      return false;
    }
    acknowledgedDuplicateSignatures.add(conflict.signature);
  }

  setSavingState(true);
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: payload })
    });
    if(response.status === 409){
      let details = null;
      try { details = await response.json(); } catch (_) {}
      const fallbackMessage = requestedIntent === 'add'
        ? 'يوجد سجل آخر بنفس الاسم. لم تتم الإضافة.'
        : 'يوجد سجل آخر بنفس الاسم. لم يتم الحفظ.';
      const conflictMessage = details?.message || fallbackMessage;
      setStatus(conflictMessage, 'error');
      return false;
    }
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if(result && result.success === false){
      throw new Error(result.message || 'فشل حفظ السجلات');
    }
    if(result && result.approvalRequired){
      setStatus(result.message || 'تم إرسال طلب الاعتماد إلى المدير والسيكرتير الأول.', 'info');
      clearDirty();
      canAutoRefresh = true;
      startAutoRefresh();
      return true;
    }
    const saved = normalizeRecords(result?.records ?? payload);
    records = saved;
    draftRecordIds.clear();
    updateRecordsSignature(saved);
    const versionPayload = await fetchRecordsVersion();
    lastRecordsVersion = versionPayload?.version || `records:${lastRecordsSignature}`;
    updateBaselineRecords(saved);
    render();
    clearDirty();
    reportSavedAt(result?.savedAt || new Date().toISOString(), requestedIntent);
    canAutoRefresh = true;
    startAutoRefresh();
    return true;
  } catch (error) {
    console.error('Failed to save acceptance records:', error);
    setStatus(requestedIntent === 'add' ? 'تعذر إتمام الإضافة. حاول مرة أخرى.' : 'تعذر حفظ السجلات. حاول مرة أخرى.', 'error');
    return false;
  } finally {
    currentSaveIntent = previousIntent;
    setSavingState(false);
  }
}

async function loadInitialData(){
  updateSaveButtonState();
  let loadedFromServer = false;
  try {
    setStatus('جاري تحميل السجلات…', 'info');
    const response = await fetch(API_ENDPOINT, { cache: 'no-store' });
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if(payload && payload.success === false){
      throw new Error(payload.message || 'فشل تحميل السجلات');
    }
    const hasRecordsArray = Array.isArray(payload?.records);
    const loaded = normalizeRecords(payload?.records);
    if(hasRecordsArray){
      records = loaded;
      draftRecordIds.clear();
      loadedFromServer = true;
    } else {
      records = cloneRecords(SAMPLE_RECORDS);
      draftRecordIds.clear();
    }
    if(hasRecordsArray){
      if(loaded.length){
        const savedStamp = payload?.updatedAt || payload?.savedAt || null;
        if(savedStamp){
          reportSavedAt(savedStamp);
        } else {
          setStatus('تم تحميل السجلات.', 'success');
        }
      } else {
        setStatus('لا توجد سجلات محفوظة بعد.', 'info');
      }
    } else {
      setStatus('لا توجد بيانات محفوظة مسبقاً. تم تحميل بيانات تجريبية.', 'info');
    }
  } catch (error) {
    console.error('Failed to load acceptance records:', error);
    records = cloneRecords(SAMPLE_RECORDS);
    draftRecordIds.clear();
    setStatus('تعذر تحميل البيانات من الخادم. تم عرض بيانات تجريبية.', 'error');
    canAutoRefresh = false;
    stopAutoRefresh();
    updateRecordsSignature(records);
    updateBaselineRecords(records);
    clearDirty();
    currentPage = Math.max(1, Math.ceil(getFilteredRecords().length / PAGE_SIZE));
    render();
    updateSaveButtonState();
    return;
  }
  canAutoRefresh = loadedFromServer;
  updateRecordsSignature(records);
  const versionPayload = loadedFromServer ? await fetchRecordsVersion() : null;
  lastRecordsVersion = versionPayload?.version || `records:${lastRecordsSignature}`;
  updateBaselineRecords(records);
  clearDirty();
  currentPage = Math.max(1, Math.ceil(getFilteredRecords().length / PAGE_SIZE));
  render();
  updateSaveButtonState();
  if(canAutoRefresh){
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

function readDeleteApprovalInspectTarget() {
  try {
    const raw = sessionStorage.getItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY);
    if (!raw) return null;
    const target = JSON.parse(raw);
    return target && target.programKey === 'accept' ? target : null;
  } catch (_) {
    return null;
  }
}

function clearDeleteApprovalInspectTarget() {
  try { sessionStorage.removeItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY); } catch (_) {}
}

function applyDeleteApprovalInspectTarget() {
  const target = readDeleteApprovalInspectTarget();
  if (!target) return false;
  const name = normalizeText(target.name || '');
  if (dom.nameSearch) dom.nameSearch.value = name;
  filterState.name = name;
  currentPage = 1;
  render();
  clearDeleteApprovalInspectTarget();
  return true;
}
try { window.applyDeleteApprovalInspectTarget = applyDeleteApprovalInspectTarget; } catch (_) {}

window.addEventListener('beforeunload', (event)=>{
  if(!dirty || allowSilentNavigation) return;
  event.preventDefault();
  event.returnValue = '';
});

async function bootstrap(){
  startOfficeClock();
  setupSortControls();
  await loadSortChoices();
  await loadInitialData();
  applyDeleteApprovalInspectTarget();
}

bootstrap().catch((error)=>{
  console.error('Failed to initialize Accept app:', error);
  loadInitialData();
});
