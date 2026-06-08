# 🚀 Deploy a Railway - Comandos para Marco

## Opción 1: Login rápido (más fácil)

```bash
cd /Users/bullslab/.openclaw/agents/sofia-workspace/projects/Rabbitty/backend-oracle
railway login
# Se abre navegador → Click "Authorize" → Vuelves al terminal

# Crear proyecto
railway project create rabbitty-oracle

# Variables de entorno
railway variables set SEPOLIA_PRIVATE_KEY="tu_clave_de_sepolia_aqui"
railway variables set SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
railway variables set BUNZ_CONTRACT="0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB"
railway variables set PORT="3001"

# Deploy
railway up

# Ver URL
railway domain
```

## Opción 2: Dashboard Web (si prefieres clicks)

1. Ve a https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Selecciona repo (o sube carpeta backend-oracle)
4. En "Variables", agrega las de arriba
5. Click "Deploy"

## Archivos ya preparados ✅

- `Dockerfile` - Configuración de contenedor
- `railway.toml` - Configuración de Railway
- `server.js` - Oracle API completo
- `.gitignore` - Excluye node_modules y secrets

## Después del deploy

Railway te dará una URL tipo:
```
https://rabbitty-oracle-production.up.railway.app
```

La pasas a Sofía para actualizar la MiniApp.

---

**Tiempo estimado:** 2-3 minutos
