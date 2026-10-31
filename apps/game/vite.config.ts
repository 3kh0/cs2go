import { defineConfig } from "vite";
import { buildAssets } from "../../scripts/build-assets.mjs";
import { steamAuthPlugin } from "./steam-auth.mjs";

export default defineConfig({
  publicDir: "../../packages/assets/public",
  envDir: "../..",
  plugins: [buildAssets(), steamAuthPlugin()],
  build: {
    // Three.js changes rarely; a separate chunk stays cached across game deploys.
    rolldownOptions: {
      input: { main: "index.html", online: "online.html" },
      output: { codeSplitting: { groups: [{ name: "three", test: /node_modules[\\/]three/ }] } },
    },
    chunkSizeWarningLimit: 700,
  },
});
