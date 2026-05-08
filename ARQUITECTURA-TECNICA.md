# Rabbitty - Arquitectura Técnica Global

**Documento:** Arquitectura de Sistema Escalable y Segura
**Fecha:** 2026-05-07
**Clasificación:** Confidencial - Bull's Lab

---

## 🎯 Principios de Diseño

1. **Escalabilidad Global desde Día 1**
2. **Cyber Seguridad de Clase Mundial**
3. **Eficiencia y Baja Latencia (<100ms)**
4. **Seguridad Financiera Bancaria**
5. **Arquitectura Fintech-First**

---

## 🏗️ Stack Tecnológico Global

### Frontend
| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Mobile** | Flutter 3.x | Single codebase, performance nativo, 120fps |
| **Web** | Next.js 14 + React Server Components | SSR, Edge rendering, SEO |
| **Mini App** | Telegram Web App API | Validación rápida, onboarding cero fricción |
| **Desktop** | Flutter Desktop / Electron | Unificación de codebase |

### Backend - Arquitectura de Microservicios

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Kong/AWS API GW)              │
│              Rate Limiting | Auth | Routing | Cache         │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼────┐    ┌────▼────┐    ┌──────▼─────┐
│ Auth   │    │ Wallet  │    │  Social    │
│Service │    │Service  │    │  Service   │
└────────┘    └─────────┘    └────────────┘
     │              │                │
┌────▼────┐    ┌───▼─────┐    ┌─────▼──────┐
│Affiliate│    │ Treasury│    │   Maps     │
│Service  │    │Service  │    │  Service   │
└────────┘    └─────────┘    └────────────┘
     │              │                │
┌────▼────┐    ┌───▼─────┐    ┌─────▼──────┐
│ POS     │    │Analytics│    │  Banking   │
│Service  │    │Service  │    │  Service   │
└─────────┘    └─────────┘    └────────────┘
```

**Core:** Go (Golang) + gRPC
- **Go:** Concurrency nativa, performance, bajo footprint
- **gRPC:** Comunicación inter-servicios eficiente (<10ms)

**Supporting:** Node.js para servicios I/O intensivos (Chat, Notificaciones)

### Database - Polyglot Persistence

| Datos | Tecnología | Razón |
|-------|------------|-------|
| **Transacciones Financieras** | CockroachDB / YugabyteDB | ACID + Distribución global + Consistencia fuerte |
| **Wallet/Balance Bunz** | PostgreSQL + TimescaleDB | Series temporales + histórico |
| **Social Feed** | ScyllaDB (Cassandra compatible) | Write-heavy, millones de writes/seg |
| **Cache** | Redis Cluster + Dragonfly | Sub-millisecond response |
| **Search** | Elasticsearch + Algolia | Búsqueda instantánea de negocios |
| **Documentos** | MongoDB Atlas | Perfil users, metadata flexible |

### Blockchain Layer - Token Bunz

```
┌──────────────────────────────────────┐
│         Token Bunz (BUNZ)            │
│     ERC-20 / SPL Token Standard      │
├──────────────────────────────────────┤
│  Layer 2: Polygon PoS / Solana      │
│  • Gas fees < $0.001                 │
│  • Finalidad < 2 segundos           │
│  • Throughput: 7,000+ TPS           │
└──────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌──▼───┐ ┌──▼────┐
│Custody│ │Bridge│ │Smart  │
│Wallet │ │ETH   │ │Contracts
└───────┘ └──────┘ └───────┘
```

**Custodia:** MPC (Multi-Party Computation) - Fireblocks / Qredo

### Infraestructura - Multi-Cloud

```
┌────────────────────────────────────────────┐
│              Global CDN (Cloudflare)       │
│     DDoS Protection | WAF | Edge Cache    │
└────────────────────┬───────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼────┐    ┌────▼────┐    ┌──────▼──────┐
│ AWS    │    │ GCP     │    │ Azure       │
│ us-east│    │ europe  │    │ asia        │
│ latam  │    │ africa  │    │ oceania     │
└────────┘    └─────────┘    └─────────────┘
    │                │                │
    └────────────────┼────────────────┘
                     │
            ┌────────▼────────┐
            │ Kubernetes      │
            │ (EKS/GKE/AKS)   │
            │ Multi-Region    │
            └─────────────────┘
