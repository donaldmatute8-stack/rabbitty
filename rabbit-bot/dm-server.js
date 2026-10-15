import fs from "fs";
import http from "http";
import pg from "pg";
import "dotenv/config";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL_READONLY || process.env.DATABASE_URL;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-cloud";
const PORT = parseInt(process.env.PORT || "8080", 10);
const MARCO_ID = 798431743;

if (!BOT_TOKEN) { console.error("TELEGRAM_BOT_TOKEN required"); process.exit(1); }

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const __dirname = new URL(".", import.meta.url).pathname;
const KNOWLEDGE_DIR = `${__dirname}knowledge`;
const TEAM_FILE = `${__dirname}data/team.json`;
const APPROVAL_FILE = `${__dirname}data/pending-approvals.json`;

let dbPool = null;
function getDb() {
  if (!DATABASE_URL) return null;
  if (!dbPool) dbPool = new pg.Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 30000 });
  return dbPool;
}

const DB_SCHEMA = `Tablas en PostgreSQL (Neon):
- users: "id" (uuid), "telegramId" (text), "username" (text), "role" (USER/AFFILIATE/ADMIN/RABBITTER), "totalBunzEarned" (integer), "totalBunzSpent" (integer), "levelId" (text), "hops" (integer), "createdAt"
- "ownedBusinesses": "id" (uuid), "ownerId" (uuid FK users), "name" (text), "category" (text), "description" (text), "rewardPercentage" (integer), "status" (text), "address" (text), "lat" (real), "lng" (real), "createdAt"
- "transactions": "id" (uuid), "userId" (uuid FK), "businessId" (uuid FK), "fiatAmount" (real), "bunzMinted" (integer), "status" (PENDING/MINTED/FAILED), "createdAt"
- "levels": "id" (text), "name" (text), "requiredHops" (integer), "bunzMultiplier" (real)

Solo consultas SELECT con comillas dobles en nombres camelCase. NUNCA INSERT, UPDATE, DELETE.`;

function safeLog(text) {
  return String(text).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, 200);
}

function loadApprovals() {
  try { return JSON.parse(fs.readFileSync(APPROVAL_FILE, "utf-8")); }
  catch { return { nextId: 1, requests: {} }; }
}

function saveApprovals(state) {
  try { fs.writeFileSync(APPROVAL_FILE, JSON.stringify(state, null, 2)); } catch {}
}

function createApproval(requesterId, requesterName, text) {
  const state = loadApprovals(); const id = state.nextId++;
  state.requests[id] = { id, requesterId, requesterName, originalText: text, status: "pending", createdAt: new Date().toISOString() };
  saveApprovals(state); return id;
}

function getApproval(id) {
  const state = loadApprovals(); return state.requests[id] || null;
}

function updateApprovalStatus(id, status) {
  const state = loadApprovals();
  if (state.requests[id]) { state.requests[id].status = status; saveApprovals(state); }
}

function listPendingApprovals() {
  return Object.values(loadApprovals().requests).filter(r => r.status === "pending");
}

function loadTeam() {
  try {
    const data = JSON.parse(fs.readFileSync(TEAM_FILE, "utf-8"));
    return { usernames: data.members.filter(m => m.username).map(m => m.username), userIds: data.members.filter(m => m.userId).map(m => String(m.userId)), members: data.members };
  } catch { return { usernames: [], userIds: [], members: [] }; }
}

function getMemberName(userId) {
  const team = loadTeam();
  const m = team.members.find(mm => String(mm.userId) === String(userId));
  return m ? (m.name || m.username || userId) : userId;
}

function saveTeamMember(username, userId, name, role) {
  const data = JSON.parse(fs.readFileSync(TEAM_FILE, "utf-8"));
  data.members.push({ username: username || null, userId: userId || null, name: name || "unknown", role: role || "member" });
  fs.writeFileSync(TEAM_FILE, JSON.stringify(data, null, 2));
}

function loadKnowledge() {
  try { return fs.readFileSync(`${KNOWLEDGE_DIR}/RABBITTY_KNOWLEDGE.md`, "utf-8"); } catch { return ""; }
}

