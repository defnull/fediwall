<script setup lang="ts">
import { useElementVisibility, useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue';
import moment from 'moment'
import { type Config, type Post } from '@/types';

const props = defineProps<{
  config: Config,
  post: Post,
}>()

const timeAgo = ref(moment(props.post.date).fromNow())

useIntervalFn(() => {
  timeAgo.value = moment(props.post.date).fromNow()
}, 1000)

const media = computed(() => {
  return props.post.media[0]
})

const videoElement = ref(null)
const videoIsVisible = useElementVisibility(videoElement)
const playVideo = computed(() => {
  return media.value?.type === "video" && props.config.playVideos && videoIsVisible.value
})

</script>

<template>
  <div class="wall-item">
    <div class="card mx-2 my-3" :class="post.pinned ? 'pinned' : ''">
      <div v-if="post.author" class="card-header d-flex align-items-center">
        <a v-if="post.author?.avatar" :href="post.url" target="_blank" class="flex-shrink-0">
          <img :src="post.author.avatar" class="me-2 avatar" />
        </a>
        <a :href="post.url" target="_blank" class="text-body flex-grow-1 m-0 avatarlink">
          <div v-dompurify-html="post.author.name" class="displayname"></div>
          <div v-dompurify-html="post.author.profile" class="profile"></div>
        </a>
        <slot name="topleft"></slot>
      </div>
      <div class="card-body">
        <div v-if="config.showMedia" class="wall-media mb-3">
          <img v-if="media?.type === 'image'" :src="media.url" :alt="media.alt" :title="media.alt">
          <video v-else-if="media?.type === 'video'" ref="videoElement" muted loop :autoplay="playVideo"
            :poster="media.preview" :alt="media.alt" :title="media.alt">
            <source v-if="playVideo" :src="media.url">
          </video>
        </div>
        <p v-if="config.showText" class="card-text" v-dompurify-html="post.content"></p>
        <p class="card-text text-end text-break"><a :href="post.url" target="_blank" alt="${post.date}"
            class="text-decoration-none text-muted"><small>{{ timeAgo }}</small></a></p>
      </div>
    </div>
  </div>
</template>

<style>
.wall-item .card {
  box-shadow: 0 4px 6px 0 rgba(0, 0, 0, 0.2);
}

.wall-item .card.pinned .card-header {
  background-color: var(--bs-primary-bg-subtle);
}

.wall-item a {
  text-decoration: none;
}

.wall-item img.avatar {
  width: 2em;
  height: 2em;
  border-radius: 50%;
}

.wall-item a.avatarlink {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.wall-item div.profile {
  margin-top: -.3em;
  font-size: .85em;
  opacity: .5;
}

.wall-item img.emoji {
  height: 1em;
  width: 1em;
  object-fit: contain;
  vertical-align: middle;
  font-size: inherit;
}

.wall-media img,
.wall-media video {
  width: 100%;
  max-height: 1wh;
  object-fit: cover;
  border-radius: 5px;
}

.wall-item .invisible {
  font-size: 0 !important;
  line-height: 0 !important;
}
</style>
