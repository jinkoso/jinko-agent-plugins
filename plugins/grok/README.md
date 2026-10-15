# Jinko Travel plugin for Grok Bot

This package connects Grok Bot to Jinko's anonymous Grok MCP server at `https://grok.mcp.gojinko.com/`. It searches and books flights, hotels, and enabled car rentals, manages trips, and services supported bookings. It has no API-key variable.

Production version `1.45.0` was observed on 2026-10-15 with `car_search`, `car_cancel_preview`, `car_cancel_commit`, and `car_cancel_status` enabled. A direct read-only LAX rental search returned 40 offers. Use the current runtime tool list because car rentals remain controlled by the server's deployment flag: search requires `car_search`, while cancellation requires all three cancellation tools. If a workflow's tools are absent, tell the user that specific function is currently not enabled for this connection. Do not treat its absence as a permanent product limitation.

## Install and verify

The generated public repository catalog entry is `jinko-grok` and points to `./plugins/grok`. A team administrator can import `https://github.com/jinkoso/jinko-agent-plugins` from **Plugins & MCPs → Team Marketplaces → Add Marketplace → Import from Repo**. In Grok Bot, install the `jinko-grok` entry through **Connect apps** and confirm that its connected server is available.

Copying a plugin into `~/.cursor/plugins/local` is a Cursor IDE development path. Verify Grok Bot installation through the team or public marketplace and **Connect apps**.

For a read-only check, ask Grok Bot to list the connected Jinko tools without calling one. Then use exact future dates to search a one-way flight and a hotel stay without creating a trip or checkout. If `car_search` is listed, also search a rental using a real driver age and residence country. Tool labels may have a host prefix; verify the connected server and actual tool label.

If tools do not appear, check installation, whether the server or tools are disabled, team connector policy, and network access to `grok.mcp.gojinko.com`. An empty tool list alone does not identify the cause.

See [GROK_BOT.md](GROK_BOT.md) for release, submission, and reviewer instructions.
