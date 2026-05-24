# 🐰 Rabbitty — Resumen del Modelo Real (Confirmación)

## ✅ Lo que ENTENDÍ del modelo correcto:

### 1. Creación de Bunz
- ❌ **NO** compran Bunz con cash
- ✅ **SÍ** los negocios **MINTEAN** Bunz cuando hay consumo verificado
- ✅ El consumo se verifica bidireccionalmente (QR usuario ↔ negocio)

### 2. Crédito de Minting
- ✅ Paquetes iniciales: $10K, $20K, $50K, $100K pesos
- ✅ Por nicho: Restaurantes, gyms, retail, servicios, etc.
- ✅ Etapa 2+: Solicitud manual, autorizado por Rabbitty

### 3. Paridad
- ✅ **1 bunz = 1 moneda local** ($1 MXN, $1 USD, €1 EUR)
- ✅ Equivalencia fija entre países
- ✅ `bunz` (minúscula) = interno | `BUNZ` (mayúscula) = cripto ERC-20

### 4. Sin Conversión Directa a Cash
- ❌ **NO** se puede convertir Bunz → Cash directamente
- ✅ **SÍ** se gasta en negocios del ecosistema
- ✅ La "conversión" es consumir en otro negocio

### 5. Fees en Bunz
- ✅ Cuando gastas Bunz: 3% protocolo, 6% negocio receptor, 1% burn
- ✅ Todo va a la tesorería de Rabbitty
- ✅ Nadie maneja cash/pesos/dólares, solo Bunz

### 6. Verificación
- ✅ QR bidireccional: usuario escanea negocio O negocio escanea usuario
- ✅ Backend verifica ambas partes
- ✅ Top de línea en seguridad cibernética

### 7. Sin Garantía/Colateral
- ✅ El inventario del negocio es la garantía implícita
- ✅ Restaurante ya tiene comida = garantía suficiente

---

## 📋 Contratos a Implementar:

1. **`bunz.sol`** — Minting por consumo, crédito de negocios, fees
2. **`BusinessRegistry.sol`** — Paquetes, registro, tipos de negocio
3. **`TreasuryEngine.sol`** — Acumulación de fees, promociones, ofertas
4. **`BUNZ.sol`** (mayúscula) — ERC-20 para intercambio externo (fase 2)

---

## ❓ Preguntas para confirmar:

1. ¿Los paquetes iniciales son en MXN (pesos mexicanos)? ¿O USD?
2. ¿El fee del 3% + 6% se aplica cuando el usuario GASTA Bunz o cuando el negocio da la recompensa?
3. ¿Cuál es el fee de membresía anual del negocio después del año 1? ¿En Bunz?
4. ¿La membresía del usuario (Rabbiter) también se paga en Bunz?

---

**Confirmame estas preguntas y deployamos en Sepolia.** 🚀
