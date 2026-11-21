#!/usr/bin/env node
/**
 * ── Publicar un build iOS en App Store Connect (API oficial) ──
 *
 *   export ASC_KEY_ID=V2PFHS8LHT
 *   export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   export ASC_KEY_PATH=$HOME/.appstoreconnect/private_keys/AuthKey_V2PFHS8LHT.p8
 *
 *   node scripts/asc-release.mjs --bundle com.rabbitty.pos --version 1.3 \
 *     [--build 4] [--whats-new "texto" | --whats-new-file ruta.md] \
 *     [--review-notes "texto" | --review-notes-file ruta.md] \
 *     [--demo-user email] [--demo-pass "PIN/código"] [--review-contact email] \
 *     [--submit] [--testflight] [--yes]
 *
 * Qué hace:
 *   1. Autentica con la API key (JWT ES256).
 *   2. Espera a que el build esté VALID (procesado por Apple).
 *   3. Crea o reutiliza la versión (1.3) y le adjunta el build.
 *   4. Opcional: escribe "Novedades".
 *   5. Opcional: lo manda a revisión (reviewSubmissions).
 *   6. Opcional: informa el estado de TestFlight del build.
 *
 * Nunca imprime la llave. Requiere Node 18+ (fetch incluido).
 */
import { readFileSync, existsSync } from "node:fs";
import { createSign } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

const API = "https://api.appstoreconnect.apple.com";

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, def = null) => {
  const i = argv.indexOf(f);
  if (i < 0) return def;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : def;
};

const bundleId = val("--bundle", "com.rabbitty.pos");
const versionString = val("--version");
const buildNumber = val("--build");
const whatsNew = val("--whats-new") ?? (val("--whats-new-file") ? readFileSync(val("--whats-new-file"), "utf8") : null);
const reviewNotes = val("--review-notes") ?? (val("--review-notes-file") ? readFileSync(val("--review-notes-file"), "utf8") : null);
const demoUser = val("--demo-user");
const demoPass = val("--demo-pass");
const reviewContact = val("--review-contact");
const doSubmit = has("--submit");
const doTestFlight = has("--testflight");
const assumeYes = has("--yes");

if (!versionString) {
  console.error("✗ Falta --version (ej. --version 1.3)");
  process.exit(1);
}

// ── credenciales ────────────────────────────────────────────────────────────
const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const keyPath =
  process.env.ASC_KEY_PATH ||
  path.join(homedir(), ".appstoreconnect", "private_keys", `AuthKey_${keyId}.p8`);

const faltantes = [
  ["ASC_KEY_ID", keyId],
  ["ASC_ISSUER_ID", issuerId],
  ["ASC_KEY_PATH", existsSync(keyPath) ? keyPath : null],
].filter(([, v]) => !v);

if (faltantes.length) {
  console.error("✗ Faltan credenciales:", faltantes.map(([k]) => k).join(", "));
  console.error("  Issuer ID está en App Store Connect → Users and Access → Integrations → App Store Connect API.");
  process.exit(1);
}

// ── JWT (ES256) ─────────────────────────────────────────────────────────────
const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: issuerId, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign("sha256");
  signer.update(unsigned);
  signer.end();
  const key = readFileSync(keyPath, "utf8");
  const sig = signer.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${b64url(sig)}`;
}

async function api(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${makeToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.code}: ${e.detail || e.title}`).join(" | ");
    throw new Error(`${method} ${endpoint} → ${res.status} ${detail || text.slice(0, 300)}`);
  }
  return json;
}

const confirm = async (question) => {
  if (assumeYes) return true;
  process.stdout.write(`${question} [s/N] `);
  const answer = await new Promise((resolve) => {
    process.stdin.once("data", (d) => resolve(String(d).trim().toLowerCase()));
  });
  return answer === "s" || answer === "si" || answer === "y";
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. App ──────────────────────────────────────────────────────────────────
const apps = await api("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=name,bundleId`);
const app = apps.data?.[0];
if (!app) throw new Error(`No encontré la app con bundleId ${bundleId} en esta cuenta/API key.`);
console.log(`▸ App: ${app.attributes.name} (${app.attributes.bundleId})`);

// ── 2. Build procesado ──────────────────────────────────────────────────────
let build = null;
for (let attempt = 1; attempt <= 40 && !build; attempt++) {
  const qs = buildNumber
    ? `filter[version]=${buildNumber}&`
    : "";
  const builds = await api(
    "GET",
    `/v1/builds?${qs}filter[app]=${app.id}&sort=-uploadedDate&limit=5&fields[builds]=version,processingState,uploadedDate,expired`,
  );
  const list = builds.data ?? [];
  const valid = list.find((b) => b.attributes.processingState === "VALID");
  if (valid) {
    build = valid;
    break;
  }
  const state = list[0]?.attributes?.processingState ?? "sin builds";
  console.log(`  … esperando procesamiento (${state}) intento ${attempt}/40`);
  await sleep(30_000);
}
if (!build) throw new Error("El build no quedó VALID. Revisa el correo de Apple o TestFlight activity.");
console.log(`▸ Build listo: ${build.attributes.version} (VALID)`);

// ── 3. Versión + build adjunto ──────────────────────────────────────────────
const versions = await api(
  "GET",
  `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=20&fields[appStoreVersions]=versionString,appStoreState,createdDate`,
);
const existing = (versions.data ?? []).find((v) => v.attributes.versionString === versionString);

let version = existing;
if (!version) {
  const created = await api("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString, releaseType: "AFTER_APPROVAL" },
      relationships: { app: { data: { type: "apps", id: app.id } } },
    },
  });
  version = created.data;
  console.log(`▸ Versión ${versionString} creada (${version.id})`);
} else {
  console.log(`▸ Versión ${versionString} existente · estado ${version.attributes.appStoreState}`);
}

