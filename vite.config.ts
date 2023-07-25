import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import viteCompression from "vite-plugin-compression";
import { gitDescribeSync } from "git-describe";
import viteLegacy from "@vitejs/plugin-legacy";

let version;

try {
    const gitInfo = gitDescribeSync();
    if (gitInfo.tag) {
        version = `${gitInfo.tag}`;
        if (gitInfo.distance)
            version += `-${gitInfo.distance}+${gitInfo.hash}`;
    }
} catch { ; }

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    define: {
        __VERSION__: JSON.stringify(version)
    },
    plugins: [
        vue(),
        viteCompression(),
        viteLegacy(),
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    }
});
