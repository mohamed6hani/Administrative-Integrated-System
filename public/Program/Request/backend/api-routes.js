const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { disabledDesktopAutomation: exec } = require('../../General/backend/demo-desktop-automation');
const {
    clearFileCache,
    getFileVersionPayload: getCachedFileVersionPayload,
    readJsonCached
} = require('../../General/backend/file-data-cache');
const {
    appDataDir,
    dataSubdir,
    dataFile
} = require('../../General/backend/platform-paths');
const deleteApproval = require('../../General/backend/delete-approval-store');
const { logRecordActivity } = require('../../General/backend/activity-record-audit');

// Data file path
const REQUEST_ROOT = path.join(__dirname, '..');
const LEGACY_DATA_DIR = path.join(REQUEST_ROOT, 'data');
const DATA_DIR = appDataDir('Request', { legacyDirs: [LEGACY_DATA_DIR] });
const REQUESTS_FILE = dataFile('Request', 'requests.json', [
    path.join(LEGACY_DATA_DIR, 'requests.json')
]);
const TMP_DIR = dataSubdir('Request', 'tmp', {
    legacyDirs: [path.join(REQUEST_ROOT, 'tmp')]
});
const UNDO_FILE = path.join(TMP_DIR, 'undo.json');
const EXPORT_RETENTION_MS = 1000 * 60 * 60 * 24;
const MAX_EXPORT_RECORDS = 5000;
const EXCEL_FILE_EXTENSION = '.xlsx';
let ExcelJS = null;

