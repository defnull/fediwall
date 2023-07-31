<script setup lang="ts">
import { sanatizeConfig, isServer, isLanguage, toQuery } from '@/config';
import { computed, ref } from 'vue';
import { arrayUnique } from '@/utils';
import { type Config } from '@/types';
import { siteConfigParam } from '@/config'

const emit = defineEmits(['update:modelValue'])
const modalDom = ref(null)

const props = defineProps<{
  modelValue: Config
}>()

const config = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', sanatizeConfig(value)),
});

const formServers = computed({
  get: () => config.value.servers.join(" "),
  set: (value) => config.value.servers = (value || "").split(" ").filter(isServer),
});

const tagPattern = /#?([\p{Letter}\p{Number}\p{Mark}\p{Connector_Punctuation}_]+)/igu
const formTags = computed({
  get: () => config.value.tags.map(t => '#' + t).join(" "),
  set: (value) => config.value.tags = arrayUnique([...(value || "").matchAll(tagPattern)].map(m => m[1])),
});

const formBadWords = computed({
  get: () => config.value.badWords.join(" "),
  set: (value) => config.value.badWords = arrayUnique([...(value || "").matchAll(tagPattern)].map(m => m[1])),
});

const accountPattern = /\b([a-z0-9_]+)(@([a-z0-9.-]+\.[a-z]{2,}))?\b/ig;
const formAccounts = computed({
  get: () => config.value.accounts.map(t => "@" + t).join(" "),
  set: (value) => config.value.accounts = [...(value || "").matchAll(accountPattern)].map(m => m[0]),
});

const langPattern = /\b([a-z]{2})\b/ig;
const formLang = computed({
  get: () => config.value.languages.join(" "),
  set: (value) => config.value.languages = [...(value || "").matchAll(langPattern)].map(m => m[0]).filter(isLanguage),
});

const formLimit = computed({
  get: () => config.value.limit.toString(),
  set: (value) => config.value.limit = Math.min(100, Math.max(10, parseInt(value || "0") || 0)),
});

const formInterval = computed({
  get: () => config.value.interval.toString(),
  set: (value) => config.value.interval = Math.min(600, Math.max(5, parseInt(value || "0") || 0)),
});

const formMediaText = computed({
  get: () => config.value.showText,
  set: (value) => {
    config.value.showText = value
    if (!value)
      config.value.showMedia = true
  }
});

const formMediaMedia = computed({
  get: () => config.value.showMedia,
  set: (value) => {
    config.value.showMedia = value
    if (!value) {
      config.value.showText = true
    }
  }
});

const sourceCount = computed(() => {
  var c = 0
  c += config.value.servers.length * config.value.tags.length
  c += config.value.loadFederated ? config.value.servers.length : 0
  c += config.value.loadPublic ? config.value.servers.length : 0
  c += config.value.loadTrends ? config.value.servers.length : 0
  c += config.value.accounts
    .map(a => a.indexOf('@') > 0 ? 1 : config.value.servers.length)
    .reduce((p, e) => p + e, 0)
  return c;
})

const rateLimitRisk = computed(() => {
  return sourceCount.value / config.value.interval > 1
})

const saveConfigLink = computed(() => {
  const json = JSON.stringify(config.value, undefined, 2)
  const bytes = new TextEncoder().encode(json)
  const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
  return "data:application/json;charset=utf-8;base64," + btoa(binString);
})

const fullUrl = computed(() => {
  const url = new URL(location.href.toString());
  url.hash = ""
  url.search = toQuery(config.value)
  return url.toString()
})

const onSubmit = () => {
  location.assign(fullUrl.value)
}

</script>

