import { describe, it, expect, beforeEach } from "vitest";
import { logAudit, getAuditLog, auditLog } from "./auditLog";

describe("auditLog middleware", () => {
  beforeEach(() => {
    auditLog.length = 0;
  });

  it("logs audit entry", () => {
    logAudit({
      userId: "user1",
      action: "create_order",
      resource: "orders",
      resourceId: "order123",
      details: { amount: 100 },
    });

    const logs = getAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0].userId).toBe("user1");
    expect(logs[0].action).toBe("create_order");
  });

  it("generates unique IDs", () => {
    logAudit({ userId: null, action: "test1", resource: "test", resourceId: null, details: null });
    logAudit({ userId: null, action: "test2", resource: "test", resourceId: null, details: null });

    const logs = getAuditLog();
    expect(logs[0].id).not.toBe(logs[1].id);
  });

  it("filters by action", () => {
    logAudit({ userId: "user1", action: "create", resource: "test", resourceId: null, details: null });
    logAudit({ userId: "user1", action: "update", resource: "test", resourceId: null, details: null });
    logAudit({ userId: "user1", action: "create", resource: "test", resourceId: null, details: null });

    const createLogs = getAuditLog({ action: "create" });
    expect(createLogs.length).toBe(2);
  });

  it("limits result count", () => {
    for (let i = 0; i < 10; i++) {
      logAudit({ userId: "user1", action: "test", resource: "test", resourceId: null, details: null });
    }

    const logs = getAuditLog({ limit: 5 });
    expect(logs.length).toBe(5);
  });

  it("returns logs in reverse chronological order", () => {
    logAudit({ userId: "user1", action: "first", resource: "test", resourceId: null, details: null });
    logAudit({ userId: "user1", action: "second", resource: "test", resourceId: null, details: null });
    logAudit({ userId: "user1", action: "third", resource: "test", resourceId: null, details: null });

    const logs = getAuditLog();
    expect(logs[0].action).toBe("third");
    expect(logs[1].action).toBe("second");
    expect(logs[2].action).toBe("first");
  });

  it("handles null userId", () => {
    logAudit({ userId: null, action: "test", resource: "test", resourceId: null, details: null });

    const logs = getAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0].userId).toBeNull();
  });
});
