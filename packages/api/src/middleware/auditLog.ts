export const auditLog: AuditEntry[] = [];

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

export function logAudit(entry: Omit<AuditEntry, "id" | "timestamp">) {
  auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

export function getAuditLog(options?: { limit?: number; action?: string }) {
  let result = auditLog;
  if (options?.action) result = result.filter(e => e.action === options.action);
  if (options?.limit) result = result.slice(-options.limit);
  return result.reverse();
}
