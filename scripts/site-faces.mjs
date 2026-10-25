// Draws the faces the landing page shows, at build time, so the page ships a few small pictures instead
// of the face generator. Same style and seeds as the app (src/web/ui/SessionAvatar.tsx). Each face is a
// file of its own the browser fetches beside the page, so faces never weigh down the page's script.
import { mkdirSync, writeFileSync } from "node:fs";
import { Avatar, Style } from "@dicebear/core";
import adventurer from "@dicebear/styles/adventurer.json" with { type: "json" };

const names = ["api", "web", "docs", "tests", "mobile", "shop", "api-2", "api-3", "api-terminal", "synqed"];
const style = new Style(adventurer);
mkdirSync("site/public/faces", { recursive: true });
for (const name of names) writeFileSync(`site/public/faces/${name}.svg`, String(new Avatar(style, { seed: name })));
const faces = Object.fromEntries(names.map((name) => [name, `/faces/${name}.svg`]));
writeFileSync(
  "site/src/faces.generated.ts",
  `// Written by scripts/site-faces.mjs: DiceBear Adventurer (CC BY 4.0, Lisa Wischofsky) faces for the page, in site/public/faces.\nexport const faces: Record<string, string> = ${JSON.stringify(faces, null, 2)};\n`,
);
console.log(`Drew ${names.length} faces.`);
