const columnOrder = [
	'الفئة',
	'رقم الحرز',
	'رقم الرخصة',
	'نوع الرخصة',
	'القسم',
	'الاسم',
	'النوع',
	'الماركة',
	'العيار',
	'الرقم',
	'سبب الالغاء',
	'تاريخ الايداع',
	'تاريخ الانتهاء',
	'مالك الحرز',
	'نوع الحرز',
	'ملاحظات'
];

const EASTERN_TO_WESTERN = {
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

const WESTERN_TO_EASTERN = {
	'0': '٠',
	'1': '١',
	'2': '٢',
	'3': '٣',
	'4': '٤',
	'5': '٥',
	'6': '٦',
	'7': '٧',
	'8': '٨',
	'9': '٩'
};

const DATE_COLUMNS = ['تاريخ الايداع', 'تاريخ الانتهاء'];
const NUMBER_ONLY_COLUMNS = ['رقم الحرز', 'رقم الرخصة'];
const LICENSE_TYPE_SCOPE = 'weapons';
const DATE_CUTOFF = new Date(Date.UTC(2016, 1, 10)); // 10/02/2016 (month is 0-based)
const WARATHA_ENDDATE_CUTOFF = new Date(Date.UTC(2021, 1, 10)); // 10/02/2021
const GENERIC_COMPANY_WORDS = ['وزارة', 'مصلحة', 'بنك', 'كنيسة', 'شركة', 'هيئة', 'مؤسسة'];
const IS_PLATFORM_MODE = /^\/seized(?:\/|$)/i.test(window.location.pathname || '');
const API_BASE = IS_PLATFORM_MODE ? '/api/seized' : '/api';
const DASHBOARD_URL = '/main.html';
const SHARED_REFERENCE_DATA = window.AdministrativeSharedReferenceData || null;
const DELETE_APPROVAL_INSPECT_STORAGE_KEY = 'general.deleteApprovalInspectTarget';

const meaningfulColumns = columnOrder.filter((key) => key !== 'نوع الحرز');

let data = [];
let filteredData = [];
let currentPage = 1;
const pageSize = 100;
const DEFAULT_SORT_KEY = 'رقم الحرز';
let sortState = { key: DEFAULT_SORT_KEY, direction: 'asc' };
let _renderCache = null;
let nameQuery = '';
let nameSearchColumn = '__all__';
let recordQuery = '';
let selectedRows = new Set(); // Track selected row indices
const MERGE_SAVE = window.SeizedMergeSave || null;
const CLIENT_ROW_ID_KEY = '__seizedClientRowId';
const SAVE_RETRY_LIMIT = 3;
const PRIMARY_MATCH_COLUMNS = ['الفئة', 'رقم الحرز', 'رقم الرخصة', 'الرقم'];

let nextClientRowNumber = 1;
let loadedRecordsVersion = null;
let baselineRowsById = new Map();
let dirtyCellsByRowId = new Map();
let insertedRowIds = new Set();
let deletedRowIds = new Set();

function buildApiUrl(endpoint) {
	const normalized = String(endpoint || '');
	return `${API_BASE}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function navigateToDashboard() {
	try {
		window.location.href = DASHBOARD_URL;
	} catch (error) {
		window.location.href = '/dashboard';
	}
}

function getDownloadFilename(response, fallbackName) {
	const disposition = String(response.headers.get('content-disposition') || '');
	const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match && utf8Match[1]) {
		try {
			return decodeURIComponent(utf8Match[1]);
		} catch (error) {
			return utf8Match[1];
		}
	}
	const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
	if (plainMatch && plainMatch[1]) return plainMatch[1];
	return fallbackName;
}

function downloadBlob(blob, fileName) {
	const blobUrl = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = blobUrl;
	link.download = fileName || 'seized-records.xlsx';
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

// Sector to stations mapping
const sectorStations = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorStationsMap === 'function'
	? SHARED_REFERENCE_DATA.getSectorStationsMap('key')
	: {
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

const fallbackLicenseTypeOptions = [
	'اخطار',
	'دفاع',
	'حراسه',
	'صيد',
	'اعفاء هيئات قضائية',
	'رماه دوليين',
	'مخابرات عامه',
	'رقابة ادارية',
	'دفاع طالما في عمله',
	'اعفاء دبلوماسين',
	'إعفاء شرطة',
	'إعفاء قوات مسلحة',
	'إتجار'
];

// Filter state
let selectedSectors = new Set();
let selectedStations = new Set();
let selectedSeizeType = 'all'; // 'all', 'حجز إدارى', 'مصادرة', 'اعفاء', 'سداد رسوم', 'ايداع', 'تنازل'
let selectedDepositPassFilter = 'all'; // 'all' | 'passed' | 'not-passed'

const tableBody = document.querySelector('#harzTable tbody');
const headerCells = document.querySelectorAll('#harzTable thead th');
const reloadBtn = document.getElementById('reloadBtn');
const saveBtn = document.getElementById('saveBtn');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const firstPage = document.getElementById('firstPage');
const lastPage = document.getElementById('lastPage');
const pageInfo = document.getElementById('pageInfo');
const statusMsg = document.getElementById('statusMsg');
function scrollTableToTop() {
	const wrapper = document.querySelector('.table-wrapper');
	if (wrapper) wrapper.scrollTop = 0;
	try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { window.scrollTo(0, 0); }
}
const nameSearchInput = document.getElementById('nameSearch');
const nameSearchColumnSelect = document.getElementById('nameSearchColumn');
const recordSearchInput = document.getElementById('recordSearch');
const noDataMessage = document.getElementById('noDataMessage');
const addRecordBtn = document.getElementById('addRecordBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const undoBtn = document.getElementById('undoBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const exitBtn = document.getElementById('exitBtn');
const headerClockDate = document.getElementById('headerClockDate');
const headerClockTime = document.getElementById('headerClockTime');
const depositStatusFilter = document.getElementById('depositStatusFilter');
const depositStatusBtns = document.querySelectorAll('.deposit-status-btn');

function startHeaderClock() {
	if (!headerClockDate || !headerClockTime) return;

	const updateClock = () => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const datePart = formatArabicDigits(`${year}/${month}/${day}`);
		const timePart = formatArabicDigits(`${hours}:${minutes}`);
		headerClockDate.textContent = datePart;
		headerClockTime.textContent = timePart;
	};

	updateClock();
	setInterval(updateClock, 30000);
}

startHeaderClock();

function formatArabicDigits(value) {
	const str = String(value).replace(/-/g, '/');
	return str.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function getTotalPages(rows = filteredData) {
	return Math.max(1, Math.ceil(rows.length / pageSize));
}

function updatePaginationControls(totalPages) {
	pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
	prevPage.disabled = currentPage <= 1;
	nextPage.disabled = currentPage >= totalPages;
	if (firstPage) firstPage.disabled = currentPage <= 1;
	if (lastPage) lastPage.disabled = currentPage >= totalPages;
}

function renderRows(rows, page = 1) {
	tableBody.innerHTML = '';
	let sortedRows;
	const sectorActive = selectedSectors.size > 0;
	const cacheSectorKey = sectorActive ? ([...selectedSectors][0] || '') : '';
	if (_renderCache && _renderCache.rows === rows && _renderCache.key === sortState.key && _renderCache.dir === sortState.direction && _renderCache.sectorKey === cacheSectorKey) {
		sortedRows = _renderCache.sortedRows;
	} else {
		const sanitizedRows = cleanRows(rows);
		sortedRows = getSortedRows(sanitizedRows);
		_renderCache = { rows, key: sortState.key, dir: sortState.direction, sectorKey: cacheSectorKey, sortedRows };
	}
	const totalPages = getTotalPages(sortedRows);
	currentPage = Math.min(Math.max(page, 1), totalPages);
	const start = (currentPage - 1) * pageSize;
	const end = start + pageSize;
	const pageRows = sortedRows.slice(start, end);

	if (noDataMessage) {
		const hasRows = sortedRows.length > 0;
		noDataMessage.hidden = hasRows;
		noDataMessage.textContent = hasRows ? '' : 'لا يوجد بيانات';
	}

	if (sortedRows.length === 0) {
		updatePaginationControls(totalPages);
		return;
	}

	const groupSectorKey = cacheSectorKey;
	const groupingActive = sectorActive;
	const dataIndexMap = new Map(data.map((item, i) => [item, i]));
	let prevStation = null;
	let stationCounter = 0;
	pageRows.forEach((item, idx) => {
		const originalIndex = dataIndexMap.get(item) ?? -1;
		const tr = document.createElement('tr');
		tr.dataset.activityRowId = String(originalIndex);
		tr.dataset.index = String(originalIndex);

		const currentStation = groupingActive ? normalizeStationName(item?.['القسم'] || '', groupSectorKey) : '';
		if (groupingActive) {
			if (prevStation !== null && currentStation !== prevStation) {
				tr.classList.add('station-group-start');
				stationCounter = 0;
			}
			prevStation = currentStation;
			stationCounter += 1;
		}

		// Add checkbox cell
		const checkboxCell = `<td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-row="${originalIndex}" ${selectedRows.has(originalIndex) ? 'checked' : ''}></td>`;

		const rowNumber = groupingActive ? stationCounter : (start + idx + 1);
		const rowIndexCell = `<td class="row-index-col">${formatArabicDigits(rowNumber)}</td>`;
		const cells = columnOrder.map((key) => {
			const raw = item[key] ?? '';
			const isNumericLike = /\d/.test(raw);
			let value = isNumericLike ? formatArabicDigits(raw) : raw;
			
			let isEditable = 'true';
			let cellContent = value;
			let extraClass = '';

			if (key === 'الرقم') {
				// Keep original order, render Arabic numerals, enforce LTR to avoid bidi flips
				const arabicNumberSafe = String(raw).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
				value = arabicNumberSafe;
				cellContent = value;
				extraClass = 'ltr-cell';
			}

			if (key === 'الفئة') {
				isEditable = 'false';
				extraClass = 'category-cell';
			}

			if (key === 'نوع الرخصة') {
				isEditable = 'false';
				extraClass = extraClass ? `${extraClass} reference-cell license-type-cell` : 'reference-cell license-type-cell';
				const normalizedLicenseType = normalizeLicenseTypeName(raw);
				cellContent = normalizedLicenseType
					? escapeHtml(normalizedLicenseType)
					: '<span class="empty-reference-cell">اختر...</span>';
			}

			if (key === 'القسم') {
				isEditable = 'false';
				extraClass = extraClass ? `${extraClass} reference-cell station-cell` : 'reference-cell station-cell';
				const sectorKey = resolveSectorKeyFromStation(raw);
				const normalizedStation = normalizeStationName(raw, sectorKey);
				cellContent = normalizedStation
					? escapeHtml(normalizedStation)
					: '<span class="empty-reference-cell">اختر...</span>';
			}

			if (NUMBER_ONLY_COLUMNS.includes(key)) {
				extraClass = extraClass ? `${extraClass} number-cell` : 'number-cell';
			}

			if (key === 'تاريخ الانتهاء' || key === 'تاريخ الايداع') {
				extraClass = 'date-cell';
			}

			if (key === 'نوع الحرز') {
				isEditable = 'false';
				const normalizedType = normalizeSeizeType(raw);
				const depositUiState = getDepositSeizeUiState(item);
				let badgeClass = 'badge-default';
				if (depositUiState.isDeposit) {
					badgeClass = depositUiState.isOverdue ? 'badge-deposit-overdue' : 'badge-deposit-fresh';
				} else if (normalizedType === 'حجز إدارى') badgeClass = 'badge-admin';
				else if (normalizedType === 'مصادرة') badgeClass = 'badge-confiscate';
				else if (normalizedType === 'اعفاء') badgeClass = 'badge-exempt';
				else if (normalizedType === 'سداد رسوم') badgeClass = 'badge-fees';
				const warningReason = depositUiState.tip || getSeizeWarningReason(item);
				const needsWarning = !!warningReason;
				const showTempAdminTip =
					!needsWarning && !depositUiState.isDeposit && normalizedType === 'حجز إدارى' && isTemporaryAdminSeize(item);
				const badgeValue = depositUiState.isDeposit && !depositUiState.isOverdue ? `🕒 ${value}` : value;
				cellContent = `<span class="badge ${badgeClass}" data-row="${originalIndex}">${badgeValue}</span>`;
				if (needsWarning) {
					extraClass = extraClass ? `${extraClass} seize-warning` : 'seize-warning';
					cellContent += `<span class="seize-warning-tip">${warningReason}</span>`;
				} else if (showTempAdminTip) {
					extraClass = extraClass
						? `${extraClass} seize-warning seize-warning-temp`
						: 'seize-warning seize-warning-temp';
					cellContent += `<span class="seize-warning-tip">${getTemporaryAdminSeizeTipText()}</span>`;
				}
			}

			const classAttr = extraClass ? ` class="${extraClass}"` : '';
			return `<td${classAttr} contenteditable="${isEditable}" data-row="${originalIndex}" data-key="${key}">${cellContent}</td>`;
		});

		tr.innerHTML = checkboxCell + rowIndexCell + cells.join('');
		tableBody.appendChild(tr);
	});

	updatePaginationControls(totalPages);
	updateDeleteButtonState();
}

function getSortedRows(rows) {
	if (!sortState.key) {
		return [...rows];
	}

	const copy = [...rows];
	const multiplier = sortState.direction === 'asc' ? 1 : -1;
	copy.sort((a, b) => multiplier * compareValues(a, b, sortState.key));
	return copy;
}

function compareValues(a, b, key) {
	const aVal = normalizeValue(a?.[key]);
	const bVal = normalizeValue(b?.[key]);
	return aVal.localeCompare(bVal, 'ar', { numeric: true, sensitivity: 'base' });
}

function normalizeValue(value) {
	if (value === null || value === undefined) return '';
	const trimmed = String(value).trim();
	return trimmed.replace(/[٠-٩]/g, (d) => EASTERN_TO_WESTERN[d] ?? d);
}

function normalizeForSearch(value) {
	return normalizeValue(value).toLowerCase();
}

const SEARCH_TEXT_CACHE_KEY = '__seizedSearchText';

function debounce(fn, delay = 250) {
	let timerId = null;
	return (...args) => {
		if (timerId) window.clearTimeout(timerId);
		timerId = window.setTimeout(() => fn(...args), delay);
	};
}

function updateRowSearchCache(row) {
	if (!row || typeof row !== 'object') return row;
	const searchText = columnOrder.map((key) => normalizeForSearch(row[key])).join(' ');
	try {
		Object.defineProperty(row, SEARCH_TEXT_CACHE_KEY, {
			value: searchText,
			writable: true,
			configurable: true,
			enumerable: false
		});
	} catch (_) {
		row[SEARCH_TEXT_CACHE_KEY] = searchText;
	}
	return row;
}

function prepareSearchRows(rows = []) {
	return rows.map(updateRowSearchCache);
}

function mergeNormalizeCell(value) {
	if (MERGE_SAVE && typeof MERGE_SAVE.normalizeCell === 'function') {
		return MERGE_SAVE.normalizeCell(value);
	}
	return normalizeValue(value);
}

function cloneRecordForSave(row) {
	const source = row && typeof row === 'object' ? row : {};
	const clone = {};
	columnOrder.forEach((key) => {
		clone[key] = String(source[key] ?? '');
	});
	return clone;
}

function ensureClientRowId(row) {
	if (!row || typeof row !== 'object') return '';
	let rowId = row[CLIENT_ROW_ID_KEY];
	if (!rowId) {
		rowId = `r${nextClientRowNumber++}`;
		try {
			Object.defineProperty(row, CLIENT_ROW_ID_KEY, {
				value: rowId,
				writable: true,
				configurable: true,
				enumerable: false
			});
		} catch (_) {
			row[CLIENT_ROW_ID_KEY] = rowId;
		}
	}
	return rowId;
}

function assignClientRowIds(rows = []) {
	rows.forEach(ensureClientRowId);
	return rows;
}

function resetSaveBaseline(rows = data, version = loadedRecordsVersion) {
	assignClientRowIds(rows);
	baselineRowsById = new Map();
	rows.forEach((row, index) => {
		const id = ensureClientRowId(row);
		baselineRowsById.set(id, {
			id,
			index,
			record: cloneRecordForSave(row)
		});
	});
	dirtyCellsByRowId = new Map();
	insertedRowIds = new Set();
	deletedRowIds = new Set();
	loadedRecordsVersion = version || null;
}

function removeCleanDirtyCell(rowId, key) {
	const rowDirty = dirtyCellsByRowId.get(rowId);
	if (!rowDirty) return;
	rowDirty.delete(key);
	if (rowDirty.size === 0) {
		dirtyCellsByRowId.delete(rowId);
	}
}

function markCellDirty(row, key, value) {
	if (!row || !key) return;
	const rowId = ensureClientRowId(row);
	if (deletedRowIds.has(rowId) || insertedRowIds.has(rowId)) return;
	const baseline = baselineRowsById.get(rowId);
	if (!baseline) {
		insertedRowIds.add(rowId);
		return;
	}
	if (mergeNormalizeCell(value) === mergeNormalizeCell(baseline.record[key])) {
		removeCleanDirtyCell(rowId, key);
		return;
	}
	let rowDirty = dirtyCellsByRowId.get(rowId);
	if (!rowDirty) {
		rowDirty = new Map();
		dirtyCellsByRowId.set(rowId, rowDirty);
	}
	rowDirty.set(key, String(value ?? ''));
}

function setRowCellValue(rowIdx, key, value, options = {}) {
	if (!Number.isInteger(rowIdx) || rowIdx < 0 || !key || !data[rowIdx]) return false;
	data[rowIdx][key] = String(value ?? '');
	if (options.updateSearch !== false) {
		updateRowSearchCache(data[rowIdx]);
	}
	markCellDirty(data[rowIdx], key, data[rowIdx][key]);
	return true;
}

function markRowInserted(row) {
	if (!row) return;
	insertedRowIds.add(ensureClientRowId(row));
}

function markRowDeleted(row) {
	if (!row) return;
	const rowId = ensureClientRowId(row);
	if (insertedRowIds.has(rowId)) {
		insertedRowIds.delete(rowId);
		dirtyCellsByRowId.delete(rowId);
		return;
	}
	deletedRowIds.add(rowId);
	dirtyCellsByRowId.delete(rowId);
}

function markRemovedRows(previousRows, remainingRows) {
	const remaining = new Set(remainingRows);
	previousRows.forEach((row) => {
		if (!remaining.has(row)) markRowDeleted(row);
	});
}

function hasPendingRecordChanges() {
	return dirtyCellsByRowId.size > 0 || insertedRowIds.size > 0 || deletedRowIds.size > 0;
}

function buildPendingChangeSet() {
	const edits = [];
	dirtyCellsByRowId.forEach((rowDirty, rowId) => {
		rowDirty.forEach((value, key) => {
			edits.push({ id: rowId, key, value });
		});
	});

	const insertedRecords = [];
	data.forEach((row, index) => {
		const rowId = ensureClientRowId(row);
		if (insertedRowIds.has(rowId)) {
			insertedRecords.push({ id: rowId, position: index, record: cloneRecordForSave(row) });
		}
	});

	return {
		baseRows: Array.from(baselineRowsById.values()).map((entry) => ({
			id: entry.id,
			index: entry.index,
			record: cloneRecordForSave(entry.record)
		})),
		edits,
		insertedRecords,
		deletedIds: Array.from(deletedRowIds)
	};
}

function applySavedRecords(records, version) {
	data = prepareSearchRows(assignClientRowIds(cleanRows(records)));
	selectedRows.clear();
	resetSaveBaseline(data, version);
}

function getSaveErrorMessage(error) {
	if (error && error.code === 'seized-merge-conflict') {
		return 'تعارض في الحفظ: تم تعديل نفس السجل من مستخدم آخر. اضغط تحديث ثم راجع التغييرات.';
	}
	if (error && error.code === 'records-version-conflict') {
		return 'تغيرت البيانات أثناء الحفظ. أعد المحاولة.';
	}
	return 'تعذر الحفظ';
}

function resolveSectorKeyFromStation(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';
	if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.detectSectorKeyFromStation === 'function') {
		const detected = SHARED_REFERENCE_DATA.detectSectorKeyFromStation(raw);
		if (detected) return detected;
	}
	const normalizedRaw = normalizeStationName(raw);
	for (const [sectorKey, stations] of Object.entries(sectorStations)) {
		const hasStation = (Array.isArray(stations) ? stations : []).some((station) => {
			return normalizeStationName(station, sectorKey) === normalizedRaw;
		});
		if (hasStation) return sectorKey;
	}
	return '';
}

function normalizeStationName(value, sectorKey = '') {
	const raw = String(value || '').trim();
	if (!raw) return '';
	if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveStationName === 'function') {
		return SHARED_REFERENCE_DATA.resolveStationName(raw, sectorKey) || raw;
	}
	return raw;
}

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function normalizeLicenseTypeName(value) {
	const raw = normalizeValue(value).trim();
	if (!raw) return '';
	if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.resolveLicenseType === 'function') {
		return SHARED_REFERENCE_DATA.resolveLicenseType(raw, LICENSE_TYPE_SCOPE) || raw;
	}
	return raw;
}

function getSeizedLicenseTypeOptions(currentValue = '') {
	const sharedOptions = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getLicenseTypes === 'function'
		? SHARED_REFERENCE_DATA.getLicenseTypes(LICENSE_TYPE_SCOPE)
		: null;
	const sourceOptions = Array.isArray(sharedOptions) && sharedOptions.length
		? sharedOptions
		: fallbackLicenseTypeOptions;
	const options = new Set(sourceOptions.map((option) => normalizeLicenseTypeName(option)).filter(Boolean));
	const normalizedCurrent = normalizeLicenseTypeName(currentValue);
	if (normalizedCurrent) options.add(normalizedCurrent);
	return Array.from(options);
}

function getSectorOptionsHtml(selectedSector = '', emptyLabel = 'اختر القطاع') {
	const selected = String(selectedSector || '').trim();
	const choices = getSeizedSectorChoices();
	const options = choices.map(({ key, label }) => {
		const optionKey = String(key || '').trim();
		const isSelected = optionKey === selected ? ' selected' : '';
		return `<option value="${escapeHtml(optionKey)}"${isSelected}>${escapeHtml(label || optionKey)}</option>`;
	}).join('');
	return `<option value="">${escapeHtml(emptyLabel)}</option>${options}`;
}

function getStationOptionsForSector(sectorKey, currentValue = '') {
	const normalizedSector = String(sectorKey || '').trim();
	if (!normalizedSector) return [];
	const sharedStations = SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getStationsForSector === 'function'
		? SHARED_REFERENCE_DATA.getStationsForSector(normalizedSector)
		: null;
	const sourceStations = Array.isArray(sharedStations) && sharedStations.length
		? sharedStations
		: (Array.isArray(sectorStations[normalizedSector]) ? sectorStations[normalizedSector] : []);
	const options = new Set(sourceStations.map((station) => normalizeStationName(station, normalizedSector)).filter(Boolean));
	const normalizedCurrent = normalizeStationName(currentValue, normalizedSector);
	if (normalizedCurrent) options.add(normalizedCurrent);
	return Array.from(options);
}

function getStationOptionsHtml(sectorKey, selectedStation = '', emptyLabel = 'اختر القسم') {
	const selected = normalizeStationName(selectedStation, sectorKey);
	const options = getStationOptionsForSector(sectorKey, selected).map((station) => {
		const isSelected = station === selected ? ' selected' : '';
		return `<option value="${escapeHtml(station)}"${isSelected}>${escapeHtml(station)}</option>`;
	}).join('');
	return `<option value="">${escapeHtml(emptyLabel)}</option>${options}`;
}

function populateSeizedStationSelect(selectEl, sectorKey, selectedStation = '') {
	if (!selectEl) return;
	const normalizedSector = String(sectorKey || '').trim();
	selectEl.innerHTML = getStationOptionsHtml(normalizedSector, selectedStation);
	selectEl.disabled = !normalizedSector;
	const normalizedStation = normalizeStationName(selectedStation, normalizedSector);
	selectEl.value = normalizedStation;
	if (normalizedStation && selectEl.value !== normalizedStation) {
		selectEl.value = '';
	}
}

function bindStationFieldControls(root) {
	const sectorSelect = root?.querySelector('[data-station-sector-select]');
	const stationSelect = root?.querySelector('[data-station-select]');
	if (!sectorSelect || !stationSelect) return;

	const updateStationOptions = (selectedStation = '') => {
		populateSeizedStationSelect(stationSelect, sectorSelect.value, selectedStation);
	};

	sectorSelect.addEventListener('change', () => updateStationOptions(''));
	updateStationOptions(stationSelect.value);
}

function normalizeArabicForMatch(text) {
	if (!text) return '';
	return String(text)
		// remove Arabic diacritics + tatweel
		.replace(/[\u064B-\u0652\u0640]/g, '')
		// normalize common letter variants
		.replace(/[إأآٱ]/g, 'ا')
		.replace(/ى/g, 'ي')
		// normalize ta marbuta to ha (common typing variation)
		.replace(/ة/g, 'ه')
		.replace(/ؤ/g, 'و')
		.replace(/ئ/g, 'ي');
}

function stripArabicWordPrefixes(word) {
	if (!word) return '';
	let w = String(word).trim();
	// common Arabic attached particles/prefixes
	if (w.startsWith('لل')) w = w.slice(2);
	if (w.startsWith('ال')) w = w.slice(2);
	while (w.length >= 4 && ['و', 'ف', 'ب', 'ك', 'ل'].includes(w[0])) {
		w = w.slice(1);
	}
	if (w.startsWith('ال')) w = w.slice(2);
	return w.trim();
}

function looseNormalizeTextForMatch(value) {
	const normalized = normalizeCompanyText(value);
	if (!normalized) return '';
	return normalized
		.split(' ')
		.map(stripArabicWordPrefixes)
		.filter(Boolean)
		.join(' ')
		.trim();
}

function normalizeCompanyText(value) {
	return normalizeArabicForMatch(normalizeValue(value).toLowerCase()).replace(/\s+/g, ' ').trim();
}

function stripGenericCompanyWords(normalizedCompanyText) {
	if (!normalizedCompanyText) return '';
	return normalizedCompanyText
		.split(' ')
		.filter((word) => word && !GENERIC_COMPANY_WORDS.includes(word))
		.join(' ')
		.trim();
}

function tokenMatchCompany(tokens, targets, tokenFrequency = {}) {
	if (!tokens || tokens.length === 0) return false;
	const targetWords = new Set();
	targets
		.filter(Boolean)
		.forEach((target) => {
			normalizeCompanyText(target)
				.split(' ')
				.map(stripArabicWordPrefixes)
				.filter(Boolean)
				.forEach((w) => targetWords.add(w));
		});

	const hits = new Set();
	let hasUniqueHit = false;
	tokens.forEach((token) => {
		const looseToken = stripArabicWordPrefixes(token);
		if (!looseToken || looseToken.length < 3) return;
		targetWords.forEach((tw) => {
			if (tw.includes(looseToken) || looseToken.includes(tw)) hits.add(looseToken);
		});
		const freq = tokenFrequency?.[looseToken] ?? 0;
		if (hits.has(looseToken) && freq === 1 && looseToken.length >= 4) {
			hasUniqueHit = true;
		}
	});

	if (hasUniqueHit) return true;
	const required = tokens.length === 1 ? 1 : Math.min(tokens.length, 2);
	return hits.size >= required;
}

function normalizeSeizeType(value) {
	const v = normalizeValue(value).toLowerCase();
	if (v.includes('تنازل')) return 'تنازل';
	if (v.includes('مصادر')) return 'مصادرة';
	if (v.includes('اعفاء')) return 'اعفاء';
	if (v.includes('حجز')) return 'حجز إدارى';
	if (v.includes('رسوم') || v.includes('سداد')) return 'سداد رسوم';
	if (v.includes('ايداع')) return 'ايداع';
	return normalizeValue(value);
}

function parseDateValue(value) {
	if (!value) return null;
	const normalized = normalizeValue(value);
	const parts = normalized.split('/');
	if (parts.length !== 3) return null;
	let day, month, year;
	if (parts[0].length === 4) {
		year = Number(parts[0]);
		month = Number(parts[1]);
		day = Number(parts[2]);
	} else {
		day = Number(parts[0]);
		month = Number(parts[1]);
		year = Number(parts[2]);
	}
	if (!year || !month || !day) return null;
	return new Date(Date.UTC(year, month - 1, day));
}

function hasTwoMonthsPassedFromDeposit(row) {
	if (!row) return false;
	const depositDate = parseDateValue(row['تاريخ الايداع']);
	if (!depositDate) return false;
	const dueDate = new Date(depositDate.getTime());
	dueDate.setUTCMonth(dueDate.getUTCMonth() + 2);
	const now = new Date();
	const nowUtc = new Date(
		Date.UTC(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			now.getHours(),
			now.getMinutes(),
			now.getSeconds()
		)
	);
	return nowUtc >= dueDate;
}

function getDepositSeizeUiState(row) {
	const normalizedType = normalizeSeizeType(row?.['نوع الحرز']);
	if (normalizedType !== 'ايداع') {
		return {
			isDeposit: false,
			isOverdue: false,
			tip: null
		};
	}

	const isOverdue = hasTwoMonthsPassedFromDeposit(row);
	return {
		isDeposit: true,
		isOverdue,
		tip: isOverdue ? 'تم مر شهرين من الايداع' : null
	};
}

function updateDepositStatusFilterVisibility() {
	if (!depositStatusFilter) return;
	const isDepositSelected = normalizeSeizeType(selectedSeizeType) === 'ايداع';
	depositStatusFilter.hidden = !isDepositSelected;

	if (!isDepositSelected) {
		selectedDepositPassFilter = 'all';
	}

	if (depositStatusBtns && depositStatusBtns.length > 0) {
		depositStatusBtns.forEach((btn) => {
			const mode = btn.dataset.depositPass;
			btn.classList.toggle('active', isDepositSelected && selectedDepositPassFilter === mode);
		});
	}
}

function isTemporaryAdminSeize(row) {
	if (!row) return false;
	const owner = row['مالك الحرز'];
	if (!isCompanyM(owner)) return false;
	const endDt = parseDateValue(row['تاريخ الانتهاء']);
	return !endDt;
}

function getTemporaryAdminSeizeTipText() {
	return 'شركة مصادرة: هذا الحرز على حجز إدارى مؤقتاً لعدم وجود تاريخ انتهاء';
}

function isWarathaOwner(name) {
	const normalizedOwner = normalizeCompanyText(name);
	return !!normalizedOwner && normalizedOwner.includes('الورثة الشرعيين');
}

function expectedSeizeType(row) {
	if (!row) return null;
	const owner = row['مالك الحرز'];
	// الورثة الشرعيين: rule based on end date cutoff (10/02/2021)
	if (isWarathaOwner(owner)) {
		const endDt = parseDateValue(row['تاريخ الانتهاء']);
		if (endDt && endDt < WARATHA_ENDDATE_CUTOFF) return 'مصادرة';
		return 'حجز إدارى';
	}
	// companiesH → always حجز إدارى
	if (isCompanyH(owner)) return 'حجز إدارى';
	// companiesM → مصادرة by default, unless NO end date
	if (isCompanyM(owner)) {
		const endDt = parseDateValue(row['تاريخ الانتهاء']);
		return !endDt ? 'حجز إدارى' : 'مصادرة';
	}
	// Non-company: date-based rule
	const dt = parseDateValue(row['تاريخ الايداع']);
	if (!dt) return null;
	return dt < DATE_CUTOFF ? 'مصادرة' : 'حجز إدارى';
}

function getSeizeWarningReason(row) {
	if (!row) return null;
	const owner = row['مالك الحرز'];
	const normalizedType = normalizeSeizeType(row['نوع الحرز']);
	// سداد رسوم/اعفاء فئات مختلفة لا تحتاج لتلميح تحذير
	if (normalizedType === 'سداد رسوم' || normalizedType === 'اعفاء') return null;
	// IMPORTANT: warning tips are only for owners included in companies lists (and rules-based الورثة).
	if (!isCompanyOwner(owner)) return null;
	// لو المالك جهة/شركة لكنها غير موجودة في قوائم الشركات، لا نعرض تحذير.
	if (isUnknownCompanyOwner(owner)) return null;
	const expected = expectedSeizeType(row);
	if (!expected || normalizedType === expected) return null;
	if (isWarathaOwner(owner)) {
		const endDt = parseDateValue(row['تاريخ الانتهاء']);
		if (endDt && endDt < WARATHA_ENDDATE_CUTOFF) {
			return 'الورثة الشرعيين: تاريخ الانتهاء قبل 10/02/2021 → مصادرة';
		}
		if (endDt) {
			return 'الورثة الشرعيين: تاريخ الانتهاء بعد 10/02/2021 → حجز إدارى';
		}
		return 'الورثة الشرعيين: لا يوجد تاريخ انتهاء → حجز إدارى';
	}
	if (isCompanyH(owner)) {
		return 'شركة حجز إدارى: يجب أن يكون حجز إدارى';
	}
	if (isCompanyM(owner)) {
		const endDt = parseDateValue(row['تاريخ الانتهاء']);
		if (!endDt) {
			return 'شركة مصادرة: لا يوجد تاريخ انتهاء → حجز إدارى (مؤقتاً)';
		}
		return 'شركة مصادرة: يوجد تاريخ انتهاء → مصادرة';
	}
	const dt = parseDateValue(row['تاريخ الايداع']);
	if (dt) {
		return dt < DATE_CUTOFF
			? 'تاريخ الايداع قبل 10/02/2016: يجب أن يكون مصادرة'
			: 'تاريخ الايداع بعد 10/02/2016: يجب أن يكون حجز إدارى';
	}
	return `المتوقع: ${expected}`;
}

function matchesCompanyCache(name, cache) {
	const normalizedOwner = normalizeCompanyText(name);
	if (!normalizedOwner) return false;
	const strippedOwner = stripGenericCompanyWords(normalizedOwner);
	const looseOwner = looseNormalizeTextForMatch(strippedOwner || normalizedOwner);
	if (cache.namesNormalized.some((n) => n && normalizedOwner.includes(n))) return true;
	if (cache.namesStripped.some((n) => n && (strippedOwner.includes(n) || normalizedOwner.includes(n)))) return true;
	if (cache.namesLoose.some((n) => n && looseOwner.includes(n))) return true;
	if (cache.chunks.some((chunk) => chunk && normalizedOwner.includes(chunk))) return true;
	if (cache.chunksStripped.some((chunk) => chunk && strippedOwner.includes(chunk))) return true;
	if (cache.chunksLoose.some((chunk) => chunk && looseOwner.includes(chunk))) return true;
	return cache.tokensList.some((tokens) => tokenMatchCompany(tokens, [normalizedOwner, strippedOwner, looseOwner], cache.tokenFrequency));
}

function isCompanyH(name) {
	const normalizedOwner = normalizeCompanyText(name);
	if (!normalizedOwner) return false;
	if (normalizedOwner.includes('الورثة الشرعيين')) return true;
	return matchesCompanyCache(name, companyCacheH);
}

function isCompanyM(name) {
	return matchesCompanyCache(name, companyCacheM);
}

function isCompanyOwner(name) {
	return isCompanyH(name) || isCompanyM(name);
}

function isUnknownCompanyOwner(name) {
	const normalizedOwner = normalizeCompanyText(name);
	if (!normalizedOwner) return false;
	if (isCompanyOwner(name) || isWarathaOwner(name)) return false;
	return GENERIC_COMPANY_WORDS.some((w) => normalizedOwner.includes(w));
}

function buildCompanyCache(companiesArr) {
	const cache = {
		namesNormalized: [],
		namesStripped: [],
		namesLoose: [],
		chunks: [],
		chunksStripped: [],
		chunksLoose: [],
		tokensList: [],
		tokenFrequency: {}
	};

	companiesArr.forEach((c) => {
		const normalizedName = normalizeCompanyText(c.name);
		if (!normalizedName) return;
		cache.namesNormalized.push(normalizedName);

		const strippedName = stripGenericCompanyWords(normalizedName);
		if (strippedName) cache.namesStripped.push(strippedName);
		const looseName = looseNormalizeTextForMatch(strippedName || normalizedName);
		if (looseName) cache.namesLoose.push(looseName);

		const len = normalizedName.length;
		const half = Math.max(3, Math.ceil(len / 2));
		const chunk = normalizedName.slice(0, half).trim();
		if (chunk) cache.chunks.push(chunk);

		const strippedHalf = Math.max(3, Math.ceil(strippedName.length / 2));
		const strippedChunk = strippedName.slice(0, strippedHalf).trim();
		if (strippedChunk) cache.chunksStripped.push(strippedChunk);
		const looseChunk = looseName.slice(0, Math.max(3, Math.ceil(looseName.length / 2))).trim();
		if (looseChunk) cache.chunksLoose.push(looseChunk);

		const tokenSource = looseName || strippedName || normalizedName;
		const tokens = tokenSource
			.split(' ')
			.map(stripArabicWordPrefixes)
			.filter((w) => w && w.length >= 3);
		if (tokens.length > 0) {
			cache.tokensList.push(tokens);
			tokens.forEach((t) => {
				cache.tokenFrequency[t] = (cache.tokenFrequency[t] || 0) + 1;
			});
		}
	});

	return cache;
}

function setCompanyList(companiesArr) {
	currentCompanies = companiesArr;
	const cache = buildCompanyCache(companiesArr);
	companyNamesNormalized = cache.namesNormalized;
	companyNamesStripped = cache.namesStripped;
	companyNamesLoose = cache.namesLoose;
	companyNameChunks = cache.chunks;
	companyNameChunksStripped = cache.chunksStripped;
	companyNameChunksLoose = cache.chunksLoose;
	companyTokensList = cache.tokensList;
	companyTokenFrequency = cache.tokenFrequency;
}

function enforceCompanyRulesOnData(refreshDom = false) {
	// IMPORTANT: Do not mutate the dataset here.
	// This function only refreshes the warning badges/tooltips.
	if (!data || data.length === 0) return;
	if (!refreshDom) return;
	data.forEach((_row, idx) => updateSeizeCell(idx));
}

function updateSeizeCell(rowIdx) {
	const td = tableBody.querySelector(`td[data-row="${rowIdx}"][data-key="نوع الحرز"]`);
	if (!td || !data[rowIdx]) return;
	const raw = data[rowIdx]['نوع الحرز'] ?? '';
	const normalizedType = normalizeSeizeType(raw);
	const depositUiState = getDepositSeizeUiState(data[rowIdx]);
	let badgeClass = 'badge-default';
	if (depositUiState.isDeposit) {
		badgeClass = depositUiState.isOverdue ? 'badge-deposit-overdue' : 'badge-deposit-fresh';
	} else if (normalizedType === 'حجز إدارى') badgeClass = 'badge-admin';
	else if (normalizedType === 'مصادرة') badgeClass = 'badge-confiscate';
	else if (normalizedType === 'اعفاء') badgeClass = 'badge-exempt';
	else if (normalizedType === 'سداد رسوم') badgeClass = 'badge-fees';
	const warningReason = depositUiState.tip || getSeizeWarningReason(data[rowIdx]);
	const needsWarning = !!warningReason;
	const showTempAdminTip =
		!needsWarning && !depositUiState.isDeposit && normalizedType === 'حجز إدارى' && isTemporaryAdminSeize(data[rowIdx]);
	const badgeText = depositUiState.isDeposit && !depositUiState.isOverdue ? `🕒 ${raw}` : raw;
	let html = `<span class="badge ${badgeClass}" data-row="${rowIdx}">${badgeText}</span>`;
	if (needsWarning) {
		html += `<span class="seize-warning-tip">${warningReason}</span>`;
	} else if (showTempAdminTip) {
		html += `<span class="seize-warning-tip">${getTemporaryAdminSeizeTipText()}</span>`;
	}
	td.innerHTML = html;
	td.classList.toggle('seize-warning', needsWarning || showTempAdminTip);
	td.classList.toggle('seize-warning-temp', showTempAdminTip);
}

function isMeaningfulRow(row) {
	if (!row) return false;
	return meaningfulColumns.some((key) => normalizeValue(row[key]) !== '');
}

function cleanRows(rows = []) {
	return rows.filter(isMeaningfulRow);
}

function handleSort(key) {
	if (sortState.key === key) {
		sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
	} else {
		sortState.key = key;
		sortState.direction = 'asc';
	}
	updateSortIndicators();
	renderRows(filteredData, 1);
}

function updateSortIndicators() {
	headerCells.forEach((th) => {
		th.classList.remove('sorted-asc', 'sorted-desc');
		const columnKey = th.dataset.column;
		if (columnKey && columnKey === sortState.key) {
			th.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
		}
	});
}

function normalizeFetchedRecords(records) {
	return (Array.isArray(records) ? records : [])
		.map((row) => ({
			...row,
			'الاسم': row['الاسم'] || row['أسم المسحوب منه السلاح'] || ''
		}))
		.filter(isMeaningfulRow)
		.map(cloneRecordForSave);
}

async function fetchRecordsPayload() {
	const res = await fetch(buildApiUrl('/records'), { cache: 'no-store' });
	if (!res.ok) throw new Error('Failed to load records');
	const json = await res.json();
	return {
		records: normalizeFetchedRecords(json.records),
		version: json.version || null
	};
}

async function fetchRecords() {
	const payload = await fetchRecordsPayload();
	loadedRecordsVersion = payload.version || null;
	return payload.records.map(updateRowSearchCache);
}

let companyCacheH = { namesNormalized: [], namesStripped: [], namesLoose: [], chunks: [], chunksStripped: [], chunksLoose: [], tokensList: [], tokenFrequency: {} };
let companyCacheM = { namesNormalized: [], namesStripped: [], namesLoose: [], chunks: [], chunksStripped: [], chunksLoose: [], tokensList: [], tokenFrequency: {} };
let companyRulesPromise = null;

function runWhenIdle(callback) {
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(callback, { timeout: 5000 });
		return;
	}
	window.setTimeout(callback, 700);
}

async function fetchCompanyListForRules() {
	try {
		// Load both company lists in parallel
		const [resH, resM] = await Promise.all([
			fetch(buildApiUrl('/companies?kind=H')),
			fetch(buildApiUrl('/companies?kind=M'))
		]);
		const jsonH = await resH.json();
		const jsonM = await resM.json();

		const toArr = (json) => {
			if (Array.isArray(json.companies)) return json.companies;
			if (json.companies && typeof json.companies === 'object') {
				return Object.keys(json.companies)
					.map(Number)
					.sort((a, b) => a - b)
					.map((id) => ({ id, name: json.companies[id] }));
			}
			return [];
		};

		const companiesH = toArr(jsonH);
		const companiesM = toArr(jsonM);

		companyCacheH = buildCompanyCache(companiesH);
		companyCacheM = buildCompanyCache(companiesM);

		// Keep legacy setCompanyList for UI modal (defaults to H)
		setCompanyList(companiesH);
		return companiesH;
	} catch (err) {
		console.error('Failed to load companies list', err);
		companyNamesNormalized = [];
		companyNamesStripped = [];
		companyNamesLoose = [];
		companyNameChunks = [];
		companyNameChunksStripped = [];
		companyNameChunksLoose = [];
		companyTokensList = [];
		companyTokenFrequency = {};
		return [];
	}
}

function ensureCompanyRulesLoaded() {
	if (!companyRulesPromise) {
		companyRulesPromise = fetchCompanyListForRules().catch((err) => {
			companyRulesPromise = null;
			throw err;
		});
	}
	return companyRulesPromise;
}

function refreshRenderedSeizeCells() {
	if (!tableBody) return;
	const visibleRows = new Set();
	tableBody.querySelectorAll('td[data-row][data-key="نوع الحرز"]').forEach((cell) => {
		const rowIdx = Number(cell.getAttribute('data-row'));
		if (Number.isInteger(rowIdx) && rowIdx >= 0) visibleRows.add(rowIdx);
	});
	visibleRows.forEach((rowIdx) => updateSeizeCell(rowIdx));
}

function scheduleCompanyRulesRefresh() {
	runWhenIdle(() => {
		ensureCompanyRulesLoaded()
			.then(refreshRenderedSeizeCells)
			.catch(() => {});
	});
}

async function postRecords(records, baseVersion) {
	const res = await fetch(buildApiUrl('/records'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ records, baseVersion: baseVersion || null })
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		const error = new Error(json.error || 'Failed to save records');
		error.code = json.code || (res.status === 409 ? 'records-version-conflict' : 'save-failed');
		error.payload = json;
		throw error;
	}
	return json;
}

function buildMergeConflictError(conflicts) {
	const error = new Error('Seized save merge conflict');
	error.code = 'seized-merge-conflict';
	error.conflicts = conflicts;
	return error;
}

async function saveRecords() {
	if (!MERGE_SAVE || typeof MERGE_SAVE.mergeRecordChanges !== 'function') {
		throw new Error('Seized merge-save helper is unavailable.');
	}

	if (!hasPendingRecordChanges()) {
		return { ok: true, count: data.length, version: loadedRecordsVersion, skipped: true };
	}

	let lastConflictError = null;
	for (let attempt = 0; attempt < SAVE_RETRY_LIMIT; attempt += 1) {
		const latest = await fetchRecordsPayload();
		const pending = buildPendingChangeSet();
		const merged = MERGE_SAVE.mergeRecordChanges({
			columns: columnOrder,
			keyColumns: PRIMARY_MATCH_COLUMNS,
			baseRows: pending.baseRows,
			latestRecords: latest.records,
			edits: pending.edits,
			insertedRecords: pending.insertedRecords,
			deletedIds: pending.deletedIds
		});

		if (merged.conflicts.length) {
			throw buildMergeConflictError(merged.conflicts);
		}

		try {
			const saved = await postRecords(merged.records, latest.version);
			if (saved && saved.approvalRequired) {
				setStatus(saved.message || 'تم إرسال طلب الاعتماد إلى المدير والسيكرتير الأول.');
				return saved;
			}
			applySavedRecords(merged.records, saved.version || latest.version);
			return saved;
		} catch (error) {
			if (error && error.code === 'records-version-conflict') {
				lastConflictError = error;
				continue;
			}
			throw error;
		}
	}

	throw lastConflictError || new Error('Failed to save records after retrying.');
}

async function bootstrap() {
	try {
		if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.refresh === 'function') {
			await SHARED_REFERENCE_DATA.refresh().catch((error) => {
				console.warn('Failed to refresh shared reference data', error);
			});
		}
		const records = await fetchRecords();
		data = prepareSearchRows(assignClientRowIds(cleanRows(records)));
		resetSaveBaseline(data, loadedRecordsVersion);
		filteredData = [...data];
		updateFilterCounts();
		renderRows(filteredData, 1);
		applyDeleteApprovalInspectTarget();
		scheduleCompanyRulesRefresh();
	} catch (err) {
		console.error(err);
		// احتياطي: لو فشل التحميل، نستخدم بيانات نموذجية.
		data = prepareSearchRows(assignClientRowIds([
			{
				'الفئة': '(ب)',
				'رقم الحرز': '20',
				'رقم الرخصة': '1280',
				'نوع الرخصة': '',
				'القسم': 'مكتب تجريبي 20',
				'الاسم': 'ابو سريع عبدالصادق مدكور',
				'النوع': 'مسدس',
				'العيار': '9مم طويل',
				'الماركة': 'بلجيكى',
				'الرقم': '245 PY 45455',
				'سبب الالغاء': 'الوفاة',
				'تاريخ الايداع': '٢٠٠٩/٠١/٠٣',
				'تاريخ الانتهاء': '',
				'مالك الحرز': 'الورثة الشرعيين',
				'نوع الحرز': 'حجز إدارى',
				'ملاحظات': ''
			}
		]));
		resetSaveBaseline(data, null);
		filteredData = [...data];
		updateFilterCounts();
		renderRows(filteredData, 1);
		applyDeleteApprovalInspectTarget();
	}
}

// أزرار الترقيم والتنزيل.
reloadBtn.addEventListener('click', () => {
	currentPage = 1;
	setStatus('... جارِ التحديث');
	bootstrap().then(() => setStatus('تم التحديث')).catch((err) => setStatus('فشل التحديث'));
});

prevPage.addEventListener('click', () => {
	if (currentPage > 1) {
		currentPage -= 1;
		renderRows(filteredData, currentPage);
		scrollTableToTop();
	}
});

if (firstPage) {
	firstPage.addEventListener('click', () => {
		if (currentPage !== 1) {
			currentPage = 1;
			renderRows(filteredData, currentPage);
			scrollTableToTop();
		}
	});
}

if (lastPage) {
	lastPage.addEventListener('click', () => {
		const totalPages = getTotalPages(filteredData);
		if (currentPage !== totalPages) {
			currentPage = totalPages;
			renderRows(filteredData, currentPage);
			scrollTableToTop();
		}
	});
}

// ========== Date Input Handling ==========
function toWesternDigits(str) {
	return String(str).replace(/[٠-٩]/g, (d) => EASTERN_TO_WESTERN[d] ?? d);
}

function toEasternDigits(str) {
	return String(str).replace(/[0-9]/g, (d) => WESTERN_TO_EASTERN[d] ?? d);
}

function extractEditableText(element) {
	let text = '';
	if (!element) return text;
	element.childNodes.forEach((node) => {
		if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
	});
	return text;
}

function cleanDateTextWestern(value) {
	let cleaned = toWesternDigits(String(value ?? '')).replace(/[^0-9/]/g, '');
	cleaned = cleaned.replace(/\/+/g, '/');
	if (!cleaned.includes('/')) return cleaned.slice(0, 8);
	const parts = cleaned.split('/').slice(0, 3).map((part, index) => {
		const maxLength = index === 1 ? 2 : 4;
		return part.slice(0, maxLength);
	});
	return parts.join('/');
}

function padDatePart(value) {
	return String(value ?? '').padStart(2, '0').slice(-2);
}

function isValidYmdDate(year, month, day) {
	const y = Number(year);
	const m = Number(month);
	const d = Number(day);
	if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
	if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function formatCompleteDateYmd(year, month, day) {
	const y = String(year ?? '');
	if (y.length !== 4) return '';
	const mm = padDatePart(month);
	const dd = padDatePart(day);
	return isValidYmdDate(y, mm, dd) ? `${y}/${mm}/${dd}` : '';
}

function parseCompleteDateToYmd(value) {
	const western = cleanDateTextWestern(value);
	const parts = western.split('/').filter(Boolean).slice(0, 3);

	if (parts.length === 3) {
		if (parts[0].length === 4) {
			const formatted = formatCompleteDateYmd(parts[0], parts[1], parts[2]);
			if (formatted) return formatted;
		}
		if (parts[2].length === 4) {
			const formatted = formatCompleteDateYmd(parts[2], parts[1], parts[0]);
			if (formatted) return formatted;
		}
	}

	const digits = western.replace(/[^0-9]/g, '');
	if (digits.length === 8) {
		const yFirst = formatCompleteDateYmd(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8));
		if (yFirst) return yFirst;
		const yLast = formatCompleteDateYmd(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2));
		if (yLast) return yLast;
	}

	return '';
}

function normalizeDateText(value, options = {}) {
	const complete = parseCompleteDateToYmd(value);
	if (complete) return complete;
	return cleanDateTextWestern(value);
}

function normalizeDateTextForDisplay(value, options = {}) {
	return toEasternDigits(normalizeDateText(value, options));
}

function getCaretOffset(cell) {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return null;
	const range = selection.getRangeAt(0);
	if (!cell.contains(range.startContainer)) return null;
	const textNode = cell.firstChild;
	if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;
	return Math.min(range.startOffset, textNode.length);
}

function setCaretOffset(cell, offset) {
	const selection = window.getSelection();
	const textNode = cell.firstChild;
	if (!selection || !textNode || textNode.nodeType !== Node.TEXT_NODE) return;
	const pos = Math.max(0, Math.min(offset, textNode.length));
	const newRange = document.createRange();
	newRange.setStart(textNode, pos);
	newRange.collapse(true);
	selection.removeAllRanges();
	selection.addRange(newRange);
}

function showDateError(cell) {
	let tooltip = cell.querySelector('.date-error-tooltip');
	if (!tooltip) {
		tooltip = document.createElement('span');
		tooltip.className = 'date-error-tooltip';
		tooltip.textContent = 'تاريخ فقط';
		tooltip.contentEditable = 'false';
		cell.appendChild(tooltip);
	}
	tooltip.classList.add('visible');
	setTimeout(() => tooltip.classList.remove('visible'), 1500);
}

function showNumberError(cell) {
	let tooltip = cell.querySelector('.number-error-tooltip');
	if (!tooltip) {
		tooltip = document.createElement('span');
		tooltip.className = 'number-error-tooltip';
		tooltip.textContent = 'ارقام فقط';
		tooltip.contentEditable = 'false';
		cell.appendChild(tooltip);
	}
	tooltip.classList.add('visible');
	setTimeout(() => tooltip.classList.remove('visible'), 1500);
}

function sanitizeDateInput(cell) {
	const tooltip = cell.querySelector('.date-error-tooltip');
	const caretBefore = getCaretOffset(cell);
	const text = extractEditableText(cell);
	const eastern = normalizeDateTextForDisplay(text);
	cell.textContent = eastern;
	if (tooltip) cell.appendChild(tooltip);
	if (caretBefore !== null) {
		const normalized = parseCompleteDateToYmd(text);
		setCaretOffset(cell, normalized ? eastern.length : Math.min(caretBefore, eastern.length));
	}

	return eastern;
}

function sanitizeNumberCell(cell) {
	const tooltip = cell.querySelector('.number-error-tooltip');
	const caretBefore = getCaretOffset(cell);
	const text = extractEditableText(cell);

	let digits = toWesternDigits(text).replace(/[^0-9]/g, '');
	const eastern = toEasternDigits(digits);
	cell.textContent = eastern;
	if (tooltip) cell.appendChild(tooltip);
	if (caretBefore !== null) setCaretOffset(cell, Math.min(caretBefore, eastern.length));

	const rowIdx = Number(cell.dataset.row);
	const key = cell.dataset.key;
	if (!Number.isNaN(rowIdx) && key && data[rowIdx]) {
		data[rowIdx][key] = eastern;
		updateRowSearchCache(data[rowIdx]);
		markCellDirty(data[rowIdx], key, eastern);
	}

	return eastern;
}

function formatDateInput(cell) {
	return sanitizeDateInput(cell);
}

// Finalize: if dd/mm/yyyy -> convert to yyyy/mm/dd; if already yyyy/mm/dd keep; pad month/day
function finalizeDateCell(cell) {
	const tooltip = cell.querySelector('.date-error-tooltip');
	const text = extractEditableText(cell);
	const eastern = normalizeDateTextForDisplay(text, { finalize: true });
	cell.textContent = eastern;
	if (tooltip) cell.appendChild(tooltip);

	return eastern;
}

function normalizeNoteDateText(raw) {
	const original = String(raw ?? '');
	if (!original.trim()) return original;

	const pad2 = (part) => String(part ?? '').padStart(2, '0').slice(-2);
	const toYear4 = (yearStr) => {
		const y = String(yearStr ?? '').trim();
		if (!y) return '';
		if (y.length === 4) return y;
		if (y.length === 2) {
			const num = Number(y);
			return `${num >= 50 ? '19' : '20'}${pad2(y)}`;
		}
		if (y.length === 3) return `2${y}`;
		return '';
	};
	const isValidYMD = (y, m, d) => {
		const yNum = Number(y);
		const mNum = Number(m);
		const dNum = Number(d);
		if (!Number.isFinite(yNum) || !Number.isFinite(mNum) || !Number.isFinite(dNum)) return false;
		if (yNum < 1900 || yNum > 2100) return false;
		if (mNum < 1 || mNum > 12) return false;
		if (dNum < 1 || dNum > 31) return false;
		return true;
	};

	const formatYMD = (year, month, day) => {
		const y4 = toYear4(year);
		if (!y4) return null;
		const mm = pad2(month);
		const dd = pad2(day);
		if (!isValidYMD(y4, mm, dd)) return null;
		return toEasternDigits(`${y4}/${mm}/${dd}`);
	};
	const formatYM = (year, month) => {
		const y4 = toYear4(year);
		const mm = pad2(month);
		const yNum = Number(y4);
		const mNum = Number(mm);
		if (!y4 || !Number.isFinite(yNum) || yNum < 1900 || yNum > 2100) return null;
		if (!Number.isFinite(mNum) || mNum < 1 || mNum > 12) return null;
		return toEasternDigits(`${y4}/${mm}`);
	};

	const formatFromTriplet = (p1, p2, p3) => {
		const a = toWesternDigits(p1);
		const b = toWesternDigits(p2);
		const c = toWesternDigits(p3);
		if (!a || !b || !c) return null;

		// If first part is 4-digit year -> already yyyy/mm/dd style; keep order (just pad)
		if (a.length === 4) return formatYMD(a, b, c);
		// If last part is 4-digit year -> dd/mm/yyyy; reorder to yyyy/mm/dd
		if (c.length === 4) return formatYMD(c, b, a);

		// Heuristic: if first part looks like year (e.g., 202) or > 31)
		const aNum = Number(a);
		const cNum = Number(c);
		if ((a.length === 3 && aNum >= 190 && aNum <= 210) || aNum > 31) {
			return formatYMD(a, b, c);
		}
		if ((c.length === 3 && cNum >= 190 && cNum <= 210) || cNum > 31) {
			return formatYMD(c, b, a);
		}

		return null;
	};

	let text = original;

	// Replace separated dates like 10/1/2026 or 2026-1-10 or 2026.01.10
	const sepDateRegex = /([0-9٠-٩]{1,4})[\/\-\.\s]+([0-9٠-٩]{1,2})[\/\-\.\s]+([0-9٠-٩]{1,4})/g;
	text = text.replace(sepDateRegex, (match, p1, p2, p3) => {
		const formatted = formatFromTriplet(p1, p2, p3);
		return formatted ?? match;
	});

	// Replace month/year notes like 2/2026 with yyyy/mm.
	const monthYearRegex = /(^|[^0-9٠-٩/])([0-9٠-٩]{1,2})\/([0-9٠-٩]{4})(?![\/0-9٠-٩])/g;
	text = text.replace(monthYearRegex, (match, prefix, month, year) => {
		const formatted = formatYM(toWesternDigits(year), toWesternDigits(month));
		return `${prefix}${formatted ?? `${month}/${year}`}`;
	});

	// Replace standalone 8-digit tokens like 10012026 or 20260110 (Western/Eastern)
	const digits8Regex = /\b[0-9٠-٩]{8}\b/g;
	text = text.replace(digits8Regex, (match) => {
		const digits = toWesternDigits(match);
		const yFirst = formatYMD(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8));
		if (yFirst) return yFirst;
		const yLast = formatYMD(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2));
		return yLast ?? match;
	});

	// Replace standalone 6-digit tokens like 100126 (ddmmyy) or 260110 (yymmdd)
	const digits6Regex = /\b[0-9٠-٩]{6}\b/g;
	text = text.replace(digits6Regex, (match) => {
		const digits = toWesternDigits(match);
		const ddmmyy = formatYMD(`20${digits.slice(4, 6)}`, digits.slice(2, 4), digits.slice(0, 2));
		const yymmdd = formatYMD(`20${digits.slice(0, 2)}`, digits.slice(2, 4), digits.slice(4, 6));
		if (ddmmyy && !yymmdd) return ddmmyy;
		if (yymmdd && !ddmmyy) return yymmdd;
		return match;
	});

	return text;
}

// Pad current segment on slash: 2/ -> 02/ , also pads month when adding second slash
function handleSlashPadding(cell) {
	const tooltip = cell.querySelector('.date-error-tooltip');
	const caretBefore = getCaretOffset(cell);
	const text = extractEditableText(cell);
	let western = cleanDateTextWestern(text);
	let parts = western.split('/').filter((_, idx) => idx < 3);

	let day = parts[0] || '';
	let month = parts[1] || '';

	if (day.length === 1) day = padDatePart(day);

	let formatted = '';
	if (parts.length <= 1) {
		formatted = `${day}/`;
	} else {
		if (month.length === 1) month = padDatePart(month);
		formatted = `${day}/${month}/`;
	}

	const eastern = toEasternDigits(formatted);
	cell.textContent = eastern;
	if (tooltip) cell.appendChild(tooltip);
	if (caretBefore !== null) setCaretOffset(cell, eastern.length);

	const rowIdx = Number(cell.dataset.row);
	const key = cell.dataset.key;
	if (!Number.isNaN(rowIdx) && key && data[rowIdx]) {
		data[rowIdx][key] = eastern;
		updateRowSearchCache(data[rowIdx]);
		markCellDirty(data[rowIdx], key, eastern);
	}

	return eastern;
}

// Date cell keydown handler
tableBody.addEventListener('keydown', (e) => {
	const td = e.target.closest('td.date-cell');
	if (!td) return;
	
	const key = e.key;
	
	// Allow navigation keys
	if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Backspace', 'Delete'].includes(key)) {
		return;
	}
	if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(key.toLowerCase())) {
		return;
	}
	
	// Allow digits (Western and Eastern)
	if (/^[0-9٠-٩]$/.test(key)) {
		return;
	}

	// Handle slash: pad current segment and advance
	if (key === '/') {
		e.preventDefault();
		handleSlashPadding(td);
		return;
	}
	
	// Block letters and show error
	if (/^[a-zA-Zا-ي]$/.test(key)) {
		e.preventDefault();
		showDateError(td);
		return;
	}
	
	// Block other characters
	if (key.length === 1) {
		e.preventDefault();
	}
});

// Number-only columns keydown handler
tableBody.addEventListener('keydown', (e) => {
	const td = e.target.closest('td');
	if (!td || td.classList.contains('date-cell')) return;
	const keyName = td.dataset.key;
	if (!NUMBER_ONLY_COLUMNS.includes(keyName)) return;

	const key = e.key;

	// Allow navigation keys and shortcuts
	if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Backspace', 'Delete'].includes(key)) {
		return;
	}
	if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(key.toLowerCase())) {
		return;
	}

	// Allow digits (Western and Eastern)
	if (/^[0-9٠-٩]$/.test(key)) {
		return;
	}

	// Block any other character and show error
	e.preventDefault();
	showNumberError(td);
});

// Date cell input handler for formatting
tableBody.addEventListener('input', (e) => {
	const td = e.target.closest('td.date-cell');
	if (td) {
		const formatted = formatDateInput(td);
		// Update data
		const rowIdx = Number(td.dataset.row);
		const key = td.dataset.key;
		if (!Number.isNaN(rowIdx) && key && data[rowIdx]) {
			setRowCellValue(rowIdx, key, formatted);
			if (DATE_COLUMNS.includes(key)) {
				updateSeizeCell(rowIdx);
			}
		}
		return;
	}
});

// Date cell blur handler for final padding
tableBody.addEventListener('focusout', (e) => {
	const td = e.target.closest('td.date-cell');
	if (td) {
		const formatted = finalizeDateCell(td);
		const rowIdx = Number(td.dataset.row);
		const key = td.dataset.key;
		if (!Number.isNaN(rowIdx) && key && data[rowIdx]) {
			setRowCellValue(rowIdx, key, formatted);
			if (DATE_COLUMNS.includes(key)) {
				updateSeizeCell(rowIdx);
			}
		}
	}
});

tableBody.addEventListener('focusout', (e) => {
	const td = e.target.closest('td');
	if (!td || td.classList.contains('date-cell')) return;
	const key = td.dataset.key;
	if (key !== 'ملاحظات') return;
	const rowIdx = Number(td.dataset.row);
	const current = td.innerText;
	const normalized = normalizeNoteDateText(current);
	td.textContent = normalized;
	if (!Number.isNaN(rowIdx) && data[rowIdx]) {
		setRowCellValue(rowIdx, key, normalized);
	}
});

// عند التحرير، حدّث البيانات في الذاكرة (non-date cells)
tableBody.addEventListener('input', (e) => {
	const td = e.target.closest('td');
	if (!td || td.classList.contains('date-cell')) return;
	const rowIdx = Number(td.dataset.row);
	const key = td.dataset.key;
	if (Number.isNaN(rowIdx) || !key) return;
	if (NUMBER_ONLY_COLUMNS.includes(key)) {
		sanitizeNumberCell(td);
		return;
	}
	const text = td.innerText.trim();
	if (!data[rowIdx]) return;
	setRowCellValue(rowIdx, key, text);
	if (key === 'مالك الحرز') {
		updateSeizeCell(rowIdx);
	}
	const sanitized = cleanRows(data);
	const removedRows = sanitized.length !== data.length;
	if (removedRows) {
		markRemovedRows(data, sanitized);
		data = prepareSearchRows(sanitized);
		applyFilters({ preservePage: true });
	}
});

nextPage.addEventListener('click', () => {
	const totalPages = getTotalPages(filteredData);
	if (currentPage < totalPages) {
		currentPage += 1;
		renderRows(filteredData, currentPage);
		scrollTableToTop();
	}
});

saveBtn.addEventListener('click', async () => {
	try {
		const scrollTop = document.querySelector('.table-wrapper')?.scrollTop || 0;
		setStatus('... جارِ الحفظ');
		await saveRecords();
		// الحفاظ على حالة التصفية الحالية بدون إعادة تحميل الجدول بالكامل
		applyFilters({ preservePage: true });
		setStatus('تم الحفظ');
		// Restore scroll position
		setTimeout(() => {
			const wrapper = document.querySelector('.table-wrapper');
			if (wrapper) wrapper.scrollTop = scrollTop;
		}, 0);
	} catch (err) {
		console.error('Save failed', err);
		setStatus(getSaveErrorMessage(err));
	}
});

// تعبئة أولية عند التحميل.
bootstrap().then(() => setStatus('')).catch(() => setStatus('تعذر التحميل'));

function setStatus(msg) {
	if (statusMsg) {
		statusMsg.textContent = msg;
	}
}

// ========== Filter Logic ==========
const stationsContainer = document.getElementById('stationsContainer');
const clearFiltersBtn = document.getElementById('clearFilters');
const sectorStrip = document.querySelector('.sector-strip');
const fallbackSectorLabelMap = {
	east: 'شرق',
	north: 'شمال',
	south: 'جنوب',
	west: 'غرب',
	sectorfive: 'القطاع التجريبي الخامس'
};

function getSeizedSectorChoices() {
	if (SHARED_REFERENCE_DATA && typeof SHARED_REFERENCE_DATA.getSectorChoices === 'function') {
		const choices = SHARED_REFERENCE_DATA.getSectorChoices('key');
		if (Array.isArray(choices) && choices.length) {
			return choices
				.map((entry) => ({
					key: String(entry && (entry.key || entry.value) || '').trim(),
					label: String(entry && entry.label || '').trim()
				}))
				.filter((entry) => entry.key);
		}
	}
	return Object.keys(sectorStations).map((key) => ({
		key,
		label: fallbackSectorLabelMap[key] || key
	}));
}

function syncSectorButtonsState() {
	if (!sectorStrip) return;
	const activeSector = [...selectedSectors][0] || '';
	sectorStrip.querySelectorAll('.sector-btn').forEach((btn) => {
		const isActive = btn.dataset.sector === activeSector;
		btn.classList.toggle('active', isActive);
		btn.classList.toggle('is-active', isActive);
		btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
	});
}

function renderSectorButtons() {
	if (!sectorStrip) return;
	sectorStrip.innerHTML = '';
	getSeizedSectorChoices().forEach(({ key, label }) => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'sector-btn';
		btn.dataset.sector = key;
		btn.setAttribute('aria-pressed', 'false');
		btn.textContent = label;
		sectorStrip.appendChild(btn);
	});
	syncSectorButtonsState();
}

const sortableHeaderCells = [...headerCells].filter(
	(th) => !th.classList.contains('checkbox-col') && !th.classList.contains('row-index-col')
);

sortableHeaderCells.forEach((th, idx) => {
	const columnKey = columnOrder[idx];
	if (!columnKey) return;
	th.dataset.column = columnKey;
	th.classList.add('sortable');
	th.addEventListener('click', () => handleSort(columnKey));
});

updateSortIndicators();

// Update stations display based on selected sectors
function updateStationsDisplay() {
	const hasSector = selectedSectors.size > 0;
	const hasFilters = hasSector || selectedStations.size > 0;
	clearFiltersBtn.classList.toggle('visible', hasFilters);

	if (!hasSector) {
		selectedStations.clear();
		stationsContainer.innerHTML = '<span class="stations-placeholder">اختر قطاعًا لعرض الأقسام</span>';
		return;
	}

	const sector = [...selectedSectors][0];
	const stations = sectorStations[sector] || [];
	const uniqueStations = [...new Set(stations)];

	stationsContainer.innerHTML = uniqueStations.map(station => `
		<button type="button" class="station-btn ${selectedStations.has(station) ? 'active is-selected' : ''}" data-station="${station}" aria-pressed="${selectedStations.has(station) ? 'true' : 'false'}">${station}</button>
	`).join('');

	stationsContainer.querySelectorAll('.station-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const station = btn.dataset.station;
			if (selectedStations.has(station)) {
				selectedStations.delete(station);
				btn.classList.remove('active');
				btn.classList.remove('is-selected');
				btn.setAttribute('aria-pressed', 'false');
			} else {
				selectedStations.add(station);
				btn.classList.add('active');
				btn.classList.add('is-selected');
				btn.setAttribute('aria-pressed', 'true');
			}
			applyFilters();
		});
	});
}

function applyFilters({ preservePage = false } = {}) {
	if (selectedStations.size === 0 && selectedSectors.size === 0) {
		data = prepareSearchRows(data);
		filteredData = [...data];
	} else if (selectedStations.size === 0) {
		const sector = [...selectedSectors][0];
		const stations = sector ? (sectorStations[sector] || []).map((station) => normalizeStationName(station, sector)) : [];
		filteredData = data.filter(row => {
			const originRaw = row['القسم'] || '';
			const origin = normalizeStationName(originRaw, sector);
			const detectedSector = resolveSectorKeyFromStation(originRaw) || resolveSectorKeyFromStation(origin);
			if (sector && detectedSector && detectedSector !== sector) return false;
			return stations.includes(origin);
		});
	} else {
		const sector = [...selectedSectors][0] || '';
		const selectedStationSet = new Set([...selectedStations].map((station) => normalizeStationName(station, sector)));
		filteredData = data.filter(row => {
			const origin = normalizeStationName(row['القسم'] || '', sector);
			return selectedStationSet.has(origin);
		});
	}

	// Apply seize type filter
	if (selectedSeizeType !== 'all') {
		const targetSeize = normalizeSeizeType(selectedSeizeType);
		filteredData = filteredData.filter(row => normalizeSeizeType(row['نوع الحرز']) === targetSeize);

		if (targetSeize === 'ايداع' && selectedDepositPassFilter !== 'all') {
			filteredData = filteredData.filter((row) => {
				const passed = hasTwoMonthsPassedFromDeposit(row);
				if (selectedDepositPassFilter === 'passed') return passed;
				if (selectedDepositPassFilter === 'not-passed') return !passed;
				return true;
			});
		}
	}

	if (nameQuery) {
			const columnsToSearch = nameSearchColumn === '__all__'
				? columnOrder
				: (columnOrder.includes(nameSearchColumn) ? [nameSearchColumn] : columnOrder);

			filteredData = filteredData.filter((row) => {
				if (nameSearchColumn === '__all__') {
					const cachedText = row?.[SEARCH_TEXT_CACHE_KEY] || updateRowSearchCache(row)?.[SEARCH_TEXT_CACHE_KEY] || '';
					return String(cachedText).includes(nameQuery);
				}
				return columnsToSearch.some((key) => normalizeForSearch(row?.[key]).includes(nameQuery));
			});
	}

	if (recordQuery) {
		filteredData = filteredData.filter(row => normalizeForSearch(row['رقم الحرز']).includes(recordQuery));
	}

	filteredData = cleanRows(filteredData);
	updateFilterCounts();
	const targetPage = preservePage ? currentPage : 1;
	renderRows(filteredData, targetPage);
}

renderSectorButtons();

sectorStrip?.addEventListener('click', (event) => {
	const btn = event.target.closest('.sector-btn');
	if (!btn) return;
	const sector = btn.dataset.sector;
	if (selectedSectors.has(sector)) {
		selectedSectors.delete(sector);
	} else {
		selectedSectors.clear();
		selectedSectors.add(sector);
	}
	selectedStations.clear();
	syncSectorButtonsState();
	updateStationsDisplay();
	applyFilters();
});

clearFiltersBtn.addEventListener('click', () => {
	selectedSectors.clear();
	selectedStations.clear();
	syncSectorButtonsState();
	updateStationsDisplay();
	applyFilters();
});

window.addEventListener('reference-data:updated', () => {
	const availableKeys = new Set(getSeizedSectorChoices().map((entry) => entry.key));
	selectedSectors.forEach((key) => {
		if (!availableKeys.has(key)) {
			selectedSectors.delete(key);
		}
	});
	selectedStations.clear();
	renderSectorButtons();
	updateStationsDisplay();
	applyFilters({ preservePage: true });
});

// Seize type filter buttons
const seizeFilterBtns = document.querySelectorAll('.seize-filter-btn');
seizeFilterBtns.forEach(btn => {
	btn.addEventListener('click', () => {
		const seizeType = btn.dataset.seize;
		selectedSeizeType = seizeType;
		seizeFilterBtns.forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		updateDepositStatusFilterVisibility();
		applyFilters();
	});
});

if (depositStatusBtns && depositStatusBtns.length > 0) {
	depositStatusBtns.forEach((btn) => {
		btn.addEventListener('click', () => {
			const mode = btn.dataset.depositPass;
			if (!mode) return;
			selectedDepositPassFilter = selectedDepositPassFilter === mode ? 'all' : mode;
			updateDepositStatusFilterVisibility();
			applyFilters();
		});
	});
}

updateDepositStatusFilterVisibility();

const SEARCH_INPUT_DEBOUNCE_MS = 200;
let searchInputDebounceTimer = null;
let searchInputComposing = false;
function scheduleTableSearchFilter() {
	if (searchInputComposing) return;
	if (searchInputDebounceTimer) clearTimeout(searchInputDebounceTimer);
	searchInputDebounceTimer = setTimeout(() => {
		searchInputDebounceTimer = null;
		applyFilters();
	}, SEARCH_INPUT_DEBOUNCE_MS);
}
function applyTableSearchNow() {
	if (searchInputDebounceTimer) {
		clearTimeout(searchInputDebounceTimer);
		searchInputDebounceTimer = null;
	}
	applyFilters();
}

function readDeleteApprovalInspectTarget() {
	try {
		const raw = sessionStorage.getItem(DELETE_APPROVAL_INSPECT_STORAGE_KEY);
		if (!raw) return null;
		const target = JSON.parse(raw);
		return target && target.programKey === 'seized' ? target : null;
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
	const name = String(target.name || '').trim();
	const recordNumber = String(target.recordNumber || '').trim();
	const fallbackSearch = name || String(target.license || '').trim();
	if (nameSearchInput) nameSearchInput.value = fallbackSearch;
	if (nameSearchColumnSelect) {
		nameSearchColumn = '__all__';
		nameSearchColumnSelect.value = '__all__';
		nameSearchInput.placeholder = 'ابحث في كل الأعمدة';
	}
	if (recordSearchInput) recordSearchInput.value = recordNumber;
	nameQuery = normalizeForSearch(fallbackSearch);
	recordQuery = normalizeForSearch(recordNumber);
	applyFilters();
	clearDeleteApprovalInspectTarget();
	return true;
}
try { window.applyDeleteApprovalInspectTarget = applyDeleteApprovalInspectTarget; } catch (_) {}

if (nameSearchInput) {
	nameSearchInput.addEventListener('compositionstart', () => {
		searchInputComposing = true;
	});
	nameSearchInput.addEventListener('compositionend', (e) => {
		searchInputComposing = false;
		nameQuery = normalizeForSearch(e.target.value);
		scheduleTableSearchFilter();
	});
	nameSearchInput.addEventListener('input', (e) => {
		nameQuery = normalizeForSearch(e.target.value);
		scheduleTableSearchFilter();
	});
	nameSearchInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			applyTableSearchNow();
		}
	});
}

if (nameSearchColumnSelect) {
	const optionsHtml = [
		`<option value="__all__">كل الأعمدة</option>`,
		...columnOrder.map((col) => `<option value="${col}">${col}</option>`)
	].join('');
	nameSearchColumnSelect.innerHTML = optionsHtml;
	nameSearchColumnSelect.value = nameSearchColumn;

	nameSearchColumnSelect.addEventListener('change', (e) => {
		nameSearchColumn = e.target.value || '__all__';
		if (nameSearchInput) {
			nameSearchInput.placeholder = nameSearchColumn === '__all__'
				? 'ابحث في كل الأعمدة'
				: `ابحث في ${nameSearchColumn}`;
		}
		applyFilters();
	});
}

if (recordSearchInput) {
	recordSearchInput.addEventListener('compositionstart', () => {
		searchInputComposing = true;
	});
	recordSearchInput.addEventListener('compositionend', (e) => {
		searchInputComposing = false;
		recordQuery = normalizeForSearch(e.target.value);
		scheduleTableSearchFilter();
	});
	recordSearchInput.addEventListener('input', (e) => {
		recordQuery = normalizeForSearch(e.target.value);
		scheduleTableSearchFilter();
	});
	recordSearchInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			applyTableSearchNow();
		}
	});
}

// Seize Type Popup Logic
function showSeizeTypePopup(rowIndex) {
	const overlay = document.createElement('div');
	overlay.className = 'seize-popup-overlay';
	overlay.innerHTML = `
		<div class="seize-popup">
			<h3>اختر نوع الحرز</h3>
			<div class="seize-popup-options">
				<button type="button" class="seize-popup-btn popup-confiscate" data-value="مصادرة">مصادرة</button>
				<button type="button" class="seize-popup-btn popup-admin" data-value="حجز إدارى">حجز إدارى</button>
				<button type="button" class="seize-popup-btn popup-exempt" data-value="اعفاء">اعفاء</button>
				<button type="button" class="seize-popup-btn popup-fees" data-value="سداد رسوم">سداد رسوم</button>
				<button type="button" class="seize-popup-btn popup-deposit" data-value="ايداع">ايداع</button>
				<button type="button" class="seize-popup-btn popup-waiver" data-value="تنازل">تنازل</button>
			</div>
		</div>
	`;

	document.body.appendChild(overlay);

	// Close on overlay click
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) {
			overlay.remove();
		}
	});

	// Handle option selection
	overlay.querySelectorAll('.seize-popup-btn').forEach(btn => {
		btn.addEventListener('click', async () => {
			let newValue = btn.dataset.value;
			if (data[rowIndex]) {
				setRowCellValue(rowIndex, 'نوع الحرز', newValue);
				// Save to CSV
				try {
					setStatus('... جارِ الحفظ');
					await saveRecords();
					setStatus('تم الحفظ');
				} catch (err) {
					console.error('Save failed', err);
					setStatus(getSaveErrorMessage(err));
				}
				applyFilters({ preservePage: true });
			}
			overlay.remove();
		});
	});
}

// Category popup for الفئة
function showCategoryPopup(rowIndex) {
	const overlay = document.createElement('div');
	overlay.className = 'category-popup-overlay';
	overlay.innerHTML = `
		<div class="category-popup">
			<h3>اختر الفئة</h3>
			<div class="category-popup-options">
				<button type="button" class="category-popup-btn" data-value="(أ)">(أ)</button>
				<button type="button" class="category-popup-btn" data-value="(ب)">(ب)</button>
			</div>
		</div>
	`;

	document.body.appendChild(overlay);

	const close = () => overlay.remove();

	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close();
	});

	overlay.querySelectorAll('.category-popup-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			const val = btn.dataset.value;
			if (data[rowIndex]) {
				setRowCellValue(rowIndex, 'الفئة', val);
				renderRows(filteredData, currentPage);
			}
			close();
		});
	});
}

function showLicenseTypePopup(rowIndex) {
	const currentValue = data[rowIndex]?.['نوع الرخصة'] || '';
	const normalizedCurrent = normalizeLicenseTypeName(currentValue);
	const optionsHtml = getSeizedLicenseTypeOptions(currentValue).map((option) => {
		const isSelected = option === normalizedCurrent ? ' selected' : '';
		return `<option value="${escapeHtml(option)}"${isSelected}>${escapeHtml(option)}</option>`;
	}).join('');

	const overlay = document.createElement('div');
	overlay.className = 'reference-popup-overlay';
	overlay.innerHTML = `
		<div class="reference-popup">
			<h3>اختر نوع الرخصة</h3>
			<select class="reference-popup-select" data-license-type-select>
				<option value="">اختر نوع الرخصة</option>
				${optionsHtml}
			</select>
			<div class="reference-popup-actions">
				<button type="button" class="reference-save-btn">حفظ</button>
				<button type="button" class="reference-cancel-btn">إلغاء</button>
			</div>
		</div>
	`;

	document.body.appendChild(overlay);

	const close = () => overlay.remove();
	const select = overlay.querySelector('[data-license-type-select]');

	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close();
	});
	overlay.querySelector('.reference-cancel-btn').addEventListener('click', close);
	overlay.querySelector('.reference-save-btn').addEventListener('click', () => {
		if (data[rowIndex]) {
			setRowCellValue(rowIndex, 'نوع الرخصة', normalizeLicenseTypeName(select.value));
			applyFilters({ preservePage: true });
		}
		close();
	});
}

function showStationPopup(rowIndex) {
	const currentStation = data[rowIndex]?.['القسم'] || '';
	const detectedSector = resolveSectorKeyFromStation(currentStation);
	const overlay = document.createElement('div');
	overlay.className = 'reference-popup-overlay';
	overlay.innerHTML = `
		<div class="reference-popup">
			<h3>اختر القطاع والقسم</h3>
			<div class="reference-popup-grid">
				<label>
					<span>القطاع</span>
					<select class="reference-popup-select" data-station-sector-select>
						${getSectorOptionsHtml(detectedSector)}
					</select>
				</label>
				<label>
					<span>القسم</span>
					<select class="reference-popup-select" data-station-select>
						${getStationOptionsHtml(detectedSector, currentStation)}
					</select>
				</label>
			</div>
			<div class="reference-popup-actions">
				<button type="button" class="reference-save-btn">حفظ</button>
				<button type="button" class="reference-cancel-btn">إلغاء</button>
			</div>
		</div>
	`;

	document.body.appendChild(overlay);

	const close = () => overlay.remove();
	const sectorSelect = overlay.querySelector('[data-station-sector-select]');
	const stationSelect = overlay.querySelector('[data-station-select]');
	const saveBtn = overlay.querySelector('.reference-save-btn');
	const syncSaveState = () => {
		saveBtn.disabled = !stationSelect.value;
	};

	bindStationFieldControls(overlay);
	syncSaveState();

	sectorSelect.addEventListener('change', syncSaveState);
	stationSelect.addEventListener('change', syncSaveState);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close();
	});
	overlay.querySelector('.reference-cancel-btn').addEventListener('click', close);
	saveBtn.addEventListener('click', () => {
		if (!stationSelect.value) return;
		if (data[rowIndex]) {
			setRowCellValue(rowIndex, 'القسم', normalizeStationName(stationSelect.value, sectorSelect.value));
			applyFilters({ preservePage: true });
		}
		close();
	});
}

// Listen for clicks on seize type badges
tableBody.addEventListener('click', (e) => {
	const badge = e.target.closest('.badge[data-row]');
	if (!badge) return;
	const rowIndex = Number(badge.dataset.row);
	if (!Number.isNaN(rowIndex)) {
		showSeizeTypePopup(rowIndex);
	}
});

// Listen for clicks on category cells
tableBody.addEventListener('click', (e) => {
	const cell = e.target.closest('td.category-cell');
	if (!cell) return;
	const rowIndex = Number(cell.dataset.row);
	if (!Number.isNaN(rowIndex)) {
		showCategoryPopup(rowIndex);
	}
});

// Listen for clicks on reference dropdown-backed cells
tableBody.addEventListener('click', (e) => {
	const licenseCell = e.target.closest('td.license-type-cell');
	if (licenseCell) {
		const rowIndex = Number(licenseCell.dataset.row);
		if (!Number.isNaN(rowIndex)) showLicenseTypePopup(rowIndex);
		return;
	}

	const stationCell = e.target.closest('td.station-cell');
	if (stationCell) {
		const rowIndex = Number(stationCell.dataset.row);
		if (!Number.isNaN(rowIndex)) showStationPopup(rowIndex);
	}
});

// Checkbox handling
tableBody.addEventListener('change', (e) => {
	if (e.target.classList.contains('row-checkbox')) {
		const rowIndex = Number(e.target.dataset.row);
		if (e.target.checked) {
			selectedRows.add(rowIndex);
		} else {
			selectedRows.delete(rowIndex);
		}
		updateDeleteButtonState();
		updateSelectAllCheckbox();
	}
});

if (selectAllCheckbox) {
	selectAllCheckbox.addEventListener('change', (e) => {
		const checkboxes = tableBody.querySelectorAll('.row-checkbox');
		checkboxes.forEach(cb => {
			const rowIndex = Number(cb.dataset.row);
			cb.checked = e.target.checked;
			if (e.target.checked) {
				selectedRows.add(rowIndex);
			} else {
				selectedRows.delete(rowIndex);
			}
		});
		updateDeleteButtonState();
	});
}

function updateSelectAllCheckbox() {
	if (!selectAllCheckbox) return;
	const checkboxes = tableBody.querySelectorAll('.row-checkbox');
	const checkedCount = tableBody.querySelectorAll('.row-checkbox:checked').length;
	selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
	selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function updateDeleteButtonState() {
	if (deleteSelectedBtn) {
		deleteSelectedBtn.disabled = selectedRows.size === 0;
	}
}

function updateFilterCounts() {
	const allCount = data.length;
	const adminCount = data.filter(r => normalizeSeizeType(r['نوع الحرز']) === 'حجز إدارى').length;
	const confiscateCount = data.filter(r => normalizeSeizeType(r['نوع الحرز']) === 'مصادرة').length;
	const exemptCount = data.filter(r => normalizeSeizeType(r['نوع الحرز']) === 'اعفاء').length;
	const feesCount = data.filter(r => normalizeSeizeType(r['نوع الحرز']) === 'سداد رسوم').length;
	const depositCount = data.filter(r => normalizeSeizeType(r['نوع الحرز']) === 'ايداع').length;
	const waiverCount = data.filter(r => normalizeSeizeType(r['نوع الحرز']) === 'تنازل').length;

	document.querySelectorAll('.seize-filter-btn').forEach(btn => {
		const seize = btn.dataset.seize;
		let count = 0;
		if (seize === 'all') count = allCount;
				else if (seize === 'حجز إدارى') count = adminCount;
		else if (seize === 'مصادرة') count = confiscateCount;
		else if (seize === 'اعفاء') count = exemptCount;
		else if (seize === 'سداد رسوم') count = feesCount;
		else if (seize === 'ايداع') count = depositCount;
		else if (seize === 'تنازل') count = waiverCount;

		let countSpan = btn.querySelector('.filter-count');
		if (!countSpan) {
			countSpan = document.createElement('span');
			countSpan.className = 'filter-count';
			btn.appendChild(countSpan);
		}
		countSpan.textContent = count;
	});
}

function showDeleteConfirm(count) {
	return new Promise((resolve) => {
		const overlay = document.createElement('div');
		overlay.className = 'confirm-overlay';
		overlay.innerHTML = `
			<div class="confirm-modal">
				<h3>تأكيد الحذف</h3>
				<p>سيتم حذف ${count} سجل${count > 1 ? 'ات' : ''}. هل أنت متأكد؟</p>
				<div class="confirm-actions">
					<button type="button" class="confirm-delete-btn">مسح</button>
					<button type="button" class="confirm-cancel-btn">رجوع</button>
				</div>
			</div>
		`;

		document.body.appendChild(overlay);

		const cleanup = () => overlay.remove();
		overlay.querySelector('.confirm-delete-btn').addEventListener('click', () => {
			cleanup();
			resolve(true);
		});
		overlay.querySelector('.confirm-cancel-btn').addEventListener('click', () => {
			cleanup();
			resolve(false);
		});
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) {
				cleanup();
				resolve(false);
			}
		});
	});
}

// Delete selected records
if (deleteSelectedBtn) {
	deleteSelectedBtn.addEventListener('click', async () => {
		if (selectedRows.size === 0) return;

		const indices = [...selectedRows];
		const toDelete = indices.map(idx => data[idx]).filter(Boolean);
		if (toDelete.length === 0) return;

		const confirmed = await showDeleteConfirm(toDelete.length);
		if (!confirmed) return;

		try {
			setStatus('... جارِ الحذف');
			const response = await fetch(buildApiUrl('/records/delete-request'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ records: toDelete })
			});
			const result = await response.json().catch(() => ({}));
			if (result && result.approvalRequired) {
				if (window.DeleteApprovalUserNotice) {
					window.DeleteApprovalUserNotice.track(result.request, { message: result.message });
				}
				setStatus(result.message || 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.');
				return;
			}
			if (!response.ok || (result && result.ok === false)) {
				throw new Error(result?.message || 'تعذر حذف السجلات المحددة.');
			}

			applySavedRecords(Array.isArray(result.records) ? result.records : data.filter((_, idx) => !selectedRows.has(idx)), result.version || loadedRecordsVersion);
			applyFilters({ preservePage: true });
			setStatus('تم الحذف');
		} catch (err) {
			console.error('Delete failed', err);
			setStatus(getSaveErrorMessage(err));
		}
	});
}

// Add record modal
const seizeTypeOptions = ['حجز إدارى', 'مصادرة', 'اعفاء', 'سداد رسوم', 'ايداع', 'تنازل'];

function showAddRecordModal() {
	const overlay = document.createElement('div');
	overlay.className = 'add-record-overlay';
	const activeSector = [...selectedSectors][0] || '';
	const activeStation = [...selectedStations][0] || '';

	const formFields = columnOrder.map(key => {
		if (key === 'نوع الحرز') {
			return `
				<div class="form-field">
					<label>${key}</label>
					<select name="${key}">
						<option value="">اختر...</option>
						${seizeTypeOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
					</select>
				</div>
			`;
		} else if (key === 'الفئة') {
			return `
				<div class="form-field">
					<label>${key}</label>
					<select name="${key}">
						<option value="">اختر...</option>
						<option value="(أ)">(أ)</option>
						<option value="(ب)">(ب)</option>
					</select>
				</div>
			`;
		} else if (key === 'نوع الرخصة') {
			return `
				<div class="form-field">
					<label>${key}</label>
					<select name="${key}">
						<option value="">اختر نوع الرخصة</option>
						${getSeizedLicenseTypeOptions().map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
					</select>
				</div>
			`;
		} else if (key === 'القسم') {
			return `
				<div class="form-field station-form-field">
					<label>${key}</label>
					<div class="form-inline-selects">
						<select name="__stationSector" data-station-sector-select>
							${getSectorOptionsHtml(activeSector)}
						</select>
						<select name="${key}" data-station-select ${activeSector ? '' : 'disabled'}>
							${getStationOptionsHtml(activeSector, activeStation)}
						</select>
					</div>
				</div>
			`;
		} else if (DATE_COLUMNS.includes(key)) {
			return `
				<div class="form-field">
					<label>${key}</label>
					<input type="text" name="${key}" placeholder="يوم/شهر/سنة" class="date-input" dir="ltr">
				</div>
			`;
		} else {
			return `
				<div class="form-field">
					<label>${key}</label>
					<input type="text" name="${key}" placeholder="${key}">
				</div>
			`;
		}
	}).join('');

	overlay.innerHTML = `
		<div class="add-record-modal">
			<h2>إضافة سجل جديد</h2>
			<form class="add-record-form">
				${formFields}
				<div class="form-actions">
					<button type="submit" class="save-btn">حفظ</button>
					<button type="button" class="cancel-btn">إلغاء</button>
				</div>
			</form>
		</div>
	`;

	document.body.appendChild(overlay);
	bindStationFieldControls(overlay);

	// Setup date input handlers for modal
	overlay.querySelectorAll('.date-input').forEach(input => {
		input.addEventListener('keydown', (e) => {
			const key = e.key;
			// Allow navigation and control keys
			if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab', 'Backspace', 'Delete'].includes(key)) {
				return;
			}
			if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(key.toLowerCase())) {
				return;
			}
			// Allow digits
			if (/^[0-9٠-٩]$/.test(key)) {
				return;
			}
			// Allow slash
			if (key === '/') {
				return;
			}
			// Block letters - show visual feedback
			if (/^[a-zA-Zا-ي]$/.test(key)) {
				e.preventDefault();
				input.classList.add('date-error');
				setTimeout(() => input.classList.remove('date-error'), 1000);
				return;
			}
			// Block other characters
			if (key.length === 1) {
				e.preventDefault();
			}
		});

		input.addEventListener('input', (e) => {
			const caretBefore = input.selectionStart;
			const completed = !!parseCompleteDateToYmd(input.value);
			input.value = normalizeDateTextForDisplay(input.value);
			try {
				const pos = completed ? input.value.length : Math.min(caretBefore ?? input.value.length, input.value.length);
				input.setSelectionRange(pos, pos);
			} catch (_) {}
		});

		input.addEventListener('blur', () => {
			input.value = normalizeDateTextForDisplay(input.value, { finalize: true });
		});
	});

	overlay.querySelector('.cancel-btn').addEventListener('click', () => overlay.remove());
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) overlay.remove();
	});

	overlay.querySelector('form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const formData = new FormData(e.target);
		const newRecord = {};
		columnOrder.forEach(key => {
			newRecord[key] = formData.get(key) || '';
		});
		DATE_COLUMNS.forEach((key) => {
			newRecord[key] = normalizeDateTextForDisplay(newRecord[key], { finalize: true });
		});
		newRecord['نوع الرخصة'] = normalizeLicenseTypeName(newRecord['نوع الرخصة']);
		newRecord['القسم'] = normalizeStationName(newRecord['القسم'], formData.get('__stationSector') || '');

		if (newRecord['ملاحظات']) {
			newRecord['ملاحظات'] = normalizeNoteDateText(newRecord['ملاحظات']);
		}

			if (!newRecord['نوع الحرز']) {
				newRecord['نوع الحرز'] = 'حجز إدارى';
			}

		updateRowSearchCache(newRecord);
		markRowInserted(newRecord);
		data.unshift(newRecord);

		try {
			setStatus('... جارِ الحفظ');
			await saveRecords();
			applyFilters();
			setStatus('تم الإضافة');
			overlay.remove();
		} catch (err) {
			console.error('Add failed', err);
			setStatus(getSaveErrorMessage(err));
		}
	});
}

if (addRecordBtn) {
	addRecordBtn.addEventListener('click', showAddRecordModal);
}

// Undo panel
async function showUndoPanel() {
	const overlay = document.createElement('div');
	overlay.className = 'undo-panel-overlay';

	let undoRecords = [];
	try {
		const res = await fetch(buildApiUrl('/undo'));
		const json = await res.json();
		undoRecords = json.records || [];
	} catch (err) {
		console.error('Failed to load undo records', err);
	}

	let content = '';
	if (undoRecords.length === 0) {
		content = '<p class="no-undo-message">لا توجد سجلات محذوفة</p>';
	} else {
		const headers = columnOrder.map(k => `<th>${k}</th>`).join('');
		const rows = undoRecords.map((rec, idx) => {
			const cells = columnOrder.map(k => `<td>${rec[k] || ''}</td>`).join('');
			return `<tr><td><input type="checkbox" class="undo-checkbox" data-index="${idx}"></td>${cells}</tr>`;
		}).join('');

		content = `
			<div class="undo-table-wrapper">
				<table class="undo-table">
					<thead><tr><th><input type="checkbox" id="undoSelectAll"></th>${headers}</tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`;
	}

	overlay.innerHTML = `
		<div class="undo-panel">
			<h2>السجلات المحذوفة (استرجاع)</h2>
			${content}
			<div class="undo-actions">
				<button type="button" class="restore-selected-btn" ${undoRecords.length === 0 ? 'disabled' : ''}>استرجاع المحدد</button>
				<button type="button" class="close-undo-btn">إغلاق</button>
			</div>
		</div>
	`;

	document.body.appendChild(overlay);

	overlay.querySelector('.close-undo-btn').addEventListener('click', () => overlay.remove());
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) overlay.remove();
	});

	const undoSelectAll = overlay.querySelector('#undoSelectAll');
	if (undoSelectAll) {
		undoSelectAll.addEventListener('change', (e) => {
			overlay.querySelectorAll('.undo-checkbox').forEach(cb => cb.checked = e.target.checked);
		});
	}

	overlay.querySelector('.restore-selected-btn').addEventListener('click', async () => {
		const selectedIndices = [...overlay.querySelectorAll('.undo-checkbox:checked')].map(cb => Number(cb.dataset.index));
		if (selectedIndices.length === 0) return;

		try {
			setStatus('... جارِ الاسترجاع');
			const res = await fetch(buildApiUrl('/undo/restore'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ indices: selectedIndices })
			});
			const json = await res.json();
			const restored = json.restored || [];

			// Add restored records back to data
			restored.forEach(rec => {
				delete rec.deletedAt;
				updateRowSearchCache(rec);
				markRowInserted(rec);
				data.unshift(rec);
			});

			await saveRecords();
			applyFilters();
			setStatus('تم الاسترجاع');
			overlay.remove();
		} catch (err) {
			console.error('Restore failed', err);
			setStatus(getSaveErrorMessage(err));
		}
	});
}

if (undoBtn) {
	undoBtn.addEventListener('click', showUndoPanel);
}

// ========== Browser Print ==========
const browserPrintBtn = document.getElementById('browserPrintBtn');

const PRINT_SERIAL_WIDTH = '4%';
const PRINT_COLUMNS = [
	{ key: 'الفئة', label: 'الفئة', width: '3%' },
	{ key: 'رقم الحرز', label: 'رقم الحرز', width: '5%' },
	{ key: 'رقم الرخصة', label: 'رقم الرخصة', width: '5%' },
	{ key: 'نوع الرخصة', label: 'نوع الرخصة', width: '5%' },
	{ key: 'القسم', label: 'القسم', width: '5%' },
	{ key: 'الاسم', label: 'الاسم', width: '8%' },
	{ key: 'النوع', label: 'النوع', width: '5%' },
	{ key: 'الماركة', label: 'الماركة', width: '5%' },
	{ key: 'العيار', label: 'العيار', width: '4%' },
	{ key: 'الرقم', label: 'الرقم', width: '5%' },
	{ key: 'سبب الالغاء', label: 'سبب الالغاء', width: '6%' },
	{ key: 'تاريخ الايداع', label: 'تاريخ الايداع', width: '9%' },
	{ key: 'تاريخ الانتهاء', label: 'تاريخ الانتهاء', width: '9%' },
	{ key: 'مالك الحرز', label: 'مالك الحرز', width: '5%' },
	{ key: 'نوع الحرز', label: 'نوع الحرز', width: '6%' },
	{ key: 'ملاحظات', label: 'ملاحظات', width: '11%' }
];

function toArabicDigitsPrint(value) {
	return String(value == null ? '' : value).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}

function escapePrintHtml(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function buildPrintSubtitle() {
	const parts = [];
	if (selectedSeizeType && selectedSeizeType !== 'all') {
		parts.push('نوع الحرز: ' + selectedSeizeType);
	}
	if (nameQuery) parts.push('بحث: ' + nameQuery);
	if (recordQuery) parts.push('رقم الحرز: ' + recordQuery);
	const today = new Date();
	const pad = (n) => (n < 10 ? '0' : '') + n;
	parts.push('التاريخ: ' + toArabicDigitsPrint(today.getFullYear() + '/' + pad(today.getMonth() + 1) + '/' + pad(today.getDate())));
	return parts.join(' • ');
}

function buildPrintTitle() {
	const sector = [...selectedSectors][0] || '';
	if (!sector) return 'جدول الأحراز';
	const choice = getSeizedSectorChoices().find((c) => c.key === sector);
	const sectorLabel = (choice && choice.label) ? choice.label : sector;
	const stationsArr = [...selectedStations];
	if (stationsArr.length === 1) {
		return sectorLabel + ' - ' + stationsArr[0];
	}
	return sectorLabel;
}

function buildPrintSummaryTable(sortedRows, sectorKey) {
	const seizeTypes = ['حجز إدارى', 'مصادرة', 'اعفاء', 'سداد رسوم', 'ايداع', 'تنازل'];
	const sectorActive = !!sectorKey;
	const emptyCounts = () => Object.fromEntries(seizeTypes.map((t) => [t, 0]));

	const totals = emptyCounts();
	let totalCount = 0;
	const perStation = new Map();
	const stationOrder = [];

	sortedRows.forEach((row) => {
		const t = normalizeSeizeType(row && row['نوع الحرز']);
		totalCount += 1;
		if (totals[t] !== undefined) totals[t] += 1;
		if (sectorActive) {
			const station = normalizeStationName(row && row['القسم'] || '', sectorKey) || '—';
			if (!perStation.has(station)) {
				perStation.set(station, { total: 0, counts: emptyCounts() });
				stationOrder.push(station);
			}
			const bucket = perStation.get(station);
			bucket.total += 1;
			if (bucket.counts[t] !== undefined) bucket.counts[t] += 1;
		}
	});

	const headerCells = ['<th>القسم</th>', '<th>إجمالي الأحراز</th>']
		.concat(seizeTypes.map((t) => `<th>${escapePrintHtml(t)}</th>`))
		.join('');

	const buildRow = (label, total, counts, cls = '') => {
		const cells = [`<td class="sum-sta">${escapePrintHtml(label)}</td>`,
			`<td><strong>${toArabicDigitsPrint(total)}</strong></td>`]
			.concat(seizeTypes.map((t) => `<td>${toArabicDigitsPrint(counts[t] || 0)}</td>`))
			.join('');
		return `<tr${cls ? ` class="${cls}"` : ''}>${cells}</tr>`;
	};

	let rowsHtml = '';
	if (sectorActive && stationOrder.length) {
		stationOrder.sort((a, b) => a.localeCompare(b, 'ar', { numeric: true, sensitivity: 'base' }));
		rowsHtml = stationOrder
			.map((station, i) => {
				const bucket = perStation.get(station);
				return buildRow(station, bucket.total, bucket.counts, i % 2 === 1 ? 'ev' : '');
			})
			.join('');
	}
	rowsHtml += buildRow('الإجمالي العام', totalCount, totals, 'sum-total');

	const colCount = 2 + seizeTypes.length;
	return `<table class="stbl">
<thead>
<tr><td class="sum-title" colspan="${colCount}">ملخص حسب القسم</td></tr>
<tr>${headerCells}</tr>
</thead>
<tbody>${rowsHtml}</tbody>
</table>`;
}

function printFilteredBrowser() {
	let sortedRows = getSortedRows(cleanRows(filteredData));
	if (sortedRows.length === 0) {
		setStatus('لا يوجد بيانات للطباعة');
		return;
	}

	const sectorActive = selectedSectors.size > 0;
	const sectorKey = sectorActive ? ([...selectedSectors][0] || '') : '';

	const headerCellsHtml = '<th class="ser">م</th>' + PRINT_COLUMNS.map((c) => `<th data-col-key="${escapePrintHtml(c.key)}">${escapePrintHtml(c.label)}</th>`).join('');
	const colgroupHtml = '<colgroup>'
		+ `<col style="width:${PRINT_SERIAL_WIDTH}">`
		+ PRINT_COLUMNS.map((c) => `<col data-col-key="${escapePrintHtml(c.key)}" style="width:${c.width}">`).join('')
		+ '</colgroup>';

	let prevStation = null;
	let stationCounter = 0;
	let globalIdx = 0;
	const bodyHtml = sortedRows.map((row) => {
		const currentStation = sectorActive ? normalizeStationName(row?.['القسم'] || '', sectorKey) : '';
		let breakClass = '';
		if (sectorActive) {
			if (prevStation !== null && currentStation !== prevStation) {
				breakClass = 'station-break';
				stationCounter = 0;
			}
			prevStation = currentStation;
			stationCounter += 1;
		}
		const rowNumber = sectorActive ? stationCounter : (globalIdx + 1);
		globalIdx += 1;
		const cells = PRINT_COLUMNS.map((c) => `<td data-col-key="${escapePrintHtml(c.key)}">${escapePrintHtml(toArabicDigitsPrint(row[c.key]))}</td>`).join('');
		const evClass = (globalIdx % 2 === 0) ? 'ev' : '';
		const classes = [evClass, breakClass].filter(Boolean).join(' ');
		const classAttr = classes ? ` class="${classes}"` : '';
		return `<tr${classAttr}><td class="ser">${toArabicDigitsPrint(rowNumber)}</td>${cells}</tr>`;
	}).join('');

	const colChoicesJson = JSON.stringify(PRINT_COLUMNS.map((c) => ({ key: c.key, label: c.label })));

	const titleText = buildPrintTitle();
	const subtitle = buildPrintSubtitle();
	const totalCount = toArabicDigitsPrint(sortedRows.length);
	const summaryTableHtml = buildPrintSummaryTable(sortedRows, sectorKey);

	const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapePrintHtml(titleText)}</title>
<style>
@page { size: A3 landscape; margin: 8mm 8mm 14mm 8mm; @bottom-center { content: "صفحة " counter(page, arabic-indic) " من " counter(pages, arabic-indic); font-family: Arial, Tahoma, sans-serif; font-size: 10pt; color: #333; direction: rtl; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Tahoma, sans-serif; font-size: 13pt; direction: rtl; color: #000; }
h1 { text-align: center; font-size: 20pt; margin-bottom: 2mm; font-weight: bold; }
.sub { text-align: center; font-size: 11pt; margin-bottom: 3mm; color: #444; }
.count { text-align: center; font-size: 11pt; margin-bottom: 3mm; color: #1a1a2e; font-weight: bold; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
thead th { background: #1a1a2e; color: #fff; padding: 1.5mm 1mm; font-size: 13pt; font-weight: bold; text-align: center; border: 1px solid #000; }
tbody td { padding: 1mm 1mm; border: 1px solid #ccc; text-align: center; vertical-align: middle; word-break: break-word; line-height: 1.3; font-size: 13pt; }
td.ser { font-weight: bold; }
tr.ev td { background: #f0f4f8; }
tr.station-break td { border-top: 3px solid #000; }
tr { page-break-inside: avoid; }
.stbl { width: 100%; margin-top: 6mm; table-layout: fixed; }
.stbl thead th { background: #1a1a2e; color: #fff; font-size: 11pt; padding: 2mm 4mm; text-align: center; border: 1px solid #000; }
.stbl td.sum-title { background: #1a1a2e; color: #fff; font-size: 13pt; font-weight: bold; text-align: center; padding: 2mm; border: 1px solid #000; }
.stbl tbody td { font-size: 11pt; padding: 1.5mm 4mm; text-align: center; vertical-align: middle; border: 1px solid #ccc; }
.stbl tbody td.sum-sta { text-align: right; font-weight: bold; }
.stbl tr.ev td { background: #f0f4f8; }
.stbl tr.sum-total td { background: #f3f4f6; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; }
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
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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
<h1>${escapePrintHtml(titleText)}</h1>
${subtitle ? `<div class="sub">${escapePrintHtml(subtitle)}</div>` : ''}
<div class="count">إجمالي الأحراز: ${totalCount}</div>
<table>
${colgroupHtml}
<thead><tr>${headerCellsHtml}</tr></thead>
<tbody>${bodyHtml}</tbody>
</table>
${summaryTableHtml}
<script>
(function(){
	var STORAGE_KEY = 'seizedPrintHiddenCols';
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

	const win = window.open('', '_blank');
	if (!win) {
		setStatus('تعذر فتح نافذة الطباعة');
		return;
	}
	win.document.open();
	win.document.write(html);
	win.document.close();
	win.focus();
	setStatus('تم فتح نافذة الطباعة');
}

if (browserPrintBtn) {
	browserPrintBtn.addEventListener('click', printFilteredBrowser);
}

// Ctrl+P: trigger browser print
document.addEventListener('keydown', (event) => {
	const isCtrlP = (event.ctrlKey || event.metaKey) && (event.key === 'p' || event.key === 'P');
	if (!isCtrlP) return;
	event.preventDefault();
	event.stopPropagation();
	printFilteredBrowser();
}, { capture: true });

// Exit: ask backend to shutdown and close browser
if (exitBtn) {
	exitBtn.addEventListener('click', async () => {
		setStatus(IS_PLATFORM_MODE ? '... جارِ الرجوع' : '... جارِ الإغلاق');
		try {
			if (IS_PLATFORM_MODE) {
				setStatus('جارِ الرجوع إلى اللوحة الرئيسية');
				navigateToDashboard();
				return;
			}
			await fetch(buildApiUrl('/shutdown'), { method: 'POST' });
			setStatus('تم الإغلاق');
			setTimeout(() => {
				window.close();
			}, 200);
		} catch (err) {
			console.error('Shutdown failed', err);
			setStatus('تعذر الإغلاق');
		}
	});
}

// ========== Settings Sidebar & Companies Management ==========
const settingsBtn = document.getElementById('settingsBtn');
const settingsSidebar = document.getElementById('settingsSidebar');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const companiesMBtn = document.getElementById('companiesMBtn');
const companiesHBtn = document.getElementById('companiesHBtn');
const companiesModal = document.getElementById('companiesModal');
const companiesModalTitle = document.getElementById('companiesModalTitle');
const closeCompaniesModal = document.getElementById('closeCompaniesModal');
const addCompanyBtn = document.getElementById('addCompanyBtn');
const exportCompaniesExcelBtn = document.getElementById('exportCompaniesExcelBtn');
const addCompanyModal = document.getElementById('addCompanyModal');
const newCompanyName = document.getElementById('newCompanyName');
const confirmAddCompany = document.getElementById('confirmAddCompany');
const cancelAddCompany = document.getElementById('cancelAddCompany');
const companiesTableBody = document.querySelector('#companiesTable tbody');
const companySearch = document.getElementById('companySearch');
const addCompanyError = document.getElementById('addCompanyError');

let currentCompanies = [];
let companyNamesNormalized = [];
let companyNamesStripped = [];
let companyNamesLoose = [];
let companyNameChunks = [];
let companyNameChunksStripped = [];
let companyNameChunksLoose = [];
let companyTokensList = [];
let companyTokenFrequency = {};

function openSidebar() {
	if (settingsSidebar) settingsSidebar.classList.add('open');
	if (sidebarOverlay) sidebarOverlay.classList.add('visible');
}

function closeSidebar() {
	if (settingsSidebar) settingsSidebar.classList.remove('open');
	if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
}

function openCompaniesModal() {
	closeSidebar();
	if (companiesModal) companiesModal.classList.add('visible');
	// default open admin list
	openCompaniesModalWithKind('H');
}

let companiesUiKind = 'H'; // 'H' (حجز اداري) | 'M' (مصادرة)

function getCompaniesListName() {
	return companiesUiKind === 'M' ? 'شركات المصادرة' : 'شركات الحجز الاداري';
}

function setCompaniesModalTitle() {
	if (!companiesModalTitle) return;
	companiesModalTitle.textContent = `قائمة ${getCompaniesListName()}`;
}

function openCompaniesModalWithKind(kind) {
	companiesUiKind = String(kind || 'H').toUpperCase() === 'M' ? 'M' : 'H';
	setCompaniesModalTitle();
	loadCompanies(companiesUiKind);
	if (companySearch) {
		companySearch.value = '';
		companySearch.focus();
	}
}

function closeCompaniesModalFn() {
	if (companiesModal) companiesModal.classList.remove('visible');
}

function openAddCompanyModal() {
	if (addCompanyModal) addCompanyModal.classList.add('visible');
	if (newCompanyName) {
		newCompanyName.value = '';
		newCompanyName.focus();
	}
	if (addCompanyError) {
		addCompanyError.classList.remove('visible');
		addCompanyError.textContent = '';
	}
}

function closeAddCompanyModal() {
	if (addCompanyModal) addCompanyModal.classList.remove('visible');
	if (newCompanyName) newCompanyName.value = '';
}

const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

let companyToDeleteId = null;

function renderCompanies(list) {
	if (!companiesTableBody) return;
	companiesTableBody.innerHTML = '';
	list.forEach((company, idx) => {
		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td>${idx + 1}</td>
			<td>${company.name}</td>
			<td><button class="remove-company-btn" data-id="${company.id}" data-name="${company.name}">حذف</button></td>
		`;
		companiesTableBody.appendChild(tr);
	});
	// Attach remove event listeners
	companiesTableBody.querySelectorAll('.remove-company-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = parseInt(btn.dataset.id, 10);
			const name = btn.dataset.name;
			openDeleteConfirmModal(id, name);
		});
	});
}

