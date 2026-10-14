(function exposeSeizedMergeSave(root, factory) {
	const api = factory();
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = api;
	}
	if (root) {
		root.SeizedMergeSave = api;
	}
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSeizedMergeSaveApi() {
	const DEFAULT_PRIMARY_KEYS = ['الفئة', 'رقم الحرز', 'رقم الرخصة', 'الرقم'];

	function normalizeCell(value) {
		return String(value ?? '')
			.replace(/[٠-٩]/g, (digit) => ({
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
			})[digit] ?? digit)
			.replace(/\r|\n/g, ' ')
			.trim();
	}

	function cloneRecord(record, columns) {
		const source = record && typeof record === 'object' ? record : {};
		const copy = {};
		columns.forEach((key) => {
			copy[key] = String(source[key] ?? '');
		});
		return copy;
	}

	function recordFingerprint(record, columns) {
		return columns.map((key) => `${key}:${normalizeCell(record?.[key])}`).join('\u001f');
	}

	function primaryFingerprint(record, keyColumns = DEFAULT_PRIMARY_KEYS) {
		const parts = [];
		keyColumns.forEach((key) => {
			const value = normalizeCell(record?.[key]);
			if (value) parts.push(`${key}:${value}`);
		});
		return parts.length ? parts.join('\u001f') : '';
	}

	function recordsEqual(left, right, columns) {
		return recordFingerprint(left, columns) === recordFingerprint(right, columns);
	}

	function findLatestIndex(baseRow, latestRecords, usedIndexes, columns, keyColumns) {
		const baseRecord = baseRow?.record || {};
		const exact = recordFingerprint(baseRecord, columns);
		for (let index = 0; index < latestRecords.length; index += 1) {
			if (usedIndexes.has(index)) continue;
			if (recordFingerprint(latestRecords[index], columns) === exact) return index;
		}

		const primary = primaryFingerprint(baseRecord, keyColumns);
		if (primary) {
			for (let index = 0; index < latestRecords.length; index += 1) {
				if (usedIndexes.has(index)) continue;
				if (primaryFingerprint(latestRecords[index], keyColumns) === primary) return index;
			}
		}

		const originalIndex = Number(baseRow?.index);
		if (Number.isInteger(originalIndex) && originalIndex >= 0 && originalIndex < latestRecords.length && !usedIndexes.has(originalIndex)) {
			return originalIndex;
		}

		return -1;
	}

	function buildBaseMap(baseRows) {
		const map = new Map();
		(baseRows || []).forEach((row) => {
			if (!row || row.id == null) return;
			map.set(String(row.id), row);
		});
		return map;
	}

	function normalizeEdits(edits) {
		return (Array.isArray(edits) ? edits : [])
			.filter((edit) => edit && edit.id != null && edit.key)
			.map((edit) => ({
				id: String(edit.id),
				key: String(edit.key),
				value: String(edit.value ?? '')
			}));
	}

	function mergeRecordChanges(options = {}) {
		const columns = Array.isArray(options.columns) && options.columns.length ? options.columns : [];
		const keyColumns = Array.isArray(options.keyColumns) && options.keyColumns.length
			? options.keyColumns
			: DEFAULT_PRIMARY_KEYS;
		const baseMap = buildBaseMap(options.baseRows || []);
		const resultRecords = (Array.isArray(options.latestRecords) ? options.latestRecords : [])
			.map((record) => cloneRecord(record, columns));
		const usedIndexes = new Set();
		const rowIndexById = new Map();
		const conflicts = [];

		function resolveRow(id) {
			const stringId = String(id);
			if (rowIndexById.has(stringId)) return rowIndexById.get(stringId);
			const baseRow = baseMap.get(stringId);
			if (!baseRow) return -1;
			const index = findLatestIndex(baseRow, resultRecords, usedIndexes, columns, keyColumns);
			if (index !== -1) {
				usedIndexes.add(index);
				rowIndexById.set(stringId, index);
			}
			return index;
		}

		const deletedIds = Array.isArray(options.deletedIds) ? options.deletedIds.map((id) => String(id)) : [];
		const deleteIndexes = [];
		deletedIds.forEach((id) => {
			const baseRow = baseMap.get(id);
			if (!baseRow) return;
			const index = resolveRow(id);
			if (index === -1) return;
			if (!recordsEqual(resultRecords[index], baseRow.record, columns)) {
				conflicts.push({ type: 'delete-conflict', id, row: cloneRecord(resultRecords[index], columns) });
				return;
			}
			deleteIndexes.push(index);
		});

		deleteIndexes
			.sort((left, right) => right - left)
			.forEach((index) => {
				resultRecords.splice(index, 1);
			});
		if (deleteIndexes.length) {
			usedIndexes.clear();
			rowIndexById.clear();
		}

		normalizeEdits(options.edits).forEach((edit) => {
			if (deletedIds.includes(edit.id)) return;
			const baseRow = baseMap.get(edit.id);
			if (!baseRow) {
				conflicts.push({ type: 'missing-base-row', id: edit.id, key: edit.key });
				return;
			}
			const index = resolveRow(edit.id);
			if (index === -1) {
				conflicts.push({ type: 'missing-latest-row', id: edit.id, key: edit.key });
				return;
			}
			const baseValue = normalizeCell(baseRow.record?.[edit.key]);
			const serverValue = normalizeCell(resultRecords[index]?.[edit.key]);
			const localValue = normalizeCell(edit.value);
			if (serverValue !== baseValue && serverValue !== localValue) {
				conflicts.push({
					type: 'cell-conflict',
					id: edit.id,
					key: edit.key,
					baseValue,
					serverValue,
					localValue
				});
				return;
			}
			resultRecords[index][edit.key] = edit.value;
		});

		const insertedRecords = Array.isArray(options.insertedRecords) ? options.insertedRecords : [];
		insertedRecords
			.map((entry, index) => ({
				position: Number.isInteger(entry?.position) ? entry.position : index,
				record: cloneRecord(entry?.record || entry, columns)
			}))
			.sort((left, right) => left.position - right.position)
			.forEach((entry) => {
				const position = Math.min(Math.max(entry.position, 0), resultRecords.length);
				resultRecords.splice(position, 0, entry.record);
			});

		return { records: resultRecords, conflicts };
	}

	return {
		mergeRecordChanges,
		normalizeCell,
		primaryFingerprint,
		recordFingerprint
	};
});
