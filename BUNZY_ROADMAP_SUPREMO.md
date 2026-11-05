# Plan Estratégico para Llevar Bunzy al Nivel Institucional, Supremo y Omnipresente

> Documento integral con diagnóstico, arquitectura, RAG+MAG, Identidad Canónica, Wallet Blockchain, IPFS, Fiat/Card y Roadmap de implementación por fases.
>
> **Actualizado 2026-11-05:** RAG Fase 0 certificado en producción; catálogo de acciones por rol, plan MAG 2.0 y siguiente integración de chat interno.

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
- [12. Ejecución 2026-11-05 — RAG Fase 0 certificado](#12-ejecución-2026-11-05--rag-fase-0-certificado-en-producción)
- [13. Bunzy en todo el ecosistema — catálogo de acciones](#13-bunzy-en-todo-el-ecosistema--catálogo-de-acciones)
- [14. MAG 2.0 — Memoria y Aprendizaje Generativo](#14-mag-20--memoria-y-aprendizaje-generativo)
- [15. Próxima integración — actualizaciones para afiliados en el chat interno](#15-próxima-integración--actualizaciones-para-afiliados-en-el-chat-interno)
- [16. Priorización recomendada (siguiente trimestre)](#16-priorización-recomendada-siguiente-trimestre)
- [17. Decisiones pendientes](#17-decisiones-pendientes)

## 1. Estado actual de Bunzy (diagnóstico)

| Componente | Estado | Observación |
|---|---|---|
| **Motor de respuesta** | `generateBunzyReply` + `heuristicReply` + tools (4 funciones) | Sólido para intents comerciales (negocios, cercanía, transferencia, QR). Funciona bien con reglas + LLM. |
| **Asistente interno** | `generateBunzyAssist` (draft/summarize) | Útil en chat interno. Muy limitado (transcript 12 mensajes, sin memoria entre sesiones). |
| **Canales** | In-App (`/bot`, `/chat/bot`) + Telegram (`/api/bot/webhook`) | Omnicanal parcial. Falta WhatsApp (Business Cloud), Web Widget, Push, Voice (STT/TTS) y canal para Affiliates. |
| **Contexto** | Por request (user + businesses + ubicación + últimos mensajes) | Estadeless. No recuerda preferencias, historial pasado, lenguaje, patrones o feedback del usuario. |
| **Proveedor IA** | OpenAI (`gpt-4o-mini`) + Ollama fallback | Bien, pero sin RAG, sin grounding con KB propia, sin trazabilidad/citas. |
| **Memoria** | 0 persistente | No hay aprendizaje por usuario. Cada conversación empieza desde cero. |
| **RAG Fase 0** | ✅ **CERTIFICADO EN PRODUCCIÓN (2026-11-05)** | `bunzyRag.ts`: búsqueda coseno sobre `knowledgeChunks` (pgvector HNSW) con degradación graceful; grounding con citas `(Fuente: FAQ faq:XX)`. Ingesta idempotente vía `POST /api/bunzy/kb` (header `x-bunzy-kb-secret`). **43/43 chunks con embedding** (27 FAQs + 16 docs), retrieval canónica `faq:01` con **score 0.807**, embeddings propios en Railway (`embeddinggemma-2`, 768d → 1536), latencia **~0.35 s** en caliente. Ver §12. |

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
| **Fase 0** | RAG (pgvector + KB + tool search_knowledge + citations) | Bajo–Medio | **Alto** | **1º — ✅ CERTIFICADO 2026-11-05 (43 chunks, score 0.807, embeddings propios)** |
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

---

# 12. Ejecución 2026-11-05 — RAG Fase 0 certificado en producción

## 12.1 Qué quedó funcionando

| Pieza | Estado | Evidencia |
|---|---|---|
| Ingesta de conocimiento | ✅ | 43 chunks (27 FAQs + 16 docs) en `knowledgeChunks` |
| Embeddings | ✅ | `embeddinggemma-2` (768 dims, padding a 1536) |
| Retrieval semántico | ✅ | Consulta canónica “¿Cómo gano Bunz?” → `faq:01`, score **0.807** |
| Auth del endpoint | ✅ | `x-bunzy-kb-secret` contra `BUNZY_KB_SECRET` |
| Idempotencia | ✅ | Segunda corrida: **0 chunks nuevos** |
| Citas en chat | ✅ | `(Fuente: FAQ faq:XX)` en OpenAI, Ollama y `admin_qa` |
| Degradación | ✅ | Si embeddings/KB fallan, el chat sigue con FAQ matcher local |

## 12.2 Infraestructura de embeddings (decisión clave)

Ollama Cloud **no ofrece embeddings** (`/api/embed` responde 401 plan-gated; `/v1/embeddings` 404). Por eso se separó el proveedor:

| Componente | Valor |
|---|---|
| Servicio | `rabbitty-ollama` en Railway (imagen `ollama/ollama`) |
| Modelo | `embeddinggemma-2` (768d; se rellena a 1536 para pgvector) |
| Volumen | 3 GB (`/root/.ollama`), modelos persistidos |
| Recursos | 4 GB RAM · 4 vCPU |
| Keep-alive | `-1` (nunca descarga el modelo) |
| URL | `https://rabbitty-ollama-production.up.railway.app` |
| Chat | Sigue en Ollama Cloud (`OLLAMA_API_URL`, `OLLAMA_API_KEY`, `OLLAMA_MODEL`) |

Variables nuevas en la app (Vercel):

```
OLLAMA_EMBED_URL=https://rabbitty-ollama-production.up.railway.app
OLLAMA_EMBED_MODEL=embeddinggemma-2
OLLAMA_EMBED_NUM_THREADS=4   # opcional, default 4
```

## 12.3 Bugs que se destrabaron en el camino

1. **Threads**: Ollama autodetectaba 1 hilo en Railway → 48 s por embedding. Con `num_thread=4` bajó a **0.35 s** en caliente.
2. **pgvector**: el tipo custom no serializaba el vector; el driver mandaba `{...}` y Postgres devolvía `22P02 Vector contents must start with "["`. Se agregó `toDriver`/`fromDriver` en `database-core`.
3. **Modelo real**: `EMBED_MODEL` estaba fijo en `text-embedding-3-small`; ahora refleja `OLLAMA_EMBED_MODEL`.
4. **Smoke**: leía `data.top` y el endpoint devuelve `semanticCheck.top`.

## 12.4 Runbook operativo

```bash
# Salud del KB (chunks y embeddings)
curl -s -H "x-bunzy-kb-secret: $BUNZY_KB_SECRET" \
  https://app.rabbitty.me/api/bunzy/kb

# Ingesta + certificación semántica
BUNZY_KB_SECRET=... node scripts/bunzy-rag-smoke.mjs
```

- **Cuándo correrlo**: después de cada deploy que cambie `support-content.ts`, FAQs o docs institucionales.
- **Costo**: el servicio de embeddings es de unos pocos dólares al mes; el seed completo tarda segundos.
- **Riesgo**: un solo nodo; si Railway reinicia, el primer embedding tarda ~1–2 min en cargar el modelo. El keep-alive evita el problema en operación normal.
- **Rotación de secreto**: se cambia en Vercel y en el `.env.local`; no requiere redeploy del servicio de Ollama.

## 12.5 Qué habilita de inmediato

- Soporte y onboarding con respuestas **citadas** y sin inventar.
- Políticas, contrato y economía Bunz respondidas con fuente.
- Base para el **Affiliate Agent** y para MAG: sin RAG no hay memoria útil; con RAG, la memoria se apoya en hechos verificables.

---

# 13. Bunzy en todo el ecosistema — catálogo de acciones

**Regla de oro:** Bunzy **explica, sugiere y prepara**; el dinero y los estados transaccionales los ejecuta código determinista. Todo lo que mueva Bunz, campañas o pagos requiere aprobación humana explícita.

## 13.1 Rabbitters (consumidores)

| # | Acción | Qué hace Bunzy | Datos / tools | Fase | Impacto |
|---|---|---|---|---|---|
| R1 | **Concierge de barrio** | “¿Dónde ceno tranquilo a 15 min?” con horario, stock de recompensas y mood | mapa, horarios, stock, mood | 1 | Alto |
| R2 | **Bunz Copilot** | “¿Me alcanza para el café?”, próximo reward, dónde conviene gastar | ledger (solo lectura), reglas | 1 | Alto |
| R3 | **Ruta de recompensas** | Arma una caminata por 3 afiliados con mejor reward/stock | mapa + stock + horarios | 2 | Medio |
| R4 | **Mood → plan** | “Estoy en modo enfoque” → cafés silenciosos, campañas activas | Mood + campañas | 1 | Medio |
| R5 | **Plan de grupo** | En el chat grupal: propone lugar, hora, divide la cuenta | grupos, mapa, POS | 2 | Alto |
| R6 | **Split & tip** | Explica y prepara división de cuenta, propina y uso de Bunz en el QR | POS, pagos | 1 | Alto |
| R7 | **Membresías** | Recuerda renovación, beneficios no usados y próximos cobros | memberships | 2 | Medio |
| R8 | **Alertas de oportunidad** | Happy hour, stock nuevo, lugares con reward alto (opt-in, con tope) | stock, campañas, push | 2 | Medio |
| R9 | **Feedback 1-toque** | Convierte una calificación en señal estructurada para el negocio | ratings | 1 | Medio |
| R10 | **Soporte que resuelve** | Pedido, reembolso, QR perdido; cita políticas y escala a humano | RAG + tickets | 1 | Alto |
| R11 | **Regalar Bunz** | Sugiere monto y ocasión; prepara el envío (aprobación del usuario) | ledger, contactos | 2 | Medio |
| R12 | **Recibos y garantías** | Guarda recibos digitales, recuerda garantías y reclamos | recibos, pedidos | 3 | Bajo |
| R13 | **Bunzy Wrapped** | Resumen mensual: lugares, ahorro, Bunz, rachas; compartible | agregados | 3 | Medio |
| R14 | **Misiones personales** | Retos (“3 cafés este mes”) con progreso y recompensa | misiones, ledger | 2 | Alto |
| R15 | **Centro de privacidad** | “¿Por qué lo sabes?”, corregir, olvidar, modo incógnito | MAG (ver §14) | 1 | Alto |
| R16 | **Voz y accesibilidad** | Notas de voz → texto; lectura de respuestas; modo manos libres | STT/TTS | 3 | Medio |
| R17 | **Modo viajero** | Al cambiar de ciudad, sugiere afiliados cercanos sin historial previo | geo + directorio | 2 | Bajo |
| R18 | **Idioma y tono** | Responde en el idioma del usuario y con su tono preferido | MAG | 1 | Bajo |

## 13.2 Affiliates (dueños, gerentes y staff)

| # | Acción | Qué hace Bunzy | Datos / tools | Fase | Impacto |
|---|---|---|---|---|---|
| A1 | **Brief diario** | Al abrir: 3 acciones (“sube reward en martes”, “stock bajo”, “2 reseñas sin responder”) | ventas, stock, reseñas | 1 | **Alto** |
| A2 | **Copiloto de operación** | “¿Cómo va el día?” con ticket promedio, canjes, anomalías | POS, ledger | 1 | **Alto** |
| A3 | **Asesor de recompensa** | Sugiere % por nicho/margen y **simula** el impacto; nunca lo cambia solo | menú, márgenes, benchmarks | 2 | Alto |
| A4 | **Constructor de campañas** | “Llenar martes 3–6 pm” → propuesta, presupuesto, audiencia (k≥5) y lift esperado; se aprueba | campañas, growth signals | 2 | **Alto** |
| A5 | **Radar de retención** | Detecta regulares en riesgo (agregado) y propone win-back | visitas, campañas | 2 | Alto |
| A6 | **Asistente de conciliación** | Explica diferencias, arma el borrador de disputa y reúne evidencia | conciliación, ledger | 2 | Alto |
| A7 | **Explicador financiero** | Comisiones, liquidaciones, fechas de payout y cargos, sin jerga | payouts, fees | 1 | Medio |
| A8 | **Detector de fugas** | Voidos, descuentos y reembolsos raros → alerta para revisión | POS, auditoría | 3 | Medio |
| A9 | **Menú y margen** | Sugiere combos y ajustes de precio con datos del menú | menú, ventas | 3 | Medio |
| A10 | **Coach de staff** | Explica roles, flujos del POS y permisos; quizzes de capacitación | docs + roles | 2 | Medio |
| A11 | **Estudio de contenido** | Genera posts desde menú/fotos/ofertas con tono de marca | menú, media | 3 | Medio |
| A12 | **Respondedor de reseñas** | Borradores de respuesta y escalamiento de quejas | ratings | 2 | Medio |
| A13 | **Comparador de sucursales** | Rendimiento por sucursal, personal y horarios | POS | 3 | Bajo |
| A14 | **Planner de eventos** | Detecta fechas/horas valle y propone evento + promo | calendario, campañas | 3 | Medio |
| A15 | **Benchmark anónimo** | Percentil vs. nicho con k-anonimato; nunca datos de otro negocio | agregados | 3 | Medio |
| A16 | **Checklist de cumplimiento** | Permisos, impuestos, higiene; recordatorios y documentos | docs + fechas | 3 | Bajo |
| A17 | **FAQ entrante** | Responde preguntas de clientes por WhatsApp/IG con guardrails y handoff | RAG del negocio | 3 | Alto |
| A18 | **Compañero de onboarding** | Guía el alta, explica campos y sugiere paquete/reward | onboarding | 0 | **Alto** |
| A19 | **Maître / lista de espera** | Gestiona waitlist y reservas si el negocio lo activa | reservas | 4 | Medio |

## 13.3 Interno (God, soporte y operaciones)

| # | Acción | Qué hace Bunzy | Fase |
|---|---|---|---|
| I1 | **Copiloto de operaciones** | Triaje de incidentes, runbooks, health de RAG y deploys | 2 |
| I2 | **Triaje de soporte** | Clasifica tickets, sugiere respuesta citada y escala | 1 |
| I3 | **Curador de conocimiento** | Detecta huecos en FAQs desde chats, redacta borrador y lo somete a aprobación; al aprobar, re-seed | 1 |
| I4 | **Analista de growth** | Cohortes, experimentos y guardrails | 3 |
| I5 | **Analista de riesgo** | Explica anomalías y patrones de fraude (sin decidir) | 3 |
| I6 | **Data Q&A** | Preguntas en lenguaje natural sobre SQL de solo lectura, con scope y auditoría | 3 |

## 13.4 Canales

| Canal | Rol de Bunzy | Fase |
|---|---|---|
| App nativa | Principal: chat, tools, memoria, notificaciones | 1 |
| Telegram (mini app) | Fallback y comunidad | 1 |
| WhatsApp Business | FAQ de negocios, recordatorios, soporte | 3 |
| Web widget (landing) | Soporte pre-venta y onboarding | 2 |
| Push / email | Proactividad y digest | 2 |
| POS / kiosk | Explicaciones al staff y al comensal | 2 |
| Chat interno (admin) | Actualizaciones y acciones para afiliados | §15 |

---

# 14. MAG 2.0 — Memoria y Aprendizaje Generativo

## 14.1 Principios

1. **La memoria no es verdad financiera.** Saldos y transacciones se leen de SQL, nunca de un embedding.
2. **Explícito > inferido.** Lo que el usuario dice vale más que lo que se deduce; la inferencia necesita confianza y repetición.
3. **Procedencia y TTL.** Cada recuerdo guarda de dónde salió, cuándo y hasta cuándo vale.
4. **Consentimiento y control.** El usuario ve, corrige y borra sus memorias; existe modo incógnito.
5. **Aislamiento por tenant.** La memoria de un negocio jamás alimenta a otro; los insights son agregados con k-anonimato.
6. **Nada sensible.** Salud, religión, política, orientación sexual, datos de tarjeta o contraseñas quedan fuera.

## 14.2 Taxonomía de memoria

| Tipo | Qué guarda | Ejemplos | Fuente | TTL sugerido |
|---|---|---|---|---|
| **Episódica** | Hechos vividos | “Visitó 626 Café el 2 nov”, “pidió flat white” | pedidos, visitas, chat | 90–365 días |
| **Semántica** | Preferencias estables | vegano, sin picante, presupuesto, ambiente | declaración explícita o ≥3 repeticiones | 6–12 meses |
| **Procedimental** | Cómo le gusta operar | divide la cuenta, propina 15%, paga con QR | POS, hábitos | 12 meses |
| **Negocio (playbook)** | Qué funcionó en este afiliado | “campaña de martes +18%”, “reward 25% óptimo” | campañas, resultados | 12 meses |
| **De grupo** | Preferencias compartidas | “este grupo es vegano”, “siempre dividen” | chat grupal + consentimiento | 30–90 días |
| **Estacional/local** | Patrones del entorno | quincena, lluvia, hora valle | agregados | 12 meses |
| **Negativa** | Lo que rechazó | “no le gustan las terrazas”, “ignoró 3 promos” | feedback, dismissals | 6 meses |

## 14.3 Pipeline de escritura (cómo aprende)

```
Evento (pedido, visita, chat, reseña, campaña, conciliación)
  → memoryCandidates (crudo, con provenance)
  → extracción (reglas + LLM)
  → filtro PII / sensible
  → confianza (explícito 0.9–1.0 · repetido 0.7–0.9 · inferido 0.5–0.7)
  → dedupe y detección de contradicción
  → consentimiento / política
  → userMemories / businessLearningInsights
  → memoryAudit (quién, qué, por qué)
```

- **Tiempo real**: solo se encola el candidato; nada pesado bloquea la respuesta.
- **Worker asíncrono**: cada 5–15 min procesa candidatos.
- **Reflexión nocturna**: consolida episodios en hechos semánticos, aplica decay y resuelve contradicciones.
- **Regla de 3**: una inferencia se promueve a memoria solo si se repite ≥3 veces o el usuario la confirma.

## 14.4 Pipeline de lectura (cómo recuerda)

- Embedding de la consulta → top-k memorias relevantes.
- Ranking: `relevancia × recencia × confianza × tipo`.
- Se inyectan máximo 5 memorias / ~300 tokens, dentro de `<memory>` delimitado.
- La respuesta puede citar: “lo recuerdo porque me lo dijiste el 12 oct”.
- Si el servicio de memoria falla, Bunzy responde sin memoria (degradación limpia).

## 14.5 Aprendizaje y reflexión

| Señal | Qué aprende | Cómo |
|---|---|---|
| Corrección del usuario | Corrige un hecho | reemplaza con confianza 1.0 |
| Dismissal de sugerencia | No repetir ese tipo de propuesta | memoria negativa + penalización |
| Visita después de sugerencia | La recomendación funcionó | refuerzo positivo |
| Campaña con lift | El playbook del negocio | `businessLearningInsights` con muestra y confianza |
| Conciliación resuelta | Patrón de disputa | insight operativo |
| Reseña/rating | Preferencia y calidad percibida | señal agregada |

- **Sin fine-tuning al inicio**: primero retrieval + memoria + ranking. El fine-tuning llega solo con datos consentidos, aprobados y un set de evaluación.
- **Aprendizaje por bandit** para ordenar sugerencias (no para decidir dinero).
- **Evaluación** antes de cualquier promoción: precisión/recall de memoria, tasa de contradicción, tasa de corrección, éxito de tarea, latencia y costo.

## 14.6 Features creativas de MAG

1. **“Bunzy me conoce”**: línea de tiempo editable de lo que sabe de ti.
2. **Modo incógnito**: sesión sin escritura ni lectura de memoria.
3. **Memoria de grupo**: el grupo consiente y Bunzy recuerda preferencias compartidas para planear salidas.
4. **Playbook del negocio**: “esto funcionó en tu local”, con evidencia y fecha.
5. **Aprendizaje de rechazos**: cada “no” enseña; nunca insiste con lo mismo.
6. **Memoria estacional**: quincena, clima, eventos locales, horas valle.
7. **Detector de contradicción**: si dos recuerdos chocan, pregunta antes de asumir.
8. **Memoria de equipo**: turnos, roles y preferencias del staff (con permisos).
9. **Memoria de marca**: tono, assets y frases aprobadas del negocio.
10. **Memoria portable**: exportar/importar recuerdos (derecho del usuario).
11. **Bunzy Wrapped**: recapitulación mensual construida desde memoria y agregados.
12. **“Olvida esto”**: borrado inmediato con auditoría.

## 14.7 Fases MAG (qué, cómo y cuándo)

| Fase | Alcance | Cuándo | Gate para avanzar | Métrica de éxito |
|---|---|---|---|---|
| **M0 — Memoria explícita** | Guardar solo lo que el usuario dice; leer en chat; panel “me conoce”; borrar; auditoría | Ahora (1–2 semanas) | RAG certificado ✅ | ≥95% memorias con provenance; 0 PII |
| **M1 — Memoria implícita** | Señales de visitas/pedidos (≥3), reflexión nocturna, decay y feedback | 2–4 semanas | M0 estable + consentimiento | corrección <10%; recall útil >70% |
| **M2 — Memoria de negocio** | Playbooks, campañas, conciliación, insights con k≥5 | 1–2 meses | M1 + campañas instrumentadas | ≥1 insight accionable por negocio/mes |
| **M3 — Proactividad y grupo** | Nudges personalizados, memoria de grupo, multicanal, Bx3 de Score | 2–3 meses | M2 + push/WhatsApp | lift medible sin aumentar opt-out |
| **M4 — Multimodal y aprendizaje fino** | Fotos/recibos/voz, resúmenes on-device, fine-tuning consentido | 3–6 meses | M3 + dataset aprobado | mejora en set dorado sin regresión |

## 14.8 Modelo de datos

**Ya existe** (`database-core`): `knowledgeChunks`, `userMemories`, `memoryCandidates`, `businessLearningInsights`.

**Propuesto**:

| Tabla | Para qué |
|---|---|
| `memoryEvents` | Append-only de señales crudas con `eventId` (idempotencia) |
| `memoryEmbeddings` | Vector de cada memoria para recall semántico (pgvector) |
| `memoryAudit` | Quién leyó/escribió/borró y por qué |
| `memoryFeedback` | Correcciones, confirmaciones y dismissals |
| `groupMemories` | Memoria consentida de grupos, con miembros y TTL |

Índices: `(userId, key)` único; `(businessId, insightType)`; HNSW en embeddings; job de TTL diario.

## 14.9 Privacidad y cumplimiento

- Consentimiento explícito por categoría; opt-out por canal.
- Finalidad limitada: lealtad, recomendación, soporte y operación.
- Retención con TTL y borrado en cascada al eliminar la cuenta.
- Derecho a ver, corregir, exportar y olvidar.
- Cifrado en reposo; aislamiento por tenant; logs de acceso.
- Revisión legal antes de M2 (memoria de negocio) y M3 (proactividad).

## 14.10 Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Alucinación de memoria | Provenance obligatoria + “no lo sé” + citas |
| Memoria obsoleta | TTL, decay y confirmación |
| Fuga entre tenants | Filtro por `businessId`/`userId` en toda lectura; tests |
| Costo/latencia | Async, top-k pequeño, cache, límites por plan |
| Sesgo en recomendaciones | Diversidad, exploración controlada, auditoría |
| Dato sensible | Filtro previo + lista negra + revisión humana |

---

# 15. Próxima integración — actualizaciones para afiliados en el chat interno

> **Estado:** placeholder. El contexto y las decisiones se definen en la siguiente sesión.

**Objetivo:** que Bunzy publique actualizaciones estructuradas y accionables en el chat interno del negocio, sin que el afiliado tenga que entrar a buscarlas.

| Tipo de actualización | Ejemplo | Acción posible |
|---|---|---|
| Resultado de campaña | “Tu campaña de martes generó 18% más tickets” | Ver detalle · Repetir · Pausar |
| Payout / liquidación | “Tu payout de $8,400 se envió hoy” | Ver desglose · Descargar |
| Conciliación | “Hay una diferencia de $120 en 2 tickets” | Revisar · Disputar |
| Producto / feature | “Ya puedes activar membresías” | Activar · Guiarme |
| Riesgo / anomalía | “3 voids seguidos en la misma caja” | Revisar · Ignorar |
| Onboarding | “Te falta confirmar tu giro” | Continuar |

Reglas de diseño:

- **Permisos por rol** (dueño, gerente, staff) y scope por sucursal.
- **Aprobación humana** para cualquier acción con dinero o campañas.
- **Frecuencia y horarios**: digest diario + urgentes; nada en horario valle no deseado.
- **Read receipts y seguimiento**: si no se atiende, Bunzy recuerda una vez.
- **Deep links** a la pantalla exacta (POS, campañas, conciliación).
- **Opt-in por tipo** y botón de “no me avises de esto”.

Fases tentativas: **A1** solo lectura (digest), **A2** acciones con aprobación, **A3** proactividad y aprendizaje de resultados.

---

# 16. Priorización recomendada (siguiente trimestre)

| Orden | Iniciativa | Impacto | Esfuerzo | Dependencia |
|---|---|---|---|---|
| 1 | **MAG M0** (memoria explícita + panel + borrar) | Altísimo | Bajo | RAG ✅ |
| 2 | **Brief diario del afiliado** (A1) | Alto | Bajo | RAG + datos vivos |
| 3 | **Soporte con citas** (R10/I2) | Alto | Bajo | RAG ✅ |
| 4 | **Curador de conocimiento** (I3) | Alto | Medio | RAG + aprobación |
| 5 | **Bunz Copilot** (R2) | Alto | Medio | ledger read-only |
| 6 | **Constructor de campañas v0** (A4) | Alto | Medio | growth signals |
| 7 | **Actualizaciones en chat interno A1** (§15) | Alto | Medio | chat + permisos |
| 8 | **Plan de grupo** (R5) | Alto | Medio | grupos + mapas |
| 9 | **Asesor de recompensa** (A3) | Medio | Medio | márgenes |
| 10 | **Proactividad M3** | Alto | Alto | M1/M2 + push |

---

# 17. Decisiones pendientes

1. ¿Qué actualización del chat interno entra primero: campañas, payout o conciliación?
2. ¿MAG M0 arranca con memoria explícita solo en la app o también en el admin del afiliado?
3. ¿Consentimiento de memoria por categoría o global con opt-out?
4. ¿Presupuesto mensual para LLM/embeddings y límite por tenant?
5. ¿WhatsApp Business se prioriza sobre el widget web?
6. ¿Se versiona la memoria de negocio en IPFS (CID) para auditoría o basta DB + audit log?

---

> **Nota de cierre:** RAG ya no es una promesa: está certificado en producción. El siguiente salto de valor no es “más modelo”, es **memoria útil + acciones concretas por rol**. MAG M0 y el brief del afiliado son el mejor siguiente paso por impacto/esfuerzo.

