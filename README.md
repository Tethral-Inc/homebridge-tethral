# @tethralinc/homebridge-tethral

A [Homebridge](https://homebridge.io) 2.0 plugin that exposes your [Tethral](https://tethral.ai) routines as HomeKit Switches. Switches show up in the Apple Home app, and (via Homebridge 2.0's Matter bridge) propagate to any Matter-compatible controller — Google Home, SmartThings, and more.

Each Tethral routine becomes one Switch. Toggling the Switch fires the routine on Tethral, and the Switch auto-returns to off (the standard HomeKit stateless-trigger pattern).

> **Beta.** This plugin is in beta. Routines-only for v1 — stateful device bridging will come later. API tokens are issued by Tethral support during the closed beta; self-serve token issuance ships with the Tethral web app.

## Requirements

- Homebridge `^2.0.0`
- Node `^22.10.0 || ^24.0.0`
- A Tethral account and an API token (request one from Tethral support during the beta)

## Installation

Pick the platform where you run (or want to run) Homebridge:

| Platform | Guide | Setup time |
| --- | --- | --- |
| **Raspberry Pi 4 / 5** *(recommended for most users)* | [docs/install/raspberry-pi.md](docs/install/raspberry-pi.md) | ~20 min |
| **Synology NAS** (DSM 7+) | [docs/install/synology.md](docs/install/synology.md) | ~10 min |
| **QNAP NAS** | [docs/install/qnap.md](docs/install/qnap.md) | ~15 min |
| **macOS** (Mac mini, always-on Mac) | [docs/install/macos.md](docs/install/macos.md) | ~10 min |
| **Linux server** (Ubuntu / Debian / Fedora) | [docs/install/linux.md](docs/install/linux.md) | ~10 min |
| **Docker** (any host with `network_mode: host`) | [docs/install/docker.md](docs/install/docker.md) | ~5 min |
| **Windows 11** *(via WSL2 — universal installer coming soon)* | [docs/install/windows.md](docs/install/windows.md) | ~20 min |
| Already running Homebridge? | Just search for `@tethralinc/homebridge-tethral` in the HB UI Plugins tab | ~1 min |

Quick install if you already have Homebridge and a working CLI:

```sh
npm install -g @tethralinc/homebridge-tethral
```

## Configuration

The plugin is configured through the Homebridge UI under **Plugins → Tethral**. The fields are:

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `name` | yes | `Tethral` | Display name for the platform in Homebridge logs |
| `apiToken` | yes | — | Long-lived Tethral API token, starts with `tth_` |
| `apiBaseUrl` | no | `https://api.tethral.ai` | Override for staging or local dev |
| `pollIntervalSeconds` | no | `300` | How often to re-fetch your routine list |
| `executeTimeoutMs` | no | `5000` | Per-execute request timeout |

Equivalent block in `config.json`:

```json
{
  "platform": "Tethral",
  "name": "Tethral",
  "apiToken": "tth_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "pollIntervalSeconds": 300
}
```

## How it works

1. On startup, the plugin calls `GET /v1/routines` against the Tethral API using your bearer token.
2. Each returned routine is registered as a HomeKit Switch accessory, with the routine's `id` as the stable UUID seed (so accessories survive Homebridge restarts).
3. When you toggle the Switch on (manually, via a HomeKit automation, or via Siri), the plugin POSTs to `/v1/routines/{id}/execute`. Tethral fires the routine asynchronously.
4. The Switch auto-resets to off after ~1.2 seconds — there's no persistent "on" state for a routine trigger.
5. The plugin re-fetches the routine list every `pollIntervalSeconds`. New routines appear as new Switches; deleted routines are unregistered.
6. On Homebridge 2.0, each Switch is also published to the Matter bridge, so it appears in any Matter-compatible controller paired to your Homebridge instance.

If the Tethral API is unreachable, existing Switches stay registered and toggling one returns "Not Responding" in the Home app until the API comes back. The plugin will not crash Homebridge on transient API failures.

## Local development

This repo includes a tiny local mock of the Tethral API under `dev/mock-api/`, so you can develop the plugin without standing up a real backend.

```sh
git clone https://github.com/Tethral-Inc/homebridge-tethral.git
cd homebridge-tethral
npm install
npm run build

# Terminal 1: start the mock API on http://127.0.0.1:3000
npm run mock-api

# Terminal 2: mint a dev token (printed once to stdout)
npm run mint-token

# Paste the minted token into test/hbConfig/config.json under "apiToken",
# then start Homebridge against the local test config:
npm run watch
```

The mock API ships seeded with three demo routines (`Good Morning`, `Movie Night`, `Leaving Home`). The mock is for development only and is never published to npm.

## Child bridge mode (recommended)

This plugin works as a [Homebridge child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges) without any extra configuration. In the Homebridge UI, open the Tethral plugin settings and toggle **"Bridge"** → **"Child Bridge"**. Running as a child bridge isolates the plugin from your main Homebridge instance, so a transient Tethral API outage or plugin error can't affect your other accessories. A restart of the child bridge only touches Tethral switches; the rest of your Homebridge keeps running.

## Verified status

This plugin targets Homebridge Verified. The build is dynamic-platform, ESM-only, telemetry-free (zero runtime dependencies — only native `fetch`), supports child bridges, ships a config schema for the Homebridge UI, and publishes a GitHub Release for every version.

## License

[Apache 2.0](./LICENSE)