const current = await api("GET", `/v1/appStoreVersions/${version.id}/relationships/build`);
const currentBuildId = current.data?.id;
if (currentBuildId !== build.id) {
  await api("PATCH", `/v1/appStoreVersions/${version.id}`, {
    data: { type: "appStoreVersions", id: version.id, relationships: { build: { data: { type: "builds", id: build.id } } } },
  });
  console.log(`▸ Build ${build.attributes.version} adjuntado a la versión ${versionString}`);
} else {
  console.log(`▸ El build ${build.attributes.version} ya estaba adjunto`);
}

if (whatsNew) {
  // whatsNew vive en la localización de la versión, no en la versión.
  const locs = await api(
    "GET",
    `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale`,
  );
  for (const loc of locs.data ?? []) {
    await api("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew } },
    });
    console.log(`▸ Novedades escritas (${loc.attributes.locale})`);
  }
}

// ── 3b. App Review Information ─────────────────────────────────────────────
if (reviewNotes || demoUser || demoPass || reviewContact) {
  const currentRd = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch(() => null);
  const rdId = currentRd?.data?.id;

  const attributes = {};
  if (reviewNotes) attributes.notes = reviewNotes;
  if (demoUser) {
    attributes.demoAccountName = demoUser;
    attributes.demoAccountRequired = true;
  }
  if (demoPass) attributes.demoAccountPassword = demoPass;
  if (reviewContact) attributes.contactEmail = reviewContact;

  if (rdId) {
    await api("PATCH", `/v1/appStoreReviewDetails/${rdId}`, {
      data: { type: "appStoreReviewDetails", id: rdId, attributes },
    });
    console.log("▸ App Review Information actualizada");
  } else {
    await api("POST", "/v1/appStoreReviewDetails", {
      data: {
        type: "appStoreReviewDetails",
        attributes: { contactEmail: reviewContact || "soporte@rabbitty.me", ...attributes },
        relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } },
      },
    });
    console.log("▸ App Review Information creada");
  }
}

// ── 4. TestFlight (informativo) ─────────────────────────────────────────────
if (doTestFlight) {
  const detail = await api("GET", `/v1/builds/${build.id}/buildBetaDetail`);
  const attr = detail.data?.attributes ?? {};
  console.log(
    `▸ TestFlight: autoNotify=${attr.autoNotifyEnabled} · interno=${attr.internalBuildState ?? "—"} · externo=${attr.externalBuildState ?? "—"}`,
  );
  console.log("  Instalar: App TestFlight → Rabbitty POS. Para externos hace falta Beta App Review.");
}

// ── 5. Enviar a revisión ────────────────────────────────────────────────────
if (doSubmit) {
  const ok = await confirm(`¿Mandar ${versionString} (${build.attributes.version}) a revisión de Apple?`);
  if (!ok) {
    console.log("▸ Cancelado por el usuario. La versión quedó armada con su build.");
    process.exit(0);
  }
  const submission = await api("POST", "/v1/reviewSubmissions", {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: "IOS" },
      relationships: { app: { data: { type: "apps", id: app.id } } },
    },
  });
  const submissionId = submission.data.id;
  await api("POST", "/v1/reviewSubmissionItems", {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: submissionId } },
        appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
      },
    },
  });
  await api("PATCH", `/v1/reviewSubmissions/${submissionId}`, {
    data: { type: "reviewSubmissions", id: submissionId, attributes: { submitted: true } },
  });
  console.log(`✔ Enviado a revisión (submission ${submissionId})`);
} else {
  console.log("▸ Sin --submit: la versión quedó lista para enviar desde App Store Connect.");
}
