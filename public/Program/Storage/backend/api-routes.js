const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  appDataDir
} = require('../../General/backend/platform-paths');
const {
  MAX_UPLOAD_BYTES,
  createStorageError,
  createStorageService,
  isAllowedUploadName,
  stripAbsolutePath
} = require('./storage-service');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getAuth(req) {
  const auth = req.portalAuth || {};
  const user = auth.user || req.portalUser || null;
  return { token: auth.token || '', user };
}

function safeRecord(record) {
  return stripAbsolutePath(record);
}

function safeRecords(records) {
  return Array.isArray(records) ? records.map(safeRecord).filter(Boolean) : [];
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getUploadedFiles(req) {
  const files = [];
  const grouped = req && req.files && typeof req.files === 'object' ? req.files : {};
  if (Array.isArray(grouped.files)) files.push(...grouped.files);
  if (Array.isArray(grouped.file)) files.push(...grouped.file);
  if (req && req.file) files.push(req.file);
  return files.filter(Boolean);
}

function cleanupUploadedFiles(files) {
  files.forEach((file) => {
    if (!file || !file.path) return;
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (_) {}
  });
}

function getBatchBody(body, fileTitles, sourcePaths, index) {
  const nextBody = { ...(body || {}) };
  if (fileTitles[index] !== undefined) nextBody.title = fileTitles[index];
  if (sourcePaths[index]) nextBody.sourcePath = sourcePaths[index];
  return nextBody;
}

function getMetadataPatch(body) {
  const patch = {};
  ['title', 'description', 'tags', 'visibility', 'availabilitySector', 'availabilitySectors', 'availabilityStation', 'folderId'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) patch[key] = body[key];
  });
  return patch;
}

function hasMetadataPatch(body) {
  return Object.keys(getMetadataPatch(body)).length > 0;
}

