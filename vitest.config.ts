import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["packages/assets/*.test.mjs"] } });
