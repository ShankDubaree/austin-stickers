import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/austin-stickers/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        kid: resolve(root, "kid.html"),
        a: resolve(root, "a/index.html"),
      },
    },
  },
});