async function exportCurrentCompaniesToExcel() {
	const baseName = getCompaniesListName();
	try {
		const res = await fetch(buildApiUrl(`/companies/export?kind=${encodeURIComponent(companiesUiKind)}`));
		if (!res.ok) throw new Error(`Export failed: ${res.status}`);
		const blob = await res.blob();
		downloadBlob(blob, getDownloadFilename(res, `${baseName}.xlsx`));
	} catch (err) {
		console.error('Failed to export companies', err);
		alert('تعذر تصدير قائمة الشركات.');
	}
}

function openDeleteConfirmModal(id, name) {
	companyToDeleteId = id;
	if (deleteConfirmMessage) {
		deleteConfirmMessage.textContent = `هل أنت متأكد من حذف شركة "${name}"؟`;
	}
	if (deleteConfirmModal) {
		deleteConfirmModal.classList.add('visible');
	}
}

function closeDeleteConfirmModal() {
	companyToDeleteId = null;
	if (deleteConfirmModal) {
		deleteConfirmModal.classList.remove('visible');
	}
}

async function loadCompanies(kind = companiesUiKind) {
	try {
		const res = await fetch(buildApiUrl(`/companies?kind=${encodeURIComponent(kind)}`));
		const json = await res.json();
		if (!companiesTableBody) return;

		// Accept either array format [{id,name}] or object map {"0": "..."}
		let companiesArr = [];
		if (Array.isArray(json.companies)) {
			companiesArr = json.companies;
		} else if (json.companies && typeof json.companies === 'object') {
			companiesArr = Object.keys(json.companies)
				.map(Number)
				.sort((a, b) => a - b)
				.map((id) => ({ id, name: json.companies[id] }));
		}

		// Update UI list always
		currentCompanies = companiesArr;
		renderCompanies(currentCompanies);
		// Rebuild the appropriate rules cache
		if (String(kind).toUpperCase() === 'H') {
			companyCacheH = buildCompanyCache(companiesArr);
			setCompanyList(companiesArr);
			enforceCompanyRulesOnData(true);
		} else if (String(kind).toUpperCase() === 'M') {
			companyCacheM = buildCompanyCache(companiesArr);
			enforceCompanyRulesOnData(true);
		}
	} catch (err) {
		console.error('Failed to load companies', err);
	}
}

