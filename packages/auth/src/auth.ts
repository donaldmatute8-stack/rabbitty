import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import crypto from "crypto";
import { createHash } from "crypto";

const tokens = new Map<string, { token: string; expires: Date }>();
const users = new Map<string, { id: string; email: string; emailVerified: Date | null }>();

const customAdapter: any = {
  createUser: async (user: any) => {
    const newUser = { ...user, id: user.id || Math.random().toString(), emailVerified: user.emailVerified || null };
    users.set(newUser.email, newUser);
    return newUser;
  },
  getUser: async (id: string) => {
    for (const user of users.values()) {
      if (user.id === id) return user;
    }
    return null;
  },
  getUserByEmail: async (email: string) => {
    return users.get(email) ?? null;
  },
  getUserByAccount: async () => null,
  createVerificationToken: async (verificationToken: any) => {
    tokens.set(`${verificationToken.identifier}:${verificationToken.token}`, {
      token: verificationToken.token,
      expires: verificationToken.expires,
    });
    return verificationToken;
  },
  useVerificationToken: async ({ identifier, token }: any) => {
    const key = `${identifier}:${token}`;
    const stored = tokens.get(key);
    if (stored) {
      tokens.delete(key);
      return { identifier, token, expires: stored.expires };
    }
    return null;
  },
};

const authResult = NextAuth({
  adapter: customAdapter,
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "rabbitty-admin-secret-key-32chars-minimum-length",
  providers: [
    Resend({
      from: process.env.AUTH_RESEND_FROM || "Rabbitty Team <hola@rabbitty.me>",
      apiKey: process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY,
      async sendVerificationRequest({ identifier: email, url }) {
        const apiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY;
        if (!apiKey) {
          console.error("[Auth Resend] API Key no encontrada");
          return;
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.ORIGIN || "https://admin.rabbitty.me";
        const finalUrl = url.replace(/http:\/\/(localhost|127\.0\.0\.1):\d+/g, appUrl);

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso Mágico - Rabbitty Admin</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050508; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050508; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #0e0e14; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          <!-- Header Logo -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); border-radius: 16px; padding: 12px 20px;">
                    <span style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">RABBITTY ADMIN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom: 16px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">Acceso Mágico a tu Panel</h1>
            </td>
          </tr>

          <!-- Description -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #a1a1aa;">
                Has solicitado un enlace directo para ingresar a tu panel de administración con la cuenta <strong style="color: #ffffff;">${email}</strong>.
              </p>
            </td>
          </tr>

          <!-- Button CTA -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${finalUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 36px; border-radius: 14px; box-shadow: 0 8px 25px rgba(236,72,153,0.35);">
                🚀 Ingresar a mi Panel de Administración
              </a>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td align="center" style="border-t: 1px solid rgba(255,255,255,0.08); padding-top: 24px;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #71717a;">
                Si no solicitaste este correo, puedes ignorarlo de manera segura. El enlace expirará automáticamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.AUTH_RESEND_FROM || "Rabbitty Team <hola@rabbitty.me>",
              to: email,
              subject: "🔑 Acceso Mágico a tu Panel - Rabbitty Admin",
              html,
            }),
          });
          const data = await res.json();
          console.log("[Auth Resend] Email enviado:", data);
        } catch (err) {
          console.error("[Auth Resend Error]:", err);
        }
      },
    }),
    ...(process.env.E2E_TEST === "true" ? [
      Credentials({
        id: "test-e2e",
        name: "E2E Test",
        credentials: {
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (credentials?.password === "test") {
            return { id: "e2e-test-user", name: "E2E Tester", email: "e2e@test.me" };
          }
          return null;
        },
      }),
    ] : []),
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: { label: "Telegram ID", type: "text" },
        username: { label: "Username", type: "text" },
        firstName: { label: "First Name", type: "text" },
        lastName: { label: "Last Name", type: "text" },
        photoUrl: { label: "Photo URL", type: "text" },
        authDate: { label: "Auth Date", type: "text" },
        hash: { label: "Hash", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.id || !credentials?.hash) return null;

        const botToken = process.env.AUTH_TELEGRAM_BOT_TOKEN;
        if (!botToken) return null;

        const dataCheckString = [
          `auth_date=${credentials.authDate ?? ""}`,
          `first_name=${credentials.firstName ?? ""}`,
          `id=${credentials.id}`,
          ...(credentials.lastName ? [`last_name=${credentials.lastName}`] : []),
          ...(credentials.photoUrl ? [`photo_url=${credentials.photoUrl}`] : []),
          `username=${credentials.username ?? ""}`,
        ].join("\n");

        const secretKey = crypto.createHash("sha256").update(botToken).digest();
        const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

        if (computedHash !== credentials.hash) return null;

        const authDate = parseInt(credentials.authDate as string, 10);
        if (Number.isNaN(authDate) || Date.now() / 1000 - authDate > 86400) return null;

        return {
          id: credentials.id as string,
          name: [credentials.firstName, credentials.lastName].filter(Boolean).join(" "),
          email: `${credentials.id}@telegram.rabbitty`,
          image: (credentials.photoUrl as string) ?? undefined,
        };
      },
    }),
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
        sid: { label: "Session ID", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.sid) return null;

        const DEFAULT_NEON_URL = "postgresql://neondb_owner:npg_ltE02YwbyAaP@ep-delicate-violet-ap6izh0k-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";
        const coreDbUrl = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || DEFAULT_NEON_URL;

        try {
          const { default: pg } = await import("pg");
          const { Pool } = pg;
          const pool = new Pool({ connectionString: coreDbUrl });
          const jwtToken = createHash("sha256").update(credentials.token as string).digest("hex");

          const result = await pool.query(
            `SELECT ws."userId", u."telegramId", u."firstName", u."lastName", u."username"
             FROM "webSessions" ws
             JOIN "users" u ON u."id" = ws."userId"
             WHERE ws."id" = $1 AND ws."jwtToken" = $2 AND ws."expiresAt" > NOW()
             LIMIT 1`,
            [credentials.sid, jwtToken]
          );

          await pool.end();

          if (result.rows.length === 0) {
            console.warn('[Magic Link Auth] Session not found or expired:', { sid: credentials.sid });
            return null;
          }

          const user = result.rows[0];
          return {
            id: user.telegramId,
            name: [user.firstName, user.lastName].filter(Boolean).join(" "),
            email: `${user.telegramId}@telegram.rabbitty`,
          };
        } catch (err) {
          console.error('[Magic Link Auth Error]:', err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
}) as any;

export const auth = authResult.auth;
export const handlers = authResult.handlers;
export const signIn = authResult.signIn;
export const signOut = authResult.signOut;
