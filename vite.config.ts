import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    // Three.js changes rarely; a separate chunk stays cached across game deploys.
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: "three", test: /node_modules[\\/]three/ }] } },
    },
    chunkSizeWarningLimit: 700,
  },
  test: { include: ["src/**/*.test.ts"] },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
