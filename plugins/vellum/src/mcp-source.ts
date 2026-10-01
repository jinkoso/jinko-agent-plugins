// Generated from packages/plugin/mcp-source.json by scripts/render.mjs. Do not edit.

/** Server id in `mcp.json`; also the name reported to the assistant. */
export const SERVER_NAME = "jinko";

/** Endpoint used when the override variable is unset. */
export const DEFAULT_URL = "https://mcp.builders.gojinko.com/mcp";

/** Env var that overrides the remote endpoint. */
export const URL_ENV = "JINKO_MCP_URL";

/** Header that carries the key. */
export const AUTH_HEADER = "Authorization";

/** Scheme placed before the key in that header. */
export const AUTH_SCHEME = "Bearer";

/** Env var that overrides the vault lookup. */
export const API_KEY_ENV = "JINKO_API_KEY";

/** Domains the stored credential is allowed to be sent to. */
export const ALLOWED_DOMAINS = ["mcp.builders.gojinko.com","jinko-e90ee33b.alpic.live"] as const;