if (companySearch) {
	companySearch.addEventListener('input', (e) => {
		const query = e.target.value.trim().toLowerCase();
		const filtered = currentCompanies.filter(c => c.name.toLowerCase().includes(query));
		renderCompanies(filtered);
	});
}

async function addCompany(name) {
	if (!name || !name.trim()) return;
	const trimmedName = name.trim();

	// Check duplicate
	const exists = currentCompanies.some(c => c.name === trimmedName);
	if (exists) {
		if (addCompanyError) {
			addCompanyError.textContent = 'الشركة موجوده بالفعل!';
			addCompanyError.classList.add('visible');
		}
		return;
	}

	try {
		const res = await fetch(buildApiUrl('/companies/add'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: trimmedName, kind: companiesUiKind })
		});
		const json = await res.json();
		if (json.ok) {
			closeAddCompanyModal();
			loadCompanies(companiesUiKind);
		}
	} catch (err) {
		console.error('Failed to add company', err);
	}
}

async function removeCompany(id) {
	try {
		const res = await fetch(buildApiUrl('/companies/remove'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, kind: companiesUiKind })
		});
		const json = await res.json();
		if (json.ok) {
			loadCompanies(companiesUiKind);
		}
	} catch (err) {
		console.error('Failed to remove company', err);
	}
}

