
import { arrayUnique, deepClone, isString } from "./utils";
import { fallbackConfig, siteConfigUrl } from "@/defaults";
import { type Config } from '@/types';



var siteConfig: Config | null = null;

const themes = ["dark", "light", "auto"];
const boolYes = ["", "y", "yes", "true"];
const boolNo = ["n", "no", "false"];

const fromBool = (value: string): boolean | undefined => {
    return boolYes.includes(value.toLowerCase())
}

const toBool = (value: boolean | undefined) => {
    return value ? boolYes[0] : boolNo[0]
}




/**
 * Parameter definition used to translate between url parameters and the
 * internal Config struct.
 */
type ParamDef = {
    // Parameter names and their aliases. Must be globally unique.
    names: string[]
    // Function to apply this parameter to an incomplete Config.
    from: (config: Partial<Config>, value: string) => any,
    // Function to get the parameter value from a populated Config.
    to: (config: Config) => string,
}

/**
 * All supported query parameters.
 */
const parameterDefinitions: Array<ParamDef> = [

    // Content

    {
        names: ["servers", "server", "s"],
        from: (config: Partial<Config>, value: string) => config.servers = value.split(","),
        to: (config: Config) => (config.servers || []).join(","),
    },
    {
        names: ["tags", "t"],
        from: (config: Partial<Config>, value: string) => config.tags = value.split(","),
        to: (config: Config) => (config.tags || []).join(","),
    },
    {
        names: ["accounts", "a"],
        from: (config: Partial<Config>, value: string) => config.accounts = value?.split(","),
        to: (config: Config) => (config.accounts || []).join(","),
    },
    {
        names: ["timelines", "tl"],
        from: (config: Partial<Config>, value: string) => {
            const flags = value.split(",")
            config.loadPublic = flags.includes("local")
            config.loadFederated = flags.includes("remote")
            config.loadTrends = flags.includes("trends")
        },
        to: (config: Config) => {
            const flags: string[] = []
            if (config.loadPublic) flags.push("local")
            if (config.loadFederated) flags.push("remote")
            if (config.loadTrends) flags.push("trends")
            return flags.join(",")
        },
    },

    // Filter options
    {
        names: ["no"],
        from: (config: Partial<Config>, value: string) => {
            const flags = value.split(",")
            config.hideSensitive = flags.includes("nsfw")
            config.hideReplies = flags.includes("replies")
            config.hideBoosts = flags.includes("boosts")
            config.hideBots = flags.includes("bots")
        },
        to: (config: Config) => {
            const flags: string[] = []
            if (config.hideSensitive) flags.push("nsfw")
            if (config.hideReplies) flags.push("replies")
            if (config.hideBoosts) flags.push("boosts")
            if (config.hideBots) flags.push("bots")
            return flags.join(",")
        },
    },
    {
        names: ["lang", "l"],
        from: (config: Partial<Config>, value: string) => config.languages = value.split(","),
        to: (config: Config) => (config.languages || []).join(","),
    },
    {
        names: ["block"],
        from: (config: Partial<Config>, value: string) => config.badWords = value.split(","),
        to: (config: Config) => (config.badWords || []).join(","),
    },

    {
        names: ["limit"],
        from: (config: Partial<Config>, value: string) => config.limit = parseInt(value),
        to: (config: Config) => config.limit.toString(),
    },
    {
        names: ["interval"],
        from: (config: Partial<Config>, value: string) => config.interval = parseInt(value),
        to: (config: Config) => config.interval.toString(),
    },
    {
        names: ["title"],
        from: (config: Partial<Config>, value: string) => config.title = value.trim(),
        to: (config: Config) => config.title,
    },
    {
        names: ["theme"],
        from: (config: Partial<Config>, value: string) => config.theme = value.trim(),
        to: (config: Config) => config.theme,
    },
    {
        names: ["info"],
        from: (config: Partial<Config>, value: string) => config.showInfobar = fromBool(value),
        to: (config: Config) => toBool(config.showInfobar),
    },
    {
        // yes = text+media
        // no = text
        // notext = media
        names: ["media"],
        from: (config: Partial<Config>, value: string) => {
            config.showText = ["yes", "no"].includes(value.trim().toLocaleLowerCase())
            config.showMedia = ["yes", "notext"].includes(value.trim().toLocaleLowerCase())
        },
        to: (config: Config) => {
            if (!config.showText)
                return "notext"
            if (!config.showMedia)
                return "no"
            return "yes"
        },
    },
    {
        names: ["autoplay", "play"],
        from: (config: Partial<Config>, value: string) => config.playVideos = fromBool(value),
        to: (config: Config) => toBool(config.playVideos),
    }]

if (import.meta.env.DEV) {
    parameterDefinitions.flatMap(p => p.names).filter((v, i, a) => {
        if (a.indexOf(v) !== i)
            throw new Error(`Parameter names not unique! ${v}`);
    });
}

