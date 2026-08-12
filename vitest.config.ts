import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@portal/config": resolve(__dirname, "packages/config/src"),
      "@portal/domain": resolve(__dirname, "packages/domain/src"),
      "@portal/db": resolve(__dirname, "packages/db/src"),
      "@portal/adapters": resolve(__dirname, "packages/adapters/src"),
      "@portal/ui": resolve(__dirname, "packages/ui/src"),
      "@portal/api": resolve(__dirname, "apps/api/src"),
      "@portal/web": resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
  },
});

