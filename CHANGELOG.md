# Changelog

All notable changes to `@tethralinc/homebridge-tethral` are documented in this file.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-18

**Custom webhook switches (escape hatch).** A new optional `webhooks` array in
the plugin config lets you expose arbitrary HTTP endpoints as additional
HomeKit Switches alongside your Tethral routines. Each webhook entry takes a
`name`, `url`, optional `method` (defaults to POST), optional `headers` array,
optional `body`, and optional `timeoutMs`. The Switch behaves identically to a
Tethral routine — toggle on, fire, auto-off after ~1.2s.

Strategic intent: when a user wants to fire something Tethral doesn't yet
integrate natively (Home Assistant scripts, Shelly relays, custom ESP32
endpoints, Zapier/Slack webhooks), they stay in the Tethral plugin instead of
installing a second one. New webhook patterns on the user side become signal
for what to integrate natively next.

Implementation:
- New `src/webhookClient.ts`: `validateWebhook(input)` pure validator,
  `fireWebhook(config, signal)` execution. Native fetch with AbortSignal
  timeout, default User-Agent unless user overrides.
- New `src/webhookAccessory.ts`: `WebhookAccessory` class parallel to
  `TethralAccessory`. Same HAP characteristics (Name, Manufacturer="Tethral",
  Model="Webhook", SerialNumber=name, FirmwareRevision, ConfiguredName, On).
  Categories.SWITCH set on registration.
- `platform.ts`: separate `webhookAccessories` and `webhookWrappers` maps.
  `diffWebhooks(current, incoming, uuidFor)` pure function for create/update/
  remove classification on each restart. UUID prefix `:webhook:` so webhook
  switches never collide with routine switches even if their names match.
- `configureAccessory` inspects `context.routine` vs `context.webhook` to
  route restored accessories to the right map.
- Webhook accessories also opt-in to Matter publication via the existing
  `api.matter` integration.
- Invalid webhook entries (missing name/url, non-http(s) protocol, duplicate
  names) are logged-and-skipped, not fatal. The platform starts cleanly even
  if every webhook is malformed.
- Webhooks honor the platform's shutdown AbortSignal so in-flight requests
  abort cleanly on Homebridge restart.

Schema: `config.schema.json` extends with the `webhooks` array (rendered in
the Homebridge UI as a repeatable form with per-entry fields for name, URL,
method dropdown, headers array, body, timeout).

Tests: 18 new test cases covering validateWebhook (8), fireWebhook (7),
diffWebhooks (3). Total plugin test count: 32/32 green.

## [0.1.2] — 2026-05-17

Diagnostic release. v0.1.1 release workflow's `npm publish` returned a
404 despite OIDC provenance signing succeeding upstream. Adding
`--loglevel verbose` to the publish step to capture the full npm
response and isolate the trusted-publisher mismatch.

## [0.1.1] — 2026-05-17

First release published via GitHub Actions + npm Trusted Publishing (OIDC).
No long-lived `NPM_TOKEN` secret in the repo; every release attaches a
verifiable provenance attestation that says it was built by
`Tethral-Inc/homebridge-tethral`'s `release.yml` workflow at the tagged commit.

- Switch the release pipeline to OIDC `--provenance`; drop the placeholder
  `NPM_TOKEN` block from the workflow
- Add `npm test` to the release pipeline so a tag that breaks tests fails the
  release before publishing

## [0.1.0] — 2026-05-17

Initial release. Bootstrap publish using a one-time Granular Access Token to
establish the package on npm before configuring Trusted Publishing.

- Dynamic Homebridge 2.0 platform plugin (ESM, Node 22+)
- Discovers Tethral routines via `GET /v1/routines` and registers each as a
  HomeKit Switch (stateless trigger — auto-off after 1.2s)
- Fires `POST /v1/routines/:id/execute` on toggle
- Polls for routine changes every 60–300s (configurable)
- Restores accessories from Homebridge cache with handlers re-bound
- Publishes each Switch to Homebridge 2.0's Matter bridge (opt-in via
  `api.matter`) so routines surface in Google Home / SmartThings via Matter
- Bearer-token auth; null-safe routine description handling; AbortSignal
  threading for clean shutdown
- AccessoryInformation exposes all HAP-required characteristics (Name,
  Manufacturer, Model, SerialNumber, FirmwareRevision, Identify) so iOS Home
  accepts the accessory list at pair time
- Switch service publishes ConfiguredName so renames sync to Home
- Categories.SWITCH set on each accessory
- Zero runtime dependencies (only native `fetch`); telemetry-free
- Apache-2.0 licensed
