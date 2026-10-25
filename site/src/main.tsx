import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are bundled, so the page calls no font service.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/martian-mono/wdth.css";
import "./styles.css";
import { Footer, GetStarted, Safety } from "./Closing.tsx";
import { AssistantInTheMiddle } from "./diagrams/AssistantRefines.tsx";
import { ApprovalFlow } from "./diagrams/ApprovalSequence.tsx";
import { Features } from "./Features.tsx";
import { HowItWorks, Waits, WhatYouSay } from "./Middle.tsx";
import { AgentsStrip, Hero, TopBar } from "./Top.tsx";

function Page() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-inner focus:bg-key focus:px-3 focus:py-2">
        Skip to the content
      </a>
      <TopBar />
      <main id="main">
        <Hero />
        <AgentsStrip />
        <Waits />
        <HowItWorks />
        <AssistantInTheMiddle />
        <WhatYouSay />
        <ApprovalFlow />
        <Features />
        <Safety />
        <GetStarted />
      </main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
