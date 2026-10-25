// The landing page: a static site in site/, sharing the app's tokens and motion. The playground is
// built beside it under /playground/ (npm run build:site), so one deploy carries both.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "site",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/site", emptyOutDir: true },
  server: { port: 5174 },
});
