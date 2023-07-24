
import {type Config} from '@/types';

// Fallback configuration in case the site config fails to load or is missing required fields.
// TODO: Maybe just fail in that case and not hard-code mastodon.social?
export const fallbackConfig: Config = {
    servers: ["mastodon.social"],
    tags: ["foss", "cats", "dogs"],
    accounts: [],

    loadPublic: false,
    loadFederated: false,
    loadTrends: false,

    languages: [], // empty = do not filter based on language
    badWords: [],
    hideSensitive: true,
    hideBots: true,
    hideReplies: true,
    hideBoosts: false,

    limit: 20,
    interval: 10,

    title: "Fediwall",
    theme: "auto",
    showInfobar: true,
    showText: true,
    showMedia: true,
    playVideos: true,
}

// URL for a site-config file that overrides the default configuration above, if present.
export const siteConfigUrl = "wall-config.json"

export const gitVersion = __VERSION__ || undefined;
