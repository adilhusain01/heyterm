// Runs the HeyTerm server and the Vite dev server together. Ctrl+C stops both.
import { spawn } from "node:child_process";

const environment = { ...process.env, HEYTERM_DEV_ORIGIN: "http://localhost:5173" };
const processes = [
  spawn("npx", ["tsx", "watch", "src/server/serve.ts"], { stdio: "inherit", env: environment }),
  spawn("npx", ["vite"], { stdio: "inherit", env: environment }),
];
const stopAll = () => processes.forEach((child) => child.kill("SIGTERM"));
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
processes.forEach((child) => child.on("exit", stopAll));
