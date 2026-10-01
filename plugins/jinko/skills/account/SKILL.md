---
name: account
description: Set up and manage your Jinko developer account — registration, API keys, usage quotas. Use when the user asks about their API key, usage limits, or account setup.
---

# Developer Account

Manage your Jinko developer account via the [Jinko Dashboard](https://gojinko.com/dashboard).

Account management is handled through the web dashboard — there are no MCP tools for account operations. Guide the user to the dashboard for any account-related tasks.

## Getting started

1. **Register** — go to [gojinko.com/dashboard](https://gojinko.com/dashboard) and sign up with your email.
2. **Create an API key** — in the dashboard, go to API Keys and create a new key. The full key (prefixed `jnk_`) is shown only once — save it immediately.
3. **Set your key** — configure your environment:
   - CLI: `jinko auth login --key jnk_...` (or set `JINKO_API_KEY=jnk_...`)
   - API client: pass the key when creating the client
   - MCP: use `Authorization: Bearer jnk_...` header

## What you can do on the dashboard

- **View and create API keys** — each key has a `jnk_` prefix
- **Revoke API keys** — irreversible, confirm before proceeding
- **Check usage** — see requests used, remaining quota, and reset date
- **Manage your profile** — update name, email, organization

## Rate limits

- Default: **1,000 requests / 30 days** per API key
- Usage resets on a rolling 30-day window
- If you need a higher limit, contact support via the dashboard

## CLI authentication

The CLI authenticates with an **API key** (`jnk_...`):

- `jinko auth login --key jnk_...` — stores the key in `~/.jinko/config.yaml`
- `jinko auth login` (no flag) — prompts for the key interactively
- `export JINKO_API_KEY=jnk_...` — pass it via the environment (scripts and CI)

OAuth sign-in is deprecated and no longer supported.
