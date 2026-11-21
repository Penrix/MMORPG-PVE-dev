import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = [
  "packages/narrative/test/story-runtime-workers.test.ts",
  "THIRD_PARTY_NOTICES.md",
  "packages/narrative/src/vendor/novel-studio/character-agent-protocol.ts",
  "AGENTS.md",
  "docs/mmorpg/README.md",
  "packages/contracts/src/index.ts",
  "packages/narrative/src/index.ts",
];

execFileSync("npx", ["prettier", "--write", ...files], { stdio: "inherit" });
for (const file of files) {
  const encoded = Buffer.from(readFileSync(file)).toString("base64");
  console.log(`@@FORMATTED:${file}@@${encoded}@@END_FORMATTED@@`);
}
process.exit(1);
