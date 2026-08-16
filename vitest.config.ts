import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@mainmoney/js-core": path.resolve("packages/core/src/index.ts"),
      "@mainmoney/js-http": path.resolve("packages/http/src/index.ts"),
      "@mainmoney/js-checkout": path.resolve("packages/checkout/src/index.ts"),
    },
  },
});