// Event listeners for settings/companies
if (settingsBtn) settingsBtn.addEventListener('click', openSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
if (companiesMBtn) companiesMBtn.addEventListener('click', () => {
	closeSidebar();
	if (companiesModal) companiesModal.classList.add('visible');
	openCompaniesModalWithKind('M');
});
if (companiesHBtn) companiesHBtn.addEventListener('click', () => {
	closeSidebar();
	if (companiesModal) companiesModal.classList.add('visible');
	openCompaniesModalWithKind('H');
});
if (closeCompaniesModal) closeCompaniesModal.addEventListener('click', closeCompaniesModalFn);
if (addCompanyBtn) addCompanyBtn.addEventListener('click', openAddCompanyModal);
if (exportCompaniesExcelBtn) exportCompaniesExcelBtn.addEventListener('click', exportCurrentCompaniesToExcel);
if (confirmAddCompany) confirmAddCompany.addEventListener('click', () => addCompany(newCompanyName?.value));
if (cancelAddCompany) cancelAddCompany.addEventListener('click', closeAddCompanyModal);

if (confirmDeleteBtn) {
	confirmDeleteBtn.addEventListener('click', async () => {
		if (companyToDeleteId !== null) {
			await removeCompany(companyToDeleteId);
			closeDeleteConfirmModal();
		}
	});
}

if (cancelDeleteBtn) {
	cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
}

// Close add company modal on Enter key
if (newCompanyName) {
	newCompanyName.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			addCompany(newCompanyName.value);
		}
	});
	newCompanyName.addEventListener('input', () => {
		if (addCompanyError) addCompanyError.classList.remove('visible');
	});
}

