# Grok Bot integration and submission guide

The stable public instructions URL after release is:

`https://github.com/jinkoso/jinko-agent-plugins/blob/main/plugins/grok/GROK_BOT.md`

## Current status

The anonymous production MCP root has been deployed at version `1.45.0` with the four car-rental tools enabled. This source change does not establish that a Grok Bot Marketplace submission has been filed, entered review, or been approved, and it does not verify an installation inside the Grok Bot app. Confirm those states in the publisher dashboard and Grok Bot. The public package is generated at `plugins/grok`; the authenticated Builder package remains at `plugins/cursor`.

## Release and team verification

1. Render and validate `dist/grok`.
2. Release through the Jinko mirror workflow.
3. At the public commit, confirm the catalog entry `jinko-grok` points to `./plugins/grok` and that the package contains its manifest, `mcp.json`, instructions, skill, and logo.
4. Import `https://github.com/jinkoso/jinko-agent-plugins` through **Plugins & MCPs → Team Marketplaces → Add Marketplace → Import from Repo**.
5. Review the `jinko-grok` entry and team policy, then verify it in Grok Bot through **Connect apps**.

A Cursor IDE local load does not verify Grok Bot installation.

## Submission worksheet

Open [x.ai/bot/marketplace/submit-a-plugin](https://x.ai/bot/marketplace/submit-a-plugin) after the public package and reviewer tests are ready.

| Field | Value |
|---|---|
| Organization name | Jinko |
| Organization handle | Suggested `jinko` (lowercase); publisher must confirm availability |
| Publisher identity | Publisher supplies their first name, last name, and work email |
| Website | `https://gojinko.com` |
| Repository | `https://github.com/jinkoso/jinko-agent-plugins` |
| Package | `plugins/grok` |
| Manifest | `plugins/grok/.cursor-plugin/plugin.json` |
| MCP server | `https://grok.mcp.gojinko.com/` |
| Authentication | None |
| Instructions | `https://github.com/jinkoso/jinko-agent-plugins/blob/main/plugins/grok/GROK_BOT.md` |
| Description | Search and book live flights, hotels, and enabled car rentals, manage trips, and service Jinko bookings in Grok Bot. |
| Logo | `https://raw.githubusercontent.com/jinkoso/jinko-agent-plugins/main/plugins/grok/assets/logo.svg` |
| Testing instructions | Follow the reviewer plan below and cite the exact public commit |
| License | MIT |

The logo is the existing square SVG with an opaque background. Leave local-test and in-app-test attestations unchecked until those checks pass for the public commit. Source review, renderer tests, and a Cursor IDE load do not satisfy those attestations.

## Reviewer plan

1. Confirm the public catalog resolves `jinko-grok` from `./plugins/grok`.
2. Install it in Grok Bot and confirm it appears in **Connect apps**.
3. Ask: `List the connected Jinko tools and server identity. Do not call a travel tool.`
4. Ask: `Search one-way flights from JFK to LAX on 2026-11-18 for one adult. Do not create a trip or checkout.`
5. Ask: `Search hotels in Paris for two adults from 2026-11-18 through 2026-11-20. Do not create a trip or checkout.`
6. Inspect the current tool list. If `car_search` is present, ask: `Search rental cars at LAX from 2026-11-18 10:00 local time through 2026-11-20 10:00 local time for a 30-year-old US resident. Do not create a trip or checkout.` If it is absent, record that cars are currently not enabled on this deployment rather than treating the absence as a permanent product limitation.
7. Confirm that no credential prompt appears and that results come from the connected `jinko-grok` server.
8. Stop before trip creation, checkout, payment, cancellation, refund, or exchange. Record the Grok Bot version, test time, exact dates, and exact errors without including personal data.

Replace sample dates with exact future dates if they have passed.

## Payment boundary

Checkout returns a `checkout_url` for the traveler. Use agent payment only when `agent_spt_params` is present and the environment supports Shared Payment Token minting. For 3-D Secure, the required `#hv=` value comes from the issued token's `next_action.use_stripe_sdk.value`; it is not part of the `submit_agent_payment` response. Never collect card details in chat.

## Protocol evidence

On 2026-10-15, an anonymous MCP initialization and `tools/list` against the exact root endpoint `https://grok.mcp.gojinko.com/` reported `jinko-travel` version `1.45.0`, protocol `2025-06-18`, and 28 tools including `car_search`, `car_cancel_preview`, `car_cancel_commit`, and `car_cancel_status`. The complete observed tool names, required-field summary, and actual input schemas for the four car tools are recorded in `skills/jinko-travel/live-production-car-tools.json`.

A direct read-only `car_search` against that Grok endpoint used LAX, branch-local `2026-11-20T10:00:00` through `2026-11-23T10:00:00`, driver age 34, and US residence. It succeeded with 40 offers. This verifies the public MCP's direct search path. It does not establish Grok Bot installation, checkout, payment, or booking behavior.

The earlier 2026-10-14 observation remains unchanged in `tool-snapshot.json`: version `1.44.1`, protocol `2025-06-18`, and 24 tools. It is a historical snapshot rather than a permanent allowlist or the current deployment state.

`expected-car-tools.json` remains separate pre-deployment evidence from `jinkoso/jinko-mcp` branch `codex/public-mcp-car-rental`, based on `fab0ffc`, with `ENABLE_CAR=true`. It preserves the original contract and its historical `not_deployed` source status; use the 1.45.0 live evidence for the current production observation.

## Sources

- [Grok Bot for teams and enterprises](https://docs.x.ai/grok-bot/teams-and-enterprises)
- [Use the computer and apps](https://docs.x.ai/grok-bot/computer-and-apps)
- [Cursor Plugins reference](https://cursor.com/docs/reference/plugins)
- [Cursor plugin template](https://github.com/cursor/plugin-template)
- [tinkabot Marketplace example](https://x.ai/bot/marketplace/bots/tinkabot), used as an example rather than a normative specification
