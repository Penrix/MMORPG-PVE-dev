import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = [
  "docs/mmorpg/01-reuse-crosswalk.md",
  "docs/mmorpg/18-story-runtime-core.md",
  "packages/contracts/src/story-runtime.ts",
  "packages/narrative/src/story-runtime.ts",
  "packages/narrative/src/story-runtime-workers.ts",
  "packages/narrative/test/story-runtime.test.ts",
  "packages/narrative/test/story-runtime-workers.test.ts",
  "THIRD_PARTY_NOTICES.md",
];

execFileSync("npx", ["prettier", "--write", ...files], { stdio: "inherit" });
for (const file of files) {
  const encoded = Buffer.from(readFileSync(file)).toString("base64");
  console.log(`@@FORMATTED:${file}@@${encoded}@@END_FORMATTED@@`);
}
process.exit(1);
