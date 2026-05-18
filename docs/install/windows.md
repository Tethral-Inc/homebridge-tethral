# Install on Windows 11

Windows is the trickiest platform because:
- Windows' built-in `Dnscache` service intercepts mDNS by default, which makes Homebridge undiscoverable to iPhones until disabled via a registry edit
- Chrome and Android Debug Bridge (ADB) compete for UDP 5353 (the mDNS port)
- Native Windows host running Homebridge has fragile pairing behavior

The clean answer is **WSL2 with mirrored networking** (requires Windows 11 22H2 or later). WSL2 gives Homebridge its own Linux kernel and network stack, so none of the Windows mDNS quirks affect it.

> **A one-script Windows installer is in development.** It will install WSL2, configure mirrored networking, install Homebridge inside WSL2, install this plugin, configure your token, and print the pair code — all in ~5 min with one elevated PowerShell command. Tracked in the [project roadmap](https://github.com/Tethral-Inc/homebridge-tethral/issues).
>
> Until the installer ships, the manual WSL2 path is documented below. If you'd rather avoid the WSL2 setup, consider running Homebridge on a Raspberry Pi instead — see [docs/install/raspberry-pi.md](raspberry-pi.md).

## Requirements

- Windows 11 22H2 or later (older Windows versions lack WSL2 mirrored networking and require port-forwarding workarounds — not recommended)
- ~10 GB free disk space for WSL2 + Ubuntu
- An iPhone, iPad, or Mac on the same Wi-Fi network

## Manual install (until the installer ships)

### Step 1 — Install WSL2 + Ubuntu

Open an **elevated PowerShell** (right-click PowerShell → Run as administrator) and run:

```powershell
wsl --install -d Ubuntu
```

Wait for download + install (~5 min). When prompted, **reboot**.

After reboot, Ubuntu launches automatically and asks you to create a Linux username and password. Set them — they're separate from your Windows credentials.

### Step 2 — Enable WSL2 mirrored networking

This makes the WSL2 VM appear as a separate device on your LAN with its own IP, which is what HomeKit pairing needs.

In any text editor, create `%USERPROFILE%\.wslconfig` with this content:

```ini
[wsl2]
networkingMode=mirrored
```

Then in PowerShell:

```powershell
wsl --shutdown
```

Next time WSL starts, it'll use mirrored mode.

### Step 3 — Install Node, Homebridge, and the Tethral plugin inside WSL2

Open Ubuntu (Start menu → Ubuntu). Run:

```sh
# Node 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Homebridge
curl -sSfL https://repo.homebridge.io/KEY.gpg | sudo gpg --dearmor | sudo tee /usr/share/keyrings/homebridge.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/homebridge.gpg] https://repo.homebridge.io stable main" | sudo tee /etc/apt/sources.list.d/homebridge.list > /dev/null
sudo apt update
sudo apt install -y homebridge
```

### Step 4 — Open the Homebridge UI

In WSL's terminal, find the WSL IP:

```sh
hostname -I | awk '{print $1}'
```

Then from any browser on the Windows host: `http://<wsl-ip>:8581`.

Create your admin user. Then **Plugins** tab → search `@tethralinc/homebridge-tethral` → **Install** → configure with your `tth_...` API token → **Save** → **Restart**.

### Step 5 — Pair to HomeKit

iPhone **Home** app → **+** → **Add or Scan Accessory** → **More options...** → Homebridge appears in the nearby list → enter PIN from the HB Status page.

## Things to know

- **Windows must stay awake** for Homebridge to keep responding. Settings → System → Power & battery → Screen and sleep → set both "Sleep" timers to **Never** (or use a laptop's lid-closed-do-nothing setting).
- **WSL2 doesn't autostart on Windows boot by default.** To make it always-on: open Task Scheduler → Create Task → Trigger: At startup → Action: `wsl -d Ubuntu -e systemctl start homebridge`.
- **Updating Homebridge:** inside WSL, `sudo apt update && sudo apt upgrade homebridge`.
- **Don't run Homebridge directly on Windows host** (without WSL). The Windows mDNS/Chrome/firewall situation makes pairing extremely fragile — we've documented this in detail and the answer is always "use WSL2 instead."

## Troubleshooting

- **iPhone can't see the bridge in the nearby list.** Verify mirrored networking is on: from PowerShell, `wsl --status` should show `Default Network Mode: mirrored`. If not, your `.wslconfig` isn't being picked up — make sure the file is at `%USERPROFILE%\.wslconfig` (not in WSL's filesystem) and you did `wsl --shutdown` after creating it.
- **Pairing succeeds then iPhone says "Operation timed out".** Almost always means your HomePod is set as a Home Hub and is offline. Either bring it online or temporarily remove it from Home Settings → Hubs & Bridges.
