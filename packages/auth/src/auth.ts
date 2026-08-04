import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import crypto, { createHash } from "crypto";
import { getCoreDb } from "@rabbitty/api/db";
import { verificationTokens } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";

if (!process.env.AUTH_URL || process.env.AUTH_URL.includes("localhost")) {
  process.env.AUTH_URL = "https://admin.rabbitty.me";
}
if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost")) {
  process.env.NEXTAUTH_URL = "https://admin.rabbitty.me";
}

// DB-backed admin user store (for email/magic link authentication)
const NEON_URL = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL
  || "postgresql://neondb_owner:npg_ltE02YwbyAaP@ep-delicate-violet-ap6izh0k-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function getPool() {
  const { default: pg } = await import("pg");
  const { Pool } = pg;
  return new Pool({ connectionString: NEON_URL, max: 3 });
}

// Ensure admin_auth_users table exists
async function ensureAdminUsersTable() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "adminAuthUsers" (
      "id" text PRIMARY KEY,
      "email" text NOT NULL UNIQUE,
      "emailVerified" timestamptz,
      "name" text,
      "image" text,
      "createdAt" timestamptz DEFAULT now()
    )
  `);
  await pool.end();
}

// Run once at startup
ensureAdminUsersTable().catch(e => console.error("[Auth] Failed to ensure adminAuthUsers table:", e));

const customAdapter: any = {
  createUser: async (user: any) => {
    const newUser = {
      id: user.id || crypto.randomUUID(),
      email: user.email,
      emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
      name: user.name ?? null,
      image: user.image ?? null,
    };
    try {
      const pool = await getPool();
      await pool.query(
        `INSERT INTO "adminAuthUsers" ("id", "email", "emailVerified", "name", "image")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("email") DO UPDATE SET "emailVerified" = EXCLUDED."emailVerified"`,
        [newUser.id, newUser.email, newUser.emailVerified, newUser.name, newUser.image]
      );
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "email" = $1`, [newUser.email]);
      await pool.end();
      return result.rows[0] ?? newUser;
    } catch (e) {
      console.error("[Auth DB] createUser error:", e);
      return newUser;
    }
  },
  getUser: async (id: string) => {
    try {
      const pool = await getPool();
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "id" = $1`, [id]);
      await pool.end();
      return result.rows[0] ?? null;
    } catch {
      return null;
    }
  },
  getUserByEmail: async (email: string) => {
    try {
      const pool = await getPool();
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "email" = $1`, [email]);
      await pool.end();
      return result.rows[0] ?? null;
    } catch {
      return null;
    }
  },
  getUserByAccount: async () => null,
  updateUser: async (user: any) => {
    try {
      const pool = await getPool();
      await pool.query(
        `UPDATE "adminAuthUsers" SET "emailVerified" = $1, "name" = $2 WHERE "id" = $3`,
        [user.emailVerified ?? null, user.name ?? null, user.id]
      );
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "id" = $1`, [user.id]);
      await pool.end();
      return result.rows[0] ?? user;
    } catch {
      return user;
    }
  },
  // Required by NextAuth when using Email provider — must exist even if empty
  linkAccount: async () => null,
  createVerificationToken: async (verificationToken: any) => {
    try {
      const db = getCoreDb();
      await db.insert(verificationTokens).values({
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: new Date(verificationToken.expires),
      }).onConflictDoNothing();
    } catch (e) {
      console.error("[Auth DB Error] Error saving verification token:", e);
    }
    return verificationToken;
  },
  useVerificationToken: async ({ identifier, token }: any) => {
    try {
      const db = getCoreDb();
      const [stored] = await db
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.token, token));
      if (stored) {
        await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
        return { identifier: stored.identifier, token: stored.token, expires: stored.expires };
      }
    } catch (e) {
      console.error("[Auth DB Error] Error using verification token:", e);
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

        const targetOrigin = "https://admin.rabbitty.me";
        let finalUrl = url;

        try {
          const parsedUrl = new URL(url);
          parsedUrl.searchParams.set("callbackUrl", targetOrigin);
          finalUrl = `${targetOrigin}${parsedUrl.pathname}?${parsedUrl.searchParams.toString()}`;
        } catch {
          finalUrl = url.replace(/https?:\/\/[^/]+/gi, targetOrigin);
        }

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
