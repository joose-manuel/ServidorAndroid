# Edge Node — Tunnel público

Cloudflare Quick Tunnel que expone el API NestJS (corriendo en el S9) en una URL pública HTTPS. La app móvil y la web se conectan a esa URL — no hace falta tocar IPs ni firewalls.

## Setup en el S9 (una sola vez)

```bash
# 1. Instalá Termux desde F-Droid (NO la versión de Play Store, está descontinuada)
# 2. Dentro de Termux:
pkg update -y
pkg install -y cloudflared

# 3. Cloná este repo en el S9 (o copiá la carpeta infra/tunnel/)
git clone <repo-url> ~/servidorandroid
cd ~/servidorandroid/infra/tunnel

# 4. Probá que anda (Ctrl+C para cortar)
bash start.sh

# 5. Cuando veas algo como:
#    [tunnel] ✓ URL activa: https://xxx-xxx.trycloudflare.com
#    copiala — esa es la URL que la app va a usar.

# 6. Para que arranque solo al prender el teléfono:
bash start.sh --install
#    (instalá Termux:Boot desde F-Droid y abrilo una vez para activar)
```

## Cómo lo descubren la app y la web

El endpoint `GET /api/info` de la API devuelve la URL actual del tunnel. La app y la web lo consultan al arrancar y la usan automáticamente.

```bash
# Probalo vos mismo desde el navegador del celu o de la compu:
curl https://xxx-xxx.trycloudflare.com/api/info
# → { "tunnelUrl": "https://xxx-xxx.trycloudflare.com/api", "apiPort": 3000 }
```

## Si el tunnel se cae / reinicia

Los **quick tunnels** de Cloudflare rotan la URL cada vez que el proceso `cloudflared` arranca de cero. El script `start.sh` los reintenta automáticamente y actualiza el archivo `.tunnel-url`. La próxima vez que la app o la web consulten `/api/info`, obtendrán la nueva URL.

## Notas

- **Limitación**: la URL del quick tunnel cambia en cada reinicio. Si querés una URL estable, configurá un tunnel con cuenta de Cloudflare + dominio propio (ver [docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)).
- **Seguridad**: la API sigue corriendo en la LAN, solo el tunnel la expone. La auth de Supabase + JWT se mantiene.
- **Logs**: `tail -f infra/tunnel/.tunnel.log`
- **URL actual**: `cat infra/tunnel/.tunnel-url`