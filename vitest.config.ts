import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@mainmoneyapp/js-core": path.resolve("packages/core/src/index.ts"),
      "@mainmoneyapp/js-http": path.resolve("packages/http/src/index.ts"),
      "@mainmoneyapp/js-checkout": path.resolve("packages/checkout/src/index.ts"),
    },
  },
});
