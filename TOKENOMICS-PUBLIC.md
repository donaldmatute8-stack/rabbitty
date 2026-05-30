# Rabbitty Tokenomics v2.0 — Economía del Ecosistema Bunz

## 🎯 Filosofía Central

> *"Los negocios son los verdaderos minters de recompensas. Rabbitty solo facilita el flujo."*

Cada Bunz que un usuario recibe como recompensa representa **valor real** que el negocio ha comprometido. No hay minting mágico: el negocio deposita, el usuario consume, el sistema libera.

---

## 📊 Modelo de Negocio Actual vs Diseño Propuesto

### ❌ Problemas del Diseño Actual (Smart Contracts v1)

| Problema | Impacto |
|----------|---------|
| `MINTER_ROLE` centralizado | Riesgo de inflación infinita |
| `BASE_RATE` fijo al 20% | No permite estrategias de marketing dinámicas |
| Sin concepto de "pool por negocio" | No hay transparencia de quién paga qué |
| Sin treasury | No hay respaldo económico del token |
| `claimRewardsOnBehalf` sin firma | Riesgo de abuso por admins |
| Recompensas "de la nada" | Los tokens no representan valor real |

### ✅ Diseño Propuesto (Tokenomics v2)

```
┌──────────────────────────────────────────────────────────────┐
│                    ECOSISTEMA RABITTY                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐        Compra Bunz       ┌──────────────┐    │
│   │ NEGOCIO  │ ────────────────────────→│   TREASURY   │    │
│   │ (Affiliate)│      (Fiat → Bunz)    │   (Banco)    │    │
│   └──────────┘                        └──────────────┘    │
│        │                                      │             │
│        │ Deposita en su Pool                  │ Respalda    │
│        ▼                                      ▼             │
│   ┌──────────────┐                    ┌──────────────┐      │
│   │  POOL DEL    │◄─────────────────│   RESERVA    │      │
│   │   NEGOCIO    │   Fees (3%+6%)   │   DE VALOR   │      │
│   │  (Bunz)      │                  │  (Cash/Fiat) │      │
│   └──────────────┘                    └──────────────┘      │
│        │                                      ▲             │
│        │ Usuario consume $100                │             │
│        │ Negocio configura 50% recompensa    │             │
│        ▼                                      │             │
│   ┌──────────────┐        Canjea Bunz        │             │
│   │   USUARIO    │ ────────────────────────→│             │
│   │  (Rabbiter)  │      (Bunz → Cash)       │             │
│   └──────────────┘                         └──────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🏦 El Treasury — El Corazón Económico

### Función del Treasury

El Treasury es el **banco central** de Rabbitty. Su trabajo:

1. **Emisión Primaria**: Solo el Treasury puede crear Bunz nuevos (con gobernanza/timelock)
2. **Respaldo**: Mantiene reserva de cash/fiat equivalente a Bunz en circulación
3. **Intercambio**: Permite a negocios comprar Bunz con fiat
4. **Canje**: Permite a usuarios convertir Bunz a cash (con fees)

### Algoritmo de Tesorería (Treasury Algorithm)

El Treasury Algorithm de Rabbitty mantiene la paridad Bunz ↔ Cash y evalúa la salud del ecosistema en tiempo real, administrando la sobrecapitalización, la reserva mínima, y los flujos de "quema" (burn) e incentivos del ecosistema de manera automatizada.

---

## 🏪 Smart Contracts Rediseñados

### 1. `BunzTokenV2.sol` — Token con Economía Real
Nuestro token cuenta con una arquitectura de Smart Contract propietaria e inmutable diseñada bajo estándares ERC20 avanzados, garantizando protección de fondos, un modelo anti-inflación transparente, y el enrutamiento de liquidez hacia los pools de cada negocio afiliado.

### 2. `RabbittyTreasury.sol` — Contrato de Tesorería
La tesorería respalda el valor de la moneda manteniendo una reserva paramétrica de stablecoins en proporción al Bunz emitido, garantizando paridad y liquidez global en la red TON.

---

## 📈 Estrategia de Recompensas Dinámicas

Nuestra tecnología permite a cada comercio aplicar configuraciones personalizadas de recompensa (en tiempo y forma) de manera automatizada. Esta estrategia fomenta la adquisición inteligente sin sacrificar márgenes innecesariamente.

---

## 🎮 Ejemplo de Flujo Completo

### Escenario: Café Cultura + Cliente María

```
1. CAFÉ CULTURA SE REGISTRA
   ├── Deposita $5,000 USD → Compra 5,000 Bunz
   ├── Pool inicial: 5,000 BZ
   └── Configura rate: 25% base, 50% viernes

2. MARÍA COMPRA UN CAFÉ ($5 USD)
   ├── Es viernes 11:00 AM → Rate: 50%
   ├── Recompensa: $5 × 50% = $2.50 en Bunz
   ├── Fees: 3% protocolo + 6% affiliate + 2% burn = 11%
   ├── Neto a María: $2.50 - 11% = $2.23 BZ
   └── Pool restante: 5,000 - 2.50 + 0.15 (affiliate fee) = 4,997.65 BZ

3. MARÍA USA SUS BUNZ
   ├── Tiene $2.23 BZ → Va a Pizza Napoli
   ├── Pizza Napoli acepta Bunz (1 BZ = $1)
   ├── Compra pizza ($10) → Paga $2.23 BZ + $7.77 cash
   └── Quema: 2.23 BZ del supply

4. CAFÉ CULTURA RECARGA
   ├── Se quedó sin Bunz en el pool
   ├── Deposita $3,000 USD → Compra 3,000 BZ
   └── Pool: 3,000 BZ (listo para más recompensas)
```

---

## 🔒 Seguridad y Anti-Abuso

Contamos con una suite completa de seguridad, analítica de patrones y mecanismos de rate-limiting on-chain para prevenir actividades maliciosas. Este nivel de infraestructura previene el wash trading, front-running, auto-transacciones y esquemas Sybil, garantizando la salud perenne del tesoro y la comunidad de Rabbitters.

---

**Documento v2.0** — Diseñado por Rabbitty Corp. 🐰✨
