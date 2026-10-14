const crypto = require('node:crypto');
// Intentionally PUBLIC credentials. Access only the fictional local demo.
const DEMO_ADMIN_PASSWORD = 'DemoAdmin!2026';
const DEMO_USER_PASSWORD = 'DemoUser!2026';
const DEMO_APPS = ['settings', 'weapons', 'renewal', 'report', 'accept', 'request', 'seized', 'storage', 'company'];
function makeDemoAccounts() {
  const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
  return [
    { username: 'admin', displayName: 'مدير تجريبي', role: 'admin', room: 'الإدارة', rooms: ['الإدارة'], allowedApps: DEMO_APPS, stationAccess: {}, permissions: { manageReferenceData: true, customizeDashboardApps: true, viewActivityHistory: true, editRenewalDocuments: true }, passwordHash: hash(DEMO_ADMIN_PASSWORD), createdAt: '2026-01-01T00:00:00.000Z' },
    { username: 'demo-user', displayName: 'مستخدم تجريبي', role: 'user', room: 'شرق', rooms: ['شرق'], allowedApps: ['weapons', 'renewal', 'request', 'storage'], stationAccess: { 'شرق': ['مكتب تجريبي 01'] }, permissions: { manageReferenceData: false, customizeDashboardApps: false, viewActivityHistory: false, editRenewalDocuments: false }, passwordHash: hash(DEMO_USER_PASSWORD), createdAt: '2026-01-01T00:00:00.000Z' }
  ];
}
module.exports = { DEMO_ADMIN_PASSWORD, DEMO_USER_PASSWORD, DEMO_APPS, makeDemoAccounts };
