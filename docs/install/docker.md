# Install via Docker (any platform)

If you already run a Docker host (Synology, QNAP, Unraid, TrueNAS Scale, generic Linux), this is the most portable path. Total setup: ~5 min.

## Requirements

- Docker Engine + Docker Compose (or Portainer / equivalent)
- The host machine is on the same LAN as your iPhone
- **Host networking mode support** — required for HomeKit pairing because HAP needs to multicast mDNS on the LAN interface

> If your environment can't use `network_mode: host` (e.g. Docker Desktop on macOS or Windows handles host networking weirdly), see the platform-specific guides for [macOS](./macos.md) or [Windows](./windows.md) instead.

## docker-compose.yml

```yaml
services:
  homebridge:
    image: homebridge/homebridge:latest
    container_name: homebridge
    restart: always
    network_mode: host
    environment:
      - TZ=America/Los_Angeles   # set to your timezone
      # Optional: run as a specific UID/GID on the host
      - PUID=1000
      - PGID=1000
    volumes:
      - ./homebridge:/homebridge   # adjust to a real path on your host
```

## Bring it up

```sh
docker compose up -d
docker compose logs -f homebridge
```

Wait for `Homebridge v2.x.x ... is running on port 51826`.

## Open the UI

`http://<host-ip>:8581` — create your admin user.

## Install the Tethral plugin

1. **Plugins** tab → search `@tethralinc/homebridge-tethral` → **Install**.
2. Configure with your `tth_...` API token.
3. **Save** → **Restart Homebridge** (the container itself doesn't need to restart; the inner HB process restarts via the UI button).

## Pair to HomeKit

iPhone **Home** app → **+** → **Add or Scan Accessory** → **More options...** → pick the bridge → enter PIN from the Status page.

## Updating

When a new Homebridge image is published:

```sh
docker compose pull
docker compose up -d
```

Your config + cached accessories persist via the volume mount.

## Docker-specific notes

- **`network_mode: host` is required.** Don't try to publish ports individually (`-p 51826:51826`) — that breaks mDNS because the container doesn't actually see the host's interfaces. HomeKit pairing will fail with "operation timed out".
- **Persistent volume.** Always mount `/homebridge` to a host path. Without it, you lose your config and have to re-pair every time the container is recreated.
- **Permissions.** The `PUID`/`PGID` env vars make HB run as a specific host user. Useful if you want to read/edit `config.json` from outside the container.
- **Logs:** `docker compose logs -f homebridge` shows live HB output. Or use the UI's **Logs** tab.

## Troubleshooting

- **Container starts but iPhone can't discover the bridge.** Verify `network_mode: host` is in your compose file. Without it: pairing physically can't work.
- **Permission denied writing to `/homebridge`.** Set `PUID`/`PGID` to match the owner of the host directory: `chown -R 1000:1000 ./homebridge` then redeploy.
- **Plugin install fails with `npm ERR! ENOTEMPTY`.** Stale cache in the volume. Stop the container, `rm -rf homebridge/node_modules`, restart.

## Child bridge (recommended)

HB UI → **Plugins** → Tethral → **Bridge** → enable **Child Bridge** → Restart Homebridge.
