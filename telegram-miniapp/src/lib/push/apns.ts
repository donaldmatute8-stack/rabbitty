import http2 from "node:http2";
import crypto from "node:crypto";
import { db } from "@/db";
import { pushDevices } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * APNs provider (token-based auth) for iOS push notifications.
 *
 * Zero external dependencies: builds the ES256 JWT with `node:crypto`
 * (dsaEncoding "ieee-p1363" yields the JOSE R||S signature APNs expects) and
 * delivers over `node:http2`.
 *
 * Required env vars:
 *   APNS_KEY_ID       -> Key ID of the APNs Auth Key (.p8)   e.g. X2L6PHL2D9
 *   APNS_TEAM_ID      -> Apple Developer Team ID             e.g. FW97275K5X
 *   APNS_BUNDLE_ID    -> App bundle id                       e.g. com.rabbitty.app
 *   APNS_PRIVATE_KEY  -> full contents of the .p8 file (newlines real or "\n")
 *   APNS_ENV          -> "production" (default) | "sandbox"
 */

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  host: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Custom top-level keys delivered alongside `aps`. */
  data?: Record<string, string | number | boolean>;
  badge?: number;
  sound?: string;
  threadId?: string;
  collapseId?: string;
}

export interface ApnsDeviceResult {
  token: string;
  ok: boolean;
  status: number;
  reason?: string;
}

export interface PushDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  deactivated: number;
}

const INVALID_TOKEN_REASONS = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "Unregistered",
  "ExpiredToken",
]);

function getConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim();
  const rawKey = process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !bundleId || !rawKey) return null;

  // Tolerate keys pasted with literal "\n" instead of real newlines.
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  const env = (process.env.APNS_ENV || "production").toLowerCase();

  return {
    keyId,
    teamId,
    bundleId,
    privateKey,
    host: env === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com",
  };
}

export function isApnsConfigured(): boolean {
  return getConfig() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

let cachedToken: { value: string; issuedAt: number; keyId: string } | null = null;

/** Provider JWT, reused for ~50 minutes (APNs accepts up to 60). */
function getProviderToken(cfg: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.keyId === cfg.keyId && now - cachedToken.issuedAt < 3000) {
    return cachedToken.value;
  }
  const header = base64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = base64url(JSON.stringify({ iss: cfg.teamId, iat: now }));
  const signingInput = `${header}.${claims}`;
  const key = crypto.createPrivateKey(cfg.privateKey);
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  const value = `${signingInput}.${base64url(signature)}`;
  cachedToken = { value, issuedAt: now, keyId: cfg.keyId };
  return value;
}

function buildBody(payload: PushPayload): Record<string, unknown> {
  const aps: Record<string, unknown> = {
    alert: { title: payload.title, body: payload.body },
    sound: payload.sound ?? "default",
  };
  if (typeof payload.badge === "number") aps.badge = payload.badge;
  if (payload.threadId) aps["thread-id"] = payload.threadId;

  return { aps, ...(payload.data ?? {}) };
}

/** Send a single notification to one APNs device token. */
export async function sendApnsToDevice(
  deviceToken: string,
  payload: PushPayload,
): Promise<ApnsDeviceResult> {
  const cfg = getConfig();
  if (!cfg) throw new Error("APNS_NOT_CONFIGURED");

  const token = getProviderToken(cfg);
  const body = JSON.stringify(buildBody(payload));
  const client = http2.connect(`https://${cfg.host}`);

  return await new Promise<ApnsDeviceResult>((resolve, reject) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${token}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      ...(payload.collapseId ? { "apns-collapse-id": payload.collapseId } : {}),
      "content-type": "application/json",
    });

    let status = 0;
    let raw = "";
    req.setEncoding("utf8");
    req.on("response", (headers) => {
      status = Number(headers[":status"]) || 0;
    });
    req.on("data", (chunk: string) => {
      raw += chunk;
    });
    req.on("end", () => {
      client.close();
      let reason: string | undefined;
      if (raw) {
        try {
          reason = (JSON.parse(raw) as { reason?: string }).reason;
        } catch {
          /* non-JSON error body */
        }
      }
      resolve({ token: deviceToken, ok: status === 200, status, reason });
    });
    req.on("error", (err) => {
      client.close();
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

const INVALID_TOKEN_STATUS = 410; // Unregistered / ExpiredToken

async function deactivateToken(token: string): Promise<void> {
  await db
    .update(pushDevices)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(pushDevices.token, token));
}

/** Dispatch a notification to every active iOS device of the given users. */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushDispatchResult> {
  const result: PushDispatchResult = { attempted: 0, sent: 0, failed: 0, deactivated: 0 };
  if (!isApnsConfigured() || userIds.length === 0) return result;

  const devices = await db.query.pushDevices.findMany({
    where: and(
      eq(pushDevices.isActive, true),
      eq(pushDevices.platform, "ios"),
      userIds.length === 1 ? eq(pushDevices.userId, userIds[0]) : inArray(pushDevices.userId, userIds),
    ),
  });

  result.attempted = devices.length;
  if (devices.length === 0) return result;

  await Promise.all(
    devices.map(async (device) => {
      try {
        const res = await sendApnsToDevice(device.token, payload);
        if (res.ok) {
          result.sent += 1;
          return;
        }
        result.failed += 1;
        if (
          res.status === INVALID_TOKEN_STATUS ||
          (res.reason && INVALID_TOKEN_REASONS.has(res.reason))
        ) {
          await deactivateToken(devices.find((d) => d.token === device.token)?.token ?? device.token);
          result.deactivated += 1;
        }
      } catch (err) {
        console.warn("[APNs] device send failed:", err instanceof Error ? err.message : err);
        result.failed += 1;
      }
    }),
  );

  return result;
}

/** Dispatch a notification to every active iOS device of a single user. */
export function sendPushToUser(userId: string, payload: PushPayload): Promise<PushDispatchResult> {
  return sendPushToUsers([userId], payload);
}
