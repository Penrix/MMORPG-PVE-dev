import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOURCE_WORLD_CATALOG,
  getSourceWorldCatalogEntry,
  installSourceWorldSeed,
  normalizeBleachDatabase,
  normalizeHunterXHunterJikan,
  normalizeOnePieceDataset,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
  type SourceWorldCatalogEntry,
  type SourceWorldSeed,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { setTimeout as delay } from "node:timers/promises";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}
const flag = (name: string): boolean => process.argv.includes(name);

async function fetchJson(url: string): Promise<unknown> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "NarraLume-SourceWorldImporter/1.0" },
        signal: AbortSignal.timeout(60_000),
      });
      if (response.ok) return (await response.json()) as unknown;
      last = new Error("HTTP " + response.status + " for " + url);
      if (response.status !== 429 && response.status < 500) throw last;
    } catch (error) {
      last = error;
    }
    await delay(1_000 * (attempt + 1));
  }
  throw last instanceof Error ? last : new Error("Download failed: " + url);
}

function upstream(entry: SourceWorldCatalogEntry, id: string) {
  const value = entry.upstreams.find((candidate) => candidate.id === id);
  if (!value) throw new Error("Missing upstream: " + entry.id + "/" + id);
  return value;
}

function rawUrl(
  source: SourceWorldCatalogEntry["upstreams"][number],
  path: string,
): string {
  if (!source.repository || !source.ref)
    throw new Error("GitHub upstream is missing repository/ref: " + source.id);
  return (
    "https://raw.githubusercontent.com/" +
    source.repository +
    "/" +
    source.ref +
    "/" +
    path
  );
}

async function loadSeed(entry: SourceWorldCatalogEntry): Promise<SourceWorldSeed> {
  if (entry.id === "one-piece") {
    const source = upstream(entry, "one-piece-dataset");
    const characters = await fetchJson(rawUrl(source, "characters.json"));
    const crews = await fetchJson(rawUrl(source, "pirate-crews.json"));
    return normalizeOnePieceDataset({ characters, crews });
  }
  if (entry.id === "bleach") {
    const source = upstream(entry, "bleach-database");
    const [shinigami, arrancar, quincy, humans] = await Promise.all([
      fetchJson(rawUrl(source, "data/shinigami.json")),
      fetchJson(rawUrl(source, "data/arrancar.json")),
      fetchJson(rawUrl(source, "data/quincy.json")),
      fetchJson(rawUrl(source, "data/humans.json")),
    ]);
    return normalizeBleachDatabase({ shinigami, arrancar, quincy, humans });
  }
  if (entry.id === "hunter-x-hunter") {
    const source = upstream(entry, "jikan-hxh-2011-cast");
    if (!source.endpoint)
      throw new Error("Jikan upstream endpoint is missing");
    return normalizeHunterXHunterJikan(await fetchJson(source.endpoint));
  }
  throw new Error(
    entry.id === "naruto"
      ? "Naruto keeps its richer specialized importer. Use npm run import:naruto."
      : "No runtime adapter for Source World: " + entry.id,
  );
}

async function main(): Promise<void> {
  if (flag("--list")) {
    console.log(
      JSON.stringify(
        SOURCE_WORLD_CATALOG.map((entry) => ({
          id: entry.id,
          name: entry.name,
          aliases: entry.aliases,
          canonicalCorpusId: entry.canonicalCorpusId,
          adapters: entry.upstreams.map((source) => ({
            id: source.id,
            adapter: source.adapter,
            role: source.role,
          })),
        })),
        null,
        2,
      ),
    );
    return;
  }

  const requested = option("--world");
  const importAll = flag("--all");
  if (!requested && !importAll) {
    console.log(
      "Usage: npm run import:source-world -- --world <one-piece|bleach|hunter-x-hunter> [--db path] [--project id]\n" +
        "       npm run import:source-world -- --all [--db path] [--project id]\n" +
        "       npm run import:source-world -- --list\n" +
        "Naruto keeps the mature specialized path: npm run import:naruto.",
    );
    return;
  }

  const selected = importAll
    ? SOURCE_WORLD_CATALOG.filter((entry) => entry.id !== "naruto")
    : [getSourceWorldCatalogEntry(requested ?? "")].filter(
        (entry): entry is SourceWorldCatalogEntry => entry !== null,
      );
  if (!selected.length)
    throw new Error("Unknown Source World: " + (requested ?? ""));

  // Fetch/parse every selected upstream before touching SQLite.
  const seeds: SourceWorldSeed[] = [];
  for (const entry of selected) {
    console.log("Loading Source World upstream: " + entry.id);
    seeds.push(await loadSeed(entry));
  }

  const root = fileURLToPath(new URL("../", import.meta.url));
  const dbPath = resolve(
    option("--db") ??
      process.env.NARRATIVE_DB_PATH ??
      resolve(root, process.env.NARRATIVE_DATA_DIR ?? "data", "narralume.sqlite"),
  );
  const projectId = option("--project");

  const db = new NodeNarrativeDatabase(dbPath);
  try {
    db.migrate();
    const sources = new SqliteSourceCorpusRepository(db);
    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    const reports = [];
    for (const seed of seeds) {
      const report = installSourceWorldSeed(db, seed);
      if (projectId)
        sources.bindProject(projectId, report.canonicalCorpusId);
      reports.push({
        ...report,
        cardCount: worlds.listCardKeys(report.worldId).length,
      });
    }
    console.log(
      JSON.stringify(
        {
          database: dbPath,
          projectId: projectId ?? null,
          reports,
          worlds: worlds.listWorlds(),
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