function getExcelJS() {
    if (ExcelJS) return ExcelJS;
    try {
        ExcelJS = require('exceljs');
        return ExcelJS;
    } catch (error) {
        const missingError = new Error('exceljs is not installed');
        missingError.code = 'EXCELJS_MISSING';
        throw missingError;
    }
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize requests file if it doesn't exist
if (!fs.existsSync(REQUESTS_FILE)) {
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

function ensureUndoFile() {
    if (!fs.existsSync(UNDO_FILE)) {
        fs.writeFileSync(UNDO_FILE, JSON.stringify([]));
    }
}

function readJsonFile(filePath, fallback = []) {
    try {
        return readJsonCached(filePath, fallback);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    clearFileCache(filePath);
}

function getFileVersionPayload(filePath) {
    return getCachedFileVersionPayload(filePath, { kind: 'json-array' });
}

function cleanupOldExports(maxAgeMs = EXPORT_RETENTION_MS) {
    if (!fs.existsSync(TMP_DIR)) {
        return;
    }

    const now = Date.now();
    try {
        const entries = fs.readdirSync(TMP_DIR);
        entries.forEach((entry) => {
            if (!entry.toLowerCase().endsWith(EXCEL_FILE_EXTENSION)) return;
            const fullPath = path.join(TMP_DIR, entry);
            const stats = fs.statSync(fullPath);
            if (now - stats.mtimeMs > maxAgeMs) {
                fs.unlinkSync(fullPath);
            }
        });
    } catch (error) {
        console.warn('Failed to cleanup export files:', error);
    }
}

function sanitizeExportValue(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/\r\n/g, '\n')
        .replace(/[\u202a\u202b\u202c\u202d\u202e\u200f\u200e]/g, '')
        .trim();
}

function normalizeNameKey(value) {
    return String(value || '')
        .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function extractRequestName(record) {
    if (!record || typeof record !== 'object') return '';
    return record.requesterName
        || record.name
        || record.fullName
        || record['الاسم']
        || '';
}

function hasDuplicateName(records, candidateKey, ignoreId) {
    if (!candidateKey || !Array.isArray(records)) return false;
    for (const entry of records) {
        if (!entry) continue;
        if (ignoreId && String(entry.id) === String(ignoreId)) continue;
        const entryKey = normalizeNameKey(extractRequestName(entry));
        if (entryKey && entryKey === candidateKey) {
            return true;
        }
    }
    return false;
}

function getNextSequentialId(items) {
    return items.reduce((max, item) => {
        const numericId = Number(item?.id);
        return Number.isFinite(numericId) && numericId > max ? numericId : max;
    }, 0) + 1;
}

ensureUndoFile();

function createRequestRecordFromPayload(payload = {}) {
    const requests = readJsonFile(REQUESTS_FILE, []);
    const nextId = getNextSequentialId(requests);
    const newRequest = {
        id: String(nextId),
        ...(payload && typeof payload === 'object' ? payload : {}),
        createdAt: new Date().toISOString(),
        status: 'pending'
    };

    const incomingName = extractRequestName(newRequest);
    const nameKey = normalizeNameKey(incomingName);
    if (nameKey && hasDuplicateName(requests, nameKey)) {
        const error = new Error(incomingName ? `يوجد سجل آخر بنفس الاسم: ${incomingName}` : 'يوجد سجل آخر بنفس الاسم.');
        error.status = 409;
        error.code = 'duplicate-name';
        throw error;
    }

    requests.push(newRequest);
    writeJsonFile(REQUESTS_FILE, requests);
    return newRequest;
}

function updateRequestRecordById(id, payload = {}) {
    const requests = readJsonFile(REQUESTS_FILE, []);
    const index = requests.findIndex(r => String(r.id) === String(id));
    if (index === -1) {
        const error = new Error('Request not found');
        error.status = 404;
        throw error;
    }

    const mergedRecord = {
        ...requests[index],
        ...(payload && typeof payload === 'object' ? payload : {}),
        updatedAt: new Date().toISOString()
    };
    const incomingName = extractRequestName(mergedRecord);
    const nameKey = normalizeNameKey(incomingName);
    if (nameKey && hasDuplicateName(requests, nameKey, mergedRecord.id)) {
        const error = new Error(incomingName ? `يوجد سجل آخر بنفس الاسم: ${incomingName}` : 'يوجد سجل آخر بنفس الاسم.');
        error.status = 409;
        error.code = 'duplicate-name';
        throw error;
    }

    requests[index] = mergedRecord;
    writeJsonFile(REQUESTS_FILE, requests);
    return mergedRecord;
}

deleteApproval.registerDeleteApprovalExecutor('request.add', (operation) => {
    const record = createRequestRecordFromPayload(operation?.record || {});
    return { ok: true, success: true, action: 'add', record };
});

deleteApproval.registerDeleteApprovalExecutor('request.edit', (operation) => {
    const record = updateRequestRecordById(operation?.id, operation?.updates || operation?.record || {});
    return { ok: true, success: true, action: 'edit', record };
});

router.get('/requests/version', (req, res) => {
    try {
        if (!fs.existsSync(REQUESTS_FILE)) {
            writeJsonFile(REQUESTS_FILE, []);
        }
        return res.json(getFileVersionPayload(REQUESTS_FILE));
    } catch (error) {
        console.error('Error reading requests version:', error);
        return res.status(500).json({ ok: false, version: null, updatedAt: null, size: 0, error: 'Failed to read requests version' });
    }
});

// Get all requests
router.get('/requests', (req, res) => {
    try {
        const requests = readJsonFile(REQUESTS_FILE, []);
        res.json(requests);
    } catch (error) {
        console.error('Error reading requests:', error);
        res.status(500).json({ error: 'Failed to read requests' });
    }
});

// Get deleted requests (undo list)
router.get('/requests/deleted', (req, res) => {
    try {
        ensureUndoFile();
        const deletedRecords = readJsonFile(UNDO_FILE, []);
        res.json(deletedRecords);
    } catch (error) {
        console.error('Error reading deleted requests:', error);
        res.status(500).json({ error: 'Failed to read deleted requests' });
    }
});

// Get single request by ID
router.get('/requests/:id', (req, res) => {
    try {
        const requests = readJsonFile(REQUESTS_FILE, []);
        const request = requests.find(r => r.id === req.params.id);
        
        if (request) {
            res.json(request);
        } else {
            res.status(404).json({ error: 'Request not found' });
        }
    } catch (error) {
        console.error('Error reading request:', error);
        res.status(500).json({ error: 'Failed to read request' });
    }
});

// Create new request
router.post('/requests', (req, res) => {
    try {
        const draftRequest = {
            ...(req.body && typeof req.body === 'object' ? req.body : {}),
            createdAt: new Date().toISOString(),
            status: 'pending'
        };

        const requests = readJsonFile(REQUESTS_FILE, []);
        const incomingName = extractRequestName(draftRequest);
        const nameKey = normalizeNameKey(incomingName);
        if (nameKey && hasDuplicateName(requests, nameKey)) {
            return res.status(409).json({
                code: 'duplicate-name',
                name: incomingName,
                error: incomingName ? `يوجد سجل آخر بنفس الاسم: ${incomingName}` : 'يوجد سجل آخر بنفس الاسم.'
            });
        }

        if (deleteApproval.isActionApprovalRequired(req, { programKey: 'request', action: 'add' })) {
            const approval = deleteApproval.createDeleteApprovalRequest(req, {
                action: 'add',
                programKey: 'request',
                programName: 'برنامج طلبات ترخيص اول مرة',
                recordLabel: extractRequestName(draftRequest) || 'طلب جديد',
                recordSnapshot: draftRequest,
                operation: {
                    type: 'request.add',
                    action: 'add',
                    record: req.body && typeof req.body === 'object' ? req.body : {}
                }
            });
            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: deleteApproval.getApprovalRequiredMessage('add'),
                request: approval.request
            });
        }

        const newRequest = createRequestRecordFromPayload(req.body);
        logRecordActivity(req, {
            action: 'add',
            programKey: 'request',
            programName: 'برنامج طلبات ترخيص اول مرة',
            recordId: newRequest.id,
            record: newRequest
        });
        res.status(201).json(newRequest);
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(Number(error?.status) || 500).json({ error: error.message || 'Failed to create request' });
    }
});

// Update request
router.put('/requests/:id', (req, res) => {
    try {
        let requests = readJsonFile(REQUESTS_FILE, []);
        
        const index = requests.findIndex(r => r.id === req.params.id);
        
        if (index !== -1) {
            const mergedRecord = {
                ...requests[index],
                ...req.body,
                updatedAt: new Date().toISOString()
            };
            const incomingName = extractRequestName(mergedRecord);
            const nameKey = normalizeNameKey(incomingName);
            if (nameKey && hasDuplicateName(requests, nameKey, mergedRecord.id)) {
                return res.status(409).json({
                    code: 'duplicate-name',
                    name: incomingName,
                    error: incomingName ? `يوجد سجل آخر بنفس الاسم: ${incomingName}` : 'يوجد سجل آخر بنفس الاسم.'
                });
            }
            if (deleteApproval.isActionApprovalRequired(req, { programKey: 'request', action: 'edit' })) {
                const approval = deleteApproval.createDeleteApprovalRequest(req, {
                    action: 'edit',
                    programKey: 'request',
                    programName: 'برنامج طلبات ترخيص اول مرة',
                    recordId: String(req.params.id),
                    recordLabel: extractRequestName(mergedRecord) || `طلب رقم ${req.params.id}`,
                    recordSnapshot: {
                        before: requests[index],
                        after: mergedRecord
                    },
                    operation: {
                        type: 'request.edit',
                        action: 'edit',
                        id: String(req.params.id),
                        updates: req.body && typeof req.body === 'object' ? req.body : {}
                    }
                });
                return res.status(202).json({
                    success: true,
                    approvalRequired: true,
                    message: deleteApproval.getApprovalRequiredMessage('edit'),
                    request: approval.request
                });
            }

            const before = requests[index];
            const updated = updateRequestRecordById(req.params.id, req.body);
            logRecordActivity(req, {
                action: 'edit',
                programKey: 'request',
                programName: 'برنامج طلبات ترخيص اول مرة',
                recordId: updated.id || req.params.id,
                before,
                after: updated
            });
            res.json(updated);
        } else {
            res.status(404).json({ error: 'Request not found' });
        }
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ error: 'Failed to update request' });
    }
});

