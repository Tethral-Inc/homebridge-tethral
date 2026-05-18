# Install on Raspberry Pi

Recommended path for most users. A Pi 4 or Pi 5 (2 GB RAM or more) runs Homebridge + the Tethral plugin comfortably with headroom for other plugins. Total setup time: ~20 min.

## What you need

- Raspberry Pi 4 or 5 (2 GB RAM minimum, 4 GB recommended)
- microSD card (16 GB or larger, Class 10/A1)
- Power supply rated for your Pi model (5V/3A for Pi 4, USB-C PD for Pi 5)
- A way to flash the SD card (computer with SD reader, or USB SD adapter)
- Ethernet cable OR Wi-Fi credentials for the Pi
- An iPhone, iPad, or Mac on the same network for HomeKit pairing

## Step 1 — Flash the Homebridge OS image

The Homebridge project maintains an official Raspberry Pi OS image with Homebridge pre-installed.

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/) for your OS.
2. Open Imager. Click **Choose Device** → select your Pi model.
3. Click **Choose OS** → scroll to **Other specific-purpose OS** → **Home assistants and home automation** → **Homebridge**. Pick the latest stable image.
4. Click **Choose Storage** → select your SD card.
5. Click **Next** → **Edit Settings**:
   - Set a hostname (e.g. `tethral-bridge`)
   - Enable SSH (set a password)
   - Configure your Wi-Fi if not using Ethernet
   - Set locale + timezone
6. Click **Save** → **Yes** to apply OS customisation → **Yes** to confirm erase.
7. Wait for write + verify (5-10 min depending on card speed).

## Step 2 — First boot

1. Insert the SD card into the Pi.
2. Connect power (and Ethernet if not using Wi-Fi).
3. Wait ~2 min for first boot. The Pi runs initial setup automatically.
4. From any device on the same network, open `http://homebridge.local` (or `http://<hostname>.local` if you set a custom one).
   - If `.local` doesn't resolve on your network, find the Pi's IP in your router's admin page and use `http://<ip>:8581`.

## Step 3 — Homebridge UI setup

1. The Homebridge UI loads. Create an admin username + password (used to log into the UI, not for HomeKit).
2. You land on the Status dashboard. Homebridge is running.

## Step 4 — Install the Tethral plugin

1. Click **Plugins** in the top nav.
2. Search for `@tethralinc/homebridge-tethral`. The plugin should appear.
3. Click **Install**. Wait for the install to complete (~30 sec).
4. The Tethral configuration modal opens automatically. Fill in:
   - **API Token:** the `tth_...` token issued by Tethral
   - **API Base URL:** leave at the default unless you're testing against a staging environment
   - **Poll Interval Seconds:** leave at default (300)
5. Click **Save**.
6. Homebridge prompts you to restart. Click **Restart**.

## Step 5 — Pair to HomeKit

1. On your iPhone, open the **Home** app.
2. Tap **+** → **Add or Scan Accessory** → **More options...**.
3. Wait ~10 seconds. **Homebridge** (or whatever your bridge is named) appears under Nearby Accessories.
4. Tap it → **Add Anyway** (for the uncertified accessory warning).
5. Scan the QR code shown in the Homebridge UI **Status** page, or enter the 8-digit PIN shown next to it.
6. Assign each Tethral routine (each shows as a Switch in HomeKit) to a room.

## Verify it works

- In the Home app, tap any Tethral switch. It should turn on, then auto-flip back to off after ~1 second. That's the stateless trigger pattern firing.
- Say "Hey Siri, turn on [routine name]". Same behavior.
- In the Homebridge UI **Logs** tab, you should see `[Tethral] Routine fired: <name>` for each trigger.

## Troubleshooting

- **Plugin not in the search results.** The Homebridge UI's plugin search uses npm's keyword index, which can take ~30 min to update after a new release. As a fallback, click the gear icon next to Plugins → **Install Plugin from npm** → paste `@tethralinc/homebridge-tethral`.
- **"No Response" in Home app when you toggle a switch.** Plugin can't reach the Tethral API. Check the **Logs** for the actual error — most commonly an expired or revoked API token. Mint a new one and update the plugin config.
- **Switches don't show up after pairing.** Plugin fetched zero routines from Tethral. Verify your account has routines defined in the Tethral app. The plugin polls every 5 min; you can force a refresh by restarting Homebridge.

## Child bridge (recommended for production)

Once you have other plugins running on this Pi, isolate Tethral as a child bridge so a Tethral API hiccup doesn't affect anything else: in the Homebridge UI, **Plugins** → Tethral → **Bridge** → toggle **Child Bridge** on, then Restart.
