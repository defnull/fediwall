<script setup lang="ts">
import { type Config } from '@/types';
import { computed } from 'vue';

const props = defineProps<{
    config: Config
}>()

const tagLimit = 5;
const accountLimit = 2;

const tagsHidden = computed(()=> Math.max(0, props.config.tags.length - tagLimit))
const accountsHidden = computed(()=> Math.max(0, props.config.accounts.length - accountLimit))

const tags = computed(()=>{
    const limited = props.config.tags.slice(0, tagLimit)
    return limited
})

const accounts = computed(()=>{
    const limited = props.config.accounts.slice(0,accountLimit)
    return limited
})

function sep(index: number, length: number, sep: string, lastsep: string) {
    if(index < length - 2)
        return sep
    else if(index == length - 2)
        return lastsep
}

</script>

<template>
    <div>
        This Fediwall shows posts
        <template v-if="tags.length">
            tagged with
            <template v-for="(t, index) in tags" :key="index">
                <code>#{{ t }}</code>{{ sep(index, tags.length, ", ", tagsHidden ? ", " : " or ") }}
            </template>
            <span v-if="tagsHidden"> and more</span>
        </template>
        <template v-if="accounts.length">
            <template v-if="tags.length"> as well as posts </template>
            by
            <template v-for="(acc, index) in accounts" :key="index">
                <code>@{{ acc }}</code>{{ sep(index, accounts.length, ", ", accountsHidden ? ", " : " or ") }}
            </template>
            <span v-if="accountsHidden"> and more</span>
        </template>
    </div>
</template>

<style></style>
