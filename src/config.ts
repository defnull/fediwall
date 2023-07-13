
import { arrayEquals } from "./utils";
import {fallbackConfig, siteConfigUrl} from "@/defaults";

export type Config = {
    server: string,
    tags: Array<string>,
    accounts: Array<string>,
    limit: number,
    interval: number,
    theme: string | "dark" | "light",
    info: string | "top" | "hide"
}

var siteConfig: Config | undefined | false;

export function fromQuery(query: string): Partial<Config> {
    const params = new URLSearchParams(query);
    return {
        server: params.get("server") || undefined,
        tags: params.get("tags")?.split(",").filter(a => a.replace(/(^#|\s+)/ig, "")) || undefined,
        accounts: params.get("accounts")?.split(",").filter(a => a.replace(/(^@|\s+)/ig, "")) || undefined,
        limit: parseInt(params.get("limit") || "0") || undefined,
        interval: parseInt(params.get("interval") || "0") || undefined,
        theme: params.get("theme") || undefined,
        info: params.get("info") || undefined,
    }
}

export function toQuery(config: Config): string {
    const params = new URLSearchParams();
    const defaults = siteConfig || fallbackConfig;
    if (config.server !== defaults.server) params.set("server", config.server)
    if (!arrayEquals(config.tags, defaults.tags)) params.set("tags", config.tags.join(","))
    if (!arrayEquals(config.accounts, defaults.accounts)) params.set("accounts", config.accounts.join(","))
    if (config.limit !== defaults.limit) params.set("limit", config.limit.toString())
    if (config.interval !== defaults.interval) params.set("interval", config.interval.toString())
    if (config.theme !== defaults.theme) params.set("theme", config.theme)
    if (config.info !== defaults.info) params.set("info", config.info)
    if (config.server !== defaults.server) params.set("server", config.server)
    return params.toString().replace(/%2C/g, ',')
}

function isTag(tag: string) {
    return tag.match(/^[a-z0-9]+$/i)
}

function isAccount(acc: string) {
    return acc.match(/^\b([A-Z0-9._%+-]+)(@([A-Z0-9.-]+\.[A-Z]{2,}))?\b$/i)
}

export function sanatizeConfig(config: Partial<Config>): Config {
    const defaults = (siteConfig || fallbackConfig)
    return {
        server: config.server?.replace(/(.*\/|[^a-z0-9.-]+)/i, '') || defaults.server,
        tags: Array.isArray(config.tags) ? [...config.tags].filter(isTag).sort() : [],
        accounts: Array.isArray(config.accounts) ? [...config.accounts].filter(isAccount).sort() : [],
        limit: Math.max(1, Math.min(100, config?.limit || 0)),
        interval: Math.max(1, Math.min(600, config?.interval || 0)),
        theme: config.theme?.replace(/[^a-z]+/i, '') || defaults.theme,
        info: config.info?.replace(/[^a-z]+/i, '') || defaults.info,
    }
}

export async function loadConfig() {
    if (siteConfig === undefined && siteConfigUrl) {
        try {
            siteConfig = sanatizeConfig(await (await fetch(siteConfigUrl)).json() || {})
        } catch (e) {
            siteConfig = false
            console.warn("Site config failed to load, falling back to hard-coded defaults!")
        }
    }

    const config: Partial<Config> = {... (siteConfig || fallbackConfig)};

    // Merge url parameters into site config, if present
    if (window.location.search) {
        const urlConfig = fromQuery(window.location.search.toString())
        for (const key in urlConfig) {
            // TODO: Fighting typescript here :/ I'm sure there is a better way
            const value = (urlConfig as any)[key];
            if (value !== undefined)
                (config as any)[key] = value
        }
    }

    return sanatizeConfig(config);
}