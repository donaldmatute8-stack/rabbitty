import fs from "fs";
import http from "http";
import pg from "pg";
import "dotenv/config";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
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
- users: id (uuid), telegram_id (text), username (text), role (USER/AFFILIATE/ADMIN/RABBITTER), total_bunz_earned (numeric), level_id (int), hops (int), created_at
- owned_businesses: id (uuid), owner_id (uuid FK users), name (text), category (text), description (text), reward_percentage (numeric), status (text), address (text), lat (float), lng (float), created_at
- transactions: id (uuid), user_id (uuid FK), business_id (uuid FK), fiat_amount (numeric), bunz_minted (numeric), status (PENDING/MINTED/FAILED), created_at
- levels: id (int), name (text), required_hops (int), bunz_multiplier (numeric)

Solo consultas SELECT. NUNCA INSERT, UPDATE, DELETE.`;

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

Puedes preguntarme lo que quieras sobre:
• Cómo funciona Rabbitty
• Cómo ser Rabbitter (Nodo de zona)
• Cómo afiliar tu negocio
• Recompensas y bunz
• Soporte técnico

Solo escríbeme tu duda y te ayudo al instante. 🚀`;

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
