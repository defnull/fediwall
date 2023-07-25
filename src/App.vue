<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue';
import { useDocumentVisibility, usePreferredDark, useWindowSize, watchDebounced } from '@vueuse/core'

import { type Config, type Post } from '@/types';
import { loadConfig } from '@/config';
import { gitVersion } from '@/defaults'
import { fetchPosts } from '@/sources'

import Card from './components/Card.vue';
import ConfigModal from './components/ConfigModal.vue';
import InfoBar from './components/InfoBar.vue';

const config = ref<Config>();

const allPosts = ref<Array<Post>>([])
const pinned = ref<Array<string>>([])
const hidden = ref<Array<string>>([])
const banned = ref<Array<string>>([])
const updateInProgress = ref(false)

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
    allPosts.value = await fetchPosts(cfg)
    console.debug("Update completed")
  } catch (e) {
    console.warn("Update failed", e)
  } finally {
    lastUpdate = Date.now()
    updateInProgress.value = false;
  }

}

/**
 * Filter and order posts based on real-time criteria (e.g. pinned or hidden posts).
 * Most of filtering already happened earlier.
 */
const filteredPosts = computed(() => {
  // Copy to make sure those are detected as a reactive dependencies
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
        <Card v-masonry-tile class="wall-item secret-hover" v-for="post in filteredPosts" :key="post.id"
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
