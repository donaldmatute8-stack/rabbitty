#!/usr/bin/env node
/**
 * Sitio de auditoría READ-ONLY con Basic Auth.
 *
 * Solo sirve archivos estáticos del directorio `audit/`.
 * No tiene acceso a Rabbitty, ni a base de datos, ni a secretos.
 *
 * Dos modos, uno obligatorio:
 *   A) AUDIT_TOKEN=…  → enlace no adivinable: /t/<token>/…   (sin contraseña)
 *   B) AUDIT_USER + AUDIT_PASS → Basic Auth
 * Si AUDIT_TOKEN está definido, manda el token y no se pide contraseña.
 *
 * Variables:
 *   AUDIT_TOKEN (modo enlace)
 *   AUDIT_USER, AUDIT_PASS (modo basic)
 *   PORT        (Railway la inyecta)
 *   AUDIT_DIR   (default: el directorio de este archivo)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(process.env.AUDIT_DIR || HERE);
const USER = process.env.AUDIT_USER;
const PASS = process.env.AUDIT_PASS;
const TOKEN = (process.env.AUDIT_TOKEN || "").trim();
const PORT = Number(process.env.PORT || 8080);

if (!TOKEN && (!USER || !PASS)) {
  console.error("faltan credenciales: define AUDIT_TOKEN, o AUDIT_USER + AUDIT_PASS");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".zip": "application/zip",
  ".ts": "text/plain; charset=utf-8",
  ".tsx": "text/plain; charset=utf-8",
  ".mjs": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

const ROUTES = {
  "/": "index.html",
  "/bundle.md": "audit-bundle.md",
  "/bundle.zip": "audit-bundle.zip",
  "/manifest.json": "manifest.json",
};

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function authorized(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return timingSafeEqual(user, USER) && timingSafeEqual(pass, PASS);
}

function safeFile(rel) {
  const full = path.resolve(DIR, rel);
  if (full !== DIR && !full.startsWith(DIR + path.sep)) return null;
  try {
    const st = fs.lstatSync(full);
    if (!st.isFile() || st.isSymbolicLink()) return null;
    return full;
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://x");
  const raw = url.pathname;

  let rest;
  if (TOKEN) {
    const prefix = `/t/${TOKEN}`;
    // Acepta enlaces mal formados que contienen el token sin el prefijo /t/
    // (p. ej. /t-TOKEN o /TOKEN) y redirige al enlace canónico.
    if (!raw.startsWith(prefix) && raw.includes(TOKEN)) {
      const tail = raw.split(TOKEN)[1] || "/";
      const location = `${prefix}${tail.startsWith("/") ? tail : `/${tail}`}`;
      res.writeHead(301, { location });
      res.end();
      return;
    }
    if (raw === prefix) {
      // barra final para que los enlaces relativos resuelvan bajo el token
      res.writeHead(301, { location: `${prefix}/` });
      res.end();
      return;
    }
    if (!raw.startsWith(`${prefix}/`)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    rest = raw.slice(prefix.length);
  } else {
    if (!authorized(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="audit", charset="UTF-8"' });
      res.end("401");
      return;
    }
    rest = raw;
  }

  let target = ROUTES[rest];
  if (!target && rest.startsWith("/files/")) {
    // Los archivos viven bajo audit/files/: no se puede perder ese prefijo.
    target = "files/" + decodeURIComponent(rest.slice("/files/".length));
  }

  if (!target) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404");
    return;
  }

  const full = safeFile(target);
  if (!full) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404");
    return;
  }

  const body = fs.readFileSync(full);
  res.writeHead(200, {
    "content-type": MIME[path.extname(full)] || "application/octet-stream",
    "content-length": body.length,
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow, noarchive",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  });
  res.end(body);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`audit site en http://0.0.0.0:${PORT} · dir ${DIR}`);
});
