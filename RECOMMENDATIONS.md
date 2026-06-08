# 🐰 Rabbitty Mini App — Recomendaciones Prioritarias (1-9)

**Análisis realizado:** 2026-05-24
**Estado actual:** MVP con UI funcional, datos mock, sin backend real
**Stack:** Next.js 16 + React 19 + Tailwind v4 + Framer Motion + @twa-dev/sdk

---

## 🚨 PRIORIDADES 1-3 (CRÍTICAS — Bloqueantes para producción)

---

### 1. Conectar a Backend Real (Eliminar MOCK data)
**Problema actual:** Todas las páginas usan datos de prueba (MOCK_POSTS, MOCK_HISTORY, MOCK_BUSINESSES, etc.)

**Implementación requerida:**
```typescript
// Crear un servicio API centralizado
// src/services/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rabbitty.com/v1';

export const api = {
  // Feed
  getFeed: () => fetch(`${API_BASE}/feed`),
  
  // Profile
  getProfile: (userId: string) => fetch(`${API_BASE}/users/${userId}`),
  
  // Business
  getBusiness: (id: string) => fetch(`${API_BASE}/businesses/${id}`),
  updateRewardRate: (id: string, rate: number) => 
    fetch(`${API_BASE}/businesses/${id}/rate`, { method: 'PATCH', body: JSON.stringify({ rate }) }),
  
  // Referrals
  getReferrals: (userId: string) => fetch(`${API_BASE}/users/${userId}/referrals`),
  
  // History
  getHistory: (userId: string) => fetch(`${API_BASE}/users/${userId}/history`),
  
  // Map
  getNearbyBusinesses: (lat: number, lng: number, radius: number = 5000) =>
    fetch(`${API_BASE}/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
};
```

**Cambios necesarios por página:**
- [ ] `page.tsx` (Feed): Reemplazar MOCK_POSTS con llamada a API
- [ ] `social/page.tsx`: Reemplazar MOCK_POSTS con API + WebSocket para likes en tiempo real
- [ ] `history/page.tsx`: Reemplazar MOCK_HISTORY con API
- [ ] `map/page.tsx`: Reemplazar MOCK_BUSINESSES con API geolocalizada
- [ ] `business/page.tsx`: Reemplazar businessData con API real
- [ ] `referral/page.tsx`: Reemplazar MY_STATS y REFERRALS con API
- [ ] `profile/page.tsx`: Cargar datos reales del usuario

**Estimado:** 3-4 días
**Dependencias:** Backend API (Railway/Oracle)

---

### 2. Implementar Sistema QR para Escanear y Pagar
**Problema actual:** No existe funcionalidad QR. Es el core del negocio.

**Implementación requerida:**
```typescript
// Nueva página: src/app/scan/page.tsx
// Nueva página: src/app/pay/page.tsx

// Dependencias necesarias:
// npm install @zxing/library @zxing/browser
// o usar la API nativa de Telegram WebApp si está disponible
```

**Flujo QR (Escanear para recibir recompensa):**
1. Usuario abre cámara → escanea QR del negocio
2. Backend valida: business_id + timestamp + nonce
3. Backend verifica transacción bidireccional
4. Mintea bunz al wallet del usuario
5. Muestra confirmación con animación

**Flujo QR (Pagar con bunz):**
1. Usuario genera QR de pago (muestra en pantalla)
2. Negocio escanea con su scanner
3. Backend verifica saldo suficiente
4. Transfiere bunz (91% al negocio, 3% protocolo, 6% fee)
5. Confirma a ambos

**Componentes nuevos:**
- [ ] `QRScanner.tsx` — Componente de escaneo con cámara
- [ ] `QRGenerator.tsx` — Generador de QR para pagos
- [ ] `TransactionConfirm.tsx` — Modal de confirmación
- [ ] `SuccessAnimation.tsx` — Animación de éxito con bunz volando

**Estimado:** 5-7 días
**Dependencias:** Backend Oracle + Contratos inteligentes

---

### 3. Integrar Wallet Blockchain (ethers.js ya en package.json)
**Problema actual:** ethers.js está instalado pero NO se usa en ninguna página.

**Implementación requerida:**
```typescript
// Crear: src/services/wallet.ts
import { ethers } from 'ethers';

const BUNZ_CONTRACT_ADDRESS = '0x...';
const BUNZ_ABI = [...]; // ABI del contrato bunz.sol

