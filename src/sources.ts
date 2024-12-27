import type { Config, MastodonAccount, MastodonStatus, Post, PostMedia } from "@/types";
import { notBlank, regexEscape, sleep } from "@/utils";
import { replaceInText } from '@/utils'
import DOMPurify from 'dompurify'

/**
 * Fetch unique posts from all sources (currently only Mastodon is implemented)
 */
export type Progress = {
    total: number
    started: number
    finished: number
    errors: Error[]
    posts: Post[]
}

export async function fetchPosts(cfg: Config, onProgress: (progress: Progress) => void): Promise<Post[]> {

    type Task = () => Promise<MastodonStatus[]>;
    let progress: Progress = {total: 0, started: 0, finished: 0, errors: [], posts: []}

    // Group tasks by domain (see below)
    const domainTasks: Record<string, Array<Task>> = {}
    const addTask = (domain: string, task: Task) => {
        progress.total += 1;
        (domainTasks[domain] ??= []).push(task)
    }

    // Load tags from all servers
    for (const domain of cfg.servers) {
        const query: Record<string, any> = { limit: cfg.limit }
        if (cfg.badWords.length) query.none = cfg.badWords.join(",")
        if (!cfg.showText) query.only_media = "True"
        for (const tag of cfg.tags) {
            addTask(domain, async () => {
                return await fetchJson(domain, `api/v1/timelines/tag/${encodeURIComponent(tag)}`, query)
            })
        }
    }

    // Load account timelines from the home server of the account, or all servers
    // if the account is not fully qualified (missing domain part).
    for (const account of cfg.accounts) {
        const [user, domain] = account.split('@', 2)
        const domains = domain ? [domain] : [...cfg.servers]
        for (const domain of domains) {
            if(domain === "fedi.buzz") continue
            addTask(domain, async () => {
                const localUser = await getLocalUser(user, domain)
                if (!localUser || !localUser.id) return [];
                if (localUser.bot && cfg.hideBots && cfg.hideBoosts) return [];

                const query: Record<string, any> = { limit: cfg.limit }
                if (cfg.hideReplies) query.exclude_replies = "True"
                if (cfg.hideBoosts) query.exclude_reblogs = "True"
                if (!cfg.showText) query.only_media = "True"
                return await fetchJson(domain, `api/v1/accounts/${encodeURIComponent(localUser.id)}/statuses`, query)
            })
        }
    }

    // Load trends from all servers
    if (cfg.loadTrends) {
        for (const domain of cfg.servers) {
            if(domain === "fedi.buzz") continue
            addTask(domain, async () => {
                return await fetchJson(domain, "api/v1/trends/statuses", { limit: cfg.limit })
            })
        }
    }

    // Load public timeline from all servers, optionally limited to just local
    // or just federated posts.
    if (cfg.loadPublic || cfg.loadFederated) {
        for (const domain of cfg.servers) {
            if(domain === "fedi.buzz") continue
            const query: Record<string, any> = { limit: cfg.limit }
            if (!cfg.loadPublic) query.remote = "True"
            if (!cfg.loadFederated) query.local = "True"
            if (!cfg.showText) query.only_media = "True"
            addTask(domain, async () => {
                return await fetchJson(domain, "api/v1/timelines/public", query)
            })
        }
    }

    // Collect results
    const addOrReplacePost = (post: Post) => {
        const posts = progress.posts;
        const i = posts.findIndex(p => p.id === post.id)
        if(i < 0) {
            // Add new posts to the end of the list
            posts.unshift(post)
        } else if (posts[i].date < post.date) {
            // If there are two posts with the same ID, keep the more recent one.
            // This is so that posts appear more recent if they are boosted.
            posts[i] = post
        }
    }

    const fixLocalAcct = (domain: string, status: MastodonStatus): MastodonStatus => {
        if (!status.account.acct.includes('@'))
            status.account.acct += "@" + domain
        return status
    }

    // Be nice and not overwhelm servers with parallel requests.
    // Run tasks for the same domain in sequence instead, and wait between
    // requests for a small random amount of time.
    const groupedTasks = Object.entries(domainTasks)
        .map(([domain, tasks]) => {
            return async () => {
                for (const [taskIndex, task] of tasks.entries()) {
                    await sleep(Math.min(500, Math.random() * 100 * taskIndex))
                    progress.started += 1;
                    try {
                        (await task())
                            .map(status => fixLocalAcct(domain, status))
                            .filter(status => filterStatus(cfg, status))
                            .map(status => statusToWallPost(cfg, status))
                            .forEach(addOrReplacePost)
                    } catch (err: any) {
                        let error = err instanceof Error ? err : new Error(err?.toString())
                        progress.errors.push(error)
                    } finally {
                        progress.finished += 1
                        onProgress(progress)
                    }
                }
            }
        })

    // Start all the domain-grouped tasks in parallel, so reach server can be
    // processed as fast as its rate-limit allows.
    // TODO: Add a timeout
    await Promise.allSettled(groupedTasks.map(task => task()))

    // Done. Return collected posts
    return progress.posts
}

/**
 * Returns the instance-local account for a given user name.
 * Results are cached. Returns null if not found, or undefined on errors.
 */
const accountCache: Record<string, MastodonAccount | null> = {}
async function getLocalUser(user: string, domain: string): Promise<any> {
    const key = `${user}@${domain}`

    if (!Object.hasOwnProperty.call(accountCache, key)) {
        try {
            accountCache[key] = (await fetchJson(domain, "api/v1/accounts/lookup", { acct: user })) as MastodonAccount
        } catch (e) {
            if ((e as any).status === 404)
                accountCache[key] = null;
        }
    }
    return accountCache[key]
}


