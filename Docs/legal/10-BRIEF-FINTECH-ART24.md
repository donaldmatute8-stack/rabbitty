# Brief regulatorio Fintech (art. 22–24 LFIT)

> **Borrador de hechos y preguntas.** No es una opinión legal. Su objetivo es que
> el abogado regulatorio dictamine con datos concretos y no con suposiciones.

**Entidad:** MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V. (RABBITTY)
**RFC:** MEB2402087Z3
**Corte:** 8 de noviembre de 2026

---

## 1. Hechos del modelo actual

1. **Bunz son puntos de lealtad.** No se presentan como pesos, dinero electrónico,
   depósito, inversión, activo convertible ni promesa de reembolso.
2. **No hay conversión a efectivo.** El contrato prohíbe exigir efectivo por Bunz.
3. **No hay custodia de fondos de usuarios.** RABBITTY no recibe dinero para
   guardarlo ni lo devuelve como saldo.
4. **La redención es en especie.** El afiliado entrega producto/servicio y recibe
   la confirmación de Bunz.
5. **Liquidación fiat apagada.** `RABBITTY_BUNZ_SETTLE=false` y
   `RABBITTY_BUNZ_SETTLE_FIAT=false`.
6. **MCCE en shadow.** La capacidad adelantada no se aplica ni se recupera con
   cargo real; solo se calcula y se propone.
7. **Bunz transferibles y fungibles** entre Rabbitters y establecimientos, con
   límites y controles.
8. **Capacidad comercial** para que el afiliado reciba redenciones; no es dinero
   entregado al afiliado.
9. **Sandbox** (Ka13, Bull Box) sin efectos comerciales ni obligaciones.
10. **Comisiones** por servicio de plataforma (Stripe Connect) separadas de los
    fondos del afiliado.

---

## 2. Preguntas para dictamen

1. ¿Quién es el **emisor** de Bunz para efectos regulatorios?
2. ¿Cada afiliado independiente es una **sociedad afiliada** o solo un comercio?
3. ¿Cómo se calcula el **límite de establecimientos** del artículo 24?
4. ¿Qué ocurre si la red crece y supera el límite?
5. ¿La **fungibilidad** entre afiliados cambia la naturaleza del derecho?
6. ¿Emisión, redención y capacidad adelantada son **actividades distintas**?
7. ¿RABBITTY realiza actividades de los **artículos 22 y 23**?
8. ¿La **transferencia entre usuarios** convierte a Bunz en un medio de pago?
9. ¿La **capacidad adelantada** es una operación regulada distinta del programa
   de lealtad?
10. ¿Cambia el análisis si en el futuro se habilita **liquidación fiat**?
11. ¿Qué obligaciones aplican si se permite **redimir Bunz por servicios** de
    terceros?
12. ¿Qué comunicación al usuario evita prometer un producto regulado?

---

## 3. Escenarios que cambian el análisis

| Escenario | Qué cambia | Acción |
|---|---|---|
| Se habilita `SETTLE_FIAT` | Posible custodia/liquidación | No hacer sin dictamen |
| Bunz se convierten a efectivo | Medio de pago / fondos | No hacer sin dictamen |
| Se permite pagar servicios de terceros | Red de pagos | Revisar alcance |
| La red supera el límite de establecimientos | Art. 24 | Evaluar estructura |
| Se amplía capacidad adelantada real | Financiamiento | Dictamen específico |
| Se aceptan fondos de usuarios | Custodia | No hacer sin licencia |

---

## 4. Qué NO hacer hasta tener opinión

- No describir Bunz como dinero, saldo, inversión o rendimiento.
- No prometer convertibilidad a efectivo.
- No habilitar liquidación fiat ni retiro.
- No activar capacidad adelantada real.
- No permitir pagos a terceros fuera del catálogo.
- No usar el término “fintech” en comunicación pública si no está autorizado.

---

## 5. Documentos para el abogado

- Contrato marco v1.2 y anexos.
- Aviso de privacidad.
- Descripción del flujo de emisión/redencio/transferencia.
- Corte de ledger y conciliación.
- Política de capacidad y recuperación.
- Términos de la app y landing.
- Este brief.

---

## 6. Entregable esperado

1. Calificación del modelo actual.
2. Artículos aplicables y exclusiones.
3. Riesgos por escenario.
4. Recomendaciones de estructura y comunicación.
5. Lista de cambios necesarios antes de escalar.
