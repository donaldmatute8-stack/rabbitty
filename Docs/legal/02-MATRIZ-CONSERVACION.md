# Matriz de conservación de datos

> **Borrador de trabajo.** Los plazos fiscales y contables deben validarse con el
> contador. No constituye opinión legal.

**Criterio:** conservar solo lo necesario para cada finalidad y para cumplir
obligaciones. Al vencer el plazo, bloquear o suprimir; si hay obligación legal o
disputa, conservar restringido.

---

## 1. Matriz por categoría

| Categoría | Ejemplos / tablas | Plazo propuesto | Base | Al vencer | Notas |
|---|---|---|---|---|---|
| Cuenta de usuario | `users`, `passkeys`, `pushDevices` | Cuenta activa + 5 años de evidencia | CT/LEG | Suprimir o anonimizar | Passkey y tokens se eliminan al borrar cuenta |
| Autenticación y sesiones | `verificationTokens`, `trustedSessions`, `webSessions` | 30 días (tokens), 12 meses (sesiones) | IL | Suprimir | Tokens expiran por diseño |
| Operaciones y pedidos | `orders`, `orderItems`, `payments` | 5 años | LEG (fiscal/contable) | Conservar restringido | Validar CFF art. 30 |
| Bunz y ledger | `transactions`, `bunz_ledger_entries`, `bunz_obligations` | 5 años | LEG/CT | Conservar restringido | No borrar asientos |
| Capacidad y recuperación | `merchantCapacityAccounts`, `merchantRecoveryTerms`, `merchantRecoveryProposals` | Vigencia + 5 años | CT/LEG | Conservar restringido | Evidencia de aceptación |
| Facturación | `invoices`, `billingProfiles` | 5 años | LEG | Conservar restringido | CFDI y acuses |
| Clientes del afiliado | `customers` | 24 meses desde última visita | CT/IL | Suprimir o anonimizar | Marketing requiere opt-in |
| Reservaciones / waitlist | `reservations`, `waitlistEntries` | 12 meses | CT | Suprimir | No usar para marketing |
| Chat | `messages`, `conversations` | Hasta borrado + 30 días | CT/IL | Suprimir | E2E: contenido cifrado |
| Adjuntos | `AWS S3` | Igual que el mensaje | CT | Suprimir | Versionado y borrado seguro |
| Notificaciones | `notifications`, `bunzyDeliveries` | 24 meses | CT/IL | Suprimir | Métricas agregadas pueden sobrevivir |
| Marketing | `campaigns`, `affiliateCampaigns`, preferencias | Hasta oposición | CON/IL | Suprimir | Respetar opt-out por categoría |
| Preferencias / memoria IA | `userMemories`, `memoryCandidates` | 24 meses o hasta supresión | CON/IL | Suprimir | Revisar expiración por registro |
| Embeddings | `knowledgeChunks` | Mientras exista la fuente | CT | Reindexar/suprimir | No embeddings de datos borrados |
| Mood / atmósfera | `moodEvents`, `vibePassportStamps` | 24 meses | CON/IL | Agregar o suprimir | Evitar reidentificación |
| Reputación / moderación | `orderRatings`, `moderationLog` | 24 meses; 5 años si disputa | CT/IL | Conservar restringido | |
| Seguridad / auditoría | `auditEntries`, `bunzAbuseSignals`, `pinAttempts` | 12 meses logs; 5 años incidentes | IL/LEG | Conservar restringido | Cadena de evidencia |
| Evidencia contractual | `auditEntries`, `verificationData`, `affiliate_reonboarding_tokens` | Vigencia + 5 años | CT/LEG | Conservar restringido | Hash, copia, IP/UA |
| Personal del afiliado | `staff`, `staffShifts`, `posOperatorSessions` | Relación + 5 años | CT/LEG | Conservar restringido | Instrucción del afiliado |
| Sandbox | usuarios/negocios marcados `sandbox` | Hasta depuración | — | Suprimir | No mezclar con métricas reales |

---

## 2. Reglas transversales

1. **Bloqueo antes de supresión:** si hay obligación legal o disputa, se conserva
   con acceso restringido y se documenta el motivo.
2. **Borrado en cascada:** al eliminar una cuenta, se eliminan passkeys, tokens,
   dispositivos push, memorias y preferencias; los asientos contables se conservan
   disociados cuando la ley lo permita.
3. **Respaldos:** la supresión debe propagarse a respaldos en el siguiente ciclo
   definido (máximo 90 días), salvo obligación de conservar.
4. **Datos agregados:** las métricas agregadas o anonimizadas pueden conservarse
   si no permiten reidentificación.
5. **Sandbox:** nunca se factura ni genera obligaciones; se marca y se excluye de
   métricas y reportes reales.
6. **Evidencia:** cada supresión o bloqueo debe dejar registro en `auditEntries`
   con fecha, motivo, actor y alcance.

---

## 3. Preguntas para el contador

- ¿El plazo de 5 años aplica a todos los flujos o cambia por tipo de documento?
- ¿Qué asientos deben conservarse íntegros y cuáles pueden disociarse?
- ¿Cómo se trata la capacidad adelantada y su recuperación en la contabilidad?
- ¿Qué comprobantes y CFDIs deben conservarse y por cuánto tiempo?
- ¿Qué tratamiento aplica a devoluciones, incobrables y sandbox?

---

## 4. Preguntas para privacidad

- ¿Los plazos de marketing y memoria IA son proporcionales?
- ¿Cómo se documenta la revisión humana de decisiones automatizadas?
- ¿Qué pasa con los datos de un Rabbitter que pide cancelación pero tiene
  operaciones pendientes de aclaración?
- ¿Cómo se informa la conservación por obligación legal en la respuesta ARCO?
