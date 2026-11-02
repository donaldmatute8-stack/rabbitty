/**
 * ── FCM sender (P3, Android) ── firebase-admin con cuenta de servicio.
 * Auth por env: FIREBASE_SERVICE_ACCOUNT (JSON string completo) o las 3 vars
 * (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).
 * Config del proyecto: el usuario agrega google-services.json al build Android
 * (rebuild nativo) — el servidor solo necesita la cuenta de servicio.
 */

import * as adminApp from "firebase-admin/app";
import * as adminRoot from "firebase-admin";
import * as adminMessaging from "firebase-admin/messaging";
import type { PushPayload } from "@/lib/push/apns";

export interface FcmResult {
  ok: boolean;
  status: number; // 200 aceptada · 404 token muerto · 500 otro error
  reason?: string;
}

let app: adminApp.App | null = null;

function getApp(): adminApp.App | null {
  if (app) return app;

  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  try {
    if (svcJson) {
      const parsed = JSON.parse(svcJson);
      app = adminApp.initializeApp({
        credential: adminRoot.cert(parsed),
        projectId: parsed.project_id ?? projectId,
      });
    } else if (projectId && clientEmail && privateKey) {
      app = adminApp.initializeApp({
        credential: adminRoot.cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
    }
  } catch (err) {
    console.warn("[FCM] init falló:", err instanceof Error ? err.message : err);
    app = null;
  }
  return app;
}

export function isFcmConfigured(): boolean {
  return getApp() !== null;
}

export async function sendFcmToDevice(
  deviceToken: string,
  payload: PushPayload
): Promise<FcmResult> {
  const firebaseApp = getApp();
  if (!firebaseApp) return { ok: false, status: 500, reason: "FCM_NOT_CONFIGURED" };

  try {
    const messaging = adminMessaging.getMessaging(firebaseApp);
    await messaging.send({
      token: deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data as Record<string, string>,
      android: {
        priority: "high",
        notification: {
          channelId: payload.data?.type === "CHAT" ? "chat" : "rewards",
        },
      },
    });
    return { ok: true, status: 200 };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const status = e.code === "messaging/registration-token-not-registered" ? 404 : 500;
    return { ok: false, status, reason: e.code || e.message };
  }
}