/**
 * Index an external curated creative-method library into NarraLume Retrieval.
 *
 * The source repository remains authoritative. This script only builds
 * rebuildable per-project retrieval segments.
 *
 * Example:
 * npm run import:creative-methods -- \
 *   --project PROJECT_ID \
 *   --source /path/to/male-webnovel-cognition/database/m03 \
 *   --family M03
 */
import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import {
  creativeMethodSegmentFromCuratedCard,
  parseCuratedCreativeMethodIndex,
} from "@narralume/narrative";
import {
  SqliteProjectRepository,
  SqliteRetrievalRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function safeSourcePath(root: string, filename: string): string {
  const path = resolve(root, filename);
  const rel = relative(root, path);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`creative_method.source_path_escape:${filename}`);
  }
  return path;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log(
      "npm run import:creative-methods -- --project PROJECT_ID --source /path/to/library [--family M03] [--index curated_index.jsonl] [--db /path/narralume.sqlite]",
    );
    return;
  }

  const projectId = option("--project")?.trim();
  const source = option("--source");
  if (!projectId) throw new Error("--project is required");
  if (!source) throw new Error("--source is required");

  const family = option("--family")?.trim() || "M03";
  const indexFilename = option("--index")?.trim() || "curated_index.jsonl";
  const root = fileURLToPath(new URL("../", import.meta.url));
  const dbPath = resolve(
    option("--db") ??
      process.env.NARRATIVE_DB_PATH ??
      resolve(
        root,
        process.env.NARRATIVE_DATA_DIR ?? "data",
        "narralume.sqlite",
      ),
  );
  const sourceRoot = resolve(source);
  const indexPath = safeSourcePath(sourceRoot, indexFilename);
  const index = parseCuratedCreativeMethodIndex(
    await readFile(indexPath, "utf8"),
  );

  // Read all live cards before touching SQLite. A broken source checkout must
  // not leave a half-imported active creative-method library.
  const prepared: Array<{
    entry: (typeof index)[number];
    markdown: string;
  }> = [];
  for (const entry of index) {
    const cardPath = safeSourcePath(sourceRoot, entry.filename);
    let markdown = "";
    try {
      markdown = await readFile(cardPath, "utf8");
    } catch (error) {
      if (entry.status === "active" || entry.status === "candidate") {
        throw new Error(
          `creative_method.live_card_unreadable:${entry.id}:${String(error)}`,
        );
      }
      // Retired / merged entries may no longer need a full body. Their index
      // row still updates the retrieval metadata so old active rows stop being
      // eligible for normal recall.
    }
    prepared.push({ entry, markdown });
  }

  const db = new NodeNarrativeDatabase(dbPath);
  try {
    db.migrate();
    const projects = new SqliteProjectRepository(db);
    if (!projects.get(projectId)) {
      throw new Error(`creative_method.project_not_found:${projectId}`);
    }
    const retrieval = new SqliteRetrievalRepository(db);
    const now = new Date().toISOString();

    db.transaction(() => {
      for (const item of prepared) {
        retrieval.upsertSegment(
          creativeMethodSegmentFromCuratedCard({
            projectId,
            methodFamily: family,
            sourceRootLabel: sourceRoot,
            entry: item.entry,
            markdown: item.markdown,
            now,
          }),
        );
      }
    });

    const counts = prepared.reduce<Record<string, number>>((acc, item) => {
      acc[item.entry.status] = (acc[item.entry.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      JSON.stringify(
        {
          database: dbPath,
          projectId,
          methodFamily: family,
          sourceRoot,
          index: indexPath,
          imported: prepared.length,
          statuses: counts,
          note: "Source Markdown remains authoritative; text_segments are rebuildable retrieval indexes.",
        },
        null,
        2,
      ),
    );
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
