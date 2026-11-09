# Paquete legal y de privacidad · Índice y estado

> **Borrador de trabajo.** No constituye opinión legal ni fiscal. Cada documento
> indica qué falta validar y con quién. Generado el **8 de noviembre de 2026** a
> partir del código, el esquema de base de datos y los documentos del repositorio.

---

## 1. Para qué sirve este paquete

Reunir en un solo lugar los documentos que **sí se pueden preparar internamente**
para que un abogado, contador o responsable de privacidad los audite sin tener
que reconstruir la operación. No sustituye dictámenes ni firma de contratos con
proveedores.

**Decisión del fundador (7-nov-2026):** el expediente corporativo (acta, poder,
CSF) es interno y **no se incluye** en el bundle de auditoría. Se conserva en el
expediente privado de la empresa.

---

## 2. Estado por documento

| # | Documento | Estado | Quién valida | Qué falta |
|---|---|---|---|---|
| 00 | Este índice | Listo | — | — |
| 01 | Registro de Actividades de Tratamiento (RAT) | Borrador | Privacidad | Confirmar finalidades y bases legales |
| 02 | Matriz de conservación | Borrador | Privacidad + contador | Validar plazos fiscales |
| 03 | Procedimiento ARCO | Borrador operativo | Privacidad | Probar con un caso real |
| 04 | Matriz de proveedores y DPA | Borrador | Privacidad + legal | Firmar DPA y confirmar regiones |
| 05 | Cláusulas DPA y solicitud a proveedores | Listo para enviar | Legal | Enviar y archivar respuestas |
| 06 | Auditoría técnica de passkeys | Borrador | Seguridad | Ejecutar pruebas y corregir hallazgos |
| 07 | Evidencia de aceptación E2E | Borrador + hallazgos | Legal + técnico | Corregir hash/copia y probar |
| 08 | Anexo B · Condiciones operativas y de redención | Plantilla | Legal + operaciones | Llenar por afiliado |
| 09 | Memorándum fiscal (borrador por flujo) | Borrador | Contador | Emitir dictamen |
| 10 | Brief Fintech art. 22–24 | Borrador | Abogado regulatorio | Emitir opinión |
| 11 | Plan de depuración sandbox (Ka13 / Bull Box) | Listo para ejecutar | Operaciones | Autorizar y ejecutar |
| 12 | Anexo A · Plantilla 626 post-reset | Plantilla | Legal + económico | Llenar tras re-onboarding |
| 13 | Checklist corporativo interno | Interno | Fundador | Anexar documentos en privado |

---

## 3. Hallazgos de código detectados al preparar el paquete

Estos no son opiniones legales: son hechos verificables en el repositorio y
afectan la evidencia que se puede exhibir.

> **Actualización 8-nov-2026:** G1–G5 quedaron corregidos en código. El detalle
de la corrección está en los documentos 06 y 07.

| # | Hallazgo | Archivo | Impacto | Recomendación |
|---|---|---|---|---|
| G1 | El hash del contrato se calcula sobre un JSON de datos, **no sobre el texto íntegro** del contrato aceptado. | `landing-page/src/app/api/re-onboarding/apply/route.ts` | No prueba que el afiliado aceptó exactamente el texto vigente. | Hashear el texto renderizado + versión + anexo. |
| G2 | `copyDelivered: true` está escrito fijo, sin envío real ni acuse. | mismo archivo | La evidencia afirma algo que no se verifica. | Enviar copia por correo y guardar `messageId`/acuse. |
| G3 | El reto de passkeys de registro/autenticación autenticada vive en memoria (`Map`). | `packages/api/src/routers/passkeys.ts` | Se pierde al reiniciar o al balancear instancias. | Persistir reto con expiración (como ya se hace en login). |
| G4 | El registro de passkeys no fija `userVerification` explícito. | mismo archivo | Política dependiente del default de la librería. | Fijar `userVerification: "preferred"` o `"required"` documentado. |
| G5 | No se registra un evento de auditoría al crear/borrar passkey. | mismo archivo | Difícil reconstruir alta/baja de credenciales. | Insertar en `auditEntries`. |
| G6 | El aviso de privacidad v1.0 sigue marcado como “borrador para publicación”. | `DOCS/AVISO-DE-PRIVACIDAD-RABBITTY.md` | No hay versión publicada y fechada en URL estable. | Publicar y conservar la versión anterior. |
| G7 | El contrato `MCCE_CONTRACT_STATUS` sigue en `draft`. | `telegram-miniapp/src/lib/mcceContract.ts` | La aceptación se guarda como borrador. | **Corregido:** aprobado operativamente como `2026.11-v1.2`; texto unificado en `@rabbitty/legal`. Revisión legal externa pendiente. |
| G8 | Los Rabbitters no aceptaban Términos/Privacidad. | Onboarding y app | No había evidencia de consentimiento. | **Corregido:** checkbox en onboarding + gate para existentes + columnas en `users` (migración 0053). |

---

## 4. Orden sugerido de cierre

1. Publicar el aviso de privacidad v1.0 en URL estable (G6).
2. Ejecutar el procedimiento ARCO con un caso controlado.
3. Enviar solicitudes DPA (documento 05) y archivar respuestas.
4. Corregir G1, G2 y G3–G5.
5. Correr la prueba E2E de evidencia (documento 07).
6. Entregar al contador el documento 09 con los cortes de ledger.
7. Entregar al abogado regulatorio el documento 10.

---

## 5. Cómo auditar

- En el bundle: `Docs/legal/` contiene este paquete completo.
- Los documentos legales previos siguen en `DOCS/` (`MCCE-*`, `AVISO-*`).
- El código citado está en el mismo bundle cuando el generador lo incluye; si no,
  la ruta exacta permite localizarlo en el repositorio.
