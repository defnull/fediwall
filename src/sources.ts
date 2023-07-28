import type { Config, MastodonAccount, MastodonStatus, Post, PostMedia } from "@/types";
import { regexEscape } from "@/utils";


/**
 * Fetch unique posts from all sources (curently only Mastodon is implemented)
 */
export async function fetchPosts(cfg: Config): Promise<Post[]> {
    type Task = () => Promise<MastodonStatus[]>;

    // Group tasks by domain (see below)
    const domainTasks: Record<string, Array<Task>> = {}
    const addTask = (domain: string, task: Task) => {
        (domainTasks[domain] ??= []).push(task)
    }

    // Load tags from all servers
    for (const domain of cfg.servers) {
        for (const tag of cfg.tags) {
            addTask(domain, async () => {
                return await fetchJson(domain, `api/v1/timelines/tag/${encodeURIComponent(tag)}`, { limit: cfg.limit.toString() })
            })
        }
    }

    // Load account timelines from the home server of the account, or all servers
    // if the account is not fully qualified (missing domain part).
    for (const account of cfg.accounts) {
        const [user, domain] = account.split('@', 2)
        const domains = domain ? [domain] : [...cfg.servers]
        for (const domain of domains) {
            addTask(domain, async () => {
                const localUser = await getLocalUser(user, domain)
                if (!localUser || !localUser.id) return [];
                if (localUser.bot && cfg.hideBots && cfg.hideBoosts) return [];

                const query: Record<string, any> = { limit: cfg.limit }
                if (cfg.hideReplies) query.exclude_replies = "True"
                if (cfg.hideBoosts) query.exclude_reblogs = "True"
                return await fetchJson(domain, `api/v1/accounts/${encodeURIComponent(localUser.id)}/statuses`, query)
            })
        }
    }

    // Load trends from all servers
    if (cfg.loadTrends) {
        for (const domain of cfg.servers) {
            addTask(domain, async () => {
                return await fetchJson(domain, "api/v1/trends/statuses", { limit: cfg.limit })
            })
        }
    }

    // Load public timeline from all servers, optionally limited to just local
    // or just federated posts.
    if (cfg.loadPublic || cfg.loadFederated) {
        for (const domain of cfg.servers) {
            const query: Record<string, any> = { limit: cfg.limit }
            if (!cfg.loadPublic) query.remote = "True"
            if (!cfg.loadFederated) query.local = "True"
            addTask(domain, async () => {
                return await fetchJson(domain, "api/v1/timelines/public", query)
            })
        }
    }

    // Collect results
    const posts: Post[] = []
    const addOrRepacePost = (post: Post) => {
        const i = posts.findIndex(p => p.id === post.id)
        if (i >= 0)
            posts[i] = post
        else
            posts.unshift(post)
    }

    // Be nice and not overwhelm servers with parallel requests.
    // Run tasks for the same domain in sequence instead.
    const groupedTasks = Object.entries(domainTasks)
        .map(([domain, tasks]) => {
            return async () => {
                for (const task of tasks) {
                    try {
                        (await task())
                            .filter(status => filterStatus(cfg, status))
                            .map(statusToWallPost)
                            .forEach(addOrRepacePost)
                    } catch (err) {
                        console.warn(`Update task failed for domain ${domain}`, err)
                    }
                }
            }
        })

    // Start all the domain-grouped tasks in parallel, so reach server can be
    // processed as fast as its rate-limit allows.
    // TODO: Add a timeout
    await Promise.allSettled(groupedTasks.map(task => task()))

    // Done. Return collected posts
    return posts
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
            accountCache[key] = (await fetchJson(domain, "v1/accounts/lookup", { acct: user })) as MastodonAccount
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
    let rs = await fetch(url)

    // Auto-retry rate limit errors
    let errCount = 0
    while (!rs.ok) {
        if (errCount++ > 3)
            break // Do not retry anymore

        if (rs.headers.get("X-RateLimit-Remaining") === "0") {
            const resetTime = new Date(rs.headers.get("X-RateLimit-Reset") || (new Date().getTime() + 10000)).getTime();
            const referenceTime = new Date(rs.headers.get("Date") || new Date()).getTime();
            const sleep = Math.max(0, resetTime - referenceTime) + 1000 // 1 second leeway
            await new Promise(resolve => setTimeout(resolve, sleep));
        } else {
            break // Do not retry
        }

        // Retry
        rs = await fetch(url)
    }

    const json = await rs.json()
    if (json.error) {
        console.warn(`Fetch error: ${rs.status} ${JSON.stringify(json)}`)
        const err = new Error(json.error);
        (err as any).status = rs.status;
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
        const pattern = new RegExp(`\\b(${cfg.badWords.map(regexEscape).join("|")})\\b`, 'i');
        if (status.tags?.find((tag: any) => cfg.badWords.includes(tag.name))
            || status.content.match(pattern)
            || status.spoiler_text?.match(pattern)
            || status.media_attachments?.find(media => media.description?.match(pattern)))
            return false;
    }

    // Skip posts that would show up empty
    if (!cfg.showText && !status.media_attachments?.length) return false;
    if (!cfg.showMedia && !status.content.trim()) return false;

    // Accept anything else
    return true;
}

/**
 * Convert a mastdon status object to a Post.
 */
const statusToWallPost = (status: MastodonStatus): Post => {
    const date = status.created_at

    if (status.reblog)
        status = status.reblog

    const media = status.media_attachments?.map((m): PostMedia | undefined => {
        switch (m.type) {
            case "image":
                return { type: "image", url: m.url, preview: m.preview_url, alt: m.description ?? undefined }
            case "video":
            case "gifv":
                return { type: "video", url: m.url, preview: m.preview_url, alt: m.description ?? undefined }
            case "audio":
            case "unknown":
                return
        }
    }).filter((m): m is PostMedia => m !== undefined)

    return {
        id: status.uri,
        url: status.url || status.uri,
        author: {
            name: status.account.display_name || status.account.username,
            url: status.account.url,
            avatar: status.account.avatar,
        },
        content: status.content,
        date,
        media,
    }
}
