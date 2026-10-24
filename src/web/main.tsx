import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";
import { SocketConnection } from "./transport/socket-connection.ts";
import { Announcer } from "./voice/announcer.ts";

const connection = new SocketConnection();
const announcer = new Announcer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App connection={connection} announcer={announcer} />
  </StrictMode>,
);
