// ===== API Base =====
const API = '/company/api';
const GENERAL_TOKEN_KEY = 'general.auth.token';
const GENERAL_USER_KEY = 'general.auth.user';
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';
const nativeFetch = window.fetch.bind(window);

function getPlatformAuthToken() {
    try {
        return sessionStorage.getItem(GENERAL_TOKEN_KEY) || localStorage.getItem(GENERAL_TOKEN_KEY) || '';
    } catch (_) {
        return '';
    }
}

function isCompanyApiRequest(resource) {
    try {
        const rawUrl = typeof resource === 'string'
            ? resource
            : (resource && resource.url ? resource.url : '');
        const url = new URL(rawUrl, window.location.href);
        return url.origin === window.location.origin
            && (url.pathname === API || url.pathname.startsWith(`${API}/`));
    } catch (_) {
        return false;
    }
}

function authFetch(resource, options = {}) {
    const nextOptions = { ...options };
    if (isCompanyApiRequest(resource)) {
        const headers = new Headers(
            nextOptions.headers || (resource instanceof Request ? resource.headers : undefined)
        );
        const token = getPlatformAuthToken();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        nextOptions.headers = headers;
    }
    return nativeFetch(resource, nextOptions);
}

window.fetch = authFetch;

// ===== Sector / Station Data =====
const sectorStations = {
    east: [
        'مكتب تجريبي 01',
        'مكتب تجريبي 02',
        'مكتب تجريبي 03',
        'مكتب تجريبي 04',
        'مكتب تجريبي 05',
        'مكتب تجريبي 06',
        'مكتب تجريبي 07',
        'مكتب تجريبي 08',
        'مكتب تجريبي 09',
        'مكتب تجريبي 10'
    ],
    west: [
        'مكتب تجريبي 11',
        'مكتب تجريبي 12',
        'مكتب تجريبي 13',
        'مكتب تجريبي 14',
        'مكتب تجريبي 15',
        'مكتب تجريبي 16',
        'مكتب تجريبي 17',
        'مكتب تجريبي 18',
        'مكتب تجريبي 19'
    ],
    south: [
        'مكتب تجريبي 20',
        'مكتب تجريبي 21',
        'مكتب تجريبي 22',
        'مكتب تجريبي 23',
        'مكتب تجريبي 24',
        'مكتب تجريبي 25',
        'مكتب تجريبي 26',
        'مكتب تجريبي 27',
        'مكتب تجريبي 28',
        'مكتب تجريبي 29',
        'مكتب تجريبي 30'
    ],
    north: [
        'مكتب تجريبي 31',
        'مكتب تجريبي 32',
        'مكتب تجريبي 33',
        'مكتب تجريبي 34',
        'مكتب تجريبي 35',
        'مكتب تجريبي 36',
        'مكتب تجريبي 37',
        'مكتب تجريبي 38',
        'مكتب تجريبي 39',
        'مكتب تجريبي 40'
    ],
    sectorfive: [
        'مكتب تجريبي 41',
        'مكتب تجريبي 42',
        'مكتب تجريبي 43',
        'مكتب تجريبي 44',
        'مكتب تجريبي 45'
    ]
};

const sectorLabels = {
    east: 'شرق',
    west: 'غرب',
    south: 'جنوب',
    north: 'شمال',
    sectorfive: 'القطاع التجريبي الخامس'
};

const guardedDirectorates = ['الجهة التجريبية 01', 'الجهة التجريبية 02', 'الجهة التجريبية 03'];
const administrativeDirectorateName = 'الجهة التجريبية 01';
const companyCarTypeOptions = ['مصفحة', 'غير مصفحة'];
const basicInfoAttachmentConfig = {
    company_image: {
        inputId: 'companyImageFileInput',
        previewId: 'companyImagePreview',
        placeholderId: 'companyImagePlaceholder',
        listId: 'companyImageList',
        routeType: 'company_image',
        emptyText: 'لا توجد صورة',
        openLabel: 'صورة الشركة',
        urlPrefix: '/company/company-uploads/'
    },
    licensed_uniform: {
        inputId: 'uniformFileInput',
        previewId: 'uniformPreview',
        placeholderId: 'uniformPlaceholder',
        listId: 'uniformList',
        routeType: 'licensed_uniform',
        emptyText: 'لا توجد صورة',
        openLabel: 'الزي المرخص',
        urlPrefix: '/company/uploads/'
    },
    license_image: {
        inputId: 'licenseFileInput',
        previewId: 'licensePreview',
        placeholderId: 'licensePlaceholder',
        listId: 'licenseList',
        routeType: 'license_image',
        emptyText: 'لا توجد صورة',
        openLabel: 'صورة الرخصة',
        urlPrefix: '/company/license-uploads/'
    },
    company_logo: {
        inputId: 'companyLogoFileInput',
        previewId: 'companyLogoPreview',
        placeholderId: 'companyLogoPlaceholder',
        listId: 'companyLogoList',
        routeType: 'company_logo',
        emptyText: 'لا يوجد شعار',
        openLabel: 'شعار الشركة',
        urlPrefix: '/company/logo-uploads/'
    },
    gps_image: {
        inputId: 'gpsImageFileInput',
        previewId: 'gpsImagePreview',
        placeholderId: 'gpsImagePlaceholder',
        listId: 'gpsImageList',
        routeType: 'gps_image',
        emptyText: 'لا توجد صورة',
        openLabel: 'موقع GPS',
        urlPrefix: '/company/gps-uploads/'
    }
};

function getSectorLabel(key) {
    return sectorLabels[key] || key || '';
}

function createEmptyBasicInfoAttachmentsState() {
    return Object.keys(basicInfoAttachmentConfig).reduce((acc, type) => {
        acc[type] = [];
        return acc;
    }, {});
}

function createEmptyBasicInfoAttachmentSelectionState() {
    return Object.keys(basicInfoAttachmentConfig).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
    }, {});
}

// ===== State =====
let companies = [];
let currentCompanyId = null;
let isEditing = false;
let isNewMode = false;
let boardMembers = [];
let guardedLocations = [];
let guardLicenses = [];
let companyCars = [];
let basicInfoAttachments = createEmptyBasicInfoAttachmentsState();
let selectedBasicInfoAttachmentIndexes = createEmptyBasicInfoAttachmentSelectionState();
const basicAttachmentPdfThumbnailCache = new Map();
const basicAttachmentPdfThumbnailPromises = new Map();
let deleteTargetId = null;
let duplicateCheckTimer = null;
let showExpiredOnly = false;
let showSuspendedOnly = false;
let selectedYears = [];
let selectedActivityFilter = 'all';
let pendingDraftResolve = null;
let pendingCompanyCarUploadIndex = null;

// ===== Arabic Numeral Helpers =====
const _ar = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
function toArabic(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[0-9]/g, d => _ar[d]);
}
function toWestern(v) {
    if (!v) return '';
    return String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function parseGuardCountValue(value) {
    const normalized = toWestern(String(value ?? '').trim()).replace(/[^\d]/g, '');
    return normalized ? parseInt(normalized, 10) : 0;
}

function calculateTotalGuards(locations = guardedLocations) {
    return locations.reduce((sum, item) => sum + parseGuardCountValue(item?.guard_count), 0);
}

function calculateTotalSites(locations = guardedLocations) {
    return locations.length;
}

function refreshGuardedSummaryDisplays() {
    const totalGuardsDisplay = toArabic(calculateTotalGuards());
    const totalSitesDisplay = toArabic(calculateTotalSites());
    const totalGuardsInputs = ['fTotalGuards', 'fBasicTotalGuards'];

    totalGuardsInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = totalGuardsDisplay;
    });

    const totalSitesInput = document.getElementById('fTotalSites');
    if (totalSitesInput) {
        totalSitesInput.value = totalSitesDisplay;
    }
}

// ISO "2024-01-15" → Arabic "٢٠٢٤/٠١/١٥"
function isoToArabicDate(iso) {
    if (!iso) return '';
    const p = iso.split('-');
    if (p.length !== 3) return toArabic(iso);
    return toArabic(p[0] + '/' + p[1] + '/' + p[2]);
}

// Arabic "٢٠٢٤/٠١/١٥" (yyyy/mm/dd) → ISO "2024-01-15"
function arabicDateToIso(val) {
    if (!val) return '';
    const w = toWestern(val.trim());
    const p = w.split('/');
    if (p.length !== 3) return w;
    return p[0] + '-' + p[1] + '-' + p[2];
}

// Blur handler: user types dd/mm/yyyy → auto-convert to yyyy/mm/dd in Arabic
function handleDateBlur(input) {
    let v = toWestern(input.value.trim());
    if (!v) return;
    // ddmmyyyy without separators
    let m = v.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (m) {
        input.value = toArabic(m[3] + '/' + m[2] + '/' + m[1]);
        return;
    }
    // dd/mm/yyyy or dd-mm-yyyy
    m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
        input.value = toArabic(m[3] + '/' + m[2].padStart(2,'0') + '/' + m[1].padStart(2,'0'));
        return;
    }
    // already yyyy/mm/dd or yyyy-mm-dd
    m = v.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
        input.value = toArabic(m[1] + '/' + m[2].padStart(2,'0') + '/' + m[3].padStart(2,'0'));
        return;
    }
    input.value = toArabic(v);
}

// Live formatter for date inputs:
// - 10112026 => ٢٠٢٦/١١/١٠
// - dd/mm/yyyy => ٢٠٢٦/١١/١٠
// - yyyy/mm/dd => ٢٠٢٦/١١/١٠
function autoFormatArabicDate(input) {
    let raw = (input.value || '').trim();
    if (!raw) return;

    const western = toWestern(raw);
    const digitsOnly = western.replace(/\D/g, '');

    // Exactly ddmmyyyy typed without separators
    let m = digitsOnly.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (m) {
        input.value = toArabic(m[3] + '/' + m[2] + '/' + m[1]);
        return;
    }

    // dd/mm/yyyy or dd-mm-yyyy
    m = western.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
        input.value = toArabic(m[3] + '/' + m[2].padStart(2, '0') + '/' + m[1].padStart(2, '0'));
        return;
    }

    // yyyy/mm/dd or yyyy-mm-dd
    m = western.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
        input.value = toArabic(m[1] + '/' + m[2].padStart(2, '0') + '/' + m[3].padStart(2, '0'));
        return;
    }

    // Keep user's partial typing but convert numerals to Arabic
    input.value = toArabic(western);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    populateGuardedDirectorFilterOptions();
    updateActivityBookmarkUI();
    applyDeleteApprovalInspectTarget();
    loadCompanies();
    handleZoomResize();
    startDateClock();
});

function readDeleteApprovalInspectTarget() {
    try {
        const raw = sessionStorage.getItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY);
        if (!raw) return null;
        const target = JSON.parse(raw);
        return target && target.programKey === 'company' ? target : null;
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
    const nameInput = document.getElementById('searchName');
    const licenseInput = document.getElementById('searchLicense');
    if (nameInput) nameInput.value = target.name || '';
    if (licenseInput) licenseInput.value = target.license || '';
    clearDeleteApprovalInspectTarget();
    return true;
}
try { window.applyDeleteApprovalInspectTarget = applyDeleteApprovalInspectTarget; } catch (_) {}

// ===== Live Date Clock =====
function startDateClock() {
    const update = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        document.getElementById('ribbonDate').textContent = toArabic(y + '/' + m + '/' + d);
    };
    update();
    setInterval(update, 60000);
}

async function exitApplication() {
    window.location.href = '/dashboard';
}

// ===== Renewal Expiry Check =====
function isRenewalExpired(renewalDateIso) {
    if (!renewalDateIso) return false;
    const parts = renewalDateIso.split('-');
    if (parts.length !== 3) return false;
    const renewalYear = parseInt(parts[0], 10);
    const renewalMonth = parseInt(parts[1], 10);
    const renewalDay = parseInt(parts[2], 10);
    if (isNaN(renewalYear) || isNaN(renewalMonth) || isNaN(renewalDay)) return false;
    const expiryDate = new Date(renewalYear + 3, renewalMonth - 1, renewalDay);
    return new Date() >= expiryDate;
}

function getRenewalStatus(renewalDateIso) {
    return isRenewalExpired(renewalDateIso) ? 'يجب التجديد' : '---';
}

// ===== Zoom / Resize — keep full-screen layout =====
function handleZoomResize() {
    const adjust = () => {
        // Force the body to fill the actual visible viewport
        document.documentElement.style.height = window.innerHeight + 'px';
        document.body.style.height = window.innerHeight + 'px';
        document.body.style.width = window.innerWidth + 'px';
    };
    adjust();
    window.addEventListener('resize', adjust);
    // Also handle visual viewport (mobile pinch-zoom, desktop Ctrl+scroll)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjust);
    }
}

// ===== Load Companies =====
async function loadCompanies() {
    try {
        const nameVal = document.getElementById('searchName').value.trim();
        const licenseVal = document.getElementById('searchLicense').value.trim();
        const sectorVal = document.getElementById('searchSector').value;
        const params = new URLSearchParams();
        if (nameVal) params.set('search_name', nameVal);
        if (licenseVal) params.set('search_license', licenseVal);
        if (sectorVal) params.set('search_sector', sectorVal);

        const res = await fetch(`${API}/companies?${params}`);
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error((payload && (payload.message || payload.error)) || `HTTP ${res.status}`);
        }
        if (!Array.isArray(payload)) {
            throw new Error('استجابة سجل الشركات غير صحيحة');
        }
        companies = payload;
        populateYearDropdown();
        renderTable();
    } catch (err) {
        companies = [];
        console.error('Error loading companies:', err);
        populateYearDropdown();
        renderTable();
    }
}

