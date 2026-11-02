# Plan Estratégico para Llevar Bunzy al Nivel Institucional, Supremo y Omnipresente

> Documento integral con diagnóstico, arquitectura, RAG+MAG, Identidad Canónica, Wallet Blockchain, IPFS, Fiat/Card y Roadmap de implementación por fases.

## Índice
- [1. Estado actual de Bunzy (diagnóstico)](#1-estado-actual-de-bunzy-diagnóstico)
- [2. RAG + MAG (cómo hacer que aprenda de los usuarios)](#2-rag--mag-cómo-hacer-que-aprenda-de-los-usuarios)
  - [2.1 RAG (Retrieval-Augmented Generation)](#21-rag-retrieval-augmented-generation)
  - [2.2 MAG (Memory-Augmented Generation)](#22-mag-memory-augmented-generation)
- [3. IPFS: ¿dónde SÍ y dónde NO usarlo?](#3-ipfs-dónde-sí-y-dónde-no-usarlo)
- [4. Identidad canónica + enlace a Ra Wallet](#4-identidad-canónica--enlace-a-ra-wallet)
  - [4.1 Identidad canónica](#41-identidad-canónica)
  - [4.2 Enlace con Ra Wallet](#42-enlace-con-ra-wallet)
- [5. Wallet blockchain nativa: Thirdweb vs Build In-House](#5-wallet-blockchain-nativa-thirdweb-vs-build-in-house)
- [6. Bunz, Fiat, Blockchain Card (siguiente nivel roadmap)](#6-bunz-fiat-blockchain-card-siguiente-nivel-roadmap)
  - [6.1 Modelo de Bunz: Offchain vs Onchain (híbrido óptimo)](#61-modelo-de-bunz-offchain-vs-onchain-híbrido-óptimo)
  - [6.2 Fiat (Blocko)](#62-fiat-blocko)
  - [6.3 Crypto/Blockchain Card (In-App Card)](#63-cryptoblockchain-card-in-app-card)
- [7. Bunzy Supreme — Arquitectura propuesta](#7-bunzy-supreme--arquitectura-propuesta)
  - [7.1 Capas](#71-capas)
  - [7.2 Subagentes (Multi-Agent)](#72-subagentes-multi-agent)
  - [7.3 Omnipresencia + Omnicanal](#73-omnipresencia--omnicanal)
- [8. Roadmap propuesto (priorizado)](#8-roadmap-propuesto-priorizado)
- [9. Recomendaciones clave (acción inmediata)](#9-recomendaciones-clave-acción-inmediata)
- [10. Veredicto final](#10-veredicto-final)

## 1. Estado actual de Bunzy (diagnóstico)

| Componente | Estado | Observación |
|---|---|---|
| **Motor de respuesta** | `generateBunzyReply` + `heuristicReply` + tools (4 funciones) | Sólido para intents comerciales (negocios, cercanía, transferencia, QR). Funciona bien con reglas + LLM. |
| **Asistente interno** | `generateBunzyAssist` (draft/summarize) | Útil en chat interno. Muy limitado (transcript 12 mensajes, sin memoria entre sesiones). |
| **Canales** | In-App (`/bot`, `/chat/bot`) + Telegram (`/api/bot/webhook`) | Omnicanal parcial. Falta WhatsApp (Business Cloud), Web Widget, Push, Voice (STT/TTS) y canal para Affiliates. |
| **Contexto** | Por request (user + businesses + ubicación + últimos mensajes) | Estadeless. No recuerda preferencias, historial pasado, lenguaje, patrones o feedback del usuario. |
| **Proveedor IA** | OpenAI (`gpt-4o-mini`) + Ollama fallback | Bien, pero sin RAG, sin grounding con KB propia, sin trazabilidad/citas. |
| **Memoria** | 0 persistente | No hay aprendizaje por usuario. Cada conversación empieza desde cero. |
| **RAG Fase 0** | ✅ **IMPLEMENTADO (2026-11-02, rama score)** | `bunzyRag.ts`: búsqueda coseno sobre `knowledgeChunks` (pgvector HNSW) con degradación graceful; grounding con citas `(Fuente: FAQ faq:XX)` en `buildSystemPrompt` (OpenAI + Ollama) y en `admin_qa`; ingesta idempotente post-deploy vía `POST /api/bunzy/kb` (header `x-bunzy-kb-secret`). Tablas aplicadas a prod (migración manual `0018` verificado). Seed pendiente de ejecutar en producción (requiere OPENAI_API_KEY de Vercel al llamar la ruta). |

**Veredicto:** Bunzy hoy es un **agente reactivo (Q&A + tools)**. Para subirlo a "nivel supremo" necesita pasar a **agente proactivo + con memoria + con conocimiento propio (RAG)** y una capa de **identidad + wallet** bien definida.

## 2. RAG + MAG (cómo hacer que aprenda de los usuarios)

### 2.1 RAG (Retrieval-Augmented Generation)

| Fuente de conocimiento | Uso | Chunking sugerido |
|---|---|---|
| **FAQs + Soporte** | Respuestas oficiales | 200–400 tokens + overlap 10–20% |
| **Comercios/Directorio** | Grounding búsqueda | Por ficha (business) + atributos |
| **T&C, Política, Onboarding** | Respuestas legales/precisas | Por sección (H2/H3) |
| **Affiliate Playbook** | Bunzy para Affiliates | Por flujo/proceso |
| **Casos de éxito (chat)** | FAQs emergentes | Por conversación útil |
| **Productos/Misiones/Recompensas** | Gamificación + Bunz | Por entidad |

**Infra vectores:** `pgvector` + Postgres (recomendado). Schema sugerido: `knowledge_base`, `knowledge_chunks` con `embedding VECTOR(1536)` (text-embedding-3-small).

### 2.2 MAG (Memory-Augmented Generation)

Memoria por usuario (episódica/semántica/procedural). Esquema: `user_memories`, `user_interactions`, `user_persona`. Incluir **reflection loop** (cada ~15–20 mensajes) para consolidar hechos relevantes.

## 3. IPFS: ¿dónde SÍ y dónde NO usarlo?

| Caso | IPFS | Razón |
|---|---|---|
| **Logos/banners/assets estáticos** | **SÍ** | Inmutable, versionado, pinning |
| **Recibos/comprobantes/attestations** | **SÍ** | Trazabilidad + verificable (CID) |
| **Avatares** | **SÍ** | Versión + descentralizado |
| **KB versionada** | **SÍ** | Trazable/rollback por CID |
| **PII, perfiles privados** | **NO** | Público por defecto |
| **Balances, saldos Bunz, claves/seed** | **NO** | Crítico (solo cifrado + DB/KMS) |
| **Media privado** | **NO (usar S3/R2)** | Privacidad + control acceso |

**Regla:** IPFS **selectivo** (guardar CID). Por defecto S3/R2 + CDN.

## 4. Identidad canónica + enlace a Ra Wallet

### 4.1 Identidad canónica

`canonical_identities` (enriquece `users`): `user_id` UUID canónico, `did:rabbitty` opcional, `alias_slug`, `persona_role`, `trust_score`, `kyc_status`, `primary_wallet_address`, `primary_chain_id`.

### 4.2 Enlace con Ra Wallet

`wallets` multi-wallet: `provider` ('rainbow','thirdweb','injected','internal','ra'), `address`, `chain_id`, `wallet_type`, `is_primary`, `is_active`.

## 5. Wallet blockchain nativa: Thirdweb vs Build In-House

| Aspecto | Thirdweb | Propia | Veredicto |
|---|---|---|---|
| **Time-to-market** | ★★★★★ | ★★☆☆ | **Thirdweb** |
| **Account Abstraction + Paymaster** | Nativo | Complejo | **Thirdweb** |
| **Fiat On/Off-Ramp** | Integrado | Integrar uno a uno | **Thirdweb** |
| **Seguridad/Mantenimiento** | Auditada/vendor | Requiere auditorías + ops | **Thirdweb (fase 0–1)** |
| **Coste a escala** | SaaS | Menor a muy alto volumen | Evaluar migración futura |

**Recomendado:** Thirdweb Embedded + Smart Accounts (AA) + abstracción `IWallet` (migrable). **No** construir MPC/HSM ahora.

## 6. Bunz, Fiat, Blockchain Card (siguiente nivel roadmap)

### 6.1 Modelo de Bunz: Offchain vs Onchain (híbrido óptimo)

- **Offchain (alta frecuencia):** recompensas, transferencias P2P, escaneos, misiones → instantáneo, 0 gas.
- **Settlement onchain (batch):** quemas/emisiones, pagos a afiliados/comercios, treasury → transparencia/audit. Usar L2 (Base/Arbitrum/Optimism).
- **ERC-20 opcional:** bridge/redeem externo.

### 6.2 Fiat (Blocko)

Aprovechar Blocko para **on-ramp/off-ramp** y **payouts** LATAM. Usar webhooks + reconciliación ledger (double-entry). Segregar treasury (operational vs rewards).

### 6.3 Crypto/Blockchain Card (In-App Card)

Priorizar **Virtual Card** (Lithic/Stripe Issuing). Más adelante **stablecoin-first** (USDC) con funding desde Smart Account. `spend_balance` unificado (bunz/fiat_credits/stable_usdc).

## 7. Bunzy Supreme — Arquitectura propuesta

### 7.1 Capas

- **Orchestrator** (LangGraph o custom) — routing, multi-turn, retries
- **Persona/Router por Rol** — rabbitter/affiliate/merchant
- **RAG** (pgvector + hybrid) — grounding + citations
- **MAG/Memory** (Drizzle + reflection) — memoria activa por usuario
- **Tools Layer** (tool calling) — wallet, businesses, transfers, RAG, affiliates
- **Omnichannel Adapter** — App/Telegram/WhatsApp/Web
- **Guardrails** — PII, rate limits, allowlists
- **Observability** — traces + feedback

### 7.2 Subagentes (Multi-Agent)

| Subagente | Propósito |
|---|---|
| **Commerce Agent** | Búsquedas, recomendaciones, comercios |
| **Wallet Agent** | Saldo, transferencias, QR, on/off-ramp |
| **Affiliate Agent** | Comisiones, leads, tracking, payouts |
| **Support Agent** | RAG estricto + tickets (citations) |
| **Growth Agent** | Referidos, misiones, retos, proactivo |
| **Memory Agent (Reflection)** | Consolida episodios→semánticos |

### 7.3 Omnipresencia + Omnicanal

App/Telegram (parcial) + WhatsApp Business Cloud + Web Widget + Push + Voice (STT/TTS). Proactividad basada en memorias.

## 8. Roadmap propuesto (priorizado)

| Fase | Alcance | Esfuerzo | Impacto | Orden |
|---|---|---|---|---|
| **Fase 0** | RAG (pgvector + KB + tool search_knowledge + citations) | Bajo–Medio | **Alto** | **1º — ✅ IMPLEMENTADO 2026-11-02 (código + tablas en prod; falta seed post-deploy)** |
| **Fase 1** | MAG (memories + persona + reflection loop + recall) | Medio | **Altísimo** | **2º** |
| **Fase 2** | Identidad canónica + wallets (Ra link) | Bajo | Alto | **3º** |
| **Fase 3** | Wallet Abstraction + Thirdweb (AA + Paymaster + Onramp) | Medio | Alto | 4º |
| **Fase 4** | Híbrido Bunz (offchain + settlement batch L2) | Medio–Alto | Alto | 5º |
| **Fase 5** | Omnicanal (WhatsApp + Web Widget + Push proactivo) | Medio | Alto | 6º |
| **Fase 6** | Fiat (Blocko) + Virtual Card (Lithic/Stripe Issuing) | Alto | **Altísimo** | 7º |
| **Fase 7** | Multi-Agent (LangGraph) + proactividad | Alto | Alto | 8º |

## 9. Recomendaciones clave (acción inmediata)

1. **Empezar por RAG (P0)** — grounding institucional + citations
2. **MAG antes que blockchain (P0)** — aprendizaje real por usuario
3. **Thirdweb > build in-house (P0)** — velocidad + seguridad inicial
4. **IPFS selectivo (P1)** — CID solo para inmutable/audit. R2/S3 por defecto
5. **Híbrido Bunz (P1)** — UX + transparencia
6. **Identidad canónica ligera (P1)** — usar `user_id` como canónico, DID futuro
7. **Blocko + Card faseada (P2)** — tras ledger Bunz estable + KYC/tiering

## 10. Veredicto final

- **Rabbitters:** útil, proactivo, contextual (recuerda preferencias/ubicación/hábitos).
- **Affiliates:** persona distinta + KB propio + tools comisiones (subagente).
- **Wallet/Blockchain:** **Thirdweb Embedded + AA + Paymaster** correcto ahora. Wallet propia solo con volumen + ventaja estratégica.
- **IPFS:** viable selectivo, no DB general.
- **Nivel supremo:** conseguido con **RAG + MAG + Orchestrator (subagentes) + identidad canónica unificada**. Card/Fiat/Onchain = ampliación natural.

---

## 11. Bunzy × Rabbitty Score — gate de integración (decisión 2026-11-01)

**Pregunta:** ¿Integrar a Bunzy ahora como motor de optimización/inteligencia de scoring, o esperar a Rabbitty Score al 100%?

**Veredicto: NO ahora, NO Score al 100% — el trigger es la DATA, no el porcentaje.** Arranca cuando F2 cierre operativo (migración `0022` + snapshots reales en prod, RABBITTY-SCORE-PLAN.md §10) y exista **≥30 días de snapshots shadow**. A esa integración se le gatea así:

| Fase Bunzy×Score | Alcance | Gate |
|---|---|---|
| **Bx0 — Analyst (shadow, God-only)** | Bunzy lee `merchant_score_shadow` + `rabbitter_score_shadow` + métricas (read-only), RAG sobre snapshots, **sugerencias con citas** en `/god/insights`. Nunca decide dinero. | F2 cerrado + 30 días de datos |
| **Bx1 — Calibrator assist** | Asiste F2-8 (recalibración de pesos, umbrales de abuso, μ global/segmento) con análisis estadístico sugerido, siempre con aprobación God explícita | Calibración 30/90d del plan de Score |
| **Bx2 — Growth advisor** | Apoyo a F3/F4: asignación de promos con scores calibrados, atribución de campañas — siempre **propuesta + aprobación humana** (Regla de oro §2/§3) | D-5/D-6 resueltas + presupuesto autorizado |
| **Bx3 — Aprendizaje continuo** | MAG/reflection sobre outcomes de las decisiones; el motor aprende qué sugerencias funcionaron | Bx1/Bx2 en verde y trackeables |

**Por qué NO ahora:** (1) Bunzy hoy es stateless sin RAG — sin memorias la "inteligencia" sería heurística; (2) el dataset que le daría de comer no existe aún (el shadow empieza a acumularse con F2 en prod); (3) iOS-first: el foco de ingeniería hoy es validar el flujo de punta a punta. Lo único que se pide al equipo hoy es **mantener el seam limpio**: el contrato de eventos (`@rabbitty/events`) y las tablas shadow ya son legibles — cuando Bunzy llegue, sus insumos ya están ordenados.
