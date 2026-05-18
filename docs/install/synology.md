# Install on Synology NAS (DSM 7+)

If you already run a Synology NAS, this is the lowest-effort path — Homebridge runs as an official Package Center package, autostarts with DSM, and survives DSM updates. Total setup: ~10 min.

## Requirements

- Synology NAS running DSM 7.0 or later
- Admin access to DSM
- Network: NAS and your iPhone on the same subnet

## Step 1 — Install Homebridge from Package Center

1. Log into DSM as an admin.
2. Open **Package Center**.
3. Search for **Homebridge**.
4. Click **Install**. DSM walks you through:
   - Confirming the location for Homebridge's data (default is fine)
   - Setting the port for the Homebridge UI (default `8581`)
   - Setting the port for the HomeKit bridge (default `51826`)
   - Setting the admin username/password for the UI
5. Click **Done**. Homebridge starts automatically.

## Step 2 — Open the Homebridge UI

1. In DSM, click **Main Menu** → **Homebridge**, OR open `http://<nas-ip>:8581` in a browser.
2. Log in with the admin credentials you set during install.

## Step 3 — Install the Tethral plugin

1. Click **Plugins** in the top nav.
2. Search `@tethralinc/homebridge-tethral`.
3. Click **Install**. Wait for npm to fetch and link (~30 sec).
4. Configure when prompted:
   - **API Token:** the `tth_...` value from Tethral
   - **API Base URL:** default
   - **Poll Interval Seconds:** default (300)
5. **Save** → **Restart** when prompted.

## Step 4 — Pair to HomeKit

Same as any HB install:

1. iPhone → **Home** app → **+** → **Add or Scan Accessory** → **More options...**.
2. Wait ~10s, pick your bridge from the nearby list.
3. Add Anyway → enter the PIN shown in the HB UI Status page (or scan the QR).
4. Assign each Tethral switch to a room.

## Things to know on Synology

- **Synology firewall.** If you have DSM's Firewall enabled, allow inbound TCP on the HomeKit bridge port (51826 by default) on your LAN profile. Otherwise iPhone discovery times out.
- **DSM updates.** The Homebridge package survives DSM updates. After major DSM upgrades (e.g. 7.2 → 8.0), check **Package Center** → **Installed** → **Homebridge** for any "Update Available" prompt.
- **Backups.** Add the Homebridge data directory to your Synology backup target. Loss of `cachedAccessories` + `persist/` means re-pairing the bridge to HomeKit (not catastrophic but mildly annoying).

## Troubleshooting

- **Plugin missing from search.** npm indexing lag. Use **Install Plugin from npm** → `@tethralinc/homebridge-tethral`.
- **"No Response" on switches.** Bad token or API URL — check Homebridge **Logs**.
- **iPhone can't see the bridge.** Almost always Synology Firewall blocking 51826 inbound, OR the NAS is on a different VLAN than your iPhone.

## Child bridge (recommended)

In the Homebridge UI: **Plugins** → Tethral → **Bridge** → enable **Child Bridge**. Restart. Now Tethral's plugin runs in an isolated process — issues there don't affect your other Homebridge plugins or any cameras you've integrated.