// Clear temporary files (undo store)
router.delete('/requests/deleted', (req, res) => {
    try {
        if (fs.existsSync(TMP_DIR)) {
            const entries = fs.readdirSync(TMP_DIR);
            entries.forEach((entry) => {
                const fullPath = path.join(TMP_DIR, entry);
                if (fs.lstatSync(fullPath).isDirectory()) {
                    if (fs.rmSync) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    } else {
                        fs.rmdirSync(fullPath, { recursive: true });
                    }
                } else {
                    fs.unlinkSync(fullPath);
                }
            });
        }
        ensureUndoFile();
        res.json({ message: 'Temporary files cleared successfully' });
    } catch (error) {
        console.error('Error clearing temporary files:', error);
        res.status(500).json({ error: 'Failed to clear temporary files' });
    }
});

// Delete request
router.delete('/requests/:id', (req, res) => {
    try {
        let requests = readJsonFile(REQUESTS_FILE, []);
        const index = requests.findIndex(r => r.id === req.params.id);

        if (index !== -1) {
            const targetRecord = requests[index];
            if (deleteApproval.isDeleteApprovalRequired(req)) {
                const approval = deleteApproval.createDeleteApprovalRequest(req, {
                    action: 'delete',
                    programKey: 'request',
                    programName: 'برنامج طلبات ترخيص اول مرة',
                    recordId: String(targetRecord.id || req.params.id),
                    recordLabel: extractRequestName(targetRecord) || `طلب رقم ${targetRecord.id || req.params.id}`,
                    recordSnapshot: targetRecord,
                    operation: {
                        type: 'request.delete',
                        id: String(targetRecord.id || req.params.id)
                    }
                });
                return res.status(202).json({
                    success: true,
                    approvalRequired: true,
                    message: deleteApproval.getApprovalRequiredMessage('delete'),
                    request: approval.request
                });
            }

            ensureUndoFile();
            const [deletedRecord] = requests.splice(index, 1);
            deletedRecord.deletedAt = new Date().toISOString();

            const deletedRecords = readJsonFile(UNDO_FILE, []);
            deletedRecords.unshift(deletedRecord);

            writeJsonFile(REQUESTS_FILE, requests);
            writeJsonFile(UNDO_FILE, deletedRecords);
            logRecordActivity(req, {
                action: 'delete',
                programKey: 'request',
                programName: 'برنامج طلبات ترخيص اول مرة',
                recordId: deletedRecord.id || req.params.id,
                record: deletedRecord
            });

            res.json({ message: 'Request deleted successfully', deleted: deletedRecord });
        } else {
            res.status(404).json({ error: 'Request not found' });
        }
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({ error: 'Failed to delete request' });
    }
});

