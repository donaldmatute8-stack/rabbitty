# 15 · Expediente técnico-jurídico de Bunz

> **Para qué sirve.** Es el documento que el despacho necesita para dictaminar si
> Bunz queda dentro de la **exclusión del artículo 24, fracción I de la LRITF**
> (programas de lealtad o recompensa) o si, por su funcionamiento real, entra al
> perímetro de los fondos de pago electrónico (arts. 22 y 23).
>
> **Qué NO es.** No es un dictamen, no certifica cumplimiento y **no afirma** que
> Bunz esté excluido. Su tesis de trabajo es que Bunz es un beneficio promocional;
> el documento expone los hechos, el padrón y las preguntas que pueden derribarla.
>
> **Fecha de corte de datos:** 2026-11-19. **Fuente:** base de producción
> (`CORE_DATABASE_URL` y `RESTAURANT_DATABASE_URL`). Las consultas están en el
> anexo A para que puedan reproducirse.

---

## 1. Resumen para el despacho

1. Bunz **no se compra con dinero, no se retira, no genera rendimiento y no es
   convertible a pesos**. Se emite como recompensa por consumo y se redime en
   comercios de la red.
2. La red es **pequeña y en su mayoría de entrenamiento**: 4 negocios en el padrón,
   3 aprobados, **1 en producción real** (626 Café). El límite del 20 % **no puede
   calcularse hoy** con rigor, y ese es el hueco principal.
3. El punto jurídico más frágil **no es la convertibilidad**: es si los comercios
   que aceptan Bunz son **“sociedades afiliadas”** en el sentido de la ley. Hoy son
   **terceros independientes** que se afilian a la plataforma, no sociedades del
   mismo grupo. Si no califican, la exclusión no aplica por esa vía.
4. Hay dos funciones que el despacho debe mirar con lupa porque se parecen a un
   medio de pago: **transferencias gratuitas entre usuarios** y **compensación
   entre comercios**.
5. **No se debe presentar Bunz como definitivamente excluido** hasta que el
   despacho responda por escrito y el padrón esté completo.

---

## 2. Hechos técnicos verificables

| Hecho | Cómo se garantiza hoy |
|---|---|
| No se compra con dinero | Sólo se acredita por recompensa (`reward`), promoción o cortesía. No existe compra de saldo. |
| No se retira | No hay endpoint de retiro ni conversión a moneda. |
| No genera rendimiento | El saldo no devenga intereses ni rendimientos. |
| Cada emisión queda registrada | Libro de doble entrada `bunz_ledger_entries` (`groupId`, `account`, `direction`, `amount`, `refType`, `refId`, `sandbox`). |
| Idempotencia | Las operaciones de canje usan claves idempotentes (`pos_chk_<order>_<user>_<monto>`, `bunz_stock_<order>`); un reintento no duplica el débito. |
| Saldo negativo no es deuda | El saldo negativo se documenta como ajuste operativo, no exigible en dinero. |
| Trazabilidad por negocio | El saldo del afiliado vive en `ownedBusinesses.bunzBalance`; el del usuario en `users.totalBunzEarned` / `totalBunzSpent`. |
| Separación de ambientes | Cada movimiento del libro lleva bandera `sandbox`; los negocios de entrenamiento también. |

**Circulación observada al corte:** 3 usuarios con Bunz ganados, **539 Bunz
emitidos** y **20 Bunz canjeados**; saldo agregado en negocios **9,019 Bunz**;
**1 obligación** registrada y **0 reservas**. El libro tiene 2 asientos de crédito
y 2 de débito (511 cada dirección, 1 de ellos sandbox). Volumen irrelevante: sirve
para describir el mecanismo, no para inferir escala.

---

## 3. Ciclo de vida de un Bunz

```
  ┌─────────────┐   1. EMISIÓN      ┌──────────────┐
  │  Consumo    │ ────────────────► │  Saldo del   │
  │  en afiliado│  % de recompensa  │  Rabbitter   │
  └─────────────┘                   └──────┬───────┘
                                           │
                    2. TRANSFERENCIA       │      3. CANJE
                    (usuario ↔ usuario)    │      (en afiliado)
                                           ▼
                                    ┌──────────────┐
                                    │  Afiliado    │
                                    │  acredita    │
                                    │  bunzBalance │
                                    └──────┬───────┘
                                           │
                                    4. COMPENSACIÓN
                                    (red vs. afiliado)
```

