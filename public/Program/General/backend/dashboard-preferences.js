'use strict';

function normalizeRole(value) {
  return String(value || 'user').trim().toLowerCase();
}

function canCustomizeDashboardApps(user) {
  if (!user || typeof user !== 'object') return false;
  if (normalizeRole(user.role) === 'admin') return true;
  const permissions = user.permissions && typeof user.permissions === 'object'
    ? user.permissions
    : user;
  return Boolean(
    permissions.customizeDashboardApps
    || permissions.dashboardAppCustomization
    || permissions.canCustomizeDashboardApps
  );
}

function normalizeHiddenDashboardApps(values, allAppKeys) {
  const allowed = new Set(
    (Array.isArray(allAppKeys) ? allAppKeys : [])
      .map((key) => String(key || '').trim().toLowerCase())
      .filter((key) => key && key !== 'settings')
  );
  const seen = new Set();
  const normalized = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const key = String(value || '').trim().toLowerCase();
    if (!allowed.has(key) || seen.has(key)) return;
    seen.add(key);
    normalized.push(key);
  });
  return normalized;
}

function getEffectiveHiddenDashboardApps(user, allAppKeys) {
  if (!canCustomizeDashboardApps(user)) return [];
  return normalizeHiddenDashboardApps(user && user.hiddenDashboardApps, allAppKeys);
}

module.exports = {
  canCustomizeDashboardApps,
  getEffectiveHiddenDashboardApps,
  normalizeHiddenDashboardApps
};
