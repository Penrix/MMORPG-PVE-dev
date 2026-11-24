#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import {
  mergeNewbookPool,
  parseNewbooksJsonl,
  parseRankingMarkdown,
  stringifyNewbooksJsonl,
} from "./newbook-pool-core.mjs";

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

const inputDir = resolve(readArg("--input", ".newbook-raw"));
const outDir = resolve(readArg("--outdir", "datasets/newbook-rankings"));
const existingPath = resolve(
  readArg("--existing", join(outDir, "newbooks.jsonl")),
);
const observedDate = readArg("--date", new Date().toISOString().slice(0, 10));
const partial = process.argv.includes("--partial");

const existingRecords = existsSync(existingPath)
  ? parseNewbooksJsonl(readFileSync(existingPath, "utf8"))
  : [];

const rawFiles = existsSync(inputDir)
  ? readdirSync(inputDir)
      .filter((name) => name.endsWith(".md"))
      .sort()
  : [];

const incoming = [];
const perFileCounts = {};
for (const filename of rawFiles) {
  const content = readFileSync(join(inputDir, filename), "utf8");
  const parsed = parseRankingMarkdown(content, filename);
  perFileCounts[filename] = parsed.length;
  incoming.push(...parsed);
}

const merged = mergeNewbookPool(existingRecords, incoming, observedDate);

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "newbooks.jsonl"),
  stringifyNewbooksJsonl(merged.records),
  "utf8",
);

const byPlatform = {};
for (const record of merged.records) {
  byPlatform[record.platform] = (byPlatform[record.platform] ?? 0) + 1;
}

const status = {
  updatedAt: new Date().toISOString(),
  observedDate: merged.stats.observedDate,
  partial,
  total: merged.stats.total,
  addedThisRun: merged.stats.added,
  updatedThisRun: merged.stats.updated,
  skippedInvalidThisRun: merged.stats.skippedInvalid,
  byPlatform,
  rawFiles: perFileCounts,
};

writeFileSync(
  join(outDir, "status.json"),
  `${JSON.stringify(status, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(status, null, 2));
