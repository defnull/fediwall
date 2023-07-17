
import type { Config } from "./config"

// Fallback configuration in case the site config fails to load or is missing required fields.
// TODO: Maybe just fail in that case and not hard-code mastodon.social?
export const fallbackConfig: Config = {
    servers: ["mastodon.social"],
    tags: ["foss", "cats", "dogs"],
    accounts: [],
    limit: 20,
    interval: 10,
    theme: "light",
    info: "top",
}

// URL for a site-config file that overrides the default configuration above, if present.
export const siteConfigUrl = "wall-config.json"
