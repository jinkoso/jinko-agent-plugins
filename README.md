# Jinko agent plugins

The Jinko Travel plugin for **Claude Code**, **Codex**, **Cursor** and **Vellum**: search
flights, hotels and car rentals, build a trip, book it and manage the booking, through the
Jinko MCP server (`https://mcp.builders.gojinko.com/mcp`).

Every host gets the same skill content (`jinko-travel`, plus a short host-specific section),
and each package connects to the Jinko MCP server in its host's own format.

## How this repository works

- **It is generated.** The packages here are rendered from a private build. Don't edit them
  by hand: a later release overwrites them.
- **Changes land only through release PRs** titled `Release v<x.y.z>`, one per release. Each
  release updates the packages, the marketplace files and `RELEASE.json`, which records the
  version and the source commits it was built from.
- **Open issues here.** Bug reports and questions about the plugin are welcome as GitHub
  issues on this repository. Pull requests that edit `plugins/` can't be merged as they are;
  describe the change in an issue instead.

## Layout

Each release brings:

| Path | What it is |
|---|---|
| `plugins/jinko/` | The Claude Code and Codex plugin (one package, both manifests) |
| `plugins/cursor/` | The Cursor plugin |
| `plugins/vellum/` | The Vellum plugin |
| `.claude-plugin/marketplace.json` | Claude Code marketplace: plugin `jinko` → `./plugins/jinko` |
| `.agents/plugins/marketplace.json` | Codex marketplace: plugin `jinko` → `./plugins/jinko` |
| `.cursor-plugin/marketplace.json` | Cursor marketplace: plugin → `./plugins/cursor` |
| `RELEASE.json` | The released version and the source commits |

## Before you install: set `JINKO_API_KEY`

Every host authenticates with a Jinko API key, a `jnk_…` key. Create one in the Jinko
dashboard (dashboard.gojinko.com → Developers → API keys), then export it where your agent
runs:

```bash
export JINKO_API_KEY=jnk_your_key_here
```

Add it to your shell profile (`~/.zshrc`, `~/.bashrc`) to keep it across sessions.

- **Claude Code** sends it as `Authorization: Bearer ${JINKO_API_KEY}`. If the variable is
  unset, Claude Code sends the literal text `${JINKO_API_KEY}` and the server answers 401:
  set the variable before you start Claude Code.
- **Codex** reads it through `bearer_token_env_var`.
- **Cursor** declares `JINKO_API_KEY` as a plugin variable used in the `Authorization`
  header.
- **Vellum** reads it through the plugin's local MCP proxy.

## Install

### Claude Code

```bash
claude plugin marketplace add jinkoso/jinko-agent-plugins
claude plugin install jinko@jinko-agent-plugins
```

Or, inside a Claude Code session:

```
/plugin install jinko --marketplace jinkoso/jinko-agent-plugins
```

### Codex

```bash
codex plugin marketplace add jinkoso/jinko-agent-plugins
codex plugin add jinko@jinko-agent-plugins
```

Or, in the Codex TUI, add the marketplace as above and pick `jinko` from `/plugins`.

### Cursor

- **Cursor Marketplace:** install Jinko from the Cursor Marketplace once it is approved there.
- **Teams and Enterprise:** Dashboard → Plugins & MCPs → Team Marketplaces → Add Marketplace
  → Import from Repo, and paste `https://github.com/jinkoso/jinko-agent-plugins`.
- **Individual, from this repository:** copy `plugins/cursor` into
  `~/.cursor/plugins/local/jinko`, then restart Cursor or run **Developer: Reload Window**.

### Vellum

Vellum users keep installing the Jinko plugin from
[`jinkoso/jinko-vellum-plugin`](https://github.com/jinkoso/jinko-vellum-plugin) until the
Vellum platform integration ships. `plugins/vellum` here is built from the same source and
will become the install path then.

### npm

The Claude Code and Codex package is also published to npm as
[`@gojinko/plugin`](https://www.npmjs.com/package/@gojinko/plugin), with the same version as
the release here. Install the plugin through the marketplaces above.

## License

[MIT](./LICENSE)