// Restore a deleted request
router.post('/requests/restore', (req, res) => {
    try {
        const { id } = req.body || {};
        if (!id) {
            return res.status(400).json({ error: 'Request id is required for restoration.' });
        }

        ensureUndoFile();
        const deletedRecords = readJsonFile(UNDO_FILE, []);
        const recordIndex = deletedRecords.findIndex(item => String(item.id) === String(id));

        if (recordIndex === -1) {
            return res.status(404).json({ error: 'Deleted request not found' });
        }

        let requests = readJsonFile(REQUESTS_FILE, []);
        const nextId = getNextSequentialId(requests);

        const [restoredRecordRaw] = deletedRecords.splice(recordIndex, 1);
        const restoredRecord = {
            ...restoredRecordRaw,
            id: String(nextId),
            restoredAt: new Date().toISOString(),
            status: restoredRecordRaw.status || 'pending'
        };
        delete restoredRecord.deletedAt;

        const restoredName = extractRequestName(restoredRecord);
        const restoredKey = normalizeNameKey(restoredName);
        if (restoredKey && hasDuplicateName(requests, restoredKey)) {
            return res.status(409).json({
                code: 'duplicate-name',
                name: restoredName,
                error: restoredName ? `يوجد سجل آخر بنفس الاسم: ${restoredName}` : 'يوجد سجل آخر بنفس الاسم.'
            });
        }

        requests.push(restoredRecord);

        writeJsonFile(REQUESTS_FILE, requests);
        writeJsonFile(UNDO_FILE, deletedRecords);

        res.json({ message: 'Request restored successfully', restored: restoredRecord });
    } catch (error) {
        console.error('Error restoring request:', error);
        res.status(500).json({ error: 'Failed to restore request' });
    }
});

