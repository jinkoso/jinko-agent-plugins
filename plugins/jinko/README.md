# Jinko Travel plugin

Search flights, hotels and car rentals, book trips, and manage bookings through Jinko MCP.

## Install

Claude Code:

```sh
claude plugin marketplace add jinkoso/jinko-agent-plugins
claude plugin install jinko@jinko-agent-plugins
```

Codex:

```sh
codex plugin marketplace add jinkoso/jinko-agent-plugins
codex plugin add jinko@jinko-agent-plugins
```

## Authentication

Get a tenant key from **dashboard.gojinko.com → Developers → API keys**, then export it before starting your host:

```sh
export JINKO_API_KEY=jnk_...
```

The package ships `jinko-travel`, `cli`, `account`, and `search-cars` skills.
The `jinko` MCP server connects to `https://mcp.builders.gojinko.com/mcp`.
Claude Code also supports `JINKO_MCP_URL` to override that endpoint; the override works on Claude Code only.
