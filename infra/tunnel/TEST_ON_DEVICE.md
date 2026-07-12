# Testing en device externo

Guía paso a paso para probar la app en un celular físico (no emulador) usando Cloudflare Tunnel.

## Prerrequisitos

- Un Samsung S9 (o cualquier Android) con **Termux** instalado (la versión de F-Droid, no la de Play Store)
- API NestJS corriendo en el S9 (puerto 3000 por defecto)
- `cloudflared` instalado en Termux
- Una compu con Android Studio / SDK / `adb` para compilar e instalar el APK
- El celular externo en el que vas a probar (no tiene que estar en la misma red)

## Paso 1 — Levantar el tunnel en el S9

En Termux del S9:

```bash
pkg update -y && pkg install -y cloudflared
cd ~/servidorandroid/infra/tunnel
bash start.sh
```

Esperá a que imprima algo como:

```
[tunnel] ✓ URL activa: https://random-words-1234.trycloudflare.com
```

**Copiá esa URL** — la vas a pegar en la app y en la web. Anotalá o dejá Termux abierto.

## Paso 2 — Build del APK (en tu compu)

```bash
cd "/Users/dreamcode/Documents/SERVIDOR ANDROID/ServidorAndroid"
npx nx build edge --configuration=production
npx nx run edge:cap:sync
```

## Paso 3 — Generar APK debug

Opción A — Android Studio:
```bash
npx nx run edge:cap:open:android
# En Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
# Te genera: apps/edge/android/app/build/outputs/apk/debug/app-debug.apk
```

Opción B — línea de comandos:
```bash
cd apps/edge/android
./gradlew assembleDebug
# APK queda en: app/build/outputs/apk/debug/app-debug.apk
```

## Paso 4 — Instalar en el device externo

Conectá el device por USB, habilitá **Depuración USB** en Opciones de desarrollador, y:

```bash
adb devices                                          # confirma que aparece
adb install -r apps/edge/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.servidorandroid.edge/.MainActivity
```

Para ver logs en vivo:
```bash
adb logcat | grep -iE "chromium|console|boot"
```

## Paso 5 — Configurar la app en el device

1. Abrí la app (ícono **Edge Node**).
2. En el **primer arranque** vas a ver una pantalla de setup:
   > **edge-node · primer arranque**
   > pegá la URL pública del tunnel...
3. Pegá la URL que copiaste en el Paso 1, **agregale `/api` al final**, ej:
   ```
   https://random-words-1234.trycloudflare.com/api
   ```
4. Tocá **guardar y probar**.
5. Deberías ver: `ok · https://...trycloudflare.com/api/info · tunnel activo`

Si ves eso, todo está bien. Si dice `falló`, revisá:
- ¿La URL tiene `/api` al final?
- ¿El S9 sigue con Termux abierto y cloudflared corriendo?
- ¿El device externo tiene internet?

## Paso 6 — Configurar la web (en la misma compu)

```bash
cd "/Users/dreamcode/Documents/SERVIDOR ANDROID/ServidorAndroid"
npm run front   # http://localhost:4200
```

Andá a **Ajustes** (icono ⚙ en el header). En el panel **Servidor (tunnel)**:

1. Tocá **cambiar**
2. Pegá la **misma URL** del tunnel (con `/api` al final)
3. Tocá **guardar** → **redescubrir**
4. Debería decir: `tunnel activo · https://...`

## Paso 7 — Pairing

1. En el celular, en la app: tocá **conectar** → aparece un código de 6 dígitos
2. En la web, andá a **Vincular nodo** (ruta `/pair`): ingresá el mismo código
3. La app muestra **VINCULADO** y el botón **ir al dashboard**
4. La web empieza a mostrar las métricas del nodo

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `falló · .../info · sin respuesta` | Tunnel caído | Reiniciá `bash start.sh` en el S9 |
| `falló · 404` | URL sin `/api` al final | Re-pegá con `/api` |
| App se queda en splash | Error JS en boot | `adb logcat | grep -i chromium` |
| El device pide permiso de notificaciones | Foreground service | Aceptá — sino el OS mata la app |
| Cámara/mic no funcionan | Permisos no pedidos | El browser pide solo al primer uso; aceptá |

## Reset

Si querés volver al estado de "primer arranque":

```bash
adb shell pm clear com.servidorandroid.edge
```

O desde la app: **Ajustes del nodo** → panel **Servidor** → **borrar**.

## WiFi ad-hoc (sin tunnel)

Si querés probar sin levantar cloudflared (solo para debugging), estando en la misma red WiFi que el S9:

1. Averiguá la IP del S9: `ip a` en Termux → buscá `192.168.X.X` en `wlan0`
2. En la app, **cambiar** → pegá `http://192.168.X.X:3000/api`
3. La API tiene que estar escuchando en `0.0.0.0` (ya está por el `.env`)
4. El AndroidManifest del APK ya tiene `usesCleartextTraffic=true`, no hace falta más config

Esta forma es más rápida para iterar pero requiere estar en la misma red. Para uso real desde 4G/red externa, usar el tunnel.