<template>
  <div class="modal" tabindex="-1" ref="modalDom">
    <div class="modal-dialog">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title">Configure Wall</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <ul class="nav nav-tabs nav-fill mt-3" id="cfg-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" data-bs-toggle="tab" id="btab-content" data-bs-target="#ctab-content"
              type="button" role="tab" aria-controls="ctab-content" aria-selected="true">Sources</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" data-bs-toggle="tab" id="btab-filter" data-bs-target="#ctab-filter" type="button"
              role="tab" aria-controls="ctab-filter" aria-selected="false">Filter</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" data-bs-toggle="tab" id="btab-appearance" data-bs-target="#ctab-appearance"
              type="button" role="tab" aria-controls="ctab-appearance" aria-selected="false">Apperance</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" data-bs-toggle="tab" id="btab-advanced" data-bs-target="#ctab-advanced" type="button"
              role="tab" aria-controls="ctab-advanced" aria-selected="false">Advanced</button>
          </li>
        </ul>

        <div class="modal-body">
          <form @submit.prevent="onSubmit" id="settings-form">

            <div class="tab-content">
              <div class="tab-pane active" id="ctab-content" aria-labelledby="btab-content" role="tabpanel">

                <div class="mb-3">
                  <label for="edit-server" class="form-label">Servers:</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" id="edit-server" v-model.lazy="formServers">
                    <div class="form-text"><span title="Mastodon or compatible"
                        style="border-bottom: 1px dotted; cursor: help;">Mastodon</span> server domains to query for
                      content.</div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="edit-tags" class="form-label">Hashtags:</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" id="edit-tags" v-model.lazy="formTags">
                    <div class="form-text">Show public posts matching these hashtags.
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="edit-accounts" class="form-label">Accounts:</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" id="edit-accounts" v-model.lazy="formAccounts">
                    <div class="form-text">Show all public posts or boosts from these profiles.
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <h6>Public server timelines:</h6>

                  <div class="ms-5">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-trends" v-model="config.loadTrends">
                      <label class="form-check-label" for="edit-trends">
                        Show all trending posts
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-local" v-model="config.loadPublic">
                      <label class="form-check-label" for="edit-local">
                        Show all local posts
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-federated" v-model="config.loadFederated">
                      <label class="form-check-label" for="edit-federated">
                        Show all federated posts
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div class="tab-pane" id="ctab-filter" aria-labelledby="btab-filter" role="tabpanel">

                <div class="mb-3">
                  <h6>Filter unwanted posts:</h6>
                  <div class="ms-5">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-nsfw" v-model="config.hideSensitive">
                      <label class="form-check-label" for="edit-nsfw">
                        Hide sensitive content
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-bots" v-model="config.hideBots">
                      <label class="form-check-label" for="edit-bots">
                        Hide bot accounts
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-replies" v-model="config.hideReplies">
                      <label class="form-check-label" for="edit-replies">
                        Hide replies
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-boosts" v-model="config.hideBoosts">
                      <label class="form-check-label" for="edit-boosts">
                        Hide boosts
                      </label>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="edit-server" class="form-label">Filter bad words:</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" id="edit-server" v-model.lazy="formBadWords">
                    <div class="form-text">Hide posts containing certain words or hashtags. Only exact matches are
                      filtered.</div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="edit-server" class="form-label">Filter by language:</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" id="edit-server" placeholder="all languages"
                      v-model.lazy="formLang">
                    <div class="form-text">List of <a href="https://en.wikipedia.org/wiki/ISO_639-1"
                        tyrget="_blanlk">two-letter language codes</a> to allow. Leave blank to allow all languages.</div>
                  </div>
                </div>

              </div>

              <div class="tab-pane" id="ctab-appearance" aria-labelledby="btab-appearance" role="tabpanel">

                <div class="mb-3">
                  <label for="edit-title" class="form-label">Wall title:</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" id="edit-title" v-model.lazy="config.title">
                  </div>
                </div>

                <div class="mb-3">
                  <label for="edit-theme" class="form-label">Theme:</label>
                  <div class="ms-5">
                    <select class="form-select mb-1" id="edit-theme" v-model="config.theme">
                      <option value="light">Light mode</option>
                      <option value="dark">Dark mode</option>
                      <option value="auto">Auto (browser default)</option>
                    </select>
                    <div class="form-check mt-2">
                      <input class="form-check-input" type="checkbox" id="edit-info" v-model="config.showInfobar">
                      <label class="form-check-label" for="edit-info">
                        Show info bar at the top
                      </label>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <h6>Post content:</h6>
                  <div class="ms-5">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-text" v-model="formMediaText">
                      <label class="form-check-label" for="edit-text">
                        Show text content
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="edit-media" v-model="formMediaMedia">
                      <label class="form-check-label" for="edit-media">
                        Show attached media
                      </label>
                    </div>
                    <div class="form-check ms-3">
                      <input class="form-check-input" type="checkbox" id="edit-autoplay" v-model="config.playVideos" :disabled="!formMediaMedia">
                      <label class="form-check-label" for="edit-autoplay">
                        Play videos (muted)
                      </label>
                    </div>
                  </div>
                </div>


              </div>
              <div class="tab-pane" id="ctab-advanced" aria-labelledby="btab-advanced" role="tabpanel">

                <div class="mb-3">
                  <label for="edit-interval" class="form-label">Update interval</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" name="edit-interval" v-model.lazy="formInterval">
                    <div class="form-text">Number of seconds to wait between updates.</div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="edit-limit" class="form-label">Results per query</label>
                  <div class="ms-5">
                    <input type="text" class="form-control" name="edit-limit" v-model.lazy="formLimit">
                    <div class="form-text">Limit number of results per API request. Increase only if your filters hide too many posts.</div>
                  </div>
                </div>

                <div class="mb-3">
                  <h6>Download config</h6>
                  <div class="ms-5">
                    <div class="form-text">
                      You can <a :href="saveConfigLink" target="_blank" download="wall-config.json">download</a> the
                      current configuration as a JSON file and either upload it as <code>wall-config.json</code>
                      to your own self-hosted Fediwall, or host it somewhere else and load it via the
                      <code>?{{ siteConfigParam }}=URL</code> query parameter.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>

        </div>

        <div class="modal-footer">
          <div v-if="rateLimitRisk" class="alert alert-warning mb-3" role="alert">
            Current configuration updates {{ sourceCount }} sources every {{ formInterval }} seconds and may
            run into issues with rate-limited servers. Reduce the number of sources (servers, hashtags, accounts)
            or increase the update interval.
          </div>
          <button type="submit" class="btn btn-primary" form="settings-form">Apply config</button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.form-label,
h6 {
  font-weight: bolder;
}
</style>

