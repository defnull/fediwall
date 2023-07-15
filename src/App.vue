<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, onUpdated, ref, watch, watchEffect } from 'vue';
import Card, {type Post} from './components/Card.vue';
import { useWindowSize, watchDebounced } from '@vueuse/core'
import ConfigModal from './components/ConfigModal.vue';
import { loadConfig, type Config } from './config';

const config = ref<Config>();

const allPosts = ref<Array<Post>>([])
const pinned = ref<Array<string>>([])
const hidden = ref<Array<string>>([])
const banned = ref<Array<string>>([])
const updateInProgress = ref(false)
const lastError = ref<string>()

var updateIntervalHandle: number;
const userToId: Record<string, string> = {}

onMounted(async () => {
  config.value = await loadConfig()
  // Trigger update once. Timed updates are started by a watcher below.
  await updateWall()
})

onBeforeUnmount(() => {
  clearInterval(updateIntervalHandle)
})

// Re-layout Masonry on dom updates or window size changes
const fixLayout = inject('redrawVueMasonry') as () => void
onUpdated(() => fixLayout())
const windowSize = useWindowSize()
watchDebounced(windowSize.width, () => { fixLayout() }, { debounce: 500, maxWait: 1000 })

// Watch for a theme changes
watch(() => config.value?.theme, () => {
  document.body!.parentElement!.dataset.bsTheme = config.value?.theme || "light"
})

// Watch for a update interval changes
watch(() => config.value?.interval, () => {
  clearInterval(updateIntervalHandle)
  if (!config.value) return

  // Update  interval is large enough to not hit the mastodon default rate limit
  const rqPerUpdate = config.value.accounts.length * 2 + config.value.tags.length
  const maxPerSecond = 300 / (5 * 60) / 2 // Be nice, use only half rate limit
  const minInternal = Math.ceil(rqPerUpdate / maxPerSecond)
  const interval = Math.max(minInternal, config.value.interval)

  updateIntervalHandle = setInterval(() => {
    updateWall()
  }, interval * 1000)
})

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
    throw new Error(json.error)
  }
  return json
}

async function getUserId(name: string) {
  const cfg = config.value
  if (!cfg) return

  if (!userToId.hasOwnProperty(name)) {
    try {
      userToId[name] = (await fetchJson(`https://${cfg.server}/api/v1/accounts/lookup?acct=${encodeURIComponent(name)}`)).id
    } catch (e) {
      console.warn(`Failed to fetch id for user ${name}`)
    }
  }
  return userToId[name]
}

const filterStatus = (post: any) => {
  // Filter sensitive posts (TODO: Allow if configured)
  if (post?.sensitive) return false;
  // Filter replies (TODO: Allow if configured)
  if (post?.in_reply_to_id) return false;
  // Filter non-public posts
  if (post?.visibility !== "public") return false;
  // Filter bad actors
  if (post?.account?.suspended) return false;
  if (post?.account?.limted) return false;
  // Filter bots
  //if(post?.account?.bot) return false;
  // Accept anything else
  return true;
}

const statusToWallPost = (post: any): Post => {
  var date = post.created_at
  if (post.reblog)
    post = post.reblog

  var media;
  const image = post.media_attachments?.find((m: any) => m.type == "image")
  if (image)
    media = image.url

  return {
    id: post.id,
    url: post.url,
    author: {
      name: post.account.display_name || post.account.username,
      url: post.account.url,
      avatar: post.account.avatar,
    },
    content: post.content,
    date,
    media,
  }
}

