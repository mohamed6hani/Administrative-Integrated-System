const API_URL = '/api/request';
const RECORDS_ENDPOINT = `${API_URL}/requests`;
const RECORDS_VERSION_ENDPOINT = `${API_URL}/requests/version`;
const RECORDS_CACHE_KEY = 'requestModule.records';
const ACTIVE_RECORD_CACHE_KEY = 'requestModule.activeRecord';
const DELETED_RECORDS_ENDPOINT = `${API_URL}/requests/deleted`;
const RESTORE_ENDPOINT = `${API_URL}/requests/restore`;
const EXPORT_REQUEST_ENDPOINT = `${API_URL}/requests/export`;
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';
const NAME_REGEX = /^[\p{L}\s]+$/u;
const MAX_DATE_DIGITS = 8;
const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;
const DIRECTORATE_OPTIONS = [
    'الإدارة التجريبية 01',
    'الإدارة التجريبية 02',
    'الإدارة التجريبية 03',
    'الإدارة التجريبية 04',
    'الإدارة التجريبية 05',
    'الإدارة التجريبية 06',
    'الإدارة التجريبية 07',
    'الإدارة التجريبية 08',
    'الإدارة التجريبية 09',
    'الإدارة التجريبية 10'
];
const DIRECTORATE_NAME_ALIASES = {};
const LICENSE_TYPE_OPTIONS = ['ترخيص جديد', 'ترخيص اضافة', 'اعادة ترخيص', 'أخرى'];
const ARABIC_MONTH_OPTIONS = [
    { value: '01', label: 'يناير' },
    { value: '02', label: 'فبراير' },
    { value: '03', label: 'مارس' },
    { value: '04', label: 'أبريل' },
    { value: '05', label: 'مايو' },
    { value: '06', label: 'يونيو' },
    { value: '07', label: 'يوليو' },
    { value: '08', label: 'أغسطس' },
    { value: '09', label: 'سبتمبر' },
    { value: '10', label: 'أكتوبر' },
    { value: '11', label: 'نوفمبر' },
    { value: '12', label: 'ديسمبر' }
];

const DIRECTORATE_TABLE_COLUMNS = [
    { key: 'outgoingNumber', label: 'رقم الصادر', type: 'number', placeholder: 'أدخل رقم الصادر', width: '130px' },
    { key: 'outgoingDate', label: 'تاريخ الصدور', type: 'date', placeholder: 'dd/mm/yyyy', width: '136px' },
    { key: 'incomingNumber', label: 'رقم الوارد', type: 'number', placeholder: 'أدخل رقم الوارد', width: '130px' },
    { key: 'incomingDate', label: 'تاريخ الوارد', type: 'date', placeholder: 'dd/mm/yyyy', width: '136px' },
    { key: 'screeningResult', label: 'نتيجة الكشف', type: 'select', placeholder: 'اختر نتيجة الكشف', width: '190px' },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', placeholder: 'أدخل الملاحظات', width: '240px' }
];
const DIRECTORATE_TABLE_LEADING_COLUMNS = [
    { key: 'enabled', width: '58px' },
    { key: 'name', width: '260px' }
];

const DIRECTORATE_OPTION_SET = new Set(DIRECTORATE_OPTIONS);

const DIRECTORATE_SCREENING_OPTIONS = {
    'الإدارة التجريبية 01': ['لا مانع سياسيا', 'عدم الموافقة'],
    'الإدارة التجريبية 02': ['عدم وجود معلومات جنائية', 'وجود معلومات جنائية'],
    'الإدارة التجريبية 03': ['عدم وجود معلومات جنائية', 'وجود معلومات جنائية'],
    'الإدارة التجريبية 04': ['عدم وجود معلومات ضريبية', 'يوجد معلومات ضريبية'],
    'الإدارة التجريبية 05': ['عدم وجود معلومات جنائية', 'وجود معلومات جنائية'],
    'الإدارة التجريبية 06': ['عدم وجود معلومات جنائية', 'وجود معلومات جنائية'],
    'الإدارة التجريبية 07': ['عدم وجود معلومات جنائية', 'وجود معلومات جنائية'],
    'الإدارة التجريبية 08': ['تم تدريب المذكور علي قواعد استخدام السلاح وحق دفاع الشرعي'],
    'الإدارة التجريبية 09': ['لائق طبيا', 'غير لائق طبيا'],
    'الإدارة التجريبية 10': ['الموافقة علي الترخيص', 'عدم الموافقة علي الترخيص']
};

const GENERAL_USER_STORAGE_KEY = 'general.auth.user';
const ADMIN_SECTOR_VALUE = 'الإدارة';
const SECTOR_CHOICES = SHARED_REFERENCE_DATA
    ? SHARED_REFERENCE_DATA.getSectorChoices('label')
    : [
        { value: 'شرق', label: 'شرق' },
        { value: 'غرب', label: 'غرب' },
        { value: 'شمال', label: 'شمال' },
        { value: 'جنوب', label: 'جنوب' },
        { value: 'القطاع التجريبي الخامس', label: 'القطاع التجريبي الخامس' }
    ];
const SECTOR_LABEL_MAP = SECTOR_CHOICES.reduce((map, choice) => {
    map[choice.value] = choice.label;
    return map;
}, { [ADMIN_SECTOR_VALUE]: ADMIN_SECTOR_VALUE });
const SECTOR_VALUES = SECTOR_CHOICES.map((choice) => choice.value);
const SECTOR_ALIASES = {
    'الشرق': 'شرق',
    'قطاع الشرق': 'شرق',
    'الشمال': 'شمال',
    'قطاع الشمال': 'شمال',
    'الجنوب': 'جنوب',
    'قطاع الجنوب': 'جنوب',
    'الغرب': 'غرب',
    'قطاع الغرب': 'غرب'
};
const SECTOR_STATIONS = SHARED_REFERENCE_DATA
    ? SHARED_REFERENCE_DATA.getSectorStationsMap('label')
    : {
        شرق: ['مكتب تجريبي 01', 'مكتب تجريبي 02', 'مكتب تجريبي 03', 'مكتب تجريبي 04', 'مكتب تجريبي 05', 'مكتب تجريبي 06', 'مكتب تجريبي 07', 'مكتب تجريبي 08', 'مكتب تجريبي 09', 'مكتب تجريبي 10'],
        غرب: ['مكتب تجريبي 11', 'مكتب تجريبي 12', 'مكتب تجريبي 13', 'مكتب تجريبي 14', 'مكتب تجريبي 15', 'مكتب تجريبي 16', 'مكتب تجريبي 17', 'مكتب تجريبي 18', 'مكتب تجريبي 19'],
        جنوب: ['مكتب تجريبي 20', 'مكتب تجريبي 21', 'مكتب تجريبي 22', 'مكتب تجريبي 23', 'مكتب تجريبي 24', 'مكتب تجريبي 25', 'مكتب تجريبي 26', 'مكتب تجريبي 27', 'مكتب تجريبي 28', 'مكتب تجريبي 29', 'مكتب تجريبي 30'],
        شمال: ['مكتب تجريبي 31', 'مكتب تجريبي 32', 'مكتب تجريبي 33', 'مكتب تجريبي 34', 'مكتب تجريبي 35', 'مكتب تجريبي 36', 'مكتب تجريبي 37', 'مكتب تجريبي 38', 'مكتب تجريبي 39', 'مكتب تجريبي 40'],
        'القطاع التجريبي الخامس': ['مكتب تجريبي 41', 'مكتب تجريبي 42', 'مكتب تجريبي 43', 'مكتب تجريبي 44', 'مكتب تجريبي 45']
    };
const SECTOR_STATION_SETS = Object.fromEntries(
    Object.entries(SECTOR_STATIONS).map(([sector, stations]) => [sector, new Set(stations)])
);

const REFRESH_INTERVAL_MS = 15000;

function getDirectorateScreeningOptions(name) {
    if (!name) return [];
    const normalized = typeof name === 'string' ? name.trim() : String(name || '').trim();
    if (!normalized) return [];
    const normalizedKey = normalizeDirectorateName(normalized);
    const options = DIRECTORATE_SCREENING_OPTIONS[normalizedKey] || DIRECTORATE_SCREENING_OPTIONS[normalized];
    return Array.isArray(options) ? options : [];
}

function createDirectorateDetailTemplate(name = '', overrides = {}, fallbackSelected = false) {
    let selectedValue = overrides.selected;
    if (typeof selectedValue === 'string') {
        selectedValue = ['true', '1', 'yes'].includes(selectedValue.trim().toLowerCase());
    }

    const detail = {
        name: normalizeDirectorateName(name || stringOrEmpty(overrides.name)),
        selected: typeof selectedValue === 'boolean' ? selectedValue : Boolean(fallbackSelected),
        outgoingNumber: sanitizeNumeric(overrides.outgoingNumber),
        outgoingDate: normalizeOptionalDate(overrides.outgoingDate),
        incomingNumber: sanitizeNumeric(overrides.incomingNumber),
        incomingDate: normalizeOptionalDate(overrides.incomingDate),
        licenseType: stringOrEmpty(overrides.licenseType),
        licenseTypeOther: stringOrEmpty(overrides.licenseTypeOther),
        screeningResult: stringOrEmpty(overrides.screeningResult),
        notes: stringOrEmpty(overrides.notes)
    };

    if (!detail.name) {
        detail.name = normalizeDirectorateName(name);
    }

    return detail;
}

const pageType = document.body?.dataset?.page || '';

const recordsListEl = document.getElementById('recordsList');
const recordCountEl = document.getElementById('recordCount');
const totalRecordCountEl = document.getElementById('totalRecordCount');
const searchInputEl = document.getElementById('searchName');
const flashMessageEl = document.getElementById('flashMessage');
const printExcelBtnEl = document.getElementById('printExcelBtn');
const browserPrintBtnEl = document.getElementById('browserPrintBtn');
const deleteRecordBtnEl = document.getElementById('deleteRecordBtn');
const showDeletedBtnEl = document.getElementById('showDeletedBtn');
const deletedPanelEl = document.getElementById('deletedPanel');
const deletedListEl = document.getElementById('deletedList');
const closeDeletedPanelBtn = document.getElementById('closeDeletedPanel');
const sectorFilterEl = document.getElementById('filterSector');
const stationFilterEl = document.getElementById('filterStation');
const yearFilterEl = document.getElementById('filterYear');
const monthFilterEl = document.getElementById('filterMonth');
const requestPagePreviousEl = document.getElementById('requestPagePrevious');
const requestPageIndicatorEl = document.getElementById('requestPageIndicator');
const requestPageNextEl = document.getElementById('requestPageNext');
const requestRecordsViewportEl = document.getElementById('requestRecordsViewport');
const RequestRecordPagination = window.RequestRecordPagination || null;

const recordTitleEl = document.getElementById('recordTitle');
const detailFields = {
    sector: document.getElementById('detailSector'),
    station: document.getElementById('detailStation'),
    name: document.getElementById('detailName'),
    job: document.getElementById('detailJob'),
    nationalId: document.getElementById('detailNationalId'),
    address: document.getElementById('detailAddress'),
    licenseType: document.getElementById('detailLicenseType'),
    weaponData: document.getElementById('detailWeaponData'),
    applicationDate: document.getElementById('detailApplicationDate'),
    approvalDate: document.getElementById('detailApprovalDate'),
    purchasePermit: document.getElementById('detailPurchasePermit'),
    licenseNumber: document.getElementById('detailLicenseNumber'),
    notes: document.getElementById('detailNotes')
};
const detailsPlaceholderEl = document.querySelector('.details-placeholder');
const editRecordBtn = document.getElementById('editRecordBtn');
const saveRecordBtn = document.getElementById('saveRecordBtn');
const cancelRecordBtn = document.getElementById('cancelRecordBtn');
const printRecordBtn = document.getElementById('printRecordBtn');
const detailDirectorateChecklistEl = document.getElementById('detailDirectorateChecklist');
const detailDirectorateErrorEl = document.getElementById('detailDirectorateError');
const recordFormMessageEl = document.getElementById('recordFormMessage');
const detailInputEls = {
    sector: document.getElementById('detailSectorInput'),
    station: document.getElementById('detailStationInput'),
    name: document.getElementById('detailNameInput'),
    job: document.getElementById('detailJobInput'),
    nationalId: document.getElementById('detailNationalIdInput'),
    address: document.getElementById('detailAddressInput'),
    licenseType: document.getElementById('detailLicenseTypeInput'),
    licenseTypeOther: document.getElementById('detailLicenseTypeOtherInput'),
    weaponData: document.getElementById('detailWeaponDataInput'),
    applicationDate: document.getElementById('detailApplicationDateInput'),
    approvalDate: document.getElementById('detailApprovalDateInput'),
    purchasePermit: document.getElementById('detailPurchasePermitInput'),
    licenseNumber: document.getElementById('detailLicenseNumberInput'),
    notes: document.getElementById('detailNotesInput')
};

const createFormEl = document.querySelector('.create-form');
const formMessageEl = document.getElementById('formMessage');
const nameErrorEl = document.getElementById('nameError');
const nameInputEl = document.getElementById('requesterName');
const nationalIdInputEl = document.getElementById('nationalId');
const jobInputEl = document.getElementById('job');
const addressInputEl = document.getElementById('address');
const applicationDateInputEl = document.getElementById('applicationDate');
const applicationDateErrorEl = document.getElementById('applicationDateError');
const approvalDateInputEl = document.getElementById('approvalDate');
const dateErrorEl = document.getElementById('dateError');
const licenseTypeErrorEl = document.getElementById('licenseTypeError');
const directorateChecklistEl = document.getElementById('createDirectorateChecklist');
const directorateErrorEl = document.getElementById('directorateError');
const createSectorSelectEl = document.getElementById('createSector');
const createStationSelectEl = document.getElementById('createStation');
const weaponDataInputEl = document.getElementById('weaponData');
const licenseTypeSelectEl = document.getElementById('licenseType');
const licenseTypeOtherInputEl = document.getElementById('licenseTypeOther');

const CREATE_REQUIRED_FIELD_DEFS = [
    { key: 'requesterName', label: 'اسم الطالب', input: () => nameInputEl, value: (formData) => stringOrEmpty(formData.get('requesterName')) },
    { key: 'applicationDate', label: 'تاريخ التقديم', input: () => applicationDateInputEl, value: (formData) => stringOrEmpty(formData.get('applicationDate')) },
    { key: 'job', label: 'الوظيفة', input: () => jobInputEl, value: (formData) => stringOrEmpty(formData.get('job')) },
    { key: 'nationalId', label: 'الرقم القومي', input: () => nationalIdInputEl, value: (formData) => sanitizeNumeric(formData.get('nationalId')) },
    { key: 'address', label: 'العنوان', input: () => addressInputEl, value: (formData) => stringOrEmpty(formData.get('address')) },
    { key: 'approvalDate', label: 'تاريخ الموافقة', input: () => approvalDateInputEl, value: (formData) => stringOrEmpty(formData.get('approvalDate')) },
    { key: 'sector', label: 'القطاع', input: () => createSectorSelectEl, value: (formData) => normalizeSectorName(formData.get('sector')) },
    { key: 'station', label: 'القسم', input: () => createStationSelectEl, value: (formData) => normalizeStationName(formData.get('station'), formData.get('sector')) },
    { key: 'licenseType', label: 'نوع الترخيص', input: () => licenseTypeSelectEl, value: (formData) => normalizeLicenseTypeName(formData.get('licenseType')) },
    { key: 'weaponData', label: 'السلاح المطلوب', input: () => weaponDataInputEl, value: (formData) => stringOrEmpty(formData.get('weaponData')) }
];

let allRecords = [];
let selectedRecordId = null;
let deletedRecordsCache = [];
let deletedPanelVisible = false;
let activeRecord = null;
let isRecordEditMode = false;
let recordControlsBound = false;

let autoRefreshTimerId = null;
let lastRecordsSignature = null;
let lastRecordsVersion = null;
let isAutoRefreshInFlight = false;
let pendingListScrollTop = null;
let currentFilteredRecords = [];
let currentRecordsPage = 1;
let createMissingFieldBypassArmed = false;

const filterState = {
    sector: '',
    station: '',
    year: '',
    month: ''
};

let portalUserContext = {
    profile: null,
    isAdmin: true,
    allowedSectorSet: new Set(SECTOR_VALUES),
    stationAccess: new Map()
};

const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const EASTERN_TO_ENGLISH_MAP = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9'
};

function sanitizeNumeric(value) {
    return stringOrEmpty(value);
}

function toArabicDigits(value) {
    return String(value ?? '').replace(/\d/g, (digit) => EASTERN_ARABIC_DIGITS[Number(digit)] ?? digit);
}

function toEnglishDigits(value) {
    return String(value ?? '').replace(/[٠-٩]/g, (digit) => EASTERN_TO_ENGLISH_MAP[digit] ?? digit);
}

