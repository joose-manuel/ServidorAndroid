# Fix para DNS en Android Emulator (Pixel API 37.0)

## Problema
Cloudflared falla en el emulador Pixel API 37.0 con:
```
edge discovery: error looking up Cloudflare edge IPs: the DNS query failed
error="lookup _v2-origintunneld._tcp.argotunnel.com on [::1]:52: read udp: connection refused"
```

### Causa
1. El emulador no puede resolver DNS a través de SRV records
2. Los servidores DNS de Cloudflare no funcionan correctamente en emuladores
3. cloudflared intenta usar localhost IPv6 `[::1]:52` para DNS incluso cuando le pasamos `--dns-resolver-addrs`

## Solución Implementada

### 1. Detección Automática de Emulador ✅
Se agregó lógica para detectar si está ejecutando en un emulador analizando `Build.FINGERPRINT`, `Build.DEVICE`, etc.

### 2. DNS Adaptativo ✅
- **Emulador**: Usa **Google DNS (8.8.8.8 / 8.8.4.4)**
- **Dispositivos Reales**: Usa **Cloudflare DNS (1.1.1.1 / 1.1.1.1)**

### 3. Quick Tunnel Mode (Nueva Solución) ⭐
En lugar de usar credenciales que requieren SRV record lookups, ahora usa **Quick Tunnel mode**:

**Antes (fallaba):**
```bash
cloudflared tunnel run --cred-file tunnel-creds.json --url http://localhost:3000 <TUNNEL_ID>
```

**Ahora (funciona):**
```bash
cloudflared tunnel --protocol http1 --url http://localhost:3000
```

**Ventajas del Quick Tunnel:**
- ✅ No requiere credenciales
- ✅ No hace SRV record lookups
- ✅ Usa HTTP/1.1 protocol (más compatible con emulator)
- ✅ URL se extrae del stdout directamente
- ✅ Más simple y confiable

### 4. Cambios en `EdgeTunnelPlugin.java`

#### Método nuevo `runCloudflaredLoop(File binary, String serviceUrl)`
```java
// Quick Tunnel mode - no credentials needed
ProcessBuilder pb = new ProcessBuilder(
    binary.getAbsolutePath(),
    "tunnel",
    "--no-autoupdate",
    "--protocol", "http1",    // Force HTTP/1.1 for better emulator compatibility
    "--url", serviceUrl
);
```

#### Método actualizado `extractUrl(String line)`
```java
private String extractUrl(String line) {
    java.util.regex.Matcher m = java.util.regex.Pattern.compile(URL_RE).matcher(line);
    if (m.find()) {
        return m.group();
    }
    return null;
}
```

#### Método simplificado `tryRunWithCredentials()`
```java
// No se guardan credenciales, directamente inicia Quick Tunnel
running = true;
runCloudflaredLoop(binary, serviceUrl);
```

## Flujo de Ejecución

1. **App inicia** → Detecta emulador
2. **DNS configurado** → 8.8.8.8 para emulador
3. **API resuelto** → Obtiene URL inicial
4. **Quick Tunnel inicia** → cloudflared sin credenciales
5. **URL capturada** → Extrae desde stdout
6. **Túnel activo** → Disponible en navegador

## Cómo Probar

### 1. Compilar
```bash
cd apps/edge
./gradlew build
```

### 2. Instalar en emulador
```bash
adb install -r build/outputs/apk/debug/app-debug.apk
```

### 3. Abrir app y ver logs
```bash
adb logcat | grep -i "tunnel\|emulator\|quick"
```

**Expected output:**
```
Emulator detected, using Google DNS: 8.8.8.8
Device info: isEmulator=true, primaryDns=8.8.8.8
startProcess: resolving api.trycloudflare.com via physical network...
resolved api.trycloudflare.com via physical network: 104.16.230.132
tunnel URL: https://alberta-expanded-counting-baby.trycloudflare.com
starting Quick Tunnel (no credentials needed)
runCloudflaredLoop attempt 1
INF Starting tunnel
INF Initial protocol http2  (or http1)
tunnel URL extracted: https://alberta-expanded-counting-baby.trycloudflare.com
```

### 4. Acceder en navegador
```
https://alberta-expanded-counting-baby.trycloudflare.com/api/info
```

Debería devolver:
```json
{
  "tunnelUrl": "https://alberta-expanded-counting-baby.trycloudflare.com/api",
  "tunnelActive": true,
  "apiPort": 3000
}
```

## Compatibilidad

### ✅ Emuladores Testeados
- Pixel API 37 (Android 17)
- Pixel 6 Pro API 35
- Pixel 5 API 30+

### ✅ Dispositivos Reales
- Samsung S9+
- Otros Android 9+

## Troubleshooting

### Error: "connection refused" en localhost
```bash
# Verifica que el API server en localhost:3000 está corriendo
adb shell netstat -an | grep 3000
```

### Error: "DNS query failed"
```bash
# Verifica DNS en emulador
adb shell ping 8.8.8.8
adb shell nslookup google.com 8.8.8.8
```

### Error: HTTP 530 en tunnel URL
- El tunnel URL se creó pero no conecta
- Solución: Reinicia la app y emulador

## Próximos Pasos (Opcional)

- [ ] Agregar configuración manual de DNS en UI
- [ ] Soportar credenciales para tunnels persistentes (dispositivos reales)
- [ ] Agregar fallback a HTTP/2 si HTTP/1.1 falla
- [ ] Monitoring de estado del tunnel

## Cambios de Código Resumen

| Cambio | Líneas | Impacto |
|--------|--------|--------|
| Detección emulador | ~60-90 | ⭐⭐ Crítico |
| DNS adaptativo | ~287-320 | ⭐⭐ Crítico |
| Quick Tunnel mode | ~334-390 | ⭐⭐⭐ Solución Principal |
| Extract URL del stdout | ~372-388 | ⭐ Necesario |
| Simplificar credenciales | ~437-446 | ⭐ Optimización |

## Referencia

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-applications/install-and-setup/tunnel-guide/)
- [Android Build Properties](https://developer.android.com/reference/android/os/Build)
- [HTTP/1.1 vs HTTP/2 in Go](https://golang.org/pkg/net/http/)

