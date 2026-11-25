/**
 * Full-import ALL M03 creative material cards (curated + coarse/raw) into
 * Module 2's global creative_material_library + trigram FTS5 index.
 *
 * Usage:
 *   npx tsx scripts/import-m03-global.ts --source ../male-webnovel-cognition/database/m03
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeNarrativeDatabase } from "@narralume/persistence/node";

interface IndexEntry {
  id: string;
  type: string;
  name: string;
  status?: string;
  summary?: string;
  call_when?: string[];
  tags?: string[];
  filename: string;
  curation_stage?: string | null;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function safeSourcePath(root: string, filename: string): string {
  const full = resolve(root, filename);
  const rel = relative(root, full);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`m03.source_path_escape:${filename}`);
  }
  return full;
}

function parseJsonl(raw: string): IndexEntry[] {
  const items: IndexEntry[] = [];
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed) as Partial<IndexEntry>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.type === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.filename === "string"
    ) {
      items.push({
        id: parsed.id.trim(),
        type: parsed.type.trim(),
        name: parsed.name.trim(),
        status:
          parsed.status === "candidate" ||
          parsed.status === "merged" ||
          parsed.status === "retired"
            ? parsed.status
            : "active",
        summary:
          typeof parsed.summary === "string" ? parsed.summary.trim() : "",
        call_when: Array.isArray(parsed.call_when)
          ? parsed.call_when.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        filename: parsed.filename.trim(),
        curation_stage:
          typeof parsed.curation_stage === "string"
            ? parsed.curation_stage.trim()
            : null,
      });
    }
  }
  return items;
}

async function main(): Promise<void> {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const sourceArg =
    option("--source") ??
    resolve(root, "../male-webnovel-cognition/database/m03");
  const sourceRoot = resolve(sourceArg);
  const libraryId = option("--library")?.trim() || "M03";
  const dbPath = resolve(
    option("--db") ??
      process.env.NARRATIVE_DB_PATH ??
      resolve(
        root,
        process.env.NARRATIVE_DATA_DIR ?? "data",
        "narralume.sqlite",
      ),
  );

  const retrievalPath = safeSourcePath(sourceRoot, "retrieval_index.jsonl");
  const curatedPath = safeSourcePath(sourceRoot, "curated_index.jsonl");
  const entries = parseJsonl(await readFile(retrievalPath, "utf8"));
  const curatedIds = new Set<string>(
    existsSync(curatedPath)
      ? parseJsonl(await readFile(curatedPath, "utf8")).map((item) => item.id)
      : [],
  );

  const prepared: Array<{
    entry: IndexEntry;
    tier: "curated" | "coarse";
    markdown: string;
  }> = [];

  let missingBodies = 0;
  for (const entry of entries) {
    const cardPath = safeSourcePath(sourceRoot, entry.filename);
    let markdown = "";
    try {
      markdown = (await readFile(cardPath, "utf8")).trim();
    } catch {
      missingBodies += 1;
    }
    prepared.push({
      entry,
      tier: curatedIds.has(entry.id) ? "curated" : "coarse",
      markdown,
    });
  }

  const db = new NodeNarrativeDatabase(dbPath);
  try {
    db.migrate();
    const now = new Date().toISOString();
    const upsert = db.raw.prepare(`
      INSERT INTO creative_material_library (
        id, library_id, material_id, material_type, name, summary, content,
        status, curation_tier, curation_stage, trend_weight,
        call_when_json, tags_json, source_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(library_id, material_id) DO UPDATE SET
        material_type = excluded.material_type,
        name = excluded.name,
        summary = excluded.summary,
        content = excluded.content,
        status = excluded.status,
        curation_tier = excluded.curation_tier,
        curation_stage = excluded.curation_stage,
        call_when_json = excluded.call_when_json,
        tags_json = excluded.tags_json,
        source_path = excluded.source_path,
        updated_at = excluded.updated_at
    `);

    const byTier: Record<string, number> = { curated: 0, coarse: 0 };
    const byStatus: Record<string, number> = {};
    const typeSet = new Set<string>();

    db.transaction(() => {
      for (const item of prepared) {
        const { entry, tier, markdown } = item;
        const status = entry.status ?? "active";
        upsert.run(
          `${libraryId}:${entry.id}`,
          libraryId,
          entry.id,
          entry.type,
          entry.name,
          entry.summary ?? "",
          markdown || entry.summary || entry.name,
          status,
          tier,
          entry.curation_stage ?? null,
          tier === "curated" ? 1.2 : 1.0,
          JSON.stringify(entry.call_when ?? []),
          JSON.stringify(entry.tags ?? []),
          entry.filename,
          now,
          now,
        );
        byTier[tier] = (byTier[tier] ?? 0) + 1;
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        typeSet.add(entry.type);
      }
    });

    const total = (
      db.raw
        .prepare(
          "SELECT COUNT(*) AS count FROM creative_material_library WHERE library_id = ?",
        )
        .get(libraryId) as { count: number }
    ).count;

    console.log(
      JSON.stringify(
        {
          database: dbPath,
          libraryId,
          imported: prepared.length,
          totalInDb: total,
          byTier,
          byStatus,
          uniqueTypes: typeSet.size,
          missingBodies,
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