```

**Orquestación:** Kubernetes + Istio Service Mesh
**Observabilidad:** Datadog / New Relic + Grafana + PagerDuty

---

## 🔐 Cyber Seguridad de Clase Mundial

### Capas de Seguridad

```
┌──────────────────────────────────────────┐
│ Layer 7: Application Security          │
│ • WAF (OWASP Top 10)                    │
│ • Input validation estricto             │
│ • Rate limiting por endpoint            │
├──────────────────────────────────────────┤
│ Layer 6: API Security                    │
│ • mTLS entre servicios                  │
│ • JWT + Refresh tokens rotativos       │
│ • OAuth2 / OIDC                         │
├──────────────────────────────────────────┤
│ Layer 5: Network Security                │
│ • VPC Isolation                         │
│ • Zero Trust Architecture               │
│ • Private Link / Direct Connect        │
├──────────────────────────────────────────┤
│ Layer 4: Data Security                   │
│ • AES-256-GCM encryption at rest        │
│ • TLS 1.3 in transit                    │
│ • Field-level encryption (PII)          │
├──────────────────────────────────────────┤
│ Layer 3: Blockchain Security             │
│ • MPC Wallets (no private keys stored)  │
│ • Multi-sig para transacciones >X       │
│ • Cold storage para 95% de fondos       │
├──────────────────────────────────────────┤
│ Layer 2: Compliance                    │
│ • PCI DSS Level 1                       │
│ • SOC 2 Type II                       │
│ • ISO 27001                           │
├──────────────────────────────────────────┤
│ Layer 1: Physical Security             │
│ • HSM (Hardware Security Modules)       │
│ • Biometric access to infra           │
└──────────────────────────────────────────┘
```

### Zero-Trust Security Model
- **Nunca confiar, siempre verificar**
- Cada request autenticada y autorizada
- Microsegmentación de red
- Análisis de comportamiento en tiempo real (UEBA)

---

## 💰 Arquitectura Fintech / Banking

### Wallet Bunz Core

```
┌─────────────────────────────────────────────┐
│           WALLET BUNZ ENGINE                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐    ┌──────────────────┐  │
│  │   Hot       │    │     Warm         │  │
│  │   Wallet    │◄──►│    Wallet       │  │
│  │  (5% funds) │    │  (20% funds)     │  │
│  └─────────────┘    └──────────────────┘  │
│         │                      │          │
│         └──────────┬───────────┘          │
│                    │                     │
│              ┌─────▼──────┐              │
│              │   Cold      │              │
│              │   Storage   │              │
│              │  (75% funds)│              │
│              └─────────────┘              │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │   Treasury Management              │   │
│  │   • Rebalancing automático         │   │
│  │   • Risk scoring ML                │   │
│  │   • Fraud detection en tiempo real │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Future: Banking STP + Tarjeta Virtual

```
┌─────────────────────────────────────┐
│      BANCO DIGITAL RABBITTY         │
│        (Licencia STP)               │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │Clabe    │  │Tarjeta  │          │
│  │Virtual  │  │Virtual  │          │
│  │         │  │(VISA/MC)│          │
│  └─────────┘  └─────────┘          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Core Banking (Temenos/   │    │
│  │  Finacle/Mambu)            │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  SPEI / SWIFT / SEPA       │    │
│  │  Integración              │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## 📊 Algoritmo Bunz + Tesorería

### Algoritmo de Recompensas (Give to Get)

```python
class BunzAlgorithm:
    """
    Core algorithm for Bunz distribution
    """
    
    def calculate_reward(self, transaction):
        """
        Calculate bunz reward based on:
        - Transaction amount
        - Affiliate tier
        - User tier
        - Time-based multipliers
        - Network effects
        """
        base = transaction.amount * 0.20  # 20% base
        
        # Affiliate tier multiplier (1x to 3x)
        affiliate_multiplier = self.get_affiliate_tier(transaction.merchant)
        
        # User tier bonus
        user_bonus = self.get_user_tier_bonus(transaction.user)
        
        # Network effect: number of referrals
        network_multiplier = 1 + (transaction.user.referrals * 0.05)
        
        # Time-based: early adopters get more
        time_multiplier = self.calculate_time_decay(transaction.timestamp)
        
        final_reward = (base * affiliate_multiplier + user_bonus) * network_multiplier * time_multiplier
        
        return min(final_reward, transaction.amount * 1.0)  # Cap at 100%

    def treasury_rebalance(self):
        """
        Automated treasury management
        """
        # Daily rebalancing based on:
        # - Transaction volume
        # - Burn rate
        # - Market conditions
        # - Growth projections
        pass
```

### Tesorería Inteligente

- **Automated Market Maker (AMM)** para liquidez instantánea Bunz↔Cash
- **Yield farming** de tesorería en protocolos DeFi seguros
- **Hedging** de exposición a volatilidad
- **Dynamic pricing** según supply/demand de Bunz

---

## 🚀 Roadmap Técnico

### Fase 1: MVP Telegram (Meses 1-3)
- Mini App básica
- Wallet Bunz simple
- Directorio de 50 afiliados piloto
- Smart contracts básicos

### Fase 2: Beta Nativa (Meses 4-6)
- Flutter app v1.0
- Social feed + mensajería
- Mapa de afiliados
- Sistema de recompensas live

### Fase 3: Scale (Meses 7-12)
- Multi-region deployment
- Full banking integration
- POS hardware para afiliados
- Analytics avanzado

### Fase 4: Banking (Año 2)
- Licencia STP
- Tarjetas virtuales
- SPEI integration
- Lending/Borrowing

---

## 📈 Métricas de Éxito Técnicas

| Métrica | Target | Actual |
|---------|--------|--------|
| Latencia API p95 | <100ms | - |
| Availability | 99.99% | - |
| TPS (peak) | 10,000 | - |
| Cold start functions | <200ms | - |
| DB query time | <10ms | - |
| Security incidents | 0 | - |

---

**Documento creado:** 2026-05-07
**Siguiente revisión:** Post-MVP
**Owner:** Hefesto (Tech Lead)