// ===== Render Table =====
function renderTable() {
    const tbody = document.getElementById('companiesBody');
    const emptyState = document.getElementById('emptyState');
    const countBadge = document.getElementById('companyCount');

    countBadge.textContent = toArabic(companies.length);

    if (companies.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.add('visible');
        return;
    }

    emptyState.classList.remove('visible');

    let displayList = companies;
    displayList = displayList.filter(c => {
        const activityType = (c.activity_type || '');
        if (selectedActivityFilter === 'all') {
            return true;
        }
        if (selectedActivityFilter === 'both') {
            return activityType.includes('حراسة') && activityType.includes('نقل');
        }
        if (selectedActivityFilter === 'guard') {
            return activityType.includes('حراسة') && !activityType.includes('نقل');
        }
        if (selectedActivityFilter === 'transfer') {
            return activityType.includes('نقل') && !activityType.includes('حراسة');
        }
        return true;
    });
    if (showExpiredOnly) displayList = displayList.filter(c => isRenewalExpired(c.renewal_date));
    if (showSuspendedOnly) displayList = displayList.filter(c => (c.company_status || 'تعمل') === 'موقوفة');
    if (selectedYears.length > 0) {
        displayList = displayList.filter(c => {
            if (!c.renewal_date) return false;
            const y = c.renewal_date.split('-')[0];
            return selectedYears.includes(y);
        });
    }

    if (displayList.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.add('visible');
        countBadge.textContent = toArabic(0);
        return;
    }

    countBadge.textContent = toArabic(displayList.length);

    tbody.innerHTML = displayList.map((c, i) => {
        const expired = isRenewalExpired(c.renewal_date);
        const suspended = (c.company_status || 'تعمل') === 'موقوفة';
        let rowClass = '';
        if (suspended) rowClass = 'row-suspended';
        else if (expired) rowClass = 'row-expired';
        return `
        <tr class="${rowClass}" data-activity-row-id="${esc(c.id)}" data-activity-row-label="${esc(c.company_name)}" data-activity-row-type="company">
            <td>${toArabic(i + 1)}</td>
            <td><strong>${esc(c.company_name)}</strong></td>
            <td>${toArabic(esc(c.license_number))}</td>
            <td>${isoToArabicDate(c.issue_date)}</td>
            <td>
                ${isoToArabicDate(c.renewal_date)}
                ${expired ? '<span class="renewal-status-tag">يجب التجديد</span>' : ''}
            </td>
            <td>${activityTag(c.activity_type)}</td>
            <td>${esc(c.headquarters_address)}</td>
            <td>${sectorTag(c.sector)}</td>
            <td>${statusTag(c.company_status)}</td>
            <td class="notes-cell" title="${esc(c.notes)}">${esc(c.notes)}</td>
            <td>
                <button class="btn btn-primary btn-sm" id="viewCompany-${esc(c.id)}" onclick="viewCompany(${c.id})">
                    <i class="fas fa-eye"></i> عرض
                </button>
                <button class="btn btn-warning btn-sm" id="editCompany-${esc(c.id)}" onclick="quickEditCompany(${c.id})">
                    <i class="fas fa-pen"></i> تعديل
                </button>
                <button class="btn-icon danger" id="deleteCompany-${esc(c.id)}" onclick="askDelete(${c.id})" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');

    document.dispatchEvent(new CustomEvent('activity:table-rendered', {
        detail: { programKey: 'company', rowCount: displayList.length }
    }));
}

// ===== Browser print reports =====
function getBrowserPrintDate() {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return toArabic(`${y}/${m}/${d} ${hh}:${mm}`);
}

function getCurrentCompanyNameForPrint() {
    return (document.getElementById('fCompanyName')?.value || '').trim();
}

function showNoPrintRowsMessage() {
    alert('لا توجد بيانات للطباعة');
}

function normalizePrintValue(value) {
    const text = value == null || value === '' ? '---' : String(value);
    return toArabic(text);
}

function renderPrintCell(value, options = {}) {
    const className = options.className ? ` class="${esc(options.className)}"` : '';
    if (options.html) {
        return `<td${className}>${value || '---'}</td>`;
    }
    return `<td${className}>${esc(normalizePrintValue(value))}</td>`;
}

function renderPrintTable(columns, rows) {
    const headers = columns.map(col => `<th>${esc(col.label)}</th>`).join('');
    const bodyRows = rows.length > 0
        ? rows.map((row, rowIndex) => `
            <tr>
                ${columns.map((col) => {
                    const value = typeof col.value === 'function'
                        ? col.value(row, rowIndex)
                        : row[col.key];
                    return renderPrintCell(value, {
                        html: Boolean(col.html),
                        className: col.className || ''
                    });
                }).join('')}
            </tr>
        `).join('')
        : `<tr><td colspan="${columns.length}">لا توجد بيانات</td></tr>`;

    return `
        <table class="print-table">
            <thead>
                <tr>${headers}</tr>
            </thead>
            <tbody>
                ${bodyRows}
            </tbody>
        </table>
    `;
}

function buildBrowserPrintHtml({ title, subtitle = '', columns, rows, summary = '', orientation = 'landscape', dense = false }) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <style>
        
        @page {
            size: A4 ${orientation};
            margin: 8mm;
        }
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: 'Segoe UI', 'Segoe UI', Tahoma, sans-serif;
            direction: rtl;
        }
        body {
            padding: 0;
        }
        .sheet {
            width: 100%;
            min-height: 100%;
        }
        .print-header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 14px;
            align-items: end;
            margin-bottom: 10px;
            padding-bottom: 7px;
            border-bottom: 2px solid #0f172a;
        }
        .print-title {
            margin: 0 0 3px;
            color: #0f172a;
            font-size: ${dense ? '18px' : '21px'};
            font-weight: 800;
            line-height: 1.25;
        }
        .print-subtitle {
            color: #475569;
            font-size: ${dense ? '10px' : '12px'};
            font-weight: 700;
        }
        .print-date {
            color: #1e293b;
            font-size: ${dense ? '10px' : '12px'};
            font-weight: 700;
            white-space: nowrap;
        }
        .print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: ${dense ? '9px' : '11px'};
        }
        .print-table th,
        .print-table td {
            border: 1px solid #cbd5e1;
            padding: ${dense ? '4px 5px' : '6px 7px'};
            text-align: center;
            vertical-align: middle;
            line-height: 1.35;
            word-break: break-word;
            overflow-wrap: anywhere;
        }
        .print-table th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 800;
        }
        .print-table tbody tr:nth-child(even) {
            background: #f8fafc;
        }
        .text-right {
            text-align: right;
        }
        .ltr {
            direction: ltr;
            unicode-bidi: plaintext;
        }
        .print-summary {
            margin-top: 10px;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #0f172a;
            font-size: 12px;
            font-weight: 800;
            text-align: center;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .print-image {
            display: block;
            width: 96px;
            max-width: 100%;
            max-height: 72px;
            object-fit: contain;
            margin: 0 auto;
            border-radius: 6px;
            border: 1px solid #d7dee7;
            background: #ffffff;
        }
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="print-header">
            <div>
                <h1 class="print-title">${esc(title)}</h1>
                ${subtitle ? `<div class="print-subtitle">${esc(subtitle)}</div>` : ''}
            </div>
            <div class="print-date">تاريخ الطباعة: ${esc(getBrowserPrintDate())}</div>
        </div>
        ${renderPrintTable(columns, rows)}
        ${summary ? `<div class="print-summary">${esc(summary)}</div>` : ''}
    </div>
    <script>
        (function () {
            var images = Array.prototype.slice.call(document.images || []);
            Promise.all(images.map(function (img) {
                if (img.complete) return Promise.resolve();
                return new Promise(function (resolve) {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            })).then(function () {
                setTimeout(function () {
                    window.focus();
                    window.print();
                }, 250);
            });
            window.onafterprint = function () {
                setTimeout(function () { window.close(); }, 150);
            };
        })();
    </script>
</body>
</html>`;
}

function openBrowserPrintReport(html) {
    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) {
        alert('تعذر فتح نافذة الطباعة');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

function printCompanyRegister() {
    let displayList = companies;
    displayList = displayList.filter(c => {
        const activityType = (c.activity_type || '');
        if (selectedActivityFilter === 'all') return true;
        if (selectedActivityFilter === 'both') return activityType.includes('حراسة') && activityType.includes('نقل');
        if (selectedActivityFilter === 'guard') return activityType.includes('حراسة') && !activityType.includes('نقل');
        if (selectedActivityFilter === 'transfer') return activityType.includes('نقل') && !activityType.includes('حراسة');
        return true;
    });
    if (showExpiredOnly) displayList = displayList.filter(c => isRenewalExpired(c.renewal_date));
    if (showSuspendedOnly) displayList = displayList.filter(c => (c.company_status || 'تعمل') === 'موقوفة');
    if (selectedYears.length > 0) {
        displayList = displayList.filter(c => {
            if (!c.renewal_date) return false;
            const y = c.renewal_date.split('-')[0];
            return selectedYears.includes(y);
        });
    }

    if (displayList.length === 0) {
        showNoPrintRowsMessage();
        return;
    }

    const rows = displayList.map((c, i) => ({
        index: i + 1,
        company_name: c.company_name || '',
        license_number: c.license_number || '',
        issue_date: isoToArabicDate(c.issue_date),
        renewal_date: isoToArabicDate(c.renewal_date),
        activity_type: c.activity_type || '',
        headquarters_address: c.headquarters_address || '',
        sector: getSectorLabel(c.sector),
        company_status: c.company_status || 'تعمل',
        notes: c.notes || '',
        branches: c.branches || '',
        renewal_status: getRenewalStatus(c.renewal_date)
    }));

    openBrowserPrintReport(buildBrowserPrintHtml({
        title: 'سجل الشركات',
        subtitle: `عدد النتائج: ${toArabic(rows.length)}`,
        dense: true,
        columns: [
            { label: '#', key: 'index' },
            { label: 'اسم الشركة', key: 'company_name' },
            { label: 'رقم الرخصة', key: 'license_number' },
            { label: 'تاريخ الاصدار', key: 'issue_date' },
            { label: 'تاريخ التجديد', key: 'renewal_date' },
            { label: 'نوع النشاط', key: 'activity_type' },
            { label: 'عنوان مقر الشركة', key: 'headquarters_address', className: 'text-right' },
            { label: 'القطاع', key: 'sector' },
            { label: 'حالة الشركة', key: 'company_status' },
            { label: 'ملاحظات', key: 'notes', className: 'text-right' },
            { label: 'فروع', key: 'branches', className: 'text-right' },
            { label: 'حالة التجديد', key: 'renewal_status' }
        ],
        rows
    }));
}

function activityTag(val) {
    if (!val) return '';
    let cls = 'tag-guard';
    if (val.includes('نقل') && val.includes('حراسة')) cls = 'tag-both';
    else if (val.includes('نقل')) cls = 'tag-transfer';
    return `<span class="activity-tag ${cls}">${esc(val)}</span>`;
}

function sectorTag(val) {
    if (!val) return '';
    const label = getSectorLabel(val);
    const clsMap = { east: 'tag-sector-east', west: 'tag-sector-west', south: 'tag-sector-south', north: 'tag-sector-north', sectorfive: 'tag-sector-sectorfive' };
    const cls = clsMap[val] || 'tag-sector-east';
    return `<span class="sector-tag ${cls}">${esc(label)}</span>`;
}

function statusTag(val) {
    const status = val || 'تعمل';
    const cls = status === 'موقوفة' ? 'status-tag-suspended' : 'status-tag-active';
    return `<span class="status-tag ${cls}">${esc(status)}</span>`;
}

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ===== Duplicate Validation =====
function setDuplicateUI(inputId, msgId, hasError) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if (!input || !msg) return;

    input.classList.toggle('input-error', hasError);
    msg.classList.toggle('hidden', !hasError);
}

function clearDuplicateUI() {
    setDuplicateUI('fCompanyName', 'companyDuplicateMsg', false);
    setDuplicateUI('fLicenseNumber', 'licenseDuplicateMsg', false);
}

function normalizeCompanyName(value) {
    return (value || '').trim();
}

function normalizeLicenseNumber(value) {
    return toWestern((value || '').trim());
}

function normalizeSector(value) {
    return (value || '').trim();
}

function queueDuplicateValidation() {
    clearTimeout(duplicateCheckTimer);
    duplicateCheckTimer = setTimeout(() => {
        validateDuplicateFields();
    }, 250);
}

async function validateDuplicateFields() {
    const companyInput = document.getElementById('fCompanyName');
    const licenseInput = document.getElementById('fLicenseNumber');
    const sectorInput = document.getElementById('fSector');
    if (!companyInput || !licenseInput || !sectorInput) return false;

    if (companyInput.disabled || licenseInput.disabled || sectorInput.disabled) {
        clearDuplicateUI();
        return false;
    }

    const companyName = normalizeCompanyName(companyInput.value);
    const licenseNumber = normalizeLicenseNumber(licenseInput.value);
    const sectorValue = normalizeSector(sectorInput.value);

    if (!companyName && !licenseNumber) {
        clearDuplicateUI();
        return false;
    }

    try {
        const res = await fetch(`${API}/companies`);
        const allCompanies = await res.json();
        const currentIdNum = Number(currentCompanyId || 0);

        const companyExists = !!companyName && allCompanies.some(c => {
            return Number(c.id) !== currentIdNum && normalizeCompanyName(c.company_name) === companyName;
        });

        const licenseExists = !!licenseNumber && !!sectorValue && allCompanies.some(c => {
            return Number(c.id) !== currentIdNum
                && normalizeLicenseNumber(c.license_number) === licenseNumber
                && normalizeSector(c.sector) === sectorValue;
        });

        setDuplicateUI('fCompanyName', 'companyDuplicateMsg', companyExists);
        setDuplicateUI('fLicenseNumber', 'licenseDuplicateMsg', licenseExists);

        return companyExists || licenseExists;
    } catch (err) {
        console.error('Duplicate validation error:', err);
        return false;
    }
}

// ===== Search =====
let searchTimeout;
function searchCompanies() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadCompanies, 300);
}

function clearSearch() {
    document.getElementById('searchName').value = '';
    document.getElementById('searchLicense').value = '';
    document.getElementById('searchSector').value = '';
    selectedActivityFilter = 'all';
    showExpiredOnly = false;
    showSuspendedOnly = false;
    selectedYears = [];
    document.getElementById('btnExpiredFilter').classList.remove('active');
    document.getElementById('btnSuspendedFilter').classList.remove('active');
    updateActivityBookmarkUI();
    document.getElementById('yearDropdownLabel').textContent = '-- الكل --';
    // Uncheck all year checkboxes
    document.querySelectorAll('#yearDropdownMenu input[type="checkbox"]').forEach(cb => cb.checked = false);
    loadCompanies();
}

function setActivityFilter(filterKey) {
    if (!filterKey || selectedActivityFilter === filterKey) return;
    selectedActivityFilter = filterKey;
    updateActivityBookmarkUI();
    renderTable();
}

function updateActivityBookmarkUI() {
    const buttons = document.querySelectorAll('#activityBookmarks [data-activity-filter]');
    buttons.forEach((button) => {
        const filterKey = button.getAttribute('data-activity-filter');
        button.classList.toggle('active', filterKey === selectedActivityFilter);
    });
}

// ===== Expired Filter Toggle =====
function toggleExpiredFilter() {
    showExpiredOnly = !showExpiredOnly;
    document.getElementById('btnExpiredFilter').classList.toggle('active', showExpiredOnly);
    renderTable();
}

// ===== Suspended Filter Toggle =====
function toggleSuspendedFilter() {
    showSuspendedOnly = !showSuspendedOnly;
    document.getElementById('btnSuspendedFilter').classList.toggle('active', showSuspendedOnly);
    renderTable();
}

// ===== Year Checkbox Dropdown =====
function populateYearDropdown() {
    const years = new Set();
    companies.forEach(c => {
        if (c.renewal_date) {
            const y = c.renewal_date.split('-')[0];
            if (y && y.length === 4) years.add(y);
        }
    });
    const sorted = [...years].sort((a, b) => b - a);
    const menu = document.getElementById('yearDropdownMenu');
    menu.innerHTML = sorted.map(y => `
        <label class="year-dropdown-item">
            <input type="checkbox" value="${y}" onchange="onYearCheckChange()" ${selectedYears.includes(y) ? 'checked' : ''}>
            <span>${toArabic(y)}</span>
        </label>
    `).join('');
}

function toggleYearDropdown() {
    const menu = document.getElementById('yearDropdownMenu');
    menu.classList.toggle('hidden');
}

function onYearCheckChange() {
    const checks = document.querySelectorAll('#yearDropdownMenu input[type="checkbox"]:checked');
    selectedYears = Array.from(checks).map(cb => cb.value);
    const label = document.getElementById('yearDropdownLabel');
    if (selectedYears.length === 0) {
        label.textContent = '-- الكل --';
    } else {
        label.textContent = selectedYears.map(y => toArabic(y)).join(', ');
    }
    renderTable();
}

// Close year dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('yearDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        document.getElementById('yearDropdownMenu').classList.add('hidden');
    }
});

// ===== Dynamic Station Dropdown =====
function updateStationDropdown() {
    const sectorSelect = document.getElementById('fSector');
    const stationSelect = document.getElementById('fStation');
    const selectedSector = sectorSelect.value;

    // Clear existing options
    stationSelect.innerHTML = '';

    if (!selectedSector || !sectorStations[selectedSector]) {
        stationSelect.innerHTML = '<option value="">-- اختر القطاع أولاً --</option>';
        return;
    }

    stationSelect.innerHTML = '<option value="">-- اختر القسم --</option>';
    for (const station of sectorStations[selectedSector]) {
        const opt = document.createElement('option');
        opt.value = station;
        opt.textContent = station;
        stationSelect.appendChild(opt);
    }
}

// ===== View Company =====
async function viewCompany(id, activeTabId = 'tab-basic') {
    try {
        const res = await fetch(`${API}/companies/${id}`);
        const data = await res.json();
        currentCompanyId = data.id;
        isNewMode = false;
        boardMembers = data.board_members || [];
        populateForm(data);
        setFormDisabled(true);
        showViewMode();
        openModal('viewModal', activeTabId);
    } catch (err) {
        console.error('Error loading company:', err);
    }
}

async function quickEditCompany(id) {
    await viewCompany(id);
    toggleEdit();
}

function parseGuardedLocations(rawValue) {
    const raw = (rawValue || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    site_name: String(item.site_name || '').trim(),
                    site_address: String(item.site_address || '').trim(),
                    director_name: String(item.director_name || item.specialist_name || '').trim(),
                    guard_count: String(item.guard_count ?? '').trim(),
                    site_sector: String(item.site_sector || '').trim(),
                    site_station: String(item.site_station || '').trim()
                }))
                .filter(item => item.site_name || item.site_address || item.director_name || item.guard_count || item.site_sector || item.site_station);
        }
    } catch (e) {
    }

    return [{
        site_name: raw,
        site_address: '',
        director_name: '',
        guard_count: '',
        site_sector: '',
        site_station: ''
    }];
}

function parseGuardLicenses(rawValue) {
    const raw = (rawValue || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    license_number: (item.license_number || '').trim(),
                    guard_name: (item.guard_name || '').trim(),
                    activity_type: (item.activity_type || '').trim(),
                    weapon_license_number: (item.weapon_license_number || '').trim(),
                    weapon_statement: (item.weapon_statement || '').trim(),
                    weapon_expiry_date: (item.weapon_expiry_date || '').trim(),
                    issue_date: (item.issue_date || '').trim(),
                    renewal_date: (item.renewal_date || '').trim(),
                    sector: (item.sector || '').trim(),
                    station: (item.station || '').trim()
                }))
                .filter(item => item.license_number || item.guard_name || item.activity_type || item.weapon_license_number || item.weapon_statement || item.weapon_expiry_date || item.sector || item.station);
        }
    } catch (e) {
    }

    return [{
        license_number: raw,
        guard_name: '',
        activity_type: '',
        weapon_license_number: '',
        weapon_statement: '',
        weapon_expiry_date: '',
        issue_date: '',
        renewal_date: '',
        sector: '',
        station: ''
    }];
}

function normalizeCompanyCar(item = {}) {
    return {
        id: item.id || null,
        car_number: String(item.car_number || '').trim(),
        car_renewal_date: String(item.car_renewal_date || '').trim(),
        car_type: String(item.car_type || '').trim(),
        car_image: String(item.car_image || '').trim()
    };
}

function sortGuardLicensesAsc() {
    guardLicenses.sort((left, right) => {
        const leftValue = toWestern((left.license_number || '').trim());
        const rightValue = toWestern((right.license_number || '').trim());
        return leftValue.localeCompare(rightValue, 'ar', { numeric: true, sensitivity: 'base' });
    });
}

// ===== Add New Company =====
function openAddModal() {
    currentCompanyId = null;
    isNewMode = true;
    boardMembers = [];
    companyCars = [];
    basicInfoAttachments = createEmptyBasicInfoAttachmentsState();
    selectedBasicInfoAttachmentIndexes = createEmptyBasicInfoAttachmentSelectionState();
    clearForm();
    setFormDisabled(false);
    showEditMode();
    document.getElementById('modalTitle').textContent = 'إضافة شركة جديدة';
    openModal('viewModal');
}

// ===== Populate Form =====
function populateForm(data) {
    document.getElementById('companyId').value = data.id || '';
    document.getElementById('fCompanyName').value = data.company_name || '';
    document.getElementById('fLicenseNumber').value = data.license_number || '';
    document.getElementById('fIssueDate').value = isoToArabicDate(data.issue_date);
    document.getElementById('fRenewalDate').value = isoToArabicDate(data.renewal_date);
    document.getElementById('fActivityType').value = data.activity_type || '';
    document.getElementById('fSector').value = data.sector || '';
    updateStationDropdown();
    document.getElementById('fStation').value = data.station || '';
    document.getElementById('fHeadquarters').value = data.headquarters_address || '';
    document.getElementById('fCompanyStatus').value = data.company_status || 'تعمل';
    document.getElementById('fNotes').value = data.notes || '';
    document.getElementById('fBranches').value = data.branches || '';
    document.getElementById('guardedSearchInput').value = '';
    populateGuardedDirectorFilterOptions();
    document.getElementById('guardedSearchSector').value = '';
    guardedLocations = parseGuardedLocations(data.guarded_locations);
    renderGuardedLocations();
    guardLicenses = parseGuardLicenses(data.guard_licenses);
    sortGuardLicensesAsc();
    renderGuardLicenses();
    document.getElementById('guardLicenseSearchNumber').value = '';
    document.getElementById('guardLicenseSearchName').value = '';
    document.getElementById('guardLicenseSearchSector').value = '';
    document.getElementById('guardLicenseSearchActivity').value = '';
    companyCars = Array.isArray(data.company_cars) ? data.company_cars.map(normalizeCompanyCar) : [];
    document.getElementById('companyCarsSearchNumber').value = '';
    document.getElementById('companyCarsSearchYear').value = '';
    document.getElementById('companyCarsSearchType').value = '';
    renderCompanyCars();
    setBasicInfoAttachmentsFromData(data);
    // GPS link
    document.getElementById('fGpsLink').value = data.gps_link || '';
    // Clear QR preview
    document.getElementById('qrPreviewContainer').innerHTML = '';
    // Inspections
    inspections = data.inspections || [];
    renderInspections();
    renderMembers();
}

