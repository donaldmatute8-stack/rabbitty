# 🚀 Rabbitty Deploy Guide

## Opciones de Deploy

### Opción 1: Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd telegram-miniapp
vercel --prod

# Configurar variables de entorno en Vercel Dashboard:
# - NEXT_PUBLIC_API_URL=https://api.rabbitty.com/v1
# - NEXT_PUBLIC_BUNZ_CONTRACT_ADDRESS=0x...
# - NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
# - NEXT_PUBLIC_CHAIN_ID=11155111
```

### Opción 2: Netlify

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
cd telegram-miniapp
netlify deploy --prod --dir=dist
```

### Opción 3: GitHub Pages

```bash
# Configurar en package.json:
"homepage": "https://yourusername.github.io/rabbitty"

# Deploy
npm run build
npm run deploy
```

---

## Backend Deploy

### Opción 1: Railway (Recomendado)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Init
railway init

# Deploy
railway up
```

### Opción 2: Render

1. Crear cuenta en render.com
2. Conectar repo de GitHub
3. Configurar:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Variables de entorno:
   - DATABASE_URL
   - SECRET_KEY
   - BOT_TOKEN

### Opción 3: Docker en VPS

```bash
# En servidor con Docker
scp -r backend/ user@vps:/opt/rabbitty/
ssh user@vps "cd /opt/rabbitty && docker-compose up -d"
```

---

## Configuración Post-Deploy

### 1. Dominio
- Configurar DNS para apuntar a Vercel/Railway
- SSL automático (Let's Encrypt)

### 2. Variables de Entorno

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=https://api.rabbitty.com/v1
NEXT_PUBLIC_BUNZ_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org
NEXT_PUBLIC_CHAIN_ID=11155111
```

**Backend (.env):**
```
DATABASE_URL=postgresql://...
SECRET_KEY=super-secret-key
BOT_TOKEN=telegram-bot-token
REDIS_URL=redis://...
```

### 3. SSL/TLS
- Vercel: Automático
- Railway: Automático
- VPS: `certbot --nginx`

### 4. Monitoreo
- UptimeRobot: https://uptimerobot.com
- Sentry: https://sentry.io
- LogRocket: https://logrocket.com

---

## Verificación Post-Deploy

```bash
# Test API
curl https://api.rabbitty.com/v1/health

# Test Frontend
curl https://rabbitty.com

# Test Wallet
curl https://rpc.sepolia.org -X POST -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

*Deploy guide - Rabbitty v1.0*
