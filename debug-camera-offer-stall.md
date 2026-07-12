# Debug Session: camera-offer-stall [OPEN]

## Síntoma
- La web crea la sesión de cámara y queda en `waiting-offer`.
- El Android navega a `camera-streamer`, pero no activa la cámara y termina en `estado error`.
- El usuario indica que tampoco aparece el permiso de cámara del sistema.

## Hipótesis
1. La solicitud `session-requested` llega pero se pierde antes de activar `camera-streamer`.
2. `getUserMedia()` falla en el runtime actual del Android y no se genera el `offer`.
3. Faltan permisos declarados/sincronizados en Android y por eso no hay prompt del sistema.
4. El socket del Android no se conecta o no recibe eventos del namespace `/webrtc`.
5. Existe una carrera entre navegación, montaje de la vista y consumo de la solicitud pendiente.

## Plan de evidencia
- Instrumentar signaling del Android.
- Instrumentar `camera-streamer` antes y después de pedir medios.
- Revisar permisos Android/Capacitor declarados en el proyecto.
- Reproducir y comparar logs.

## Evidencia recogida

- `D` descartada: el socket sí conecta y registra el nodo.
- `A` descartada: `session-requested` sí llega al Android.
- `E` descartada: `camera-streamer` sí monta la vista y ve la solicitud pendiente.
- Revisión nativa: `AndroidManifest.xml` no declaraba `android.permission.CAMERA` ni `android.permission.RECORD_AUDIO`.
- Síntoma del usuario consistente: nunca aparece el prompt del sistema para cámara.

## Fix aplicado

- Se agregaron permisos `CAMERA` y `RECORD_AUDIO` en `AndroidManifest.xml`.
- Se añadieron métodos nativos en `DeviceRuntimePlugin` para solicitar permiso de cámara/micrófono.
- `camera-streamer` ahora pide permiso de cámara explícitamente antes de llamar `getUserMedia()`.
- Se ejecutó `npm run cap:sync` para propagar cambios nativos al proyecto Android.
