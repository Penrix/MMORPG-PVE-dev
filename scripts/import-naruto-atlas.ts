/**
 * Import a curated Chinese World Atlas JSON bundle (e.g. Naruto full-timeline
 * Source World) into Module 2's unified Source World / World Atlas database
 * and rebuild all typed semantic links and relation indexes.
 *
 * Usage:
 *   npx tsx scripts/import-naruto-atlas.ts
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { WorldAtlasCardKind } from "@narralume/contracts";
import {
  NARUTO_DATTEBAYO_CORPUS,
  NARUTO_WIKI_CORPUS,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";

interface AtlasBundle {
  world: {
    id: string;
    name: string;
    kind: "fictional" | "historical" | "real" | "hybrid";
    description: string;
  };
  cards: Array<{
    entityKey: string;
    kind: WorldAtlasCardKind;
    name: string;
    aliases?: string[];
    content: string;
  }>;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const inputPath = resolve(
    option("--input") ??
      resolve(root, "datasets/world-atlas/naruto-atlas-cards.json"),
  );
  const dbPath = resolve(
    option("--db") ??
      process.env.NARRATIVE_DB_PATH ??
      resolve(
        root,
        process.env.NARRATIVE_DATA_DIR ?? "data",
        "narralume.sqlite",
      ),
  );

  const bundle = JSON.parse(await readFile(inputPath, "utf8")) as AtlasBundle;
  if (!bundle.world?.id || !Array.isArray(bundle.cards)) {
    throw new Error("Invalid World Atlas JSON bundle");
  }

  const db = new NodeNarrativeDatabase(dbPath);
  try {
    db.migrate();
    const sources = new SqliteSourceCorpusRepository(db);
    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    const now = new Date().toISOString();

    const canonicalCorpusId = `wiki:${bundle.world.id}`;
    const existing = worlds.getWorld(bundle.world.id);
    db.transaction(() => {
      sources.upsertCorpus({
        id: canonicalCorpusId,
        title: `${bundle.world.name}：整理版原生百科`,
        sourceUrl: "",
        rightsNotice: "Source evidence retains its original licenses",
        importer: "curated-original-world-wiki",
        metadata: { worldId: bundle.world.id },
        importedAt: now,
      });
      if (!existing) {
        worlds.createWorld({
          id: bundle.world.id,
          name: bundle.world.name,
          kind: bundle.world.kind,
          description: bundle.world.description,
          canonicalCorpusId,
          createdAt: now,
        });
      }
      // Attach imported Naruto evidence corpora when present.
      const existingCorpora = new Set(
        sources.listCorpora().map((corpus) => corpus.id),
      );
      for (const [corpusId, evidenceRole] of [
        [NARUTO_DATTEBAYO_CORPUS, "primary"],
        [NARUTO_WIKI_CORPUS, "supporting"],
      ] as const) {
        if (existingCorpora.has(corpusId)) {
          worlds.addEvidenceCorpus({
            worldId: bundle.world.id,
            corpusId,
            evidenceRole,
          });
        }
      }
    });

    // Pass 1: upsert all cards so every target [[name]] exists in the world.
    for (const card of bundle.cards) {
      worlds.upsertCard({
        worldId: bundle.world.id,
        entityKey: card.entityKey,
        kind: card.kind,
        name: card.name,
        aliases: card.aliases ?? [],
        content: card.content,
        now,
      });
    }

    // Pass 2: re-upsert/reindex so forward-referenced [[links]] resolve cleanly.
    let resolvedLinks = 0;
    let unresolvedLinks = 0;
    const byKind: Record<string, number> = {};
    for (const card of bundle.cards) {
      const result = worlds.upsertCard({
        worldId: bundle.world.id,
        entityKey: card.entityKey,
        kind: card.kind,
        name: card.name,
        aliases: card.aliases ?? [],
        content: card.content,
        now,
      });
      byKind[card.kind] = (byKind[card.kind] ?? 0) + 1;
      resolvedLinks += result.resolvedLinkCount;
      unresolvedLinks += result.unresolvedLinkCount;
    }

    console.log(
      JSON.stringify(
        {
          database: dbPath,
          worldId: bundle.world.id,
          worldName: bundle.world.name,
          cardsImported: bundle.cards.length,
          byKind,
          resolvedLinks,
          unresolvedLinks,
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