function clearForm() {
    document.getElementById('companyId').value = '';
    document.getElementById('fCompanyName').value = '';
    document.getElementById('fLicenseNumber').value = '';
    document.getElementById('fIssueDate').value = '';
    document.getElementById('fRenewalDate').value = '';
    document.getElementById('fActivityType').value = '';
    document.getElementById('fSector').value = '';
    updateStationDropdown();
    document.getElementById('fStation').value = '';
    document.getElementById('fHeadquarters').value = '';
    document.getElementById('fCompanyStatus').value = 'تعمل';
    document.getElementById('fNotes').value = '';
    document.getElementById('fBranches').value = '';
    document.getElementById('guardedSearchInput').value = '';
    populateGuardedDirectorFilterOptions();
    document.getElementById('guardedSearchSector').value = '';
    guardedLocations = [];
    renderGuardedLocations();
    guardLicenses = [];
    renderGuardLicenses();
    document.getElementById('guardLicenseSearchNumber').value = '';
    document.getElementById('guardLicenseSearchName').value = '';
    document.getElementById('guardLicenseSearchSector').value = '';
    document.getElementById('guardLicenseSearchActivity').value = '';
    companyCars = [];
    document.getElementById('companyCarsSearchNumber').value = '';
    document.getElementById('companyCarsSearchYear').value = '';
    document.getElementById('companyCarsSearchType').value = '';
    renderCompanyCars();
    basicInfoAttachments = createEmptyBasicInfoAttachmentsState();
    selectedBasicInfoAttachmentIndexes = createEmptyBasicInfoAttachmentSelectionState();
    renderAllBasicInfoAttachmentZones();
    // Clear GPS link & QR preview
    document.getElementById('fGpsLink').value = '';
    document.getElementById('qrPreviewContainer').innerHTML = '';
    clearDuplicateUI();
    // Clear inspections
    inspections = [];
    selectedInspections.clear();
    closeInspectionFilesFrame();
    renderInspections();
    boardMembers = [];
    renderMembers();
}

function getBasicAttachmentLetter(index) {
    const normalizedIndex = Math.max(0, Number(index) || 0);
    let value = normalizedIndex;
    let result = '';
    while (value >= 0) {
        result = String.fromCharCode(65 + (value % 26)) + result;
        value = Math.floor(value / 26) - 1;
    }
    return result;
}

function buildBasicAttachmentUrl(type, filePath) {
    const config = basicInfoAttachmentConfig[type];
    return config && filePath ? `${config.urlPrefix}${encodeURIComponent(filePath)}` : '';
}

function decodeAttachmentDisplayName(value) {
    const raw = String(value || '').trim();
    if (!raw || /[\u0600-\u06FF]/.test(raw)) return raw;

    try {
        const bytes = Uint8Array.from(Array.from(raw, (char) => char.charCodeAt(0) & 0xff));
        const decoded = new TextDecoder('utf-8').decode(bytes).trim();
        if (decoded && decoded !== raw && /[\u0600-\u06FF]/.test(decoded)) {
            return decoded;
        }
    } catch (_) {
    }

    return raw;
}

function normalizeBasicInfoAttachment(item = {}, fallbackType = '') {
    const attachmentType = String(item.attachment_type || fallbackType || '').trim();
    const filePath = String(item.file_path || '').trim();
    const fileUrl = String(item.file_url || '').trim() || buildBasicAttachmentUrl(attachmentType, filePath);

    return {
        id: item.id || null,
        company_id: item.company_id || null,
        attachment_type: attachmentType,
        file_path: filePath,
        original_name: decodeAttachmentDisplayName(item.original_name || filePath || ''),
        sort_order: Number(item.sort_order || 0),
        file_url: fileUrl,
        is_legacy_fallback: !!item.is_legacy_fallback
    };
}

function buildLegacyBasicInfoAttachment(type, filename) {
    if (!filename) return null;
    return normalizeBasicInfoAttachment({
        id: null,
        attachment_type: type,
        file_path: filename,
        original_name: filename,
        sort_order: 0,
        is_legacy_fallback: true
    }, type);
}

function setBasicInfoAttachmentsFromData(data = {}) {
    basicInfoAttachments = createEmptyBasicInfoAttachmentsState();
    selectedBasicInfoAttachmentIndexes = createEmptyBasicInfoAttachmentSelectionState();

    const attachmentRows = Array.isArray(data.basic_info_attachments) ? data.basic_info_attachments : [];
    attachmentRows.forEach((row) => {
        const normalized = normalizeBasicInfoAttachment(row, row.attachment_type);
        if (!normalized.attachment_type || !basicInfoAttachments[normalized.attachment_type]) return;
        basicInfoAttachments[normalized.attachment_type].push(normalized);
    });

    Object.keys(basicInfoAttachmentConfig).forEach((type) => {
        basicInfoAttachments[type].sort((left, right) => {
            const leftOrder = Number(left.sort_order || 0);
            const rightOrder = Number(right.sort_order || 0);
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return Number(left.id || 0) - Number(right.id || 0);
        });

        if (basicInfoAttachments[type].length === 0) {
            const legacyAttachment = buildLegacyBasicInfoAttachment(type, data[type] || '');
            if (legacyAttachment) {
                basicInfoAttachments[type] = [legacyAttachment];
            }
        }
    });

    renderAllBasicInfoAttachmentZones();
}

function setSingleBasicAttachmentFallback(type, filename) {
    const currentAttachments = basicInfoAttachments[type] || [];
    const hasManagedAttachments = currentAttachments.some((attachment) => !attachment.is_legacy_fallback);

    if (!filename) {
        basicInfoAttachments[type] = hasManagedAttachments
            ? currentAttachments.filter((attachment) => !attachment.is_legacy_fallback)
            : [];
        selectedBasicInfoAttachmentIndexes[type] = 0;
        renderBasicInfoAttachmentZone(type);
        return;
    }

    if (hasManagedAttachments) {
        renderBasicInfoAttachmentZone(type);
        return;
    }

    basicInfoAttachments[type] = [buildLegacyBasicInfoAttachment(type, filename)];
    selectedBasicInfoAttachmentIndexes[type] = 0;
    renderBasicInfoAttachmentZone(type);
}

function getSelectedBasicAttachment(type) {
    const attachments = basicInfoAttachments[type] || [];
    if (!attachments.length) return null;

    const maxIndex = attachments.length - 1;
    const selectedIndex = Math.min(Math.max(Number(selectedBasicInfoAttachmentIndexes[type] || 0), 0), maxIndex);
    selectedBasicInfoAttachmentIndexes[type] = selectedIndex;
    return attachments[selectedIndex];
}

function getBasicAttachmentDisplayName(attachment, index) {
    const rawName = String(attachment?.original_name || attachment?.file_path || '').trim();
    return rawName || `مرفق ${getBasicAttachmentLetter(index)}`;
}

function getBasicAttachmentShortName(attachment, index) {
    const displayName = getBasicAttachmentDisplayName(attachment, index);
    return displayName.length > 18 ? `${displayName.slice(0, 18)}...` : displayName;
}

function isBasicAttachmentPdf(attachment) {
    if (!attachment) return false;
    return isPdfSource(attachment.file_url || attachment.file_path || attachment.original_name || '');
}

function requestBasicAttachmentPdfRefresh(type, attachment) {
    return;
}

function renderBasicAttachmentPreview(type) {
    const config = basicInfoAttachmentConfig[type];
    const preview = document.getElementById(config.previewId);
    const placeholder = document.getElementById(config.placeholderId);
    const selectedAttachment = getSelectedBasicAttachment(type);

    if (!preview || !placeholder) return;

    if (!selectedAttachment || !selectedAttachment.file_url) {
        preview.classList.remove('has-image');
        preview.innerHTML = '';
        placeholder.style.display = '';
        return;
    }

    preview.classList.add('has-image');
    placeholder.style.display = 'none';

    if (isBasicAttachmentPdf(selectedAttachment)) {
        preview.innerHTML = `
            <div class="attachment-preview-file" onclick="openBasicAttachmentFull('${type}')">
                <i class="fas fa-file-pdf"></i>
                <div class="attachment-preview-name">${esc(getBasicAttachmentDisplayName(selectedAttachment, selectedBasicInfoAttachmentIndexes[type] || 0))}</div>
            </div>
        `;
        return;
    }

    preview.innerHTML = `<img src="${esc(selectedAttachment.file_url)}" alt="${esc(config.openLabel)}" onclick="openBasicAttachmentFull('${type}')">`;
}

function renderBasicInfoAttachmentZone(type) {
    const config = basicInfoAttachmentConfig[type];
    const list = document.getElementById(config.listId);
    const attachments = basicInfoAttachments[type] || [];

    renderBasicAttachmentPreview(type);

    if (!list) return;

    if (!attachments.length) {
        list.innerHTML = '';
        list.classList.add('hidden');
        return;
    }

    const activeIndex = Math.min(Math.max(Number(selectedBasicInfoAttachmentIndexes[type] || 0), 0), attachments.length - 1);
    selectedBasicInfoAttachmentIndexes[type] = activeIndex;
    list.classList.remove('hidden');
    list.innerHTML = attachments.map((attachment, index) => {
        const letter = getBasicAttachmentLetter(index);
        const activeClass = activeIndex === index ? 'active' : '';
        const thumbMarkup = isBasicAttachmentPdf(attachment)
            ? `<div class="attachment-chip-thumb pdf"><i class="fas fa-file-pdf"></i></div>`
            : `<div class="attachment-chip-thumb"><img src="${esc(attachment.file_url)}" alt="${esc(getBasicAttachmentDisplayName(attachment, index))}"></div>`;

        return `
            <button type="button" class="attachment-chip ${activeClass}" onclick="selectBasicAttachment('${type}', ${index})" title="${esc(getBasicAttachmentDisplayName(attachment, index))}">
                ${thumbMarkup}
                <div class="attachment-chip-meta">
                    <span class="attachment-chip-letter">${esc(letter)}</span>
                    <span class="attachment-chip-name">${esc(getBasicAttachmentShortName(attachment, index))}</span>
                </div>
            </button>
        `;
    }).join('');

}

function renderAllBasicInfoAttachmentZones() {
    Object.keys(basicInfoAttachmentConfig).forEach((type) => {
        renderBasicInfoAttachmentZone(type);
    });
}

function selectBasicAttachment(type, index) {
    selectedBasicInfoAttachmentIndexes[type] = Number(index) || 0;
    renderBasicInfoAttachmentZone(type);
}

function getLegacyBasicAttachmentDeleteEndpoint(type) {
    const legacyRoutes = {
        company_image: `${API}/companies/${currentCompanyId}/company-image`,
        licensed_uniform: `${API}/companies/${currentCompanyId}/uniform`,
        license_image: `${API}/companies/${currentCompanyId}/license-image`,
        company_logo: `${API}/companies/${currentCompanyId}/company-logo`,
        gps_image: `${API}/companies/${currentCompanyId}/gps-image`
    };
    return legacyRoutes[type] || '';
}

function applyBasicAttachmentList(type, attachments, preferredIndex = null) {
    basicInfoAttachments[type] = Array.isArray(attachments)
        ? attachments.map((attachment) => normalizeBasicInfoAttachment(attachment, type))
        : [];
    basicInfoAttachments[type].sort((left, right) => {
        const leftOrder = Number(left.sort_order || 0);
        const rightOrder = Number(right.sort_order || 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return Number(left.id || 0) - Number(right.id || 0);
    });

    const attachmentCount = basicInfoAttachments[type].length;
    if (attachmentCount === 0) {
        selectedBasicInfoAttachmentIndexes[type] = 0;
    } else if (preferredIndex === null || preferredIndex === undefined) {
        selectedBasicInfoAttachmentIndexes[type] = Math.min(selectedBasicInfoAttachmentIndexes[type] || 0, attachmentCount - 1);
    } else {
        selectedBasicInfoAttachmentIndexes[type] = Math.min(Math.max(Number(preferredIndex) || 0, 0), attachmentCount - 1);
    }

    renderBasicInfoAttachmentZone(type);
}

async function uploadBasicAttachments(type, files) {
    if (!currentCompanyId) return;
    const safeFiles = Array.from(files || []);
    if (!safeFiles.length) return;

    try {
        const formData = new FormData();
        safeFiles.forEach((file) => {
            formData.append('files', file);
        });

        const previousCount = (basicInfoAttachments[type] || []).length;
        const res = await fetch(`${API}/companies/${currentCompanyId}/basic-info-attachments/${type}`, {
            method: 'POST',
            body: formData
        });

        const result = await res.json();
        if (!res.ok) {
            alert(result.error || 'حدث خطأ أثناء الرفع');
            return;
        }

        const preferredIndex = Math.max(previousCount, (result.attachments || []).length - 1);
        applyBasicAttachmentList(type, result.attachments || [], preferredIndex);
    } catch (err) {
        console.error('Basic attachments upload error:', err);
        alert('حدث خطأ أثناء رفع المرفقات');
    }
}

async function deleteSelectedBasicAttachment(type) {
    if (!currentCompanyId) return;

    const attachment = getSelectedBasicAttachment(type);
    if (!attachment) return;
    if (!confirm('هل تريد حذف المرفق المحدد؟')) return;

    try {
        if (attachment.id) {
            const res = await fetch(`${API}/basic-info-attachments/${attachment.id}`, {
                method: 'DELETE'
            });

            const result = await res.json();
            if (!res.ok) {
                alert(result.error || 'حدث خطأ أثناء الحذف');
                return;
            }

            applyBasicAttachmentList(type, result.attachments || [], selectedBasicInfoAttachmentIndexes[type]);
            return;
        }

        const legacyEndpoint = getLegacyBasicAttachmentDeleteEndpoint(type);
        if (!legacyEndpoint) return;
        const res = await fetch(legacyEndpoint, { method: 'DELETE' });
        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
            alert(result.error || 'حدث خطأ أثناء الحذف');
            return;
        }

        applyBasicAttachmentList(type, [], 0);
    } catch (err) {
        console.error('Basic attachments delete error:', err);
        alert('حدث خطأ أثناء حذف المرفق');
    }
}

function openBasicAttachmentFull(type) {
    const attachment = getSelectedBasicAttachment(type);
    if (attachment?.file_url) {
        window.open(attachment.file_url, '_blank');
    }
}

function handleBasicAttachmentFiles(type, input, saveFirstMessage) {
    const files = Array.from(input?.files || []);
    if (!files.length) return;

    if (isNewMode && !currentCompanyId) {
        alert(saveFirstMessage);
        input.value = '';
        return;
    }

    uploadBasicAttachments(type, files);
    input.value = '';
}

// ===== Company Image Helpers =====
function setCompanyImage(filename) {
    setSingleBasicAttachmentFallback('company_image', filename);
}

function openCompanyImageFull() {
    openBasicAttachmentFull('company_image');
}

function handleCompanyImageFile(input) {
    handleBasicAttachmentFiles('company_image', input, 'يرجى حفظ الشركة أولاً قبل رفع الصورة');
}

async function removeCompanyImage() {
    await deleteSelectedBasicAttachment('company_image');
}

// ===== Company Logo Helpers =====
function setCompanyLogo(filename) {
    setSingleBasicAttachmentFallback('company_logo', filename);
}

function openCompanyLogoFull() {
    openBasicAttachmentFull('company_logo');
}

function handleCompanyLogoFile(input) {
    handleBasicAttachmentFiles('company_logo', input, 'يرجى حفظ الشركة أولاً قبل رفع الشعار');
}

async function removeCompanyLogo() {
    await deleteSelectedBasicAttachment('company_logo');
}

// ===== GPS Image Helpers =====
function setGpsImage(filename) {
    setSingleBasicAttachmentFallback('gps_image', filename);
}

function openGpsImageFull() {
    openBasicAttachmentFull('gps_image');
}

function handleGpsImageFile(input) {
    handleBasicAttachmentFiles('gps_image', input, 'يرجى حفظ الشركة أولاً قبل رفع الصورة');
}

async function removeGpsImage() {
    await deleteSelectedBasicAttachment('gps_image');
}

