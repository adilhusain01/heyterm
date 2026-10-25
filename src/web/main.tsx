import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
// Fonts are bundled, so the page never calls out to a font service.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { isPlayground } from "./playground/is-playground.ts";
import { SimulatedConnection } from "./playground/simulated-connection.ts";
import { SocketConnection } from "./transport/socket-connection.ts";
import { Announcer } from "./voice/announcer.ts";

const connection = isPlayground ? new SimulatedConnection() : new SocketConnection();
const announcer = new Announcer();
announcer.speaksArrivalsItself = isPlayground;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App connection={connection} announcer={announcer} />
  </StrictMode>,
);
