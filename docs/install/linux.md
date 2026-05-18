# Install on Linux server (Ubuntu / Debian / Fedora)

If you have a Linux home server, NUC, or repurposed mini-PC running 24/7, this is the cleanest path. Total setup: ~10 min.

## Requirements

- Linux distribution with `systemd` (Ubuntu 22.04+, Debian 12+, Fedora 38+, etc.)
- Node.js 22 or 24 (the install script handles this)
- Root or `sudo` access
- The machine stays on and connected to your LAN

## Step 1 — Run the official Homebridge install script

For Debian / Ubuntu:

```sh
curl -sSfL https://repo.homebridge.io/KEY.gpg | sudo gpg --dearmor | sudo tee /usr/share/keyrings/homebridge.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/homebridge.gpg] https://repo.homebridge.io stable main" | sudo tee /etc/apt/sources.list.d/homebridge.list > /dev/null
sudo apt update
sudo apt install -y homebridge
```

For Fedora / RHEL-family:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/homebridge/homebridge/latest/install.sh | sh
```

Either path installs Node + Homebridge + the UI plugin and registers a `systemd` unit that starts Homebridge on boot.

## Step 2 — Confirm the service is running

```sh
sudo systemctl status homebridge
```

Look for `active (running)`.

## Step 3 — Open the Homebridge UI

```
http://<server-ip>:8581
```

Set up your admin user.

## Step 4 — Install the Tethral plugin

1. **Plugins** → search `@tethralinc/homebridge-tethral` → **Install**.
2. Configure with your `tth_...` API token.
3. **Save** → **Restart**.

## Step 5 — Pair to HomeKit

1. iPhone Home app → **+** → **Add or Scan Accessory** → **More options...**.
2. Wait for the bridge to appear, tap it, enter the PIN.
3. Assign switches.

## Linux-specific notes

- **Firewall.** If you run `ufw` or `firewalld`, allow inbound:
  - `sudo ufw allow 8581/tcp`   (Homebridge UI)
  - `sudo ufw allow 51826/tcp`  (HomeKit HAP bridge)
  - `sudo ufw allow 5353/udp`   (mDNS discovery)
- **systemd logs:** `sudo journalctl -u homebridge -f` to tail Homebridge logs from the shell.
- **Updates.** On Debian/Ubuntu, `sudo apt update && sudo apt upgrade homebridge` keeps Homebridge current. On Fedora, the install script writes a small auto-update helper — re-run the script to update.
- **Backups.** Back up `/var/lib/homebridge/` (the default data directory). Contains your `config.json`, `cachedAccessories`, and `persist/` (HomeKit pairing state).

## Troubleshooting

- **`systemctl status homebridge` shows "failed".** `sudo journalctl -u homebridge -n 100` shows the actual error. Most common: port conflict on 51826 or 8581.
- **iPhone discovery times out.** Check firewall (above). Also confirm the server is on the same subnet as the iPhone (`ip addr` to see server IPs; `Settings → Wi-Fi → (i)` on iPhone to compare).
- **Avahi conflicts.** If `avahi-daemon` is running, it owns UDP 5353. HAP-NodeJS's `ciao` advertiser is configured to coexist with Avahi by default — no action needed. If you suspect interference, `sudo systemctl stop avahi-daemon` and test.

## Child bridge (recommended)

HB UI → **Plugins** → Tethral → **Bridge** → enable **Child Bridge** → Restart.