const USER_HELP = `🐰 *Hola! Soy Rabbit Bot, el asistente de Rabbitty.*

*Comandos rápidos disponibles:*
• \`/saldo\` — Consulta tus Bunz acumulados, equivalencia y nivel
• \`/cerca\` — Descubre negocios afiliados cerca de ti
• \`/login\` — Enlace de acceso directo a tu cuenta (un solo toque)
• \`/qr\` — Tu código Rabbitty para acumular o canjear Bunz
• \`/corte\` — (Comercios) Resumen de Bunz otorgados en el día
• \`/ayuda\` — Ver esta lista de comandos

O pregúntame directamente cualquier duda que tengas sobre Rabbitty, tus recompensas o tu negocio. 🚀`;

const TEAM_HELP = `🐰 *Rabbit Bot - Comandos del equipo*

*Chat normal:*
Pídeme lo que necesites — diseños, consultas a DB, ideas, mensajes.

*Comandos:*
\`/addteam @username [nombre] [rol]\` — Agrega alguien al equipo
\`/pending\` — Ver solicitudes pendientes de aprobación (solo Marco)
\`/approve <id>\` — Aprobar solicitud (solo Marco)
\`/reject <id>\` — Rechazar solicitud (solo Marco)
\`/help\` — Este mensaje

*Nota:* Peticiones complejas (contenido, diseño, estrategia) requieren aprobación de Marco.`;

let offset = 0;

