(function () {
  'use strict';

  const TOKEN_KEY = 'general.auth.token';
  const API_ROOT = '/api/delete-approvals';
  const MINE_ENDPOINT = '/api/delete-approvals/mine';
  const POLL_MS = 7000;
  const APPROVED_HIDE_MS = 5000;
  const PENDING_MESSAGE = 'تم إرسال طلب الاعتماد إلى المدير والسيكرتير الأول.';
  const APPROVED_MESSAGE = 'تم اعتماد الطلب وتنفيذ الإجراء.';
  const DENIED_MESSAGE = 'لم يتم اعتماد تنفيذ الإجراء لهذه السجلات.';

  let pollHandle = null;
  let initialized = false;
  let latestRequests = [];
  let deniedFrameRequests = [];
  const approvedDismissTimers = new Map();

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeRequest(input) {
    if (!input || typeof input !== 'object') return null;
    if (input.request && typeof input.request === 'object') return input.request;
    return input;
  }

  function isRequestStatus(request, status) {
    return String(request && request.status || '').toLowerCase() === status;
  }

  function getActionLabel(request) {
    const action = String(request && request.action || '').toLowerCase();
    if (action === 'add') return 'إضافة';
    if (action === 'edit') return 'تعديل';
    if (action === 'delete') return 'حذف';
    const type = String(request && request.type || '').toLowerCase();
    if (type.includes('delete')) return 'حذف';
    if (type.includes('add')) return 'إضافة';
    if (type.includes('edit')) return 'تعديل';
    return 'تنفيذ الإجراء';
  }

  function getPendingMessage(requests) {
    const list = Array.isArray(requests) ? requests : [];
    const first = list[0] || null;
    const action = String(first && first.action || '').toLowerCase();
    if (list.length === 1 && action === 'delete') return 'تم إرسال طلب الحذف إلى المدير والسيكرتير الأول لاعتماده.';
    if (list.length === 1 && action === 'add') return 'تم إرسال طلب الإضافة إلى المدير والسيكرتير الأول لاعتماده.';
    if (list.length === 1 && action === 'edit') return 'تم إرسال طلب التعديل إلى المدير والسيكرتير الأول لاعتماده.';
    return PENDING_MESSAGE;
  }

  function getRequestTitle(request) {
    const programName = request && (request.programName || request.programKey);
    const recordLabel = request && (request.recordLabel || request.recordId);
    return [programName, recordLabel].filter(Boolean).join(' - ') || 'طلب إجراء';
  }

  function formatRecordSnapshot(record) {
    if (!record || typeof record !== 'object') return 'لا توجد بيانات للسجل.';
    return Object.entries(record)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => `${key}: ${String(value).replace(/\s+/g, ' ').trim()}`)
      .join(' | ') || 'لا توجد بيانات للسجل.';
  }

  function getNotApprovedItems(request) {
    const items = Array.isArray(request && request.items) ? request.items : [];
    return items.filter((item) => {
      const status = String(item && item.status || '').toLowerCase();
      return status === 'denied' || status === 'failed';
    });
  }

  function renderRequestRecords(request) {
    const deniedItems = getNotApprovedItems(request);
    if (deniedItems.length) {
      return deniedItems.map((item, index) => `
        <li>
          <strong>${escapeHtml(item.recordLabel || `سجل ${index + 1}`)}</strong>
          <span>${escapeHtml(formatRecordSnapshot(item.recordSnapshot))}</span>
        </li>
      `).join('');
    }
    const snapshot = request && request.recordSnapshot;
    if (snapshot && Array.isArray(snapshot.records)) {
      return snapshot.records.map((record, index) => `
        <li>
          <strong>سجل ${index + 1}</strong>
          <span>${escapeHtml(formatRecordSnapshot(record))}</span>
        </li>
      `).join('');
    }
    return `
      <li>
        <strong>${escapeHtml(getRequestTitle(request))}</strong>
        <span>${escapeHtml(formatRecordSnapshot(snapshot))}</span>
      </li>
    `;
  }

  function ensureStyles() {
    if (document.getElementById('deleteApprovalUserNoticeStyles')) return;
    const style = document.createElement('style');
    style.id = 'deleteApprovalUserNoticeStyles';
    style.textContent = `
      .delete-approval-user-notice {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10020;
        max-width: min(760px, calc(100vw - 32px));
        width: max-content;
        min-width: min(460px, calc(100vw - 32px));
        padding: 12px 18px;
        border: 2px solid #b7791f;
        border-radius: 8px;
        background: #fff8e6;
        color: #5f370e;
        box-shadow: 0 18px 38px rgba(0, 0, 0, 0.18);
        font-weight: 800;
        line-height: 1.7;
        text-align: center;
      }

      .delete-approval-user-notice.is-approved {
        border-color: #15803d;
        background: #e9f8ef;
        color: #14532d;
      }

      .delete-approval-user-notice.is-hidden,
      .delete-approval-requester-modal.is-hidden {
        display: none;
      }

      .delete-approval-requester-modal {
        position: fixed;
        inset: 0;
        z-index: 10030;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(15, 23, 42, 0.46);
      }

      .delete-approval-requester-modal__dialog {
        width: min(760px, 96vw);
        max-height: min(720px, 90vh);
        overflow: auto;
        border-radius: 10px;
        background: #ffffff;
        color: #111827;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.26);
        border: 1px solid rgba(148, 27, 27, 0.22);
      }

      .delete-approval-requester-modal__header,
      .delete-approval-requester-modal__body,
      .delete-approval-requester-modal__actions {
        padding: 16px 18px;
      }

      .delete-approval-requester-modal__header {
        border-bottom: 1px solid rgba(17, 24, 39, 0.08);
      }

      .delete-approval-requester-modal__header h3,
      .delete-approval-requester-modal__header p {
        margin: 0;
      }

      .delete-approval-requester-modal__header h3 {
        color: #991b1b;
        font-size: 1.15rem;
      }

      .delete-approval-requester-modal__header p {
        margin-top: 6px;
        color: #4b5563;
      }

      .delete-approval-requester-modal__list {
        display: grid;
        gap: 10px;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .delete-approval-requester-modal__list li {
        display: grid;
        gap: 6px;
        padding: 11px;
        border-radius: 8px;
        border: 1px solid rgba(153, 27, 27, 0.16);
        background: #fff7ed;
      }

      .delete-approval-requester-modal__list span {
        color: #4b5563;
        overflow-wrap: anywhere;
        line-height: 1.7;
      }

      .delete-approval-requester-modal__actions {
        display: flex;
        gap: 10px;
        justify-content: flex-start;
        border-top: 1px solid rgba(17, 24, 39, 0.08);
        flex-wrap: wrap;
      }

      .delete-approval-requester-modal__actions button {
        border: 0;
        border-radius: 8px;
        padding: 10px 16px;
        font-weight: 800;
        cursor: pointer;
      }

      .delete-approval-requester-modal__resend {
        background: #14532d;
        color: #fff;
      }

      .delete-approval-requester-modal__dismiss {
        background: #e5e7eb;
        color: #111827;
      }

      @media (max-width: 560px) {
        .delete-approval-user-notice {
          top: 10px;
          min-width: 0;
          width: calc(100vw - 20px);
          font-size: 0.92rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureNoticeElement() {
    ensureStyles();
    let notice = document.getElementById('deleteApprovalUserNotice');
    if (notice) return notice;
    notice = document.createElement('div');
    notice.id = 'deleteApprovalUserNotice';
    notice.className = 'delete-approval-user-notice is-hidden';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    document.body.appendChild(notice);
    return notice;
  }

  function ensureDeniedFrame() {
    ensureStyles();
    let frame = document.getElementById('deleteApprovalRequesterModal');
    if (frame) return frame;
    frame = document.createElement('div');
    frame.id = 'deleteApprovalRequesterModal';
    frame.className = 'delete-approval-requester-modal is-hidden';
    frame.setAttribute('aria-hidden', 'true');
    frame.innerHTML = `
      <div class="delete-approval-requester-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="deleteApprovalRequesterModalTitle">
        <div class="delete-approval-requester-modal__header">
          <h3 id="deleteApprovalRequesterModalTitle">${DENIED_MESSAGE}</h3>
          <p>هذه السجلات لم يتم اعتماد الإجراء المطلوب لها. يمكنك إرسال الطلب مرة أخرى أو تجاهل الإشعار.</p>
        </div>
        <div class="delete-approval-requester-modal__body">
          <ul class="delete-approval-requester-modal__list" id="deleteApprovalRequesterModalList"></ul>
        </div>
        <div class="delete-approval-requester-modal__actions">
          <button type="button" class="delete-approval-requester-modal__resend" data-delete-approval-user-action="resubmit">إرسال مرة أخرى</button>
          <button type="button" class="delete-approval-requester-modal__dismiss" data-delete-approval-user-action="dismiss">تجاهل</button>
        </div>
      </div>
    `;
    frame.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('[data-delete-approval-user-action]')
        : null;
      if (!target) return;
      event.preventDefault();
      const action = target.getAttribute('data-delete-approval-user-action');
      if (action === 'resubmit') void resubmitDeniedRequests();
      if (action === 'dismiss') void dismissDeniedRequests();
    });
    document.body.appendChild(frame);
    return frame;
  }

  function showNotice(kind, message) {
    const notice = ensureNoticeElement();
    notice.textContent = message;
    notice.classList.toggle('is-approved', kind === 'approved');
    notice.classList.remove('is-hidden');
  }

  function hideNotice() {
    const notice = document.getElementById('deleteApprovalUserNotice');
    if (notice) notice.classList.add('is-hidden');
  }

  function showPendingNotice(requests) {
    const count = Array.isArray(requests) ? requests.length : 0;
    if (!count) return;
    const suffix = count > 1 ? ` عدد الطلبات المعلقة: ${count}.` : '';
    showNotice('pending', `${getPendingMessage(requests)}${suffix}`);
  }

  function showApprovedNotice(requests) {
    if (!Array.isArray(requests) || !requests.length) return;
    const count = requests.length;
    const message = count > 1
      ? `تم اعتماد ${count} من طلبات الاعتماد وتنفيذها.`
      : (requests[0]?.action === 'delete' ? 'تم اعتماد طلب الحذف وتنفيذ الحذف.' : APPROVED_MESSAGE);
    showNotice('approved', message);
    requests.forEach((request) => {
      const id = String(request && request.id || '');
      if (!id || approvedDismissTimers.has(id)) return;
      const timer = window.setTimeout(async () => {
        approvedDismissTimers.delete(id);
        await dismissRequest(id);
        latestRequests = latestRequests.filter((entry) => String(entry.id || '') !== id);
        renderFromRequests(latestRequests);
      }, APPROVED_HIDE_MS);
      approvedDismissTimers.set(id, timer);
    });
  }

  function showDeniedFrame(requests) {
    if (!Array.isArray(requests) || !requests.length) return;
    deniedFrameRequests = requests.slice();
    const frame = ensureDeniedFrame();
    const list = document.getElementById('deleteApprovalRequesterModalList');
    if (list) {
      list.innerHTML = requests.map((request) => `
        <li>
          <strong>${escapeHtml(getActionLabel(request))}: ${escapeHtml(getRequestTitle(request))}</strong>
          <ul class="delete-approval-requester-modal__list">
            ${renderRequestRecords(request)}
          </ul>
        </li>
      `).join('');
    }
    frame.classList.remove('is-hidden');
    frame.setAttribute('aria-hidden', 'false');
    hideNotice();
  }

  function hideDeniedFrame() {
    const frame = document.getElementById('deleteApprovalRequesterModal');
    if (!frame) return;
    frame.classList.add('is-hidden');
    frame.setAttribute('aria-hidden', 'true');
    deniedFrameRequests = [];
  }

  async function authFetch(url, options) {
    const token = getToken();
    if (!token) {
      const error = new Error('missing-token');
      error.missingToken = true;
      throw error;
    }
    const headers = new Headers(options && options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if ((options && options.body) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...(options || {}), headers, cache: 'no-store' });
  }

  async function fetchMine() {
    const response = await authFetch(MINE_ENDPOINT, { method: 'GET' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || 'تعذر تحميل حالة طلبات الحذف.');
    }
    return Array.isArray(payload.requests) ? payload.requests : [];
  }

  async function dismissRequest(id) {
    if (!id) return null;
    try {
      const response = await authFetch(`${API_ROOT}/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
      return response.json().catch(() => ({}));
    } catch (error) {
      if (!error.missingToken) console.warn('Delete approval dismiss failed:', error);
      return null;
    }
  }

  async function resubmitRequest(id) {
    const response = await authFetch(`${API_ROOT}/${encodeURIComponent(id)}/resubmit`, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || 'تعذر إعادة إرسال الطلب.');
    }
    return payload.request || null;
  }

  async function resubmitDeniedRequests() {
    const requests = deniedFrameRequests.slice();
    if (!requests.length) return;
    try {
      const resubmitted = [];
      for (const request of requests) {
        const next = await resubmitRequest(String(request.id || ''));
        if (next) resubmitted.push(next);
      }
      hideDeniedFrame();
      if (resubmitted.length) {
        latestRequests = latestRequests
          .filter((entry) => !resubmitted.some((next) => String(next.id || '') === String(entry.id || '')))
          .concat(resubmitted);
        showPendingNotice(resubmitted);
      }
      void poll();
    } catch (error) {
      window.alert(error.message || 'تعذر إعادة إرسال الطلب.');
    }
  }

  async function dismissDeniedRequests() {
    const requests = deniedFrameRequests.slice();
    if (!requests.length) {
      hideDeniedFrame();
      return;
    }
    for (const request of requests) {
      await dismissRequest(String(request.id || ''));
    }
    latestRequests = latestRequests.filter((entry) => (
      !requests.some((request) => String(request.id || '') === String(entry.id || ''))
    ));
    hideDeniedFrame();
    renderFromRequests(latestRequests);
    void poll();
  }

  function mergeTrackedRequest(request) {
    const normalized = normalizeRequest(request);
    if (!normalized || !normalized.id) return null;
    const id = String(normalized.id);
    latestRequests = latestRequests.filter((entry) => String(entry.id || '') !== id);
    latestRequests.unshift(normalized);
    return normalized;
  }

  function renderFromRequests(requests) {
    const active = Array.isArray(requests) ? requests.filter((request) => !request.requesterDismissedAt) : [];
    const denied = active.filter((request) => isRequestStatus(request, 'denied') || isRequestStatus(request, 'failed') || isRequestStatus(request, 'partial'));
    const approved = active.filter((request) => isRequestStatus(request, 'approved'));
    const pending = active.filter((request) => isRequestStatus(request, 'pending'));

    if (denied.length) {
      showDeniedFrame(denied);
      return;
    }
    hideDeniedFrame();

    if (approved.length) {
      showApprovedNotice(approved);
      return;
    }

    if (pending.length) {
      showPendingNotice(pending);
      return;
    }

    hideNotice();
  }

  async function poll() {
    if (!getToken()) return;
    try {
      latestRequests = await fetchMine();
      renderFromRequests(latestRequests);
    } catch (error) {
      if (!error.missingToken) console.warn('Delete approval status polling failed:', error);
    }
  }

  function startPolling() {
    if (pollHandle) return;
    pollHandle = window.setInterval(() => {
      if (!document.hidden) void poll();
    }, POLL_MS);
  }

  function track(request, options) {
    const normalized = mergeTrackedRequest(request);
    startPolling();
    if (normalized && isRequestStatus(normalized, 'pending')) {
      showPendingNotice([normalized]);
    } else if (options && options.message) {
      showNotice('pending', options.message);
    }
    void poll();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureStyles();
    ensureNoticeElement();
    ensureDeniedFrame();
    startPolling();
    void poll();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void poll();
    });
  }

  window.DeleteApprovalUserNotice = {
    track,
    refresh: poll,
    showPending: (request, message) => {
      const normalized = mergeTrackedRequest(request);
      startPolling();
      if (normalized) showPendingNotice([normalized]);
      else showNotice('pending', message || PENDING_MESSAGE);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
