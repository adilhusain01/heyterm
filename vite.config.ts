import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const callsignServer = `http://127.0.0.1:${process.env.CALLSIGN_PORT ?? 4747}`;

export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/ws": { target: callsignServer, ws: true },
      "/pty": { target: callsignServer, ws: true },
      "/health": callsignServer,
    },
  },
});