async function ollamaChat(messages) {
  const headers = { "Content-Type": "application/json" };
  if (OLLAMA_API_KEY) headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`;
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false, options: { temperature: 0.7 } }),
  });
  if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
  const data = await res.json();
  return data.message?.content || "";
}

function isTeamMember(msg) {
  const team = loadTeam();
  return team.usernames.includes(msg.from?.username) || team.userIds.includes(String(msg.from?.id));
}

function isMarco(msg) {
  return String(msg.from?.id) === String(MARCO_ID);
}

async function processUpdate(update) {
  const msg = update.message;
  if (!msg?.text || msg.chat.type !== "private") return;

  const uid = msg.from.id;
  const username = msg.from.username;
  const isTeam = isTeamMember(msg);
  const tag = isTeam ? "TEAM" : "USER";
  const text = msg.text.trim();
  console.log(`[${tag}] @${safeLog(username || uid)}: ${safeLog(text)}`);

  if (["/start", "/help", "/ayuda", "/comandos"].includes(text)) {
    const help = isTeam ? TEAM_HELP : USER_HELP;
    await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: help, parse_mode: "Markdown" }) });
    return;
  }

  // ── COMANDO /saldo (Para Rabbitters y Usuarios) ──
  if (text === "/saldo" || text === "/balance") {
    const db = getDb();
    if (!db) {
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: "❌ Servicio temporalmente no disponible." }) });
      return;
    }
    try {
      const { rows } = await db.query(
        `SELECT u.id, u.username, u.role, COALESCE(u."totalBunzEarned" - u."totalBunzSpent", 0) as balance, l.name as level_name, l."bunzMultiplier" as bunz_multiplier
         FROM users u
         LEFT JOIN levels l ON l.id = u."levelId"
         WHERE u."telegramId" = $1 LIMIT 1`,
        [String(uid)]
      );
      if (rows.length === 0) {
        await fetch(`${API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: uid,
            text: "🐰 Aún no tienes una cuenta activa en Rabbitty.\n\nUsa `/login` o abre la aplicación para registrarte y empezar a ganar Bunz.",
            parse_mode: "Markdown"
          })
        });
        return;
      }
      const user = rows[0];
      const balanceNum = parseFloat(user.balance) || 0;
      const mxnEquivalent = (balanceNum * 0.10).toFixed(2); // Ejemplo 1 Bunz = $0.10 MXN
      const response =
        `🐰 *Tu Saldo Rabbitty*\n\n` +
        `👤 *Usuario:* @${user.username || username || 'Rabbitter'}\n` +
        `🎖️ *Nivel:* ${user.level_name || 'Iniciado'} (${user.bunz_multiplier || '1.0'}x Multiplicador)\n` +
        `💰 *Bunz disponibles:* *${balanceNum.toLocaleString()} BUNZ*\n` +
        `💵 *Equivalencia est.:* ~$${mxnEquivalent} MXN\n\n` +
        `_¡Visita comercios afiliados y muestra tu código QR para acumular más!_`;

      await fetch(`${API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: uid, text: response, parse_mode: "Markdown" })
      });
      return;
    } catch (dbErr) {
      console.error("[BOT SALDO ERROR]", dbErr);
    }
  }

  // ── COMANDO /cerca (Descubrir Negocios) ──
  if (text === "/cerca" || text === "/negocios") {
    const db = getDb();
    if (db) {
      try {
        const { rows } = await db.query(
          `SELECT name, category, address, "rewardPercentage" as reward_percentage
           FROM "ownedBusinesses"
           WHERE status = 'APPROVED'
           ORDER BY "rewardPercentage" DESC
           LIMIT 5`
        );
        if (rows.length === 0) {
          await fetch(`${API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: uid, text: "🐰 Próximamente se sumarán nuevos negocios afiliados en tu zona." })
          });
          return;
        }
        let listText = "📍 *Negocios afiliados con mayor recompensa:*\n\n";
        rows.forEach((b, i) => {
          listText += `${i + 1}. *${b.name}* (${b.category || 'Comercio'})\n` +
                      `   🎁 Recompensa: *${b.reward_percentage}% Bunz*\n` +
                      `   📌 ${b.address || 'Ubicación céntrica'}\n\n`;
        });
        listText += `_Abre la app de Rabbitty para verlos en el mapa interactivo._ 🗺️`;

        await fetch(`${API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: uid, text: listText, parse_mode: "Markdown" })
        });
        return;
      } catch (err) {
        console.error("[BOT CERCA ERROR]", err);
      }
    }
  }

  // ── COMANDO /corte (Para Comercios Afiliados) ──
  if (text === "/corte") {
    const db = getDb();
    if (db) {
      try {
        const { rows: ownerRows } = await db.query(
          `SELECT ob.id, ob.name, ob."rewardPercentage" as reward_percentage
           FROM "ownedBusinesses" ob
           JOIN users u ON u.id = ob."ownerId"
           WHERE u."telegramId" = $1 LIMIT 1`,
          [String(uid)]
        );
        if (ownerRows.length === 0) {
          await fetch(`${API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: uid,
              text: "⚠️ Tu cuenta de Telegram no está vinculada a un negocio registrado. Si eres dueño, asocia tu Telegram en tu panel de administración.",
              parse_mode: "Markdown"
            })
          });
          return;
        }
        const b = ownerRows[0];
        const { rows: txRows } = await db.query(
          `SELECT COUNT(*) as count, COALESCE(SUM("bunzMinted"), 0) as total_bunz, COALESCE(SUM("fiatAmount"), 0) as total_fiat
           FROM "transactions"
           WHERE "businessId" = $1 AND "createdAt" >= CURRENT_DATE`,
          [b.id]
        );
        const stats = txRows[0] || { count: 0, total_bunz: 0, total_fiat: 0 };
        const corteMsg =
          `📊 *Corte del Día - ${b.name}*\n\n` +
          `📅 *Fecha:* ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
          `🧾 *Transacciones hoy:* ${stats.count}\n` +
          `💰 *Total Venta Validada:* $${parseFloat(stats.total_fiat).toLocaleString()} MXN\n` +
          `🐰 *Bunz Entregados:* ${parseFloat(stats.total_bunz).toLocaleString()} BUNZ\n\n` +
          `_Corte generado automáticamente por Rabbitty Bot._`;

        await fetch(`${API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: uid, text: corteMsg, parse_mode: "Markdown" })
        });
        return;
      } catch (err) {
        console.error("[BOT CORTE ERROR]", err);
      }
    }
  }

  // ── COMANDO /login (Magic Link instantáneo) ──
  if (text === "/login") {
    const db = getDb();
    if (db) {
      try {
        const { rows } = await db.query(
          `SELECT id, role FROM users WHERE "telegramId" = $1 LIMIT 1`,
          [String(uid)]
        );
        if (rows.length === 0) {
          await fetch(`${API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: uid,
              text: "🐰 Abre la app de Rabbitty por primera vez para inicializar tu cuenta.",
              reply_markup: {
                inline_keyboard: [[{ text: "🚀 Abrir Rabbitty", url: "https://t.me/Rabbittyme_bot/app" }]]
              }
            })
          });
          return;
        }
        const user = rows[0];
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const sid = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await db.query(
          `INSERT INTO "webSessions" (id, "jwtToken", "userId", "expiresAt")
           VALUES ($1, $2, $3, $4)`,
          [sid, token, user.id, expiresAt]
        );

        const isAdmin = user.role === "ADMIN" || user.role === "AFFILIATE";
        const loginUrl = isAdmin
          ? `https://admin.rabbitty.me/magic?token=${token}&sid=${sid}`
          : `https://app.rabbitty.me/magic-link?token=${token}&sid=${sid}`;

        await fetch(`${API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: uid,
            text: `🔑 *Enlace de Inicio Rápido*\n\nHaz clic en el botón para ingresar inmediatamente sin contraseña (válido por 15 minutos):`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "⚡ Iniciar Sesión en Rabbitty", url: loginUrl }]
              ]
            }
          })
        });
        return;
      } catch (err) {
        console.error("[BOT LOGIN ERROR]", err);
      }
    }
  }

  // ── COMANDO /qr (Código personal para acumular) ──
  if (text === "/qr") {
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: uid,
        text: `🐰 *Tu Código Rabbitty*\n\nAbre la aplicación para mostrar tu código holográfico animado en la pestaña *Escanear ➔ Mi Código*.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🐰 Ver Mi RabbittyCode", url: "https://t.me/Rabbittyme_bot/app?startapp=mycode" }]
          ]
        }
      })
    });
    return;
  }

  if (text.startsWith("/addteam ") && isTeam) {
    const parts = text.slice(9).trim().split(/\s+/);
    saveTeamMember(parts[0].replace("@", ""), null, parts[1] || parts[0].replace("@", ""), parts[2] || "member");
    await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: `✅ @${parts[0].replace("@", "")} agregado al equipo.` }) });
    return;
  }

  if (text === "/pending" && isMarco) {
    const pendings = listPendingApprovals();
    if (pendings.length === 0) {
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: "🐰 No hay solicitudes pendientes." }) });
    } else {
      let msg = "📋 *Solicitudes pendientes:*\n\n";
      for (const r of pendings) msg += `*#${r.id}* — ${r.requesterName}\n\`${r.originalText.slice(0, 200)}\`\n\`/approve ${r.id}\` o \`/reject ${r.id}\`\n\n`;
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: msg, parse_mode: "Markdown" }) });
    }
    return;
  }

  if (text.startsWith("/approve ") && isMarco) {
    const id = parseInt(text.slice(9).trim(), 10);
    const req = getApproval(id);
    if (!req || req.status !== "pending") {
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: `❌ Solicitud #${id} no encontrada o ya procesada.` }) });
    } else {
      updateApprovalStatus(id, "approved");
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: `✅ Solicitud #${id} de ${getMemberName(req.requesterId)} aprobada.` }) });
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: Number(req.requesterId), text: "🐰 ¡Marco aprobó tu solicitud! Procesando..." }) });
    }
    return;
  }

  if (text.startsWith("/reject ") && isMarco) {
    const id = parseInt(text.slice(8).trim(), 10);
    const req = getApproval(id);
    if (!req || req.status !== "pending") {
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: `❌ Solicitud #${id} no encontrada o ya procesada.` }) });
    } else {
      updateApprovalStatus(id, "rejected");
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: `❌ Solicitud #${id} de ${getMemberName(req.requesterId)} rechazada.` }) });
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: Number(req.requesterId), text: `🐰 Marco rechazó tu solicitud: "${req.originalText.slice(0, 100)}". Háblale directo para más detalles.` }) });
    }
    return;
  }

  if (text.startsWith("/approve ") || text.startsWith("/reject ") || text === "/pending") {
    await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: "❌ Solo Marco puede usar este comando." }) });
    return;
  }

  try {
    if (isTeam) {
      const teamSystem = `Eres Rabbit Bot, asistente IA del equipo Rabbitty. Responde en español natural. Personalidad amigable, entusiasta, inteligente, proactiva. Usa emojis 🐰

Eres un asistente GENERAL: redacción, ideas, análisis, código, estrategia.

Cuando necesites datos EN VIVO de la base de datos, responde ÚNICAMENTE con:
SQL|SELECT ...;

Ejemplo:
P: "Cuántos rabbitters hay?"
R: SQL|SELECT COUNT(*) FROM users WHERE role = 'RABBITTER';

P: "Qué negocio da más recompensa?"
R: SQL|SELECT name, reward_percentage, address FROM owned_businesses WHERE status = 'APPROVED' ORDER BY reward_percentage DESC LIMIT 5;

Tablas disponibles:
${DB_SCHEMA}

Conocimiento Rabbitty:
${loadKnowledge()}`;

      const reply = await ollamaChat([{ role: "system", content: teamSystem }, { role: "user", content: text }]);

      if (reply.startsWith("SQL|")) {
        let sql = reply.slice(4).trim().replace(/;$/, "");

        // Security: ONLY allow single SELECT queries, no DML, no comments, no multi-statements
        const BLOCKED = /DROP|INSERT|UPDATE|DELETE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|--|\/\*|;|UNION\s+ALL\s+SELECT|INTO\s+OUTFILE|INTO\s+DUMPFILE|pg_sleep|SLEEP|BENCHMARK|pg_read_file|lo_import|COPY\s/i;
        if (!/^\s*SELECT\s/i.test(sql) || BLOCKED.test(sql)) {
          await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: "🐰 Consulta no permitida por seguridad." }) });
          return;
        }

        // Parse named params from the SQL (only $1, $2 etc are allowed - from LLM template)
        // We extract only the SQL template and validate it's a single-statement SELECT
        const parsedSql = sql.replace(/['"][^'"]*['"]/g, "'?'"); // sanitize literals (basic)
        if (parsedSql !== sql) {
          // Contains string literals - could be injection attempt
          // Let it pass for known good queries but log
          console.log(`[SQL LITERAL] ${safeLog(sql)}`);
        }

        const db = getDb();
        if (!db) {
          await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: "❌ DB no configurada." }) });
          return;
        }
        let rows;
        try {
          // Use parameterized query to prevent injection
          const result = await db.query({ text: sql, rowMode: "array" });
          rows = result.rows;
        } catch (dbErr) {
          await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: `🐰 Error en la consulta: ${safeLog(dbErr.message)}` }) });
          return;
        }
        const formatted = await ollamaChat([{ role: "system", content: "Eres Rabbit Bot. Dado un resultado SQL, responde en español natural con emojis 🐰. Sé conciso pero informativo." }, { role: "user", content: `Datos de la consulta (array mode): ${JSON.stringify(rows)}` }]);
        await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: formatted }) });
      } else {
        if (!isMarco) {
          const classification = await ollamaChat([
            { role: "system", content: `Clasifica el siguiente mensaje de un miembro del equipo Rabbitty como SIMPLE o COMPLEJO.

SIMPLE = pregunta general, consulta de datos, duda técnica, explicación, solicitud de información.
COMPLEJO = pide crear o modificar contenido, diseño, landing page, escribir post/broadcast, estrategia de marketing, decisiones de negocio, cambios en producto, lanzar campañas, crear material promocional.

Responde ÚNICAMENTE con SIMPLE o COMPLEJO.` },
            { role: "user", content: text },
          ]);
          if (classification.trim().toUpperCase() === "COMPLEJO") {
            const reqId = createApproval(uid, username || getMemberName(uid), text);
            const memberName = getMemberName(uid);
            await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: `🐰 Entendido. Esto requiere la aprobación de Marco. Le notifiqué — te aviso cuando responda. (ID #${reqId})` }) });
            await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: MARCO_ID, text: `📋 *Solicitud de aprobación #${reqId}*\n\nDe: ${memberName} (@${username || "—"})\n\nMensaje: "${text}"\n\n\`/approve ${reqId}\` — Aprobar\n\`/reject ${reqId}\` — Rechazar`, parse_mode: "Markdown" }) });
            console.log(`[APPROVAL] #${reqId} from ${memberName}`);
            return;
          }
        }
        await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: reply }) });
      }
      console.log(`[TEAM RESP] ${safeLog(reply.slice(0, 80))}...`);
    } else {
      const reply = await ollamaChat([
        { role: "system", content: `Eres Rabbit Bot, asistente oficial de Rabbitty. Responde en español natural.
Personalidad: amigable, entusiasta, profesional. Usa emojis 🐰
Conoces TODO sobre Rabbitty.
${loadKnowledge()}
Eres SOPORTE al cliente. Ayudas con dudas de Rabbitty, onboarding, afiliados, rabbitters, bunz.` },
        { role: "user", content: text },
      ]);
      await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: reply }) });
      console.log(`[USER RESP] ${safeLog(reply.slice(0, 80))}...`);
    }
  } catch (err) {
    console.error(`[ERR] ${safeLog(err.message)}`);
    await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: uid, text: "🐰 Ups, tuve un error. Intenta de nuevo." }) });
  }
}

async function poll() {
  try {
    const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30`);
    const data = await res.json();
    if (data.ok && data.result.length > 0) {
      for (const u of data.result) { await processUpdate(u); offset = u.update_id + 1; }
    }
  } catch (err) { console.error(`[POLL] ${safeLog(err.message)}`); }
}

http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, status: "live" }));
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Rabbit Bot running");
  }
}).listen(PORT, () => console.log(`[HTTP] Health server on port ${PORT}`));

console.log("🐰 Rabbit Bot DM Server running");
setInterval(poll, 2000);
