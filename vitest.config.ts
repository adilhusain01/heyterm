import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "site/src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["src/test-support/private-home.ts"],
  },
});
