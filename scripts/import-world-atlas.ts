/**
 * Universal incremental importer for Module 2 World Atlas data.
 *
 * Supports either:
 *   1) A single bundle JSON (`--input datasets/world-atlas/naruto-atlas-cards.json`)
 *   2) A world directory (`--dir datasets/world-atlas/one-piece`) containing:
 *        - `world.json`: `{ id, name, kind, description }`
 *        - `batch-*.json`: `{ cards: [...] }` or `[...]`
 *
 * Safe to run repeatedly after each micro-batch: upserts cards, preserves
 * existing cards in the same world, rebuilds all typed [[target]] relations,
 * and reports unresolved [[links]] as candidates for the next batch.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { WorldAtlasCardKind } from "@narralume/contracts";
import {
  NARUTO_DATTEBAYO_CORPUS,
  NARUTO_WIKI_CORPUS,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";

interface WorldMeta {
  id: string;
  name: string;
  kind: "fictional" | "historical" | "real" | "hybrid";
  description: string;
}

interface AtlasCardInput {
  entityKey: string;
  kind: WorldAtlasCardKind;
  name: string;
  aliases?: string[];
  content: string;
}

interface AtlasBundle {
  world: WorldMeta;
  cards: AtlasCardInput[];
}

const VALID_KINDS = new Set<string>([
  "location",
  "organization",
  "institution",
  "position",
  "rule",
  "ability",
  "technology",
  "creature",
  "resource",
  "item",
  "character",
  "population",
  "activity",
  "event",
  "information",
  "work",
  "other",
]);

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function loadFromDirectory(dirPath: string): Promise<AtlasBundle> {
  const worldRaw = await readFile(resolve(dirPath, "world.json"), "utf8");
  const world = JSON.parse(worldRaw) as WorldMeta;
  const entries = (await readdir(dirPath))
    .filter((file) => /^batch-.*\.json$/i.test(file))
    .sort((a, b) => a.localeCompare(b));

  const byKey = new Map<string, AtlasCardInput>();
  for (const file of entries) {
    const raw = JSON.parse(
      await readFile(resolve(dirPath, file), "utf8"),
    ) as AtlasCardInput[] | { cards?: AtlasCardInput[] };
    const cards = Array.isArray(raw) ? raw : (raw.cards ?? []);
    for (const card of cards) {
      byKey.set(card.entityKey, card);
    }
  }
  return { world, cards: [...byKey.values()] };
}

function validateBundle(bundle: AtlasBundle, sourceLabel: string): void {
  if (!bundle.world?.id || !bundle.world?.name) {
    throw new Error(`Invalid world metadata in ${sourceLabel}`);
  }
  if (!Array.isArray(bundle.cards) || bundle.cards.length === 0) {
    throw new Error(`No cards found in ${sourceLabel}`);
  }
  for (const card of bundle.cards) {
    if (!card.entityKey?.trim() || !card.name?.trim() || !card.content?.trim()) {
      throw new Error(
        `Card missing required fields in ${sourceLabel}: ${JSON.stringify(card).slice(0, 120)}`,
      );
    }
    if (!VALID_KINDS.has(card.kind)) {
      throw new Error(
        `Invalid card kind "${card.kind}" for "${card.name}" (${card.entityKey})`,
      );
    }
  }
}

async function main(): Promise<void> {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const dirArg = option("--dir");
  const inputArg = option("--input");
  if (!dirArg && !inputArg) {
    throw new Error(
      "Specify --dir datasets/world-atlas/<worldId> or --input <bundle.json>",
    );
  }

  const sourcePath = resolve(dirArg ?? inputArg!);
  const bundle: AtlasBundle = dirArg
    ? await loadFromDirectory(sourcePath)
    : (JSON.parse(await readFile(sourcePath, "utf8")) as AtlasBundle);

  validateBundle(bundle, basename(sourcePath));

  const dbPath = resolve(
    option("--db") ??
      process.env.NARRATIVE_DB_PATH ??
      resolve(
        root,
        process.env.NARRATIVE_DATA_DIR ?? "data",
        "narralume.sqlite",
      ),
  );

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
      if (bundle.world.id === "naruto") {
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
      }
    });

    // Pass 1: upsert all incoming cards so targets exist before relation indexing.
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

    // Pass 2: reindex every card in the world so new & existing cards cross-link.
    const allCards = worlds.listCards(bundle.world.id, "", { limit: 10000 });
    const unresolvedCounts = new Map<string, number>();
    for (const rec of allCards) {
      const unresolved = worlds.reindexCard(bundle.world.id, rec.sourceKey);
      for (const item of unresolved) {
        unresolvedCounts.set(
          item.target,
          (unresolvedCounts.get(item.target) ?? 0) + 1,
        );
      }
    }

    const totalLinksRow = db.raw
      .prepare("SELECT COUNT(*) AS count FROM source_relations WHERE corpus_id = ?")
      .get(canonicalCorpusId) as { count: number };
    const totalLinks = totalLinksRow?.count ?? 0;

    const kindCounts: Record<string, number> = {};
    for (const rec of allCards) {
      kindCounts[rec.kind] = (kindCounts[rec.kind] ?? 0) + 1;
    }

    const topUnresolved = [...unresolvedCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    console.log(
      JSON.stringify(
        {
          worldId: bundle.world.id,
          worldName: bundle.world.name,
          incomingCards: bundle.cards.length,
          totalCardsInWorld: allCards.length,
          totalRelations: totalLinks,
          kindCounts,
          unresolvedTargetCount: unresolvedCounts.size,
          topUnresolvedTargets: topUnresolved.map(([name, refs]) => ({
            name,
            refs,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    db.close();
  }
}

void main();
