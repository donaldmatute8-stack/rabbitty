# Comercio premium — sistema de color y jerarquía

> Fase **2.1 hecha** (tokens y color). La fase **2.2** (jerarquía y estructura) está
> descrita al final como el siguiente paso, con los bloques exactos a mover.

## El problema, medido

`telegram-miniapp/src/app/affiliate/[id]/page.tsx` (perfil del negocio):

| Antes | Ahora |
|---|---|
| 69 colores hex escritos a mano | **0** (todo por token) |
| 10 gradientes inline distintos | 5, todos de token |
| 1,718 líneas, todo compitiendo | igual por ahora: la jerarquía es la fase 2.2 |

Síntoma que reportó el usuario: "se está volviendo muy saturada y tiene muchos
colores en todos lados". La causa no era el rosa de marca, eran **21 tonos
distintos** haciendo el mismo trabajo (avisar, separar, destacar).

## La regla

**Un acento de marca, tres superficies, semánticos sólo para estado.**

- El degradado `rosa → violeta` es la firma. Nada más compite con él.
- Los colores semánticos (verde/ámbar/rojo) aparecen **sólo** cuando comunican un
  estado real: abierto, bajo stock, error. Nunca como decoración.
- WhatsApp tiene su verde propio porque es un canal externo reconocible; no se usa
  para nada más.
- Un solo radio por nivel y una sola escala tipográfica.

## Tokens (`src/styles/tokens.css`)

### Marca
| Token | Valor | Uso |
|---|---|---|
| `--rabbitty-pink` | `#E91E63` | acciones, texto de marca |
| `--rabbitty-pink-light` | `#FF4081` | extremo claro del degradado |
| `--rabbitty-pink-dark` | `#C2185B` | pressed / énfasis |
| `--accent-violet` | `#8B5CF6` | extremo violeta del degradado |
| `--brand-gradient` | `135deg #FF2E93 → #E91E63` | botones primarios, sello |
| `--brand-gradient-soft` | mismo degradado al 16 %/4 % | fondos de tarjeta destacada |

### Superficies
| Token | Uso |
|---|---|
| `--bg-primary` | fondo de pantalla |
| `--bg-subtle` | fondo de sección alterna |
| `--bg-elevated` | tarjeta |
| `--bg-pressed` | tarjeta presionada / hover |
| `--surface-1` / `--surface-2` | velos `rgba(255,255,255,.03/.06)` sobre tarjeta |
| `--border-subtle` / `--border-default` | separadores |

### Texto
`--text-primary` (blanco) · `--text-secondary` (AA) · `--text-muted` (tenue) ·
`--text-inverse`.

### Estado (nunca decorativo)
| Token | Uso |
|---|---|
| `--success` / `--success-soft` | abierto, pagado, stock sano |
| `--warning` / `--warning-soft` | bajo stock, por confirmar |
| `--error` / `--error-soft` | error, agotado |
| `--info` | informativo neutro |
| `--whatsapp` | sólo enlaces a WhatsApp |

### Forma
`--radius-sm 8` · `--radius-md 12` · `--radius-lg 16` · `--radius-xl 24` ·
`--radius-full`. Una tarjeta usa **un** radio; no se mezclan 14/16/20 en la misma
pantalla.

### Tipografía
`--text-display 40` · `--text-h1 24` · `--text-h2 20` · `--text-h3 18` ·
`--text-body 15` · `--text-caption 13` · `--text-small 12`. Se acabaron los
`text-[13.5px]`, `text-[11.5px]` sueltos: si hace falta un tamaño nuevo, es señal
de que falta jerarquía, no un token.

## Cómo se aplicó (fase 2.1)

Reemplazo mecánico en el perfil del negocio, hex → token, **sin cambiar
comportamiento**: el degradado del botón primario pasó a `var(--brand-gradient)`,
los verdes sueltos (`#34D399`, `#6EE7B7`, `#10B981`) a `--success`, los azules a
`--info`, el verde de WhatsApp a `--whatsapp`, y los cuatro negros distintos a
`--bg-primary` / `--bg-elevated` / `--bg-pressed`.

Verificación: `grep -c '#[0-9A-Fa-f]\{6\}'` sobre la página → **0**.

## Fase 2.2 — jerarquía (pendiente, es el siguiente paso)

El color ya está quieto; falta que la pantalla se lea de un vistazo. Cambios
concretos, por orden de impacto:

1. **Una acción primaria.** Hoy compiten el carrito flotante, "Pedir", el scanner
   y los CTA de recompensa. Queda **Pedir** (menú/tienda) como único botón sólido;
   el resto pasa a secundario (borde) o a un menú de acciones.
2. **Hero en tres datos.** Foto + nombre + estado (abierto/cerrado con
   `--success`/`--error`) + "devuelve X % en Bunz". Fuera los badges decorativos.
3. **Sacar del primer scroll**: "Planeo ir", Rabbitty Mood, happy hour, galería y
   el marketplace de membresías. Van a la pestaña **Info** o a una hoja "Más del
   lugar". El primer scroll queda: hero, acción, menú/tienda.
4. **Menos tarjetas apiladas.** Agrupar por tema (menú, tienda, info) con un título
   y aire, en vez de una tarjeta por dato con borde y sombra.
5. **Radios y tipografía**: aplicar la escala de arriba (una tarjeta = un radio).
6. **Cierre**: capturas antes/después y `npm run build` + revisión en iPhone real.

Criterio de aceptación: en la primera pantalla se entiende **qué es, si está
abierto, cuánto devuelve y cómo pedir**, sin competir con decoración; y no queda
ningún hex suelto ni más de dos acentos de color en pantalla.

## Reglas para no volver atrás

- Nada de `#hex` en `className` o `style` de pantallas: se usa un token.
- Un color semántico sólo aparece si comunica estado; si es para "que se vea
  bonito", no va.
- Si una pantalla necesita tres acentos, el problema es la jerarquía, no la paleta.
