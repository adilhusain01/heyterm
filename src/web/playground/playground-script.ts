// What the playground's simulated agents do, and when. Timings are seconds after the page opens.

import type { PendingRequest } from "../../shared/types.ts";

export interface ScriptedAgent {
  name: string;
  projectPath: string;
  firstPrompt: string;
  workingLines: string[];
}

export const playgroundAgents: ScriptedAgent[] = [
  {
    name: "storefront",
    projectPath: "~/code/storefront",
    firstPrompt: "fix the checkout total when a coupon and free shipping are both applied",
    workingLines: ["Read src/checkout/totals.ts", "Read src/checkout/coupons.ts", "Edit src/checkout/totals.ts", "Ran pnpm test checkout"],
  },
  {
    name: "api",
    projectPath: "~/code/api",
    firstPrompt: "add an orders table with tenant_id and backfill it",
    workingLines: ["Read db/schema.prisma", "Edit db/schema.prisma", "Write db/migrations/0042_orders.sql"],
  },
  {
    name: "docs-site",
    projectPath: "~/code/docs-site",
    firstPrompt: "write the getting started page for the new SDK",
    workingLines: ["Read sdk/README.md", "Write content/getting-started.mdx", "Ran pnpm lint:content"],
  },
];

export const playgroundProjects = ["storefront", "api", "docs-site", "mobile-app", "landing-page"];

export type ScriptedEvent =
  | { at: number; session: string; kind: "permission"; pending: Omit<Extract<PendingRequest, { kind: "permission" }>, "createdAt"> }
  | { at: number; session: string; kind: "question"; pending: Omit<Extract<PendingRequest, { kind: "question" }>, "createdAt"> }
  | { at: number; session: string; kind: "finish"; message: string };

export const playgroundTimeline: ScriptedEvent[] = [
  {
    at: 7,
    session: "api",
    kind: "permission",
    pending: { kind: "permission", requestId: "api-migrate", toolName: "Bash", toolInput: { command: "pnpm prisma migrate dev" }, summary: "pnpm prisma migrate dev", risk: "low", riskReasons: [] },
  },
  {
    at: 14,
    session: "storefront",
    kind: "question",
    pending: {
      kind: "question",
      requestId: "storefront-rounding",
      toolInput: {},
      questions: [
        {
          question: "Should coupons apply before or after free shipping is decided?",
          options: [
            { label: "Before", description: "The order total after the coupon decides free shipping" },
            { label: "After", description: "Free shipping is decided on the full price" },
          ],
        },
      ],
    },
  },
  { at: 22, session: "docs-site", kind: "finish", message: "Wrote the getting started page and it passes the content linter. It covers install, the first request and error handling." },
];

// After the user approves the migration, the api agent goes one step too far.
export const forcePushRequest: Omit<Extract<PendingRequest, { kind: "permission" }>, "createdAt"> = {
  kind: "permission",
  requestId: "api-push",
  toolName: "Bash",
  toolInput: { command: "git push --force origin main" },
  summary: "git push --force origin main",
  risk: "high",
  riskReasons: ["pushes to a remote"],
};

// A reply to anything said to an agent, so the playground always answers.
export function scriptedReply(sessionName: string, prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("test")) return `Ran the tests in ${sessionName}: 48 passed, none failed.`;
  if (lower.includes("commit")) return "Committed the change on a new branch. Nothing was pushed.";
  if (lower.includes("explain") || lower.includes("what")) return `Here is the short version: ${sessionName} keeps its logic in src/ and its tests beside each file.`;
  return `Done: ${prompt.replace(/[.!]+$/, "")}. Tell me if you want it changed.`;
}