**1. Emisión.** El afiliado define `rewardPercentage` (10 %, 15 % o 20 % en el
padrón actual). Al cerrar una orden se acredita al Rabbitter y se registra el
asiento con referencia al negocio y a la orden.

**2. Transferencia entre usuarios.** Gratuita, sin contraprestación y sin
intermediación de Rabbitty; queda en el libro con referencia. **Es el punto que el
despacho debe calificar**, porque una transferencia libre entre personas se parece
a un medio de pago aunque no haya retiro.

**3. Canje.** El Rabbitter paga total o parcialmente con saldo. El sistema verifica
saldo, debita al usuario con idempotencia, acredita `bunzBalance` al afiliado y
marca la orden como pagada **sólo después** del débito verificado. Si el registro
del pago falla, el débito se compensa.

**4. Compensación.** El afiliado que recibe Bunz acumula un saldo a su favor que se
compensa en la red. **La pregunta legal es si esa compensación es una simple
liquidación de puntos promocionales o una obligación distinta** (por ejemplo, un
fondo de pago electrónico).

**5. Extinción.** Los Bunz de una cuenta registrada **no vencen ni se cancelan por
inactividad**. La Bóveda Temporal (Bunz emitidos a un teléfono sin cuenta) tiene
3 meses **provisionales**, con aviso al emitir, recordatorio, prueba de titularidad
y suspensión del plazo por error técnico imputable a Rabbitty. Al cerrar la cuenta
hay 30 días para consultar, transferir o reclamar; no hay confiscación automática.

---

## 4. Padrón real de la red (corte 2026-11-19)

### 4.1 Negocios

| Negocio | Estado | Ambiente | Acepta Bunz | Emite | Recompensa | Saldo Bunz |
|---|---|---|---|---|---|---|
| **626 Café** | APPROVED | **Producción** | Sí | Sí | 15 % | 4,019 |
| Ka13 | APPROVED | Sandbox | Sí | Sí | 20 % | 0 |
| Bull Box | APPROVED | Sandbox | **No** | Sí | 20 % | 0 |
| Demo Lead Café | ACTIVE | Sandbox | Sí | Sí | 10 % | 5,000 |

- **4 negocios en el padrón · 3 aprobados · 1 en producción real.**
- **3 aceptan Bunz** (2 de ellos sandbox).
- El negocio `ACTIVE` es de demostración para revisión de tienda; no debe contar
  como establecimiento comercial.

### 4.2 Establecimientos (sucursales)

| Establecimiento | Negocio | Activa | Tipo |
|---|---|---|---|
| Sucursal 626 Café | 626 Café | Sí | **Producción** |
| 🧪 Modo Entrenamiento (Sandbox) | 626 Café | Sí | Entrenamiento |
| Sucursal Principal (Archivada) | 626 Café | **No** | Archivada |
| Bull Box Buenos Aires | Bull Box | Sí | Sandbox (negocio) |
| Sucursal Única Ka13 | Ka13 | Sí | Sandbox (negocio) |
| Sandbox Demo (App Review) | Demo Lead Café | Sí | Entrenamiento |

- **6 establecimientos · 5 activos · 2 de entrenamiento · 1 archivado.**
- **Establecimientos de producción con Bunz: 1** (Sucursal 626 Café).
- **4 negocios tienen al menos una sucursal activa.**

### 4.3 Capacidad de cobro con tarjeta

| Establecimiento | Proveedor | `chargesEnabled` | `payoutsEnabled` | Estado |
|---|---|---|---|---|
| Sucursal Única Ka13 | Stripe Connect | **Sí** | Sí | Operativo (sandbox) |
| Sucursal 626 Café | Stripe Connect | **No** | No | `account_missing` (alta incompleta) |

- **1 establecimiento con tarjeta habilitada, y es de entrenamiento.**
- **0 establecimientos de producción con tarjeta habilitada al corte.**
- Consecuencia operativa: el cobro con tarjeta en 626 **falla hoy** con
  `STRIPE_CONNECT_NOT_READY`. La app ya lo refleja: `/api/pay/capabilities`
  deshabilita la opción por negocio cuando `chargesEnabled = false`.

### 4.4 Identificación fiscal de los afiliados

| Negocio | Razón social | RFC | Régimen |
|---|---|---|---|
| 626 Café | Alfonso Herrera Ruiz (persona física) | HERA830722E9A | 621 — Incorporación Fiscal |
| Ka13 | **Sin capturar** | **Sin capturar** | — |
| Bull Box | **Sin capturar** | **Sin capturar** | — |
| Demo Lead Café | **Sin capturar** | **Sin capturar** | — |

