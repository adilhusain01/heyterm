// Starts Callsign without the CLI's checks or browser, for npm start and npm run dev.

import { startCallsign } from "./main.ts";

startCallsign().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
