# Install on macOS

Most useful if you have an always-on Mac mini, an old Mac you've repurposed as a home server, or you're just testing on your workstation. Total setup: ~10 min.

## Requirements

- macOS 12 (Monterey) or later
- Node.js 22 or 24 (LTS)
- Mac stays awake on the local network (don't put it to sleep — Homebridge needs to keep advertising on mDNS)

## Step 1 — Install Node and Homebridge

The official Homebridge install script handles both:

```sh
sudo curl -fsSL https://raw.githubusercontent.com/homebridge/homebridge/latest/install.sh | sh
```

This installs Node (if missing), the Homebridge CLI, the Homebridge UI plugin, and sets up Homebridge to start automatically via `launchd`.

If you'd rather use Homebrew + npm manually:

```sh
brew install node@22
npm install -g --unsafe-perm homebridge homebridge-config-ui-x
hb-service install --user homebridge
```

## Step 2 — Open the Homebridge UI

```sh
open http://localhost:8581
```

Create an admin user.

## Step 3 — Install the Tethral plugin

1. **Plugins** tab → search `@tethralinc/homebridge-tethral`.
2. Click **Install**.
3. Configure with your `tth_...` API token.
4. **Save** → **Restart**.

## Step 4 — Pair to HomeKit

1. iPhone (or iPad / Mac) **Home** app → **+** → **Add or Scan Accessory** → **More options...**.
2. Pick the Homebridge bridge from Nearby Accessories.
3. Enter the PIN shown in the HB Status page.
4. Assign Tethral switches to rooms.

## macOS-specific notes

- **Disable sleep, or Homebridge stops responding.** System Settings → **Battery** (or **Energy Saver** on desktops) → set "Prevent your Mac from sleeping when the display is off" to ON. If you don't, Tethral switches show "No Response" in the Home app whenever the Mac sleeps.
- **macOS firewall.** If enabled (System Settings → Network → Firewall), it'll prompt to allow `node` to accept incoming connections on first run. Click **Allow**. If you accidentally Deny, remove the rule from the Firewall settings and let it re-prompt.
- **Bonjour conflicts.** macOS's native `mDNSResponder` plays nicely with HAP-NodeJS — no special config needed. Unlike Windows, you don't have to disable anything to make mDNS work.

## Troubleshooting

- **Plugin search returns nothing.** npm indexing lag. Try **Install Plugin from npm** → paste `@tethralinc/homebridge-tethral`.
- **Homebridge dies when Mac sleeps.** Expected — turn off Mac sleep (see note above).
- **iPhone can't see the bridge after a router reboot.** Sometimes mDNS state gets stuck. From Terminal: `sudo killall -HUP mDNSResponder` to flush.

## Child bridge (recommended)

HB UI → **Plugins** → Tethral → **Bridge** → enable **Child Bridge** → Restart.

## Local development

If you're a developer hacking on the plugin itself:

```sh
git clone https://github.com/Tethral-Inc/homebridge-tethral.git
cd homebridge-tethral
npm install
npm run watch
```

`npm run watch` rebuilds on file changes, links the plugin to your local Homebridge install via `npm link`, and starts Homebridge with the local config under `test/hbConfig/`.