**Éste es el hueco del padrón:** sin razón social y RFC no se puede acreditar
quiénes son los afiliados ni si guardan relación corporativa con Rabbitty.

---

## 5. El límite del 20 %: fórmula, datos y por qué hoy no se puede cerrar

### 5.1 Lo que exige la ley (art. 24, fracción I)

La exclusión de programas de lealtad o recompensa exige, en síntesis:

1. Que los derechos **sólo sean aceptados** por la persona moral que ofrece el
   programa **o por sociedades afiliadas**.
2. Que **no sean convertibles** a moneda de curso legal.
3. Que las sociedades afiliadas **no excedan el 20 % del total de establecimientos
   o comercios habilitados para recibir pagos electrónicos mediante tarjeta**.

### 5.2 Numerador y denominador

```
                     Establecimientos que ACEPTAN Bunz
        ratio  =  ─────────────────────────────────────────
                  Establecimientos HABILITADOS para cobrar con tarjeta
```

**Numerador.** Establecimientos de sociedades afiliadas que aceptan Bunz, contando
sólo producción (excluyendo sandbox, entrenamiento y demo).

**Denominador.** **No es “los comercios de Rabbitty”.** La ley habla del total de
establecimientos o comercios habilitados para recibir pagos electrónicos con
tarjeta. Hay dos lecturas y el despacho debe elegir:

| Lectura | Denominador | Resultado al corte |
|---|---|---|
| **A. Red Rabbitty** | Establecimientos de la red habilitados para tarjeta | **2 / 1 = 200 %** (Bunz: 626 producción + Ka13 sandbox; tarjeta: 1). Cociente mayor a 100 %: **prueba de que esta lectura no sirve** como denominador legal. |
| **B. Universo legal** | Total de establecimientos habilitados para tarjeta en el universo que la ley considere (país, sector o listado de sociedades afiliadas) | **Indeterminado**: falta el universo y el listado. |

Con la lectura B y un universo de, por ejemplo, cientos de miles de
establecimientos con tarjeta en el país, 1-2 establecimientos con Bunz sería
notoriamente menor al 20 %. Pero **eso no se puede afirmar sin la fuente del
denominador**, y por eso no se presenta como cumplido.

### 5.3 Datos que faltan para cerrar el cálculo

| # | Dato | Estado |
|---|---|---|
| 1 | Razón social y RFC de cada afiliado que acepta Bunz | 1 de 3 (626) |
| 2 | Establecimientos físicos por afiliado | Parcial (sucursales en sistema) |
| 3 | Cuáles aceptan tarjeta | 1 (sandbox) |
| 4 | Cuáles aceptan Bunz | 3 (2 sandbox) |
| 5 | Fecha de alta, baja y cambios | No hay bitácora de establecimientos |
| 6 | Universo del denominador y su fuente | **No definido** |
| 7 | Definición de “sociedad afiliada” aplicable | **Pendiente del despacho** |
| 8 | Listado de sociedades afiliadas (si aplica) | No existe |

---

## 6. Riesgos identificados (para que el despacho los pondere)

| # | Riesgo | Por qué importa | Mitigación posible |
|---|---|---|---|
| R1 | **Los afiliados no son “sociedades afiliadas”** | La exclusión exige aceptación por la persona moral o por sociedades afiliadas; terceros independientes podrían no calificar. | Dictamen; en su caso, rediseñar la relación (grupo, mandato o red de aceptación). |
| R2 | **Transferencias entre usuarios** | Una transferencia libre y gratuita se acerca a la función de un medio de pago. | Dictamen expreso; límites, finalidad y trazabilidad. |
| R3 | **Compensación entre comercios** | El saldo a favor del afiliado podría leerse como obligación de pago distinta de los puntos. | Dictamen; documentar que es liquidación de puntos, sin cesión ni descuento. |
| R4 | **20 % sin denominador legal** | Sin cálculo verificable no se puede sostener la exclusión. | Padrón completo + método documentado + revisión periódica. |
| R5 | **Bóveda Temporal (3 meses)** | Caducidad de un derecho ya generado. | Aviso al emitir, recordatorio, prueba de titularidad, suspensión por error técnico; validación jurídica. |
| R6 | **Saldo negativo** | Podría interpretarse como crédito al usuario. | Ya se documenta como ajuste no exigible; revisar que no haya adelantos. |
| R7 | **Promociones con compra de saldo** | Convertiría el programa en compra de derechos. | **Regla interna: no vender Bunz ni permitir recarga con dinero.** |

