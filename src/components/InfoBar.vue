<script setup lang="ts">
import { type Config } from '@/types';

defineProps<{
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
            <template v-for="(acc, index) in config.accounts" :key="acc">
                <code>@{{ acc }}</code>
                <template v-if="index < config.accounts.length - 2">, </template>
                <template v-else-if="index == config.accounts.length - 2"> or </template>
            </template>
        </template>
    </div>
</template>

<style></style>