export class BunzWallet {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  
  constructor() {
    // Usar RPC de Polygon o testnet
    this.provider = new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_RPC_URL
    );
    this.contract = new ethers.Contract(
      BUNZ_CONTRACT_ADDRESS,
      BUNZ_ABI,
      this.provider
    );
  }
  
  async getBalance(address: string): Promise<bigint> {
    return this.contract.balanceOf(address);
  }
  
  async spendBunz(
    to: string, 
    amount: bigint, 
    signer: ethers.Signer
  ): Promise<ethers.TransactionResponse> {
    const tx = await this.contract.transfer(to, amount);
    return tx.wait();
  }
}
```

**Páginas a integrar:**
- [ ] `page.tsx` (Feed): Mostrar balance real del usuario
- [ ] `history/page.tsx`: Mostrar transacciones reales de blockchain
- [ ] `profile/page.tsx`: Wallet address + balance en tiempo real
- [ ] `business/page.tsx`: Integrar contrato para minting
- [ ] `pay/page.tsx` (nuevo): Firmar transacciones de gasto

**Estimado:** 4-5 días
**Dependencias:** Contratos desplegados en testnet/mainnet

---

## 🔶 PRIORIDADES 4-6 (ALTAS — Mejoran UX drásticamente)

---

### 4. Animaciones y Micro-interacciones Completas
**Problema actual:** Solo hay animaciones básicas de Framer Motion en entrada.

**Implementaciones sugeridas:**

```typescript
// Componentes de animación faltantes:

// 1. Pull-to-refresh en feed
// 2. Skeleton loaders mientras carga data
// 3. Toast notifications (éxito/error)
// 4. Confetti animation al ganar bunz
// 5. Card flip para revelar recompensas
// 6. Parallax suave en scroll
// 7. Lottie para ilustraciones complejas

// Ejemplo: Skeleton Loader
export function PostSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-[16px] p-4">
      <div className="h-48 bg-gray-200 rounded-lg mb-4" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}
```

**Paquetes recomendados:**
```bash
npm install react-lottie-player sonner  # Toasts + Lottie
```

**Estimado:** 2-3 días

---

### 5. Sistema de Autenticación Real con Telegram WebApp
**Problema actual:** Se usa `initDataUnsafe.user` pero no hay validación del hash.

**Implementación requerida:**
```typescript
// src/services/auth.ts
import crypto from 'crypto';

export function validateTelegramWebAppData(initData: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.BOT_TOKEN!)
    .digest();
  
  const computedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return computedHash === hash;
}
```

**Cambios necesarios:**
- [ ] Validar hash en backend (no solo en frontend)
- [ ] Crear JWT tokens propios después de validación
- [ ] Implementar refresh tokens
- [ ] Guardar sesión en localStorage/IndexedDB
- [ ] Manejar expiración de sesión

**Estimado:** 2-3 días

---

### 6. Mapa Interactivo Real (Google Maps o Mapbox)
**Problema actual:** El mapa es un placeholder con "Interactive Map".

**Implementación recomendada:**
```bash
npm install @react-google-maps/api
# o
npm install react-map-gl mapbox-gl
```

```typescript
// src/app/map/page.tsx (reemplazo completo)
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

