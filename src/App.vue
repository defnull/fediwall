<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue';
import Card, { type Post } from './components/Card.vue';
import { useDocumentVisibility, usePreferredDark, useWindowSize, watchDebounced } from '@vueuse/core'
import ConfigModal from './components/ConfigModal.vue';
import { loadConfig, type Config } from './config';
import InfoBar from './components/InfoBar.vue';
import { gitVersion } from '@/defaults'
import { regexEscape } from '@/utils'

const config = ref<Config>();

const allPosts = ref<Array<Post>>([])
const pinned = ref<Array<string>>([])
const hidden = ref<Array<string>>([])
const banned = ref<Array<string>>([])
const updateInProgress = ref(false)

const accountToLocalId: Record<string, string | null> = {}
var updateIntervalHandle: number;
var lastUpdate = 0;

onMounted(async () => {
  config.value = await loadConfig()
  if (visibilityState.value !== "hidden")
    restartUpdates()
})

onBeforeUnmount(() => {
  stopUpdates()
})

// Re-layout Masonry on dom updates or window size changes
const fixLayout = inject('redrawVueMasonry') as () => void
onUpdated(() => fixLayout())
const windowSize = useWindowSize()
watchDebounced(windowSize.width, () => { fixLayout() }, { debounce: 500, maxWait: 1000 })

// Watch for a theme changes
const isDartPrefered = usePreferredDark()
const actualTheme = computed(() => {
  var theme = config.value?.theme
  if (!theme || theme === "auto")
    theme = isDartPrefered.value ? "dark" : "light"
  return theme
})
watch(actualTheme, () => {
  document.body!.parentElement!.dataset.bsTheme = actualTheme.value
})

// Watch for a update interval changes
watch(() => config.value?.interval, () => restartUpdates())

// Pause updates while tab/window is hidden
const visibilityState = useDocumentVisibility()
watch(visibilityState, () => {
  if (visibilityState.value === "hidden")
    stopUpdates()
  else
    restartUpdates()
})

/**
 * Fetch a json resources from a given URL.
 * Automaticaly detect mastodon rate limits and wait and retry up to 3 times.
 */
