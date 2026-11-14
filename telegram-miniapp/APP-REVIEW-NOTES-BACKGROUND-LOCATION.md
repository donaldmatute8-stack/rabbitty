# App Review · Ubicación en segundo plano (Guideline 2.5.4)

**App:** Rabbitty (miniapp, `com.rabbitty.app`)
**Motivo del rechazo:** el binario declara `UIBackgroundModes = location` y el revisor no encontró la función que lo requiere.
**Estado:** la función **existe y se usa**; el problema es que no era evidente para el revisor.

---

## 1. Qué hace la función (en una frase)

Rabbitty avisa al usuario cuando pasa cerca de un negocio afiliado para que haga
check-in y gane Bunz **sin abrir la app**.

- Plugin nativo: `@capacitor-community/background-geolocation` (`addWatcher`
  con `background: true`, `distanceFilter: 50 m`).
- Código: `telegram-miniapp/src/components/ProximityEngine.tsx`.
- El watcher manda `POST /api/location/ping` con `source: "background"`.
- Sin `UIBackgroundModes = location` iOS suspende el watcher al cerrar la app y
  el aviso nunca llega.

---

## 2. Cómo lo encuentra el revisor (pasos exactos)

1. Instalar la app en un iPhone físico.
2. Iniciar sesión.
3. Ir a **Configuración** → tarjeta **“Alertas de proximidad”**.
4. Tocar **“Revisar permiso”** → Ajustes de iOS → Ubicación →
   **Siempre** + **Ubicación precisa**.
5. Volver a la app y **cerrarla por completo** (deslizar hacia arriba).
6. Acercarse a un negocio afiliado (o simular recorrido con Xcode:
   *Debug → Simulate Location* → GPX con dos puntos separados >50 m).
7. Llega una notificación push de proximidad (“Estás cerca de …”).

> La tarjeta de Configuración es nueva justo por este rechazo: antes la función
> existía pero no había ninguna pantalla que la explicara, así que el revisor no
> tenía cómo encontrarla.

---

## 3. Guion del video para App Review Information

Duración objetivo: 40–60 s, un solo plano continuo.

1. Abrir **Configuración** y mostrar la tarjeta “Alertas de proximidad”.
2. Tocar **“Revisar permiso”** → mostrar la pantalla de iOS con **Siempre**
   seleccionado (y “Ubicación precisa”).
3. Volver a la app y mostrar el estado **“Permiso concedido”**.
4. **Cerrar la app** (gesto de multitarea) y mostrar la pantalla de inicio.
5. Moverse / simular ubicación cerca de un negocio.
6. Mostrar la **notificación** llegando con la app cerrada.
7. Abrir la notificación → pantalla de check-in del negocio.

Notas a pegar junto al video:

> Background location is used for partner-business proximity alerts: when the
> user is within the configured radius of an affiliated business, the app
> notifies them to check in and earn rewards, even with the app closed. The
> feature is visible in Settings → “Alertas de proximidad”. The watcher is
> registered only after the user grants “Always” and can be disabled at any time
> in iOS Settings.

---

## 4. Texto de respuesta en App Store Connect

> Hello, thank you for the review. We want to clarify that background location
> **is** used by a user-facing feature, and we have made it discoverable in this
> build.
>
> Feature: **proximity alerts**. When the user is near an affiliated business,
> Rabbitty notifies them so they can check in and earn Bunz — including when the
> app is closed. It is implemented with the native background geolocation
> watcher (`distanceFilter` 50 m) and it only runs after the user grants
> “Always” location permission.
>
> Where to find it: **Settings → “Alertas de proximidad” → “Revisar permiso”**.
> The card explains why the permission is needed and links to iOS Settings. The
> user can revoke it at any time.
>
> A screen recording showing the flow with the app closed is included in the
> App Review Information notes. Purpose strings were rewritten to describe the
> background use explicitly.
>
> Please let us know if you need anything else.

---

## 5. Checklist antes de subir

- [ ] `UIBackgroundModes` incluye `location` y `remote-notification`.
- [ ] `NSLocationAlwaysAndWhenInUseUsageDescription` describe el uso en segundo plano.
- [ ] `NSLocationWhenInUseUsageDescription` describe el uso en primer plano.
- [ ] La tarjeta de Configuración se ve en un dispositivo nativo (no en web).
- [ ] `cap sync ios` + rebuild en Xcode (el cambio de Info.plist requiere binario nuevo).
- [ ] Video grabado en dispositivo físico (no simulador).
- [ ] Notas y video cargados en *App Review Information*.
- [ ] Build nuevo (no reutilizar el 17).

---

## 6. Si Apple vuelve a rechazar

La alternativa aceptada por Apple es **significant-change location** o
**region monitoring** en vez de ubicación continua. Eso cambiaría la
implementación (el plugin comunitario no expone geofencing), pero el caso de uso
sería el mismo y la declaración seguiría siendo válida.