updateStationsDisplay();

// ========== CSV Import ==========
let importCsvText = '';
let importPreviewState = null;

function readFileAsText(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ''));
		reader.onerror = () => reject(reader.error || new Error('فشل قراءة الملف'));
		reader.readAsText(file, 'utf-8');
	});
}

async function postImportJson(urlPath, payload) {
	const response = await fetch(buildApiUrl(urlPath), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload || {})
	});
	const json = await response.json().catch(() => null);
	if (!response.ok || !json || json.ok === false) {
		const msg = (json && json.message) ? json.message : `HTTP ${response.status}`;
		const err = new Error(msg);
		err.payload = json;
		throw err;
	}
	return json;
}

function collectImportMapping() {
	const selects = document.querySelectorAll('.seized-import-map-select');
	const mapping = {};
	selects.forEach(select => {
		const key = select.getAttribute('data-key');
		const value = select.value;
		if (!key || value === '') return;
		const n = Number(value);
		mapping[key] = Number.isInteger(n) ? n : value;
	});
	return mapping;
}

function setImportMessage(text, color = '#475569') {
	const el = document.getElementById('seizedImportMessage');
	if (!el) return;
	el.textContent = text || '';
	el.style.color = color;
}

function updateImportReplaceBtn(schema) {
	const btn = document.getElementById('seizedImportReplaceBtn');
	const warn = document.getElementById('seizedImportRequiredWarn');
	if (!btn || !schema) return;
	const mapping = collectImportMapping();
	const missing = (schema.columns || [])
		.filter(c => c.required && (mapping[c.key] == null || mapping[c.key] === ''))
		.map(c => c.label);
	btn.disabled = missing.length > 0;
	if (warn) warn.textContent = missing.length ? 'يجب ربط: ' + missing.join('، ') : '';
}

