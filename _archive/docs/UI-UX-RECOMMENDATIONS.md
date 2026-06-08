# 🎨 Rabbitty Mini App — Recomendaciones UI/UX (1-9)

**Análisis realizado:** 2026-05-24
**Estado actual:** MVP funcional con diseño básico limpio
**Stack:** Next.js 16 + Tailwind v4 + Framer Motion

---

## 🚨 PRIORIDADES 1-3: FUNDAMENTOS VISUALES

---

### 1. Sistema de Color Consistente y Expandido
**Problema actual:** Solo 3 colores (#FAFAFA, #E91E63, #111111). Falta profundidad.

**Sistema propuesto:**
```css
:root {
  /* Primarios */
  --rabbitty-pink: #E91E63;
  --rabbitty-pink-light: #FF4081;
  --rabbitty-pink-dark: #C2185B;
  
  /* Neutros */
  --bg-primary: #FAFAFA;
  --bg-elevated: #FFFFFF;
  --bg-pressed: #F5F5F5;
  
  /* Texto */
  --text-primary: #111111;
  --text-secondary: #666666;
  --text-muted: #8A8A8A;
  
  /* Estados */
  --success: #4CAF50;
  --warning: #FF9800;
  --error: #F44336;
  
  /* Accent para badges de bunz */
  --bunz-gold: #FFD700;
  --bunz-glow: rgba(233, 30, 99, 0.15);
}
```

**Tareas:**
- [ ] Crear `colors.ts` con tokens tipados
- [ ] Reemplazar todos los hex hardcodeados por variables
- [ ] Añadir estados hover/active con transiciones suaves
- [ ] Implementar modo oscuro (dark mode) para Telegram

---

### 2. Tipografía y Jerarquía Visual Clara
**Problema actual:** Solo Inter 300-700. Sin escala tipográfica definida.

**Sistema propuesto:**
```css
/* Escala tipográfica */
--text-display: 2.5rem;    /* 40px - Títulos de sección */
--text-h1: 1.5rem;         /* 24px - Títulos de página */
--text-h2: 1.25rem;        /* 20px - Subtítulos */
--text-body: 0.9375rem;    /* 15px - Cuerpo (actual) */
--text-caption: 0.8125rem; /* 13px - Metadata */
--text-small: 0.75rem;     /* 12px - Labels */

/* Pesos */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

**Tareas:**
- [ ] Crear componente `<Text variant="display/h1/body/caption">`
- [ ] Definir líneas base (line-height 1.4 para body, 1.2 para headings)
- [ ] Añadir letter-spacing apropiado para cada escala
- [ ] Considerar SF Pro en iOS (cuando esté disponible)

---

### 3. Espaciado y Layout Consistente
**Problema actual:** Espaciado inconsistente (px-4, px-6, py-3, py-4 mezclados).

**Sistema propuesto (8-point grid):**
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

**Tareas:**
- [ ] Crear componente `<Stack gap={4}>` para layouts
- [ ] Definir padding estándar para cards (24px = space-6)
- [ ] Definir gap entre elementos de lista (16px = space-4)
- [ ] Crear grid system responsive

---

## 🔶 PRIORIDADES 4-6: COMPONENTES E INTERACCIONES

---

### 4. Estados Vacíos y Loading States
**Problema actual:** Cuando no hay data, muestra "Próximamente" o listas vacías sin mensaje.

**Implementaciones necesarias:**

```tsx
// Empty State Component
export function EmptyState({ 
  icon, 
  title, 
  description, 
  action 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-[#111111] mb-2">{title}</h3>
      <p className="text-sm text-[#8A8A8A] mb-6">{description}</p>
      {action}
    </div>
  );
}

// Skeleton Loader
export function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white rounded-[16px] p-4 border border-gray-100">
      <div className="h-48 bg-gray-200 rounded-lg mb-4" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}
```

**Tareas:**
- [ ] Diseñar empty states para cada página
- [ ] Implementar skeleton loaders en todas las listas
- [ ] Añadir shimmer effect (gradiente animado)
- [ ] Crear error states con retry button

---

### 5. Feedback Visual y Micro-interacciones
**Problema actual:** Solo hay `active:scale-[0.98]` y animaciones de entrada básicas.

**Implementaciones sugeridas:**

```tsx
// Toast notifications
import { Toaster, toast } from 'sonner';

// Ejemplo de uso:
toast.success('¡+50 bunz ganados!', {
  icon: '🐰',
  description: 'Café Cultura',
  duration: 3000,
});

// Confetti al ganar bunz
import confetti from 'canvas-confetti';

const celebrateBunz = (amount: number) => {
  confetti({
    particleCount: amount * 2,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#E91E63', '#FFD700', '#FF4081'],
  });
};
```

**Tareas:**
- [ ] Integrar `sonner` para toasts
- [ ] Añadir haptic feedback (Telegram WebApp)
- [ ] Implementar confetti en momentos clave
- [ ] Añadir micro-interacciones en botones (ripple effect)
- [ ] Transiciones entre pantallas (slide/fade)

---

### 6. Componentes UI Reutilizables
**Problema actual:** Cada página repite estilos. No hay componentes compartidos.

**Componentes a crear:**

```tsx
// src/components/ui/

// Card.tsx — Card consistente en toda la app
export function Card({ children, className, onClick }: CardProps) {
  return (
    <div 
      className={`bg-white rounded-[16px] border border-gray-100 
        shadow-[0_4px_16px_rgba(0,0,0,0.02)] 
        transition-all duration-200 
        active:scale-[0.98] 
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''} 
        ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Button.tsx — Botones con variantes
export function Button({ 
  variant = 'primary', 
  size = 'md',
  children,
  ...props 
}: ButtonProps) {
  const variants = {
    primary: 'bg-[#111111] text-white hover:bg-[#333]',
    secondary: 'bg-white text-[#111] border border-gray-200',
    ghost: 'bg-transparent text-[#E91E63]',
    danger: 'bg-[#F44336] text-white',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-[15px]',
    lg: 'px-8 py-4 text-base',
  };
  
  return (
    <button 
      className={`rounded-md font-medium transition-all active:scale-[0.97] 
        ${variants[variant]} ${sizes[size]}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Badge.tsx — Para labels de bunz y ratings
export function Badge({ variant, children }: BadgeProps) {
  const variants = {
    bunz: 'bg-[#E91E63]/10 text-[#E91E63]',
    rating: 'bg-gray-50 text-gray-600',
    distance: 'bg-blue-50 text-blue-600',
  };
  
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${variants[variant]}`}>
      {children}
    </span>
  );
}
```

**Tareas:**
- [ ] Crear carpeta `src/components/ui/`
- [ ] Implementar Card, Button, Badge, Input, Avatar
- [ ] Documentar props con JSDoc
- [ ] Crear Storybook para visualizar componentes (opcional)

---

## ✅ PRIORIDADES 7-9: EXPERIENCIA DE USUARIO

---

### 7. Flujo de Onboarding
**Problema actual:** No hay onboarding. El usuario llega a "Role Selection" sin contexto.

**Flujo propuesto:**
```
1. Welcome Screen
   - Logo animado
   - "Gana bunz por consumir"
   - Botón "Comenzar"

2. Permisos
   - Ubicación (para mapa)
   - Cámara (para QR)
   - Notificaciones

3. Explicación del sistema (3 slides)
   - "Escanea QR en negocios"
   - "Gana bunz automáticamente"
   - "Usa bunz en otros negocios"

4. Selección de rol
   - Member vs Business (actual)
   - Más claro con ilustraciones

5. Crear cuenta / Vincular wallet
   - Generar wallet automáticamente
   - Backup phrase
   - Opción de importar wallet existente

6. First transaction
   - Tutorial interactivo
   - Mock transaction para practicar
```

**Tareas:**
- [ ] Diseñar 3-4 pantallas de onboarding
- [ ] Implementar con `framer-motion` para transiciones suaves
- [ ] Añadir indicador de progreso (dots)
- [ ] Guardar estado de onboarding en localStorage

---

### 8. Navegación y Descubrimiento
**Problema actual:** BottomNav tiene íconos poco claros (Square para mapa, ShoppingBag para perfil).

**Mejoras sugeridas:**

```tsx
// BottomNav mejorado
const NAV_ITEMS = [
  { 
    path: '/', 
    label: 'Feed', 
    icon: Home,  // Mejor que "Ra"
    activeIcon: HomeFilled 
  },
  { 
    path: '/social', 
    label: 'Social', 
    icon: MessageCircle,
    badge: 3 // Notificaciones no leídas
  },
  { 
    path: '/scan', 
    label: 'Scan', 
    icon: ScanLine,  // Botón central prominente
    isPrimary: true  // Más grande, color accent
  },
  { 
    path: '/map', 
    label: 'Mapa', 
    icon: MapPin  // Mejor que Square
  },
  { 
    path: '/profile', 
    label: 'Perfil', 
    icon: User  // Mejor que ShoppingBag
  },
];
```

**Tareas:**
- [ ] Rediseñar BottomNav con íconos más intuitivos
- [ ] Añadir badge de notificaciones
- [ ] Destacar botón de Scan (central, más grande)
- [ ] Añadir gestures (swipe entre tabs)
- [ ] Implementar deep linking

---

### 9. Accesibilidad y Responsive
**Problema actual:** No hay atención a a11y. Solo funciona en móvil.

**Implementaciones:**

```tsx
// A11y improvements
<button 
  aria-label="Escanear QR"
  aria-pressed={isScanning}
  role="button"
>
  <ScanIcon aria-hidden="true" />
</button>

// Focus visible
*:focus-visible {
  outline: 2px solid #E91E63;
  outline-offset: 2px;
}

// Reduce motion
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

// Dark mode (para Telegram dark mode)
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #111111;
    --bg-elevated: #1A1A1A;
    --text-primary: #FFFFFF;
    --text-secondary: #AAAAAA;
  }
}
```

**Tareas:**
- [ ] Añadir `aria-label` a todos los botones
- [ ] Implementar `prefers-reduced-motion`
- [ ] Soporte dark mode (detectar tema de Telegram)
- [ ] Asegurar contraste de color WCAG AA
- [ ] Tamaños de touch target mínimo 44x44px
- [ ] Testing con screen reader (VoiceOver/TalkBack)

---

## 📊 Resumen de Prioridades

| # | Prioridad | Impacto | Esfuerzo | Estado |
|---|-----------|---------|----------|--------|
| 1 | Sistema de Color | Alto | Bajo | 🚧 |
| 2 | Tipografía | Alto | Bajo | 🚧 |
| 3 | Espaciado | Medio | Bajo | 🚧 |
| 4 | Estados Vacíos | Alto | Medio | 🚧 |
| 5 | Feedback Visual | Alto | Medio | 🚧 |
| 6 | Componentes UI | Alto | Medio | 🚧 |
| 7 | Onboarding | Alto | Alto | 🚧 |
| 8 | Navegación | Medio | Bajo | 🚧 |
| 9 | Accesibilidad | Medio | Medio | 🚧 |

**Recomendación:** Empezar con 1-3 (fundamentos) → 6 (componentes) → 4-5 (estados/feedback) → 7-9 (UX avanzada)

---

## 🎨 Moodboard / Referencias Visuales Sugeridas

- **Cash App** — Minimalismo, tipografía bold, animaciones fluidas
- **Venmo** — Feed social de pagos, emojis
- **Monzo** — Tarjetas de transacciones limpias, color coding
- **Airbnb** — Mapa interactivo, filtros
- **Klarna** — Checkout experiencia, recompensas visuales

---

*Generado por Sofía para Rabbitty Mini App UI/UX Review*