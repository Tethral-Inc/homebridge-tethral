# Install on QNAP NAS

QNAP doesn't have an official Homebridge package, so the canonical path is Container Station running the official `homebridge/homebridge` Docker image. Total setup: ~15 min.

## Requirements

- QNAP NAS with Container Station installed (free from App Center)
- Admin access to QTS / QuTS hero
- NAS and your iPhone on the same subnet

## Step 1 — Install Container Station

If you don't have it yet: **App Center** → search **Container Station** → Install.

## Step 2 — Create a Docker network in bridge mode... actually use host mode

HomeKit requires the Homebridge container to share the host's network namespace (so it can multicast mDNS on the LAN). If you put HB behind Docker's NAT, iPhone discovery breaks.

In Container Station:

1. Click **Applications** → **Create** → **Create Application** (gives you a docker-compose-style YAML editor).
2. Paste the YAML below, edit the `volumes` path to where you want HB's persistent data, and click **Create**.

```yaml
services:
  homebridge:
    image: homebridge/homebridge:latest
    container_name: homebridge
    restart: always
    network_mode: host
    environment:
      - TZ=America/Los_Angeles   # set to your timezone
      - PGID=100
      - PUID=1000
    volumes:
      - /share/Container/homebridge:/homebridge
```

(Adjust `PGID`/`PUID` if you want HB to run as a specific QNAP user. The defaults usually work.)

3. The container starts. Wait ~30 sec for first-boot setup.

## Step 3 — Open the Homebridge UI

In a browser: `http://<nas-ip>:8581`. Create your admin user.

## Step 4 — Install the Tethral plugin

1. **Plugins** tab → search `@tethralinc/homebridge-tethral` → **Install**.
2. Fill in API Token + (optionally) API Base URL.
3. Save → Restart.

## Step 5 — Pair to HomeKit

1. iPhone Home app → **+** → **Add or Scan Accessory** → **More options...**.
2. Pick the Homebridge bridge → enter PIN from the HB Status page.
3. Assign Tethral switches to rooms.

## QNAP-specific notes

- **Container Station updates.** When QNAP pushes a Container Station update, your HB container survives but check that it restarted cleanly after the update. Container Station's logs show the last restart event.
- **Firewall.** QTS has its own firewall (rare to be enabled by default). If iPhone discovery fails, check **Control Panel** → **Security** → **Firewall** and allow inbound TCP 51826 and UDP 5353 on the LAN interface.
- **Backups.** Back up the volume mapped to `/homebridge` (in the example: `/share/Container/homebridge`). Loss of that = re-pair the bridge.
- **Container updates.** To pull a newer `homebridge/homebridge` image: Container Station → Images → pull `homebridge/homebridge:latest` → restart the container.

## Troubleshooting

- **"Cannot create container — port 51826 already in use".** Something else on the NAS is using port 51826. Check `netstat -an | grep 51826` from SSH. Either stop the conflicting process or change Homebridge's port in `/share/Container/homebridge/config.json`.
- **iPhone can't find the bridge.** Verify `network_mode: host` in the compose file — without it, mDNS won't work. Also confirm QTS firewall isn't blocking 51826/5353.
- **Plugin install fails with EACCES.** Permission issue on the bind mount. Run `chown -R 1000:100 /share/Container/homebridge` from SSH and restart the container.

## Child bridge (recommended)

In HB UI: **Plugins** → Tethral → **Bridge** → enable **Child Bridge** → Restart.
