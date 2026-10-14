(function initRequestRecordPagination(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.RequestRecordPagination = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, function createRequestRecordPagination() {
    const PAGE_SIZE = 25;

    function getTotalPages(totalRecords) {
        const total = Math.max(0, Number(totalRecords) || 0);
        return Math.max(1, Math.ceil(total / PAGE_SIZE));
    }

    function clampPage(page, totalRecords) {
        const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
        return Math.min(normalizedPage, getTotalPages(totalRecords));
    }

    function getPageSlice(records, page) {
        const source = Array.isArray(records) ? records : [];
        const currentPage = clampPage(page, source.length);
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return source.slice(startIndex, startIndex + PAGE_SIZE);
    }

    return {
        PAGE_SIZE,
        getTotalPages,
        clampPage,
        getPageSlice
    };
});