function stringOrEmpty(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeDirectorateName(value) {
    const cleaned = stringOrEmpty(value).replace(/\s+/g, ' ');
    if (!cleaned) return '';
    return DIRECTORATE_NAME_ALIASES[cleaned] || cleaned;
}

function normalizeRequesterNameKey(value) {
    return stringOrEmpty(value)
        .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function getRecordDisplayName(record) {
    if (!record || typeof record !== 'object') return '';
    return record.name
        || record.requesterName
        || record.fullName
        || record['الاسم']
        || '';
}

function findDuplicateNameRecord(list, candidateKey, ignoreId) {
    if (!candidateKey || !Array.isArray(list)) return null;
    for (const entry of list) {
        if (!entry) continue;
        if (ignoreId && String(entry.id) === String(ignoreId)) continue;
        const entryKey = normalizeRequesterNameKey(getRecordDisplayName(entry));
        if (entryKey && entryKey === candidateKey) {
            return entry;
        }
    }
    return null;
}

function formatLicenseTypeDisplay(value, other) {
    const normalizedValue = normalizeLicenseTypeName(value);
    const normalizedOther = stringOrEmpty(other);
    if (!normalizedValue) return '';
    if (normalizedValue === 'أخرى' && normalizedOther) {
        return `${normalizedValue} - ${normalizedOther}`;
    }
    return normalizedValue;
}

function getRequestLicenseTypeOptions() {
    const sharedOptions = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getLicenseTypes === 'function'
        ? SHARED_REFERENCE_DATA.getLicenseTypes('request')
        : null;
    return Array.isArray(sharedOptions) && sharedOptions.length
        ? sharedOptions
        : LICENSE_TYPE_OPTIONS.slice();
}

function normalizeLicenseTypeName(value) {
    const raw = stringOrEmpty(value);
    if (!raw) return '';
    if (raw === 'أخرى') return raw;
    return SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveLicenseType === 'function'
        ? SHARED_REFERENCE_DATA.resolveLicenseType(raw, 'request') || raw
        : raw;
}

function populateLicenseTypeSelect(selectEl, { includeEmptyOption = true, currentValue } = {}) {
    if (!selectEl) return;
    const optionsSet = new Set(getRequestLicenseTypeOptions());
    const normalizedCurrent = normalizeLicenseTypeName(currentValue);
    if (normalizedCurrent && !optionsSet.has(normalizedCurrent)) {
        optionsSet.add(normalizedCurrent);
    }

    const optionsHtml = Array.from(optionsSet).map((option) => `
        <option value="${escapeHtml(option)}">${escapeHtml(option)}</option>
    `).join('');

    selectEl.innerHTML = includeEmptyOption
        ? `<option value="">اختر نوع الترخيص</option>${optionsHtml}`
        : optionsHtml;

    if (normalizedCurrent) {
        selectEl.value = normalizedCurrent;
    }
}

async function refreshSharedReferenceData() {
    if (!SHARED_REFERENCE_DATA || typeof SHARED_REFERENCE_DATA.refresh !== 'function') return;
    try {
        await SHARED_REFERENCE_DATA.refresh();
    } catch (error) {
        console.warn('Failed to refresh shared reference data', error);
    }
}

function refreshLicenseTypeSelectControls() {
    if (licenseTypeSelectEl) {
        populateLicenseTypeSelect(licenseTypeSelectEl, {
            includeEmptyOption: true,
            currentValue: licenseTypeSelectEl.value
        });
        syncLicenseTypeOtherInput(licenseTypeSelectEl, licenseTypeOtherInputEl, { clearOnHide: false });
    }

    if (detailInputEls.licenseType) {
        populateLicenseTypeSelect(detailInputEls.licenseType, {
            includeEmptyOption: true,
            currentValue: detailInputEls.licenseType.value || activeRecord?.licenseType
        });
        syncLicenseTypeOtherInput(detailInputEls.licenseType, detailInputEls.licenseTypeOther, { clearOnHide: false });
    }
}

window.addEventListener('reference-data:updated', refreshLicenseTypeSelectControls);

function bindLicenseTypeControl(selectEl, otherInput, { clearOnHide = false } = {}) {
    if (!selectEl) return;

    if (!selectEl.dataset.licenseTypeBound) {
        selectEl.addEventListener('change', () => {
            syncLicenseTypeOtherInput(selectEl, otherInput, { clearOnHide });
        });
        selectEl.dataset.licenseTypeBound = 'true';
    }

    if (otherInput && !otherInput.dataset.licenseTypeBound) {
        otherInput.addEventListener('input', () => {
            if (selectEl.value === 'أخرى' && otherInput.value) {
                otherInput.classList.remove('has-error');
            }
        });
        otherInput.dataset.licenseTypeBound = 'true';
    }

    syncLicenseTypeOtherInput(selectEl, otherInput, { clearOnHide });
}

function syncLicenseTypeOtherInput(selectEl, otherInput, { clearOnHide = false } = {}) {
    if (!otherInput) return;
    const value = stringOrEmpty(selectEl?.value);
    const showOther = value === 'أخرى';
    otherInput.classList.toggle('hidden', !showOther);
    otherInput.disabled = !showOther;
    if (!showOther && clearOnHide) {
        otherInput.value = '';
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeSectorName(value) {
    const raw = stringOrEmpty(value);
    if (!raw) return '';
    if (raw === ADMIN_SECTOR_VALUE) return ADMIN_SECTOR_VALUE;
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveSectorLabel === 'function') {
        const resolved = SHARED_REFERENCE_DATA.resolveSectorLabel(cleaned);
        if (resolved) return resolved;
    }
    if (SECTOR_VALUES.includes(cleaned)) return cleaned;
    if (SECTOR_ALIASES[cleaned]) return SECTOR_ALIASES[cleaned];

    let candidate = cleaned;
    if (candidate.startsWith('قطاع ')) {
        candidate = candidate.replace(/^قطاع\s+/u, '').trim();
        if (SECTOR_VALUES.includes(candidate)) return candidate;
        if (SECTOR_ALIASES[candidate]) return SECTOR_ALIASES[candidate];
    }

    if (candidate.startsWith('ال')) {
        const withoutArticle = candidate.replace(/^ال/u, '').trim();
        if (SECTOR_VALUES.includes(withoutArticle)) return withoutArticle;
        if (SECTOR_ALIASES[withoutArticle]) return SECTOR_ALIASES[withoutArticle];
    }

    const fallback = SECTOR_VALUES.find((sector) => sector.localeCompare(candidate, 'ar', { sensitivity: 'base' }) === 0)
        || SECTOR_VALUES.find((sector) => sector.localeCompare(cleaned, 'ar', { sensitivity: 'base' }) === 0);
    return fallback || '';
}

function getSectorLabel(value) {
    const normalized = normalizeSectorName(value);
    if (!normalized) return stringOrEmpty(value);
    return SECTOR_LABEL_MAP[normalized] || normalized;
}

function normalizeStationName(value, sector = '') {
    const raw = stringOrEmpty(value);
    if (!raw) return '';
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveStationName === 'function') {
        return SHARED_REFERENCE_DATA.resolveStationName(cleaned, sector) || cleaned;
    }
    return cleaned;
}

function getPortalUserProfile() {
    try {
        const raw = sessionStorage.getItem(GENERAL_USER_STORAGE_KEY) || localStorage.getItem(GENERAL_USER_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        console.warn('Unable to read portal user profile:', error);
        return null;
    }
}

function computePortalUserContext() {
    const profile = getPortalUserProfile();
    const context = {
        profile,
        isAdmin: true,
        allowedSectorSet: new Set(SECTOR_VALUES),
        stationAccess: new Map()
    };

    if (!profile) {
        portalUserContext = context;
        return context;
    }

    const candidateSectors = new Set();
    const collectSectors = (source) => {
        if (!source) return;
        if (Array.isArray(source)) {
            source.forEach((entry) => {
                const normalized = normalizeSectorName(entry);
                if (normalized) candidateSectors.add(normalized);
                if (entry === ADMIN_SECTOR_VALUE) candidateSectors.add(ADMIN_SECTOR_VALUE);
            });
            return;
        }
        const normalized = normalizeSectorName(source);
        if (normalized) candidateSectors.add(normalized);
        if (source === ADMIN_SECTOR_VALUE) candidateSectors.add(ADMIN_SECTOR_VALUE);
    };

    collectSectors(profile.sectors);
    collectSectors(profile.rooms);
    collectSectors(profile.allowedSectors);
    if (profile.room) collectSectors(profile.room);
    if (profile.primarySector) collectSectors(profile.primarySector);

    const role = stringOrEmpty(profile.role).toLowerCase();
    const isAdmin = role === 'admin' || candidateSectors.has(ADMIN_SECTOR_VALUE);
    context.isAdmin = isAdmin;

    const allowedSectorSet = new Set();
    if (isAdmin || candidateSectors.size === 0) {
        SECTOR_VALUES.forEach((sector) => allowedSectorSet.add(sector));
    } else {
        candidateSectors.forEach((sectorName) => {
            const normalized = normalizeSectorName(sectorName);
            if (normalized) allowedSectorSet.add(normalized);
        });
        if (!allowedSectorSet.size) {
            SECTOR_VALUES.forEach((sector) => allowedSectorSet.add(sector));
        }
    }
    context.allowedSectorSet = allowedSectorSet;

    const stationAccess = new Map();
    const rawStationAccess = profile.stationAccess;
    if (rawStationAccess && typeof rawStationAccess === 'object') {
        Object.entries(rawStationAccess).forEach(([sectorName, stations]) => {
            const normalizedSector = normalizeSectorName(sectorName);
            if (!normalizedSector) return;
            const allowedStations = new Set();
            if (Array.isArray(stations)) {
                stations.forEach((station) => {
                    const normalizedStation = normalizeStationName(station, normalizedSector);
                    if (normalizedStation) allowedStations.add(normalizedStation);
                });
            }
            if (allowedStations.size) {
                stationAccess.set(normalizedSector, allowedStations);
            }
        });
    }
    context.stationAccess = stationAccess;

    portalUserContext = context;
    return context;
}

function ensurePortalUserContext() {
    return portalUserContext || computePortalUserContext();
}

function recordPassesPortalRestrictions(record) {
    const context = ensurePortalUserContext();
    if (!context || context.isAdmin) return true;

    const recordSector = normalizeSectorName(record?.sector);
    if (!recordSector || !context.allowedSectorSet.has(recordSector)) {
        return false;
    }

    const allowedStationsSet = context.stationAccess.get(recordSector);
    if (!allowedStationsSet || !allowedStationsSet.size) {
        return true;
    }

    const recordStation = normalizeStationName(record?.station, recordSector);
    if (!recordStation) {
        return false;
    }

    return allowedStationsSet.has(recordStation);
}

function getStationsForSector(sector, { enforceAccess = false } = {}) {
    const context = ensurePortalUserContext();
    const normalizedSector = normalizeSectorName(sector);
    if (!normalizedSector) return [];
    const baseStations = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getStationsForSector === 'function'
        ? SHARED_REFERENCE_DATA.getStationsForSector(normalizedSector)
        : (Array.isArray(SECTOR_STATIONS[normalizedSector]) ? SECTOR_STATIONS[normalizedSector] : []);
    const normalizedBase = baseStations.map((station) => normalizeStationName(station, normalizedSector)).filter(Boolean);

    if (!enforceAccess || !context || context.isAdmin) {
        return Array.from(new Set(normalizedBase));
    }

    const allowedSet = context.stationAccess.get(normalizedSector);
    if (!allowedSet || !allowedSet.size) {
        return Array.from(new Set(normalizedBase));
    }

    const combined = new Set();
    normalizedBase.forEach((station) => {
        if (allowedSet.has(station)) {
            combined.add(station);
        }
    });
    allowedSet.forEach((station) => combined.add(station));
    return Array.from(combined);
}

function populateSectorSelect(selectEl, {
    includeEmptyOption = true,
    emptyLabel = 'كل القطاعات',
    allowedValues,
    currentValue
} = {}) {
    if (!selectEl) return;
    const context = portalUserContext || computePortalUserContext();
    const valuesSource = Array.isArray(allowedValues) && allowedValues.length
        ? allowedValues
        : Array.from(context.allowedSectorSet || []);
    const uniqueValues = new Set(valuesSource.map((value) => normalizeSectorName(value)).filter(Boolean));
    const normalizedCurrent = normalizeSectorName(currentValue);
    if (normalizedCurrent) {
        uniqueValues.add(normalizedCurrent);
    }

    const options = Array.from(uniqueValues).map((value) => {
        const label = getSectorLabel(value);
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join('');

    selectEl.innerHTML = includeEmptyOption
        ? `<option value="">${escapeHtml(emptyLabel)}</option>${options}`
        : options;
}

function populateStationSelect(selectEl, sector, {
    includeEmptyOption = true,
    emptyLabel = 'كل الأقسام',
    allowedStations,
    currentValue,
    enforceAccess = false
} = {}) {
    if (!selectEl) return;
    const stationsSource = Array.isArray(allowedStations) && allowedStations.length
        ? allowedStations
        : getStationsForSector(sector, { enforceAccess });
    const normalizedCurrent = normalizeStationName(currentValue, sector);
    const uniqueStations = new Set(stationsSource.map((station) => normalizeStationName(station, sector)).filter(Boolean));
    if (normalizedCurrent) {
        uniqueStations.add(normalizedCurrent);
    }

    const options = Array.from(uniqueStations).map((station) => `
        <option value="${escapeHtml(station)}">${escapeHtml(station)}</option>
    `).join('');

    selectEl.innerHTML = includeEmptyOption
        ? `<option value="">${escapeHtml(emptyLabel)}</option>${options}`
        : options;
}

function updateStationFilterOptions() {
    if (!stationFilterEl) return;
    const selectedSector = normalizeSectorName(sectorFilterEl?.value || filterState.sector);
    if (!selectedSector) {
        populateStationSelect(stationFilterEl, '', { includeEmptyOption: true, emptyLabel: 'كل الأقسام', allowedStations: [] });
        stationFilterEl.value = '';
        stationFilterEl.disabled = true;
        filterState.station = '';
        return;
    }

    const stations = getStationsForSector(selectedSector, { enforceAccess: true });
    populateStationSelect(stationFilterEl, selectedSector, {
        includeEmptyOption: true,
        emptyLabel: 'كل الأقسام',
        allowedStations: stations,
        currentValue: filterState.station,
        enforceAccess: true
    });

    const normalizedStation = normalizeStationName(filterState.station, selectedSector);
    if (normalizedStation && stations.includes(normalizedStation)) {
        stationFilterEl.value = normalizedStation;
    } else {
        stationFilterEl.value = '';
        filterState.station = '';
    }
    stationFilterEl.disabled = stations.length === 0;
}

function handleSectorFilterChange(event) {
    const value = event?.target ? event.target.value : sectorFilterEl?.value;
    filterState.sector = normalizeSectorName(value);
    updateStationFilterOptions();
    applyFilters({ resetPage: true });
}

function handleStationFilterChange(event) {
    const value = event?.target ? event.target.value : stationFilterEl?.value;
    filterState.station = normalizeStationName(value);
    applyFilters({ resetPage: true });
}

function normalizeMonthFilterValue(value) {
    const digits = toEnglishDigits(value).replace(/\D/g, '');
    if (!digits) return '';
    const month = Number(digits);
    if (!Number.isInteger(month) || month < 1 || month > 12) return '';
    return String(month).padStart(2, '0');
}

function getApplicationDateParts(value) {
    const normalized = normalizeDateInput(value);
    if (!normalized) return { year: '', month: '' };
    const [year, month] = normalized.split(/[/-]/);
    return {
        year: stringOrEmpty(year),
        month: normalizeMonthFilterValue(month)
    };
}

function populateMonthFilter() {
    if (!monthFilterEl) return;
    const currentValue = normalizeMonthFilterValue(filterState.month || monthFilterEl.value);
    const optionsHtml = ARABIC_MONTH_OPTIONS.map((month) => `
        <option value="${month.value}">${escapeHtml(month.label)}</option>
    `).join('');
    monthFilterEl.innerHTML = `<option value="">كل الشهور</option>${optionsHtml}`;
    monthFilterEl.value = currentValue;
    filterState.month = currentValue;
}

function updateYearFilterOptions() {
    if (!yearFilterEl) return;
    const currentValue = stringOrEmpty(filterState.year || yearFilterEl.value).replace(/\D/g, '').slice(0, 4);
    const years = new Set();

    allRecords.forEach((record) => {
        if (!recordPassesPortalRestrictions(record)) return;
        const { year } = getApplicationDateParts(record.applicationDate);
        if (year) {
            years.add(year);
        }
    });

    const sortedYears = Array.from(years).sort((a, b) => Number(b) - Number(a));
    const optionsHtml = sortedYears.map((year) => `
        <option value="${escapeHtml(year)}">${escapeHtml(toArabicDigits(year))}</option>
    `).join('');

    yearFilterEl.innerHTML = `<option value="">كل السنوات</option>${optionsHtml}`;
    const nextValue = years.has(currentValue) ? currentValue : '';
    yearFilterEl.value = nextValue;
    filterState.year = nextValue;
    yearFilterEl.disabled = sortedYears.length === 0;
}

function updateDateFilterOptions() {
    populateMonthFilter();
    updateYearFilterOptions();
}

function handleYearFilterChange(event) {
    const value = event?.target ? event.target.value : yearFilterEl?.value;
    filterState.year = stringOrEmpty(value).replace(/\D/g, '').slice(0, 4);
    applyFilters({ resetPage: true });
}

function handleMonthFilterChange(event) {
    const value = event?.target ? event.target.value : monthFilterEl?.value;
    filterState.month = normalizeMonthFilterValue(value);
    applyFilters({ resetPage: true });
}

function initializeSectorStationFilters() {
    if (!sectorFilterEl) return;
    const context = computePortalUserContext();
    const allowedSectors = Array.from(context.allowedSectorSet);

    populateSectorSelect(sectorFilterEl, {
        includeEmptyOption: true,
        emptyLabel: context.isAdmin ? 'كل القطاعات' : 'كل القطاعات المصرح بها',
        allowedValues: allowedSectors,
        currentValue: filterState.sector
    });

    if (!allowedSectors.length) {
        sectorFilterEl.disabled = true;
        if (stationFilterEl) {
            stationFilterEl.disabled = true;
        }
        return;
    }

    if (allowedSectors.length === 1 && !context.isAdmin) {
        const onlySector = allowedSectors[0];
        sectorFilterEl.value = onlySector;
        filterState.sector = onlySector;
        sectorFilterEl.disabled = true;
    } else if (filterState.sector) {
        sectorFilterEl.value = filterState.sector;
    }

    updateStationFilterOptions();

    sectorFilterEl.addEventListener('change', handleSectorFilterChange);
    if (stationFilterEl) {
        stationFilterEl.addEventListener('change', handleStationFilterChange);
    }
}

// Bookmark-stripe sector buttons + pill station buttons that drive the hidden
// <select> filters (kept as the source of truth so existing filter logic is unchanged).
const SECTOR_STRIPE_COLORS = ['#0ea5a4', '#f97316', '#22c55e', '#6366f1', '#0ea5e9', '#e11d48', '#7c3aed', '#d97706'];

function setupSectorStationButtons() {
    const stripesContainer = document.getElementById('sectorStripes');
    const stationButtonsContainer = document.getElementById('stationButtonsContainer');
    if (!sectorFilterEl || !stripesContainer) return;

    const setSelectValue = (selectEl, value) => {
        if (!selectEl) return;
        const normalized = value || '';
        if (selectEl.value !== normalized) selectEl.value = normalized;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // --- Sector stripes ---
    const syncActiveSector = () => {
        const active = sectorFilterEl.value || '';
        Array.from(stripesContainer.querySelectorAll('.sector-stripe')).forEach((btn) => {
            const isActive = btn.dataset.sector === active && active !== '';
            btn.classList.toggle('is-active', isActive);
            btn.classList.toggle('is-disabled', btn.disabled && !isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    const renderSectorStripes = () => {
        const options = Array.from(sectorFilterEl.options).filter((opt) => opt.value);
        stripesContainer.innerHTML = '';
        options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sector-stripe';
            btn.dataset.sector = opt.value;
            btn.textContent = (opt.textContent || '').trim() || opt.value;
            btn.style.setProperty('--stripe-color', SECTOR_STRIPE_COLORS[index % SECTOR_STRIPE_COLORS.length]);
            btn.disabled = Boolean(opt.disabled) || sectorFilterEl.disabled;
            btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
            stripesContainer.appendChild(btn);
        });
        syncActiveSector();
    };

    stripesContainer.addEventListener('click', (event) => {
        const btn = event.target.closest('.sector-stripe');
        if (!btn || btn.disabled) return;
        const value = btn.dataset.sector || '';
        const next = (sectorFilterEl.value === value) ? '' : value; // click active again → كل القطاعات
        setSelectValue(sectorFilterEl, next);
    });

    // --- Station buttons (single select) ---
    const syncActiveStation = () => {
        if (!stationButtonsContainer || !stationFilterEl) return;
        const active = stationFilterEl.value || '';
        Array.from(stationButtonsContainer.querySelectorAll('.station-btn')).forEach((btn) => {
            const isSelected = btn.dataset.value === active && active !== '';
            btn.classList.toggle('is-selected', isSelected);
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    };

    const renderStationButtons = () => {
        if (!stationButtonsContainer) return;
        const options = stationFilterEl ? Array.from(stationFilterEl.options).filter((opt) => opt.value) : [];
        stationButtonsContainer.innerHTML = '';
        if (!stationFilterEl || stationFilterEl.disabled || options.length === 0) {
            const span = document.createElement('span');
            span.className = 'station-buttons-empty';
            span.textContent = sectorFilterEl.value ? 'لا توجد أقسام' : 'اختر قطاعًا أولاً';
            stationButtonsContainer.appendChild(span);
            return;
        }
        options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'station-btn';
            btn.dataset.value = opt.value;
            btn.textContent = (opt.textContent || '').trim() || opt.value;
            stationButtonsContainer.appendChild(btn);
        });
        syncActiveStation();
    };

    if (stationButtonsContainer) {
        stationButtonsContainer.addEventListener('click', (event) => {
            const btn = event.target.closest('.station-btn');
            if (!btn || !stationFilterEl) return;
            const value = btn.dataset.value || '';
            const next = (stationFilterEl.value === value) ? '' : value; // click active again → كل الأقسام
            setSelectValue(stationFilterEl, next);
        });
    }

    // The hidden selects are repopulated by populate*/updateStationFilterOptions
    // (innerHTML replaced, disabled toggled) — rebuild the visual controls to match.
    new MutationObserver(renderSectorStripes).observe(sectorFilterEl, {
        childList: true, attributes: true, attributeFilter: ['disabled']
    });
    sectorFilterEl.addEventListener('change', syncActiveSector);

    if (stationFilterEl) {
        new MutationObserver(renderStationButtons).observe(stationFilterEl, {
            childList: true, attributes: true, attributeFilter: ['disabled']
        });
        stationFilterEl.addEventListener('change', syncActiveStation);
    }

    renderSectorStripes();
    renderStationButtons();
}

function initializeDateFilters() {
    updateDateFilterOptions();
    if (yearFilterEl && yearFilterEl.dataset.dateFilterBound !== 'true') {
        yearFilterEl.addEventListener('change', handleYearFilterChange);
        yearFilterEl.dataset.dateFilterBound = 'true';
    }
    if (monthFilterEl && monthFilterEl.dataset.dateFilterBound !== 'true') {
        monthFilterEl.addEventListener('change', handleMonthFilterChange);
        monthFilterEl.dataset.dateFilterBound = 'true';
    }
}

function configureCreateSectorStationControls() {
    if (!createSectorSelectEl || !createStationSelectEl) return;
    const context = computePortalUserContext();
    const allowedSectors = Array.from(context.allowedSectorSet);

    populateSectorSelect(createSectorSelectEl, {
        includeEmptyOption: true,
        emptyLabel: 'اختر القطاع',
        allowedValues: allowedSectors,
        currentValue: createSectorSelectEl.value
    });

    const syncStations = () => {
        const sectorValue = normalizeSectorName(createSectorSelectEl.value);
        const stations = getStationsForSector(sectorValue, { enforceAccess: true });
        populateStationSelect(createStationSelectEl, sectorValue, {
            includeEmptyOption: true,
            emptyLabel: 'اختر القسم',
            allowedStations: stations,
            currentValue: createStationSelectEl.value,
            enforceAccess: true
        });
        createStationSelectEl.disabled = !sectorValue || stations.length === 0;
    };

    if (createSectorSelectEl.dataset.stationSyncBound !== 'true') {
        createSectorSelectEl.addEventListener('change', syncStations);
        createSectorSelectEl.dataset.stationSyncBound = 'true';
    }
    syncStations();
}

function configureDetailSectorControls(record) {
    if (!detailInputEls.sector || !detailInputEls.station) return;
    if (!detailInputEls.sector.dataset.sectorBound) {
        detailInputEls.sector.addEventListener('change', () => {
            const sectorValue = normalizeSectorName(detailInputEls.sector.value);
            populateStationSelect(detailInputEls.station, sectorValue, {
                includeEmptyOption: true,
                emptyLabel: 'اختر القسم',
                enforceAccess: false,
                currentValue: detailInputEls.station.value
            });
            detailInputEls.station.disabled = !sectorValue;
        });
        detailInputEls.sector.dataset.sectorBound = 'true';
    }

    const sectorValue = normalizeSectorName(record?.sector || detailInputEls.sector.value);
    populateSectorSelect(detailInputEls.sector, {
        includeEmptyOption: true,
        emptyLabel: 'اختر القطاع',
        allowedValues: SECTOR_VALUES,
        currentValue: sectorValue
    });
    detailInputEls.sector.value = sectorValue || '';

    populateStationSelect(detailInputEls.station, sectorValue, {
        includeEmptyOption: true,
        emptyLabel: 'اختر القسم',
        currentValue: record?.station,
        enforceAccess: false
    });
    detailInputEls.station.value = normalizeStationName(record?.station, record?.sector) || '';
    detailInputEls.station.disabled = !sectorValue;
}

function computeRecordsSignature(records) {
    if (!Array.isArray(records) || records.length === 0) return '[]';
    const payload = records.map((record) => ({
        id: record?.id ?? '',
        name: record?.name ?? '',
        job: record?.job ?? '',
        nationalId: record?.nationalId ?? '',
        address: record?.address ?? '',
        sector: record?.sector ?? '',
        station: record?.station ?? '',
        licenseType: record?.licenseType ?? '',
        licenseTypeOther: record?.licenseTypeOther ?? '',
        weaponData: record?.weaponData ?? '',
        directorates: Array.isArray(record?.directorates) ? [...record.directorates].sort() : [],
        applicationDate: record?.applicationDate ?? '',
        approvalDate: record?.approvalDate ?? '',
        purchasePermit: record?.purchasePermit ?? '',
        licenseNumber: record?.licenseNumber ?? '',
        outgoingNumber: record?.outgoingNumber ?? '',
        incomingNumber: record?.incomingNumber ?? '',
        decision: record?.decision ?? '',
        notes: record?.notes ?? '',
        managementDetails: Array.isArray(record?.managementDetails)
            ? record.managementDetails.map((detail) => ({
                name: detail?.name ?? '',
                selected: Boolean(detail?.selected),
                outgoingNumber: detail?.outgoingNumber ?? '',
                incomingNumber: detail?.incomingNumber ?? '',
                screeningResult: detail?.screeningResult ?? '',
                notes: detail?.notes ?? ''
            }))
            : []
    }));
    return JSON.stringify(payload);
}

function normalizeTwoDigits(part) {
    const digits = String(part ?? '').replace(/\D/g, '');
    return digits ? digits.padStart(2, '0') : '';
}

function formatDateForEditing(digits) {
    if (!digits) return '';
    const first = digits.slice(0, Math.min(2, digits.length));
    const second = digits.length > 2 ? digits.slice(2, Math.min(4, digits.length)) : '';
    const third = digits.length > 4 ? digits.slice(4) : '';
    return [first, second, third].filter(Boolean).join('/');
}

function isValidDate(year, month, day) {
    if (!year || !month || !day) return false;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    const date = new Date(`${String(y).padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d;
}

function normalizeDateInput(value) {
    if (value === null || value === undefined) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';

    const separators = ['/', '-'];
    for (const sep of separators) {
        if (trimmed.includes(sep)) {
            const parts = trimmed.split(sep).map((part) => part.trim());
            if (parts.length === 3) {
                let [first, middle, last] = parts;
                if (first.length === 4) {
                    const year = first;
                    const month = normalizeTwoDigits(middle);
                    const day = normalizeTwoDigits(last);
                    if (isValidDate(year, month, day)) return `${year}/${month}/${day}`;
                } else if (last.length === 4) {
                    const year = last;
                    const month = normalizeTwoDigits(middle);
                    const day = normalizeTwoDigits(first);
                    if (isValidDate(year, month, day)) return `${year}/${month}/${day}`;
                }
            }
        }
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 8) {
        const dayFirst = digits.slice(0, 2);
        const monthFirst = digits.slice(2, 4);
        const yearLast = digits.slice(4, 8);
        if (isValidDate(yearLast, monthFirst, dayFirst)) {
            return `${yearLast}/${normalizeTwoDigits(monthFirst)}/${normalizeTwoDigits(dayFirst)}`;
        }
        const yearFirst = digits.slice(0, 4);
        const monthSecond = digits.slice(4, 6);
        const daySecond = digits.slice(6, 8);
        if (isValidDate(yearFirst, monthSecond, daySecond)) {
            return `${yearFirst}/${normalizeTwoDigits(monthSecond)}/${normalizeTwoDigits(daySecond)}`;
        }
    }

    return null;
}

function normalizeDateFromDigits(digits) {
    if (!digits || digits.length !== MAX_DATE_DIGITS) return null;
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    if (!isValidDate(year, month, day)) return null;
    return `${year}/${normalizeTwoDigits(month)}/${normalizeTwoDigits(day)}`;
}

function normalizedDateToDigits(normalized) {
    if (!normalized) return '';
    const parts = String(normalized).split(/[\/\-]/).map((part) => part.trim());
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    if (!year || !month || !day) return '';
    return `${normalizeTwoDigits(day)}${normalizeTwoDigits(month)}${String(year).padStart(4, '0')}`;
}

function formatNormalizedDateForDisplay(normalized) {
    if (!normalized) return '';
    const parts = String(normalized).split('/');
    if (parts.length !== 3) {
        return toArabicDigits(String(normalized));
    }
    const [year, month, day] = parts;
    const safeDay = normalizeTwoDigits(day);
    const safeMonth = normalizeTwoDigits(month);
    const safeYear = String(year).padStart(4, '0');
    return toArabicDigits(`${safeYear}/${safeMonth}/${safeDay}`);
}

function normalizeOptionalDate(value) {
    const trimmed = stringOrEmpty(value);
    if (!trimmed) return '';
    const normalized = normalizeDateInput(trimmed);
    if (normalized) return normalized;
    const englishDigits = toEnglishDigits(trimmed).replace(/\D/g, '');
    if (englishDigits.length === MAX_DATE_DIGITS) {
        const fromDigits = normalizeDateFromDigits(englishDigits);
        if (fromDigits) return fromDigits;
    }
    return trimmed;
}

function formatDateForDisplay(value) {
    if (!value) return '—';
    const normalized = normalizeDateInput(value);
    if (normalized) return formatNormalizedDateForDisplay(normalized);
    return toArabicDigits(String(value));
}

function formatDateTimeForDisplay(value) {
    if (!value) return '—';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return toArabicDigits(String(value));
        }
        return new Intl.DateTimeFormat('ar-EG', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    } catch (error) {
        console.warn('Unable to format date/time value:', value, error);
        return toArabicDigits(String(value));
    }
}

function getValue(source, keys, fallback = '') {
    for (const key of keys) {
        if (source && Object.prototype.hasOwnProperty.call(source, key)) {
            const value = source[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }
    return fallback;
}

function normalizeDirectorates(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue.map(normalizeDirectorateName).filter(Boolean);
    }
    const text = stringOrEmpty(rawValue);
    if (!text) return [];
    return text
        .split(/[،,;\n]+/)
        .map(normalizeDirectorateName)
        .filter(Boolean);
}

function applyDirectorateFallbackValues(details = [], fallbackValues = {}) {
    if (!Array.isArray(details) || !details.length) return;
    const selectedDetails = details.filter((detail) => detail.selected);
    if (!selectedDetails.length) return;

    const outgoingNumber = sanitizeNumeric(fallbackValues.outgoingNumber);
    const incomingNumber = sanitizeNumeric(fallbackValues.incomingNumber);

    if (outgoingNumber) {
        selectedDetails.forEach((detail) => {
            if (!detail.outgoingNumber) {
                detail.outgoingNumber = outgoingNumber;
            }
        });
    }

    if (incomingNumber) {
        selectedDetails.forEach((detail) => {
            if (!detail.incomingNumber) {
                detail.incomingNumber = incomingNumber;
            }
        });
    }
}

function normalizeDirectorateDetails(rawDetails, fallbackSelection = [], fallbackValues = {}) {
    const selectedSet = new Set((fallbackSelection || []).map(normalizeDirectorateName).filter(Boolean));
    const detailsMap = new Map();

    if (Array.isArray(rawDetails)) {
        rawDetails.forEach((detail) => {
            if (!detail) return;
            const name = normalizeDirectorateName(getValue(detail, ['name', 'directorate', 'managementName', 'label'], ''));
            if (!name) return;
            const normalizedDetail = createDirectorateDetailTemplate(name, {
                selected: detail.selected,
                outgoingNumber: getValue(detail, ['outgoingNumber', 'outgoing_number', 'outgoingNo', 'outgoing'], ''),
                outgoingDate: getValue(detail, ['outgoingDate', 'outgoing_date'], ''),
                incomingNumber: getValue(detail, ['incomingNumber', 'incoming_number', 'incomingNo', 'incoming'], ''),
                incomingDate: getValue(detail, ['incomingDate', 'incoming_date'], ''),
                licenseType: getValue(detail, ['licenseType', 'license_type', 'نوع_الترخيص'], ''),
                licenseTypeOther: getValue(detail, ['licenseTypeOther', 'license_type_other', 'otherLicenseType', 'other_license_type', 'نوع_ترخيص_اخر'], ''),
                screeningResult: getValue(detail, ['screeningResult', 'screening_result', 'result'], ''),
                notes: getValue(detail, ['notes', 'note', 'comment'], '')
            }, selectedSet.has(name));
            if (typeof detail.selected === 'boolean') {
                normalizedDetail.selected = detail.selected;
                if (detail.selected) {
                    selectedSet.add(name);
                } else {
                    selectedSet.delete(name);
                }
            }
            detailsMap.set(name, normalizedDetail);
        });
    }

    const details = [];

    DIRECTORATE_OPTIONS.forEach((option) => {
        if (detailsMap.has(option)) {
            const detail = detailsMap.get(option);
            detail.selected = typeof detail.selected === 'boolean' ? detail.selected : selectedSet.has(option);
            details.push(detail);
            detailsMap.delete(option);
        } else {
            details.push(createDirectorateDetailTemplate(option, {}, selectedSet.has(option)));
        }
    });

    detailsMap.forEach((detail) => {
        detail.selected = typeof detail.selected === 'boolean' ? detail.selected : selectedSet.has(detail.name);
        details.push(detail);
    });

    applyDirectorateFallbackValues(details, fallbackValues);
    return details;
}

function normalizeRecord(item, index = 0) {
    const baseId = getValue(item, ['id', 'ID', 'recordId', 'رقم', 'serial'], index + 1);
    const applicationDateRaw = getValue(item, ['applicationDate', 'ApplicationDate', 'submissionDate', 'SubmissionDate', 'requestDate', 'RequestDate', 'تاريخ_التقديم', 'تاريخ التقديم'], '');
    const normalizedApplicationDate = normalizeDateInput(applicationDateRaw);
    const approvalDateRaw = getValue(item, ['approvalDate', 'ApprovalDate', 'approval_date', 'تاريخ_الموافقة'], '');
    const normalizedApprovalDate = normalizeDateInput(approvalDateRaw);
    const fallbackDirectorates = normalizeDirectorates(getValue(item, ['directorates', 'Directorates', 'directorate', 'Directorate', 'department', 'الإدارة', 'الإدارات'], ''));
    const rawSector = getValue(item, ['sector', 'Sector', 'sectorName', 'SectorName', 'room', 'Room', 'القطاع', 'قطاع'], '');
    const sector = normalizeSectorName(rawSector);
    const rawStationEntry = getValue(item, ['station', 'Station', 'stations', 'Stations', 'policeStation', 'police_station', 'departmentName', 'Department', 'القسم', 'قسم'], '');
    let station = '';
    if (Array.isArray(rawStationEntry)) {
        const firstStation = rawStationEntry.find((entry) => stringOrEmpty(entry));
        station = normalizeStationName(firstStation, sector);
    } else {
        station = normalizeStationName(rawStationEntry, sector);
    }

    const fallbackValues = {
        outgoingNumber: getValue(item, ['outgoingNumber', 'OutgoingNumber', 'outgoing_no', 'رقم_الصادر'], ''),
        incomingNumber: getValue(item, ['incomingNumber', 'IncomingNumber', 'incoming_no', 'رقم_الوارد'], '')
    };

    const managementDetails = normalizeDirectorateDetails(
        getValue(item, ['managementDetails', 'directorateDetails', 'managements', 'directorateRecords'], []),
        fallbackDirectorates,
        fallbackValues
    );

    const selectedDirectorates = managementDetails
        .filter((detail) => detail.selected)
        .map((detail) => detail.name)
        .filter(Boolean);

    const fallbackOutgoingNumber = sanitizeNumeric(fallbackValues.outgoingNumber);
    const fallbackIncomingNumber = sanitizeNumeric(fallbackValues.incomingNumber);

    const primaryDetail = managementDetails.find((detail) => detail.selected && (detail.outgoingNumber || detail.incomingNumber))
        || managementDetails.find((detail) => detail.selected);

    const normalizedOutgoingNumber = primaryDetail?.outgoingNumber || fallbackOutgoingNumber;
    const normalizedIncomingNumber = primaryDetail?.incomingNumber || fallbackIncomingNumber;

    let recordLicenseType = normalizeLicenseTypeName(getValue(item, ['licenseType', 'LicenseType', 'licenceType', 'نوع_الترخيص'], ''));
    let recordLicenseTypeOther = stringOrEmpty(getValue(item, ['licenseTypeOther', 'LicenseTypeOther', 'otherLicenseType', 'نوع_ترخيص_اخر'], ''));

    if (!recordLicenseType) {
        const detailWithLicense = managementDetails.find((detail) => stringOrEmpty(detail?.licenseType));
        if (detailWithLicense) {
            recordLicenseType = normalizeLicenseTypeName(detailWithLicense.licenseType);
            recordLicenseTypeOther = stringOrEmpty(detailWithLicense.licenseTypeOther);
        }
    }

    if (recordLicenseType !== 'أخرى') {
        recordLicenseTypeOther = '';
    }

    return {
        id: stringOrEmpty(baseId) || String(index + 1),
        name: stringOrEmpty(getValue(item, ['name', 'Name', 'requesterName', 'RequesterName', 'الاسم'], '')),
        job: stringOrEmpty(getValue(item, ['job', 'Job', 'occupation', 'الوظيفة'], '')),
        nationalId: sanitizeNumeric(getValue(item, ['nationalId', 'nationalID', 'NationalId', 'NationalID', 'الرقم_القومي', 'رقم_قومي'], '')),
        address: stringOrEmpty(getValue(item, ['address', 'Address', 'العنوان'], '')),
        weaponData: stringOrEmpty(getValue(item, ['weaponData', 'weaponDetails', 'weapon', 'بيانات_السلاح', 'السلاح المطلوب'], '')),
        licenseType: recordLicenseType,
        licenseTypeOther: recordLicenseTypeOther,
        sector,
        station,
        directorates: selectedDirectorates,
        directorate: selectedDirectorates.join('، '),
        managementDetails,
        outgoingNumber: normalizedOutgoingNumber,
        incomingNumber: normalizedIncomingNumber,
        applicationDate: normalizedApplicationDate || stringOrEmpty(applicationDateRaw),
        approvalDate: normalizedApprovalDate || stringOrEmpty(approvalDateRaw),
        purchasePermit: sanitizeNumeric(getValue(item, ['purchasePermit', 'PurchasePermit', 'purchase_permit', 'رقم_التصريح'], '')),
        licenseNumber: sanitizeNumeric(getValue(item, ['licenseNumber', 'LicenseNumber', 'license_no', 'رقم_الرخصة'], '')),
        notes: stringOrEmpty(getValue(item, ['notes', 'Notes', 'ملاحظات'], '')),
        raw: item || {}
    };
}

function normalizeRecords(items) {
    if (!Array.isArray(items)) return [];
    return sortRecordsById(items.map((item, index) => normalizeRecord(item, index)));
}

function sortRecordsById(records) {
    if (!Array.isArray(records)) return [];
    return [...records].sort(compareRecordIds);
}

function compareRecordIds(a, b) {
    const aNum = Number(a?.id);
    const bNum = Number(b?.id);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return aNum - bNum;
    }
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''), 'ar', { numeric: true });
}

function sortRecordsByStation(records, sector) {
    if (!Array.isArray(records)) return [];
    const normalizedSector = normalizeSectorName(sector);
    if (!normalizedSector) return records.slice();

    const stationOrder = new Map();
    getStationsForSector(normalizedSector, { enforceAccess: true }).forEach((station, index) => {
        stationOrder.set(normalizeStationName(station, normalizedSector), index);
    });

    return records.slice().sort((left, right) => {
        const leftStation = normalizeStationName(left?.station, left?.sector || normalizedSector);
        const rightStation = normalizeStationName(right?.station, right?.sector || normalizedSector);
        const leftIndex = stationOrder.has(leftStation) ? stationOrder.get(leftStation) : Number.MAX_SAFE_INTEGER;
        const rightIndex = stationOrder.has(rightStation) ? stationOrder.get(rightStation) : Number.MAX_SAFE_INTEGER;

        if (leftIndex !== rightIndex) {
            return leftIndex - rightIndex;
        }
        if (leftStation !== rightStation) {
            return leftStation.localeCompare(rightStation, 'ar', { numeric: true, sensitivity: 'base' });
        }
        return compareRecordIds(left, right);
    });
}

function getStationSequenceKey(record) {
    const sector = normalizeSectorName(record?.sector) || '__no_sector__';
    const station = normalizeStationName(record?.station, record?.sector) || '__no_station__';
    return `${sector}::${station}`;
}

function sortRecordsBySectorAndStation(records) {
    if (!Array.isArray(records)) return [];

    const sectorOrder = new Map();
    SECTOR_VALUES.forEach((sector, index) => {
        sectorOrder.set(normalizeSectorName(sector), index);
    });

    const stationOrderBySector = new Map();
    SECTOR_VALUES.forEach((sector) => {
        const normalizedSector = normalizeSectorName(sector);
        const stationOrder = new Map();
        getStationsForSector(normalizedSector, { enforceAccess: false }).forEach((station, index) => {
            stationOrder.set(normalizeStationName(station, normalizedSector), index);
        });
        stationOrderBySector.set(normalizedSector, stationOrder);
    });

    return records.slice().sort((left, right) => {
        const leftSector = normalizeSectorName(left?.sector);
        const rightSector = normalizeSectorName(right?.sector);
        const leftSectorIndex = sectorOrder.has(leftSector) ? sectorOrder.get(leftSector) : Number.MAX_SAFE_INTEGER;
        const rightSectorIndex = sectorOrder.has(rightSector) ? sectorOrder.get(rightSector) : Number.MAX_SAFE_INTEGER;

        if (leftSectorIndex !== rightSectorIndex) return leftSectorIndex - rightSectorIndex;
        if (Boolean(leftSector) !== Boolean(rightSector)) return leftSector ? -1 : 1;
        if (leftSector !== rightSector) {
            return leftSector.localeCompare(rightSector, 'ar', { numeric: true, sensitivity: 'base' });
        }

        const stationOrder = stationOrderBySector.get(leftSector) || new Map();
        const leftStation = normalizeStationName(left?.station, leftSector);
        const rightStation = normalizeStationName(right?.station, rightSector);
        const leftStationIndex = stationOrder.has(leftStation) ? stationOrder.get(leftStation) : Number.MAX_SAFE_INTEGER;
        const rightStationIndex = stationOrder.has(rightStation) ? stationOrder.get(rightStation) : Number.MAX_SAFE_INTEGER;

        if (leftStationIndex !== rightStationIndex) return leftStationIndex - rightStationIndex;
        if (Boolean(leftStation) !== Boolean(rightStation)) return leftStation ? -1 : 1;
        if (leftStation !== rightStation) {
            return leftStation.localeCompare(rightStation, 'ar', { numeric: true, sensitivity: 'base' });
        }
        return compareRecordIds(left, right);
    });
}

function buildStationRequestNumberMap(records = allRecords) {
    const numberMap = new Map();
    if (!Array.isArray(records) || !records.length) return numberMap;

    const stationCounts = new Map();
    sortRecordsBySectorAndStation(records).forEach((record) => {
        const stationKey = getStationSequenceKey(record);
        const id = stringOrEmpty(record?.id);
        if (!id) return;
        const nextNumber = (stationCounts.get(stationKey) || 0) + 1;
        stationCounts.set(stationKey, nextNumber);
        numberMap.set(id, String(nextNumber));
    });

    return numberMap;
}

function getRequestDisplayNumber(record, numberMap = buildStationRequestNumberMap()) {
    const databaseId = stringOrEmpty(record?.id);
    return numberMap.get(databaseId) || databaseId;
}
function safeSetCache(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Unable to persist data in sessionStorage', error);
    }
}

function safeGetCache(key, fallback = null) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (error) {
        console.warn('Unable to read data from sessionStorage', error);
        return fallback;
    }
}

function isHtmlResponse(contentType, payload) {
    if (contentType?.includes('text/html')) return true;
    if (typeof payload !== 'string') return false;
    const trimmed = payload.trim().toLowerCase();
    return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

async function fetchRequests() {
    try {
        const response = await fetch(RECORDS_ENDPOINT, {
            cache: 'no-store',
            headers: {
                'Accept': 'application/json'
            }
        });
        const contentType = response.headers.get('Content-Type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : await response.text();

        if (!response.ok || isHtmlResponse(contentType, payload)) {
            const message = typeof payload === 'string' && !isHtmlResponse(contentType, payload)
                ? payload
                : 'يبدو أن الجلسة انتهت أو يلزم تسجيل الدخول قبل عرض السجلات.';
            throw new Error(message);
        }

        return Array.isArray(payload) ? payload : [];
    } catch (error) {
        console.error('Error fetching requests:', error);
        setFlashMessage(`تعذر تحميل السجلات: ${error.message}`, 'error');
        return null;
    }
}

async function fetchRequestsVersion() {
    try {
        const response = await fetch(RECORDS_VERSION_ENDPOINT, {
            cache: 'no-store',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) return null;
        const payload = await response.json();
        if (!payload || payload.ok === false || !payload.version) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

async function createRequest(requestData) {
    const response = await fetch(RECORDS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
    });

    const contentType = response.headers.get('Content-Type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok || isHtmlResponse(contentType, payload)) {
        let message = '';
        if (payload && typeof payload === 'object') {
            message = payload.error || payload.message || '';
        } else if (typeof payload === 'string' && !isHtmlResponse(contentType, payload)) {
            message = payload;
        }
        if (!message) {
            message = 'تعذر حفظ السجل. يرجى التأكد من صلاحية الجلسة أو تسجيل الدخول ثم إعادة المحاولة.';
        }
        throw new Error(message);
    }

    return payload;
}

async function updateRequest(id, requestData) {
    const response = await fetch(`${RECORDS_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
    });

    const contentType = response.headers.get('Content-Type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok || isHtmlResponse(contentType, payload)) {
        let message = '';
        if (payload && typeof payload === 'object') {
            message = payload.error || payload.message || '';
        } else if (typeof payload === 'string' && !isHtmlResponse(contentType, payload)) {
            message = payload;
        }
        if (!message) {
            message = 'تعذر تحديث السجل حالياً.';
        }
        throw new Error(message);
    }

    return payload;
}

async function deleteRequest(id) {
    const response = await fetch(`${RECORDS_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json'
        }
    });

    const contentType = response.headers.get('Content-Type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok || isHtmlResponse(contentType, payload)) {
        const message = typeof payload === 'string' && !isHtmlResponse(contentType, payload)
            ? payload
            : 'تعذر حذف السجل حالياً.';
        throw new Error(message);
    }

    return payload;
}

async function fetchDeletedRequests() {
    try {
        const response = await fetch(DELETED_RECORDS_ENDPOINT, {
            headers: {
                'Accept': 'application/json'
            }
        });
        const contentType = response.headers.get('Content-Type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : await response.text();

        if (!response.ok || isHtmlResponse(contentType, payload)) {
            const message = typeof payload === 'string' && !isHtmlResponse(contentType, payload)
                ? payload
                : 'تعذر تحميل السجلات المحذوفة حالياً.';
            throw new Error(message);
        }

        return Array.isArray(payload) ? payload : [];
    } catch (error) {
        console.error('Error fetching deleted requests:', error);
        setFlashMessage(`تعذر تحميل السجلات المحذوفة: ${error.message}`, 'error');
        return [];
    }
}

async function restoreDeletedRequest(id) {
    const response = await fetch(RESTORE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ id })
    });

    const contentType = response.headers.get('Content-Type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok || isHtmlResponse(contentType, payload)) {
        let message = '';
        if (payload && typeof payload === 'object') {
            message = payload.error || payload.message || '';
        } else if (typeof payload === 'string' && !isHtmlResponse(contentType, payload)) {
            message = payload;
        }
        if (!message) {
            message = 'تعذر استرجاع السجل المحذوف حالياً.';
        }
        throw new Error(message);
    }

    return payload;
}

async function clearTemporaryStorage() {
    const response = await fetch(DELETED_RECORDS_ENDPOINT, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json'
        }
    });

    const contentType = response.headers.get('Content-Type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok || isHtmlResponse(contentType, payload)) {
        const message = typeof payload === 'string' && !isHtmlResponse(contentType, payload)
            ? payload
            : 'تعذر مسح الملفات المؤقتة.';
        throw new Error(message);
    }

    deletedRecordsCache = [];
    if (deletedPanelVisible) {
        renderDeletedRecords([]);
    }

    return payload;
}

function hasActiveSectorPrintFilter() {
    return Boolean(normalizeSectorName(sectorFilterEl?.value || filterState.sector));
}

function canPrintCurrentRecords(records = currentFilteredRecords) {
    return hasActiveSectorPrintFilter() && Array.isArray(records) && records.length > 0;
}

function updatePrintButtonsState(records = currentFilteredRecords) {
    const canPrint = canPrintCurrentRecords(records);
    if (printExcelBtnEl) {
        printExcelBtnEl.disabled = printExcelBtnEl.dataset.loading === 'true' || !canPrint;
    }
    if (browserPrintBtnEl) {
        browserPrintBtnEl.disabled = !canPrint;
    }
}

function updateRecordsPagination() {
    if (!RequestRecordPagination) return;
    const totalPages = RequestRecordPagination.getTotalPages(currentFilteredRecords.length);
    currentRecordsPage = RequestRecordPagination.clampPage(currentRecordsPage, currentFilteredRecords.length);

    if (requestPageIndicatorEl) {
        requestPageIndicatorEl.textContent = `${toArabicDigits(currentRecordsPage)} / ${toArabicDigits(totalPages)}`;
    }
    if (requestPagePreviousEl) {
        requestPagePreviousEl.disabled = currentRecordsPage <= 1;
    }
    if (requestPageNextEl) {
        requestPageNextEl.disabled = currentRecordsPage >= totalPages;
    }
}

function renderCurrentRecordsPage({ resetScroll = false } = {}) {
    if (!RequestRecordPagination) {
        renderRecords(currentFilteredRecords, currentFilteredRecords.length);
        return;
    }

    currentRecordsPage = RequestRecordPagination.clampPage(currentRecordsPage, currentFilteredRecords.length);
    const pageRecords = RequestRecordPagination.getPageSlice(currentFilteredRecords, currentRecordsPage);
    renderRecords(pageRecords, currentFilteredRecords.length);
    updateRecordsPagination();

    if (resetScroll && requestRecordsViewportEl) {
        requestRecordsViewportEl.scrollTop = 0;
    }
}

function changeRecordsPage(offset) {
    if (!RequestRecordPagination) return;
    const nextPage = RequestRecordPagination.clampPage(
        currentRecordsPage + Number(offset || 0),
        currentFilteredRecords.length
    );
    if (nextPage === currentRecordsPage) return;
    currentRecordsPage = nextPage;
    renderCurrentRecordsPage({ resetScroll: true });
}

function renderRecords(records, totalCount = records.length) {
    if (!recordsListEl) return;
    recordsListEl.innerHTML = '';
    const requestNumberMap = buildStationRequestNumberMap(currentFilteredRecords);
    const filteredRecordIndexMap = new Map();
    currentFilteredRecords.forEach((record, index) => {
        filteredRecordIndexMap.set(stringOrEmpty(record?.id), index);
    });

    const selectedExists = selectedRecordId
        ? currentFilteredRecords.some((record) => String(record.id) === String(selectedRecordId))
        : false;
    if (!selectedExists) {
        selectedRecordId = null;
    }

    if (!records.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-placeholder';
        const emptyMessage = filterState.month
            ? 'لا يوجد اي طلب في هذا الشهر'
            : 'لم يتم العثور على نتائج.';
        empty.innerHTML = `<p>${escapeHtml(emptyMessage)}</p>`;
        recordsListEl.appendChild(empty);
    } else {
        records.forEach((record, index) => {
            const row = document.createElement('div');
            row.className = 'record-item';
            const rowId = record.id || String(index + 1);
            row.dataset.id = rowId;
            row.dataset.name = record.name || '';
            const globalIndex = filteredRecordIndexMap.get(stringOrEmpty(record?.id));
            const previousRecord = Number.isInteger(globalIndex) && globalIndex > 0
                ? currentFilteredRecords[globalIndex - 1]
                : null;
            if (previousRecord && getStationSequenceKey(previousRecord) !== getStationSequenceKey(record)) {
                row.classList.add('station-group-break');
            }
            if (selectedRecordId && String(selectedRecordId) === String(rowId)) {
                row.classList.add('is-selected');
            }
            const sectorLabel = getSectorLabel(record.sector) || '—';
            const stationLabel = normalizeStationName(record.station) || '—';
            const applicationDateDisplay = formatDateForDisplay(record.applicationDate);
            const weaponDataDisplay = record.weaponData
                ? escapeHtml(record.weaponData).replace(/\n/g, '<br>')
                : '—';
            row.innerHTML = `
                <span class="record-serial">${escapeHtml(toArabicDigits(getRequestDisplayNumber(record, requestNumberMap)))}</span>
                <span class="record-name">${record.name || '—'}</span>
                <span class="record-application-date">${escapeHtml(applicationDateDisplay)}</span>
                <span class="record-sector">${escapeHtml(sectorLabel)}</span>
                <span class="record-station">${escapeHtml(stationLabel)}</span>
                <span class="record-weapon">${weaponDataDisplay}</span>
                <div class="record-actions">
                    <button type="button" class="record-action-btn" data-action="view">عرض</button>
                </div>
            `;
            recordsListEl.appendChild(row);
        });
    }

    if (recordCountEl) {
        recordCountEl.textContent = String(totalCount);
    }

    updatePrintButtonsState(currentFilteredRecords);

    updateRecordActionButtons();
    highlightSelectedRecord();

    if (pendingListScrollTop !== null && requestRecordsViewportEl) {
        requestRecordsViewportEl.scrollTop = pendingListScrollTop;
        pendingListScrollTop = null;
    }
}

function highlightSelectedRecord() {
    if (!recordsListEl) return;
    const items = recordsListEl.querySelectorAll('.record-item');
    items.forEach((item) => {
        const isSelected = selectedRecordId && String(item.dataset.id) === String(selectedRecordId);
        item.classList.toggle('is-selected', Boolean(isSelected));
    });
}

function buildExportRows(records = []) {
    const requestNumberMap = buildStationRequestNumberMap(records);
    return records.map((record, index) => {
        const fallbackId = String(index + 1);
        const recordId = getRequestDisplayNumber(record, requestNumberMap) || fallbackId;
        const name = stringOrEmpty(record.name) || '—';
        const sectorLabel = getSectorLabel(record.sector) || '—';
        const stationLabel = normalizeStationName(record.station) || '—';
        const weapon = stringOrEmpty(record.weaponData).replace(/\r\n/g, '\n');
        const notes = stringOrEmpty(record.notes).replace(/\r\n/g, '\n');

        return {
            recordId: toArabicDigits(recordId),
            requesterName: name,
            applicationDate: formatDateForDisplay(record.applicationDate),
            sector: sectorLabel,
            station: stationLabel,
            weaponData: weapon ? weapon : '—',
            notes: notes ? notes : '—'
        };
    });
}

async function handlePrintExcel() {
    if (!printExcelBtnEl || printExcelBtnEl.dataset.loading === 'true') return;
    if (!hasActiveSectorPrintFilter()) {
        setFlashMessage('يرجى اختيار قطاع قبل الطباعة.', 'error');
        return;
    }
    if (!currentFilteredRecords.length) {
        setFlashMessage('لا توجد نتائج لتصديرها حالياً.', 'error');
        return;
    }

    const originalLabel = printExcelBtnEl.textContent;
    printExcelBtnEl.dataset.loading = 'true';
    printExcelBtnEl.disabled = true;
    printExcelBtnEl.textContent = 'جارٍ التصدير...';

    try {
        setFlashMessage('جارٍ تجهيز ملف Excel...', 'info');
        const exportRows = buildExportRows(currentFilteredRecords);
        const response = await fetch(EXPORT_REQUEST_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ records: exportRows })
        });

        const contentType = response.headers.get('Content-Type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : await response.text();

        if (!response.ok) {
            const message = typeof payload === 'string' ? payload : payload?.error;
            throw new Error(message || 'تعذر إنشاء ملف Excel.');
        }

        const payloadObject = (payload && typeof payload === 'object') ? payload : {};
        if (payloadObject.success === false) {
            throw new Error(payloadObject.error || 'تعذر إنشاء ملف Excel.');
        }

        const recordCount = Number.isFinite(payloadObject.recordCount)
            ? payloadObject.recordCount
            : exportRows.length;
        const countLabel = recordCount > 0 ? ` (${toArabicDigits(recordCount)} سجل)` : '';
        const successMessage = payloadObject.message
            || `تم إنشاء ملف Excel وفتحه للطباعة${countLabel}.`;

        const fileMention = payloadObject.fileName
            ? ` اسم الملف: ${payloadObject.fileName}.`
            : '';
        setFlashMessage(`${successMessage}${fileMention}`, 'success');
    } catch (error) {
        console.error('Error exporting Excel:', error);
        setFlashMessage(error.message || 'تعذر إنشاء ملف Excel.', 'error');
    } finally {
        if (printExcelBtnEl) {
            delete printExcelBtnEl.dataset.loading;
            printExcelBtnEl.textContent = originalLabel;
            updatePrintButtonsState();
        }
    }
}

function handleBrowserPrint() {
    const records = Array.isArray(currentFilteredRecords) ? currentFilteredRecords.slice() : [];
    if (!hasActiveSectorPrintFilter()) {
        setFlashMessage('يرجى اختيار قطاع قبل الطباعة.', 'error');
        return;
    }
    if (!records.length) {
        setFlashMessage('لا توجد نتائج للطباعة حالياً.', 'error');
        return;
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    const dateStr = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });

    const requestNumberMap = buildStationRequestNumberMap(records);
    const PRINT_COLUMNS = [
        {
            key: 'request_number',
            label: 'رقم الطلب',
            width: '8%',
            value: (record, index) => getRequestDisplayNumber(record, requestNumberMap) || String(index + 1)
        },
        { key: 'name', label: 'اسم الطالب', width: '17%', value: (record) => record.name || '' },
        { key: 'application_date', label: 'تاريخ التقديم', width: '11%', value: (record) => formatDateForDisplay(record.applicationDate) },
        { key: 'sector', label: 'القطاع', width: '9%', value: (record) => getSectorLabel(record.sector) || '' },
        { key: 'station', label: 'القسم', width: '10%', value: (record) => normalizeStationName(record.station, record.sector) || '' },
        {
            key: 'license_type',
            label: 'نوع الترخيص',
            width: '12%',
            value: (record) => formatLicenseTypeDisplay(record.licenseType, record.licenseTypeOther) || ''
        },
        {
            key: 'weapon_data',
            label: 'السلاح المطلوب',
            width: '18%',
            value: (record) => stringOrEmpty(record.weaponData).replace(/\r\n/g, '\n')
        },
        {
            key: 'notes',
            label: 'ملاحظات',
            width: '15%',
            value: (record) => stringOrEmpty(record.notes).replace(/\r\n/g, '\n')
        }
    ];

    let currentStation = null;
    let rowsHtml = '';

    records.forEach((record, index) => {
        const sector = getSectorLabel(record.sector) || '';
        const station = normalizeStationName(record.station, record.sector) || '';
        const stationKey = `${sector}::${station}`;
        if (stationKey !== currentStation) {
            currentStation = stationKey;
            rowsHtml += `<tr class="stn-hdr"><td data-span-all colspan="${PRINT_COLUMNS.length}">${esc(station || 'بدون قسم')}${sector ? ' - ' + esc(sector) : ''}</td></tr>`;
        }

        const cells = PRINT_COLUMNS.map((column) => {
            const rawValue = column.value(record, index);
            const htmlValue = esc(rawValue || '').replace(/\r?\n/g, '<br>');
            return `<td data-col-key="${column.key}">${htmlValue || '—'}</td>`;
        }).join('');
        rowsHtml += `<tr${index % 2 === 0 ? '' : ' class="even"'}>${cells}</tr>`;
    });

    const colgroupHtml = '<colgroup>'
        + PRINT_COLUMNS.map((column) => `<col data-col-key="${column.key}" style="width:${column.width}"/>`).join('')
        + '</colgroup>';
    const headerCellsHtml = PRINT_COLUMNS.map((column) => `<th data-col-key="${column.key}">${esc(column.label)}</th>`).join('');
    const colChoicesJson = JSON.stringify(PRINT_COLUMNS.map((column) => ({ key: column.key, label: column.label })));

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>طباعة طلبات الأسلحة</title>
<style>
@page { size: A3 landscape; margin: 10mm 10mm 16mm 10mm; @bottom-center { content: "صفحة " counter(page, arabic-indic) " من " counter(pages, arabic-indic); font-family: Arial, Tahoma, sans-serif; font-size: 10pt; color: #333; direction: rtl; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Tahoma, sans-serif; font-size: 12pt; direction: rtl; color: #000; }
h1 { text-align: center; font-size: 18pt; margin-bottom: 3mm; font-weight: bold; }
.sub { text-align: center; font-size: 11pt; margin-bottom: 5mm; color: #444; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead th { background: #1a1a2e; color: #fff; padding: 2mm 1.5mm; font-size: 12pt; font-weight: bold; text-align: center; border: 1px solid #000; }
tbody td { padding: 1.5mm 1.5mm; border: 1px solid #ccc; text-align: center; vertical-align: middle; word-break: break-word; }
tr.even td { background: #f0f4f8; }
tr.stn-hdr td { background: #2c3e50; color: #fff; font-weight: bold; font-size: 14pt; text-align: center; padding: 1.5mm; border: 1px solid #000; }
.print-settings { position: fixed; top: 12px; left: 12px; z-index: 9999; font-family: Arial, Tahoma, sans-serif; direction: rtl; }
.print-settings .ps-toggle { background: #1a1a2e; color: #fff; border: none; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; font-size: 22px; box-shadow: 0 4px 14px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transition: transform 0.15s, box-shadow 0.15s; }
.print-settings .ps-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
.print-settings .ps-content { position: absolute; top: 62px; left: 0; background: #fff; border-radius: 16px; padding: 18px; width: 420px; box-shadow: 0 12px 40px rgba(0,0,0,0.22); max-height: 82vh; overflow-y: auto; border: 1px solid #e2e8f0; }
.print-settings .ps-content[hidden] { display: none; }
.print-settings h3 { font-size: 14pt; margin: 0 0 14px; color: #1a1a2e; text-align: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
.print-settings .ps-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
.print-settings .ps-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; cursor: pointer; border: 2px solid #e2e8f0; background: #f8fafc; user-select: none; transition: all 0.15s; font-size: 11.5pt; color: #475569; min-height: 22px; }
.print-settings .ps-item:hover { border-color: #94a3b8; background: #f1f5f9; }
.print-settings .ps-item.is-visible { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
.print-settings .ps-item.is-visible:hover { background: #2d2d4f; border-color: #2d2d4f; }
.print-settings .ps-item input { position: absolute; opacity: 0; pointer-events: none; }
.print-settings .ps-item .ps-check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #cbd5e1; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.15s; position: relative; }
.print-settings .ps-item.is-visible .ps-check { background: #fff; border-color: #fff; }
.print-settings .ps-item.is-visible .ps-check::after { content: ''; width: 5px; height: 11px; border: solid #1a1a2e; border-width: 0 2.5px 2.5px 0; transform: rotate(45deg); margin-top: -2px; }
.print-settings .ps-item .ps-text { flex: 1; font-weight: 600; line-height: 1.3; }
.print-settings .ps-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 14px; }
.print-settings .ps-actions button { padding: 12px 14px; border-radius: 10px; border: 2px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 11pt; font-family: inherit; font-weight: 700; color: #475569; transition: all 0.15s; }
.print-settings .ps-actions button:hover { background: #f1f5f9; border-color: #94a3b8; color: #1a1a2e; }
.print-settings .ps-actions .ps-print { background: #1a1a2e; color: #fff; border-color: #1a1a2e; grid-column: 1 / -1; font-size: 12pt; padding: 14px; }
.print-settings .ps-actions .ps-print:hover { background: #2d2d4f; border-color: #2d2d4f; color: #fff; }
@media print { .print-settings, .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="print-settings no-print" id="printSettingsPanel">
<button type="button" class="ps-toggle" id="psToggleBtn" title="إعدادات الطباعة">⚙</button>
<div class="ps-content" id="psContent" hidden>
<h3>إظهار الأعمدة في الطباعة</h3>
<div class="ps-list" id="psList"></div>
<div class="ps-actions">
<button type="button" id="psCheckAll">تحديد الكل</button>
<button type="button" id="psUncheckAll">إلغاء الكل</button>
<button type="button" id="psPrintBtn" class="ps-print">🖨️ طباعة</button>
</div>
</div>
</div>
<h1>بيان بالطلبات المقدمة لترخيص سلاح باقسام الشرطة</h1>
<div class="sub">تاريخ الطباعة: ${dateStr} &nbsp;|&nbsp; إجمالي السجلات: ${records.length}</div>
<table>
${colgroupHtml}
<thead><tr>${headerCellsHtml}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<script>
(function(){
    var STORAGE_KEY = 'requestPrintHiddenCols';
    var COLS = ${colChoicesJson};
    var hidden = new Set();
    try { var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if (Array.isArray(saved)) hidden = new Set(saved); } catch(_) {}
    var list = document.getElementById('psList');
    function renderList(){
        list.innerHTML = COLS.map(function(c){
            var isVisible = !hidden.has(c.key);
            return '<label class="ps-item' + (isVisible ? ' is-visible' : '') + '">'
                + '<input type="checkbox" data-key="' + c.key + '"' + (isVisible ? ' checked' : '') + '>'
                + '<span class="ps-check"></span>'
                + '<span class="ps-text">' + c.label + '</span>'
                + '</label>';
        }).join('');
    }
    renderList();
    function persist(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden))); } catch(_){} }
    function convertDigitsInNode(el){
        try {
            var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
            var node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && /[0-9]/.test(node.nodeValue)) {
                    node.nodeValue = node.nodeValue.replace(/[0-9]/g, function(d){ return String.fromCharCode(0x0660 + Number(d)); });
                }
            }
        } catch(_){}
    }
    function apply(){
        document.querySelectorAll('td[data-col-key]').forEach(function(el){
            var key = el.getAttribute('data-col-key');
            if (el.dataset.origHtml === undefined) {
                convertDigitsInNode(el);
                el.dataset.origHtml = el.innerHTML;
            }
            el.innerHTML = hidden.has(key) ? '' : el.dataset.origHtml;
        });
        persist();
    }
    document.getElementById('psToggleBtn').addEventListener('click', function(){
        var c = document.getElementById('psContent');
        c.hidden = !c.hidden;
    });
    list.addEventListener('change', function(e){
        var inp = e.target.closest('input[type=checkbox]');
        if (!inp) return;
        var key = inp.getAttribute('data-key');
        if (inp.checked) hidden.delete(key); else hidden.add(key);
        var item = inp.closest('.ps-item');
        if (item) item.classList.toggle('is-visible', inp.checked);
        apply();
    });
    document.getElementById('psCheckAll').addEventListener('click', function(){
        hidden.clear();
        renderList();
        apply();
    });
    document.getElementById('psUncheckAll').addEventListener('click', function(){
        COLS.forEach(function(c){ hidden.add(c.key); });
        renderList();
        apply();
    });
    document.getElementById('psPrintBtn').addEventListener('click', function(){
        document.getElementById('psContent').hidden = true;
        setTimeout(function(){ window.print(); }, 50);
    });
    document.addEventListener('click', function(e){
        var panel = document.getElementById('printSettingsPanel');
        var content = document.getElementById('psContent');
        if (!panel || !content || content.hidden) return;
        if (panel.contains(e.target)) return;
        content.hidden = true;
    });
    apply();
})();
<\/script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) {
        setFlashMessage('يرجى السماح بالنوافذ المنبثقة لهذا الموقع.', 'error');
        return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = function () {
        try {
            const walker = printWindow.document.createTreeWalker(printWindow.document.body, NodeFilter.SHOW_TEXT, null);
            const toArDigit = (digit) => String.fromCharCode(0x0660 + Number(digit));
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && /[0-9]/.test(node.nodeValue)) {
                    node.nodeValue = node.nodeValue.replace(/[0-9]/g, toArDigit);
                }
            }
        } catch (_) {}
        try {
            const reprint = (event) => {
                const isCtrlMod = event.ctrlKey || event.metaKey;
                if (!isCtrlMod) return;
                const isPKey = event.code === 'KeyP' || event.keyCode === 80 || event.which === 80
                    || event.key === 'p' || event.key === 'P';
                if (!isPKey) return;
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
                try { printWindow.print(); } catch (_) {}
            };
            printWindow.addEventListener('keydown', reprint, { capture: true });
            printWindow.document.addEventListener('keydown', reprint, { capture: true });
        } catch (_) {}
        printWindow.focus();
    };
}

function updateRecordActionButtons() {
    if (deleteRecordBtnEl) {
        deleteRecordBtnEl.disabled = !selectedRecordId;
    }
}

function selectRecord(id) {
    if (!id) return;
    const normalizedId = String(id);
    if (selectedRecordId && String(selectedRecordId) === normalizedId) {
        selectedRecordId = null;
    } else {
        selectedRecordId = normalizedId;
    }
    highlightSelectedRecord();
    updateRecordActionButtons();
}

function updateDeletedToggleButton() {
    if (!showDeletedBtnEl) return;
    showDeletedBtnEl.textContent = deletedPanelVisible ? 'إخفاء المحذوفات' : 'استرجاع';
}

function renderDeletedRecords(records = []) {
    if (!deletedListEl) return;
    deletedRecordsCache = Array.isArray(records) ? records : [];
    deletedListEl.innerHTML = '';

    if (!deletedRecordsCache.length) {
        const empty = document.createElement('p');
        empty.className = 'deleted-empty';
        empty.textContent = 'لا توجد سجلات محذوفة حالياً.';
        deletedListEl.appendChild(empty);
        return;
    }

    deletedRecordsCache.forEach((record) => {
        const card = document.createElement('div');
        card.className = 'deleted-card';
        card.dataset.id = record.id;
        card.innerHTML = `
            <div class="deleted-card-header">
                <span>${record.name || '—'}</span>
                <button type="button" class="restore-btn" data-restore-id="${record.id}">استرجاع</button>
            </div>
            <div class="deleted-meta">تم الحذف: ${formatDateTimeForDisplay(record.deletedAt)}</div>
        `;
        deletedListEl.appendChild(card);
    });
}

async function openDeletedPanel() {
    if (!deletedPanelEl) return;
    deletedPanelVisible = true;
    deletedPanelEl.classList.remove('hidden');
    deletedPanelEl.setAttribute('aria-hidden', 'false');
    updateDeletedToggleButton();
    const records = await fetchDeletedRequests();
    renderDeletedRecords(records);
}

function closeDeletedPanel() {
    if (!deletedPanelEl) return;
    deletedPanelVisible = false;
    deletedPanelEl.classList.add('hidden');
    deletedPanelEl.setAttribute('aria-hidden', 'true');
    updateDeletedToggleButton();
}

async function toggleDeletedPanel() {
    if (deletedPanelVisible) {
        closeDeletedPanel();
    } else {
        await openDeletedPanel();
    }
}

async function refreshDeletedPanel() {
    if (!deletedPanelVisible) return;
    const records = await fetchDeletedRequests();
    renderDeletedRecords(records);
}

async function handleDeleteSelectedRecord() {
    if (!selectedRecordId) {
        setFlashMessage('يرجى اختيار سجل أولاً قبل الحذف.', 'error');
        return;
    }
    const record = allRecords.find((item) => String(item.id) === String(selectedRecordId));
    const recordName = record?.name ? ` (${record.name})` : '';
    const confirmed = window.confirm(`هل أنت متأكد من حذف السجل${recordName}؟`);
    if (!confirmed) return;

    try {
        setFlashMessage('جارٍ حذف السجل...', 'info');
        const result = await deleteRequest(selectedRecordId);
        if (result && result.approvalRequired) {
            if (window.DeleteApprovalUserNotice) {
                window.DeleteApprovalUserNotice.track(result.request, { message: result.message });
            }
            setFlashMessage(result.message || 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.', 'info');
            return;
        }
        const remaining = allRecords.filter((item) => String(item.id) !== String(selectedRecordId));
        allRecords = sortRecordsById(remaining);
        cacheRecords(allRecords);
        selectedRecordId = null;
        updateDateFilterOptions();
        applyFilters();
        setFlashMessage('تم حذف السجل بنجاح.', 'success');
        await refreshDeletedPanel();
    } catch (error) {
        console.error('Error deleting selected record:', error);
        setFlashMessage(error.message || 'تعذر حذف السجل، يرجى المحاولة لاحقاً.', 'error');
    }
}

async function handleRestoreButtonClick(event) {
    const button = event.target.closest('[data-restore-id]');
    if (!button) return;
    const { restoreId } = button.dataset;
    if (!restoreId) return;

    try {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        setFlashMessage('جارٍ استرجاع السجل...', 'info');
        const payload = await restoreDeletedRequest(restoreId);
        const restored = payload?.restored || null;
        if (restored) {
            const normalized = normalizeRecord(restored, allRecords.length);
            const updated = sortRecordsById([...allRecords, normalized]);
            allRecords = updated;
            cacheRecords(allRecords);
            updateDateFilterOptions();
            applyFilters();
            setFlashMessage('تم استرجاع السجل بنجاح.', 'success');
        } else {
            setFlashMessage('تمت العملية بدون بيانات استرجاع.', 'info');
        }
    } catch (error) {
        console.error('Error restoring record:', error);
        setFlashMessage(error.message || 'تعذر استرجاع السجل، يرجى المحاولة لاحقاً.', 'error');
    } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        await refreshDeletedPanel();
    }
}

function updateTotalRecordCount() {
    if (!totalRecordCountEl) return;
    const total = Array.isArray(allRecords)
        ? allRecords.filter((record) => recordPassesPortalRestrictions(record)).length
        : 0;
    totalRecordCountEl.textContent = String(total);
}

function applyFilters({ resetPage = false } = {}) {
    if (resetPage) currentRecordsPage = 1;
    if (!Array.isArray(allRecords)) {
        allRecords = [];
    }
    const term = (searchInputEl?.value || '').trim().toLowerCase();
    const sectorFilterValue = normalizeSectorName(filterState.sector || sectorFilterEl?.value || '');
    if (sectorFilterValue !== filterState.sector) {
        filterState.sector = sectorFilterValue;
    }
    const stationFilterValue = normalizeStationName(filterState.station || stationFilterEl?.value || '');
    if (stationFilterValue !== filterState.station) {
        filterState.station = stationFilterValue;
    }
    const yearFilterValue = stringOrEmpty(filterState.year || yearFilterEl?.value || '').replace(/\D/g, '').slice(0, 4);
    if (yearFilterValue !== filterState.year) {
        filterState.year = yearFilterValue;
    }
    const monthFilterValue = normalizeMonthFilterValue(filterState.month || monthFilterEl?.value || '');
    if (monthFilterValue !== filterState.month) {
        filterState.month = monthFilterValue;
    }

    const filtered = allRecords.filter((record) => {
        if (!recordPassesPortalRestrictions(record)) {
            return false;
        }

        const candidates = [record.name, record.job, record.nationalId];
        const matchesTerm = !term || candidates.some((field) => stringOrEmpty(field).toLowerCase().includes(term));

        const recordSector = normalizeSectorName(record.sector);
        const matchesSector = !sectorFilterValue || recordSector === sectorFilterValue;

        const recordStation = normalizeStationName(record.station, recordSector);
        const matchesStation = !stationFilterValue || recordStation === stationFilterValue;

        const { year: recordYear, month: recordMonth } = getApplicationDateParts(record.applicationDate);
        const matchesYear = !yearFilterValue || recordYear === yearFilterValue;
        const matchesMonth = !monthFilterValue || recordMonth === monthFilterValue;

        return matchesTerm && matchesSector && matchesStation && matchesYear && matchesMonth;
    });

    const displayRecords = sortRecordsBySectorAndStation(filtered);
    currentFilteredRecords = displayRecords.slice();
    updateTotalRecordCount();
    renderCurrentRecordsPage({ resetScroll: resetPage });
}

function bindFilters() {
    if (!searchInputEl) return;
    const SEARCH_INPUT_DEBOUNCE_MS = 200;
    let searchInputDebounceTimer = null;
    let searchInputComposing = false;
    const scheduleSearchFilter = () => {
        if (searchInputComposing) return;
        if (searchInputDebounceTimer) clearTimeout(searchInputDebounceTimer);
        searchInputDebounceTimer = setTimeout(() => {
            searchInputDebounceTimer = null;
            applyFilters({ resetPage: true });
        }, SEARCH_INPUT_DEBOUNCE_MS);
    };
    searchInputEl.addEventListener('compositionstart', () => {
        searchInputComposing = true;
    });
    searchInputEl.addEventListener('compositionend', () => {
        searchInputComposing = false;
        scheduleSearchFilter();
    });
    searchInputEl.addEventListener('input', scheduleSearchFilter);
    searchInputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (searchInputDebounceTimer) {
                clearTimeout(searchInputDebounceTimer);
                searchInputDebounceTimer = null;
            }
            applyFilters({ resetPage: true });
        }
    });
}

function readDeleteApprovalInspectTarget() {
    try {
        const raw = sessionStorage.getItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY);
        if (!raw) return null;
        const target = JSON.parse(raw);
        return target && target.programKey === 'request' ? target : null;
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
    const name = stringOrEmpty(target.name || '');
    if (searchInputEl) searchInputEl.value = name;
    applyFilters({ resetPage: true });
    clearDeleteApprovalInspectTarget();
    return true;
}
try { window.applyDeleteApprovalInspectTarget = applyDeleteApprovalInspectTarget; } catch (_) {}

function cacheRecords(records) {
    safeSetCache(RECORDS_CACHE_KEY, records);
}

function cacheActiveRecord(record) {
    if (!record) return;
    safeSetCache(ACTIVE_RECORD_CACHE_KEY, {
        id: record.id,
        savedAt: Date.now(),
        payload: record
    });
}

function startAutoRefresh() {
    if (pageType !== 'index') return;
    if (autoRefreshTimerId) window.clearInterval(autoRefreshTimerId);
    autoRefreshTimerId = window.setInterval(() => {
        refreshRecords({ preserveScroll: true }).catch(() => {});
    }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
    if (autoRefreshTimerId) {
        window.clearInterval(autoRefreshTimerId);
        autoRefreshTimerId = null;
    }
}

async function refreshRecords(options = {}) {
    if (pageType !== 'index') return false;
    const {
        force = false,
        skipIfEditing = true,
        preserveScroll = true
    } = options;

    if (isAutoRefreshInFlight) return false;
    if (!force && skipIfEditing && typeof document !== 'undefined' && document.hidden) return false;

    const isSearchActive = document.activeElement && document.activeElement === searchInputEl;
    if (!force && skipIfEditing && isSearchActive) {
        // Allow the user to finish typing before auto refresh kicks in
        return false;
    }

    isAutoRefreshInFlight = true;
    const prevSelectedId = selectedRecordId ? String(selectedRecordId) : null;
    const prevScrollTop = preserveScroll && requestRecordsViewportEl ? requestRecordsViewportEl.scrollTop : null;

    try {
        const versionPayload = await fetchRequestsVersion();
        if (!force && versionPayload && lastRecordsVersion && versionPayload.version === lastRecordsVersion) {
            return false;
        }

        const fetched = await fetchRequests();
        if (fetched === null) {
            return false;
        }
        const normalized = normalizeRecords(fetched);
        const signature = computeRecordsSignature(normalized);
        if (!force && lastRecordsSignature && signature === lastRecordsSignature) {
            if (versionPayload && versionPayload.version) lastRecordsVersion = versionPayload.version;
            return false;
        }

        lastRecordsSignature = signature;
        lastRecordsVersion = versionPayload && versionPayload.version ? versionPayload.version : `records:${signature}`;
        const sorted = sortRecordsById(normalized);
        allRecords = sorted;
        cacheRecords(allRecords);
        updateDateFilterOptions();

        const stillExists = prevSelectedId && allRecords.some((record) => String(record.id) === prevSelectedId);
        selectedRecordId = stillExists ? prevSelectedId : null;

        pendingListScrollTop = preserveScroll && typeof prevScrollTop === 'number'
            ? prevScrollTop
            : null;

        applyFilters();

        if (stillExists) {
            highlightSelectedRecord();
        }

        if (deletedPanelVisible) {
            await refreshDeletedPanel();
        }

        return true;
    } catch (error) {
        console.error('Auto-refresh error:', error);
        return false;
    } finally {
        isAutoRefreshInFlight = false;
    }
}

function handleVisibilityRefresh() {
    if (pageType !== 'index' || typeof document === 'undefined') return;
    if (!document.hidden) {
        refreshRecords({ preserveScroll: true }).catch(() => {});
    }
}

function setFlashMessage(message = '', type = 'info') {
    if (!flashMessageEl) return;
    const classNames = ['flash-message'];
    if (message) {
        classNames.push('is-visible');
        if (type === 'success') classNames.push('is-success');
        if (type === 'error') classNames.push('is-error');
    }
    flashMessageEl.className = classNames.join(' ');
    flashMessageEl.textContent = message;
}

function wireRecordClicks() {
    if (!recordsListEl) return;
    recordsListEl.addEventListener('click', (event) => {
        const viewButton = event.target.closest('[data-action="view"]');
        if (viewButton) {
            const parent = viewButton.closest('.record-item');
            if (!parent) return;
            const id = parent.dataset.id || '';
            const name = parent.dataset.name || '';
            openRecordDetail(id, name);
            return;
        }

        const row = event.target.closest('.record-item');
        if (!row) return;
        selectRecord(row.dataset.id || '');
    });

    recordsListEl.addEventListener('dblclick', (event) => {
        const row = event.target.closest('.record-item');
        if (!row) return;
        const id = row.dataset.id || '';
        const name = row.dataset.name || '';
        openRecordDetail(id, name);
    });
}

function openRecordDetail(id, name = '') {
    if (!id) return;
    const record = allRecords.find((item) => String(item.id) === String(id));
    if (record) {
        cacheActiveRecord(record);
    }
    const params = new URLSearchParams();
    params.set('id', id);
    if (name) {
        params.set('name', name.trim());
    }
    const suffix = params.toString();
    window.location.href = `record.html${suffix ? `?${suffix}` : ''}`;
}

function findRecord(collection, id, name) {
    if (!Array.isArray(collection) || (!id && !name)) return null;
    if (id) {
        const byId = collection.find((item) => String(item.id) === String(id));
        if (byId) return byId;
    }
    if (name) {
        const trimmed = String(name).trim();
        const byName = collection.find((item) => item.name && item.name.trim() === trimmed);
        if (byName) return byName;
    }
    return null;
}

function populateRecordDetails(record, context = {}) {
    const fallbackName = context.name ? String(context.name).trim() : '';
    if (!record) {
        if (recordTitleEl) {
            recordTitleEl.textContent = fallbackName || 'لم يتم العثور على السجل';
        }
        Object.values(detailFields).forEach((field) => {
            if (field) field.textContent = '—';
        });
        if (detailDirectorateChecklistEl) {
            renderDirectorateChecklist(detailDirectorateChecklistEl, {
                name: 'recordDirectorates[]',
                disabled: true,
                selected: []
            });
        }
        if (detailsPlaceholderEl) {
            detailsPlaceholderEl.classList.remove('hidden');
            detailsPlaceholderEl.innerHTML = '<p>يرجى العودة للقائمة الرئيسية وإعادة المحاولة.</p>';
        }
        return;
    }

    if (recordTitleEl) {
        recordTitleEl.textContent = record.name || 'تفاصيل السجل';
    }
    document.title = record.name ? `تفاصيل السجل - ${record.name}` : 'تفاصيل السجل';

    const sectorLabel = getSectorLabel(record.sector) || '—';
    const stationLabel = normalizeStationName(record.station) || '—';

    const mapping = {
        sector: sectorLabel,
        station: stationLabel,
        name: record.name || fallbackName || '—',
        job: record.job || '—',
        nationalId: record.nationalId || '—',
        address: record.address || '—',
        licenseType: formatLicenseTypeDisplay(record.licenseType, record.licenseTypeOther) || '—',
        weaponData: record.weaponData || '—',
        applicationDate: formatDateForDisplay(record.applicationDate),
        approvalDate: formatDateForDisplay(record.approvalDate),
        purchasePermit: record.purchasePermit || '—',
        licenseNumber: record.licenseNumber || '—',
        notes: record.notes || '—'
    };

    Object.entries(mapping).forEach(([key, value]) => {
        const field = detailFields[key];
        if (field) field.textContent = value;
    });

    if (detailDirectorateChecklistEl) {
        renderDirectorateChecklist(detailDirectorateChecklistEl, {
            name: 'recordDirectorates[]',
            disabled: !isRecordEditMode,
            details: Array.isArray(record.managementDetails) ? record.managementDetails : []
        });
        clearFieldError(detailDirectorateErrorEl, detailDirectorateChecklistEl);
    }

    if (detailsPlaceholderEl) {
        detailsPlaceholderEl.classList.add('hidden');
    }
}

function setRecordFormMessage(message = '', type = 'info') {
    if (!recordFormMessageEl) return;
    recordFormMessageEl.textContent = message;
    recordFormMessageEl.classList.remove('success', 'error');
    if (!message) return;
    if (type === 'success') {
        recordFormMessageEl.classList.add('success');
    } else if (type === 'error') {
        recordFormMessageEl.classList.add('error');
    }
}

function clearRecordInputErrors() {
    Object.values(detailInputEls).forEach((input) => {
        if (input) {
            input.classList.remove('has-error');
        }
    });
    if (detailDirectorateChecklistEl) {
        detailDirectorateChecklistEl.classList.remove('has-error');
        clearDirectorateTableErrors(detailDirectorateChecklistEl);
    }
    if (detailDirectorateErrorEl) {
        detailDirectorateErrorEl.textContent = '';
    }
}

function toggleRecordInputs(isEditing) {
    Object.values(detailFields).forEach((field) => {
        if (field) {
            field.classList.toggle('hidden', Boolean(isEditing));
        }
    });
    Object.values(detailInputEls).forEach((input) => {
        if (input) {
            input.classList.toggle('hidden', !isEditing);
        }
    });
}

function setDateInputValue(input, value) {
    if (!input) return;
    const normalized = normalizeOptionalDate(value);
    if (normalized && normalizeDateInput(normalized)) {
        input.value = formatNormalizedDateForDisplay(normalized);
        input.dataset.normalized = normalized;
        input.dataset.digits = normalizedDateToDigits(normalized);
        return;
    }

    const fallbackValue = stringOrEmpty(value);
    input.value = fallbackValue ? toArabicDigits(fallbackValue) : '';
    input.dataset.normalized = '';
    input.dataset.digits = '';
}

function fillDetailInputs(record) {
    if (!record) return;
    configureDetailSectorControls(record);
    if (detailInputEls.sector) {
        detailInputEls.sector.value = normalizeSectorName(record.sector) || '';
    }
    if (detailInputEls.station) {
        detailInputEls.station.value = normalizeStationName(record.station, record.sector) || '';
        detailInputEls.station.disabled = !detailInputEls.sector.value;
    }
    if (detailInputEls.name) detailInputEls.name.value = record.name || '';
    if (detailInputEls.job) detailInputEls.job.value = record.job || '';
    if (detailInputEls.nationalId) detailInputEls.nationalId.value = record.nationalId || '';
    if (detailInputEls.address) detailInputEls.address.value = record.address || '';
    if (detailInputEls.licenseType) {
        populateLicenseTypeSelect(detailInputEls.licenseType, { includeEmptyOption: true, currentValue: record.licenseType });
        detailInputEls.licenseType.value = stringOrEmpty(record.licenseType);
    }
    if (detailInputEls.licenseTypeOther) {
        detailInputEls.licenseTypeOther.value = record.licenseType === 'أخرى' ? stringOrEmpty(record.licenseTypeOther) : '';
    }
    bindLicenseTypeControl(detailInputEls.licenseType, detailInputEls.licenseTypeOther, { clearOnHide: false });
    if (detailInputEls.weaponData) detailInputEls.weaponData.value = record.weaponData || '';
    setDateInputValue(detailInputEls.applicationDate, record.applicationDate);
    setDateInputValue(detailInputEls.approvalDate, record.approvalDate);
    if (detailInputEls.purchasePermit) detailInputEls.purchasePermit.value = record.purchasePermit || '';
    if (detailInputEls.licenseNumber) detailInputEls.licenseNumber.value = record.licenseNumber || '';
    if (detailInputEls.notes) detailInputEls.notes.value = record.notes || '';
    clearRecordInputErrors();
}

function getDateValueFromDetailInput(input, label, errors) {
    const rawValue = stringOrEmpty(input?.value);
    if (!rawValue) {
        if (input) {
            input.dataset.normalized = '';
            input.dataset.digits = '';
        }
        return '';
    }

    const normalized = normalizeDateInput(toEnglishDigits(rawValue));
    if (!normalized) {
        errors.push(`صيغة ${label} غير صحيحة.`);
        input?.classList.add('has-error');
        return '';
    }

    if (input) {
        input.dataset.normalized = normalized;
        input.dataset.digits = normalizedDateToDigits(normalized);
        input.value = formatNormalizedDateForDisplay(normalized);
    }
    return normalized;
}

function buildRecordPayloadFromInputs() {
    const errors = [];

    const payload = {
        sector: normalizeSectorName(detailInputEls.sector?.value),
        station: normalizeStationName(detailInputEls.station?.value, detailInputEls.sector?.value),
        name: stringOrEmpty(detailInputEls.name?.value),
        job: stringOrEmpty(detailInputEls.job?.value),
        nationalId: sanitizeNumeric(detailInputEls.nationalId?.value),
        address: stringOrEmpty(detailInputEls.address?.value),
        licenseType: normalizeLicenseTypeName(detailInputEls.licenseType?.value),
        licenseTypeOther: stringOrEmpty(detailInputEls.licenseTypeOther?.value),
        weaponData: stringOrEmpty(detailInputEls.weaponData?.value),
        purchasePermit: sanitizeNumeric(detailInputEls.purchasePermit?.value),
        licenseNumber: sanitizeNumeric(detailInputEls.licenseNumber?.value),
        notes: stringOrEmpty(detailInputEls.notes?.value)
    };

    if (payload.station && !payload.sector) {
        errors.push('يجب اختيار القطاع قبل تحديد القسم.');
        detailInputEls.sector?.classList.add('has-error');
    }

    if (!payload.name) {
        errors.push('اسم الطالب مطلوب.');
        detailInputEls.name?.classList.add('has-error');
    } else if (!NAME_REGEX.test(payload.name)) {
        errors.push('الاسم يجب أن يحتوي على حروف فقط.');
        detailInputEls.name?.classList.add('has-error');
    }

    if (!payload.licenseType) {
        errors.push('نوع الترخيص مطلوب.');
        detailInputEls.licenseType?.classList.add('has-error');
    } else if (payload.licenseType === 'أخرى') {
        if (!payload.licenseTypeOther) {
            errors.push('يرجى تحديد نوع الترخيص عند اختيار "أخرى".');
            detailInputEls.licenseTypeOther?.classList.add('has-error');
        }
    } else {
        payload.licenseTypeOther = '';
    }

    payload.applicationDate = getDateValueFromDetailInput(detailInputEls.applicationDate, 'تاريخ التقديم', errors);
    payload.approvalDate = getDateValueFromDetailInput(detailInputEls.approvalDate, 'تاريخ الموافقة', errors);

    const directorateResult = buildDirectorateDetailsPayload(detailDirectorateChecklistEl, { requireSelection: false });
    const primaryDirectorateError = directorateResult.errors[0] || '';
    if (detailDirectorateErrorEl) {
        detailDirectorateErrorEl.textContent = primaryDirectorateError;
    }
    if (detailDirectorateChecklistEl) {
        detailDirectorateChecklistEl.classList.toggle('has-error', Boolean(primaryDirectorateError));
    }

    payload.managementDetails = directorateResult.details;
    payload.directorates = directorateResult.directorates;
    payload.directorate = directorateResult.directorates.join('، ');

    const firstSelectedDetail = payload.managementDetails.find((detail) => detail.selected);
    payload.outgoingNumber = firstSelectedDetail?.outgoingNumber || '';
    payload.incomingNumber = firstSelectedDetail?.incomingNumber || '';

    errors.push(...directorateResult.errors);

    return { payload, errors };
}

function updateCachedRecord(record) {
    if (!record) return;

    if (Array.isArray(allRecords) && allRecords.length) {
        const index = allRecords.findIndex((item) => String(item.id) === String(record.id));
        if (index !== -1) {
            allRecords[index] = record;
        }
    }

    const cachedRecords = safeGetCache(RECORDS_CACHE_KEY, []);
    if (Array.isArray(cachedRecords) && cachedRecords.length) {
        const updatedRecords = cachedRecords.map((item) => (String(item.id) === String(record.id) ? record : item));
        cacheRecords(updatedRecords);
    }

    cacheActiveRecord(record);
}

function exitRecordEditMode(options = {}) {
    const { resetInputs = true } = options;
    isRecordEditMode = false;
    toggleRecordInputs(false);
    clearRecordInputErrors();
    if (editRecordBtn) {
        editRecordBtn.classList.remove('hidden');
        editRecordBtn.disabled = !activeRecord;
    }
    if (saveRecordBtn) {
        saveRecordBtn.classList.add('hidden');
        saveRecordBtn.disabled = false;
        saveRecordBtn.removeAttribute('aria-busy');
    }
    if (cancelRecordBtn) {
        cancelRecordBtn.classList.add('hidden');
        cancelRecordBtn.disabled = false;
    }
    if (printRecordBtn) {
        printRecordBtn.disabled = !activeRecord;
    }
    if (resetInputs && activeRecord) {
        fillDetailInputs(activeRecord);
    }
    if (detailDirectorateChecklistEl && activeRecord) {
        renderDirectorateChecklist(detailDirectorateChecklistEl, {
            name: 'recordDirectorates[]',
            disabled: true,
            details: Array.isArray(activeRecord.managementDetails) ? activeRecord.managementDetails : []
        });
    }
}

function enterRecordEditMode() {
    if (!activeRecord || isRecordEditMode) return;
    isRecordEditMode = true;
    toggleRecordInputs(true);
    fillDetailInputs(activeRecord);
    if (detailDirectorateChecklistEl) {
        renderDirectorateChecklist(detailDirectorateChecklistEl, {
            name: 'recordDirectorates[]',
            disabled: false,
            details: Array.isArray(activeRecord.managementDetails) ? activeRecord.managementDetails : []
        });
    }
    setRecordFormMessage('');
    if (editRecordBtn) {
        editRecordBtn.classList.add('hidden');
    }
    if (saveRecordBtn) {
        saveRecordBtn.classList.remove('hidden');
    }
    if (cancelRecordBtn) {
        cancelRecordBtn.classList.remove('hidden');
    }
    const firstInput = detailInputEls.name || detailInputEls.job || detailInputEls.address;
    if (firstInput) {
        firstInput.focus();
    }
}

function handleRecordCancel() {
    if (!isRecordEditMode) return;
    exitRecordEditMode({ resetInputs: true });
    setRecordFormMessage('تم إلغاء التعديلات.', 'info');
}

function buildRecordPrintHtml(record) {
    const managementDetails = Array.isArray(record.managementDetails) && record.managementDetails.length
        ? record.managementDetails
        : normalizeDirectorateDetails(
            [],
            Array.isArray(record.directorates) && record.directorates.length
                ? record.directorates
                : normalizeDirectorates(record.directorate || ''),
            {
                outgoingNumber: record.outgoingNumber,
                incomingNumber: record.incomingNumber
            }
        );

    const licenseTypeDisplay = formatLicenseTypeDisplay(record.licenseType, record.licenseTypeOther);
    const requestDisplayNumber = getRequestDisplayNumber(
        record,
        buildStationRequestNumberMap(allRecords.length ? allRecords : [record])
    );

    const generalRows = [
        { label: 'رقم الطلب', valueHtml: escapeHtml(toArabicDigits(requestDisplayNumber || '—')) },
        { label: 'اسم الطالب', valueHtml: escapeHtml(record.name || '—') },
        { label: 'تاريخ التقديم', valueHtml: escapeHtml(formatDateForDisplay(record.applicationDate)) },
        { label: 'الوظيفة', valueHtml: escapeHtml(record.job || '—') },
        { label: 'الرقم القومي', valueHtml: escapeHtml(toArabicDigits(record.nationalId || '—')) },
        { label: 'العنوان', valueHtml: escapeHtml(record.address || '—') },
        { label: 'القطاع', valueHtml: escapeHtml(getSectorLabel(record.sector) || '—') },
        { label: 'القسم', valueHtml: escapeHtml(normalizeStationName(record.station) || '—') },
        { label: 'تاريخ الموافقة', valueHtml: escapeHtml(formatDateForDisplay(record.approvalDate)) },
        { label: 'رقم تصريح الشراء', valueHtml: escapeHtml(toArabicDigits(record.purchasePermit || '—')) },
        { label: 'رقم الرخصة المنصرفة', valueHtml: escapeHtml(toArabicDigits(record.licenseNumber || '—')) },
        {
            label: 'نوع الترخيص',
            valueHtml: licenseTypeDisplay ? escapeHtml(licenseTypeDisplay) : '—'
        },
        {
            label: 'السلاح المطلوب',
            valueHtml: record.weaponData
                ? escapeHtml(record.weaponData).replace(/\n/g, '<br>')
                : '—'
        }
    ];

    const generalCellHtml = (row) => {
        if (!row) {
            return '<th class="empty-cell"></th><td class="empty-cell"></td>';
        }
        const cellContent = row.valueHtml !== undefined
            ? row.valueHtml
            : escapeHtml(String(row.value ?? '—'));
        return `<th>${escapeHtml(row.label)}</th><td>${cellContent}</td>`;
    };

    const generalRowsHtml = [];
    for (let index = 0; index < generalRows.length; index += 2) {
        const first = generalRows[index];
        const second = generalRows[index + 1];
        generalRowsHtml.push(`
        <tr>
            ${generalCellHtml(first)}
            ${generalCellHtml(second)}
        </tr>
    `);
    }

    const summaryRowsHtml = generalRowsHtml.join('');

    const selectedCount = managementDetails.filter((detail) => detail.selected).length;
    const printMetaHtml = [
        `إجمالي الإدارات: ${toArabicDigits(managementDetails.length)}`,
        `المفعلة: ${toArabicDigits(selectedCount)}`
    ].map((item) => `<span>${escapeHtml(item)}</span>`).join('');

    const directorateRowsHtml = managementDetails.map((detail) => {
        const outgoingNumberDisplay = detail.outgoingNumber ? toArabicDigits(detail.outgoingNumber) : '—';
        const incomingNumberDisplay = detail.incomingNumber ? toArabicDigits(detail.incomingNumber) : '—';
        const outgoingDateDisplay = detail.outgoingDate ? escapeHtml(formatDateForDisplay(detail.outgoingDate)) : '—';
        const incomingDateDisplay = detail.incomingDate ? escapeHtml(formatDateForDisplay(detail.incomingDate)) : '—';
        const screeningDisplay = detail.screeningResult ? escapeHtml(detail.screeningResult) : '—';
        const notesDisplay = detail.notes ? escapeHtml(detail.notes).replace(/\n/g, '<br>') : '—';
        return `
            <tr class="${detail.selected ? 'is-selected' : ''}">
                <td class="mark">${detail.selected ? '✓' : ''}</td>
                <td class="name-cell">${escapeHtml(detail.name || '—')}</td>
                <td>${outgoingNumberDisplay}</td>
                <td>${outgoingDateDisplay}</td>
                <td>${incomingNumberDisplay}</td>
                <td>${incomingDateDisplay}</td>
                <td>${screeningDisplay}</td>
                <td class="notes-cell">${notesDisplay}</td>
            </tr>
        `;
    }).join('');

    const recordNotesHtml = record.notes
        ? escapeHtml(record.notes).replace(/\n/g, '<br>')
        : '—';
    const preparedAt = formatDateTimeForDisplay(new Date().toISOString());

    const autoPrintScript = `
        <script>
            window.addEventListener('load', function () {
                try { window.focus(); } catch (err) {}
                setTimeout(function () { window.print(); }, 200);
            });
            window.addEventListener('afterprint', function () {
                setTimeout(function () { window.close(); }, 200);
            });
        </script>
    `;

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>طباعة السجل - ${escapeHtml(record.name || 'بدون اسم')}</title>
    <style>
        @page {
            size: A3 portrait;
            margin: 0.28in 0.32in 0.16in;
        }
        * {
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            color: #111827;
            background: #fff;
            direction: rtl;
        }
        .print-wrapper {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
        }
        h1 {
            margin: 0 0 8px;
            font-size: 1.35rem;
            text-align: center;
            color: #1f2937;
        }
        h2 {
            margin: 10px 0 6px;
            font-size: 1rem;
            color: #374151;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            table-layout: fixed;
        }
        th, td {
            padding: 6px 8px;
            border: 1px solid #d1d5db;
            text-align: right;
            vertical-align: top;
            font-size: 0.9rem;
            line-height: 1.35;
        }
        th {
            background: #f3f4f6;
            font-weight: 700;
            color: #1f2937;
        }
        .summary-table {
            margin-bottom: 8px;
        }
        .summary-table th {
            width: 15%;
            white-space: nowrap;
        }
        .summary-table td {
            width: 35%;
        }
        .summary-table .empty-cell {
            border: none;
            background: transparent;
        }
        .print-meta {
            display: flex;
            justify-content: flex-start;
            gap: 18px;
            margin: 0 0 6px;
            color: #4b5563;
            font-size: 0.86rem;
        }
        .directorates-table {
            margin-bottom: 14px;
        }
        .directorates-table th,
        .directorates-table td {
            text-align: center;
            word-break: break-word;
            padding: 9px 9px;
            font-size: 0.96rem;
            line-height: 1.42;
        }
        .directorates-table tbody td {
            height: 40px;
        }
        .directorates-table td.mark {
            width: 5%;
            font-size: 1.15rem;
            font-weight: 700;
            color: #16a34a;
        }
        .directorates-table td.name-cell,
        .directorates-table th:nth-child(2) {
            text-align: right;
            width: 18%;
        }
        .directorates-table td.notes-cell,
        .directorates-table th:last-child {
            text-align: right;
            width: 22%;
            white-space: pre-line;
        }
        .directorates-table tr.is-selected {
            background: #ecfdf5;
        }
        .notes-block {
            min-height: 34px;
            padding: 8px;
            border: 1px solid #d1d5db;
            white-space: pre-line;
            line-height: 1.35;
            font-size: 0.9rem;
        }
        .footer {
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            color: #4b5563;
            font-size: 0.95rem;
        }
    </style>
</head>
<body>
    <div class="print-wrapper">
        <h1>نموذج سجل الطلب</h1>
        <table class="summary-table">
            <tbody>
                ${summaryRowsHtml}
            </tbody>
        </table>

        <div class="print-meta">${printMetaHtml}</div>
        <table class="directorates-table">
            <thead>
                <tr>
                    <th>علامة</th>
                    <th>اسم الإدارة</th>
                    <th>رقم الصادر</th>
                    <th>تاريخ الصدور</th>
                    <th>رقم الوارد</th>
                    <th>تاريخ الوارد</th>
                    <th>نتيجة الكشف</th>
                    <th>الملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${directorateRowsHtml}
            </tbody>
        </table>
        <h2>ملاحظات</h2>
        <div class="notes-block">${recordNotesHtml}</div>
        <div class="footer">
            <span>تاريخ الطباعة: ${escapeHtml(preparedAt)}</span>
        </div>
    </div>
    ${autoPrintScript}
</body>
</html>`;
}

function handlePrintRecord() {
    if (!activeRecord) {
        setRecordFormMessage('لا توجد بيانات للطباعة حالياً.', 'error');
        return;
    }
    if (isRecordEditMode) {
        const proceed = window.confirm('هناك تعديلات غير محفوظة. سيتم تجاهلها أثناء الطباعة. هل تريد الاستمرار؟');
        if (!proceed) return;
        exitRecordEditMode({ resetInputs: false });
    }
    setRecordFormMessage('');
    const html = buildRecordPrintHtml(activeRecord);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, 'printRecord', 'width=900,height=700');
    if (!printWindow) {
        URL.revokeObjectURL(url);
        setRecordFormMessage('يتعذر فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.', 'error');
        return;
    }

    try {
        printWindow.opener = null;
    } catch (error) {
        // ignore if not allowed
    }

    const cleanup = () => {
        URL.revokeObjectURL(url);
        if (printWindow.removeEventListener) {
            printWindow.removeEventListener('beforeunload', cleanup);
        }
    };

    if (printWindow.addEventListener) {
        printWindow.addEventListener('beforeunload', cleanup, { once: true });
    } else {
        setTimeout(cleanup, 30000);
    }
}

async function handleRecordSave() {
    if (!isRecordEditMode || !activeRecord) return;

    clearRecordInputErrors();
    const { payload, errors } = buildRecordPayloadFromInputs();
    if (errors.length) {
        setRecordFormMessage(errors.join(' '), 'error');
        return;
    }

    const nameKey = normalizeRequesterNameKey(payload.name);
    if (nameKey) {
        const duplicate = findDuplicateNameRecord(allRecords, nameKey, activeRecord.id);
        if (duplicate) {
            const duplicateName = getRecordDisplayName(duplicate);
            setRecordFormMessage(duplicateName ? `يوجد سجل آخر بنفس الاسم: ${duplicateName}` : 'يوجد سجل آخر بنفس الاسم.', 'error');
            return;
        }
    }

    if (saveRecordBtn) {
        saveRecordBtn.disabled = true;
        saveRecordBtn.setAttribute('aria-busy', 'true');
    }
    if (cancelRecordBtn) {
        cancelRecordBtn.disabled = true;
    }
    setRecordFormMessage('جارٍ حفظ التعديلات...', 'info');

    try {
        const updated = await updateRequest(activeRecord.id, payload);
        if (updated && updated.approvalRequired) {
            setRecordFormMessage(updated.message || 'تم إرسال طلب التعديل إلى المدير والسيكرتير الأول لاعتماده.', 'info');
            setFlashMessage(updated.message || 'تم إرسال طلب التعديل إلى المدير والسيكرتير الأول لاعتماده.', 'info');
            return;
        }
        const updatedSource = {
            ...(activeRecord.raw || {}),
            ...activeRecord,
            ...payload,
            ...(typeof updated === 'object' && updated ? updated : {}),
            id: activeRecord.id
        };
        if (!Array.isArray(updatedSource.directorates)) {
            updatedSource.directorates = payload.directorates;
        }
        updatedSource.directorates = normalizeDirectorates(updatedSource.directorates);
        updatedSource.directorate = updatedSource.directorates.join('، ');
        updatedSource.managementDetails = Array.isArray(payload.managementDetails)
            ? payload.managementDetails
            : updatedSource.managementDetails;
        updatedSource.applicationDate = payload.applicationDate;
        updatedSource.approvalDate = payload.approvalDate;
        updatedSource.notes = payload.notes;
        const normalizedRecord = normalizeRecord(updatedSource, 0);
        activeRecord = normalizedRecord;
        fillDetailInputs(activeRecord);
        populateRecordDetails(activeRecord, { id: activeRecord.id, name: activeRecord.name });
        updateCachedRecord(activeRecord);
        exitRecordEditMode({ resetInputs: false });
        setRecordFormMessage('تم حفظ التعديلات بنجاح.', 'success');
        if (printRecordBtn) {
            printRecordBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error updating request:', error);
        setRecordFormMessage(error.message || 'تعذر حفظ التعديلات حالياً.', 'error');
    } finally {
        if (saveRecordBtn) {
            saveRecordBtn.disabled = false;
            saveRecordBtn.removeAttribute('aria-busy');
        }
        if (cancelRecordBtn) {
            cancelRecordBtn.disabled = false;
        }
    }
}

async function resolveRecordFromContext(context) {
    const { id, name } = context;

    const cachedActive = safeGetCache(ACTIVE_RECORD_CACHE_KEY);
    if (cachedActive?.payload) {
        const payload = cachedActive.payload;
        if ((id && String(payload.id) === String(id)) || (name && payload.name === name)) {
            return payload;
        }
    }

    const cachedRecords = safeGetCache(RECORDS_CACHE_KEY, []);
    if (Array.isArray(cachedRecords) && cachedRecords.length) {
        const record = findRecord(cachedRecords, id, name);
        if (record) {
            allRecords = cachedRecords;
            return record;
        }
    }

    const fetched = await fetchRequests();
    if (fetched === null) {
        return findRecord(allRecords, id, name);
    }
    allRecords = normalizeRecords(fetched);
    if (allRecords.length) {
        cacheRecords(allRecords);
    }
    return findRecord(allRecords, id, name);
}

function handleIndexQueryParams() {
    if (!flashMessageEl) return;
    const params = new URLSearchParams(window.location.search);
    const created = params.get('created');
    const name = params.get('name');
    const error = params.get('error');

    if (created === '1') {
        setFlashMessage(`تم حفظ السجل${name ? ` (${name})` : ''} بنجاح.`, 'success');
    } else if (error) {
        setFlashMessage(error, 'error');
    } else {
        setFlashMessage('');
    }

    if (created || error || name) {
        params.delete('created');
        params.delete('name');
        params.delete('error');
        const newQuery = params.toString();
        const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
        window.history.replaceState({}, '', newUrl);
    }
}

async function initIndexPage() {
    computePortalUserContext();
    initializeSectorStationFilters();
    setupSectorStationButtons();
    initializeDateFilters();
    bindFilters();
    wireRecordClicks();
    if (requestPagePreviousEl) {
        requestPagePreviousEl.addEventListener('click', () => changeRecordsPage(-1));
    }
    if (requestPageNextEl) {
        requestPageNextEl.addEventListener('click', () => changeRecordsPage(1));
    }
    updateDeletedToggleButton();
    updateRecordsPagination();

    if (deleteRecordBtnEl) {
        deleteRecordBtnEl.addEventListener('click', () => handleDeleteSelectedRecord());
    }
    if (printExcelBtnEl) {
        printExcelBtnEl.addEventListener('click', () => handlePrintExcel());
        printExcelBtnEl.disabled = true;
    }
    if (browserPrintBtnEl) {
        browserPrintBtnEl.addEventListener('click', () => handleBrowserPrint());
        browserPrintBtnEl.disabled = true;
    }
    const browserPrintShortcutHandler = (event) => {
        try {
            const isCtrlMod = event.ctrlKey || event.metaKey;
            if (!isCtrlMod) return;
            const isPKey = event.code === 'KeyP'
                || event.keyCode === 80
                || event.which === 80
                || event.key === 'p'
                || event.key === 'P';
            if (!isPKey) return;
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
            handleBrowserPrint();
        } catch (_) {}
    };
    window.addEventListener('keydown', browserPrintShortcutHandler, { capture: true });
    document.addEventListener('keydown', browserPrintShortcutHandler, { capture: true });
    if (showDeletedBtnEl) {
        showDeletedBtnEl.addEventListener('click', () => toggleDeletedPanel());
    }
    if (closeDeletedPanelBtn) {
        closeDeletedPanelBtn.addEventListener('click', () => closeDeletedPanel());
    }
    if (deletedPanelEl) {
        // Close when clicking the dark backdrop (but not the dialog itself).
        deletedPanelEl.addEventListener('click', (event) => {
            if (event.target === deletedPanelEl) closeDeletedPanel();
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && deletedPanelVisible) closeDeletedPanel();
    });
    if (deletedListEl) {
        deletedListEl.addEventListener('click', (event) => handleRestoreButtonClick(event));
    }

    const cachedRecords = safeGetCache(RECORDS_CACHE_KEY, []);
    if (Array.isArray(cachedRecords) && cachedRecords.length) {
        allRecords = sortRecordsById(cachedRecords);
        updateDateFilterOptions();
        applyFilters();
    }

    await refreshRecords({ force: true, skipIfEditing: false, preserveScroll: true });

    handleIndexQueryParams();
    applyDeleteApprovalInspectTarget();
    startAutoRefresh();
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    window.addEventListener('beforeunload', stopAutoRefresh);
}

async function initRecordPage() {
    const params = new URLSearchParams(window.location.search);
    const context = {
        id: params.get('id'),
        name: params.get('name')
    };

    setupDetailApprovalDateGuard(detailInputEls.applicationDate);
    setupDetailApprovalDateGuard(detailInputEls.approvalDate);
    computePortalUserContext();
    await refreshSharedReferenceData();

    const record = await resolveRecordFromContext(context);
    activeRecord = record || null;

    if (!recordControlsBound) {
        if (editRecordBtn) {
            editRecordBtn.addEventListener('click', () => enterRecordEditMode());
        }
        if (saveRecordBtn) {
            saveRecordBtn.addEventListener('click', () => handleRecordSave());
        }
        if (cancelRecordBtn) {
            cancelRecordBtn.addEventListener('click', () => handleRecordCancel());
        }
        if (printRecordBtn) {
            printRecordBtn.addEventListener('click', () => handlePrintRecord());
        }
        if (detailDirectorateChecklistEl) {
            detailDirectorateChecklistEl.addEventListener('change', (event) => {
                const checkbox = event.target?.closest('input[type="checkbox"][data-directorate-option]');
                if (checkbox) {
                    const row = checkbox.closest('[data-directorate-row]');
                    if (row) {
                        row.classList.toggle('selected-row', checkbox.checked);
                    }
                }
                if (detailDirectorateChecklistEl.querySelector('input[type="checkbox"][data-directorate-option]:checked')) {
                    clearFieldError(detailDirectorateErrorEl, detailDirectorateChecklistEl);
                }
            });
        }
        recordControlsBound = true;
    }

    toggleRecordInputs(false);

    if (activeRecord) {
        fillDetailInputs(activeRecord);
        exitRecordEditMode({ resetInputs: false });
        setRecordFormMessage('');
    } else {
        exitRecordEditMode({ resetInputs: false });
        setRecordFormMessage('لم يتم العثور على هذا السجل.', 'error');
    }

    if (printRecordBtn) {
        printRecordBtn.disabled = !activeRecord;
    }

    populateRecordDetails(activeRecord, context);
}

function setFormMessage(message = '', type = 'info') {
    if (!formMessageEl) return;
    formMessageEl.textContent = message;
    formMessageEl.classList.remove('success', 'error');
    if (type === 'success') {
        formMessageEl.classList.add('success');
    } else if (type === 'error') {
        formMessageEl.classList.add('error');
    }
}

function showFieldError(element, message, input) {
    if (element) {
        element.textContent = message;
    }
    if (input) {
        input.classList.add('has-error');
    }
}

function clearFieldError(element, input) {
    if (element) {
        element.textContent = '';
    }
    if (input) {
        input.classList.remove('has-error');
    }
}

function clearFieldErrors() {
    clearFieldError(nameErrorEl, nameInputEl);
    clearFieldError(applicationDateErrorEl, applicationDateInputEl);
    clearFieldError(dateErrorEl, approvalDateInputEl);
    clearFieldError(directorateErrorEl, directorateChecklistEl);
    clearCreateMissingFieldHighlights();
    if (directorateChecklistEl) {
        directorateChecklistEl.classList.remove('has-error');
        clearDirectorateTableErrors(directorateChecklistEl);
    }
    if (nationalIdInputEl) {
        nationalIdInputEl.classList.remove('has-error');
    }
    if (createSectorSelectEl) {
        createSectorSelectEl.classList.remove('has-error');
    }
    if (createStationSelectEl) {
        createStationSelectEl.classList.remove('has-error');
    }
}

function getCreateMissingRequiredFields(formData) {
    const missingFields = [];

    CREATE_REQUIRED_FIELD_DEFS.forEach((field) => {
        if (field.value(formData)) return;
        const input = field.input();
        if (!input) return;
        missingFields.push({ ...field, input });
    });

    const selectedLicenseType = normalizeLicenseTypeName(formData.get('licenseType'));
    if (selectedLicenseType === 'أخرى' && !stringOrEmpty(formData.get('licenseTypeOther')) && licenseTypeOtherInputEl) {
        missingFields.push({
            key: 'licenseTypeOther',
            label: 'نوع الترخيص الآخر',
            input: licenseTypeOtherInputEl
        });
    }

    return missingFields;
}

function clearCreateMissingFieldHighlights() {
    CREATE_REQUIRED_FIELD_DEFS.forEach((field) => {
        const input = field.input();
        input?.classList.remove('has-error', 'missing-required-pulse');
    });
    licenseTypeOtherInputEl?.classList.remove('has-error', 'missing-required-pulse');
}

function pulseCreateMissingField(input) {
    if (!input) return;
    input.classList.remove('missing-required-pulse');
    void input.offsetWidth;
    input.classList.add('has-error', 'missing-required-pulse');
}

function highlightCreateMissingFields(missingFields = []) {
    missingFields.forEach((field) => {
        pulseCreateMissingField(field.input);
    });
}

function scrollToCreateField(input) {
    if (!input) return;
    const target = input.closest('.form-group') || input;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
        if (!input.disabled && typeof input.focus === 'function') {
            input.focus({ preventScroll: true });
        }
    }, 350);
}

function resetCreateMissingFieldBypass() {
    createMissingFieldBypassArmed = false;
    clearCreateMissingFieldHighlights();
}

function renderDirectorateChecklist(container, { name = 'directorates[]', disabled = false, details = [] } = {}) {
    if (!container) return [];

    const detailMap = new Map();
    if (Array.isArray(details)) {
        details.forEach((detail) => {
            if (!detail || !detail.name) return;
            const normalizedName = normalizeDirectorateName(detail.name);
            detailMap.set(normalizedName, { ...detail, name: normalizedName });
        });
    }

    const orderedDetails = [];
    DIRECTORATE_OPTIONS.forEach((option) => {
        if (detailMap.has(option)) {
            orderedDetails.push(detailMap.get(option));
            detailMap.delete(option);
        } else {
            orderedDetails.push(createDirectorateDetailTemplate(option));
        }
    });
    detailMap.forEach((detail) => {
        orderedDetails.push(detail);
    });

    const rowsHtml = orderedDetails.map((detail, index) => {
        const isSelected = Boolean(detail?.selected);
        const rowClasses = ['directorate-row'];
        if (isSelected) {
            rowClasses.push('selected-row');
        }

        const checkboxId = `${container.id || 'directorateOption'}_${index}`;

        const cellsHtml = DIRECTORATE_TABLE_COLUMNS.map((column) => {
            const rawValue = detail ? detail[column.key] : '';
            let displayValueHtml = '—';
            if (column.type === 'number') {
                displayValueHtml = rawValue ? escapeHtml(toArabicDigits(rawValue)) : '—';
            } else if (column.type === 'date') {
                displayValueHtml = rawValue ? escapeHtml(formatDateForDisplay(rawValue)) : '—';
            } else if (column.key === 'notes') {
                displayValueHtml = rawValue ? escapeHtml(rawValue).replace(/\n/g, '<br>') : '—';
            } else {
                displayValueHtml = rawValue ? escapeHtml(rawValue) : '—';
            }

            const inputAttributes = [`data-field="${column.key}"`, `class="cell-input"`];
            if (column.type !== 'select') {
                inputAttributes.push(`placeholder="${escapeHtml(column.placeholder || '')}"`);
            }

            if (column.type === 'date') {
                inputAttributes.push('data-date-input="true"');
                inputAttributes.push('dir="ltr"');
            }

            let inputHtml = '';
            const safeValue = stringOrEmpty(rawValue);
            if (column.type === 'textarea') {
                inputHtml = `<textarea ${inputAttributes.join(' ')} rows="2">${escapeHtml(safeValue)}</textarea>`;
            } else if (column.type === 'select') {
                const options = getDirectorateScreeningOptions(detail?.name);
                const uniqueOptions = Array.from(new Set(options.filter(Boolean)));
                const optionEntries = [{ value: '', label: '--' }, ...uniqueOptions.map((label) => ({ value: label, label }))];
                if (safeValue && !optionEntries.some((option) => option.value === safeValue)) {
                    optionEntries.push({ value: safeValue, label: safeValue });
                }
                const optionsHtml = optionEntries
                    .map((option) => `<option value="${escapeHtml(option.value)}"${safeValue === option.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
                    .join('');
                inputHtml = `<select ${inputAttributes.join(' ')}>${optionsHtml}</select>`;
            } else {
                inputHtml = `<input type="text" ${inputAttributes.join(' ')} value="${escapeHtml(safeValue)}">`;
            }

            return `
                <td data-column="${column.key}"${column.key === 'notes' ? ' class="notes-cell"' : ''}>
                    <span class="cell-display">${displayValueHtml}</span>
                    ${inputHtml}
                </td>
            `;
        }).join('');

        return `
            <tr class="${rowClasses.join(' ')}" data-directorate-row="true" data-directorate-name="${escapeHtml(detail?.name || '')}">
                <td class="directorate-checkbox">
                    <input type="checkbox" id="${checkboxId}" name="${name}" value="${escapeHtml(detail?.name || '')}" data-directorate-option="true" ${isSelected ? 'checked' : ''}>
                </td>
                <td class="directorate-name">
                    <label for="${checkboxId}">${escapeHtml(detail?.name || '—')}</label>
                </td>
                ${cellsHtml}
            </tr>
        `;
    }).join('');

    const colgroupHtml = `
        <colgroup class="directorate-table-colgroup">
            ${DIRECTORATE_TABLE_LEADING_COLUMNS.map((column) => `<col data-column="${column.key}" style="width:${column.width}">`).join('')}
            ${DIRECTORATE_TABLE_COLUMNS.map((column) => `<col data-column="${column.key}" style="width:${column.width}">`).join('')}
        </colgroup>
    `;

    container.innerHTML = `
        <div class="directorate-table-wrapper">
            <table class="directorate-table" aria-label="قائمة الإدارات">
                ${colgroupHtml}
                <thead>
                    <tr>
                        <th>تفعيل</th>
                        <th>الإدارة</th>
                        ${DIRECTORATE_TABLE_COLUMNS.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;

    container.classList.toggle('is-editing', !disabled);
    container.classList.toggle('is-disabled', Boolean(disabled));

    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"][data-directorate-option]'));
    checkboxes.forEach((checkbox) => {
        checkbox.disabled = Boolean(disabled);
    });

    const inputs = Array.from(container.querySelectorAll('.cell-input'));
    inputs.forEach((input) => {
        const shouldDisable = Boolean(disabled);
        input.disabled = shouldDisable;
        if (input.tagName === 'INPUT') {
            input.readOnly = shouldDisable;
        }
    });

    bindDirectorateDateInputs(container);
    clearDirectorateTableErrors(container);

    return checkboxes;
}

function bindDirectorateDateInputs(container) {
    if (!container) return;
    const inputs = container.querySelectorAll('[data-date-input="true"]');
    inputs.forEach((input) => {
        if (!input || input.dataset.dateBound === 'true') return;
        input.dataset.dateBound = 'true';

        const syncDigitsFromValue = () => {
            const englishValue = toEnglishDigits(input.value);
            const normalizedFromValue = normalizeDateInput(englishValue);
            if (normalizedFromValue) {
                const digits = normalizedDateToDigits(normalizedFromValue);
                input.dataset.dateNormalized = normalizedFromValue;
                input.dataset.dateDigits = digits;
                return digits;
            }
            const digitsOnly = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
            input.dataset.dateDigits = digitsOnly;
            if (digitsOnly.length !== MAX_DATE_DIGITS) {
                input.dataset.dateNormalized = '';
            } else {
                const normalizedFromDigits = normalizeDateFromDigits(digitsOnly);
                if (normalizedFromDigits) {
                    input.dataset.dateNormalized = normalizedFromDigits;
                }
            }
            return digitsOnly;
        };

        input.addEventListener('input', () => {
            const englishValue = toEnglishDigits(input.value);
            if (englishValue.includes('/')) {
                const normalizedFromValue = normalizeDateInput(englishValue);
                if (normalizedFromValue) {
                    const digits = normalizedDateToDigits(normalizedFromValue);
                    input.dataset.dateNormalized = normalizedFromValue;
                    input.dataset.dateDigits = digits;
                    input.value = formatNormalizedDateForDisplay(normalizedFromValue);
                } else {
                    input.dataset.dateDigits = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
                    input.dataset.dateNormalized = '';
                }
                input.classList.remove('has-error');
                return;
            }
            const digits = syncDigitsFromValue();
            input.value = formatDateForEditing(digits);
            input.classList.remove('has-error');
        });

        input.addEventListener('focus', () => {
            const normalized = input.dataset.dateNormalized || '';
            if (normalized) {
                const digits = normalizedDateToDigits(normalized);
                input.dataset.dateDigits = digits;
                input.value = formatDateForEditing(digits);
                return;
            }
            const digits = syncDigitsFromValue();
            input.value = formatDateForEditing(digits);
        });

        input.addEventListener('blur', () => {
            const digits = input.dataset.dateDigits || '';
            if (!digits) {
                input.value = '';
                input.dataset.dateNormalized = '';
                input.classList.remove('has-error');
                return;
            }
            if (digits.length !== MAX_DATE_DIGITS) {
                input.classList.add('has-error');
                return;
            }
            const normalized = normalizeDateFromDigits(digits);
            if (!normalized) {
                input.classList.add('has-error');
                return;
            }
            input.dataset.dateNormalized = normalized;
            input.dataset.dateDigits = normalizedDateToDigits(normalized);
            input.value = formatNormalizedDateForDisplay(normalized);
            input.classList.remove('has-error');
        });

        if (input.value) {
            const normalized = normalizeOptionalDate(input.value);
            if (normalized) {
                input.dataset.dateNormalized = normalized;
                input.dataset.dateDigits = normalizedDateToDigits(normalized);
                input.value = formatNormalizedDateForDisplay(normalized);
            }
        }
    });
}

function clearDirectorateTableErrors(container) {
    if (!container) return;
    container.querySelectorAll('.cell-input').forEach((input) => {
        input.classList.remove('has-error');
    });
}

function setDirectorateSelection(container, values = []) {
    if (!container) return;
    const selectedSet = new Set((values || []).map(stringOrEmpty).filter(Boolean));
    container.querySelectorAll('[data-directorate-row]').forEach((row) => {
        const name = row.dataset.directorateName || '';
        const checkbox = row.querySelector('input[type="checkbox"][data-directorate-option]');
        const isSelected = selectedSet.has(name);
        if (checkbox) {
            checkbox.checked = isSelected;
        }
        row.classList.toggle('selected-row', isSelected);
    });
}

function getDirectorateSelection(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"][data-directorate-option]:checked'))
        .map((input) => input.value)
        .filter(Boolean);
}

function setDirectorateDisabled(container, disabled) {
    if (!container) return;
    const isDisabled = Boolean(disabled);
    container.classList.toggle('is-editing', !isDisabled);
    container.classList.toggle('is-disabled', isDisabled);
    container.querySelectorAll('input[type="checkbox"][data-directorate-option]').forEach((input) => {
        input.disabled = isDisabled;
    });
    container.querySelectorAll('.cell-input').forEach((input) => {
        input.disabled = isDisabled;
        if (input.tagName === 'INPUT') {
            input.readOnly = isDisabled;
        }
    });
}

function buildDirectorateDetailsPayload(container, { requireSelection = true } = {}) {
    const result = {
        details: [],
        directorates: [],
        errors: []
    };

    if (!container) {
        return result;
    }

    clearDirectorateTableErrors(container);

    const rows = Array.from(container.querySelectorAll('[data-directorate-row]'));
    rows.forEach((row) => {
        const name = normalizeDirectorateName(row.dataset.directorateName);
        const checkbox = row.querySelector('input[type="checkbox"][data-directorate-option]');
        const selected = Boolean(checkbox?.checked);
        row.classList.toggle('selected-row', selected);

        const detail = createDirectorateDetailTemplate(name, { selected });

        DIRECTORATE_TABLE_COLUMNS.forEach((column) => {
            const input = row.querySelector(`[data-field="${column.key}"]`);
            if (!input) {
                detail[column.key] = '';
                return;
            }

            const rawValue = input.value;
            if (column.type === 'number') {
                const sanitizedNumber = sanitizeNumeric(rawValue);
                detail[column.key] = sanitizedNumber;
                input.value = sanitizedNumber;
            } else if (column.type === 'date') {
                const trimmed = stringOrEmpty(rawValue);
                if (!trimmed) {
                    detail[column.key] = '';
                    input.dataset.dateNormalized = '';
                    input.dataset.dateDigits = '';
                    input.value = '';
                } else {
                    const normalized = normalizeDateInput(toEnglishDigits(trimmed));
                    if (!normalized) {
                        input.classList.add('has-error');
                        result.errors.push(`صيغة ${column.label} غير صحيحة للإدارة ${name || 'غير محددة'}.`);
                        detail[column.key] = '';
                    } else {
                        detail[column.key] = normalized;
                        input.dataset.dateNormalized = normalized;
                        input.dataset.dateDigits = normalizedDateToDigits(normalized);
                        input.value = formatNormalizedDateForDisplay(normalized);
                    }
                }
            } else if (column.type === 'select') {
                const trimmedValue = stringOrEmpty(rawValue);
                const validOptions = getDirectorateScreeningOptions(name);
                if (trimmedValue && validOptions.length && !validOptions.includes(trimmedValue)) {
                    // preserve unexpected values but ensure they remain selectable by reusing the option list logic
                    detail[column.key] = trimmedValue;
                } else {
                    detail[column.key] = trimmedValue;
                }
                input.value = trimmedValue;
            } else {
                const trimmedValue = stringOrEmpty(rawValue);
                detail[column.key] = trimmedValue;
                input.value = trimmedValue;
            }
        });

        result.details.push(detail);
        if (selected && name) {
            result.directorates.push(name);
        }
    });

    if (requireSelection && !result.directorates.length) {
        result.errors.push('يرجى اختيار إدارة واحدة على الأقل.');
    }

    return result;
}

function getNormalizedDateForSubmission(input = approvalDateInputEl, label = 'تاريخ الموافقة') {
    if (!input) return { normalized: '', error: null };
    const rawValue = stringOrEmpty(input.value);
    const digits = rawValue
        ? (input.dataset.digits || toEnglishDigits(rawValue).replace(/\D/g, '').slice(0, MAX_DATE_DIGITS))
        : '';
    if (!digits) {
        input.dataset.normalized = '';
        input.dataset.digits = '';
        return { normalized: '', error: null };
    }
    if (digits.length !== MAX_DATE_DIGITS) {
        return { normalized: '', error: `يجب إدخال 8 أرقام لحقل ${label}.` };
    }
    const normalized = normalizeDateFromDigits(digits);
    if (!normalized) {
        return { normalized: '', error: `صيغة ${label} غير صحيحة.` };
    }
    input.dataset.normalized = normalized;
    input.dataset.digits = normalizedDateToDigits(normalized);
    return { normalized, error: null };
}

function applyFieldErrors(fieldErrors = {}) {
    if (fieldErrors.name) {
        showFieldError(nameErrorEl, fieldErrors.name, nameInputEl);
    } else {
        clearFieldError(nameErrorEl, nameInputEl);
    }

    if (fieldErrors.approvalDate) {
        showFieldError(dateErrorEl, fieldErrors.approvalDate, approvalDateInputEl);
    } else {
        clearFieldError(dateErrorEl, approvalDateInputEl);
    }

    if (fieldErrors.applicationDate) {
        showFieldError(applicationDateErrorEl, fieldErrors.applicationDate, applicationDateInputEl);
    } else {
        clearFieldError(applicationDateErrorEl, applicationDateInputEl);
    }

    if (fieldErrors.licenseType || fieldErrors.licenseTypeOther) {
        const message = fieldErrors.licenseTypeOther || fieldErrors.licenseType;
        const inputEl = fieldErrors.licenseType ? licenseTypeSelectEl : licenseTypeOtherInputEl;
        showFieldError(licenseTypeErrorEl, message, inputEl);
        if (fieldErrors.licenseType) {
            licenseTypeSelectEl?.classList.add('has-error');
        }
        if (fieldErrors.licenseTypeOther) {
            licenseTypeOtherInputEl?.classList.add('has-error');
        }
    } else {
        clearFieldError(licenseTypeErrorEl, licenseTypeSelectEl);
        if (licenseTypeOtherInputEl) {
            licenseTypeOtherInputEl.classList.remove('has-error');
        }
    }

    if (fieldErrors.directorates) {
        showFieldError(directorateErrorEl, fieldErrors.directorates, directorateChecklistEl);
    } else {
        clearFieldError(directorateErrorEl, directorateChecklistEl);
    }
}

function setupNameFieldGuard() {
    if (!nameInputEl) return;
    nameInputEl.addEventListener('input', () => {
        const original = nameInputEl.value;
        const sanitized = original.replace(/[^\p{L}\s]/gu, '');
        if (original !== sanitized) {
            nameInputEl.value = sanitized;
            showFieldError(nameErrorEl, 'حروف فقط', nameInputEl);
        } else if (sanitized) {
            clearFieldError(nameErrorEl, nameInputEl);
        }
    });
}

function setupDateFieldGuard(input = approvalDateInputEl, errorEl = dateErrorEl, label = 'تاريخ الموافقة') {
    if (!input || input.dataset.dateGuardBound === 'true') return;
    input.dataset.dateGuardBound = 'true';

    input.addEventListener('input', () => {
        const englishValue = toEnglishDigits(input.value);
        if (englishValue.includes('/')) {
            const normalizedFromValue = normalizeDateInput(englishValue);
            if (normalizedFromValue) {
                const digits = normalizedDateToDigits(normalizedFromValue);
                input.dataset.digits = digits;
                input.dataset.normalized = normalizedFromValue;
                input.value = formatNormalizedDateForDisplay(normalizedFromValue);
            } else {
                input.dataset.digits = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
                input.dataset.normalized = '';
            }
            clearFieldError(errorEl, input);
            return;
        }
        const normalizedFromValue = normalizeDateInput(englishValue);
        if (normalizedFromValue) {
            const digits = normalizedDateToDigits(normalizedFromValue);
            input.dataset.digits = digits;
            input.dataset.normalized = normalizedFromValue;
            input.value = formatDateForEditing(digits);
        } else {
            const digits = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
            input.dataset.digits = digits;
            if (digits.length !== MAX_DATE_DIGITS) {
                input.dataset.normalized = '';
            } else {
                const normalizedFromDigits = normalizeDateFromDigits(digits);
                if (normalizedFromDigits) {
                    input.dataset.normalized = normalizedFromDigits;
                }
            }
            input.value = formatDateForEditing(digits);
        }
        clearFieldError(errorEl, input);
    });

    input.addEventListener('focus', () => {
        let digits = input.dataset.digits;
        if (digits) {
            input.value = formatDateForEditing(digits);
            return;
        }
        const normalized = input.dataset.normalized || '';
        if (normalized) {
            digits = normalizedDateToDigits(normalized);
            input.dataset.digits = digits;
            input.value = formatDateForEditing(digits);
            return;
        }
        const englishValue = toEnglishDigits(input.value);
        const normalizedFromValue = normalizeDateInput(englishValue);
        if (normalizedFromValue) {
            digits = normalizedDateToDigits(normalizedFromValue);
            input.dataset.normalized = normalizedFromValue;
            input.dataset.digits = digits;
            input.value = formatDateForEditing(digits);
        } else {
            const clean = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
            input.dataset.digits = clean;
            input.value = formatDateForEditing(clean);
        }
    });

    input.addEventListener('blur', () => {
        const digits = input.dataset.digits || '';
        if (!digits) {
            input.value = '';
            input.dataset.normalized = '';
            clearFieldError(errorEl, input);
            return;
        }
        if (digits.length !== MAX_DATE_DIGITS) {
            showFieldError(errorEl, `يجب إدخال 8 أرقام لحقل ${label}.`, input);
            return;
        }
        const normalized = normalizeDateFromDigits(digits);
        if (!normalized) {
            showFieldError(errorEl, `صيغة ${label} غير صحيحة.`, input);
            return;
        }
        input.dataset.normalized = normalized;
        input.dataset.digits = normalizedDateToDigits(normalized);
        input.value = formatNormalizedDateForDisplay(normalized);
        clearFieldError(errorEl, input);
    });
}

function setupDetailApprovalDateGuard(input = detailInputEls.approvalDate) {
    if (!input || input.dataset.dateGuardBound === 'true') return;
    input.dataset.dateGuardBound = 'true';

    const syncDigitsFromValue = () => {
        const englishValue = toEnglishDigits(input.value);
        const normalizedFromValue = normalizeDateInput(englishValue);
        if (normalizedFromValue) {
            const digits = normalizedDateToDigits(normalizedFromValue);
            input.dataset.normalized = normalizedFromValue;
            input.dataset.digits = digits;
            return digits;
        }
        const digitsOnly = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
        input.dataset.digits = digitsOnly;
        if (digitsOnly.length !== MAX_DATE_DIGITS) {
            input.dataset.normalized = '';
        } else {
            const normalizedFromDigits = normalizeDateFromDigits(digitsOnly);
            if (normalizedFromDigits) {
                input.dataset.normalized = normalizedFromDigits;
            }
        }
        return digitsOnly;
    };

    input.addEventListener('input', () => {
        const englishValue = toEnglishDigits(input.value);
        if (englishValue.includes('/')) {
            const normalizedFromValue = normalizeDateInput(englishValue);
            if (normalizedFromValue) {
                const digits = normalizedDateToDigits(normalizedFromValue);
                input.dataset.normalized = normalizedFromValue;
                input.dataset.digits = digits;
                input.value = formatNormalizedDateForDisplay(normalizedFromValue);
            } else {
                input.dataset.digits = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
                input.dataset.normalized = '';
            }
            input.classList.remove('has-error');
            return;
        }
        const digits = syncDigitsFromValue();
        input.value = formatDateForEditing(digits);
        input.classList.remove('has-error');
    });

    input.addEventListener('focus', () => {
        let digits = input.dataset.digits;
        if (digits) {
            input.value = formatDateForEditing(digits);
            return;
        }
        const normalized = input.dataset.normalized || '';
        if (normalized) {
            digits = normalizedDateToDigits(normalized);
            input.dataset.digits = digits;
            input.value = formatDateForEditing(digits);
            return;
        }
        const englishValue = toEnglishDigits(input.value);
        const normalizedFromValue = normalizeDateInput(englishValue);
        if (normalizedFromValue) {
            digits = normalizedDateToDigits(normalizedFromValue);
            input.dataset.normalized = normalizedFromValue;
            input.dataset.digits = digits;
            input.value = formatDateForEditing(digits);
        } else {
            const clean = englishValue.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
            input.dataset.digits = clean;
            input.value = formatDateForEditing(clean);
        }
    });

    input.addEventListener('blur', () => {
        const digits = input.dataset.digits || '';
        if (!digits) {
            input.value = '';
            input.dataset.normalized = '';
            input.classList.remove('has-error');
            return;
        }
        if (digits.length !== MAX_DATE_DIGITS) {
            input.classList.add('has-error');
            return;
        }
        const normalized = normalizeDateFromDigits(digits);
        if (!normalized) {
            input.classList.add('has-error');
            return;
        }
        input.dataset.normalized = normalized;
        input.dataset.digits = normalizedDateToDigits(normalized);
        input.value = formatNormalizedDateForDisplay(normalized);
        input.classList.remove('has-error');
    });
}

function buildPayloadFromForm(form, { allowMissingRequired = false } = {}) {
    const formData = new FormData(form);
    const payload = {
        sector: normalizeSectorName(formData.get('sector')),
        station: normalizeStationName(formData.get('station'), formData.get('sector')),
        name: stringOrEmpty(formData.get('requesterName')),
        job: stringOrEmpty(formData.get('job')),
        nationalId: sanitizeNumeric(formData.get('nationalId')),
        address: stringOrEmpty(formData.get('address')),
        licenseType: normalizeLicenseTypeName(formData.get('licenseType')),
        licenseTypeOther: stringOrEmpty(formData.get('licenseTypeOther')),
        weaponData: stringOrEmpty(formData.get('weaponData')),
        purchasePermit: sanitizeNumeric(formData.get('purchasePermit')),
        licenseNumber: sanitizeNumeric(formData.get('licenseNumber')),
        notes: stringOrEmpty(formData.get('notes')),
        directorates: []
    };

    const errors = [];
    const fieldErrors = {};

    if (payload.station && !payload.sector && !allowMissingRequired) {
        errors.push('يجب اختيار القطاع قبل تحديد القسم.');
        if (createSectorSelectEl) {
            createSectorSelectEl.classList.add('has-error');
        }
    }

    const { normalized: normalizedApplicationDate, error: applicationDateError } = getNormalizedDateForSubmission(applicationDateInputEl, 'تاريخ التقديم');
    payload.applicationDate = normalizedApplicationDate;

    const { normalized: normalizedDate, error: dateError } = getNormalizedDateForSubmission();
    payload.approvalDate = normalizedDate;

    if (!payload.name) {
        if (!allowMissingRequired) {
            fieldErrors.name = 'اسم الطالب مطلوب.';
        }
    } else if (!NAME_REGEX.test(payload.name)) {
        fieldErrors.name = 'حروف فقط';
    }

    if (dateError) {
        fieldErrors.approvalDate = dateError;
    }

    if (applicationDateError) {
        fieldErrors.applicationDate = applicationDateError;
    }

    if (!payload.licenseType && !allowMissingRequired) {
        fieldErrors.licenseType = 'نوع الترخيص مطلوب.';
    } else if (payload.licenseType === 'أخرى') {
        if (!payload.licenseTypeOther && !allowMissingRequired) {
            fieldErrors.licenseTypeOther = 'يرجى تحديد نوع الترخيص عند اختيار "أخرى".';
        }
    } else {
        payload.licenseTypeOther = '';
    }

    errors.push(...Object.values(fieldErrors));

    const directorateResult = buildDirectorateDetailsPayload(directorateChecklistEl, { requireSelection: false });
    payload.managementDetails = directorateResult.details;
    payload.directorates = directorateResult.directorates;
    payload.directorate = directorateResult.directorates.join('، ');

    const primaryDirectorateError = directorateResult.errors[0];
    if (primaryDirectorateError) {
        fieldErrors.directorates = primaryDirectorateError;
    }

    errors.push(...directorateResult.errors);

    const firstSelectedDetail = payload.managementDetails.find((detail) => detail.selected);
    payload.outgoingNumber = firstSelectedDetail?.outgoingNumber || '';
    payload.incomingNumber = firstSelectedDetail?.incomingNumber || '';

    return { payload, errors, fieldErrors };
}

function bindCreateForm() {
    if (!createFormEl) return;

    if (createFormEl.dataset.missingBypassBound !== 'true') {
        createFormEl.addEventListener('input', resetCreateMissingFieldBypass);
        createFormEl.addEventListener('change', resetCreateMissingFieldBypass);
        createFormEl.dataset.missingBypassBound = 'true';
    }

    createFormEl.addEventListener('submit', async (event) => {
        event.preventDefault();
        setFormMessage('');

        clearFieldErrors();
        const formData = new FormData(createFormEl);
        const missingFields = getCreateMissingRequiredFields(formData);
        const allowMissingRequired = missingFields.length > 0 && createMissingFieldBypassArmed;

        if (missingFields.length && !createMissingFieldBypassArmed) {
            createMissingFieldBypassArmed = true;
            highlightCreateMissingFields(missingFields);
            scrollToCreateField(missingFields[0].input);
            const missingLabels = missingFields.map((field) => field.label).join('، ');
            setFormMessage(`يرجى استكمال الحقول المطلوبة: ${missingLabels}. اضغط حفظ مرة أخرى للحفظ على أي حال.`, 'error');
            return;
        }

        if (!missingFields.length) {
            createMissingFieldBypassArmed = false;
        }

        const { payload, errors, fieldErrors } = buildPayloadFromForm(createFormEl, { allowMissingRequired });
        applyFieldErrors(fieldErrors);
        if (errors.length) {
            setFormMessage(errors.join(' '), 'error');
            return;
        }

        const nameKey = normalizeRequesterNameKey(payload.name);
        if (nameKey) {
            const baseRecords = Array.isArray(allRecords) && allRecords.length
                ? allRecords
                : safeGetCache(RECORDS_CACHE_KEY, []);
            const duplicate = findDuplicateNameRecord(baseRecords, nameKey);
            if (duplicate) {
                const duplicateName = getRecordDisplayName(duplicate);
                setFormMessage(duplicateName ? `يوجد سجل آخر بنفس الاسم: ${duplicateName}` : 'يوجد سجل آخر بنفس الاسم.', 'error');
                return;
            }
        }

        const submitBtn = createFormEl.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-busy', 'true');
        }

        try {
            setFormMessage('جارٍ حفظ السجل...', 'info');
            const response = await createRequest(payload);
            if (response && response.approvalRequired) {
                setFormMessage(response.message || 'تم إرسال طلب الإضافة إلى المدير والسيكرتير الأول لاعتماده.', 'info');
                setFlashMessage(response.message || 'تم إرسال طلب الإضافة إلى المدير والسيكرتير الأول لاعتماده.', 'info');
                createFormEl.reset();
                createMissingFieldBypassArmed = false;
                return;
            }
            const cached = safeGetCache(RECORDS_CACHE_KEY, []);
            const base = Array.isArray(cached) ? cached : [];
            const enrichedSource = typeof response === 'object' && response ? { ...payload, ...response } : { ...payload };
            const normalized = normalizeRecord(enrichedSource, base.length);
            const updatedRecords = sortRecordsById([...base, normalized]);
            allRecords = updatedRecords;
            cacheRecords(updatedRecords);
            cacheActiveRecord(normalized);
            setFormMessage('تم حفظ السجل بنجاح.', 'success');
            createFormEl.reset();
            createMissingFieldBypassArmed = false;
            setDateInputValue(applicationDateInputEl, '');
            setDateInputValue(approvalDateInputEl, '');
            if (licenseTypeSelectEl) {
                licenseTypeSelectEl.value = '';
                syncLicenseTypeOtherInput(licenseTypeSelectEl, licenseTypeOtherInputEl, { clearOnHide: true });
            }
            renderDirectorateChecklist(directorateChecklistEl, { name: 'directorates[]', disabled: false });
            clearFieldError(directorateErrorEl, directorateChecklistEl);
            clearFieldErrors();
            configureCreateSectorStationControls();
        } catch (error) {
            console.error('Error creating request:', error);
            setFormMessage(error.message || 'تعذر حفظ السجل، يرجى المحاولة مرة أخرى.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.removeAttribute('aria-busy');
            }
        }
    });
}

async function initCreatePage() {
    computePortalUserContext();
    configureCreateSectorStationControls();
    setupNameFieldGuard();
    setupDateFieldGuard(applicationDateInputEl, applicationDateErrorEl, 'تاريخ التقديم');
    setupDateFieldGuard();
    await refreshSharedReferenceData();
    populateLicenseTypeSelect(licenseTypeSelectEl, { includeEmptyOption: true });
    bindLicenseTypeControl(licenseTypeSelectEl, licenseTypeOtherInputEl, { clearOnHide: true });
    renderDirectorateChecklist(directorateChecklistEl, { name: 'directorates[]', disabled: false });
    if (directorateChecklistEl) {
        directorateChecklistEl.addEventListener('change', (event) => {
            const checkbox = event.target?.closest('input[type="checkbox"][data-directorate-option]');
            if (checkbox) {
                const row = checkbox.closest('[data-directorate-row]');
                if (row) {
                    row.classList.toggle('selected-row', checkbox.checked);
                }
            }
            if (directorateChecklistEl.querySelector('input[type="checkbox"][data-directorate-option]:checked')) {
                clearFieldError(directorateErrorEl, directorateChecklistEl);
            }
        });
    }
    bindCreateForm();
}

async function handleBackButton(button) {
    const target = button?.dataset?.target || '/main.html';
    if (pageType === 'index') {
        stopAutoRefresh();
        try {
            await clearTemporaryStorage();
            if (target) {
                window.location.href = target;
            }
        } catch (error) {
            console.error('Error clearing temporary storage on exit:', error);
            setFlashMessage(error.message || 'تعذر مسح الملفات المؤقتة.', 'error');
        }
        return;
    }

    if (window.history.length > 1) {
        window.history.back();
    } else if (target) {
        window.location.href = target;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.querySelector('.back-button');
    if (backButton) {
        backButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await handleBackButton(backButton);
        });
    }

    if (pageType === 'index') {
        initIndexPage();
    } else if (pageType === 'record') {
        initRecordPage();
    } else if (pageType === 'create') {
        initCreatePage();
    }
});