router.post('/requests/export', async (req, res) => {
    try {
        const body = req.body || {};
        const records = Array.isArray(body.records) ? body.records : [];

        if (!records.length) {
            return res.status(400).json({ error: 'لا توجد بيانات متاحة للتصدير.' });
        }

        if (records.length > MAX_EXPORT_RECORDS) {
            return res.status(400).json({
                error: `عدد السجلات المطلوب تصديرها كبير (${records.length}). يرجى تقليل النتائج والمحاولة مرة أخرى.`
            });
        }

        const normalizedRecords = records.map((record, index) => {
            const fallbackId = String(index + 1);
            return {
                recordId: sanitizeExportValue(record.recordId || record.id || fallbackId),
                requesterName: sanitizeExportValue(record.requesterName || record.name || ''),
                applicationDate: sanitizeExportValue(record.applicationDate || ''),
                sector: sanitizeExportValue(record.sector || ''),
                station: sanitizeExportValue(record.station || ''),
                weaponData: sanitizeExportValue(record.weaponData || ''),
                notes: sanitizeExportValue(record.notes || '')
            };
        });

        const ExcelJSLib = getExcelJS();
        const workbook = new ExcelJSLib.Workbook();
        workbook.creator = 'Request Module';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('الطلبات', {
            views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
        });

        const headers = [
            { key: 'recordId', label: 'رقم الطلب', width: 14 },
            { key: 'requesterName', label: 'اسم الطالب', width: 34 },
            { key: 'applicationDate', label: 'تاريخ التقديم', width: 18 },
            { key: 'sector', label: 'القطاع', width: 20 },
            { key: 'station', label: 'القسم', width: 24 },
            { key: 'weaponData', label: 'السلاح المطلوب', width: 60 },
            { key: 'notes', label: 'ملاحظات', width: 42 }
        ];

        const headerLabels = headers.map((header) => header.label);
        worksheet.addRow(headerLabels);
        normalizedRecords.forEach((entry) => {
            worksheet.addRow(headers.map(({ key }) => entry[key] || ''));
        });

        headers.forEach((header, columnIndex) => {
            const column = worksheet.getColumn(columnIndex + 1);
            column.width = header.width;
        });

        const headerRow = worksheet.getRow(1);
        headerRow.height = 26;
        headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF000000' }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        });

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            row.eachCell((cell, columnNumber) => {
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true,
                    readingOrder: 'rtl'
                };
                if (rowNumber > 1) {
                    cell.border = {
                        top: { style: 'hair', color: { argb: 'FF808080' } },
                        left: { style: 'hair', color: { argb: 'FF808080' } },
                        bottom: { style: 'hair', color: { argb: 'FF808080' } },
                        right: { style: 'hair', color: { argb: 'FF808080' } }
                    };
                }
                cell.protection = { locked: false };
            });
            if (rowNumber > 1) {
                row.height = Math.max(row.height || 20, 24);
            }
        });

        worksheet.columns.forEach((column) => {
            column.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true,
                readingOrder: 'rtl'
            };
        });

        worksheet.properties.defaultRowHeight = 22;
        worksheet.autoFilter = undefined;
        worksheet.pageSetup = {
            orientation: 'landscape',
            paperSize: 1,
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            verticalCentered: false
        };
        worksheet.pageSetup.printTitlesRow = '1:1';

        const fileName = `request_export_${Date.now()}${EXCEL_FILE_EXTENSION}`;
        const filePath = path.join(TMP_DIR, fileName);

        await workbook.xlsx.writeFile(filePath);
        cleanupOldExports();

        const basePath = req.baseUrl || '/api/request';
        const sanitizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
        const downloadPath = `${sanitizedBasePath}/requests/export/${encodeURIComponent(fileName)}`;
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
        const host = req.get('x-forwarded-host') || req.get('host');
        const absoluteUrl = host ? `${protocol}://${host}${downloadPath}` : downloadPath;
        const downloadUrl = downloadPath;

        const escapedPath = String(filePath).replace(/'/g, "''");
        const psScript = [
            `$p='${escapedPath}'`,
            `$xl = New-Object -ComObject Excel.Application`,
            `$xl.Visible=$true`,
            `$xl.DisplayAlerts=$false`,
            `$wb = $xl.Workbooks.Open($p)`,
            `Start-Sleep -Milliseconds 1200`,
            `try { $ws=$wb.Worksheets.Item(1); $ws.Activate() } catch { try { $ws=$wb.ActiveSheet } catch {} }`,
            `try { $null = $xl.Application.SendKeys('{ESC}', $true) } catch {}`,
            `$ps = $ws.PageSetup`,
            `$ps.Orientation = 2`,
            `$ps.PaperSize = 1`,
            `$ps.Zoom = $null`,
            `$ps.FitToPagesWide = 1`,
            `$ps.FitToPagesTall = 0`,
            `$ps.CenterHorizontally = $true`,
            `try { $xl.CommandBars.ExecuteMso('PrintPreviewAndPrint') } catch {}`
        ].join('; ');

        exec(`powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${psScript}"`, { windowsHide: true }, (automationError) => {
            if (automationError) {
                console.error('Failed to launch Excel print preview:', automationError);
            } else {
                console.log('Excel print preview triggered successfully for', filePath);
            }
        });

        res.json({
            success: true,
            message: 'تم إنشاء ملف Excel وتم فتحه في وضع الطباعة. برجاء مراجعة الإعدادات قبل الطباعة.',
            fileName,
            downloadUrl,
            absoluteUrl,
            recordCount: normalizedRecords.length
        });
    } catch (error) {
        console.error('Error generating export:', error);
        if (error && error.code === 'EXCELJS_MISSING') {
            return res.status(501).json({ error: 'Excel export is not available because exceljs is not installed.' });
        }
        res.status(500).json({ error: 'تعذر إنشاء ملف Excel حالياً.' });
    }
});

router.get('/requests/export/:fileName', (req, res) => {
    try {
        const { fileName } = req.params;
        if (!fileName || !fileName.toLowerCase().endsWith(EXCEL_FILE_EXTENSION)) {
            return res.status(400).json({ error: 'اسم الملف غير صالح.' });
        }

        if (!/^[\w.-]+$/.test(fileName)) {
            return res.status(400).json({ error: 'اسم الملف غير صالح.' });
        }

        const resolvedPath = path.resolve(TMP_DIR, fileName);
        if (!resolvedPath.startsWith(path.resolve(TMP_DIR))) {
            return res.status(400).json({ error: 'اسم الملف غير صالح.' });
        }

        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'الملف غير موجود.' });
        }

        res.download(resolvedPath, fileName, (downloadError) => {
            if (downloadError) {
                console.error('Error sending export file:', downloadError);
                if (!res.headersSent) {
                    res.status(500).end('تعذر تنزيل الملف.');
                }
            }
        });
    } catch (error) {
        console.error('Error handling export download:', error);
        res.status(500).json({ error: 'تعذر تنزيل الملف.' });
    }
});

module.exports = router;
