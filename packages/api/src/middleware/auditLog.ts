export const auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 10_000;

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
  if (auditLog.length >= MAX_AUDIT_ENTRIES) {
    auditLog.splice(0, Math.floor(MAX_AUDIT_ENTRIES / 2));
  }
  auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });

  if (process.env.CORE_DATABASE_URL) {
    persistAuditEntry(entry).catch((err) =>
      console.error("[Audit] Failed to persist:", err)
    );
  }
}

async function persistAuditEntry(
  entry: Omit<AuditEntry, "id" | "timestamp">
): Promise<void> {
  try {
    const { getCoreDb } = await import("../db");
    const { auditEntries } = await import("@rabbitty/database-core");
    const db = getCoreDb();
    await db.insert(auditEntries).values({
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details ? JSON.stringify(entry.details) : null,
    });
  } catch {
    // Non-critical - audit log persistence failure should not crash the app
  }
}

export function getAuditLog(options?: { limit?: number; action?: string }) {
  let result = auditLog;
  if (options?.action) result = result.filter(e => e.action === options.action);
  if (options?.limit) result = result.slice(-options.limit);
  return result.reverse();
}