async function fetchJson(url: string) {
  var rs = await fetch(url)

  // Auto-retry rate limit errors
  var errCount = 0
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
 * Returns the instance-local account ID for a given user name.
 * Results are cached. Returns null if not found, or undefined on errors.
 */
async function getLocalUser(user: string, domain: string): Promise<any> {
  const key = `${user}@${domain}`

  if (!accountToLocalId.hasOwnProperty(key)) {
    try {
      accountToLocalId[key] = (await fetchJson(`https://${domain}/api/v1/accounts/lookup?acct=${encodeURIComponent(user)}`))
    } catch (e) {
      if ((e as any).status === 404)
        accountToLocalId[key] = null;
    }
  }
  return accountToLocalId[key]
}

/**
 * Check if a mastodon status document should be accepted
 */
const filterStatus = (status: any) => {
  const cfg = config.value
  if (!cfg) return false;

  // Filter reblogs?
  if (cfg.hideBoosts && status.reblog) return false;

  // Unwrap boosts here so the other filters are checked against the status that
  // is going to be displayed, not just the boost-status.
  if (status.reblog)
    status = status.reblog

  // Filter by language
  if (cfg.languages.length > 0
    && !cfg.languages.includes(status.language || "en")) return false;
  // Filter sensitive content?
  if (cfg.hideSensitive && status.sensitive) return false;
  // Filter replies?
  if (cfg.hideReplies && status.in_reply_to_id) return false;
  // Filter bots?
  if (cfg.hideBots && status.account?.bot) return false;
  // Filter bad hashtags or words
  if (cfg.badWords.length) {
    const pattern = new RegExp(`\\b(${cfg.badWords.map(regexEscape).join("|")})\\b`, 'i');
    if (status.tags?.find((tag: any) => cfg.badWords.includes(tag.name)))
      return false;
    if (status.content.match(pattern))
      return false;
  }

  // Filter non-public content
  if (status.visibility !== "public") return false;
  // Filter limited or suspended accounts
  if (status.account?.suspended) return false;
  if (status.account?.limted) return false;

  // Accept anything else
  return true;
}

/**
 * Convert a mastdon status object to a Post.
 */
const statusToWallPost = (status: any): Post => {
  var date = status.created_at

  if (status.reblog)
    status = status.reblog

  var media;
  const image = status.media_attachments?.find((m: any) => m.type == "image")
  if (image)
    media = image.url

  return {
    id: status.id,
    url: status.url,
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

/**
 * Fetch Posts from all sources.
 */
async function fetchAllPosts() {
  const cfg = config.value
  if (!cfg) return []

  type Task = () => Promise<any[]>;

  // Group tasks by domain (see below)
  const domainTasks: Record<string, Array<Task>> = {}
  const addTask = (domain: string, task: Task) => {
    (domainTasks[domain] ??= []).push(task)
  }

  // Load tags from all servers
  for (const domain of cfg.servers) {
    for (const tag of cfg.tags) {
      addTask(domain, () => {
        return fetchJson(`https://${domain}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${cfg.limit}`)
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

        let url = `https://${domain}/api/v1/accounts/${encodeURIComponent(localUser.id)}/statuses?limit=${cfg.limit}`
        if (cfg.hideReplies) url += "&exclude_replies=True"
        if (cfg.hideBoosts) url += "&exclude_reblogs=True"
        return await fetchJson(url)
      })
    }
  }

  // Load trends from all servers
  if (cfg.loadTrends) {
    for (const domain of cfg.servers) {
      addTask(domain, async () => {
        return await fetchJson(`https://${domain}/api/v1/trends/statuses?limit=${cfg.limit}`)
      })
    }
  }

  // Load public timeline from all servers, optionally limited to just local
  // or just federated posts.
  if (cfg.loadPublic || cfg.loadFederated) {
    for (const domain of cfg.servers) {
      let url = `https://${domain}/api/v1/timelines/public`
      if (!cfg.loadPublic)
        url += "?remote=True"
      if (!cfg.loadFederated)
        url += "?local=True"
      addTask(domain, async () => {
        return await fetchJson(url)
      })
    }
  }

  // Collect results
  const posts: Post[] = []
  const addOrRepaceStatus = (status: any) => {
    if (!status || !filterStatus(status)) return;
    const post = statusToWallPost(status)
    const i = posts.findIndex(p => p.url === post.url)
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
            (await task()).forEach(addOrRepaceStatus)
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
 * Starts or restarts the update interval timer.
 */
const restartUpdates = () => {
  stopUpdates()
  if (!config.value) return

  // Mastodon default rate limit is 1/s (300/5m)
  // Be nice, only send one request every 2 seconds on average.
  const rqPerUpdate = config.value.accounts.length + config.value.tags.length
  const minInternal = Math.ceil(rqPerUpdate * 2)
  const interval = Math.max(minInternal, config.value.interval)

  updateIntervalHandle = setInterval(() => {
    updateWall()
  }, interval * 1000)

  // Trigger update immediately if new interval allows it
  if (lastUpdate + interval < new Date().getTime())
    updateWall()
}

/**
 * Stops the update interval
 */
const stopUpdates = () => {
  clearInterval(updateIntervalHandle)
}

/**
 * Trigger a wall update.
 * 
 * Does nothing if there is an update running already.
 */
async function updateWall() {
  const cfg = config.value
  if (!cfg) return

  if (updateInProgress.value) {
    console.debug("Wall update skipped: Already in progress")
    return
  }

  console.debug("Updating wall...")
  updateInProgress.value = true

  try {
    allPosts.value = await fetchAllPosts()
    console.debug("Update completed")
  } catch (e) {
    console.warn("Update failed", e)
  } finally {
    lastUpdate = Date.now()
    updateInProgress.value = false;
  }

}

const filteredPosts = computed(() => {
  // copy to make sure those are detected as a reactive dependency
  var posts: Array<Post> = JSON.parse(JSON.stringify(allPosts.value))
  const pinnedLocal = [...pinned.value]
  const hiddenLocal = [...hidden.value]
  const bannedLocal = [...banned.value]

  // Filter hidden posts or banned authors
  posts = posts.filter((p) => !hiddenLocal.includes(p.id))
  posts = posts.filter((p) => !p.author?.url || !bannedLocal.includes(p.author.url))

  // Mark pinned posts
  posts.forEach(p => { p.pinned = pinnedLocal.includes(p.id) })

  // Sort by pinned status / date
  posts = posts.sort((a, b) => {
    const aPinned = a.pinned ? 1 : 0
    const bPinned = b.pinned ? 1 : 0
    return bPinned - aPinned || new Date(b.date).getTime() - new Date(a.date).getTime()
  })
  return posts
})


function toggle<T>(array: T[], value: T) {
  if (array.includes(value))
    array.splice(array.indexOf(value), 1)
  else
    array.push(value)
}

const pin = (id: string) => {
  toggle(pinned.value, id)
}

const hide = (id: string) => {
  toggle(hidden.value, id)
}

const hideAuthor = (url: string) => {
  toggle(banned.value, url)
}

const toggleTheme = () => {
  if (!config.value) return
  config.value.theme = actualTheme.value === "dark" ? "light" : "dark"
}

const aboutLink = computed(() => {
  if (config.value?.servers.length)
    return `https://${config.value.servers[0]}/about`
  return "#"
})

const privacyLink = computed(() => {
  if (config.value?.servers.length)
    return `https://${config.value.servers[0]}/privacy-policy`
  return "#"
})

</script>

<template>
  <div id="page">
    <span v-show="updateInProgress" class="position-fixed bottom-0 start-0 m-1 opacity-25 text-muted">♥</span>
    <header v-if="config?.showInfobar">
      <InfoBar :config="config" class="secret-hover">
        <small class="text-secondary secret float-end">
          [<a href="#" class="text-secondary" data-bs-toggle="modal" data-bs-target="#configModal">edit</a>]
        </small>
      </InfoBar>
    </header>

    <main>
      <div v-if="filteredPosts.length === 0 && updateInProgress">Loading first posts ...</div>
      <div v-else-if="filteredPosts.length === 0">Nothing there yet ...</div>
      <div v-else v-masonry transition-duration="1s" item-selector=".wall-item" percent-position="true" id="wall">
        <Card v-masonry-tile class="wall-item secret-hover" v-for="(post, index) in filteredPosts" :key="post.id"
          :post="post">
          <template v-slot:topleft>
            <div class="dropdown secret">
              <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown"
                aria-expanded="false">...</button>
              <ul class="dropdown-menu">
                <li><a class="dropdown-item" href="#" @click.prevent="pin(post.id)">{{ post.pinned ? "Unpin" : "Pin"
                }}</a></li>
                <li><a class="dropdown-item" href="#" @click.prevent="hide(post.id)">Hide Post</a></li>
                <li v-if="post.author?.url"><a class="dropdown-item" href="#"
                    @click.prevent="hideAuthor(post.author?.url)">Hide
                    Author</a></li>
              </ul>
            </div>
          </template>
        </Card>
      </div>
    </main>

    <ConfigModal v-if="config" v-model="config" id="configModal" />

    <footer>
      <button class="btn btn-link text-muted" @click="toggleTheme(); false">[{{ actualTheme == "dark" ? "Light" : "Dark"
      }} mode]</button>
      <button class="btn btn-link text-muted" data-bs-toggle="modal" data-bs-target="#configModal">[Customize]</button>
      <div>
        <a href="https://github.com/defnull/fediwall" target="_blank" class="mx-1 text-muted">Fediwall <span
            v-if="gitVersion">{{ gitVersion }}</span></a>
        - <a href="https://github.com/defnull/fediwall" target="_blank" class="mx-1">Github</a>
        - <a href="https://github.com/defnull/fediwall#readme" target="_blank" class="mx-1">Documentation</a>
        - <a :href="privacyLink" target="_blank" class="mx-1">Privacy policy</a>
      </div>
    </footer>
  </div>
</template>

<style>
body {
  background-color: var(--bs-dark-bg-subtle)
}

#page {
  margin: 0;
}

#page a,
#page button.btn-link {
  text-decoration: none;
}

#page main {
  margin: 1rem 2rem;
}

.secret-hover .secret {
  visibility: hidden;
}

.secret-hover:hover .secret {
  visibility: visible;
}

#page header {
  padding: .5em 1em;
  font-size: 1.2em;
  display: block;
  width: 100%;
  text-align: center;
  background-color: var(--bs-light-bg-subtle);
}

#page footer {
  padding: 1em;
  display: block;
  width: 100%;
  text-align: center;
}

#wall {
  margin: 0 auto;
}

.wall-item {
  width: 10%;
}

@media (max-width: 180rem) {
  .wall-item {
    width: 12.5%;
  }
}

@media (max-width: 160rem) {
  .wall-item {
    width: 14.7%;
  }
}

@media (max-width: 140rem) {
  .wall-item {
    width: 16.6%;
  }
}

@media (max-width: 120rem) {
  .wall-item {
    width: 20%;
  }
}

@media (max-width: 100rem) {
  .wall-item {
    width: 25%;
  }
}

@media (max-width: 80rem) {
  .wall-item {
    width: 33%;
  }
}

@media (max-width: 60rem) {
  #page main {
    padding: 1rem .5rem;
  }

  .wall-item {
    width: 50%;
  }
}

@media (max-width: 40rem) {
  .wall-item {
    width: 100%;
  }
}
</style>