function getInlineDisposition(fileName) {
  const name = path.basename(String(fileName || 'preview'));
  const fallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'preview';
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const shutdownServices = new Set();
let shutdownHookInstalled = false;

function registerShutdownHook(service) {
  shutdownServices.add(service);
  if (shutdownHookInstalled) return;
  shutdownHookInstalled = true;
  const closeAll = () => {
    shutdownServices.forEach((instance) => {
      try {
        instance.close();
      } catch (_) {}
    });
  };
  process.once('SIGINT', closeAll);
  process.once('SIGTERM', closeAll);
  process.once('exit', closeAll);
}

function createStorageRouter(expressInput, platform = {}) {
  const express = expressInput || require('express');
  const router = express.Router();
  const storageRoot = path.join(__dirname, '..');
  const dataDir = appDataDir('Storage', {
    legacyDirs: [path.join(storageRoot, 'Data')]
  });
  const tempUploadDir = path.join(dataDir, '_tmp_uploads');
  ensureDir(tempUploadDir);

  const service = createStorageService({ dataDir });
  let servicePromise = null;

  function ensureService() {
    if (!servicePromise) servicePromise = service.initialize();
    return servicePromise;
  }

  const maintenanceTimer = setInterval(() => {
    if (!servicePromise) return;
    servicePromise.then(() => service.runMaintenance()).catch(() => {});
  }, 6 * 60 * 60 * 1000);
  if (typeof maintenanceTimer.unref === 'function') maintenanceTimer.unref();
  registerShutdownHook(service);

  function logStorageEvent(req, eventType, message, details = {}) {
    const auth = getAuth(req);
    if (typeof platform.logActivityEvent !== 'function' || !auth.user) return;
    platform.logActivityEvent({
      user: auth.user,
      token: auth.token,
      source: 'server',
      eventType,
      message,
      context: {
        programKey: 'storage',
        path: req.originalUrl || req.url,
        pageName: 'التخزين الموحد'
      },
      details
    });
  }

  const upload = multer({
    dest: tempUploadDir,
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (req, file, cb) => {
      if (isAllowedUploadName(file.originalname)) {
        cb(null, true);
        return;
      }
      cb(createStorageError('نوع الملف غير مدعوم', 400, 'unsupported_file_type'));
    }
  });

  function runUpload(req, res, next) {
    upload.fields([
      { name: 'files', maxCount: 100 },
      { name: 'file', maxCount: 1 }
    ])(req, res, (error) => {
      if (error) return next(error);
      return next();
    });
  }

  router.use(express.json({ limit: '1mb' }));

  router.get('/stats', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const stats = await service.getStats(auth.user);
      res.json({
        success: true,
        stats: {
          ...stats,
          latest: safeRecords(stats.latest)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/files', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const result = await service.listFiles({
        user: auth.user,
        scope: req.query.scope,
        query: req.query.query,
        visibility: req.query.visibility,
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset
      });
      res.json({
        success: true,
        count: result.count,
        total: result.total,
        files: safeRecords(result.files)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/folders', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const result = await service.listFolders({
        user: auth.user,
        scope: req.query.scope,
        status: req.query.status
      });
      res.json({
        success: true,
        count: result.count,
        folders: result.folders
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/folders', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const folder = await service.createFolder(req.body || {}, auth.user);
      logStorageEvent(req, 'storage:folder-create', 'تم إنشاء مجلد في التخزين الموحد', {
        folderId: folder.id,
        name: folder.name
      });
      res.status(201).json({ success: true, folder });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/folders/:id', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const folder = await service.updateFolder(req.params.id, req.body || {}, auth.user);
      logStorageEvent(req, 'storage:folder-update', 'تم تعديل مجلد في التخزين الموحد', {
        folderId: folder.id,
        name: folder.name
      });
      res.json({ success: true, folder });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/folders/:id', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const folder = await service.deleteFolder(req.params.id, req.body || {}, auth.user);
      logStorageEvent(req, 'storage:folder-delete', 'تم حذف مجلد من التخزين الموحد', {
        folderId: folder.id,
        name: folder.name,
        mode: req.body && req.body.mode || ''
      });
      res.json({ success: true, folder });
    } catch (error) {
      next(error);
    }
  });
  router.post('/files', runUpload, async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const body = req.body || {};
      const uploadedFiles = getUploadedFiles(req);
      if (!uploadedFiles.length) throw createStorageError('No file uploaded', 400, 'missing_file');
      const fileTitles = parseJsonArray(body.fileTitles);
      const sourcePaths = parseJsonArray(body.sourcePaths);
      const records = [];
      for (let index = 0; index < uploadedFiles.length; index += 1) {
        records.push(await service.createFileFromUpload({
          file: uploadedFiles[index],
          body: getBatchBody(body, fileTitles, sourcePaths, index),
          user: auth.user
        }));
      }
      const firstRecord = records[0];
      logStorageEvent(req, 'storage:upload', 'تم رفع ملف إلى التخزين الموحد', {
        fileId: firstRecord.id,
        name: firstRecord.originalName,
        count: records.length,
        visibility: firstRecord.visibility,
        size: records.reduce((total, record) => total + Number(record.size || 0), 0)
      });
      res.status(201).json({
        success: true,
        file: safeRecord(firstRecord),
        files: safeRecords(records),
        count: records.length
      });
    } catch (error) {
      cleanupUploadedFiles(getUploadedFiles(req));
      next(error);
    }
  });

  router.get('/files/:id/preview', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const record = await service.getFileForDownload(req.params.id, auth.user);
      logStorageEvent(req, 'storage:preview', 'تمت معاينة ملف من التخزين الموحد', {
        fileId: record.id,
        name: record.originalName,
        visibility: record.visibility
      });
      res.set('Content-Disposition', getInlineDisposition(record.originalName));
      res.sendFile(record.absolutePath);
    } catch (error) {
      next(error);
    }
  });

  router.get('/files/:id/download', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const record = await service.getFileForDownload(req.params.id, auth.user);
      logStorageEvent(req, 'storage:download', 'تم تنزيل ملف من التخزين الموحد', {
        fileId: record.id,
        name: record.originalName,
        visibility: record.visibility
      });
      res.download(record.absolutePath, record.originalName);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/files/:id', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const body = req.body || {};
      const requestedStatus = String(body.status || '').trim().toLowerCase();
      let record = null;

      if (requestedStatus === 'archived') {
        record = await service.archiveFile(req.params.id, auth.user);
        logStorageEvent(req, 'storage:archive', 'تم أرشفة ملف في التخزين الموحد', {
          fileId: record.id,
          name: record.originalName
        });
      } else if (requestedStatus === 'active') {
        record = await service.restoreFile(req.params.id, auth.user);
        logStorageEvent(req, 'storage:restore', 'تم استعادة ملف في التخزين الموحد', {
          fileId: record.id,
          name: record.originalName
        });
      }

      if (hasMetadataPatch(body)) {
        const visibilityWasRequested = Object.prototype.hasOwnProperty.call(body, 'visibility');
        record = await service.updateFile(req.params.id, getMetadataPatch(body), auth.user);
        const eventType = visibilityWasRequested
          ? 'storage:visibility-change'
          : 'storage:update';
        logStorageEvent(req, eventType, 'تم تحديث بيانات ملف في التخزين الموحد', {
          fileId: record.id,
          name: record.originalName,
          visibility: record.visibility
        });
      }

      if (!record) {
        throw createStorageError('لم يتم إرسال أي تعديل صالح', 400, 'empty_patch');
      }

      res.json({ success: true, file: safeRecord(record) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/files/:id', async (req, res, next) => {
    try {
      await ensureService();
      const auth = getAuth(req);
      const record = await service.deleteFile(req.params.id, auth.user);
      const purged = Boolean(record && record.purged);
      logStorageEvent(req, purged ? 'storage:purge' : 'storage:delete', purged
        ? 'تم حذف ملف نهائياً من التخزين الموحد'
        : 'تم نقل ملف إلى محذوفات التخزين الموحد', {
        fileId: record.id,
        name: record.originalName
      });
      res.json({ success: true, purged, file: safeRecord(record) });
    } catch (error) {
      next(error);
    }
  });

  router.disposeStorageService = () => {
    clearInterval(maintenanceTimer);
    shutdownServices.delete(service);
    service.close();
  };

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const statusCode = error && error.code === 'LIMIT_FILE_SIZE'
      ? 413
      : Number(error && error.statusCode) || 500;
    const message = error && error.code === 'LIMIT_FILE_SIZE'
      ? 'حجم الملف أكبر من الحد المسموح'
      : (error && error.message) || 'تعذر تنفيذ عملية التخزين';
    res.status(statusCode).json({
      success: false,
      code: error && error.code || 'storage_error',
      message
    });
  });

  return router;
}

module.exports = createStorageRouter;
