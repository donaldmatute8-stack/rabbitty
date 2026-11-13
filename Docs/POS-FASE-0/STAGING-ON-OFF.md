# Staging: encender solo para probar

**Estado:** vigente
**Fecha:** 11 de noviembre de 2026
**Motivo:** el cupo de Neon se mide en horas de compute. Un staging encendido 24/7
consume igual que producción y duplica el gasto.

---

## 1. Regla

> **Staging está APAGADO por defecto.** Se enciende para una ventana de prueba y se
> vuelve a apagar al terminar.

Un servicio encendido consulta la base cada pocos segundos (KDS 10 s, POS 5–15 s),
y eso impide que Neon suspenda el compute a los 5 minutos.

---

## 2. Encender (ventana de prueba)

```bash
# Solo los servicios que se van a probar
railway redeploy -e staging -s rabbitty-admin
railway redeploy -e staging -s rabbitty-kds
```

Si `redeploy` no encuentra deployment (porque se eliminó), se despliega desde la
rama conectada del servicio (Settings → Source) o con `railway up` desde la app.

**Duración objetivo:** 15–30 minutos. Con checklist cerrada antes de encender.

---

## 3. Apagar

```bash
railway down -e staging -s rabbitty-admin
railway down -e staging -s rabbitty-kds
railway down -e staging -s rabbitty-bot
railway down -e staging -s rabbitty-landing
```

Neon suspende el compute ~5 minutos después de la última consulta.

---

## 4. Qué se prueba SIN encender nada

Esto cubre la mayor parte del plan y **no** gasta compute de Railway:

| Prueba | Cómo | Necesita Railway |
|---|---|---|
| Migraciones | `psql "$STAGING_URL" -f migracion.sql` | No |
| Concurrencia de órdenes | script con drizzle contra el branch | No |
| Helper y bitácora | script / vitest | No |
| Contratos tRPC | vitest contra la base de staging | No |
| Flujo completo con UI | app local (`pnpm dev`) + base de staging | No |
| Dos terminales reales, iPad, impresión | POS desplegado en staging | **Sí** |

**Conclusión:** el 80 % del plan se prueba sin encender staging.

---

## 5. Checklist antes de encender

- [ ] La rama a probar está pusheada.
- [ ] La migración necesaria ya está aplicada en el branch de Neon.
- [ ] Sé qué voy a probar y cuál es el resultado esperado.
- [ ] Tengo el comando de apagado a mano.
- [ ] Nadie más está usando staging.

---

## 6. Checklist antes de apagar

- [ ] Pruebas registradas (resultado, evidencia).
- [ ] Sin procesos a medias.
- [ ] Datos de prueba identificados (para limpiar o ignorar).
- [ ] Deployments eliminados en los 4 servicios.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Olvidar apagar staging | Revisar deployments al cerrar la sesión; Neon avisa al acercarse al límite |
| Probar contra producción | Verificar antes: el host debe contener `ancient-meadow` |
| Branch de Neon acumulando datos | Los datos son desechables; se puede recrear el branch |

---

## 8. Verificación de que staging NO apunta a producción

```bash
railway variables -s rabbitty-admin -e staging --json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['CORE_DATABASE_URL'].split('@')[1].split('/')[0])"
```

Debe imprimir un host con **`ancient-meadow`**. Si dice `delicate-violet`, es producción: detente.


---

## 9. Por qué staging se desplegaba solo (resuelto 11-nov-2026)

Los servicios del ambiente `staging` estaban conectados a **`main`**, igual que
producción. Por eso **cada push a `main` redesplegaba staging** y volvía a consumir
compute de Neon.

> En Railway actual no existe un interruptor "auto deploy" por servicio:
> lo que decide es **la rama de origen** del servicio.

### Solución aplicada

1. Se creó la rama **`staging`** (desde `main`).
2. Los 4 servicios del ambiente `staging` se reconectaron a esa rama:

```bash
railway service source connect --repo <owner>/<repo> --branch staging \
  --service rabbitty-admin --environment staging
```

Verificación (`--json`): `branch = staging` en `rabbitty-admin`, `rabbitty-kds`,
`rabbitty-bot` y `rabbitty-landing`. **Producción sigue en `main`.**

### Cómo se usa ahora

| Quiero… | Acción |
|---|---|
| Cambiar producción | push a `main` (despliega prod, **no** staging) |
| Actualizar staging | `git push origin main:staging` |
| Apagar staging | `railway down -y -e staging -s <servicio>` |

### Aviso

`railway service source connect` **dispara un deploy** al reconectar. Si se usa solo
para consultar la rama, preferir la UI: **Service → Settings → Source → Branch**.

---

## 9. Lecciones de las ventanas de noviembre (actualizado 13-nov-2026)

### `railway down` necesita `-y`

```bash
railway down -s rabbitty-admin -e staging -y
```

Sin `-y` falla con *"Failed to prompt for confirm"* en entornos no interactivos.

### Borrar una variable NO reinicia el contenedor

Al quitar `STRIPE_SECRET_KEY` de staging (H-1) el proceso siguió con la llave en
memoria hasta el siguiente despliegue. **Después de tocar variables hay que
desplegar de nuevo**, no basta con el cambio:

```bash
railway up -d -s rabbitty-admin -e staging
```

Y si la variable es `NEXT_PUBLIC_*` (se inyecta en build), el redespliegue es
obligatorio: un reinicio no basta.

### Staging ya no se despliega solo

El push a la rama `staging` no dispara deploys. El camino es:

```bash
railway up -d -s rabbitty-admin -e staging    # sube el árbol local
```

`railway redeploy` solo reutiliza la imagen anterior: **no** recoge cambios de
código ni variables inlineadas.

### staging no tiene llaves de Stripe (a propósito)

H-1 eliminó `STRIPE_SECRET_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Las
tarjetas no se pueden cobrar ahí y `payments.getPublishableKey` responde
`{ ready: false, mode: "disabled" }`. Para probar tarjeta hay que cargar llaves
`sk_test_`/`pk_test_` (ver `PLAN-PRUEBAS-COBRO.md`, H-1).

### El KDS está apagado y desconectado de Git

Sin cocina activa no se usa. Su servicio no está enlazado al repo, así que un
push a `main` **no** lo revive. Para volver a encenderlo:

```bash
railway service source connect --repo donaldmatute8-stack/rabbitty --branch main --service rabbitty-kds
railway up -d -s rabbitty-kds -e production
```

### Al cerrar

```bash
railway down -s rabbitty-admin -e staging -y
railway deployment list -s rabbitty-admin -e staging   # debe decir REMOVED
```
