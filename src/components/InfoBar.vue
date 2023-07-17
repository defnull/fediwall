<script setup lang="ts">
import { type Config } from '@/config';
import { ref } from 'vue';

const props = defineProps<{
    config: Config
}>()

</script>

<template>
    <div>
        This Fediwall shows
        <template v-if="config.tags.length">
            posts tagged with
            <template v-for="(t, index) in config.tags" :key="t">
                <code>#{{ t }}</code>
                <template v-if="index < config.tags.length - 2">, </template>
                <template v-else-if="index == config.tags.length - 2"> or </template>
            </template>
        </template>
        <template v-if="config.accounts.length && config?.tags.length"> and </template>
        <template v-if="config.accounts.length">
            posts or boosts by
            <template v-for="(acc, index) in config.accounts" :key="t">
                <code>@{{ acc }}</code>
                <template v-if="index < config.accounts.length - 2">, </template>
                <template v-else-if="index == config.accounts.length - 2"> or </template>
            </template>
        </template>

        <slot></slot>

    </div>
</template>

<style></style>