async function fetchPosts() {
  const cfg = config.value
  if (!cfg) return []

  const posts: Array<Post> = [];

  const addOrReplace = (post?: Post) => {
    if (!post) return
    const i = posts.findIndex(p => p.id === post.id)
    if (i >= 0)
      posts[i] = post
    else
      posts.unshift(post)
  }

  for (var tag of cfg.tags) {
    const items = await fetchJson(`https://${cfg.server}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${cfg.limit}`) as any[];
    items.filter(filterStatus).map(statusToWallPost).forEach(addOrReplace);
  }

  for (var user of cfg.accounts) {
    const userId = await getUserId(user)
    if (!userId) continue;
    const items = await fetchJson(`https://${cfg.server}/api/v1/accounts/${encodeURIComponent(userId)}/statuses?limit=${cfg.limit}&exclude_replies=True`) as any[];
    items.filter(filterStatus).map(statusToWallPost).forEach(addOrReplace);
  }

  return posts;
}

async function updateWall() {
  const cfg = config.value
  if (!cfg) return

  if (updateInProgress.value) {
    console.debug("Wall update skipped: Already in progress")
    return
  }

  console.debug("Startung wall update...")
  updateInProgress.value = true
  try {
    allPosts.value = await fetchPosts()
    lastError.value = undefined
    console.debug("Update completed")
  } catch (e) {
    console.warn("Update failed", e)
    lastError.value = (e as Error).toString()
  } finally {
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
  config.value.theme = config.value.theme === "dark" ? "light" : "dark"
}

const aboutLink = computed(() => {
  if (config.value?.server.length)
    return `https://${config.value.server}/about`
  return "#"
})

const privacyLink = computed(() => {
  if (config.value?.server.length)
    return `https://${config.value.server}/privacy-policy`
  return "#"
})

</script>

<template>
  <div id="page">
    <span v-show="updateInProgress" class="position-fixed bottom-0 start-0 m-1 opacity-25 text-muted">♥</span>
    <header v-if="config?.info === 'top'" class="secret-hover">
      This wall shows <a :href="aboutLink" target="_blank" class="">{{ config.server }}</a> posts
      <template v-if="config.accounts.length">by
        <a v-for="a in config.accounts" class="me-1" :href="`https://${config.server}/@${encodeURIComponent(a).replace('%40','@')}`">@{{
          a }}</a>
      </template>
      <template v-if="config.accounts.length && config?.tags.length"> or </template>
      <template v-if="config.tags.length">tagged with
        <a v-for="t in config.tags" class="me-1" :href="`https://${config.server}/tags/${encodeURIComponent(t)}`">#{{
          t }}</a>
      </template>
      <small class="text-secondary secret">
        [<a href="#" class="text-secondary" @click.prevent="config.info = 'hide'">hide</a> -
        <a href="#" class="text-secondary" data-bs-toggle="modal" data-bs-target="#configModal">edit</a>]
      </small>
    </header>

    <main>
      <div v-if="filteredPosts.length === 0 && updateInProgress">Loading first posts ...</div>
      <div v-else-if="filteredPosts.length === 0">Nothing there yet ...</div>
      <div v-else v-masonry transition-duration="1s" item-selector=".wall-item" stamp=".stamp" percent-position="true"
        fit-width="true" id="wall">
        <Card v-masonry-tile class="wall-item secret-hover" v-for="(post, index) in filteredPosts" :key="post.id"
          :post="post">
          <template v-slot:topleft>
            <div class="dropdown secret">
              <button class="btn btn-outline-secondary" type="button" data-bs-toggle="dropdown"
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
      <button class="btn btn-link text-muted" @click="toggleTheme(); false">[{{ config?.theme == "dark" ? "Light" :
        "Dark" }} mode]</button>
      <button class="btn btn-link text-muted" data-bs-toggle="modal" data-bs-target="#configModal">[configure]</button>
      <div>
        <a :href="privacyLink" target="_blank" class="mx-1">Privacy policy</a>
        - <a href="https://github.com/defnull/fediwall" target="_blank" class="mx-1">Github</a>
        - <a href="https://github.com/defnull/fediwall#readme" target="_blank" class="mx-1">Documentation</a>
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
  padding: 1rem 2rem;
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
  width: 25rem;
}</style>
