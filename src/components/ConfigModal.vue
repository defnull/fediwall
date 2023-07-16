<script setup lang="ts">
import { sanatizeConfig } from '@/config';
import { toQuery, type Config } from '@/config';
import { computed, ref } from 'vue';



const emit = defineEmits(['update:modelValue'])
const modalDom = ref(null)

const props = defineProps<{
  modelValue: Config
}>()

const config = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', sanatizeConfig(value)),
});

const serverValue = computed({
  get: () => config.value.server || "",
  set: (value) => config.value.server = value.replace(/(^.*\/\/|[^a-z0-9.-]+)/i, ""),
});

const formTags = computed({
  get: () => config.value.tags.map(t => "#" + t).join(" "),
  set: (value) => config.value.tags = (value || "").replace(/[^a-z0-9]+/ig, " ").split(" ").filter(t => t.length),
});

const accountPattern = /\b([A-Z0-9._%+-]+)(@([A-Z0-9.-]+\.[A-Z]{2,}))?\b/ig;
const formAccounts = computed({
  get: () => config.value.accounts.map(t => "@" + t).join(" "),
  set: (value) => config.value.accounts = [...(value || "").matchAll(accountPattern)].map(m => m[0]).filter(t => t.length),
});

const formLimit = computed({
  get: () => config.value.limit.toString(),
  set: (value) => config.value.limit = Math.min(100, Math.max(10, parseInt(value || "0") || 0)),
});

const formInterval = computed({
  get: () => config.value.interval.toString(),
  set: (value) => config.value.interval = Math.min(600, Math.max(5, parseInt(value || "0") || 0)),
});

const formInfo = computed({
  get: () => config.value.info,
  set: (value) => config.value.info = value === "top" ? "top" : "hide",
});


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
        <div class="modal-body">
          <form @submit.prevent="onSubmit">

            <div class="mb-3 row">
              <label for="edit-server" class="col-sm-2 col-form-label">Server</label>
              <div class="col-sm-10">
                <input type="text" class="form-control" id="edit-server" v-model="serverValue">
                <div class="form-text">Mastodon (or compatible) server domain.</div>
              </div>
            </div>

            <div class="mb-3 row">
              <label for="edit-tags" class="col-sm-2 col-form-label">Hashtags</label>
              <div class="col-sm-10">
                <input type="text" class="form-control" id="edit-tags" v-model.lazy="formTags">
                <div class="form-text">Hashtags to follow.</div>
              </div>
            </div>

            <div class="mb-3 row">
              <label for="edit-accounts" class="col-sm-2 col-form-label">Accounts</label>
              <div class="col-sm-10">
                <input type="text" class="form-control" id="edit-accounts" v-model.lazy="formAccounts">
                <div class="form-text">Accounts to follow. Only public posts and boosts will be shown (no replies).</div>
              </div>
            </div>

            <div class="mb-1 row">
              <label for="edit-theme" class="col-sm-2 col-form-label">Theme</label>
              <div class="col-sm-10">
                <select class="form-select" id="edit-theme" v-model="config.theme">
                  <option value="dark">dark</option>
                  <option value="light">light</option>
                </select>
              </div>
            </div>

            <div class="mb-3 row">
              <div class="col-sm-2 col-form-label hidden"></div>
              <div class="col-sm-10">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="edit-info" true-value="top" false-value="hide" v-model="formInfo">
                  <label class="form-check-label" for="edit-info">
                    Show info line at the top
                  </label>
                </div>
              </div>
            </div>

            <div class="mb-3 row">
              <label for="limit" class="col-sm-2 col-form-label">Limit</label>
              <div class="col-sm-10">
                <input type="text" class="form-control" name="limit" v-model.lazy="formLimit">
                <div class="form-text">Fetch this many posts per hashtag or account.</div>
              </div>
            </div>

            <div class="mb-3 row">
              <label for="interval" class="col-sm-2 col-form-label">Interval</label>
              <div class="col-sm-10">
                <input type="text" class="form-control" name="interval" v-model.lazy="formInterval">
                <div class="form-text">Update interval in seconds. Note that checking too many hashtags or accounts too
                  fast may clash with server rate limits.</div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary float-end">Apply</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style></style>
