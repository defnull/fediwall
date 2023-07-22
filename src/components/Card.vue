<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { ref } from 'vue';
import moment from 'moment'

export type Post = {
    id: string;
    url: string;
    content: string;
    date: string;

    author?: {
        name: string;
        avatar?: string;
        url?: string;
    };

    media?: string;
    pinned?: boolean;
};

const props = defineProps<{
  post: Post
}>()

const timeAgo = ref(moment(props.post.date).fromNow())

useIntervalFn(() => {
  timeAgo.value = moment(props.post.date).fromNow()
}, 1000)

</script>

<template>
  <div class="wall-item">
    <div class="card mx-2 my-3" :class="post.pinned?'pinned':''">
      <div v-if="post.author" class="card-header d-flex align-items-center">
        <div v-if="post.author?.avatar" class="flex-shrink-0">
          <img :src="post.author.avatar" class="rounded-circle me-2" />
        </div>
        <p class="flex-grow-1 m-0">
        <a v-if="post.author.url" :href="post.author.url" target="_blank" v-dompurify-html="post.author.name" class="text-body"></a>
        <span v-else v-dompurify-html="post.author.name"></span></p>
        <slot name="topleft"></slot>
      </div>
      <div class="card-body">
        <img v-if="post.media" :src="post.media" class="wall-media mb-3">
        <p class="card-text" v-dompurify-html="post.content"></p>
        <p class="card-text text-end text-break"><a :href="post.url" target="_blank"
              alt="${post.date}" class="text-decoration-none text-muted"><small>{{ timeAgo }}</small></a></p>
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

.wall-item .card-header img {
  width: 2em;
  height: 2em;
}

.wall-item img.emoji {
  height: 1em;
  width: 1em;
  object-fit: contain;
  vertical-align: middle;
  font-size: inherit;
}

.wall-item .wall-media {
  width: 100%;
  border-radius: 5px;
}

.wall-item .invisible {
  font-size: 0 !important;
  line-height: 0 !important;
}
</style>