function renderImportPreview(preview, schema) {
	const holder = document.getElementById('seizedImportPreviewTable');
	if (!holder) return;
	const rows = Array.isArray(preview && preview.mappedPreview) ? preview.mappedPreview : [];
	const cols = (schema && schema.columns) || [];
	if (!rows.length) {
		holder.innerHTML = '<p style="color:#64748b;text-align:center;padding:12px;">لا توجد صفوف للمعاينة.</p>';
		return;
	}
	const visibleCols = cols.filter(c => {
		const sel = document.querySelector(`.seized-import-map-select[data-key="${c.key}"]`);
		return sel && sel.value !== '';
	});
	const displayCols = visibleCols.length ? visibleCols : cols;
	let html = '<table class="seized-import-preview-tbl"><thead><tr>';
	displayCols.forEach(c => { html += `<th>${escapeHtml(c.label)}</th>`; });
	html += '</tr></thead><tbody>';
	rows.forEach(row => {
		html += '<tr>';
		displayCols.forEach(c => { html += `<td>${escapeHtml(String(row[c.key] != null ? row[c.key] : ''))}</td>`; });
		html += '</tr>';
	});
	html += '</tbody></table>';
	holder.innerHTML = html;
}

function renderImportMapper(schema, preview) {
	const mapper = document.getElementById('seizedImportMapper');
	const meta = document.getElementById('seizedImportMeta');
	if (!mapper || !schema || !preview) return;
	const headers = Array.isArray(preview.headers) ? preview.headers : [];
	const suggested = preview.suggestedMapping || {};
	if (meta) {
		meta.innerHTML = `
			<div class="import-stat"><span>صفوف CSV</span><strong>${preview.totalRows || 0}</strong></div>
			<div class="import-stat"><span>أعمدة CSV</span><strong>${headers.length}</strong></div>
			<div class="import-stat"><span>أعمدة قاعدة البيانات</span><strong>${(schema.columns || []).length}</strong></div>
		`;
	}
	const sourceOptions = headers.map((h, i) =>
		`<option value="${i}">${i + 1} - ${escapeHtml(h || '(بدون اسم)')}</option>`
	).join('');
	let html = `
		<div class="import-note">اربط كل عمود بعمود CSV المناسب. الأعمدة غير المربوطة ستدخل فارغة.</div>
		<div class="import-grid-head"><span>#</span><span>العمود</span><span>عمود CSV</span><span>مطلوب</span></div>
	`;
	(schema.columns || []).forEach((col, idx) => {
		html += `
			<div class="import-map-row">
				<div class="import-map-idx">${idx + 1}</div>
				<div class="import-sql-col"><strong>${escapeHtml(col.label)}</strong></div>
				<select class="seized-import-map-select" data-key="${escapeHtml(col.key)}">
					<option value="">لا يستورد</option>
					${sourceOptions}
				</select>
				<div class="import-req">${col.required ? 'نعم' : ''}</div>
			</div>
		`;
	});
	mapper.innerHTML = html;
	mapper.querySelectorAll('.seized-import-map-select').forEach(select => {
		const key = select.getAttribute('data-key');
		if (Object.prototype.hasOwnProperty.call(suggested, key)) select.value = String(suggested[key]);
		select.addEventListener('change', async () => {
			updateImportReplaceBtn(schema);
			if (importCsvText) {
				try {
					const result = await postImportJson('/import/preview', { csvText: importCsvText, mapping: collectImportMapping() });
					renderImportPreview(result.preview, result.schema || schema);
				} catch { /* ignore refresh errors */ }
			}
		});
	});
	renderImportPreview(preview, schema);
	updateImportReplaceBtn(schema);
}

