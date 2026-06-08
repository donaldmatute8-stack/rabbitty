# Railway Backend Deployment - Rabbitty Oracle

## 📋 Resumen
Backend Oracle que necesita desplegarse en Railway para producción.

## 🔧 Servicios a Desplegar

### 1. Oracle API (Node.js/Express)
**Puerto:** 3001
**Archivos:** `/backend-oracle/`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

**Variables de entorno necesarias:**
```env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_PRIVATE_KEY=<tu_private_key>
BUNZ_CONTRACT=0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB
REDIS_URL=${{Redis.REDIS_URL}}
PORT=3001
```

### 2. Redis (para rate limiting)
**Servicio:** Upstash Redis o Railway Redis
**Uso:** Rate limiting por business (100 tx/hora)

## 🚀 Instrucciones para Marco

### Paso 1: Crear proyecto en Railway
1. Ve a https://railway.app
2. Crea nuevo proyecto "rabbitty-oracle"
3. Selecciona "Deploy from GitHub repo" (o sube carpeta)

### Paso 2: Variables de entorno
En Railway Dashboard → Variables, agrega:
- `SEPOLIA_PRIVATE_KEY` — Tu clave privada de Sepolia (la del archivo .env.secrets)
- `SEPOLIA_RPC_URL` — https://ethereum-sepolia-rpc.publicnode.com
- `BUNZ_CONTRACT` — 0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB

### Paso 3: Añadir Redis
1. Click "New" → Database → Redis
2. Railway generará `REDIS_URL` automáticamente

### Paso 4: Deploy
Railway auto-deploya al hacer push a GitHub.

## 📁 Archivos que necesito preparar

1. ✅ `Dockerfile` — Ya lo tengo listo
2. ✅ `railway.toml` — Config de Railway
3. 🔄 Actualizar MiniApp para usar URL de Railway

## 🎯 Resultado esperado

**URL del Oracle:** `https://rabbitty-oracle.up.railway.app`

Endpoints:
- `POST /process-consumption` — Verificar QR y mintear bunz
- `GET /health` — Health check
- `GET /business/:address` — Datos del negocio

## ⚠️ Importante

**NO subir el .env.secrets a GitHub** — Railway variables son seguras.

---

**Estado:** ⏳ Esperando acceso a Railway de Marco
