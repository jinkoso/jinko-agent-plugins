# Jinko Travel plugin for Cursor

Search flights, hotels and car rentals, book trips, and manage bookings with the Jinko Travel API from
Cursor's agent. The plugin connects Cursor to the Jinko MCP server (`https://mcp.builders.gojinko.com/mcp`)
and adds four skills: `jinko-travel`, `account`, `cli` and `search-cars`.

## Get an API key

Sign in at [dashboard.gojinko.com](https://dashboard.gojinko.com), open **Developers → API keys**, and create
a key. Keys start with `jnk_`. Treat it like a password.

## Install

Install **Jinko** from the Cursor Marketplace.

To try the plugin from this repository instead, copy this folder to `~/.cursor/plugins/local/jinko` and run
**Developer: Reload Window**.

## Configure

The plugin declares one variable, `JINKO_API_KEY`. Set it under **Plugins → Jinko → Configure**. Cursor sends it
to the Jinko MCP server as `Authorization: Bearer <key>`. The plugin itself stores no secret.

## Use

Ask the agent, for example: "Find a one-way flight from New York to Los Angeles next Friday for one adult."
The agent searches live fares with the `jinko` MCP tools. It can add a fare or a hotel to a trip, take the
travelers' details and return a checkout link. The traveler pays at checkout.

The plugin is free. Tool calls use your Jinko API key and count against its account like any other API call.

## Troubleshooting

If no Jinko tool appears in chat:

1. Open **Customize** and check that the Jinko plugin is listed and its `jinko` MCP server is switched on.
   Cursor doesn't load disabled servers or show them in chat.
2. For a copy in `~/.cursor/plugins/local`, local plugin imports must be allowed. On Teams and Enterprise an
   admin controls this with **Allow Local Plugin Imports**. A marketplace install with the same name takes
   precedence over the local copy.
3. Check the key under **Plugins → Jinko → Configure**. A missing or rejected key also leaves the server
   without tools.

Then run **Developer: Reload Window**.

## Source

This package is generated from Jinko's build and published here with each release. Report problems in
this repository's issues. MIT licence.