export function fromQuery(query: string): Config {
    const params = new URLSearchParams(query);
    const config: Partial<Config> = {}

    // Keep URLs backwards compatible
    if (params.has("server")) {
        params.set("servers", params.get("server")!)
        params.delete("server")
    }
    if (params.get("info") === "top")
        params.set("info", boolYes[0])
    if (params.get("info") === "hide")
        params.set("info", boolNo[0])

    for (const { names, from } of parameterDefinitions) {
        const param = names.find(n => params.has(n))
        if (param === undefined) continue
        from(config, params.get(param) as string)
    }

    // Clean, fix and return a valid config
    return sanatizeConfig(config);
}

export function toQuery(config: Config): string {
    const params = new URLSearchParams();
    const defaults = siteConfig || fallbackConfig;

    for (const { names, to } of parameterDefinitions) {
        const value = to(config)
        if (value !== to(defaults))
            params.set(names[0], value)
    }

    return params.toString()
        .replace(/%2C/g, ',')
        .replace(/%40/g, '@')
        .replace(/=(&|$)/g, '') // a=&b= -> a&b
}

export function isTag(tag: any) {
    return isString(tag) && tag.match(/^[\p{Letter}\p{Number}\p{Mark}\p{Connector_Punctuation}_]+$/iu)
}

export function stripTag(tag: string) {
    const m = tag.match(/[\p{Letter}\p{Number}\p{Mark}\p{Connector_Punctuation}_]+/iu)
    return m ? m[0] : null;
}

export function isAccount(acc: string) {
    return isString(acc) && acc.match(/^([a-z0-9_]+)(@([a-z0-9.-]+\.[a-z]{2,}))?$/i)
}

export function isServer(server: string) {
    return isString(server) && server.match(/^([a-z0-9.-]+\.[a-z]{2,})$/i)
}

export function isLanguage(lang: string) {
    return isString(lang) && lang.match(/^[a-z]{2}$/i)
}

export function sanatizeConfig(config: any): Config {

    const boolOr = (value: any, fallback: boolean) => {
        if (typeof value == "boolean") return value;
        return fallback
    }

    const choice = <T, U>(choices: readonly T[], value: T, fallback: U): T | U => {
        return choices.includes(value) ? value : fallback;
    }

    const fallback = siteConfig || fallbackConfig;
    const result: Partial<Config> = {}

    result.servers = arrayUnique((Array.isArray(config.servers) ? [...config.servers] : [...fallback.servers]).filter(isServer));
    result.tags = arrayUnique((Array.isArray(config.tags) ? [...config.tags] : [...fallback.tags]).map(stripTag).filter(isTag).sort() as string[]);
    result.accounts = arrayUnique((Array.isArray(config.accounts) ? [...config.accounts] : [...fallback.accounts]).filter(isAccount).sort());

    result.loadFederated = boolOr(config.loadFederated, fallback.loadFederated)
    result.loadPublic = boolOr(config.loadPublic, fallback.loadPublic)
    result.loadTrends = boolOr(config.loadTrends, fallback.loadTrends)

    result.languages = arrayUnique((Array.isArray(config.languages) ? [...config.languages] : [...fallback.languages]).filter(isLanguage));
    result.badWords = arrayUnique((Array.isArray(config.badWords) ? [...config.badWords] : [...fallback.badWords]).filter(isTag));
    result.hideSensitive = boolOr(config.hideNsfw, fallback.hideSensitive)
    result.hideBoosts = boolOr(config.hideBoosts, fallback.hideBoosts)
    result.hideBots = boolOr(config.hideBots, fallback.hideBots)
    result.hideReplies = boolOr(config.hideReplies, fallback.hideReplies)

    result.limit = Math.max(1, Math.min(100, config?.limit || fallback.limit))
    result.interval = Math.max(1, Math.min(600, config?.interval || fallback.interval))

    result.title = config?.title || fallback.title
    result.theme = choice(themes, config.theme, fallback.theme)
    result.showInfobar = boolOr(config.showInfo, fallback.showInfobar)
    result.showText = boolOr(config.showText, fallback.showText)
    result.showMedia = boolOr(config.showMedia, fallback.showMedia)
    result.playVideos = boolOr(config.playVideos, fallback.playVideos)
    if (result.playVideos)
        result.showMedia = true
    if (!result.showMedia)
        result.playVideos = false
    if (!result.showMedia && !result.showText)
        result.showText = true

    return result as Config;
}

async function loadSideConfig() {
    var config;

    try {
        config = await (await fetch(siteConfigUrl)).json() || {};
    } catch (e) {
        console.warn("Site config failed to load, falling back to hard-coded defaults!")
        return;
    }

    // Migrate old configuration within same minor release
    if (isString(config.server)) {
        console.warn("DEPRECATED: Config parameter 'server' is now an array and called 'servers'.");
        (config.servers ??= []).push(config.server);
    }
    if (isString(config.info))
        config.showinfo = config.info == "top"

    return sanatizeConfig(config)
}

export async function loadConfig() {
    if (!siteConfig && siteConfigUrl)
        siteConfig = await loadSideConfig() || null
    if (!siteConfig)
        siteConfig = sanatizeConfig(deepClone(fallbackConfig))

    if (window.location.search)
        return fromQuery(window.location.search)

    return deepClone({ ...siteConfig })
}