// ===== QR Code Generation =====
async function generateAndSaveQR() {
    const link = document.getElementById('fGpsLink').value.trim();
    if (!link) {
        alert('يرجى لصق رابط GPS أولاً');
        document.getElementById('fGpsLink').focus();
        return;
    }

    if (!currentCompanyId) {
        alert('يرجى حفظ الشركة أولاً');
        return;
    }

    if (typeof QRCode === 'undefined') {
        alert('مكتبة QR Code غير متاحة. تأكد من الاتصال بالإنترنت أو وجود الملف المحلي.');
        return;
    }

    // Clear previous QR
    const container = document.getElementById('qrPreviewContainer');
    container.innerHTML = '';

    // Generate QR code (256x256)
    new QRCode(container, {
        text: link,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    // Wait for canvas to render
    await new Promise(r => setTimeout(r, 300));

    const canvas = container.querySelector('canvas');
    if (!canvas) {
        alert('فشل في إنشاء QR Code');
        return;
    }

    // Convert canvas to blob and upload
    canvas.toBlob(async (blob) => {
        if (!blob) {
            alert('فشل في إنشاء صورة QR Code');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('qr_image', blob, 'qrcode.jpg');

            const res = await fetch(`${API}/companies/${currentCompanyId}/qr-code`, {
                method: 'POST',
                body: formData
            });

            const result = await res.json();
            if (res.ok) {
                setGpsImage(result.filename);
                alert('تم حفظ QR Code بنجاح');
            } else {
                alert(result.error || 'حدث خطأ أثناء حفظ QR Code');
            }
        } catch (err) {
            console.error('Save QR code error:', err);
            alert('حدث خطأ أثناء حفظ QR Code');
        }
    }, 'image/jpeg', 0.95);
}

// ===== Uniform Image Helpers =====
function setUniformImage(filename) {
    setSingleBasicAttachmentFallback('licensed_uniform', filename);
}

function openUniformFull() {
    openBasicAttachmentFull('licensed_uniform');
}

function handleUniformFile(input) {
    handleBasicAttachmentFiles('licensed_uniform', input, 'يرجى حفظ الشركة أولاً قبل رفع الصورة');
}

async function removeUniform() {
    await deleteSelectedBasicAttachment('licensed_uniform');
}

// ===== License Image Helpers =====
function setLicenseImage(filename) {
    setSingleBasicAttachmentFallback('license_image', filename);
}

function openLicenseFull() {
    openBasicAttachmentFull('license_image');
}

function handleLicenseFile(input) {
    handleBasicAttachmentFiles('license_image', input, 'يرجى حفظ الشركة أولاً قبل رفع الصورة');
}

async function removeLicenseImage() {
    await deleteSelectedBasicAttachment('license_image');
}

function getBasicInfoPrintFieldValue(id, fallback = '---') {
    const el = document.getElementById(id);
    const value = (el?.value || '').trim();
    return value || fallback;
}

function convertRenderedImageToDataUrl(img) {
    if (!img || !img.src || img.src.endsWith('/')) return '';

    try {
        if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
            return '';
        }

        const maxWidth = 900;
        const maxHeight = 520;
        const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error('Print image snapshot error:', err);
        return '';
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الملف'));
        reader.readAsDataURL(blob);
    });
}

async function loadImageSourceToDataUrl(src) {
    if (!src) return '';

    try {
        const response = await fetch(src);
        if (!response.ok) return '';
        const blob = await response.blob();
        return await blobToDataUrl(blob);
    } catch (err) {
        console.error('Print image load error:', err);
        return '';
    }
}

function isPdfSource(src) {
    try {
        const url = new URL(src, window.location.href);
        return url.pathname.toLowerCase().endsWith('.pdf');
    } catch (_) {
        return String(src || '').toLowerCase().includes('.pdf');
    }
}

let pdfJsModulePromise = null;

async function loadPdfJsModule() {
    if (!pdfJsModulePromise) {
        pdfJsModulePromise = (async () => {
            const moduleCandidates = [
                {
                    moduleSrc: '/company/vendor/pdfjs/legacy/build/pdf.mjs',
                    workerSrc: '/company/vendor/pdfjs/legacy/build/pdf.worker.mjs'
                },
                {
                    moduleSrc: '/company/vendor/pdfjs/build/pdf.mjs',
                    workerSrc: '/company/vendor/pdfjs/build/pdf.worker.mjs'
                }
            ];

            let lastError = null;
            for (const candidate of moduleCandidates) {
                try {
                    const module = await import(candidate.moduleSrc);
                    const pdfjsLib = module.default || module;
                    pdfjsLib.GlobalWorkerOptions.workerSrc = candidate.workerSrc;
                    return pdfjsLib;
                } catch (err) {
                    lastError = err;
                }
            }

            throw lastError || new Error('تعذر تحميل مكتبة PDF');
        })();
    }
    return pdfJsModulePromise;
}

let basicInfoPrintPdfRenderingEnabled = false;

async function renderPdfSourceToDataUrls(src, options = {}) {
    if (!basicInfoPrintPdfRenderingEnabled) {
        return [];
    }

    if (!src) return [];

    try {
        const maxPages = Math.max(1, Number(options.maxPages || Number.POSITIVE_INFINITY));
        const targetWidth = Math.max(120, Number(options.targetWidth || 720));
        const pdfjsLib = await loadPdfJsModule();
        const pdfUrl = new URL(src, window.location.href).href;
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
            throw new Error(`PDF fetch failed with status ${pdfResponse.status}`);
        }
        const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
        const loadingTask = pdfjsLib.getDocument({
            data: pdfBytes,
            cMapUrl: '/company/vendor/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/company/vendor/pdfjs/standard_fonts/'
        });
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages && pageNumber <= maxPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = Math.min(targetWidth / baseViewport.width, 1.25);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d');
            if (!context) continue;

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            pages.push(canvas.toDataURL('image/png'));
        }

        return pages;
    } catch (err) {
        console.error('PDF print render error:', err);
        return [];
    }
}

function getCachedPdfThumbnail(src) {
    return basicAttachmentPdfThumbnailCache.get(src) || '';
}

function ensurePdfThumbnail(src) {
    if (!src) return Promise.resolve('');
    if (basicAttachmentPdfThumbnailCache.has(src)) {
        return Promise.resolve(basicAttachmentPdfThumbnailCache.get(src) || '');
    }
    if (basicAttachmentPdfThumbnailPromises.has(src)) {
        return basicAttachmentPdfThumbnailPromises.get(src);
    }

    const promise = renderPdfSourceToDataUrls(src, { maxPages: 1, targetWidth: 280 })
        .then((pages) => {
            const thumbnail = pages[0] || '';
            basicAttachmentPdfThumbnailCache.set(src, thumbnail);
            return thumbnail;
        })
        .catch((err) => {
            console.error('PDF thumbnail render error:', err);
            return '';
        })
        .finally(() => {
            basicAttachmentPdfThumbnailPromises.delete(src);
        });

    basicAttachmentPdfThumbnailPromises.set(src, promise);
    return promise;
}

async function collectBasicInfoPrintAttachmentGroup(type) {
    const config = basicInfoAttachmentConfig[type];
    const attachments = (basicInfoAttachments[type] || []).filter((attachment) => attachment?.file_url);

    const items = [];
    for (let index = 0; index < attachments.length; index += 1) {
        const attachment = attachments[index];
        const label = `المرفق ${getBasicAttachmentLetter(index)}`;

        if (isBasicAttachmentPdf(attachment)) {
            let pdfPages = [];
            basicInfoPrintPdfRenderingEnabled = true;
            try {
                pdfPages = await renderPdfSourceToDataUrls(attachment.file_url);
            } finally {
                basicInfoPrintPdfRenderingEnabled = false;
            }
            items.push({
                label,
                name: getBasicAttachmentDisplayName(attachment, index),
                pages: pdfPages,
                emptyText: 'تعذر تحميل ملف PDF',
                isDocument: true
            });
            continue;
        }

        const imageDataUrl = await loadImageSourceToDataUrl(attachment.file_url);
        items.push({
            label,
            name: getBasicAttachmentDisplayName(attachment, index),
            pages: imageDataUrl ? [imageDataUrl] : [],
            emptyText: 'تعذر تحميل الصورة',
            isDocument: false
        });
    }

    return {
        label: config.openLabel,
        emptyText: config.emptyText,
        items
    };
}

async function collectBasicInfoPrintQrImage() {
    const qrCanvas = document.querySelector('#qrPreviewContainer canvas');
    if (qrCanvas) {
        return {
            label: 'QR Code',
            pages: [qrCanvas.toDataURL('image/png')],
            emptyText: 'لا يوجد QR',
            isDocument: false
        };
    }

    const qrImage = document.querySelector('#qrPreviewContainer img');
    const qrImageSrc = qrImage?.src && !qrImage.src.endsWith('/') ? qrImage.src : '';
    const qrImageDataUrl = qrImageSrc ? (await loadImageSourceToDataUrl(qrImageSrc)) || convertRenderedImageToDataUrl(qrImage) : '';
    return {
        label: 'QR Code',
        pages: qrImageDataUrl ? [qrImageDataUrl] : [],
        emptyText: 'لا يوجد QR',
        isDocument: false
    };
}

