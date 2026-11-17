# Respuesta al proveedor — no continuamos con la compra del I9

**Motivo:** verificado que no puede transaccionar en México (sin EMV L3 con un
adquirente local ni inyección de llaves).

---

## Versión para enviar (inglés)

```
Subject: RE: I9 — we have to pause the purchase, but thank you

Hi {nombre},

I want to be straight with you, because you were straight with us.

We checked the Mexican side and confirmed what you anticipated: the I9 carries
EMV L1 & L2 and PCI PTS 5.x SRED, but there is no acquirer in Mexico that has
taken this model through **EMV Level 3** or that will inject DUKPT keys for it.
Without that, the reader cannot authorize a single transaction here, no matter
how good the hardware is. So, unfortunately, we cannot continue with the
acquisition — not even the evaluation unit, because it would not de-risk anything
on our path.

This is not a reflection on the product or on your attention: your answers were
clear and honest, and that is exactly why we are not ordering something that
would sit in a drawer. I genuinely appreciate that — many suppliers would have
told us "yes, it works" and left us to find out later.

Two things before we close this thread:

1) If you have a different model that has already obtained **EMV Level 3 with an
   acquirer in Mexico or Latin America** (any country is useful as a reference),
   please send the datasheet and the acquirer name. We are actively building our
   payment experience and would be glad to evaluate it.
2) If in the future this model gets L3 certification with a Mexican acquirer and a
   key injection path, please keep us in mind — we would revisit it immediately,
   because the hardware format and price fit what we need.

Thank you for the time and for the honest technical answers.

Best regards,
Marco Del Toro
Founder, Rabbitty
rabbitty.me · hola@rabbitty.me
```

---

## Por qué este mensaje (y no un "no" seco)

| Frase | Para qué |
|---|---|
| “you were straight with us” | refuerza que valoramos la honestidad → mantiene la relación |
| “confirmed what you anticipated” | no lo hacemos quedar mal; reconoce que **ellos** avisaron |
| “not even the evaluation unit” | corta la tentación de vender la muestra |
| “would sit in a drawer” | explica el motivo real, sin tecnicismos |
| **punto 1** | abre la puerta a **otro modelo con L3 en LatAm** — puede que sí tengan |
| **punto 2** | deja la puerta abierta a futuro, sin compromiso |

---

## Qué esperar de su respuesta

| Si responden… | Qué significa |
|---|---|
| “We have model X with L3 in Brazil/Chile” | **vale la pena** pedir datasheet y verificar el adquirente |
| “We can do L3 for you” | pedir **nombre del adquirente y país**; sin eso, no es L3 |
| “No, we don't have” | cerramos el tema y seguimos con el cuestionario a adquirentes |
| Silencio | igual: la decisión ya está tomada |

**Regla para la próxima:** no se compra hardware antes de que un adquirente
confirme que **ese modelo** puede transaccionar. El hardware se elige por la
certificación, no al revés.

---

## Cierre del hilo (respuesta del proveedor)

> *"No tengo ningún modelo con L3 y referencia de adquirente en México/LatAm, así
> que no voy a enviar un datasheet que no pueda respaldar. Si tu PSP nombra la ruta
> de certificación que requiere, compártela y revisamos cuál de nuestros lectores
> encaja. Con L3 futuro no puedo prometer aviso proactivo, pero este hilo sirve para
> preguntar."*

**Lectura:** es la respuesta correcta de un proveedor serio (no vende humo). No hay
nada más que extraer hoy.

Su oferta —*"si tu PSP nombra la ruta de certificación, vemos qué lector encaja"*—
**sí es útil, pero después**: define el orden correcto.

```
1. Adquirente mexicano responde qué requiere y qué modelos ya certifica
2. Con ese pliego en mano, se le pide al fabricante el modelo que lo cumpla
3. Recién entonces se compra
```

**Estado:** hilo cerrado sin compra. El proveedor queda como contacto para cuando
exista pliego del adquirente.
