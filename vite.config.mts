import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config
export default defineConfig({
    plugins: [tailwindcss()],
    optimizeDeps: {
        exclude: ["@lydell/node-pty"],
    },
    build: {
        rollupOptions: {
            external: ["@lydell/node-pty"],
        },
    },
});
