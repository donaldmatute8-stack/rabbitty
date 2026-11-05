# Update Log — contenido local

Las novedades se escriben aquí en markdown y se inyectan a la base con
`scripts/update-log.mjs`. La URL pública es **estable por `slug`**: corregir el
texto no rompe un enlace ya enviado por broadcast.

## Formato del archivo

```markdown
---
title: Escáner QR más rápido y confiable
version: 1.5.0
date: 2026-11-06
category: IMPROVEMENT
tags: [app, escáner, qr]
summary: El escáner ahora sigue el código, tiene linterna, zoom y foto.
---

## Qué cambió

- El recuadro **sigue al QR** mientras te mueves.
- Linterna, zoom 1x/2x/3x y foto de galería.
- Si el código no es de Rabbitty, el escáner sigue abierto.

## Por qué importa

Menos intentos fallidos en caja y en la calle.
```

Frontmatter soportado: `title` (obligatorio), `version`, `date`, `category`
(`PRODUCT` · `IMPROVEMENT` · `FIX` · `SECURITY`), `tags`, `summary`, `slug`,
`coverUrl`. El cuerpo acepta títulos, listas, citas, `**negritas**`, `código` y
`[enlaces](https://…)`.

## Publicar

```bash
# una novedad (queda publicada y visible en /updates)
BUNZY_CONNECT_SECRET=... node scripts/update-log.mjs --prod --file ./updates/1.5.0.md

# como borrador (no aparece en /updates)
BUNZY_CONNECT_SECRET=... node scripts/update-log.mjs --prod --draft --file ./updates/1.5.0.md
```

Salida:

```
✓ PUBLISHED · 1-5-0-escaner-qr-mas-rapido-y-confiable
  https://app.rabbitty.me/updates/1-5-0-escaner-qr-mas-rapido-y-confiable

  Para el broadcast (CTA):
    --cta-label "Ver la novedad" --cta-url "https://app.rabbitty.me/updates/…"
```

## Enlazarlo en un comunicado

**Desde el panel:** God → Bunzy Connect → “Novedad del Update Log”. Al elegirla
se rellenan el CTA y el enlace automáticamente.

**Desde el CLI:**

```bash
BUNZY_CONNECT_SECRET=... node scripts/bunzy-connect.mjs --prod \
  --category PRODUCT --business <id> \
  --cta-label "Ver la novedad" \
  --cta-url "https://app.rabbitty.me/updates/<slug>" \
  --file ./tmp/update.json --publish
```

Si usas `scripts/bunzy-release.mjs`, primero inyecta la novedad con
`update-log.mjs` y pasa la URL resultante como CTA.
