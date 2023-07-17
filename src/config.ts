
import { arrayEquals, deepClone, isString } from "./utils";
import { fallbackConfig, siteConfigUrl } from "@/defaults";

export type Config = {
    servers: Array<string>,
    tags: Array<string>,
    accounts: Array<string>,
    limit: number,
    interval: number,
    theme: string,
    info: string,
}

var siteConfig: Config = null;

const themes = ["dark", "light"] as const;
const infoLineModes = ["top", "hide"] as const;

const choice = <T>(choices: readonly T[], value?: T, fallback?: T): T => {
    return choices.includes(value) ? value : fallback;
}

export function fromQuery(query: string): Config {
    const params = new URLSearchParams(query);
    const config: Partial<Config> = {}
    // Keep URLs backwards compatible
    if (params.has("server"))
        params.set("servers", params.get("server"))
    // Parse URL parameters very roughly
    config.servers = params.get("servers")?.split(",")
    config.tags = params.get("tags")?.split(",")
    config.accounts = params.get("accounts")?.split(",")
    config.limit = parseInt(params.get("limit") || "0")
    config.interval = parseInt(params.get("interval") || "0")
    config.theme = params.get("theme")
    config.info = params.get("info")
    // Clean, fix and return a valid config
    return sanatizeConfig(config);
}

export function toQuery(config: Config): string {
    const params = new URLSearchParams();
    const defaults = siteConfig || fallbackConfig;
    if (!arrayEquals(config.servers, defaults.servers))
        params.set("servers", config.servers.join(","))
    if (!arrayEquals(config.tags, defaults.tags))
        params.set("tags", config.tags.join(","))
    if (!arrayEquals(config.accounts, defaults.accounts))
        params.set("accounts", config.accounts.join(","))
    if (config.limit !== defaults.limit)
        params.set("limit", config.limit.toString())
    if (config.interval !== defaults.interval)
        params.set("interval", config.interval.toString())
    if (config.theme !== defaults.theme)
        params.set("theme", config.theme)
    if (config.info !== defaults.info)
        params.set("info", config.info)
    return params.toString().replace(/%2C/g, ',').replace(/%40/g, '@')
}

export function isTag(tag: string) {
    return isString(tag) && tag.match(/^[\p{Letter}\p{Number}\p{Mark}\p{Connector_Punctuation}_]+$/iu)
}

export function isAccount(acc: string) {
    return isString(acc) && acc.match(/^([a-z0-9_]+)(@([a-z0-9.-]+\.[a-z]{2,}))?$/i)
}

export function isServer(server: string) {
    return isString(server) && server.match(/^([a-z0-9.-]+\.[a-z]{2,})$/i)
}

export function sanatizeConfig(config: any): Config {

    // Migrate old configuration within same minor release
    if (isString(config.server) && !config.servers) {
        console.warn("DEPRECATED: Config parameter 'server' is now an array and called 'servers'.")
        config.servers = [config.server]
    }

    const defaults = siteConfig ? siteConfig : fallbackConfig;
    const result: Partial<Config> = {}

    result.servers = Array.isArray(config.servers) ? [...config.servers].filter(isServer).sort() : [...defaults.servers];
    result.tags = Array.isArray(config.tags) ? [...config.tags].filter(isTag).sort() : [...defaults.tags]
    result.accounts = Array.isArray(config.accounts) ? [...config.accounts].filter(isAccount).sort() : [...defaults.accounts]
    result.limit = Math.max(1, Math.min(100, config?.limit || defaults.limit))
    result.interval = Math.max(1, Math.min(600, config?.interval || defaults.interval))
    result.theme = choice(themes, config.theme, defaults.theme)
    result.info = choice(infoLineModes, config.info, defaults.info)

    return result as Config;
}

export async function loadConfig() {
    if (siteConfig === null && siteConfigUrl) {
        try {
            siteConfig = sanatizeConfig(await (await fetch(siteConfigUrl)).json() || {})
        } catch (e) {
            console.warn("Site config failed to load, falling back to hard-coded defaults!")
        }
    }

    if (siteConfig === null)
        siteConfig = sanatizeConfig(deepClone(fallbackConfig))

    if (window.location.search)
        return fromQuery(window.location.search)

    return deepClone({ ... (siteConfig || fallbackConfig) })
}