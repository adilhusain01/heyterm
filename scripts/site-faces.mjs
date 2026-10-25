// Draws the faces the landing page shows, at build time, so the page ships six small pictures instead
// of the face generator. Same style and seeds as the app (src/web/ui/SessionAvatar.tsx).
import { writeFileSync } from "node:fs";
import { Avatar, Style } from "@dicebear/core";
import adventurer from "@dicebear/styles/adventurer.json" with { type: "json" };

const names = ["api", "web", "docs", "tests", "mobile", "shop"];
const style = new Style(adventurer);
const faces = Object.fromEntries(names.map((name) => [name, new Avatar(style, { seed: name }).toDataUri()]));
writeFileSync(
  "site/src/faces.generated.ts",
  `// Written by scripts/site-faces.mjs: DiceBear Adventurer (CC BY 4.0, Lisa Wischofsky) faces for the page.\nexport const faces: Record<string, string> = ${JSON.stringify(faces, null, 2)};\n`,
);
console.log(`Drew ${names.length} faces.`);
