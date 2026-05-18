# Changelog

All notable changes to `@tethralinc/homebridge-tethral` are documented in this file.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] — 2026-05-17

Retry of OIDC Trusted Publishing after reconfiguring the npm-side
trusted publisher record. v0.1.3 was published via local CLI as a
fallback after the v0.1.1 and v0.1.2 OIDC publishes were rejected
with a masked 404. No code changes vs 0.1.3.

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
