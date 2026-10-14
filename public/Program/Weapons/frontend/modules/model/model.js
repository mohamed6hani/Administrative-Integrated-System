(function initWeaponsModelAI(global) {
  const buildWeaponsApiUrl = typeof global.buildWeaponsApiUrl === 'function'
    ? global.buildWeaponsApiUrl
    : (path) => path;
  const NOTE_HEADERS = ['ملاحظات', 'ملاحظة'];
  const NAME_HEADERS = ['الاسم'];
  const LICENSE_HEADERS = ['رقم', 'رقم القيد'];
  const STATUS_HEADERS = ['حالة السحب'];
  const DEPOSIT_HEADERS = ['رقم الايداع', 'رقم الإيداع'];
  const WITHDRAWN_STATUS_VALUES = ['مسحوب'];
  const DIGIT_EXTRACT_RE = /(?:\u0628[\u0640]?\s*)?رقم\s*(?:[A-Za-z\u0600-\u06FF]+)?\s*[:：\-]?[\s\u00A0]*([0-9\u0660-\u0669\u06F0-\u06F9]{1,})/giu;
  const MIN_DEPOSIT_LENGTH = 1;
  const WITHDRAWN_NOTE_KEYWORDS = ['حرز', 'محرز', 'احراز'];

  const state = {
    headers: [],
    hintsByRow: new Map(),
    lastPayload: null,
    pendingPersist: null,
    persistTimer: null,
    lastPersistHash: null
  };

  function toLatinDigits(str) {
    return String(str || '')
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  }

  function sanitizeDigits(text) {
    return toLatinDigits(text).replace(/[^0-9]/g, '');
  }

  function extractDepositCandidates(noteText) {
    if (!noteText) return [];
    const raw = String(noteText);
    const matches = [];
    let match;
    DIGIT_EXTRACT_RE.lastIndex = 0;
    while ((match = DIGIT_EXTRACT_RE.exec(raw))) {
      const digits = sanitizeDigits(match[1] || '');
      if (digits.length >= MIN_DEPOSIT_LENGTH) {
        matches.push({
          digits,
          raw: match[0],
          index: match.index,
          score: digits.length
        });
      }
      if (matches.length >= 4) break; // keep payload small per row
    }
    return matches;
  }

  function findColumnIndex(headers, candidates) {
    if (!Array.isArray(headers)) return -1;
    for (const label of candidates) {
      const idx = headers.indexOf(label);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function summarizeRow(row, ctx, rowIdx) {
    const note = ctx.noteIdx !== -1 ? row[ctx.noteIdx] : '';
    const statusRaw = ctx.statusIdx !== -1 ? row[ctx.statusIdx] : '';
    const depositRaw = ctx.depositIdx !== -1 ? row[ctx.depositIdx] : '';
    const status = String(statusRaw || '').trim();
    const noteSuggestsWithdrawal = noteImpliesWithdrawal(note);
    const withdrawn = WITHDRAWN_STATUS_VALUES.includes(status) || noteSuggestsWithdrawal;
  const depositMissing = ctx.depositIdx === -1 ? true : !String(depositRaw || '').trim();
    
    // Skip warning if notes indicate the weapon is already deposited
    if (depositMissing && noteIndicatesAlreadyDeposited(note)) {
      state.hintsByRow.delete(rowIdx);
      return null;
    }
    
    if (!withdrawn || !depositMissing) {
      state.hintsByRow.delete(rowIdx);
      return null;
    }
    const hints = extractDepositCandidates(note);
    if (!hints.length) {
      state.hintsByRow.delete(rowIdx);
      return null;
    }
    const payload = {
      noteText: String(note || ''),
      hints,
      status,
      name: ctx.nameIdx !== -1 ? String(row[ctx.nameIdx] || '') : '',
      license: ctx.licenseIdx !== -1 ? String(row[ctx.licenseIdx] || '') : '',
      row: rowIdx,
      depositMissing
    };
    state.hintsByRow.set(rowIdx, payload);
    return payload;
  }

  function buildContext(headers) {
    return {
      noteIdx: findColumnIndex(headers, NOTE_HEADERS),
      nameIdx: findColumnIndex(headers, NAME_HEADERS),
      licenseIdx: findColumnIndex(headers, LICENSE_HEADERS),
      statusIdx: findColumnIndex(headers, STATUS_HEADERS),
      depositIdx: findColumnIndex(headers, DEPOSIT_HEADERS)
    };
  }

  function scanDataset(headers, rows) {
    if (!Array.isArray(rows) || !rows.length) {
      state.headers = headers || [];
      state.hintsByRow.clear();
      state.lastPayload = null;
      return { totalHints: 0 };
    }
    state.headers = headers || [];
    const ctx = buildContext(state.headers);
    if (ctx.noteIdx === -1) {
      state.hintsByRow.clear();
      state.lastPayload = null;
      return { totalHints: 0 };
    }
    const hints = [];
    rows.forEach((row, idx) => {
      const summary = summarizeRow(Array.isArray(row) ? row : [], ctx, idx);
      if (summary) hints.push(summary);
    });
    state.lastPayload = { generatedAt: Date.now(), hints };
    schedulePersist();
    dispatchSummary(hints.length);
    return { totalHints: hints.length };
  }

  function schedulePersist() {
    if (!state.lastPayload || !state.lastPayload.hints.length) {
      if (state.persistTimer) {
        clearTimeout(state.persistTimer);
        state.persistTimer = null;
      }
      return;
    }
    if (state.persistTimer) return;
    state.persistTimer = setTimeout(() => {
      state.persistTimer = null;
      persistHints().catch(() => {});
    }, 1500);
  }

  async function persistHints() {
    if (!state.lastPayload || !state.lastPayload.hints.length) return;
    const sample = state.lastPayload;
    const payload = {
      generatedAt: sample.generatedAt,
      hintCount: sample.hints.length,
      hints: sample.hints.slice(0, 200) // clamp payload size
    };
    const hash = JSON.stringify(payload).length;
    if (hash === state.lastPersistHash) return;
    state.lastPersistHash = hash;
    try {
      await fetch(buildWeaponsApiUrl('/api/model-notes-log'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('[ModelAI] persist failed', err);
    }
  }

  function dispatchSummary(count) {
    try {
      const evt = new CustomEvent('model:notes-scan', { detail: { hints: count, generatedAt: Date.now() } });
      document.dispatchEvent(evt);
    } catch (_) {}
  }

  function noteImpliesDeposit(noteText) {
    if (noteIndicatesAlreadyDeposited(noteText)) return true;
    return extractDepositCandidates(noteText).length > 0;
  }

  function noteImpliesWithdrawal(noteText) {
    if (!noteText) return false;
    const raw = String(noteText);
    return WITHDRAWN_NOTE_KEYWORDS.some((keyword) => raw.includes(keyword));
  }

  function noteIndicatesAlreadyDeposited(noteText) {
    if (!noteText) return false;
    const raw = String(noteText).trim();
    // Check for "تم الايداع", "تم ايداع", "ايداع" (without "ال")
    // Also check for variations in spacing/diacritics
    const depositedPatterns = [
      'تم الايداع',
      'تم الإيداع',
      'تم ايداع',
      'تم إيداع',
      'ايداع',
      'إيداع'
    ];
    return depositedPatterns.some((pattern) => raw.includes(pattern));
  }

  // === Caliber Analysis System ===
  // Common caliber conversions: inch-based calibers mistakenly written as mm
  // .22 = 5.6mm, .25 = 6.35mm, .32 = 7.65mm, .357 = 9mm, .38 = 9.65mm, .380 = 9mm
  // .40 = 10mm, .44 = 11.2mm, .45 = 11.43mm, .50 = 12.7mm
  const CALIBER_INCH_TO_MM = {
    '22': { mm: 5.6, display: '٥.٦' },
    '25': { mm: 6.35, display: '٦.٣٥' },
    '32': { mm: 7.65, display: '٧.٦٥' },
    '357': { mm: 9, display: '٩' },
    '38': { mm: 9.65, display: '٩.٦٥' },
    '380': { mm: 9, display: '٩' },
    '40': { mm: 10, display: '١٠' },
    '44': { mm: 11.2, display: '١١.٢' },
    '45': { mm: 11.43, display: '١١.٤٣' },
    '50': { mm: 12.7, display: '١٢.٧' }
  };

  // Valid mm calibers that should NOT trigger warnings
  const VALID_MM_CALIBERS = [
    5.56, 5.6, 6.35, 7.62, 7.65, 9, 9.65, 10, 11, 11.43, 12, 12.7, 16 // common pistol/rifle calibers
  ];

  // Shotgun gauges are valid (12mm, 16mm refer to gauge, not actual mm)
  const SHOTGUN_KEYWORDS = ['خرطوش', 'شوزن', 'shotgun'];

  // Decorative/ornamental weapons that don't have serial numbers by nature
  const DECORATIVE_WEAPON_KEYWORDS = [
    'للزينة', 'للزينه', 'زينة', 'زينه',
    'سيف', 'خنجر', 'سكين', 'سكينة',
    'رمح', 'حربة', 'سهم', 'قوس',
    'عصا', 'هراوة', 'درع'
  ];

  // Caliber regex: matches patterns like "9مم", "38 مم", "٩ملم", ".38", "0.45"
  const CALIBER_REGEX = /(\d+(?:\.\d+)?|\u0660-\u0669+(?:\.\u0660-\u0669+)?)\s*(?:مم|ملم|mm)/gi;
  const CALIBER_REGEX_ARABIC = /([\u0660-\u0669]+(?:\.[\u0660-\u0669]+)?)\s*(?:مم|ملم|mm)/gi;

  function extractCaliberFromText(weaponText) {
    if (!weaponText) return null;
    const text = String(weaponText);
    const latinText = toLatinDigits(text);
    
    // Try to find caliber pattern
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(?:مم|ملم|mm)/i,
      /(\d+(?:\.\d+)?)\s*م(?:\s|$)/i // "9م" pattern
    ];
    
    for (const pattern of patterns) {
      const match = latinText.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0) {
          return {
            value,
            raw: match[0],
            index: latinText.indexOf(match[0])
          };
        }
      }
    }
    return null;
  }

  function isShotgun(weaponText) {
    if (!weaponText) return false;
    const text = String(weaponText).toLowerCase();
    return SHOTGUN_KEYWORDS.some(kw => text.includes(kw));
  }

  function isPistol(weaponText) {
    if (!weaponText) return false;
    const text = String(weaponText);
    return text.includes('مسدس');
  }

  function isRifle(weaponText) {
    if (!weaponText) return false;
    const text = String(weaponText);
    return text.includes('بندقية') && !isShotgun(weaponText);
  }

  function isDecorativeWeapon(weaponText) {
    if (!weaponText) return false;
    const text = String(weaponText).toLowerCase();
    return DECORATIVE_WEAPON_KEYWORDS.some(kw => text.includes(kw));
  }

  function analyzeCaliber(weaponText) {
    const caliber = extractCaliberFromText(weaponText);
    if (!caliber) return null;
    
    const value = caliber.value;
    const isShotgunWeapon = isShotgun(weaponText);
    const isPistolWeapon = isPistol(weaponText);
    
    // Shotguns: 12mm and 16mm are gauge references, valid
    if (isShotgunWeapon && (value === 12 || value === 16)) {
      return null; // Valid shotgun gauge
    }
    
    // Check if this looks like a mistaken inch caliber written as mm
    const valueStr = String(Math.round(value));
    if (CALIBER_INCH_TO_MM[valueStr]) {
      const conversion = CALIBER_INCH_TO_MM[valueStr];
      // Only flag if the value is suspiciously large for a pistol
      // or doesn't match valid mm calibers
      if (value > 15 || (isPistolWeapon && value > 13)) {
        return {
          issue: true,
          originalValue: value,
          originalText: caliber.raw,
          suggestedMM: conversion.mm,
          suggestedDisplay: conversion.display,
          message: `العيار ${toArabicDigits(value)}مم يبدو خاطئ - هل تقصد .${valueStr} (${conversion.display}مم)؟`,
          shortMessage: `عيار خاطئ: ${toArabicDigits(value)}مم → ${conversion.display}مم`
        };
      }
    }
    
    // Check for obviously wrong large calibers (pistols shouldn't be >15mm typically)
    if (isPistolWeapon && value > 15 && !VALID_MM_CALIBERS.includes(value)) {
      // Try to find closest inch caliber
      let bestMatch = null;
      let bestDiff = Infinity;
      for (const [inch, conv] of Object.entries(CALIBER_INCH_TO_MM)) {
        const diff = Math.abs(value - parseInt(inch));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestMatch = { inch, ...conv };
        }
      }
      if (bestMatch && bestDiff <= 5) {
        return {
          issue: true,
          originalValue: value,
          originalText: caliber.raw,
          suggestedMM: bestMatch.mm,
          suggestedDisplay: bestMatch.display,
          message: `العيار ${toArabicDigits(value)}مم يبدو خاطئ - هل تقصد .${bestMatch.inch} (${bestMatch.display}مم)؟`,
          shortMessage: `عيار خاطئ: ${toArabicDigits(value)}مم → ${bestMatch.display}مم`
        };
      }
    }
    
    return null; // No issue detected
  }

  // Detect redundant "عيار" + "مم" pattern
  // e.g., "عيار 38مم" - the word عيار already means caliber, so مم might be redundant or wrong
  function analyzeCaliberRedundancy(weaponText) {
    if (!weaponText) return null;
    const text = String(weaponText);
    const latinText = toLatinDigits(text);
    
    // Check if text contains "عيار" followed by a number and مم/م
    const redundancyPatterns = [
      /عيار\s*([\d.]+)\s*(?:مم|ملم|mm)/i,
      /عيار\s*([\u0660-\u0669.]+)\s*(?:مم|ملم|mm)/i
    ];
    
    for (const pattern of redundancyPatterns) {
      const match = latinText.match(pattern);
      if (match) {
        const value = parseFloat(toLatinDigits(match[1]));
        if (!isNaN(value) && value > 0) {
          const valueStr = String(Math.round(value));
          const conversion = CALIBER_INCH_TO_MM[valueStr];
          
          const issues = [];
          
          // Issue 1: Redundant مم with عيار
          issues.push({
            type: 'redundant_mm',
            message: `كلمة "عيار" موجودة مع "مم" - يمكن إزالة "مم"`,
            action: 'remove_mm',
            description: `إزالة "مم" (عيار ${toArabicDigits(value)})`
          });
          
          // Issue 2: If it's also a wrong caliber, offer conversion
          if (conversion && (value > 15 || (isPistol(weaponText) && value > 13))) {
            issues.push({
              type: 'wrong_caliber',
              message: `العيار ${toArabicDigits(value)} يبدو كعيار بالإنش - هل تقصد .${valueStr}؟`,
              action: 'convert_caliber',
              description: `تحويل إلى ${conversion.display}مم (.${valueStr})`,
              suggestedMM: conversion.mm,
              suggestedDisplay: conversion.display
            });
          }
          
          return {
            hasIssue: true,
            originalValue: value,
            originalMatch: match[0],
            issues
          };
        }
      }
    }
    
    return null;
  }

  function toArabicDigits(num) {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/[0-9]/g, d => arabicDigits[parseInt(d)]);
  }

  function hasRowHint(rowIdx) {
    return state.hintsByRow.has(rowIdx);
  }

  function getRowHint(rowIdx) {
    return state.hintsByRow.get(rowIdx) || null;
  }

  const api = {
    scanDataset,
    persistHints,
    noteImpliesDeposit,
    noteImpliesWithdrawal,
    hasRowHint,
    getRowHint,
    extractDepositCandidates,
    sanitizeDigits,
    toLatinDigits,
    // Caliber analysis exports
    analyzeCaliber,
    analyzeCaliberRedundancy,
    extractCaliberFromText,
    isShotgun,
    isPistol,
    isRifle,
    isDecorativeWeapon,
    toArabicDigits
  };

  try {
    global.WeaponsModelAI = api;
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