---

## 7. Preguntas que el despacho debe responder por escrito

1. ¿Bunz encaja en la **exclusión del art. 24, fracción I**, o su funcionamiento
   (red, fungibilidad, transferencias, compensación) lo coloca en los arts. 22-23?
2. ¿Qué debe entenderse por **“sociedades afiliadas”** y qué comercios de la red
   califican? ¿Basta la afiliación contractual a la plataforma?
3. ¿Cómo se calcula el **20 %**: cuál es el universo del denominador y su fuente
   oficial? ¿Se mide por establecimiento, por comercio o por sociedad?
4. ¿Las **transferencias gratuitas entre usuarios** son compatibles con la
   exclusión o crean obligaciones distintas?
5. ¿La **compensación entre comercios** es liquidación de puntos o una obligación
   de pago sujeta a otra regulación?
6. ¿La **Bóveda Temporal de 3 meses** es oponible al consumidor?
7. ¿Qué **información mínima** debe mostrarse al emitir Bunz para que el derecho
   sea exigible y la caducidad defendible?
8. ¿Qué **controles** deben existir para no cruzar a fondo de pago electrónico al
   crecer (por ejemplo, si se permite comprar saldo o retirarlo)?
9. ¿Qué **régimen fiscal** corresponde al respaldo y a la compensación? (para el
   contador, con la opinión del despacho)

---

## 8. Método para mantener el padrón (compromiso operativo)

| Acción | Frecuencia | Responsable |
|---|---|---|
| Alta de afiliado exige razón social, RFC, domicilio y régimen | En el alta | Operación |
| Registrar establecimientos y si aceptan tarjeta / Bunz | En el alta y en cada cambio | Operación |
| Bitácora de altas, bajas y cambios de establecimiento | Continua | Producto |
| Recalcular numerador, denominador y porcentaje | Trimestral y en cada alta relevante | Legal + Operación |
| Revisión del dictamen si cambia el modelo (recarga, retiro, nuevos usos) | Por evento | Legal |
| Congelar la afirmación pública de “exclusión” hasta el dictamen | Continuo | Legal |

**Regla dura:** mientras no haya dictamen, la comunicación pública describe a Bunz
como **beneficio promocional**, sin afirmar que está fuera del perímetro de la
LRITF.

---

## Anexo A · Consultas reproducibles

```sql
-- Negocios (core)
select id, name, status, "acceptsBunz", "givesBunz",
       "rewardPercentage", sandbox, "bunzBalance"
from "ownedBusinesses" order by status, name;

-- Restaurantes y datos fiscales (restaurant)
select id, "businessId", name, "legalName", rfc, "taxRegime", "isActive"
from restaurants order by "businessId";

-- Establecimientos (restaurant)
select id, "restaurantId", name, "isActive", address
from branches order by "restaurantId";

-- Capacidad de cobro con tarjeta (restaurant)
select "branchId", provider, "stripeAccountId", "chargesEnabled", "payoutsEnabled"
from merchant_payment_accounts;

-- Circulación (core)
select sum("bunzBalance") as saldo_negocios,
       count(*) filter (where "bunzBalance" > 0) as con_saldo
from "ownedBusinesses";

select count(*) filter (where coalesce("totalBunzEarned",0) > 0) as con_ganados,
       sum(coalesce("totalBunzEarned",0)) as ganados,
       sum(coalesce("totalBunzSpent",0))  as gastados
from users;

-- Libro (core)
select "refType", direction, count(*) as movimientos, sum(amount) as total,
       count(*) filter (where sandbox) as sandbox_mov
from bunz_ledger_entries group by 1,2 order by 1,2;
```

---

## Anexo B · Qué se entrega junto con este documento

| Documento | Contenido |
|---|---|
| `14-INFORME-OBSERVACIONES-2026-11-19.md` | Estado del corpus y preguntas por materia. |
| `16-MATRIZ-TRATAMIENTOS.md` | Rol de Rabbitty en cada tratamiento de datos. |
| `packages/legal/src/documents.ts` | Texto publicado (`2026-11-19.2`, hash `b0575a3677188a60`). |

**Pendiente de terceros:** acta constitutiva, constancia de situación fiscal,
comprobante de domicilio y poder del representante; padrón fiscal completo de los
afiliados; universo del denominador del 20 %.