async function buildBasicInfoPrintHtml() {
    const printDate = (() => {
        const now = new Date();
        const y = String(now.getFullYear());
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return toArabic(`${y}/${m}/${d} ${hh}:${mm}`);
    })();

    const fields = [
        { label: 'اسم الشركة', value: getBasicInfoPrintFieldValue('fCompanyName') },
        { label: 'رقم الرخصة', value: toArabic(getBasicInfoPrintFieldValue('fLicenseNumber')) },
        { label: 'تاريخ الاصدار', value: getBasicInfoPrintFieldValue('fIssueDate') },
        { label: 'تاريخ التجديد', value: getBasicInfoPrintFieldValue('fRenewalDate') },
        { label: 'نوع النشاط', value: getBasicInfoPrintFieldValue('fActivityType') },
        { label: 'القطاع', value: getSectorLabel(document.getElementById('fSector')?.value || '') || '---' },
        { label: 'القسم', value: getBasicInfoPrintFieldValue('fStation') },
        { label: 'عنوان مقر الشركة', value: getBasicInfoPrintFieldValue('fHeadquarters') },
        { label: 'حالة الشركة', value: getBasicInfoPrintFieldValue('fCompanyStatus') },
        { label: 'اجمالي الحراس العاملين بالشركة', value: getBasicInfoPrintFieldValue('fBasicTotalGuards') },
        { label: 'اجمالي عدد المواقع', value: getBasicInfoPrintFieldValue('fTotalSites') },
        { label: 'اجمالي عدد السيارات النقل والاموال', value: getBasicInfoPrintFieldValue('fTotalCompanyCars') }
    ];

    const blocks = [
        { label: 'ملاحظات', value: getBasicInfoPrintFieldValue('fNotes') },
        { label: 'فروع', value: getBasicInfoPrintFieldValue('fBranches') },
        { label: 'رابط الموقع', value: getBasicInfoPrintFieldValue('fGpsLink') }
    ];

    const attachmentGroups = await Promise.all(
        Object.keys(basicInfoAttachmentConfig).map((type) => collectBasicInfoPrintAttachmentGroup(type))
    );
    const qrItem = await collectBasicInfoPrintQrImage();

    const boardMembersRows = boardMembers.length > 0
        ? boardMembers.map((member) => `
            <tr>
                <td>${esc(member.member_role || '---')}</td>
                <td>${esc(member.member_name || '---')}</td>
                <td>${esc(toArabic(member.member_phone || '---'))}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3">لا يوجد أعضاء مسجلين</td></tr>';

    const boardDensityClass = boardMembers.length > 12
        ? 'members-dense'
        : boardMembers.length > 7
            ? 'members-compact'
            : '';
    const densityCss = boardDensityClass
        ? `
        .sheet.${boardDensityClass} .board-table th,
        .sheet.${boardDensityClass} .board-table td {
            padding: 4px 7px;
            font-size: 10px;
        }
        .sheet.members-dense .field-value,
        .sheet.members-dense .block-value {
            font-size: 10px;
        }`
        : '';
    const hasExpandedMediaLayout = attachmentGroups.some(group =>
        group.items.length > 1 || group.items.some(item => item.isDocument && item.pages.length > 1)
    );
    const imagesMarkup = attachmentGroups.map(group => {
        const groupHasDocuments = group.items.some(item => item.isDocument && item.pages.length > 1);
        const groupNeedsExpansion = groupHasDocuments || group.items.length > 1;
        const itemsMarkup = group.items.length > 0
            ? group.items.map(item => {
                const documentPagesGridClass = item.isDocument && item.pages.length > 1 ? 'document-pages-grid' : '';
                const documentItemClass = item.isDocument ? 'document-item' : '';
                const captionText = group.items.length > 1
                    ? `${item.label} | ${item.name || item.label}`
                    : (item.name || item.label);

                return `
                    <div class="attachment-print-item ${documentItemClass}">
                        <div class="attachment-print-caption">${esc(captionText)}</div>
                        <div class="attachment-print-media ${documentPagesGridClass}">
                            ${item.pages.length > 0
                                ? item.isDocument
                                    ? item.pages.map((pageSrc, pageIndex) => `
                                        <div class="document-page">
                                            <img src="${esc(pageSrc)}" alt="${esc(item.name || item.label)} صفحة ${toArabic(pageIndex + 1)}">
                                            ${item.pages.length > 1 ? `<span class="document-page-label">صفحة ${toArabic(pageIndex + 1)}</span>` : ''}
                                        </div>
                                    `).join('')
                                    : `<img src="${esc(item.pages[0])}" alt="${esc(item.name || item.label)}">`
                                : `<div class="image-placeholder">${esc(item.emptyText)}</div>`
                            }
                        </div>
                    </div>
                `;
            }).join('')
            : `<div class="image-placeholder">${esc(group.emptyText)}</div>`;

        return `
            <div class="image-group-card ${groupNeedsExpansion ? 'expanded-group' : 'compact-group'} ${groupHasDocuments ? 'document-group' : ''}">
                <div class="image-label">${esc(group.label)}</div>
                <div class="image-group-body">
                    ${itemsMarkup}
                </div>
            </div>
        `;
    }).join('');
    const qrMarkup = `
        <div class="image-group-card compact-group">
            <div class="image-label">${esc(qrItem.label)}</div>
            <div class="image-group-body">
                ${qrItem.pages.length > 0
                    ? `
                        <div class="attachment-print-item">
                            <div class="attachment-print-caption">${esc(qrItem.label)}</div>
                            <div class="attachment-print-media">
                                <img src="${esc(qrItem.pages[0])}" alt="${esc(qrItem.label)}">
                            </div>
                        </div>
                    `
                    : `<div class="image-placeholder">${esc(qrItem.emptyText)}</div>`
                }
            </div>
        </div>
    `;
    const mediaMarkup = `${imagesMarkup}${qrMarkup}`;
    const detailsMarkup = `
        <div class="details-area">
            <div class="fields-grid">
                ${fields.map(field => `
                    <div class="field-card">
                        <div class="field-label">${esc(field.label)}</div>
                        <div class="field-value">${esc(field.value)}</div>
                    </div>
                `).join('')}
            </div>

            <div class="blocks-grid">
                ${blocks.map(block => `
                    <div class="block-card">
                        <div class="block-label">${esc(block.label)}</div>
                        <div class="block-value ${block.label === 'رابط الموقع' ? 'gps-link' : ''}">${esc(block.value)}</div>
                    </div>
                `).join('')}
            </div>

            <div class="board-card">
                <div class="board-title">مجلس الادارة</div>
                <table class="board-table">
                    <thead>
                        <tr>
                            <th>الصفة</th>
                            <th>الاسم</th>
                            <th>رقم التليفون</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${boardMembersRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>طباعة البيانات الأساسية</title>
    <style>
        
        @page {
            size: A4 landscape;
            margin: 7mm;
        }
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: 100%;
            background: #ffffff;
            color: #111827;
            font-family: 'Segoe UI', 'Segoe UI', Tahoma, sans-serif;
        }
        body {
            direction: rtl;
        }
        .sheet {
            width: 100%;
            min-height: 100%;
            padding: 2mm 6mm 0;
        }
        ${densityCss}
        .print-header {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: end;
            gap: 10px;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 2px solid #0f172a;
        }
        .print-title {
            font-size: 22px;
            font-weight: 800;
            margin: 0 0 2px;
            color: #0f172a;
        }
        .print-subtitle {
            font-size: 12px;
            color: #475569;
            font-weight: 700;
        }
        .print-date {
            font-size: 12px;
            font-weight: 700;
            color: #1e293b;
            white-space: nowrap;
        }
        .print-body {
            display: grid;
            grid-template-columns: 34% 66%;
            gap: 10px;
            align-items: start;
        }
        .print-body.stacked-layout {
            grid-template-columns: 1fr;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .image-group-card {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            overflow: hidden;
            background: #f8fafc;
            min-height: 104px;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .image-label {
            padding: 5px 8px;
            background: #e2e8f0;
            color: #0f172a;
            font-size: 11px;
            font-weight: 800;
            text-align: center;
        }
        .image-group-body {
            padding: 2px 3px 3px;
            display: grid;
            gap: 4px;
            align-items: start;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .image-group-card.compact-group .image-group-body {
            grid-template-columns: 1fr;
        }
        .image-group-card.expanded-group .image-group-body {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 3px;
            padding: 3px;
            align-items: start;
        }
        .image-group-card.document-group {
            grid-column: 1 / -1;
        }
        .image-group-card.expanded-group {
            justify-self: stretch;
            width: 100%;
            max-width: 100%;
            min-width: 0;
        }
        .attachment-print-item {
            display: grid;
            gap: 2px;
            align-content: start;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .image-group-card.expanded-group .attachment-print-item {
            width: 100%;
            max-width: 100%;
            min-width: 0;
        }
        .attachment-print-caption {
            padding: 0 2px;
            color: #475569;
            font-size: 9px;
            font-weight: 700;
            text-align: center;
            line-height: 1.3;
            word-break: break-word;
        }
        .attachment-print-media {
            min-height: 112px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            overflow: hidden;
        }
        .attachment-print-media img {
            width: 100%;
            height: auto;
            max-height: 220px;
            object-fit: contain;
            display: block;
        }
        .image-group-card.expanded-group .attachment-print-media {
            min-height: 0;
            align-items: center;
            justify-content: center;
        }
        .image-group-card.expanded-group .attachment-print-media img {
            width: auto;
            max-width: 100%;
            max-height: 200px;
            margin: 0 auto;
        }
        .attachment-print-media.document-pages-grid {
            min-height: 0;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4px;
            align-items: start;
            overflow: visible;
        }
        .attachment-print-media.document-pages-grid img {
            width: 100%;
            max-height: 190px;
        }
        .document-page {
            display: grid;
            gap: 2px;
            align-content: start;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .document-page-label {
            display: block;
            padding: 0 4px;
            color: #475569;
            font-size: 9px;
            font-weight: 700;
            text-align: center;
        }
        .image-placeholder {
            padding: 8px;
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 132px;
            background: transparent;
            border: 1px dashed #d7dee7;
            border-radius: 8px;
        }
        .image-placeholder-large {
            min-height: 120px;
        }
        .details-area {
            display: grid;
            gap: 8px;
        }
        .fields-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
        }
        .field-card,
        .block-card,
        .board-card {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #fff;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .field-label,
        .block-label,
        .board-title {
            padding: 5px 8px;
            background: #0f172a;
            color: #fff;
            font-size: 10px;
            font-weight: 800;
            text-align: center;
        }
        .field-value {
            min-height: 34px;
            padding: 6px 8px;
            font-size: 11px;
            font-weight: 700;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            word-break: break-word;
            line-height: 1.35;
        }
        .blocks-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
        }
        .block-value {
            min-height: 54px;
            padding: 7px 9px;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.45;
            white-space: pre-wrap;
            word-break: break-word;
            text-align: right;
        }
        .gps-link {
            direction: ltr;
            text-align: left;
            font-size: 10px;
        }
        .board-card {
            margin-top: 2px;
        }
        .board-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .board-table th,
        .board-table td {
            border: 1px solid #d7dee7;
            padding: 5px 8px;
            font-size: 11px;
            font-weight: 700;
            text-align: center;
            vertical-align: middle;
            line-height: 1.3;
            word-break: break-word;
        }
        .board-table th {
            background: #e2e8f0;
            color: #0f172a;
        }
        .board-table tbody tr:nth-child(even) {
            background: #f8fafc;
        }
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="sheet ${boardDensityClass}">
        <div class="print-header">
            <div>
                <h1 class="print-title">البيانات الأساسية</h1>
                <div class="print-subtitle">${esc(getBasicInfoPrintFieldValue('fCompanyName'))} | رخصة رقم ${esc(toArabic(getBasicInfoPrintFieldValue('fLicenseNumber')))}</div>
            </div>
            <div class="print-date">تاريخ الطباعة: ${esc(printDate)}</div>
        </div>

        <div class="print-body ${hasExpandedMediaLayout ? 'stacked-layout' : ''}">
            ${hasExpandedMediaLayout ? detailsMarkup : `<div class="image-grid">${mediaMarkup}</div>`}
            ${hasExpandedMediaLayout ? `<div class="image-grid">${mediaMarkup}</div>` : detailsMarkup}
        </div>

    </div>

    <script>
        (function () {
            var images = Array.prototype.slice.call(document.images || []);
            Promise.all(images.map(function (img) {
                if (img.complete) return Promise.resolve();
                return new Promise(function (resolve) {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            })).then(function () {
                setTimeout(function () {
                    window.focus();
                    window.print();
                }, 250);
            });
            window.onafterprint = function () {
                setTimeout(function () { window.close(); }, 150);
            };
        })();
    </script>
</body>
</html>`;
}

async function printBasicInfoPage() {
    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) {
        alert('تعذر فتح نافذة الطباعة');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(await buildBasicInfoPrintHtml());
    printWindow.document.close();
}

// ===== Members =====
function renderMembers() {
    const tbody = document.getElementById('membersBody');
    const emptyMsg = document.getElementById('emptyMembers');

    if (boardMembers.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');

    tbody.innerHTML = boardMembers.map((m, i) => {
        if (isEditing || isNewMode) {
            return `
                <tr>
                    <td>
                        <select class="memberRoleEdit edit-input board-member-cell-field" data-index="${i}" onchange="updateMember(${i}, 'member_role', this.value)">
                            <option value="رئيس مجلس الادارة" ${m.member_role === 'رئيس مجلس الادارة' ? 'selected' : ''}>رئيس مجلس الادارة</option>
                            <option value="الاعضاء" ${m.member_role === 'الاعضاء' ? 'selected' : ''}>الاعضاء</option>
                            <option value="مسؤل الامن" ${m.member_role === 'مسؤل الامن' ? 'selected' : ''}>مسؤل الامن</option>
                            <option value="مسؤل العهدة" ${m.member_role === 'مسؤل العهدة' ? 'selected' : ''}>مسؤل العهدة</option>
                            <option value="مندوب الشركة" ${m.member_role === 'مندوب الشركة' ? 'selected' : ''}>مندوب الشركة</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="memberNameEdit edit-input board-member-cell-field" data-index="${i}" value="${esc(m.member_name)}" onchange="updateMember(${i}, 'member_name', this.value)" placeholder="اسم العضو...">
                    </td>
                    <td>
                        <input type="text" class="memberPhoneEdit edit-input board-member-cell-field" data-index="${i}" value="${esc(m.member_phone || '')}" onchange="updateMember(${i}, 'member_phone', this.value)" placeholder="رقم التليفون..." inputmode="numeric">
                    </td>
                    <td class="col-action">
                        <button class="btn-icon danger" onclick="removeMember(${i})" title="حذف">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        } else {
            return `
                <tr>
                    <td><span class="board-role-pill">${esc(m.member_role)}</span></td>
                    <td><strong class="board-member-name">${esc(m.member_name)}</strong></td>
                    <td><span class="board-member-phone">${esc(m.member_phone || '---')}</span></td>
                    <td class="col-action hidden">
                        <button class="btn-icon danger" onclick="removeMember(${i})" title="حذف">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    }).join('');
}

function updateMember(index, field, value) {
    if (index >= 0 && index < boardMembers.length) {
        boardMembers[index][field] = value.trim();
    }
}

function addMemberRow() {
    const roleEl = document.getElementById('newMemberRole');
    const nameEl = document.getElementById('newMemberName');
    const phoneEl = document.getElementById('newMemberPhone');
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return false; }

    boardMembers.push({ member_role: roleEl.value, member_name: name, member_phone: phoneEl.value.trim() });
    nameEl.value = '';
    phoneEl.value = '';
    renderMembers();
    return true;
}

function removeMember(index) {
    boardMembers.splice(index, 1);
    renderMembers();
}

// ===== Members Search & Filter =====
function filterMembers() {
    const searchVal = (document.getElementById('membersSearchInput').value || '').trim().toLowerCase();
    const roleVal = document.getElementById('membersFilterRole').value;
    const tbody = document.getElementById('membersBody');
    const rows = tbody.querySelectorAll('tr');
    let visibleCount = 0;

    rows.forEach((row, i) => {
        if (i >= boardMembers.length) return;
        const m = boardMembers[i];
        const nameMatch = !searchVal || (m.member_name || '').toLowerCase().includes(searchVal);
        const roleMatch = !roleVal || m.member_role === roleVal;

        if (nameMatch && roleMatch) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const emptyMsg = document.getElementById('emptyMembers');
    if (boardMembers.length > 0 && visibleCount === 0) {
        emptyMsg.textContent = 'لا توجد نتائج مطابقة';
        emptyMsg.classList.remove('hidden');
    } else if (boardMembers.length === 0) {
        emptyMsg.textContent = 'لا يوجد أعضاء مسجلين';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }
}

function isAdministrativeDirectorate(directorName) {
    return (directorName || '').trim() === administrativeDirectorateName;
}

function getGuardedDirectorName(item) {
    return (item?.director_name || item?.specialist_name || '').trim();
}

function renderGuardDirectorOptions(selectedValue = '', includePlaceholder = false) {
    const selected = (selectedValue || '').trim();
    const placeholder = includePlaceholder
        ? `<option value="" ${selected ? '' : 'selected'}>-- اختر الجهة تجريبية --</option>`
        : '';
    const options = guardedDirectorates.map(name =>
        `<option value="${esc(name)}" ${selected === name ? 'selected' : ''}>${esc(name)}</option>`
    ).join('');
    return placeholder + options;
}

function populateGuardedDirectorFilterOptions(selectedValue = '') {
    const select = document.getElementById('guardedSearchDirector');
    if (!select) return;

    const selected = (selectedValue || '').trim();
    select.innerHTML = `<option value="">-- كل المديريات --</option>${guardedDirectorates.map(name =>
        `<option value="${esc(name)}" ${selected === name ? 'selected' : ''}>${esc(name)}</option>`
    ).join('')}`;
}

function renderStationOptions(sectorValue, selectedStation = '') {
    const currentStation = (selectedStation || '').trim();
    if (!sectorValue || !sectorStations[sectorValue]) {
        return '<option value="">-- القسم --</option>';
    }

    const promptOption = '<option value="">-- اختر القسم --</option>';
    const legacyOption = currentStation && !sectorStations[sectorValue].includes(currentStation)
        ? `<option value="${esc(currentStation)}" selected>${esc(currentStation)}</option>`
        : '';
    const stationOptions = sectorStations[sectorValue].map(station =>
        `<option value="${esc(station)}" ${currentStation === station ? 'selected' : ''}>${esc(station)}</option>`
    ).join('');
    return promptOption + legacyOption + stationOptions;
}

function renderNewSiteSectorControl(directorName, selectedSector = '') {
    if (!directorName) {
        return '<input type="text" id="newSiteSector" class="edit-input" value="" placeholder="اختر الجهة تجريبية أولاً" disabled>';
    }
    if (!isAdministrativeDirectorate(directorName)) {
        return '<input type="text" id="newSiteSector" class="edit-input" value="" placeholder="مدينة تجريبية فقط" disabled>';
    }

    return `
        <select id="newSiteSector" onchange="updateNewSiteLocationFields()" class="edit-input">
            <option value="" ${selectedSector ? '' : 'selected'}>-- القطاع --</option>
            <option value="east" ${selectedSector === 'east' ? 'selected' : ''}>شرق</option>
            <option value="west" ${selectedSector === 'west' ? 'selected' : ''}>غرب</option>
            <option value="south" ${selectedSector === 'south' ? 'selected' : ''}>جنوب</option>
            <option value="north" ${selectedSector === 'north' ? 'selected' : ''}>شمال</option>
            <option value="sectorfive" ${selectedSector === 'sectorfive' ? 'selected' : ''}>القطاع التجريبي الخامس</option>
        </select>
    `;
}

function renderNewSiteStationControl(directorName, selectedSector = '', selectedStation = '') {
    if (!directorName) {
        return '<input type="text" id="newSiteStation" class="edit-input" value="" placeholder="اختر الجهة تجريبية أولاً" disabled>';
    }
    if (!isAdministrativeDirectorate(directorName)) {
        return `<input type="text" id="newSiteStation" class="edit-input" value="${esc(selectedStation)}" placeholder="اكتب القسم...">`;
    }
    return `<select id="newSiteStation" class="edit-input">${renderStationOptions(selectedSector, selectedStation)}</select>`;
}

function renderExistingSiteSectorControl(item, index) {
    const directorName = getGuardedDirectorName(item);
    if (!directorName) {
        return '<input type="text" class="edit-input" value="" placeholder="اختر الجهة تجريبية" disabled>';
    }
    if (!isAdministrativeDirectorate(directorName)) {
        return '<input type="text" class="edit-input" value="" placeholder="مدينة تجريبية فقط" disabled>';
    }

    return `
        <select class="siteSector edit-input" data-index="${index}" onchange="updateGuardedLocation(${index}, 'site_sector', this.value); updateExistingSiteStationDropdown(${index})">
            <option value="" ${item.site_sector === '' ? 'selected' : ''}>-- القطاع --</option>
            <option value="east" ${item.site_sector === 'east' ? 'selected' : ''}>شرق</option>
            <option value="west" ${item.site_sector === 'west' ? 'selected' : ''}>غرب</option>
            <option value="south" ${item.site_sector === 'south' ? 'selected' : ''}>جنوب</option>
            <option value="north" ${item.site_sector === 'north' ? 'selected' : ''}>شمال</option>
            <option value="sectorfive" ${item.site_sector === 'sectorfive' ? 'selected' : ''}>القطاع التجريبي الخامس</option>
        </select>
    `;
}

function renderExistingSiteStationControl(item, index) {
    const directorName = getGuardedDirectorName(item);
    if (!directorName || !isAdministrativeDirectorate(directorName)) {
        return `<input type="text" class="siteStation edit-input" data-index="${index}" value="${esc(item.site_station || '')}" onchange="updateGuardedLocation(${index}, 'site_station', this.value)" placeholder="اكتب القسم...">`;
    }

    return `
        <select class="siteStation edit-input" data-index="${index}" onchange="updateGuardedLocation(${index}, 'site_station', this.value)">
            ${renderStationOptions(item.site_sector, item.site_station)}
        </select>
    `;
}

function updateNewSiteLocationFields() {
    const directorEl = document.getElementById('newSiteDirector');
    const sectorCell = document.getElementById('newSiteSectorCell');
    const stationCell = document.getElementById('newSiteStationCell');
    if (!directorEl || !sectorCell || !stationCell) return;

    const directorName = directorEl.value.trim();
    const currentSector = document.getElementById('newSiteSector')?.value || '';
    const currentStation = document.getElementById('newSiteStation')?.value?.trim() || '';
    const nextSector = isAdministrativeDirectorate(directorName) ? currentSector : '';
    const nextStation = isAdministrativeDirectorate(directorName) ? (nextSector ? currentStation : '') : currentStation;

    sectorCell.innerHTML = renderNewSiteSectorControl(directorName, nextSector);
    stationCell.innerHTML = renderNewSiteStationControl(directorName, nextSector, nextStation);
}

function updateExistingSiteDirector(index, value) {
    if (index < 0 || index >= guardedLocations.length) return;
    guardedLocations[index].director_name = value.trim();

    if (!isAdministrativeDirectorate(guardedLocations[index].director_name)) {
        guardedLocations[index].site_sector = '';
    } else if (!sectorStations[guardedLocations[index].site_sector]) {
        guardedLocations[index].site_sector = '';
        guardedLocations[index].site_station = '';
    }

    renderExistingSiteLocationInputs(index);
}

function renderExistingSiteLocationInputs(index) {
    const item = guardedLocations[index];
    if (!item) return;

    const sectorCell = document.querySelector(`.siteSectorCell[data-index="${index}"]`);
    const stationCell = document.querySelector(`.siteStationCell[data-index="${index}"]`);
    if (sectorCell) sectorCell.innerHTML = renderExistingSiteSectorControl(item, index);
    if (stationCell) stationCell.innerHTML = renderExistingSiteStationControl(item, index);
}

function renderGuardedLocations() {
    const tbody = document.getElementById('guardedLocationsBody');
    const emptyMsg = document.getElementById('emptyGuardedLocations');

    const inputRow = (isEditing || isNewMode) ? `
        <tr class="input-row">
            <td><input type="text" id="newSiteName" placeholder="اسم الموقع..." class="edit-input"></td>
            <td><input type="text" id="newSiteAddress" placeholder="عنوان الموقع..." class="edit-input"></td>
            <td>
                <select id="newSiteDirector" onchange="updateNewSiteLocationFields()" class="edit-input">
                    ${renderGuardDirectorOptions('', true)}
                </select>
            </td>
            <td><input type="text" id="newSiteGuardCount" placeholder="عدد الحراس..." inputmode="numeric" class="edit-input"></td>
            <td id="newSiteSectorCell">${renderNewSiteSectorControl('')}</td>
            <td id="newSiteStationCell">${renderNewSiteStationControl('')}</td>
            <td class="col-action"><button type="button" class="btn btn-success btn-sm" onclick="addGuardedLocationRow()"><i class="fas fa-plus"></i> اضافة</button></td>
        </tr>
    ` : '';

    const dataRows = guardedLocations.map((item, i) => {
        if (isEditing || isNewMode) {
            return `
                <tr class="edit-row">
                    <td><input type="text" class="siteName edit-input" data-index="${i}" value="${esc(item.site_name)}" onchange="updateGuardedLocation(${i}, 'site_name', this.value)" placeholder="اسم الموقع..."></td>
                    <td><input type="text" class="siteAddress edit-input" data-index="${i}" value="${esc(item.site_address)}" onchange="updateGuardedLocation(${i}, 'site_address', this.value)" placeholder="عنوان الموقع..."></td>
                    <td>
                        <select class="directorName edit-input" data-index="${i}" onchange="updateExistingSiteDirector(${i}, this.value)">
                            ${renderGuardDirectorOptions(getGuardedDirectorName(item), true)}
                        </select>
                    </td>
                    <td><input type="text" class="guardCount edit-input" data-index="${i}" value="${esc(item.guard_count || '')}" onchange="updateGuardedLocation(${i}, 'guard_count', this.value)" inputmode="numeric" placeholder="عدد الحراس..."></td>
                    <td class="siteSectorCell" data-index="${i}">${renderExistingSiteSectorControl(item, i)}</td>
                    <td class="siteStationCell" data-index="${i}">${renderExistingSiteStationControl(item, i)}</td>
                    <td class="col-action">
                        <button class="btn-icon danger" onclick="removeGuardedLocation(${i})" title="حذف">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        } else {
            return `
                <tr>
                    <td><strong>${esc(item.site_name)}</strong></td>
                    <td>${esc(item.site_address)}</td>
                    <td>${esc(getGuardedDirectorName(item))}</td>
                    <td>${esc(item.guard_count || '')}</td>
                    <td>${isAdministrativeDirectorate(getGuardedDirectorName(item)) ? (sectorTag(item.site_sector) || '---') : '---'}</td>
                    <td>${esc(item.site_station)}</td>
                    <td class="col-action hidden"></td>
                </tr>
            `;
        }
    }).join('');

    tbody.innerHTML = inputRow + dataRows;
    refreshGuardedSummaryDisplays();

    if (guardedLocations.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }
}

function updateGuardedLocation(index, field, value) {
    if (index >= 0 && index < guardedLocations.length) {
        guardedLocations[index][field] = value.trim();
        if (field === 'guard_count') {
            refreshGuardedSummaryDisplays();
        }
    }
}

function updateExistingSiteStationDropdown(index) {
    if (index < 0 || index >= guardedLocations.length) return;
    if (!isAdministrativeDirectorate(getGuardedDirectorName(guardedLocations[index]))) return;
    const stationCell = document.querySelector(`.siteStationCell[data-index="${index}"]`);
    if (!stationCell) return;
    stationCell.innerHTML = renderExistingSiteStationControl(guardedLocations[index], index);
}

function addGuardedLocationRow() {
    const siteNameEl = document.getElementById('newSiteName');
    const siteAddressEl = document.getElementById('newSiteAddress');
    const directorEl = document.getElementById('newSiteDirector');
    const guardCountEl = document.getElementById('newSiteGuardCount');
    const siteSectorEl = document.getElementById('newSiteSector');
    const siteStationEl = document.getElementById('newSiteStation');
    if (!siteNameEl || !siteAddressEl || !directorEl || !guardCountEl || !siteSectorEl || !siteStationEl) return;

    const siteName = siteNameEl.value.trim();
    const siteAddress = siteAddressEl.value.trim();
    const directorName = directorEl.value.trim();
    const guardCount = guardCountEl.value.trim();
    const siteSector = siteSectorEl.value;
    const siteStation = siteStationEl.value.trim();

    if (!siteName && !siteAddress && !directorName && !guardCount && !siteSector && !siteStation) {
        siteNameEl.focus();
        return false;
    }

    guardedLocations.push({
        site_name: siteName,
        site_address: siteAddress,
        director_name: directorName,
        guard_count: guardCount,
        site_sector: isAdministrativeDirectorate(directorName) ? siteSector : '',
        site_station: siteStation
    });

    siteNameEl.value = '';
    siteAddressEl.value = '';
    directorEl.value = '';
    guardCountEl.value = '';
    updateNewSiteLocationFields();
    renderGuardedLocations();
    return true;
}

function updateNewSiteStationDropdown() {
    updateNewSiteLocationFields();
}

function removeGuardedLocation(index) {
    guardedLocations.splice(index, 1);
    renderGuardedLocations();
}

function renderGuardLicenses() {
    const tbody = document.getElementById('guardLicensesBody');
    const emptyMsg = document.getElementById('emptyGuardLicenses');

    sortGuardLicensesAsc();

    const inputRow = (isEditing || isNewMode) ? `
        <tr class="input-row">
            <td><input type="text" id="newGuardLicenseNumber" placeholder="رقم الرخصة..."></td>
            <td><input type="text" id="newGuardName" placeholder="اسم الحارس..."></td>
            <td>
                <select id="newGuardActivityType">
                    <option value="حراسة منشئات">حراسة منشئات</option>
                    <option value="نقل الاموال">نقل الاموال</option>
                    <option value="حراسة المنشئات و نقل الاموال">حراسة المنشئات و نقل الاموال</option>
                </select>
            </td>
            <td><input type="text" id="newGuardWeaponLicenseNumber" inputmode="numeric" placeholder="رقم رخص السلاح..."></td>
            <td><input type="text" id="newGuardWeaponStatement" placeholder="بيان السلاح..."></td>
            <td><input type="text" id="newGuardWeaponExpiryDate" placeholder="تاريخ الانتهاء" onblur="handleDateBlur(this)"></td>
            <td><input type="text" id="newGuardIssueDate" placeholder="تاريخ الايصدار" onblur="handleDateBlur(this)"></td>
            <td><input type="text" id="newGuardRenewalDate" placeholder="تاريخ التجديد" onblur="handleDateBlur(this)"></td>
            <td>
                <select id="newGuardSector" onchange="updateNewGuardLicenseStationDropdown()">
                    <option value="">-- القطاع --</option>
                    <option value="east">شرق</option>
                    <option value="west">غرب</option>
                    <option value="south">جنوب</option>
                    <option value="north">شمال</option>
                    <option value="sectorfive">القطاع التجريبي الخامس</option>
                </select>
            </td>
            <td>
                <select id="newGuardStation">
                    <option value="">-- القسم --</option>
                </select>
            </td>
            <td class="col-action"><button type="button" class="btn btn-primary btn-sm" onclick="addGuardLicenseRow()"><i class="fas fa-plus"></i> اضافة</button></td>
        </tr>
    ` : '';

    const dataRows = guardLicenses.map((item, i) => `
        <tr data-guard-license-index="${i}">
            <td>${esc(item.license_number)}</td>
            <td>${esc(item.guard_name)}</td>
            <td>${activityTag(item.activity_type)}</td>
            <td>${toArabic(esc(item.weapon_license_number))}</td>
            <td>${esc(item.weapon_statement)}</td>
            <td>${isoToArabicDate(item.weapon_expiry_date)}</td>
            <td>${isoToArabicDate(item.issue_date)}</td>
            <td>${isoToArabicDate(item.renewal_date)}</td>
            <td>${sectorTag(item.sector)}</td>
            <td>${esc(item.station)}</td>
            <td class="col-action ${isEditing || isNewMode ? '' : 'hidden'}">
                <button class="btn-icon danger" onclick="removeGuardLicense(${i})" title="حذف">
                    <i class="fas fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = inputRow + dataRows;

    if (guardLicenses.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }

    filterGuardLicenses();
}

function addGuardLicenseRow() {
    const licenseNumberEl = document.getElementById('newGuardLicenseNumber');
    const guardNameEl = document.getElementById('newGuardName');
    const activityTypeEl = document.getElementById('newGuardActivityType');
    const weaponLicenseNumberEl = document.getElementById('newGuardWeaponLicenseNumber');
    const weaponStatementEl = document.getElementById('newGuardWeaponStatement');
    const weaponExpiryDateEl = document.getElementById('newGuardWeaponExpiryDate');
    const issueDateEl = document.getElementById('newGuardIssueDate');
    const renewalDateEl = document.getElementById('newGuardRenewalDate');
    const sectorEl = document.getElementById('newGuardSector');
    const stationEl = document.getElementById('newGuardStation');
    if (!licenseNumberEl || !guardNameEl || !activityTypeEl || !weaponLicenseNumberEl || !weaponStatementEl || !weaponExpiryDateEl || !issueDateEl || !renewalDateEl || !sectorEl || !stationEl) return;

    const licenseNumber = licenseNumberEl.value.trim();
    const guardName = guardNameEl.value.trim();
    const activityType = activityTypeEl.value;
    const weaponLicenseNumber = toWestern(weaponLicenseNumberEl.value).replace(/\D/g, '');
    const weaponStatement = weaponStatementEl.value.trim();
    const weaponExpiryDate = arabicDateToIso(weaponExpiryDateEl.value);
    const issueDate = arabicDateToIso(issueDateEl.value);
    const renewalDate = arabicDateToIso(renewalDateEl.value);
    const sector = sectorEl.value;
    const station = stationEl.value;

    if (!licenseNumber && !guardName && !activityType && !weaponLicenseNumber && !weaponStatement && !weaponExpiryDate && !issueDate && !renewalDate && !sector && !station) {
        licenseNumberEl.focus();
        return;
    }

    guardLicenses.push({
        license_number: licenseNumber,
        guard_name: guardName,
        activity_type: activityType,
        weapon_license_number: weaponLicenseNumber,
        weapon_statement: weaponStatement,
        weapon_expiry_date: weaponExpiryDate,
        issue_date: issueDate,
        renewal_date: renewalDate,
        sector,
        station
    });

    licenseNumberEl.value = '';
    guardNameEl.value = '';
    activityTypeEl.value = 'حراسة منشئات';
    weaponLicenseNumberEl.value = '';
    weaponStatementEl.value = '';
    weaponExpiryDateEl.value = '';
    issueDateEl.value = '';
    renewalDateEl.value = '';
    sectorEl.value = '';
    stationEl.innerHTML = '<option value="">-- القسم --</option>';
    renderGuardLicenses();
}

function removeGuardLicense(index) {
    guardLicenses.splice(index, 1);
    renderGuardLicenses();
}

function updateNewGuardLicenseStationDropdown() {
    const sectorVal = document.getElementById('newGuardSector').value;
    const stationSelect = document.getElementById('newGuardStation');
    if (!stationSelect) return;
    stationSelect.innerHTML = '';
    if (!sectorVal || !sectorStations[sectorVal]) {
        stationSelect.innerHTML = '<option value="">-- القسم --</option>';
        return;
    }
    stationSelect.innerHTML = '<option value="">-- اختر القسم --</option>';
    for (const st of sectorStations[sectorVal]) {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        stationSelect.appendChild(opt);
    }
}

function getFilteredGuardLicenses() {
    const searchNumber = toWestern((document.getElementById('guardLicenseSearchNumber').value || '').trim()).toLowerCase();
    const searchName = (document.getElementById('guardLicenseSearchName').value || '').trim().toLowerCase();
    const sectorVal = document.getElementById('guardLicenseSearchSector').value;
    const activityVal = document.getElementById('guardLicenseSearchActivity').value;

    return guardLicenses.filter((item) => {
        const licenseMatch = !searchNumber || toWestern(item.license_number || '').toLowerCase().includes(searchNumber);
        const nameMatch = !searchName || (item.guard_name || '').toLowerCase().includes(searchName);
        const sectorMatch = !sectorVal || (item.sector || '') === sectorVal;
        const activityMatch = !activityVal || (item.activity_type || '') === activityVal;
        return licenseMatch && nameMatch && sectorMatch && activityMatch;
    });
}

function filterGuardLicenses() {
    const tbody = document.getElementById('guardLicensesBody');
    const rows = tbody.querySelectorAll('tr');
    const filtered = getFilteredGuardLicenses();
    let visibleCount = 0;

    rows.forEach((row) => {
        if (row.classList.contains('input-row')) {
            row.style.display = '';
            return;
        }

        const itemIndex = Number(row.getAttribute('data-guard-license-index'));
        if (Number.isNaN(itemIndex) || itemIndex < 0 || itemIndex >= guardLicenses.length) {
            row.style.display = 'none';
            return;
        }

        const item = guardLicenses[itemIndex];
        const isVisible = filtered.includes(item);

        if (isVisible) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const emptyMsg = document.getElementById('emptyGuardLicenses');
    if (guardLicenses.length > 0 && visibleCount === 0) {
        emptyMsg.textContent = 'لا توجد نتائج مطابقة';
        emptyMsg.classList.remove('hidden');
    } else if (guardLicenses.length === 0) {
        emptyMsg.textContent = 'لا يوجد رخص مسجلة';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }
}

function printGuardLicenses() {
    const filtered = getFilteredGuardLicenses();
    if (filtered.length === 0) {
        showNoPrintRowsMessage();
        return;
    }

    const companyName = document.getElementById('fCompanyName')?.value?.trim() || '';
    const rows = filtered.map((item, i) => ({
        index: i + 1,
        license_number: item.license_number || '',
        guard_name: item.guard_name || '',
        activity_type: item.activity_type || '',
        weapon_license_number: item.weapon_license_number || '',
        weapon_statement: item.weapon_statement || '',
        weapon_expiry_date: isoToArabicDate(item.weapon_expiry_date),
        issue_date: isoToArabicDate(item.issue_date),
        renewal_date: isoToArabicDate(item.renewal_date),
        sector: getSectorLabel(item.sector),
        station: item.station || ''
    }));

    openBrowserPrintReport(buildBrowserPrintHtml({
        title: 'رخص المزاولة',
        subtitle: companyName ? `${companyName} | عدد النتائج: ${toArabic(rows.length)}` : `عدد النتائج: ${toArabic(rows.length)}`,
        dense: true,
        columns: [
            { label: '#', key: 'index' },
            { label: 'رقم الرخصة', key: 'license_number' },
            { label: 'اسم الحارس', key: 'guard_name' },
            { label: 'نوع النشاط', key: 'activity_type' },
            { label: 'رخص السلاح', key: 'weapon_license_number' },
            { label: 'بيان السلاح', key: 'weapon_statement' },
            { label: 'تاريخ الانتهاء', key: 'weapon_expiry_date' },
            { label: 'تاريخ الايصدار', key: 'issue_date' },
            { label: 'تاريخ التجديد', key: 'renewal_date' },
            { label: 'القطاع', key: 'sector' },
            { label: 'القسم', key: 'station' }
        ],
        rows
    }));
}

// ===== Company Cars =====
function renderCompanyCarTypeOptions(selectedValue = '', includePlaceholder = false) {
    const selected = (selectedValue || '').trim();
    const placeholder = includePlaceholder
        ? `<option value="" ${selected ? '' : 'selected'}>-- اختر النوع --</option>`
        : '';
    const options = companyCarTypeOptions.map(type =>
        `<option value="${esc(type)}" ${selected === type ? 'selected' : ''}>${esc(type)}</option>`
    ).join('');
    return placeholder + options;
}

function populateCompanyCarYearOptions(selectedValue = '') {
    const select = document.getElementById('companyCarsSearchYear');
    if (!select) return;

    const years = new Set();
    companyCars.forEach((item) => {
        const year = (item.car_renewal_date || '').split('-')[0];
        if (year && year.length === 4) years.add(year);
    });

    const selected = (selectedValue || '').trim();
    const sortedYears = [...years].sort((a, b) => b.localeCompare(a, 'ar', { numeric: true }));
    select.innerHTML = `<option value="">-- كل السنوات --</option>${sortedYears.map(year =>
        `<option value="${year}" ${selected === year ? 'selected' : ''}>${toArabic(year)}</option>`
    ).join('')}`;
}

function getCompanyCarImageUrl(filename) {
    return `/company/car-uploads/${encodeURIComponent(filename)}`;
}

function openCompanyCarImageByIndex(index) {
    const item = companyCars[index];
    if (!item || !item.car_image) return;
    window.open(getCompanyCarImageUrl(item.car_image), '_blank');
}

function renderCompanyCarImageCell(item, index) {
    const hasImage = Boolean(item.car_image);
    const hasSavedRow = Boolean(item.id);
    const preview = hasImage
        ? `<img src="${getCompanyCarImageUrl(item.car_image)}" alt="صورة السيارة" class="company-car-thumb" onclick="openCompanyCarImageByIndex(${index})">`
        : `<div class="company-car-image-placeholder">${hasSavedRow ? 'لا توجد صورة' : 'احفظ ثم ارفع الصورة'}</div>`;

    if (!(isEditing || isNewMode)) {
        return `<div class="company-car-image-cell">${preview}</div>`;
    }

    const actions = hasSavedRow
        ? `
            <div class="company-car-image-actions">
                <button type="button" class="btn btn-primary btn-sm" onclick="triggerCompanyCarImageUpload(${index})">
                    <i class="fas fa-upload"></i> رفع
                </button>
                ${hasImage ? `
                    <button type="button" class="btn btn-danger btn-sm" onclick="removeCompanyCarImage(${index})">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                ` : ''}
            </div>
        `
        : '<div class="company-car-upload-note">احفظ السيارة أولاً</div>';

    return `<div class="company-car-image-cell">${preview}${actions}</div>`;
}

function renderCompanyCars() {
    const tbody = document.getElementById('companyCarsBody');
    const emptyMsg = document.getElementById('emptyCompanyCars');
    const countBadge = document.getElementById('companyCarsCount');
    const totalCarsInput = document.getElementById('fTotalCompanyCars');
    const selectedYear = document.getElementById('companyCarsSearchYear')?.value || '';

    if (countBadge) countBadge.textContent = toArabic(companyCars.length);
    if (totalCarsInput) totalCarsInput.value = toArabic(companyCars.length);
    populateCompanyCarYearOptions(selectedYear);

    const inputRow = (isEditing || isNewMode) ? `
        <tr class="input-row">
            <td><input type="text" id="newCompanyCarNumber" placeholder="رقم السيارة..."></td>
            <td><input type="text" id="newCompanyCarRenewalDate" placeholder="تاريخ التجديد" onblur="handleDateBlur(this)"></td>
            <td>
                <select id="newCompanyCarType">
                    ${renderCompanyCarTypeOptions('', true)}
                </select>
            </td>
            <td>
                <div class="company-car-image-cell">
                    <div class="company-car-image-placeholder">احفظ السيارة أولاً ثم ارفع الصورة</div>
                </div>
            </td>
            <td class="col-action">
                <button type="button" class="btn btn-success btn-sm" onclick="addCompanyCarRow()">
                    <i class="fas fa-plus"></i> اضافة
                </button>
            </td>
        </tr>
    ` : '';

    const dataRows = companyCars.map((item, i) => {
        if (isEditing || isNewMode) {
            return `
                <tr data-company-car-index="${i}">
                    <td>
                        <input type="text" class="edit-input" value="${esc(item.car_number)}" onchange="updateCompanyCar(${i}, 'car_number', this.value)" placeholder="رقم السيارة...">
                    </td>
                    <td>
                        <input type="text" class="edit-input" value="${isoToArabicDate(item.car_renewal_date)}" onblur="handleCompanyCarRenewalDateBlur(${i}, this)" placeholder="تاريخ التجديد">
                    </td>
                    <td>
                        <select class="edit-input" onchange="updateCompanyCar(${i}, 'car_type', this.value)">
                            ${renderCompanyCarTypeOptions(item.car_type, true)}
                        </select>
                    </td>
                    <td>${renderCompanyCarImageCell(item, i)}</td>
                    <td class="col-action">
                        <button class="btn-icon danger" onclick="removeCompanyCar(${i})" title="حذف">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }

        return `
            <tr data-company-car-index="${i}">
                <td><strong>${esc(toArabic(item.car_number || '---'))}</strong></td>
                <td>${item.car_renewal_date ? isoToArabicDate(item.car_renewal_date) : '---'}</td>
                <td>${esc(item.car_type || '---')}</td>
                <td>${renderCompanyCarImageCell(item, i)}</td>
                <td class="col-action hidden"></td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = inputRow + dataRows;

    if (companyCars.length === 0) {
        emptyMsg.textContent = 'لا يوجد سيارات مسجلة';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }

    filterCompanyCars();
}

function updateCompanyCar(index, field, value) {
    if (index < 0 || index >= companyCars.length) return;
    const normalizedValue = field === 'car_renewal_date'
        ? arabicDateToIso(value)
        : value.trim();
    companyCars[index][field] = normalizedValue;
    if (field === 'car_renewal_date') {
        populateCompanyCarYearOptions(document.getElementById('companyCarsSearchYear')?.value || '');
        filterCompanyCars();
    }
}

function handleCompanyCarRenewalDateBlur(index, input) {
    handleDateBlur(input);
    updateCompanyCar(index, 'car_renewal_date', input.value);
}

function addCompanyCarRow() {
    const numberEl = document.getElementById('newCompanyCarNumber');
    const renewalEl = document.getElementById('newCompanyCarRenewalDate');
    const typeEl = document.getElementById('newCompanyCarType');
    if (!numberEl || !renewalEl || !typeEl) return false;

    const carNumber = numberEl.value.trim();
    const carRenewalDate = arabicDateToIso(renewalEl.value);
    const carType = typeEl.value.trim();

    if (!carNumber && !carRenewalDate && !carType) {
        numberEl.focus();
        return false;
    }

    companyCars.push(normalizeCompanyCar({
        car_number: carNumber,
        car_renewal_date: carRenewalDate,
        car_type: carType,
        car_image: ''
    }));

    numberEl.value = '';
    renewalEl.value = '';
    typeEl.value = '';
    renderCompanyCars();
    return true;
}

function removeCompanyCar(index) {
    companyCars.splice(index, 1);
    renderCompanyCars();
}

function getFilteredCompanyCars() {
    const searchNumber = toWestern((document.getElementById('companyCarsSearchNumber').value || '').trim()).toLowerCase();
    const searchYear = (document.getElementById('companyCarsSearchYear').value || '').trim();
    const searchType = (document.getElementById('companyCarsSearchType').value || '').trim();

    return companyCars.filter((item) => {
        const carNumber = toWestern(item.car_number || '').toLowerCase();
        const renewalYear = (item.car_renewal_date || '').split('-')[0];
        const numberMatch = !searchNumber || carNumber.includes(searchNumber);
        const yearMatch = !searchYear || renewalYear === searchYear;
        const typeMatch = !searchType || (item.car_type || '') === searchType;
        return numberMatch && yearMatch && typeMatch;
    });
}

function filterCompanyCars() {
    const tbody = document.getElementById('companyCarsBody');
    const rows = tbody.querySelectorAll('tr');
    const filtered = getFilteredCompanyCars();
    let visibleCount = 0;

    rows.forEach((row) => {
        if (row.classList.contains('input-row')) {
            row.style.display = '';
            return;
        }

        const itemIndex = Number(row.getAttribute('data-company-car-index'));
        if (Number.isNaN(itemIndex) || itemIndex < 0 || itemIndex >= companyCars.length) {
            row.style.display = 'none';
            return;
        }

        const item = companyCars[itemIndex];
        const isVisible = filtered.includes(item);
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });

    const emptyMsg = document.getElementById('emptyCompanyCars');
    if (companyCars.length > 0 && visibleCount === 0) {
        emptyMsg.textContent = 'لا توجد نتائج مطابقة';
        emptyMsg.classList.remove('hidden');
    } else if (companyCars.length === 0) {
        emptyMsg.textContent = 'لا يوجد سيارات مسجلة';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }
}

function printCompanyCars() {
    const filtered = getFilteredCompanyCars();
    if (filtered.length === 0) {
        showNoPrintRowsMessage();
        return;
    }

    const companyName = document.getElementById('fCompanyName')?.value?.trim() || '';
    const rows = filtered.map((item, i) => ({
        index: i + 1,
        car_number: item.car_number || '',
        car_renewal_date: isoToArabicDate(item.car_renewal_date),
        car_type: item.car_type || '',
        car_image: item.car_image
            ? `<img src="${esc(getCompanyCarImageUrl(item.car_image))}" alt="صورة السيارة" class="print-image">`
            : '---'
    }));

    openBrowserPrintReport(buildBrowserPrintHtml({
        title: 'سيارات نقل واموال',
        subtitle: companyName ? `${companyName} | عدد النتائج: ${toArabic(rows.length)}` : `عدد النتائج: ${toArabic(rows.length)}`,
        summary: `اجمالي عدد السيارات النقل والاموال: ${toArabic(rows.length)}`,
        columns: [
            { label: '#', key: 'index' },
            { label: 'رقم السيارة', key: 'car_number' },
            { label: 'تجديد السيارة', key: 'car_renewal_date' },
            { label: 'نوع السيارة', key: 'car_type' },
            { label: 'صورة السيارة', key: 'car_image', html: true }
        ],
        rows
    }));
}

function triggerCompanyCarImageUpload(index) {
    const item = companyCars[index];
    if (!item) return;

    if (!currentCompanyId || !item.id) {
        alert('يرجى حفظ الشركة والسيارة أولاً قبل رفع الصورة');
        return;
    }

    if (!item.car_number) {
        alert('يرجى إدخال رقم السيارة ثم حفظه أولاً قبل رفع الصورة');
        return;
    }

    pendingCompanyCarUploadIndex = index;
    document.getElementById('companyCarFileInput').click();
}

function handleCompanyCarFile(input) {
    const index = pendingCompanyCarUploadIndex;
    pendingCompanyCarUploadIndex = null;

    if (index === null || !input.files || !input.files[0]) {
        input.value = '';
        return;
    }

    const item = companyCars[index];
    if (!item || !item.id || !currentCompanyId) {
        alert('يرجى حفظ الشركة والسيارة أولاً قبل رفع الصورة');
        input.value = '';
        return;
    }

    uploadCompanyCarImageFile(index, input.files[0]);
    input.value = '';
}

async function uploadCompanyCarImageFile(index, file) {
    const item = companyCars[index];
    if (!item || !item.id) return;

    try {
        const formData = new FormData();
        formData.append('car_image', file);
        formData.append('car_number', item.car_number || '');
        formData.append('company_name', document.getElementById('fCompanyName').value.trim());
        formData.append('license_number', document.getElementById('fLicenseNumber').value.trim());

        const res = await fetch(`${API}/company-cars/${item.id}/image`, {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        if (res.ok) {
            companyCars[index].car_image = result.filename || '';
            renderCompanyCars();
        } else {
            alert(result.error || 'حدث خطأ أثناء رفع صورة السيارة');
        }
    } catch (err) {
        console.error('Upload company car image error:', err);
        alert('حدث خطأ أثناء رفع صورة السيارة');
    }
}

async function removeCompanyCarImage(index) {
    const item = companyCars[index];
    if (!item || !item.id || !item.car_image) return;
    if (!confirm('هل تريد حذف صورة السيارة؟')) return;

    try {
        const res = await fetch(`${API}/company-cars/${item.id}/image`, {
            method: 'DELETE'
        });
        const result = await res.json();

        if (res.ok) {
            companyCars[index].car_image = '';
            renderCompanyCars();
        } else {
            alert(result.error || 'حدث خطأ أثناء حذف صورة السيارة');
        }
    } catch (err) {
        console.error('Delete company car image error:', err);
        alert('حدث خطأ أثناء حذف صورة السيارة');
    }
}

// ===== Inspections (لجنة معاينة) =====
let inspections = [];
let selectedInspections = new Set();
let activeInspectionId = null;
const inspectionTypeOptions = ['تجديد', 'ترخيص'];
const inspectionDecisionOptions = ['موافقة', 'عدم موافقة'];
const inspectionTypePlaceholder = '-- اختر نوع اللجنة --';
const inspectionDecisionPlaceholder = '-- اختر قرار اللجنة --';

function formatInspectionDecisionDisplay(value) {
    const raw = (value || '').trim();
    if (!raw) return '';
    if (inspectionDecisionOptions.includes(raw)) return raw;
    return isoToArabicDate(raw);
}

function formatInspectionTypeDisplay(value) {
    return (value || '').trim();
}

function formatInspectionCellDisplay(value) {
    return value && String(value).trim() ? String(value).trim() : '---';
}

function renderInspections() {
    const tbody = document.getElementById('inspectionsBody');
    const emptyMsg = document.getElementById('emptyInspections');
    tbody.innerHTML = '';
    selectedInspections.clear();
    if (document.getElementById('inspectionSelectAll')) document.getElementById('inspectionSelectAll').checked = false;

    if (inspections.length === 0) {
        emptyMsg.textContent = 'لا يوجد لجان مسجلة';
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    inspections.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-inspection-index', idx);
        tr.setAttribute('data-inspection-id', item.id);

        // Selection checkbox
        const tdSelect = document.createElement('td');
        tdSelect.className = 'col-action hidden';
        tdSelect.id = '';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.onchange = function() { toggleInspectionSelection(item.id, this.checked); };
        tdSelect.appendChild(cb);
        tr.appendChild(tdSelect);

        // Editable cells
        if (isEditing) {
            tr.appendChild(makeEditableSelectCell(item.committee_name, 'committee_name', item.id, inspectionTypeOptions, inspectionTypePlaceholder));
            tr.appendChild(makeEditableDateCell(item.committee_license, 'committee_license', item.id));
            tr.appendChild(makeEditableSelectCell(item.committee_renewal, 'committee_renewal', item.id, inspectionDecisionOptions, inspectionDecisionPlaceholder));
        } else {
            const tdName = document.createElement('td');
            tdName.textContent = formatInspectionCellDisplay(formatInspectionTypeDisplay(item.committee_name));
            tr.appendChild(tdName);

            const tdLicense = document.createElement('td');
            tdLicense.textContent = formatInspectionCellDisplay(isoToArabicDate(item.committee_license));
            tr.appendChild(tdLicense);

            const tdRenewal = document.createElement('td');
            tdRenewal.textContent = formatInspectionCellDisplay(formatInspectionDecisionDisplay(item.committee_renewal));
            tr.appendChild(tdRenewal);
        }

        // Files column
        const tdFiles = document.createElement('td');
        tdFiles.className = 'inspection-files-cell';
        const fileCount = (item.files || []).length;
        const btnFiles = document.createElement('button');
        btnFiles.type = 'button';
        btnFiles.className = 'btn btn-sm btn-inspection-files';
        btnFiles.innerHTML = '<i class="fas fa-folder-open"></i> ' + (fileCount > 0 ? '<span class="file-badge">' + toArabic(fileCount) + '</span>' : '<i class="fas fa-plus"></i>');
        btnFiles.title = 'محضر اللجنة';
        btnFiles.onclick = function() { openInspectionFilesFrame(item.id); };
        tdFiles.appendChild(btnFiles);
        tr.appendChild(tdFiles);

        // Delete action
        const tdDel = document.createElement('td');
        tdDel.className = 'col-action hidden';
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-sm btn-danger';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.onclick = function() { deleteInspection(item.id); };
        tdDel.appendChild(delBtn);
        tr.appendChild(tdDel);

        tbody.appendChild(tr);
    });

    applyInspectionEditVisibility();
    filterInspections();
}

function makeEditableSelectCell(value, field, inspectionId, options, placeholderText = '-- اختر --') {
    const td = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'inspection-inline-input';

    const currentValue = (value || '').trim();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = placeholderText;
    select.appendChild(placeholder);

    const normalizedOptions = [...options];
    if (currentValue && !normalizedOptions.includes(currentValue)) {
        normalizedOptions.push(currentValue);
    }

    normalizedOptions.forEach((optionValue) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        if (optionValue === currentValue) option.selected = true;
        select.appendChild(option);
    });

    select.value = currentValue;

    select.onchange = function() { updateInspectionField(inspectionId, field, this.value); };
    td.appendChild(select);
    return td;
}

function makeEditableDateCell(value, field, inspectionId) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = isoToArabicDate(value);
    input.className = 'inspection-inline-input';
    input.placeholder = 'يوم/شهر/سنة';
    input.oninput = function() { autoFormatArabicDate(this); };
    input.onblur = function() { handleDateBlur(this); };
    input.onchange = function() { updateInspectionField(inspectionId, field, arabicDateToIso(this.value)); };
    td.appendChild(input);
    return td;
}

async function updateInspectionField(inspectionId, field, value) {
    const insp = inspections.find(i => i.id === inspectionId);
    if (!insp) return;
    insp[field] = value;
    try {
        await fetch(`${API}/inspections/${inspectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                committee_name: insp.committee_name,
                committee_license: insp.committee_license,
                committee_renewal: insp.committee_renewal
            })
        });
    } catch (err) {
        console.error('Error updating inspection:', err);
    }
}

