export class HttpError extends Error {
  constructor(status, errorCode, message, details = null) {
    super(message); this.status = status; this.errorCode = errorCode; this.details = details;
  }
}
export const fail = (status, code, message, details) => { throw new HttpError(status, code, message, details); };
export function assert(condition, message, field, code = 'VALIDATION_ERROR') {
  if (!condition) fail(422, code, message, field ? { field } : null);
}
export function paging(list, query = {}) {
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
  const pageSize = Math.max(1, Math.min(50, Number(query.pageSize) || 12));
  return { items: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize };
}
export function buyerOnly(user) {
  if (!user) fail(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập để sử dụng chức năng này.');
  if (user.role !== 'BUYER') fail(403, 'FORBIDDEN', 'Chức năng này chỉ dành cho khách hàng.');
}
export function auditBuyer(db, user, action, tableName, recordRowId) {
  db.auditLogs.unshift({
    rowId: db.seq++, occurredAt: new Date().toISOString(), actorUserRowId: user?.rowId ?? null,
    actorType: user ? 'USER' : 'SYSTEM', actorRoleSnapshot: user?.role || null,
    actionSource: 'CLIENT', actionCode: action, tableName, recordRowId,
    oldValues: null, newValues: null, requestId: null,
  });
}
