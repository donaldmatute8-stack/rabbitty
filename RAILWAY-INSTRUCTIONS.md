# 🚀 Instrucciones Railway - Rabbitty Oracle

## Paso 1: Login (una vez)
```bash
npm install -g @railway/cli
railway login
# Abre navegador → Autoriza → Listo
```

## Paso 2: Crear Proyecto
```bash
cd /Users/bullslab/.openclaw/agents/sofia-workspace/projects/Rabbitty/backend-oracle
railway login
railway project create rabbitty-oracle
```

## Paso 3: Variables (Importante)
En Railway Dashboard o CLI:
```bash
railway variables set SEPOLIA_PRIVATE_KEY="tu_clave_aqui"
railway variables set SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
railway variables set BUNZ_CONTRACT="0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB"
railway variables set PORT="3001"
```

## Paso 4: Deploy
```bash
railway up
```

## Paso 5: URL
Railway te dará algo como:
`https://rabbitty-oracle-production.up.railway.app`

---

## 📋 Checklist Backend (después del deploy)

- [ ] Oracle corriendo en Railway
- [ ] Health check: `GET /health` responde OK
- [ ] MiniApp apuntando a nueva URL
- [ ] Redis configurado (opcional, para rate limits)

## 🔗 Conectar MiniApp

Actualizar en `telegram-miniapp/src/app/page.tsx`:
```typescript
const response = await fetch('https://TU-URL-DE-RAILWAY.app/process-consumption', {...})
```

---

**Yo preparé:** Dockerfile, railway.toml, deploy script ✅
**Tú necesitas:** Hacer login y deploy

¿Me pasas la URL cuando esté listo?
