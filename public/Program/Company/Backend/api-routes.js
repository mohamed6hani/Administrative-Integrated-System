const express = require('express');
const Database = require('./db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
    appDataDir,
    dataSubdir
} = require('../../General/backend/platform-paths');
const deleteApproval = require('../../General/backend/delete-approval-store');
const { logRecordActivity } = require('../../General/backend/activity-record-audit');

const router = express.Router();
const COMPANY_ROOT = path.join(__dirname, '..');
const PUBLIC_BASE_PATH = '/company';
const PDFJS_DIST_DIR = path.dirname(require.resolve('pdfjs-dist/package.json'));

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function publicPath(relativePath) {
    const clean = String(relativePath || '').startsWith('/')
        ? String(relativePath || '')
        : `/${String(relativePath || '')}`;
    return `${PUBLIC_BASE_PATH}${clean}`;
}

function makeSafeFilePart(value, fallback) {
    const safe = String(value || '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .trim();
    return safe || fallback;
}

function deleteFileIfExists(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function normalizeUploadedOriginalName(fileName) {
    const raw = String(fileName || '').trim();
    if (!raw || /[\u0600-\u06FF]/.test(raw)) return raw;

    try {
        const decoded = Buffer.from(raw, 'latin1').toString('utf8').trim();
        if (decoded && decoded !== raw && /[\u0600-\u06FF]/.test(decoded)) {
            return decoded;
        }
    } catch (_) {
    }

    return raw;
}

router.use('/vendor/pdfjs', express.static(PDFJS_DIST_DIR));

// Ensure Data folder exists
const dataDir = appDataDir('Company', {
    legacyDirs: [path.join(COMPANY_ROOT, 'Data')]
});
ensureDir(dataDir);

// Ensure ScannedUpload folder exists
const uploadDir = path.join(dataDir, 'ScannedUpload');
ensureDir(uploadDir);

// Ensure ScannedLisence folder exists
const licenseDir = path.join(dataDir, 'ScannedLisence');
ensureDir(licenseDir);

// Ensure CompaniesUploads folder exists
const companyUploadDir = path.join(dataDir, 'CompaniesUploads');
ensureDir(companyUploadDir);

// Ensure CompaniesGPS folder exists
const gpsUploadDir = path.join(dataDir, 'CompaniesGPS');
ensureDir(gpsUploadDir);

// Ensure CompaniesQRCode folder exists
const qrCodeDir = path.join(dataDir, 'CompaniesQRCode');
ensureDir(qrCodeDir);

// Ensure CompaniesLogo folder exists
const companyLogoDir = path.join(dataDir, 'CompaniesLogo');
ensureDir(companyLogoDir);

// Ensure CompaniesInspection folder exists
const inspectionDir = path.join(dataDir, 'CompaniesInspection');
ensureDir(inspectionDir);

// Ensure CompaniesCars folder exists
const companyCarsDir = path.join(dataDir, 'CompaniesCars');
ensureDir(companyCarsDir);

// Ensure temp upload folder exists
const tempUploadDir = path.join(dataDir, '_tmp_uploads');
ensureDir(tempUploadDir);

const basicAttachmentTypeConfig = {
    company_image: {
        legacyColumn: 'company_image',
        dir: companyUploadDir,
        allowPdf: false,
        buildBaseName: (company) => `${makeSafeFilePart(company.company_name, 'company')}_${makeSafeFilePart(company.license_number, 'license')}`
    },
    licensed_uniform: {
        legacyColumn: 'licensed_uniform',
        dir: uploadDir,
        allowPdf: true,
        buildBaseName: (company) => `${makeSafeFilePart(company.company_name, 'company')}_${company.id}`
    },
    license_image: {
        legacyColumn: 'license_image',
        dir: licenseDir,
        allowPdf: true,
        buildBaseName: (company) => `${makeSafeFilePart(company.license_number, 'license')}_${company.id}`
    },
    company_logo: {
        legacyColumn: 'company_logo',
        dir: companyLogoDir,
        allowPdf: false,
        buildBaseName: (company) => `${makeSafeFilePart(company.company_name, 'company')}_${makeSafeFilePart(company.license_number, 'license')}`
    },
    gps_image: {
        legacyColumn: 'gps_image',
        dir: gpsUploadDir,
        allowPdf: false,
        buildBaseName: (company) => `${makeSafeFilePart(company.company_name, 'company')}_${makeSafeFilePart(company.license_number, 'license')}`
    }
};

// Serve uploaded scans as static files
router.use('/uploads', express.static(uploadDir));
router.use('/license-uploads', express.static(licenseDir));
router.use('/company-uploads', express.static(companyUploadDir));
router.use('/gps-uploads', express.static(gpsUploadDir));
router.use('/qr-uploads', express.static(qrCodeDir));
router.use('/logo-uploads', express.static(companyLogoDir));
router.use('/inspection-uploads', express.static(inspectionDir));
router.use('/car-uploads', express.static(companyCarsDir));

// Configure multer for temporary uploads
const upload = multer({
    dest: tempUploadDir,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|bmp|webp|tiff|pdf|doc|docx|xls|xlsx|txt/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (allowed.test(ext)) cb(null, true);
        else cb(new Error('نوع الملف غير مدعوم'));
    }
});

// Initialize database
const db = new Database(path.join(dataDir, 'Database.db'));

async function startApp() {
// Initialize sql.js engine, then open the database file
await Database.initialize();
db.open();
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL DEFAULT '',
        license_number TEXT NOT NULL DEFAULT '',
        issue_date TEXT DEFAULT '',
        renewal_date TEXT DEFAULT '',
        activity_type TEXT DEFAULT '',
        headquarters_address TEXT DEFAULT '',
        company_image TEXT DEFAULT '',
        company_logo TEXT DEFAULT '',
        gps_image TEXT DEFAULT '',
        gps_link TEXT DEFAULT '',
        licensed_uniform TEXT DEFAULT '',
        license_image TEXT DEFAULT '',
        sector TEXT DEFAULT '',
        station TEXT DEFAULT '',
        total_guards INTEGER DEFAULT 0,
        guarded_locations TEXT DEFAULT '',
        guard_licenses TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        branches TEXT DEFAULT '',
        company_status TEXT DEFAULT 'تعمل',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        committee_name TEXT NOT NULL DEFAULT '',
        committee_license TEXT NOT NULL DEFAULT '',
        committee_renewal TEXT DEFAULT '',
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inspection_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_id INTEGER NOT NULL,
        file_path TEXT NOT NULL DEFAULT '',
        original_name TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS board_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        member_name TEXT NOT NULL DEFAULT '',
        member_role TEXT NOT NULL DEFAULT '',
        member_phone TEXT DEFAULT '',
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS company_cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        car_number TEXT DEFAULT '',
        car_renewal_date TEXT DEFAULT '',
        car_type TEXT DEFAULT '',
        car_image TEXT DEFAULT '',
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS company_basic_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        attachment_type TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL DEFAULT '',
        original_name TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
`);

// Migrate: add member_phone column to board_members if missing
try {
    db.prepare("SELECT member_phone FROM board_members LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE board_members ADD COLUMN member_phone TEXT DEFAULT ''");
}

// Migrate: add license_image column if missing
try {
    db.prepare("SELECT license_image FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN license_image TEXT DEFAULT ''");
}

// Migrate: add company_image column if missing
try {
    db.prepare("SELECT company_image FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN company_image TEXT DEFAULT ''");
}

// Migrate: add company_logo column if missing
try {
    db.prepare("SELECT company_logo FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN company_logo TEXT DEFAULT ''");
}

// Migrate: add gps_image column if missing
try {
    db.prepare("SELECT gps_image FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN gps_image TEXT DEFAULT ''");
}

// Migrate: add gps_link column if missing
try {
    db.prepare("SELECT gps_link FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN gps_link TEXT DEFAULT ''");
}

// Migrate: add sector column if missing
try {
    db.prepare("SELECT sector FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN sector TEXT DEFAULT ''");
}

// Migrate: add station column if missing
try {
    db.prepare("SELECT station FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN station TEXT DEFAULT ''");
}

// Migrate: add notes column if missing
try {
    db.prepare("SELECT notes FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN notes TEXT DEFAULT ''");
}

// Migrate: add branches column if missing
try {
    db.prepare("SELECT branches FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN branches TEXT DEFAULT ''");
}

// Migrate: add company_status column if missing
try {
    db.prepare("SELECT company_status FROM companies LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE companies ADD COLUMN company_status TEXT DEFAULT 'تعمل'");
}

// Migrate: add company_cars columns if missing
try {
    db.prepare("SELECT car_number FROM company_cars LIMIT 1").get();
} catch (e) {
    try { db.exec("ALTER TABLE company_cars ADD COLUMN car_number TEXT DEFAULT ''"); } catch (_) {}
}
try {
    db.prepare("SELECT car_renewal_date FROM company_cars LIMIT 1").get();
} catch (e) {
    try { db.exec("ALTER TABLE company_cars ADD COLUMN car_renewal_date TEXT DEFAULT ''"); } catch (_) {}
}
try {
    db.prepare("SELECT car_type FROM company_cars LIMIT 1").get();
} catch (e) {
    try { db.exec("ALTER TABLE company_cars ADD COLUMN car_type TEXT DEFAULT ''"); } catch (_) {}
}
try {
    db.prepare("SELECT car_image FROM company_cars LIMIT 1").get();
} catch (e) {
    try { db.exec("ALTER TABLE company_cars ADD COLUMN car_image TEXT DEFAULT ''"); } catch (_) {}
}

try {
    db.prepare("SELECT created_at FROM company_basic_attachments LIMIT 1").get();
} catch (e) {
    try { db.exec("ALTER TABLE company_basic_attachments ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (_) {}
}

migrateLegacyBasicAttachments();

return router;
} // end startApp

const startupPromise = startApp().catch(err => {
    console.error('Failed to start:', err);
    throw err;
});

router.use('/api', (req, res, next) => {
    startupPromise.then(() => next()).catch(next);
});

function normalizeCompanyCarsInput(cars) {
    if (!Array.isArray(cars)) return [];

    return cars
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            id: item.id ? Number(item.id) : null,
            car_number: String(item.car_number || '').trim(),
            car_renewal_date: String(item.car_renewal_date || '').trim(),
            car_type: String(item.car_type || '').trim(),
            car_image: String(item.car_image || '').trim()
        }))
        .filter(item => item.car_number || item.car_renewal_date || item.car_type || item.car_image);
}

function deleteCompanyCarImage(fileName) {
    if (!fileName) return;
    deleteFileIfExists(path.join(companyCarsDir, fileName));
}

function syncCompanyCars(companyId, submittedCars) {
    const normalizedCars = normalizeCompanyCarsInput(submittedCars);
    const existingCars = db.prepare('SELECT * FROM company_cars WHERE company_id = ? ORDER BY id').all(companyId);
    const existingById = new Map(existingCars.map(car => [Number(car.id), car]));
    const keptIds = new Set();

    const updateCar = db.prepare(`
        UPDATE company_cars SET
            car_number = ?, car_renewal_date = ?, car_type = ?, car_image = ?
        WHERE id = ? AND company_id = ?
    `);
    const insertCar = db.prepare(`
        INSERT INTO company_cars (company_id, car_number, car_renewal_date, car_type, car_image)
        VALUES (?, ?, ?, ?, ?)
    `);
    const deleteCar = db.prepare('DELETE FROM company_cars WHERE id = ? AND company_id = ?');

    normalizedCars.forEach((car) => {
        if (car.id && existingById.has(car.id)) {
            keptIds.add(car.id);
            updateCar.run(
                car.car_number,
                car.car_renewal_date,
                car.car_type,
                car.car_image,
                car.id,
                companyId
            );
            return;
        }

        insertCar.run(
            companyId,
            car.car_number,
            car.car_renewal_date,
            car.car_type,
            car.car_image
        );
    });

    existingCars.forEach((car) => {
        if (keptIds.has(Number(car.id))) return;
        deleteCompanyCarImage(car.car_image);
        deleteCar.run(car.id, companyId);
    });
}

function getBasicAttachmentConfig(type) {
    return basicAttachmentTypeConfig[type] || null;
}

function getBasicAttachmentPublicBasePath(type) {
    const basePaths = {
        company_image: publicPath('/company-uploads'),
        licensed_uniform: publicPath('/uploads'),
        license_image: publicPath('/license-uploads'),
        company_logo: publicPath('/logo-uploads'),
        gps_image: publicPath('/gps-uploads')
    };
    return basePaths[type] || '';
}

function getBasicAttachmentAbsolutePath(type, fileName) {
    const config = getBasicAttachmentConfig(type);
    if (!config || !fileName) return '';
    return path.join(config.dir, fileName);
}

function buildBasicAttachmentPublicUrl(type, fileName) {
    const basePath = getBasicAttachmentPublicBasePath(type);
    if (!basePath || !fileName) return '';
    return `${basePath}/${encodeURIComponent(fileName)}`;
}

function attachmentIndexToLetters(index) {
    let value = Number(index);
    if (!Number.isFinite(value) || value < 0) return 'a';

    let result = '';
    while (value >= 0) {
        result = String.fromCharCode(97 + (value % 26)) + result;
        value = Math.floor(value / 26) - 1;
    }
    return result;
}

function getBasicAttachmentSuffix(orderIndex) {
    return Number(orderIndex) <= 0 ? '' : `[${attachmentIndexToLetters(orderIndex)}]`;
}

function guessUploadExtension(fileLike) {
    const directExt = path.extname(fileLike?.originalname || fileLike?.file_path || '').toLowerCase();
    if (directExt) return directExt;

    const mime = String(fileLike?.mimetype || '').toLowerCase();
    const mimeExtMap = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/bmp': '.bmp',
        'image/webp': '.webp',
        'image/tiff': '.tiff',
        'application/pdf': '.pdf'
    };
    return mimeExtMap[mime] || '.bin';
}

function buildBasicAttachmentFileName(type, company, orderIndex, fileLike) {
    const config = getBasicAttachmentConfig(type);
    if (!config) return '';
    const extension = guessUploadExtension(fileLike);
    return `${config.buildBaseName(company)}${getBasicAttachmentSuffix(orderIndex)}${extension}`;
}

function mapBasicAttachmentRow(row) {
    return {
        ...row,
        file_url: buildBasicAttachmentPublicUrl(row.attachment_type, row.file_path)
    };
}

function getBasicAttachments(companyId, type = null) {
    const rows = type
        ? db.prepare(`
            SELECT *
            FROM company_basic_attachments
            WHERE company_id = ? AND attachment_type = ?
            ORDER BY sort_order ASC, id ASC
        `).all(companyId, type)
        : db.prepare(`
            SELECT *
            FROM company_basic_attachments
            WHERE company_id = ?
            ORDER BY attachment_type ASC, sort_order ASC, id ASC
        `).all(companyId);

    return rows.map(mapBasicAttachmentRow);
}

function syncLegacyAttachmentColumn(companyId, type, touchUpdatedAt = true) {
    const config = getBasicAttachmentConfig(type);
    if (!config) return;

    const firstAttachment = db.prepare(`
        SELECT file_path
        FROM company_basic_attachments
        WHERE company_id = ? AND attachment_type = ?
        ORDER BY sort_order ASC, id ASC
        LIMIT 1
    `).get(companyId, type);

    const updateSql = touchUpdatedAt
        ? `
            UPDATE companies
            SET ${config.legacyColumn} = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `
        : `
            UPDATE companies
            SET ${config.legacyColumn} = ?
            WHERE id = ?
        `;

    db.prepare(updateSql).run(firstAttachment?.file_path || '', companyId);
}

function migrateLegacyBasicAttachments() {
    const companies = db.prepare(`
        SELECT id, company_name, license_number, company_image, licensed_uniform, license_image, company_logo, gps_image
        FROM companies
        ORDER BY id ASC
    `).all();

    const findExisting = db.prepare(`
        SELECT id
        FROM company_basic_attachments
        WHERE company_id = ? AND attachment_type = ? AND file_path = ?
        LIMIT 1
    `);
    const countByType = db.prepare(`
        SELECT COUNT(*) AS total
        FROM company_basic_attachments
        WHERE company_id = ? AND attachment_type = ?
    `);
    const insertAttachment = db.prepare(`
        INSERT INTO company_basic_attachments (company_id, attachment_type, file_path, original_name, sort_order)
        VALUES (?, ?, ?, ?, ?)
    `);

    companies.forEach((company) => {
        Object.entries(basicAttachmentTypeConfig).forEach(([type, config]) => {
            const filePath = String(company[config.legacyColumn] || '').trim();
            if (!filePath) return;

            const exists = findExisting.get(company.id, type, filePath);
            if (exists) return;

            const nextOrder = Number(countByType.get(company.id, type)?.total || 0);
            insertAttachment.run(company.id, type, filePath, filePath, nextOrder);
        });
    });

    companies.forEach((company) => {
        Object.keys(basicAttachmentTypeConfig).forEach((type) => {
            syncLegacyAttachmentColumn(company.id, type, false);
        });
    });
}

function deleteBasicAttachmentFileByRow(row) {
    deleteFileIfExists(getBasicAttachmentAbsolutePath(row.attachment_type, row.file_path));
}

function clearBasicAttachments(companyId, type) {
    const attachments = db.prepare(`
        SELECT *
        FROM company_basic_attachments
        WHERE company_id = ? AND attachment_type = ?
        ORDER BY sort_order ASC, id ASC
    `).all(companyId, type);

    attachments.forEach(deleteBasicAttachmentFileByRow);
    db.prepare('DELETE FROM company_basic_attachments WHERE company_id = ? AND attachment_type = ?').run(companyId, type);
    syncLegacyAttachmentColumn(companyId, type);
    return [];
}

function renumberBasicAttachments(companyId, type) {
    const config = getBasicAttachmentConfig(type);
    if (!config) return [];

    const company = db.prepare('SELECT id, company_name, license_number FROM companies WHERE id = ?').get(companyId);
    if (!company) return [];

    const attachments = db.prepare(`
        SELECT *
        FROM company_basic_attachments
        WHERE company_id = ? AND attachment_type = ?
        ORDER BY sort_order ASC, id ASC
    `).all(companyId, type);

    if (!attachments.length) {
        syncLegacyAttachmentColumn(companyId, type);
        return [];
    }

    const updateAttachment = db.prepare(`
        UPDATE company_basic_attachments
        SET file_path = ?, sort_order = ?
        WHERE id = ?
    `);

    const tempPrefix = `__tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stagedAttachments = attachments.map((attachment, index) => {
        const tempFileName = `${tempPrefix}_${attachment.id}${guessUploadExtension(attachment)}`;
        const currentPath = getBasicAttachmentAbsolutePath(type, attachment.file_path);
        const tempPath = getBasicAttachmentAbsolutePath(type, tempFileName);

        if (attachment.file_path && fs.existsSync(currentPath)) {
            deleteFileIfExists(tempPath);
            fs.renameSync(currentPath, tempPath);
        }

        updateAttachment.run(tempFileName, index, attachment.id);
        return {
            ...attachment,
            file_path: tempFileName,
            sort_order: index
        };
    });

    stagedAttachments.forEach((attachment, index) => {
        const finalFileName = buildBasicAttachmentFileName(type, company, index, attachment);
        const tempPath = getBasicAttachmentAbsolutePath(type, attachment.file_path);
        const finalPath = getBasicAttachmentAbsolutePath(type, finalFileName);

        if (attachment.file_path && fs.existsSync(tempPath)) {
            deleteFileIfExists(finalPath);
            fs.renameSync(tempPath, finalPath);
        }

        updateAttachment.run(finalFileName, index, attachment.id);
    });

    syncLegacyAttachmentColumn(companyId, type);
    return getBasicAttachments(companyId, type);
}

function isImageUploadFile(file) {
    const mime = String(file?.mimetype || '').toLowerCase();
    const ext = guessUploadExtension(file);
    return mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff'].includes(ext);
}

function isPdfUploadFile(file) {
    const mime = String(file?.mimetype || '').toLowerCase();
    const ext = guessUploadExtension(file);
    return mime === 'application/pdf' || ext === '.pdf';
}

function validateBasicAttachmentUpload(type, file) {
    const config = getBasicAttachmentConfig(type);
    if (!config) return { ok: false, error: 'نوع المرفق غير مدعوم' };

    if (config.allowPdf) {
        if (isImageUploadFile(file) || isPdfUploadFile(file)) {
            return { ok: true };
        }
        return { ok: false, error: 'يُسمح برفع الصور أو ملفات PDF فقط' };
    }

    if (isImageUploadFile(file)) {
        return { ok: true };
    }

    return { ok: false, error: 'يُسمح برفع الصور فقط' };
}

// ===== API Routes =====

// Get all companies (with optional search/filter)
router.get('/api/companies', (req, res) => {
    try {
        const { search_name, search_license, search_sector } = req.query;
        let query = 'SELECT * FROM companies WHERE 1=1';
        const params = [];

        if (search_name && search_name.trim()) {
            query += ' AND company_name LIKE ?';
            params.push(`%${search_name.trim()}%`);
        }
        if (search_license && search_license.trim()) {
            query += ' AND license_number LIKE ?';
            params.push(`%${search_license.trim()}%`);
        }
        if (search_sector && search_sector.trim()) {
            query += ' AND sector = ?';
            params.push(search_sector.trim());
        }

        const { search_status } = req.query;
        if (search_status && search_status.trim()) {
            query += ' AND company_status = ?';
            params.push(search_status.trim());
        }

        query += " ORDER BY CAST(COALESCE(NULLIF(license_number, ''), '0') AS INTEGER) ASC, license_number ASC, id ASC";
        const companies = db.prepare(query).all(...params);
        res.json(companies);
    } catch (err) {
        console.error('Company list failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get single company with board members
router.get('/api/companies/:id', (req, res) => {
    try {
        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const members = db.prepare('SELECT * FROM board_members WHERE company_id = ? ORDER BY id').all(req.params.id);
        const companyCars = db.prepare(`
            SELECT * FROM company_cars
            WHERE company_id = ?
            ORDER BY CAST(COALESCE(NULLIF(car_number, ''), '0') AS INTEGER) ASC, car_number ASC, id ASC
        `).all(req.params.id);
        const basicInfoAttachments = getBasicAttachments(req.params.id);
        const inspections = db.prepare('SELECT * FROM inspections WHERE company_id = ? ORDER BY id').all(req.params.id);
        // Attach files to each inspection
        const getFiles = db.prepare('SELECT * FROM inspection_files WHERE inspection_id = ? ORDER BY id');
        for (const insp of inspections) {
            insp.files = getFiles.all(insp.id);
        }
        res.json({ ...company, board_members: members, company_cars: companyCars, inspections: inspections, basic_info_attachments: basicInfoAttachments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create company
router.post('/api/companies', (req, res) => {
    try {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        validateCompanyUniqueFields(buildCompanyPayload(payload));
        if (deleteApproval.isActionApprovalRequired(req, { programKey: 'company', action: 'add' })) {
            const approval = deleteApproval.createDeleteApprovalRequest(req, {
                action: 'add',
                programKey: 'company',
                programName: 'إدارة شركات الحراسة',
                recordId: payload.license_number || payload.company_name || '',
                recordLabel: payload.company_name || payload.license_number || 'شركة جديدة',
                recordSnapshot: payload,
                operation: {
                    type: 'company.add',
                    action: 'add',
                    record: payload
                }
            });
            return res.status(202).json({
                success: true,
                ok: true,
                approvalRequired: true,
                message: deleteApproval.getApprovalRequiredMessage('add'),
                request: approval.request
            });
        }

        const result = createCompanyRecord(payload);
        logRecordActivity(req, {
            action: 'add',
            programKey: 'company',
            programName: 'إدارة شركات الحراسة',
            recordId: result.id,
            record: { ...payload, id: result.id }
        });
        res.json(result);
    } catch (err) {
        res.status(Number(err?.status) || 500).json({ field: err.field, error: err.message });
    }
});

// Update company
router.put('/api/companies/:id', (req, res) => {
    try {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        validateCompanyUniqueFields(buildCompanyPayload(payload), req.params.id);
        const before = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!before) return res.status(404).json({ error: 'الشركة غير موجودة' });
        if (deleteApproval.isActionApprovalRequired(req, { programKey: 'company', action: 'edit' })) {
            const approval = deleteApproval.createDeleteApprovalRequest(req, {
                action: 'edit',
                programKey: 'company',
                programName: 'إدارة شركات الحراسة',
                recordId: String(req.params.id),
                recordLabel: payload.company_name || before.company_name || `شركة رقم ${req.params.id}`,
                recordSnapshot: {
                    before,
                    after: payload
                },
                operation: {
                    type: 'company.edit',
                    action: 'edit',
                    id: String(req.params.id),
                    updates: payload
                }
            });
            return res.status(202).json({
                success: true,
                ok: true,
                approvalRequired: true,
                message: deleteApproval.getApprovalRequiredMessage('edit'),
                request: approval.request
            });
        }

        const result = updateCompanyRecord(req.params.id, payload);
        logRecordActivity(req, {
            action: 'edit',
            programKey: 'company',
            programName: 'إدارة شركات الحراسة',
            recordId: req.params.id,
            before,
            after: { ...payload, id: req.params.id }
        });
        res.json(result);
    } catch (err) {
        res.status(Number(err?.status) || 500).json({ field: err.field, error: err.message });
    }
});

function getCompanyDeleteSnapshot(companyId) {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!company) return null;
    return {
        company,
        board_members: db.prepare('SELECT * FROM board_members WHERE company_id = ? ORDER BY id').all(companyId),
        company_cars: db.prepare('SELECT * FROM company_cars WHERE company_id = ? ORDER BY id').all(companyId),
        inspections: db.prepare('SELECT * FROM inspections WHERE company_id = ? ORDER BY id').all(companyId)
    };
}

function deleteCompanyById(companyId) {
    const company = db.prepare('SELECT company_name, license_number, licensed_uniform, license_image, company_image, company_logo, gps_image FROM companies WHERE id = ?').get(companyId);
    if (!company) {
        const error = new Error('الشركة غير موجودة');
        error.status = 404;
        throw error;
    }
    const basicAttachments = db.prepare('SELECT * FROM company_basic_attachments WHERE company_id = ?').all(companyId);
    basicAttachments.forEach(deleteBasicAttachmentFileByRow);
    if (company.licensed_uniform) {
        const filePath = path.join(uploadDir, company.licensed_uniform);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (company.license_image) {
        const filePath = path.join(licenseDir, company.license_image);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (company.company_image) {
        const filePath = path.join(companyUploadDir, company.company_image);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (company.company_logo) {
        const filePath = path.join(companyLogoDir, company.company_logo);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (company.gps_image) {
        const filePath = path.join(gpsUploadDir, company.gps_image);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const safeName = ((company.company_name || 'company') + '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
    const safeLicense = ((company.license_number || 'license') + '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
    const qrFile = path.join(qrCodeDir, `${safeName}_${safeLicense}.jpg`);
    if (fs.existsSync(qrFile)) fs.unlinkSync(qrFile);

    const compInspections = db.prepare('SELECT id FROM inspections WHERE company_id = ?').all(companyId);
    const getInspFiles = db.prepare('SELECT file_path FROM inspection_files WHERE inspection_id = ?');
    for (const insp of compInspections) {
        const files = getInspFiles.all(insp.id);
        for (const f of files) {
            const fp = path.join(inspectionDir, f.file_path);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
    }

    const companyCars = db.prepare('SELECT car_image FROM company_cars WHERE company_id = ?').all(companyId);
    for (const car of companyCars) {
        deleteCompanyCarImage(car.car_image);
    }
    const result = db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);
    return { deleted: result.changes || 0, company };
}

deleteApproval.registerDeleteApprovalExecutor('company.delete', (operation) => (
    deleteCompanyById(operation?.id)
));

deleteApproval.registerDeleteApprovalExecutor('company.add', (operation) => (
    createCompanyRecord(operation?.record || {})
));

deleteApproval.registerDeleteApprovalExecutor('company.edit', (operation) => (
    updateCompanyRecord(operation?.id, operation?.updates || {})
));

// Delete company
router.delete('/api/companies/:id', (req, res) => {
    try {
        if (deleteApproval.isDeleteApprovalRequired(req)) {
            const snapshot = getCompanyDeleteSnapshot(req.params.id);
            if (!snapshot) {
                return res.status(404).json({ error: 'الشركة غير موجودة' });
            }
            const approval = deleteApproval.createDeleteApprovalRequest(req, {
                programKey: 'company',
                programName: 'إدارة شركات الحراسة',
                action: 'delete',
                recordId: String(req.params.id),
                recordLabel: snapshot.company.company_name || `شركة رقم ${req.params.id}`,
                recordSnapshot: snapshot,
                operation: {
                    type: 'company.delete',
                    action: 'delete',
                    id: String(req.params.id)
                }
            });
            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: deleteApproval.getApprovalRequiredMessage('delete'),
                request: approval.request
            });
        }
        const result = deleteCompanyById(req.params.id);
        logRecordActivity(req, {
            action: 'delete',
            programKey: 'company',
            programName: 'إدارة شركات الحراسة',
            recordId: req.params.id,
            record: { ...result.company, id: req.params.id }
        });
        res.json({ message: 'Company deleted successfully' });
    } catch (err) {
        res.status(Number(err?.status) || 500).json({ error: err.message });
    }
});

router.post('/api/companies/:id/basic-info-attachments/:type', upload.array('files', 20), (req, res) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const cleanupTempFiles = () => uploadedFiles.forEach(file => deleteFileIfExists(file.path));

    try {
        const { id, type } = req.params;
        const config = getBasicAttachmentConfig(type);
        if (!config) {
            cleanupTempFiles();
            return res.status(400).json({ error: 'نوع المرفق غير مدعوم' });
        }

        if (!uploadedFiles.length) {
            return res.status(400).json({ error: 'لا توجد ملفات مرفوعة' });
        }

        const company = db.prepare('SELECT id, company_name, license_number FROM companies WHERE id = ?').get(id);
        if (!company) {
            cleanupTempFiles();
            return res.status(404).json({ error: 'Company not found' });
        }

        for (const file of uploadedFiles) {
            const validation = validateBasicAttachmentUpload(type, file);
            if (!validation.ok) {
                cleanupTempFiles();
                return res.status(400).json({ error: validation.error });
            }
        }

        const countExisting = db.prepare(`
            SELECT COUNT(*) AS total
            FROM company_basic_attachments
            WHERE company_id = ? AND attachment_type = ?
        `);
        const insertAttachment = db.prepare(`
            INSERT INTO company_basic_attachments (company_id, attachment_type, file_path, original_name, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `);

        const createdFiles = [];
        const createdIds = [];

        try {
            let nextOrder = Number(countExisting.get(id, type)?.total || 0);

            uploadedFiles.forEach((file) => {
                const fileName = buildBasicAttachmentFileName(type, company, nextOrder, file);
                const targetPath = getBasicAttachmentAbsolutePath(type, fileName);
                deleteFileIfExists(targetPath);
                fs.renameSync(file.path, targetPath);
                createdFiles.push(targetPath);

                const result = insertAttachment.run(
                    id,
                    type,
                    fileName,
                    normalizeUploadedOriginalName(file.originalname || fileName),
                    nextOrder
                );
                createdIds.push(result.lastInsertRowid);
                nextOrder += 1;
            });
        } catch (err) {
            createdIds.forEach((attachmentId) => {
                db.prepare('DELETE FROM company_basic_attachments WHERE id = ?').run(attachmentId);
            });
            createdFiles.forEach(deleteFileIfExists);
            cleanupTempFiles();
            throw err;
        }

        syncLegacyAttachmentColumn(id, type);
        res.json({
            attachments: getBasicAttachments(id, type),
            message: 'تم رفع المرفقات بنجاح'
        });
    } catch (err) {
        cleanupTempFiles();
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/basic-info-attachments/:id', (req, res) => {
    try {
        const attachment = db.prepare('SELECT * FROM company_basic_attachments WHERE id = ?').get(req.params.id);
        if (!attachment) {
            return res.status(404).json({ error: 'المرفق غير موجود' });
        }

        deleteBasicAttachmentFileByRow(attachment);
        db.prepare('DELETE FROM company_basic_attachments WHERE id = ?').run(req.params.id);
        const attachments = renumberBasicAttachments(attachment.company_id, attachment.attachment_type);

        res.json({
            attachments,
            message: 'تم حذف المرفق بنجاح'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Upload company image =====
router.post('/api/companies/:id/company-image', upload.single('company_image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'يُسمح برفع الصور فقط' });
        }

        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!company) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Company not found' });
        }

        if (company.company_image) {
            const oldPath = path.join(companyUploadDir, company.company_image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const safeName = (company.company_name || 'company')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const safeLicense = (company.license_number || 'license')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const newFileName = `${safeName}_${safeLicense}.jpg`;
        const newPath = path.join(companyUploadDir, newFileName);

        fs.renameSync(req.file.path, newPath);

        db.prepare('UPDATE companies SET company_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newFileName, req.params.id);

        res.json({ filename: newFileName, message: 'Company image uploaded successfully' });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// Delete company image
router.delete('/api/companies/:id/company-image', (req, res) => {
    try {
        const company = db.prepare('SELECT company_image FROM companies WHERE id = ?').get(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.company_image) {
            const filePath = path.join(companyUploadDir, company.company_image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.prepare("UPDATE companies SET company_image = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(req.params.id);

        res.json({ message: 'Company image deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Upload company logo =====
router.post('/api/companies/:id/company-logo', upload.single('company_logo'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'يُسمح برفع الصور فقط' });
        }

        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!company) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Company not found' });
        }

        if (company.company_logo) {
            const oldPath = path.join(companyLogoDir, company.company_logo);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const safeName = (company.company_name || 'company')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const safeLicense = (company.license_number || 'license')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const newFileName = `${safeName}_${safeLicense}.jpg`;
        const newPath = path.join(companyLogoDir, newFileName);

        fs.renameSync(req.file.path, newPath);

        db.prepare('UPDATE companies SET company_logo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newFileName, req.params.id);

        res.json({ filename: newFileName, message: 'Company logo uploaded successfully' });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// Delete company logo
router.delete('/api/companies/:id/company-logo', (req, res) => {
    try {
        const company = db.prepare('SELECT company_logo FROM companies WHERE id = ?').get(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.company_logo) {
            const filePath = path.join(companyLogoDir, company.company_logo);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.prepare("UPDATE companies SET company_logo = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(req.params.id);

        res.json({ message: 'Company logo deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Upload GPS image =====
router.post('/api/companies/:id/gps-image', upload.single('gps_image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'يُسمح برفع الصور فقط' });
        }

        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!company) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Company not found' });
        }

        if (company.gps_image) {
            const oldPath = path.join(gpsUploadDir, company.gps_image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const safeName = (company.company_name || 'company')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const safeLicense = (company.license_number || 'license')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const newFileName = `${safeName}_${safeLicense}.jpg`;
        const newPath = path.join(gpsUploadDir, newFileName);

        fs.renameSync(req.file.path, newPath);

        db.prepare('UPDATE companies SET gps_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newFileName, req.params.id);

        res.json({ filename: newFileName, message: 'GPS image uploaded successfully' });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// Delete GPS image
router.delete('/api/companies/:id/gps-image', (req, res) => {
    try {
        const company = db.prepare('SELECT gps_image FROM companies WHERE id = ?').get(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.gps_image) {
            const filePath = path.join(gpsUploadDir, company.gps_image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.prepare("UPDATE companies SET gps_image = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(req.params.id);

        res.json({ message: 'GPS image deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Save QR code image =====
router.post('/api/companies/:id/qr-code', upload.single('qr_image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!company) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Company not found' });
        }

        const safeName = (company.company_name || 'company')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const safeLicense = (company.license_number || 'license')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
        const newFileName = `${safeName}_${safeLicense}.jpg`;
        const newPath = path.join(qrCodeDir, newFileName);
        const gpsPath = path.join(gpsUploadDir, newFileName);

        // Replace existing QR file
        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

        // Replace existing GPS image file (QR should become the selected GPS image)
        if (company.gps_image) {
            const oldGpsPath = path.join(gpsUploadDir, company.gps_image);
            if (fs.existsSync(oldGpsPath)) fs.unlinkSync(oldGpsPath);
        }
        if (fs.existsSync(gpsPath)) fs.unlinkSync(gpsPath);

        fs.renameSync(req.file.path, newPath);

        // Keep a copy in GPS images so the QR becomes the displayed image in موقع الحراسة
        fs.copyFileSync(newPath, gpsPath);

        db.prepare('UPDATE companies SET gps_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newFileName, req.params.id);

        res.json({ filename: newFileName, message: 'QR code saved successfully' });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// ===== Upload uniform scan =====
router.post('/api/companies/:id/uniform', upload.single('uniform'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!company) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Company not found' });
        }

        // Delete old file if exists
        if (company.licensed_uniform) {
            const oldPath = path.join(uploadDir, company.licensed_uniform);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        // Build new filename: companyName_id.ext
        const ext = path.extname(req.file.originalname).toLowerCase();
        const safeName = (company.company_name || 'company').replace(/[\\/:*?"<>|]/g, '_').trim();
        const newFileName = `${safeName}_${company.id}${ext}`;
        const newPath = path.join(uploadDir, newFileName);

        // Move from temp to ScannedUpload
        fs.renameSync(req.file.path, newPath);

        // Update DB
        db.prepare('UPDATE companies SET licensed_uniform = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newFileName, req.params.id);

        res.json({ filename: newFileName, message: 'Uniform scan uploaded successfully' });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// Delete uniform scan
router.delete('/api/companies/:id/uniform', (req, res) => {
    try {
        const company = db.prepare('SELECT licensed_uniform FROM companies WHERE id = ?').get(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.licensed_uniform) {
            const filePath = path.join(uploadDir, company.licensed_uniform);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.prepare("UPDATE companies SET licensed_uniform = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(req.params.id);

        res.json({ message: 'Uniform scan deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Upload license image =====
router.post('/api/companies/:id/license-image', upload.single('license_image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
        if (!company) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Company not found' });
        }

        // Delete old file if exists
        if (company.license_image) {
            const oldPath = path.join(licenseDir, company.license_image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        // Build new filename: licenseNumber_id.ext
        const ext = path.extname(req.file.originalname).toLowerCase();
        const safeLicense = (company.license_number || 'license').replace(/[\\/:*?"<>|]/g, '_').trim();
        const newFileName = `${safeLicense}_${company.id}${ext}`;
        const newPath = path.join(licenseDir, newFileName);

        // Move from temp to ScannedLisence
        fs.renameSync(req.file.path, newPath);

        // Update DB
        db.prepare('UPDATE companies SET license_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newFileName, req.params.id);

        res.json({ filename: newFileName, message: 'License image uploaded successfully' });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// Delete license image
router.delete('/api/companies/:id/license-image', (req, res) => {
    try {
        const company = db.prepare('SELECT license_image FROM companies WHERE id = ?').get(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.license_image) {
            const filePath = path.join(licenseDir, company.license_image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.prepare("UPDATE companies SET license_image = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(req.params.id);

        res.json({ message: 'License image deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Company Cars Images =====
router.post('/api/company-cars/:id/image', upload.single('car_image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
            deleteFileIfExists(req.file.path);
            return res.status(400).json({ error: 'يُسمح برفع الصور فقط' });
        }

        const companyCar = db.prepare(`
            SELECT cc.*, c.company_name, c.license_number
            FROM company_cars cc
            JOIN companies c ON c.id = cc.company_id
            WHERE cc.id = ?
        `).get(req.params.id);

        if (!companyCar) {
            deleteFileIfExists(req.file.path);
            return res.status(404).json({ error: 'السيارة غير موجودة' });
        }

        deleteCompanyCarImage(companyCar.car_image);

        const safeCompanyName = makeSafeFilePart(req.body.company_name || companyCar.company_name, 'company');
        const safeCarNumber = makeSafeFilePart(req.body.car_number || companyCar.car_number, 'car');
        const safeLicenseNumber = makeSafeFilePart(req.body.license_number || companyCar.license_number, 'license');
        const newFileName = `${safeCompanyName}_${safeCarNumber}_${safeLicenseNumber}.jpg`;
        const newPath = path.join(companyCarsDir, newFileName);

        deleteFileIfExists(newPath);
        fs.renameSync(req.file.path, newPath);

        db.prepare('UPDATE company_cars SET car_image = ? WHERE id = ?')
            .run(newFileName, req.params.id);

        res.json({ filename: newFileName, message: 'Company car image uploaded successfully' });
    } catch (err) {
        if (req.file) deleteFileIfExists(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/company-cars/:id/image', (req, res) => {
    try {
        const companyCar = db.prepare('SELECT car_image FROM company_cars WHERE id = ?').get(req.params.id);
        if (!companyCar) return res.status(404).json({ error: 'السيارة غير موجودة' });

        deleteCompanyCarImage(companyCar.car_image);

        db.prepare("UPDATE company_cars SET car_image = '' WHERE id = ?")
            .run(req.params.id);

        res.json({ message: 'Company car image deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Inspections CRUD =====

// Add inspection row
router.post('/api/companies/:id/inspections', (req, res) => {
    try {
        const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const { committee_name, committee_license, committee_renewal } = req.body;
        const result = db.prepare(
            'INSERT INTO inspections (company_id, committee_name, committee_license, committee_renewal) VALUES (?, ?, ?, ?)'
        ).run(req.params.id, committee_name || '', committee_license || '', committee_renewal || '');

        res.json({ id: result.lastInsertRowid, message: 'Inspection added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update inspection row
router.put('/api/inspections/:id', (req, res) => {
    try {
        const { committee_name, committee_license, committee_renewal } = req.body;
        db.prepare(
            'UPDATE inspections SET committee_name = ?, committee_license = ?, committee_renewal = ? WHERE id = ?'
        ).run(committee_name || '', committee_license || '', committee_renewal || '', req.params.id);
        res.json({ message: 'Inspection updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete inspection row (and its files from disk)
router.delete('/api/inspections/:id', (req, res) => {
    try {
        const files = db.prepare('SELECT file_path FROM inspection_files WHERE inspection_id = ?').all(req.params.id);
        for (const f of files) {
            const fp = path.join(inspectionDir, f.file_path);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
        res.json({ message: 'Inspection deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload files to an inspection (multiple files)
router.post('/api/inspections/:id/files', upload.array('files', 20), (req, res) => {
    try {
        const inspection = db.prepare('SELECT i.*, c.company_name, c.license_number FROM inspections i JOIN companies c ON i.company_id = c.id WHERE i.id = ?').get(req.params.id);
        if (!inspection) {
            (req.files || []).forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
            return res.status(404).json({ error: 'Inspection not found' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const safeName = (inspection.company_name || 'company').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
        const safeCommittee = (inspection.committee_name || 'inspection').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
        const safeLicense = (inspection.license_number || 'license').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();

        // Count existing files to determine numbering
        const existingCount = db.prepare('SELECT COUNT(*) as cnt FROM inspection_files WHERE inspection_id = ?').get(req.params.id).cnt;

        const insertFile = db.prepare('INSERT INTO inspection_files (inspection_id, file_path, original_name) VALUES (?, ?, ?)');
        const savedFiles = [];

        req.files.forEach((file, idx) => {
            const fileNum = existingCount + idx + 1;
            const ext = path.extname(file.originalname).toLowerCase();
            const newFileName = `${safeName}_${safeCommittee}_${safeLicense}_${fileNum}${ext}`;
            const newPath = path.join(inspectionDir, newFileName);
            const normalizedOriginalName = normalizeUploadedOriginalName(file.originalname);

            fs.renameSync(file.path, newPath);
            insertFile.run(req.params.id, newFileName, normalizedOriginalName);
            savedFiles.push({ file_path: newFileName, original_name: normalizedOriginalName });
        });

        // Return all files for this inspection
        const allFiles = db.prepare('SELECT * FROM inspection_files WHERE inspection_id = ? ORDER BY id').all(req.params.id);
        res.json({ files: allFiles, message: 'Files uploaded successfully' });
    } catch (err) {
        (req.files || []).forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
        res.status(500).json({ error: err.message });
    }
});

// Delete a single inspection file
router.delete('/api/inspection-files/:id', (req, res) => {
    try {
        const file = db.prepare('SELECT * FROM inspection_files WHERE id = ?').get(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const fp = path.join(inspectionDir, file.file_path);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);

        db.prepare('DELETE FROM inspection_files WHERE id = ?').run(req.params.id);
        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ensure tmp folder exists
const tmpDir = dataSubdir('Company', 'tmp', {
    legacyDirs: [path.join(COMPANY_ROOT, 'tmp')]
});
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
}

function clearDirectoryContents(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(fullPath);
        }
    }
}

function buildCompanyPayload(body = {}) {
    const {
        company_name, license_number, issue_date, renewal_date,
        activity_type, headquarters_address, licensed_uniform,
        sector, station,
        total_guards, guarded_locations, guard_licenses,
        notes, branches, company_status, gps_link,
        company_cars,
        board_members
    } = body || {};
    return {
        company_name, license_number, issue_date, renewal_date,
        activity_type, headquarters_address, licensed_uniform,
        sector, station,
        total_guards, guarded_locations, guard_licenses,
        notes, branches, company_status, gps_link,
        company_cars,
        board_members
    };
}

function createHttpError(status, message, extra = {}) {
    const error = new Error(message);
    error.status = status;
    Object.assign(error, extra);
    return error;
}

function validateCompanyUniqueFields(payload, ignoreId = null) {
    const companyNameNorm = (payload.company_name || '').trim();
    const licenseNumberNorm = (payload.license_number || '').trim();
    const sectorNorm = (payload.sector || '').trim();

    if (companyNameNorm) {
        const existsByName = ignoreId == null
            ? db.prepare('SELECT id FROM companies WHERE company_name = ? LIMIT 1').get(companyNameNorm)
            : db.prepare('SELECT id FROM companies WHERE company_name = ? AND id != ? LIMIT 1').get(companyNameNorm, ignoreId);
        if (existsByName) {
            throw createHttpError(409, 'اسم الشركة مضاف بالفعل', { field: 'company_name' });
        }
    }

    if (licenseNumberNorm) {
        const existsByLicense = ignoreId == null
            ? db.prepare('SELECT id FROM companies WHERE license_number = ? AND COALESCE(sector, \'\') = ? LIMIT 1').get(licenseNumberNorm, sectorNorm)
            : db.prepare('SELECT id FROM companies WHERE license_number = ? AND COALESCE(sector, \'\') = ? AND id != ? LIMIT 1').get(licenseNumberNorm, sectorNorm, ignoreId);
        if (existsByLicense) {
            throw createHttpError(409, 'هذه الرخصة مضافة بالفعل داخل نفس القطاع', { field: 'license_number' });
        }
    }
}

function createCompanyRecord(body = {}) {
    const payload = buildCompanyPayload(body);
    validateCompanyUniqueFields(payload);

    const insert = db.prepare(`
        INSERT INTO companies (company_name, license_number, issue_date, renewal_date,
            activity_type, headquarters_address, licensed_uniform,
            sector, station,
            total_guards, guarded_locations, guard_licenses,
            notes, branches, company_status, gps_link)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
        payload.company_name || '', payload.license_number || '', payload.issue_date || '', payload.renewal_date || '',
        payload.activity_type || '', payload.headquarters_address || '', payload.licensed_uniform || '',
        payload.sector || '', payload.station || '',
        payload.total_guards || 0, payload.guarded_locations || '', payload.guard_licenses || '',
        payload.notes || '', payload.branches || '', payload.company_status || 'تعمل',
        payload.gps_link || ''
    );

    const companyId = result.lastInsertRowid;

    if (payload.board_members && payload.board_members.length > 0) {
        const insertMember = db.prepare('INSERT INTO board_members (company_id, member_name, member_role, member_phone) VALUES (?, ?, ?, ?)');
        for (const member of payload.board_members) {
            insertMember.run(companyId, member.member_name || '', member.member_role || '', member.member_phone || '');
        }
    }

    if (Array.isArray(payload.company_cars)) {
        syncCompanyCars(companyId, payload.company_cars);
    }

    return { id: companyId, message: 'Company created successfully' };
}

function updateCompanyRecord(companyId, body = {}) {
    const payload = buildCompanyPayload(body);
    validateCompanyUniqueFields(payload, companyId);

    const update = db.prepare(`
        UPDATE companies SET
            company_name = ?, license_number = ?, issue_date = ?, renewal_date = ?,
            activity_type = ?, headquarters_address = ?,
            sector = ?, station = ?,
            total_guards = ?, guarded_locations = ?, guard_licenses = ?,
            notes = ?, branches = ?, company_status = ?, gps_link = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const result = update.run(
        payload.company_name || '', payload.license_number || '', payload.issue_date || '', payload.renewal_date || '',
        payload.activity_type || '', payload.headquarters_address || '',
        payload.sector || '', payload.station || '',
        payload.total_guards || 0, payload.guarded_locations || '', payload.guard_licenses || '',
        payload.notes || '', payload.branches || '', payload.company_status || 'تعمل', payload.gps_link || '',
        companyId
    );

    if (!result.changes) {
        throw createHttpError(404, 'الشركة غير موجودة');
    }

    db.prepare('DELETE FROM board_members WHERE company_id = ?').run(companyId);
    if (payload.board_members && payload.board_members.length > 0) {
        const insertMember = db.prepare('INSERT INTO board_members (company_id, member_name, member_role, member_phone) VALUES (?, ?, ?, ?)');
        for (const member of payload.board_members) {
            insertMember.run(companyId, member.member_name || '', member.member_role || '', member.member_phone || '');
        }
    }

    if (Array.isArray(payload.company_cars)) {
        syncCompanyCars(companyId, payload.company_cars);
    }

    return { message: 'Company updated successfully' };
}

router.post('/api/exit-app', (req, res) => {
    try {
        clearDirectoryContents(tmpDir);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    return res.json({
        success: true,
        message: 'Company app exit handled by the platform.',
        redirect: '/dashboard'
    });
});

module.exports = router;
module.exports.startupPromise = startupPromise;
module.exports.seedDemoCompany = async () => {
    await startupPromise;
    if (db.prepare('SELECT COUNT(*) AS count FROM companies').get().count) return;
    db.prepare('INSERT INTO companies (company_name, license_number, headquarters_address, activity_type, sector, station, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run('شركة تجريبية', 'DEMO-CO-1', 'عنوان تجريبي غير حقيقي', 'نشاط تجريبي', 'شرق', 'مكتب تجريبي 01', 'DEMO ONLY — wholly fictional administrative record');
};