/**
 * Fetch a json resources from a given URL.
 * Automaticaly detect mastodon rate limits and wait and retry up to 3 times.
 */
async function fetchJson(domain: string, path: string, query?: Record<string, any>) {
    let url = `https://${domain}/${path}`
    if (query && Object.keys(query).length) {
        const pairs = Object.entries(query).map(([key, value]) => [key, value.toString()])
        url += "?" + new URLSearchParams(pairs).toString()
    }

    let rs: Response;
    let json: any;

    try {
        rs = await fetch(url)

        // Auto-retry rate limit errors
        let errCount = 0
        while (!rs.ok) {
            if (errCount++ > 3)
                break // Do not retry anymore

            if (rs.headers.get("X-RateLimit-Remaining") === "0") {
                const resetTime = new Date(rs.headers.get("X-RateLimit-Reset") || (new Date().getTime() + 10000)).getTime();
                const referenceTime = new Date(rs.headers.get("Date") || new Date()).getTime();
                await sleep(resetTime - referenceTime + 1000) // 1 second leeway
            } else {
                break // Do not retry
            }

            // Retry
            rs = await fetch(url)
        }
        json = await rs.json()
    } catch (e: any) {
        throw new Error(`Failed to fetch ${url} (${e.message || e})`);
    }

    if (!rs.ok || json.error) {
        const err = new Error(`Failed to fetch ${url} (${rs.status}: ${json.error || "Unknown reason"})`);
        (err as any).status = rs.status;
        (err as any).body = json;
        throw err;
    }

    return json
}

/**
 * Check if a mastodon status document should be accepted
 */
const filterStatus = (cfg: Config, status: MastodonStatus) => {
    // Boosts are unwrapped so other filters check the actual status that is
    // going to be displayed, not the (mostly empty) boost-status.
    if (status.reblog) {
        if (cfg.hideBoosts) return false;
        status = status.reblog
    }

    // These filters are always active
    if (status.visibility !== "public") return false;
    if (status.account?.suspended) return false;
    if (status.account?.limited) return false;

    // Optional filters
    if (cfg.languages.length > 0
        && !cfg.languages.includes(status.language || "en")) return false;
    if (cfg.hideSensitive && status.sensitive) return false;
    if (cfg.hideReplies && status.in_reply_to_id) return false;
    if (cfg.hideBots && status.account?.bot) return false;
    if (cfg.badWords.length) {
        const pattern = new RegExp(`(?:\\b|^)(${cfg.badWords.map(regexEscape).join("|")})(?:\\b|$)`, 'i');
        if (status.account?.display_name?.match(pattern)
            || status.account?.acct?.match(pattern)
            || status.content.match(pattern)
            || status.spoiler_text?.match(pattern)
            || status.tags?.some(tag => `#${tag.name}`.match(pattern))
            || status.media_attachments?.some(media => media.description?.match(pattern)))
            return false;
    }

    // Skip posts that would show up empty
    if (!cfg.showText && findMedia(status).length == 0) return false;
    if (!cfg.showMedia && !status.content.trim()) return false;

    // Accept anything else
    return true;
}

function findMedia(status: MastodonStatus) {
    const media: PostMedia[] = []
    
    status.media_attachments?.map((m): PostMedia | undefined => {
        const url = m.url;
        const alt = m.description ?? undefined
        const preview = m.preview_url ?? undefined
        switch (m.type) {
            case "image":
                return { type: "image", url, preview, alt }
            case "video":
            case "gifv":
                return { type: "video", url, preview, alt }
            case "audio":
            case "unknown":
                return
        }
    }).filter(m=>!!m).forEach(m=>media.push(m))

    // Fall back to preview card images if no media is attached (e.g. for peertube posts)
    if(media.length == 0 && status.card) {
        const card = status.card
        if(notBlank(card.image) && notBlank(card.url))
            media.push({type:"card", url: card.url, preview:card.image, alt: status.card.description})    
    }

    return media
}

/**
 * Convert a mastodon status object to a Post.
 */
const statusToWallPost = (cfg: Config, status: MastodonStatus): Post => {
    const date = new Date(status.created_at)

    if (status.reblog)
        status = status.reblog

    const animate = cfg.playVideos;
    const emojiPattern = /(?<=[^a-z0-9:]|^):([a-z0-9_]{2,}):(?=[^a-z0-9:]|$)/igmu
    const replaceEmojis = (content: string, emojiMeta: Array<any>) => {
        content = DOMPurify.sanitize(content)

        if (emojiMeta.length) {
            var tmpNode = document.createElement("div");
            tmpNode.innerHTML = content
            replaceInText(tmpNode, emojiPattern, m => {
                const code = m[1];
                const hit = emojiMeta.find(e => e.shortcode === code)
                if (!hit || !hit.url) return m[0]
                const img = document.createElement("img")
                img.src = animate ? hit.url : hit.static_url || hit.url
                img.classList.add("emoji")
                img.alt = img.title = `:${code}:`
                return img;
            })
            content = tmpNode.innerHTML
        }

        return content
    }

    const name = status.account.display_name
        ? replaceEmojis(status.account.display_name, status.account.emojis)
        : status.account.username
    const profile = status.account.acct
    const content = replaceEmojis(status.content, status.emojis)

    const media = findMedia(status)

    return {
        id: status.uri,
        url: status.url || status.uri,
        author: {
            name,
            profile,
            url: status.account.url,
            avatar: status.account.avatar,
        },
        content,
        date,
        media,
    }
}