export default function RealMapPage() {
  const [userLocation, setUserLocation] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  
  useEffect(() => {
    // Obtener ubicación del usuario
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }),
      (err) => console.error('Error geolocation:', err)
    );
    
    // Cargar negocios cercanos desde API
    if (userLocation) {
      api.getNearbyBusinesses(userLocation.lat, userLocation.lng)
        .then(setBusinesses);
    }
  }, []);
  
  return (
    <GoogleMap
      center={userLocation || { lat: 19.4326, lng: -99.1332 }}
      zoom={15}
      mapContainerStyle={{ width: '100%', height: '100vh' }}
    >
      {businesses.map(business => (
        <Marker
          key={business.id}
          position={{ lat: business.lat, lng: business.lng }}
          onClick={() => setSelectedBusiness(business)}
          icon={{
            url: '/rabbit-marker.svg',
            scaledSize: new window.google.maps.Size(40, 40)
          }}
        />
      ))}
      
      {selectedBusiness && (
        <InfoWindow
          position={{ lat: selectedBusiness.lat, lng: selectedBusiness.lng }}
          onCloseClick={() => setSelectedBusiness(null)}
        >
          <BusinessCard business={selectedBusiness} />
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
```

**Estimado:** 3-4 días
**Dependencias:** API key de Google Maps / Mapbox

---

## ✅ PRIORIDADES 7-9 (MEJORAS — Optimización y polish)

---

### 7. Optimización de Performance y PWA
**Problema actual:** No hay manifest, no hay service worker, no hay lazy loading.

**Implementación:**
```typescript
// next.config.js (crear)
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  // ...config existente
});
```

**Tareas:**
- [ ] Instalar `next-pwa` y configurar
- [ ] Crear `manifest.json` con iconos Rabbitty
- [ ] Implementar lazy loading para imágenes (`next/image` con `loading="lazy"`)
- [ ] Code splitting por ruta (`React.lazy()` + `Suspense`)
- [ ] Implementar SWR o React Query para cache de datos
- [ ] Virtualizar listas largas (`react-window` o `react-virtualized`)
- [ ] Optimizar imágenes (WebP/AVIF)
- [ ] Preload fuentes críticas

```bash
npm install next-pwa @tanstack/react-query
```

**Estimado:** 2-3 días

---

### 8. Testing y Manejo de Errores
**Problema actual:** Cero tests. Cero manejo de errores en las llamadas.

**Implementación:**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest
```

```typescript
// src/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react';
import FeedPage from '../app/page';

describe('FeedPage', () => {
  it('renders feed with posts', () => {
    render(<FeedPage />);
    expect(screen.getByText('bunz\'in')).toBeInTheDocument();
  });
});
```

**Manejo de errores por implementar:**
- [ ] Error boundaries (`componentDidCatch` o `react-error-boundary`)
- [ ] Retry automático en fallos de API
- [ ] Estados offline (service worker + cache)
- [ ] Fallback UI para cada página
- [ ] Logging de errores (Sentry)

```bash
npm install react-error-boundary @sentry/react
```

**Estimado:** 3-4 días

---

### 9. Analytics y Tracking de Eventos
**Problema actual:** No hay tracking. No sabemos qué hacen los usuarios.

**Implementación:**
```typescript
// src/services/analytics.ts
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    // Google Analytics 4
    if (window.gtag) {
      window.gtag('event', event, properties);
    }
    
    // Mixpanel (alternativa)
    // mixpanel.track(event, properties);
    
    // Telegram WebApp events
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.sendData(JSON.stringify({ event, properties }));
    }
  },
  
  pageView: (page: string) => {
    analytics.track('page_view', { page });
  },
  
  // Eventos específicos de Rabbitty
  bunzEarned: (amount: number, business: string) => {
    analytics.track('bunz_earned', { amount, business });
  },
  
  bunzSpent: (amount: number, business: string) => {
    analytics.track('bunz_spent', { amount, business });
  },
  
  referral: (code: string, source: string) => {
    analytics.track('referral_used', { code, source });
  },
};
```

**Eventos a trackear:**
- [ ] Registro de usuario
- [ ] Escaneo QR exitoso/fallido
- [ ] Pago con bunz
- [ ] Cambio de reward rate (negocios)
- [ ] Compartir código de referido
- [ ] Tiempo en cada pantalla
- [ ] Funnel de conversión (onboarding → primera transacción)

**Estimado:** 2-3 días

---

## 📊 Timeline Total

| Prioridad | Tarea | Estimado | Dependencias |
|-----------|-------|----------|--------------|
| **1** | Backend API real | 3-4 días | Oracle/Backend |
| **2** | Sistema QR | 5-7 días | Backend + Contratos |
| **3** | Wallet blockchain | 4-5 días | Contratos desplegados |
| **4** | Animaciones | 2-3 días | Ninguna |
| **5** | Auth Telegram | 2-3 días | Backend |
| **6** | Mapa real | 3-4 días | API key |
| **7** | Performance/PWA | 2-3 días | Ninguna |
| **8** | Testing | 3-4 días | Ninguna |
| **9** | Analytics | 2-3 días | Ninguna |

**Total estimado:** ~26-36 días (6-7 semanas)
**Fase 1 crítico (1-3):** ~12-16 días (2-3 semanas)

---

## 🎯 Próximo Paso Sugerido

Empezar con **Prioridad 1 + 5** en paralelo:
1. Backend API (Hefesto)
2. Auth Telegram (Sofía/Hefesto)

Mientras tanto, **Prioridad 4 + 7** pueden avanzar sin bloqueos.

¿Procedemos? 🚀