const fs = require('fs');
const path = require('path');

const { dataFile, ensureDirSync } = require('../../General/backend/platform-paths');

const DEFAULT_SETTINGS = Object.freeze({
  ocrEnabled: true,
});

const SETTINGS_FILE = dataFile('Report', 'settings.json');

function normalizeSettings(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    ocrEnabled: raw.ocrEnabled !== false,
  };
}

function getReportSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveReportSettings(nextSettings) {
  const normalized = normalizeSettings({
    ...getReportSettings(),
    ...(nextSettings || {}),
  });
  ensureDirSync(path.dirname(SETTINGS_FILE));
  fs.writeFileSync(SETTINGS_FILE, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function isOcrEnabled() {
  return getReportSettings().ocrEnabled !== false;
}

module.exports = {
  DEFAULT_SETTINGS,
  SETTINGS_FILE,
  getReportSettings,
  saveReportSettings,
  isOcrEnabled,
};