async function addInspectionRow() {
    if (!currentCompanyId) return;
    try {
        const res = await fetch(`${API}/companies/${currentCompanyId}/inspections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ committee_name: '', committee_license: '', committee_renewal: '' })
        });
        const result = await res.json();
        inspections.push({
            id: result.id,
            company_id: currentCompanyId,
            committee_name: '',
            committee_license: '',
            committee_renewal: '',
            files: []
        });
        renderInspections();
    } catch (err) {
        console.error('Error adding inspection:', err);
    }
}

async function deleteInspection(inspectionId) {
    try {
        await fetch(`${API}/inspections/${inspectionId}`, { method: 'DELETE' });
        inspections = inspections.filter(i => i.id !== inspectionId);
        selectedInspections.delete(inspectionId);
        // Close frame if it was open for this inspection
        if (activeInspectionId === inspectionId) closeInspectionFilesFrame();
        renderInspections();
    } catch (err) {
        console.error('Error deleting inspection:', err);
    }
}

async function deleteSelectedInspections() {
    if (selectedInspections.size === 0) return;
    const ids = [...selectedInspections];
    for (const id of ids) {
        await deleteInspection(id);
    }
}

function toggleInspectionSelection(id, checked) {
    if (checked) selectedInspections.add(id);
    else selectedInspections.delete(id);
}

function toggleAllInspectionSelection(masterCb) {
    const tbody = document.getElementById('inspectionsBody');
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => { cb.checked = masterCb.checked; });
    selectedInspections.clear();
    if (masterCb.checked) {
        inspections.forEach(i => selectedInspections.add(i.id));
    }
}

function filterInspections() {
    const searchVal = toWestern((document.getElementById('inspectionSearchName').value || '').trim()).toLowerCase();
    const tbody = document.getElementById('inspectionsBody');
    const rows = tbody.querySelectorAll('tr');
    let visibleCount = 0;

    rows.forEach(row => {
        const idx = Number(row.getAttribute('data-inspection-index'));
        if (Number.isNaN(idx) || idx < 0 || idx >= inspections.length) { row.style.display = 'none'; return; }
        const item = inspections[idx];
        const licenseText = toWestern(item.committee_license || '').toLowerCase();
        const renewalText = toWestern(item.committee_renewal || '').toLowerCase();
        const match = !searchVal ||
            (item.committee_name || '').toLowerCase().includes(searchVal) ||
            licenseText.includes(searchVal) ||
            renewalText.includes(searchVal);
        if (match) { row.style.display = ''; visibleCount++; }
        else { row.style.display = 'none'; }
    });

    const emptyMsg = document.getElementById('emptyInspections');
    if (inspections.length > 0 && visibleCount === 0) {
        emptyMsg.textContent = 'لا توجد نتائج مطابقة';
        emptyMsg.classList.remove('hidden');
    } else if (inspections.length === 0) {
        emptyMsg.textContent = 'لا يوجد لجان مسجلة';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }
}

function getFilteredInspections() {
    const searchVal = toWestern((document.getElementById('inspectionSearchName').value || '').trim()).toLowerCase();
    
    return inspections.filter((item) => {
        const licenseText = toWestern(item.committee_license || '').toLowerCase();
        const renewalText = toWestern(item.committee_renewal || '').toLowerCase();
        return !searchVal ||
            (item.committee_name || '').toLowerCase().includes(searchVal) ||
            licenseText.includes(searchVal) ||
            renewalText.includes(searchVal);
    });
}

function printInspections() {
    const filtered = getFilteredInspections();
    if (filtered.length === 0) {
        showNoPrintRowsMessage();
        return;
    }

    const companyName = document.getElementById('fCompanyName')?.value?.trim() || '';
    const rows = filtered.map((item, i) => ({
        index: i + 1,
        committee_name: formatInspectionCellDisplay(formatInspectionTypeDisplay(item.committee_name)),
        committee_license: formatInspectionCellDisplay(isoToArabicDate(item.committee_license)),
        committee_renewal: formatInspectionCellDisplay(formatInspectionDecisionDisplay(item.committee_renewal))
    }));

    openBrowserPrintReport(buildBrowserPrintHtml({
        title: 'لجنة المعاينة',
        subtitle: companyName ? `${companyName} | عدد النتائج: ${toArabic(rows.length)}` : `عدد النتائج: ${toArabic(rows.length)}`,
        columns: [
            { label: '#', key: 'index' },
            { label: 'نوع اللجنة', key: 'committee_name' },
            { label: 'تاريخ انعفاد اللجنة', key: 'committee_license' },
            { label: 'قرار اللجنة', key: 'committee_renewal' }
        ],
        rows
    }));
}

function applyInspectionEditVisibility() {
    const selectCells = document.querySelectorAll('#inspectionsBody .col-action, #inspectionSelectHeader, #inspectionActionHeader');
    selectCells.forEach(el => {
        if (isEditing) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
}

// ===== Inspection Files Frame =====
function openInspectionFilesFrame(inspectionId) {
    activeInspectionId = inspectionId;
    const insp = inspections.find(i => i.id === inspectionId);
    if (!insp) return;

    document.getElementById('inspectionFilesTitle').textContent = 'مرفقات: ' + (insp.committee_name || 'اللجنة');
    renderInspectionFiles(insp.files || []);

    const frame = document.getElementById('inspectionFilesFrame');
    frame.classList.remove('hidden');

    // Show/hide upload button based on edit mode
    const uploadZone = document.getElementById('inspectionFilesUploadZone');
    if (isEditing) uploadZone.classList.remove('hidden');
    else uploadZone.classList.add('hidden');
}

function closeInspectionFilesFrame() {
    activeInspectionId = null;
    document.getElementById('inspectionFilesFrame').classList.add('hidden');
    document.getElementById('inspectionFilesList').innerHTML = '';
    document.getElementById('inspectionFilesInput').value = '';
}

function renderInspectionFiles(files) {
    const list = document.getElementById('inspectionFilesList');
    list.innerHTML = '';

    if (!files || files.length === 0) {
        list.innerHTML = '<p class="empty-members">لا توجد مرفقات</p>';
        return;
    }

    files.forEach(f => {
        const div = document.createElement('div');
        div.className = 'inspection-file-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'inspection-file-name';
        nameSpan.textContent = f.original_name || f.file_path;
        div.appendChild(nameSpan);

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn btn-sm btn-primary';
        viewBtn.innerHTML = '<i class="fas fa-eye"></i> عرض';
        viewBtn.onclick = function() { window.open('/company/inspection-uploads/' + encodeURIComponent(f.file_path), '_blank'); };
        div.appendChild(viewBtn);

        if (isEditing) {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-sm btn-danger';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.onclick = function() { deleteInspectionFile(f.id); };
            div.appendChild(delBtn);
        }

        list.appendChild(div);
    });
}

async function handleInspectionFiles(input) {
    if (!activeInspectionId || !input.files || input.files.length === 0) return;
    const formData = new FormData();
    for (const file of input.files) {
        formData.append('files', file);
    }

    try {
        const res = await fetch(`${API}/inspections/${activeInspectionId}/files`, {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        // Update local data
        const insp = inspections.find(i => i.id === activeInspectionId);
        if (insp && result.files) {
            insp.files = result.files;
            renderInspectionFiles(insp.files);
            renderInspections(); // refresh badge count
            // Re-open frame to show updated files
            openInspectionFilesFrame(activeInspectionId);
        }
    } catch (err) {
        console.error('Error uploading inspection files:', err);
    }

    input.value = '';
}

async function deleteInspectionFile(fileId) {
    try {
        await fetch(`${API}/inspection-files/${fileId}`, { method: 'DELETE' });

        // Update local data
        if (activeInspectionId) {
            const insp = inspections.find(i => i.id === activeInspectionId);
            if (insp) {
                insp.files = (insp.files || []).filter(f => f.id !== fileId);
                renderInspectionFiles(insp.files);
                renderInspections();
                openInspectionFilesFrame(activeInspectionId);
            }
        }
    } catch (err) {
        console.error('Error deleting inspection file:', err);
    }
}

// ===== Guarded Locations Search & Filter =====
function getFilteredGuardedLocations() {
    const searchVal = (document.getElementById('guardedSearchInput').value || '').trim().toLowerCase();
    const directorVal = document.getElementById('guardedSearchDirector').value;
    const sectorVal = document.getElementById('guardedSearchSector').value;

    return guardedLocations.filter((item) => {
        const directorName = getGuardedDirectorName(item);
        const textMatch = !searchVal ||
            (item.site_name || '').toLowerCase().includes(searchVal) ||
            (item.site_address || '').toLowerCase().includes(searchVal) ||
            directorName.toLowerCase().includes(searchVal);

        const directorMatch = !directorVal || directorName === directorVal;
        const sectorMatch = !sectorVal || (item.site_sector || '') === sectorVal;
        return textMatch && directorMatch && sectorMatch;
    });
}

function filterGuardedLocations() {
    const tbody = document.getElementById('guardedLocationsBody');
    const rows = tbody.querySelectorAll('tr');
    const filtered = getFilteredGuardedLocations();
    let visibleCount = 0;

    rows.forEach((row, i) => {
        if (i >= guardedLocations.length) return;
        const item = guardedLocations[i];
        const isVisible = filtered.includes(item);

        if (isVisible) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const emptyMsg = document.getElementById('emptyGuardedLocations');
    if (guardedLocations.length > 0 && visibleCount === 0) {
        emptyMsg.textContent = 'لا توجد نتائج مطابقة';
        emptyMsg.classList.remove('hidden');
    } else if (guardedLocations.length === 0) {
        emptyMsg.textContent = 'لا يوجد مواقع مسجلة';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
    }
}

function printGuardedLocations() {
    const filtered = getFilteredGuardedLocations();
    if (filtered.length === 0) {
        showNoPrintRowsMessage();
        return;
    }

    const companyName = document.getElementById('fCompanyName')?.value?.trim() || '';
    const rows = filtered.map((item, i) => ({
        index: i + 1,
        site_name: item.site_name || '',
        site_address: item.site_address || '',
        director_name: item.director_name || item.specialist_name || '',
        guard_count: item.guard_count || '',
        site_sector: isAdministrativeDirectorate(getGuardedDirectorName(item)) ? getSectorLabel(item.site_sector) : '---',
        site_station: item.site_station || ''
    }));

    const totalGuards = rows.reduce((sum, row) => {
        const normalized = String(row.guard_count || '')
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[^\d]/g, '');
        return sum + (normalized ? parseInt(normalized, 10) : 0);
    }, 0);

    openBrowserPrintReport(buildBrowserPrintHtml({
        title: 'مواقع الحراسة',
        subtitle: companyName ? `${companyName} | عدد النتائج: ${toArabic(rows.length)}` : `عدد النتائج: ${toArabic(rows.length)}`,
        summary: `اجمالي الحراس العاملين بالشركة: ${toArabic(totalGuards)}`,
        columns: [
            { label: '#', key: 'index' },
            { label: 'اسم الموقع', key: 'site_name' },
            { label: 'عنوان الموقع', key: 'site_address', className: 'text-right' },
            { label: 'اسم الجهة تجريبية', key: 'director_name' },
            { label: 'عدد الحراس', key: 'guard_count' },
            { label: 'القطاع', key: 'site_sector' },
            { label: 'القسم', key: 'site_station' }
        ],
        rows
    }));
}

function getPendingMemberDraft() {
    const roleEl = document.getElementById('newMemberRole');
    const nameEl = document.getElementById('newMemberName');
    const phoneEl = document.getElementById('newMemberPhone');
    if (!roleEl || !nameEl || !phoneEl) return { hasData: false };

    const name = nameEl.value.trim();
    const phone = phoneEl.value.trim();
    return {
        hasData: Boolean(name || phone),
        role: roleEl.value,
        name,
        phone
    };
}

function getPendingGuardedLocationDraft() {
    const siteNameEl = document.getElementById('newSiteName');
    const siteAddressEl = document.getElementById('newSiteAddress');
    const directorEl = document.getElementById('newSiteDirector');
    const guardCountEl = document.getElementById('newSiteGuardCount');
    const siteSectorEl = document.getElementById('newSiteSector');
    const siteStationEl = document.getElementById('newSiteStation');
    if (!siteNameEl || !siteAddressEl || !directorEl || !guardCountEl || !siteSectorEl || !siteStationEl) {
        return { hasData: false };
    }

    const draft = {
        site_name: siteNameEl.value.trim(),
        site_address: siteAddressEl.value.trim(),
        director_name: directorEl.value.trim(),
        guard_count: guardCountEl.value.trim(),
        site_sector: siteSectorEl.value,
        site_station: siteStationEl.value.trim()
    };

    return {
        ...draft,
        hasData: Object.values(draft).some(value => String(value || '').trim())
    };
}

function getPendingCompanyCarDraft() {
    const numberEl = document.getElementById('newCompanyCarNumber');
    const renewalEl = document.getElementById('newCompanyCarRenewalDate');
    const typeEl = document.getElementById('newCompanyCarType');
    if (!numberEl || !renewalEl || !typeEl) return { hasData: false };

    const draft = {
        car_number: numberEl.value.trim(),
        car_renewal_date: renewalEl.value.trim(),
        car_type: typeEl.value.trim()
    };

    return {
        ...draft,
        hasData: Object.values(draft).some(value => String(value || '').trim())
    };
}

function openPendingDraftModal(messages) {
    const modal = document.getElementById('pendingDraftModal');
    const list = document.getElementById('pendingDraftList');
    if (!modal || !list) return Promise.resolve(false);

    list.innerHTML = messages.map(message => `<li>${esc(message)}</li>`).join('');
    modal.classList.add('active');

    return new Promise(resolve => {
        pendingDraftResolve = resolve;
    });
}

function closePendingDraftModal(shouldAdd = false) {
    const modal = document.getElementById('pendingDraftModal');
    if (modal) modal.classList.remove('active');

    if (pendingDraftResolve) {
        const resolve = pendingDraftResolve;
        pendingDraftResolve = null;
        resolve(shouldAdd);
    }
}

function confirmPendingDraftSave() {
    closePendingDraftModal(true);
}

async function ensurePendingDraftsHandledBeforeSave() {
    const pendingMessages = [];
    const memberDraft = getPendingMemberDraft();
    const guardedDraft = getPendingGuardedLocationDraft();
    const companyCarDraft = getPendingCompanyCarDraft();

    if (memberDraft.hasData) {
        pendingMessages.push('يوجد عضو في مجلس الادارة لم يتم الضغط على إضافة له بعد.');
    }
    if (guardedDraft.hasData) {
        pendingMessages.push('يوجد موقع حراسة مكتوب ولم يتم الضغط على إضافة له بعد.');
    }
    if (companyCarDraft.hasData) {
        pendingMessages.push('يوجد سيارة نقل أموال مكتوبة ولم يتم الضغط على إضافة لها بعد.');
    }
    if (pendingMessages.length === 0) return true;

    const shouldAdd = await openPendingDraftModal(pendingMessages);
    if (!shouldAdd) return false;

    if (memberDraft.hasData && !addMemberRow()) {
        return false;
    }
    if (guardedDraft.hasData && !addGuardedLocationRow()) {
        return false;
    }
    if (companyCarDraft.hasData && !addCompanyCarRow()) {
        return false;
    }

    return true;
}

// ===== Edit / Save / Cancel =====
function toggleEdit() {
    isEditing = true;
    setFormDisabled(false);
    showEditMode();
    validateDuplicateFields();
    renderMembers();
    renderGuardedLocations();
    renderCompanyCars();
}

function cancelEdit() {
    if (isNewMode) {
        closeModal();
        return;
    }
    isEditing = false;
    // Re-load original data
    viewCompany(currentCompanyId);
}

async function saveCompany() {
    const activeTabId = document.querySelector('.tab-page.active')?.id || 'tab-basic';
    const hasDuplicates = await validateDuplicateFields();
    if (hasDuplicates) {
        alert('لا يمكن الحفظ: يوجد تكرار في اسم الشركة أو رقم الرخصة');
        return;
    }
    if (!await ensurePendingDraftsHandledBeforeSave()) {
        return;
    }

    const payload = {
        company_name: document.getElementById('fCompanyName').value.trim(),
        license_number: document.getElementById('fLicenseNumber').value.trim(),
        issue_date: arabicDateToIso(document.getElementById('fIssueDate').value),
        renewal_date: arabicDateToIso(document.getElementById('fRenewalDate').value),
        activity_type: document.getElementById('fActivityType').value,
        sector: document.getElementById('fSector').value,
        station: document.getElementById('fStation').value,
        headquarters_address: document.getElementById('fHeadquarters').value.trim(),
        company_status: document.getElementById('fCompanyStatus').value,
        notes: document.getElementById('fNotes').value.trim(),
        branches: document.getElementById('fBranches').value.trim(),
        total_guards: calculateTotalGuards(),
        guarded_locations: JSON.stringify(guardedLocations),
        guard_licenses: JSON.stringify(guardLicenses),
        company_cars: companyCars.map(normalizeCompanyCar),
        gps_link: document.getElementById('fGpsLink').value.trim(),
        board_members: boardMembers
    };

    if (!payload.company_name) {
        alert('يرجى إدخال اسم الشركة');
        document.getElementById('fCompanyName').focus();
        return;
    }

    try {
        let res;
        if (isNewMode) {
            res = await fetch(`${API}/companies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(`${API}/companies/${currentCompanyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const result = await res.json();

        if (!res.ok) {
            if (res.status === 409 && result.field === 'company_name') {
                setDuplicateUI('fCompanyName', 'companyDuplicateMsg', true);
                document.getElementById('fCompanyName').focus();
            } else if (res.status === 409 && result.field === 'license_number') {
                setDuplicateUI('fLicenseNumber', 'licenseDuplicateMsg', true);
                document.getElementById('fLicenseNumber').focus();
            } else {
                alert(result.error || 'حدث خطأ أثناء الحفظ');
            }
            return;
        }

        if (result && result.approvalRequired) {
            alert(result.message || 'تم إرسال طلب الاعتماد إلى المدير والسيكرتير الأول.');
            isEditing = false;
            setFormDisabled(true);
            showViewMode();
            loadCompanies();
            return;
        }

        if (isNewMode && result.id) {
            currentCompanyId = result.id;
            isNewMode = false;
        }

        isEditing = false;
        setFormDisabled(true);
        showViewMode();
        loadCompanies();

        // Refresh the detail view
        if (currentCompanyId) {
            await viewCompany(currentCompanyId, activeTabId);
        }
    } catch (err) {
        console.error('Error saving:', err);
        alert('حدث خطأ أثناء الحفظ');
    }
}

// ===== Delete =====
function askDelete(id) {
    deleteTargetId = id;
    openModal('deleteModal');
}

async function confirmDelete() {
    if (!deleteTargetId) return;
    try {
        const res = await fetch(`${API}/companies/${deleteTargetId}`, { method: 'DELETE' });
        const result = await res.json().catch(() => ({}));
        if (result && result.approvalRequired) {
            if (window.DeleteApprovalUserNotice) {
                window.DeleteApprovalUserNotice.track(result.request, { message: result.message });
            } else {
                alert(result.message || 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.');
            }
            closeDeleteModal();
            return;
        }
        if (!res.ok) {
            throw new Error(result?.error || 'تعذر حذف الشركة');
        }
        closeDeleteModal();
        loadCompanies();
        // If viewing the deleted company, close the view modal
        if (currentCompanyId === deleteTargetId) {
            closeModal();
        }
    } catch (err) {
        console.error('Error deleting:', err);
    }
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.remove('active');
}

// ===== Form State Helpers =====
function setFormDisabled(disabled) {
    const form = document.getElementById('companyForm');
    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'hidden') return;
        if (el.id === 'fTotalGuards' || el.id === 'fBasicTotalGuards' || el.id === 'fTotalSites' || el.id === 'fTotalCompanyCars') {
            el.disabled = true;
            return;
        }
        // Search/filter tools: enabled in view mode, disabled in edit mode
        if (el.id === 'guardedSearchInput' || el.id === 'guardedSearchDirector' || el.id === 'guardedSearchSector' || el.id === 'membersSearchInput' || el.id === 'membersFilterRole' || el.id === 'guardLicenseSearchNumber' || el.id === 'guardLicenseSearchName' || el.id === 'guardLicenseSearchSector' || el.id === 'guardLicenseSearchActivity' || el.id === 'companyCarsSearchNumber' || el.id === 'companyCarsSearchYear' || el.id === 'companyCarsSearchType' || el.id === 'inspectionSearchName') {
            el.disabled = !disabled;
            return;
        }
        el.disabled = disabled;
    });
    if (disabled) clearDuplicateUI();
}

function showViewMode() {
    document.getElementById('modalTitle').textContent = 'تفاصيل الشركة';
    document.getElementById('btnEdit').classList.remove('hidden');
    document.getElementById('btnSave').classList.add('hidden');
    document.getElementById('btnCancel').classList.add('hidden');
    document.getElementById('membersToolbar').classList.add('hidden');
    document.getElementById('memberActionHeader').classList.add('hidden');
    document.getElementById('guardedLocationActionHeader').classList.add('hidden');
    document.getElementById('guardLicenseActionHeader').classList.add('hidden');
    document.getElementById('companyCarActionHeader').classList.add('hidden');
    document.getElementById('companyImageActions').classList.add('hidden');
    document.getElementById('companyLogoActions').classList.add('hidden');
    document.getElementById('gpsImageActions').classList.add('hidden');
    document.getElementById('btnGenerateQR').classList.add('hidden');
    document.getElementById('uniformActions').classList.add('hidden');
    document.getElementById('licenseActions').classList.add('hidden');
    document.getElementById('inspectionToolbar').classList.add('hidden');
    document.getElementById('inspectionSelectHeader').classList.add('hidden');
    document.getElementById('inspectionActionHeader').classList.add('hidden');
    closeInspectionFilesFrame();
    renderInspections();
    renderGuardedLocations();
    renderGuardLicenses();
    renderCompanyCars();
}

function showEditMode() {
    document.getElementById('modalTitle').textContent = isNewMode ? 'إضافة شركة جديدة' : 'تعديل بيانات الشركة';
    document.getElementById('btnEdit').classList.add('hidden');
    document.getElementById('btnSave').classList.remove('hidden');
    document.getElementById('btnCancel').classList.remove('hidden');
    document.getElementById('membersToolbar').classList.remove('hidden');
    document.getElementById('memberActionHeader').classList.remove('hidden');
    document.getElementById('guardedLocationActionHeader').classList.remove('hidden');
    document.getElementById('guardLicenseActionHeader').classList.remove('hidden');
    document.getElementById('companyCarActionHeader').classList.remove('hidden');
    document.getElementById('companyImageActions').classList.remove('hidden');
    document.getElementById('companyLogoActions').classList.remove('hidden');
    document.getElementById('gpsImageActions').classList.remove('hidden');
    document.getElementById('btnGenerateQR').classList.remove('hidden');
    document.getElementById('uniformActions').classList.remove('hidden');
    document.getElementById('licenseActions').classList.remove('hidden');
    document.getElementById('inspectionToolbar').classList.remove('hidden');
    document.getElementById('inspectionSelectHeader').classList.remove('hidden');
    document.getElementById('inspectionActionHeader').classList.remove('hidden');
    renderInspections();
    renderGuardedLocations();
    renderGuardLicenses();
    renderCompanyCars();
}

// ===== Modal Helpers =====
function switchModalTab(tabId) {
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    const page = document.getElementById(tabId);
    if (page) page.classList.add('active');
    const btn = document.querySelector(`.modal-tab[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
}

function openModal(id, tabId = 'tab-basic') {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
    switchModalTab(tabId);
}

function closeModal() {
    closePendingDraftModal();
    document.getElementById('viewModal').classList.remove('active');
    document.body.style.overflow = '';
    isEditing = false;
    isNewMode = false;
    currentCompanyId = null;
    pendingCompanyCarUploadIndex = null;
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'pendingDraftModal') {
            closePendingDraftModal();
        } else if (e.target.id === 'deleteModal') {
            closeDeleteModal();
        } else {
            closeModal();
        }
    }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const pendingDraftModal = document.getElementById('pendingDraftModal');
        const deleteModal = document.getElementById('deleteModal');
        const viewModal = document.getElementById('viewModal');
        if (pendingDraftModal.classList.contains('active')) {
            closePendingDraftModal();
        } else if (deleteModal.classList.contains('active')) {
            closeDeleteModal();
        } else if (viewModal.classList.contains('active')) {
            closeModal();
        }
    }
});
