function getQariStatus() {
  return { available: false, enabled: false, reason: 'OCR model binaries are not included in the public demo.' };
}
async function runQariOcr() {
  throw new Error('OCR inference is disabled in the public demo; manual text indexing remains available.');
}
module.exports = { getQariStatus, runQariOcr };