async function openImportFrame() {
	let overlay = document.getElementById('seizedImportOverlay');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'seizedImportOverlay';
		overlay.className = 'seized-import-overlay';
		overlay.innerHTML = `
			<div class="seized-import-frame">
				<div class="seized-import-header">
					<h3>استيراد CSV إلى قاعدة البيانات</h3>
					<button id="seizedImportCloseBtn" class="action-btn ghost" style="font-size:1.2em;padding:4px 10px;">×</button>
				</div>
				<div id="seizedImportContent" class="seized-import-content">
					<div class="import-loading">جاري تحميل الإعدادات...</div>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);
		overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
		document.getElementById('seizedImportCloseBtn')?.addEventListener('click', () => overlay.classList.remove('open'));
	}

	overlay.classList.add('open');
	importCsvText = '';
	importPreviewState = null;
	const content = document.getElementById('seizedImportContent');
	content.innerHTML = '<div class="import-loading">جاري تحميل إعدادات الاستيراد...</div>';
	closeSidebar();

	try {
		const schemaRes = await fetch(buildApiUrl('/import/schema'), { cache: 'no-store' });
		const schemaPayload = await schemaRes.json().catch(() => null);
		if (!schemaRes.ok || !schemaPayload || schemaPayload.ok === false) {
			throw new Error((schemaPayload && schemaPayload.message) || `HTTP ${schemaRes.status}`);
		}
		const schema = schemaPayload.schema;
		const stats = schemaPayload.stats || {};
		content.innerHTML = `
			<div class="import-toolbar">
				<div>
					<div class="import-title">استيراد CSV إلى سجلات الأحراز</div>
					<div class="import-subtitle">السجلات الحالية في قاعدة البيانات: ${escapeHtml(String(stats.totalRows || 0))} سجل</div>
				</div>
				<label class="import-file-btn action-btn add-btn" style="cursor:pointer;">
					اختيار CSV
					<input id="seizedImportFileInput" type="file" accept=".csv,text/csv" style="display:none" />
				</label>
			</div>
			<div id="seizedImportMessage" class="import-message">اختر ملف CSV ثم اربط الأعمدة قبل الاستبدال.</div>
			<div id="seizedImportMeta" class="import-meta"></div>
			<div id="seizedImportMapper" class="import-mapper"></div>
			<div id="seizedImportRequiredWarn" class="import-required-warn"></div>
			<div class="import-actions">
				<button id="seizedImportReplaceBtn" class="action-btn delete-btn" disabled>استبدال بيانات قاعدة البيانات بهذا CSV</button>
			</div>
			<div class="import-preview-title">معاينة البيانات بعد الربط (أول 5 صفوف)</div>
			<div id="seizedImportPreviewTable" class="import-preview-wrap"></div>
		`;

		document.getElementById('seizedImportFileInput')?.addEventListener('change', async (e) => {
			const file = e.target.files && e.target.files[0];
			if (!file) return;
			try {
				setImportMessage('جاري قراءة الملف...');
				importCsvText = await readFileAsText(file);
				const result = await postImportJson('/import/preview', { csvText: importCsvText });
				importPreviewState = { schema: result.schema || schema, preview: result.preview };
				renderImportMapper(result.schema || schema, result.preview);
				setImportMessage(`تم قراءة ${escapeHtml(file.name)}. راجع الربط ثم اضغط الاستبدال.`, '#047857');
			} catch (err) {
				importCsvText = '';
				importPreviewState = null;
				const mapperEl = document.getElementById('seizedImportMapper');
				const previewEl = document.getElementById('seizedImportPreviewTable');
				if (mapperEl) mapperEl.innerHTML = '';
				if (previewEl) previewEl.innerHTML = '';
				setImportMessage('فشل قراءة CSV: ' + err.message, '#b91c1c');
			}
		});

		document.getElementById('seizedImportReplaceBtn')?.addEventListener('click', async () => {
			if (!importCsvText || !importPreviewState) return;
			updateImportReplaceBtn(importPreviewState.schema);
			const btn = document.getElementById('seizedImportReplaceBtn');
			if (btn && btn.disabled) return;
			const ok = confirm('سيتم استبدال كل بيانات قاعدة البيانات الحالية بالبيانات المستوردة من CSV. هل تريد المتابعة؟');
			if (!ok) return;
			if (btn) { btn.disabled = true; btn.textContent = 'جاري الاستيراد...'; }
			try {
				const result = await postImportJson('/import/replace', {
					csvText: importCsvText,
					mapping: collectImportMapping(),
					confirm: 'replace'
				});
				setImportMessage(result.message || 'تم الاستيراد', '#047857');
				setStatus('تم استيراد البيانات، جارِ التحديث...');
				await bootstrap();
				setStatus('تم التحديث');
			} catch (err) {
				setImportMessage('فشل الاستيراد: ' + err.message, '#b91c1c');
			} finally {
				if (btn) {
					btn.textContent = 'استبدال بيانات قاعدة البيانات بهذا CSV';
					if (importPreviewState) updateImportReplaceBtn(importPreviewState.schema);
				}
			}
		});
	} catch (err) {
		content.innerHTML = `<div style="padding:18px;text-align:center;color:#b91c1c;font-weight:700;">تعذر فتح الاستيراد: ${escapeHtml(err.message || String(err))}</div>`;
	}
}

const csvImportBtn = document.getElementById('csvImportBtn');
if (csvImportBtn) csvImportBtn.addEventListener('click', openImportFrame);
