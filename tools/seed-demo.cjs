const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { appDataDir, dataFile, DATA_ROOT } = require('../public/Program/General/backend/platform-paths');
const { makeDemoAccounts } = require('../public/Program/General/backend/demo-accounts');

const DEMO_NOTE = 'DEMO ONLY — wholly fictional administrative record';

function writeNewJson(moduleName, filename, value) {
  const destination = dataFile(moduleName, filename);
  if (fs.existsSync(destination)) return;
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeNewCsv(moduleName, filename, headers, rows) {
  const destination = dataFile(moduleName, filename);
  if (fs.existsSync(destination)) return;
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  fs.writeFileSync(destination, '\ufeff' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\n') + '\n', 'utf8');
}

async function seedDemo() {
  const accounts = makeDemoAccounts();
  writeNewJson('General', 'users.json', { version: 1, updatedAt: '2026-01-01T00:00:00.000Z', users: accounts });
  require('../public/Program/General/backend/reference-data-store').loadReferenceData();

  const { createWeaponsSqlStore } = require('../public/Program/Weapons/backend/sql-store');
  const weaponDirectory = appDataDir('Weapons');
  const weapons = createWeaponsSqlStore({ dbPath: path.join(weaponDirectory, 'weapons.sqlite'), csvPath: path.join(weaponDirectory, 'slah.csv') });
  if (weapons.getStats().totalRows === 0) {
    for (let i = 1; i <= 3; i++) {
      weapons.appendRecordObject({ license_number: `DEMO-LIC-${i}`, license_type: 'دفاع', name: `سجل تجريبي ${i}`, address: 'عنوان تجريبي غير حقيقي', weapon_details: `DEMO-ASSET-${i}`, station: i === 1 ? 'مكتب تجريبي 01' : 'مكتب تجريبي 11', sector: i === 1 ? 'شرق' : 'غرب', pieces_count: '1', cancel_decision_date: '2026-01-01', cancel_reason: 'اختبار تجريبي', notes: DEMO_NOTE });
    }
  }

  writeNewCsv('Renewal', 'tagdeed.csv', ['رقم الرخصة', 'نوع الرخصة', 'الاســـــــم', 'قطاع', 'القسم', 'التجديد', 'ملاحظـــات', 'صورة', 'اجراءات'], [
    ['DEMO-RENEW-1', 'دفاع', 'سجل تجريبي 11', 'شرق', 'مكتب تجريبي 01', '2026', DEMO_NOTE, '', ''],
    ['DEMO-RENEW-2', 'دفاع', 'سجل تجريبي 12', 'غرب', 'مكتب تجريبي 11', '2026', DEMO_NOTE, '', '']
  ]);

  const reportHeaders = ['رقم القرار', 'تاريخ القرار', 'الاسم', 'الوظيفة', 'نوع الترخيص', 'نوع السلاح', 'الغرض', 'القطاع', 'قسم الشرطة', 'قرار مدير الامن', 'قرار امن العام', 'توصية'];
  for (const [index, filename] of ['decisions.csv', 'decision2.csv', 'decision3.csv'].entries()) {
    writeNewCsv('Report', filename, reportHeaders, [[`DEMO-DEC-${index + 1}`, '2026-01-01', `سجل تجريبي ${21 + index}`, 'موظف تجريبي', 'دفاع', 'DEMO-ASSET', 'اختبار سير العمل', 'شرق', 'مكتب تجريبي 01', 'موافقة تجريبية', 'موافقة تجريبية', DEMO_NOTE]]);
  }
  writeNewJson('Report', 'settings.json', { ocrEnabled: false });

  writeNewJson('Accept', 'Acceptances.json', [1, 2, 3].map((i) => ({ id: i, 'الرتبة': 'موظف تجريبي', 'الاسم': `سجل تجريبي ${30 + i}`, 'جهة العمل': 'الإدارة التجريبية', 'تاريخ الوارد': `2026-01-0${i}`, 'محل الاقامه': 'مدينة تجريبية', 'نوع الترخيص': 'اخرى', 'نوع السلاح': `DEMO-ASSET-${i}` })));
  writeNewJson('Request', 'requests.json', [1, 2].map((i) => ({ id: `demo-request-${i}`, name: i === 1 ? 'سجل تجريبي ألف' : 'سجل تجريبي باء', job: 'موظف تجريبي', nationalId: '', address: 'عنوان تجريبي غير حقيقي', phone: '', licenseType: 'ترخيص جديد', weaponData: 'DEMO-ASSET', sector: 'شرق', station: 'مكتب تجريبي 01', status: 'pending', notes: DEMO_NOTE, createdAt: '2026-01-01T00:00:00.000Z' })));

  const seizedModule = await import(pathToFileURL(path.join(__dirname, '../public/Program/Seized/Backend/seized-sql-store.js')).href);
  const seized = seizedModule.createSeizedSqlStore(dataFile('Seized', 'seized.db'));
  if (!seized.hasData()) {
    seized.replaceAll([1, 2].map((i) => ({ 'الفئة': 'فئة تجريبية', 'رقم الحرز': `DEMO-REC-${i}`, 'رقم الرخصة': `DEMO-LIC-${i}`, 'نوع الرخصة': 'دفاع', 'القسم': 'مكتب تجريبي 01', 'الاسم': `سجل تجريبي ${50 + i}`, 'النوع': 'DEMO-ASSET', 'الماركة': 'DEMO', 'العيار': 'DEMO', 'الرقم': `DEMO-SERIAL-${i}`, 'سبب الالغاء': 'اختبار تجريبي', 'تاريخ الايداع': '2026-01-01', 'مالك الحرز': 'جهة تجريبية', 'نوع الحرز': 'تجريبي', 'ملاحظات': DEMO_NOTE })));
  }
  seized.close();
  for (const filename of ['companies.json', 'companiesH.json', 'companiesM.json']) writeNewJson('Seized', filename, []);

  const companyRouter = require('../public/Program/Company/Backend/api-routes');
  await companyRouter.seedDemoCompany();

  const { createStorageService } = require('../public/Program/Storage/backend/storage-service');
  const storage = createStorageService();
  await storage.initialize();
  if (!(await storage.listFiles({ user: accounts[0], scope: 'all' })).total) {
    const contents = Buffer.from('Administrative Integrated System\nDEMO ONLY. This synthetic text file contains no personal data.\n');
    const tempFile = path.join(storage.tmpDir, 'demo-note.txt');
    fs.writeFileSync(tempFile, contents);
    await storage.createFileFromUpload({ file: { path: tempFile, originalname: 'demo-note.txt', mimetype: 'text/plain', size: contents.length }, body: { title: 'ملف تجريبي', description: DEMO_NOTE, visibility: 'all' }, user: accounts[0] });
  }
  storage.close();
  return { modules: 8, dataRoot: DATA_ROOT, fictional: true };
}

if (require.main === module) {
  seedDemo().then((summary) => { console.log(JSON.stringify(summary)); process.exit(0); }).catch((error) => { console.error(error.message); process.exit(1); });
}
module.exports = { seedDemo };
