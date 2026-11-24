import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOURCE_WORLD_CATALOG,
  buildSourceIdentityBridge,
  getSourceWorldCatalogEntry,
  installSourceWorldSeed,
  mergeSourceWorldSeeds,
  normalizeBleachDatabase,
  normalizeHunterXHunterMindMaps,
  normalizeHunterXHunterRoster,
  normalizeHunterXHunterStatic,
  normalizeOnePieceDataset,
  normalizeOnePieceWikiGraph,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
  type SourceWorldCatalogEntry,
  type SourceWorldSeed,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { setTimeout as delay } from "node:timers/promises";
import { withPinnedGitHubCheckout } from "./lib/pinned-github-source.js";
import { readStaticExportedArray } from "./lib/static-typescript-data.js";

type JsonObject = Record<string, unknown>;

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

async function loadSeed(
  entry: SourceWorldCatalogEntry,
): Promise<SourceWorldSeed> {
  if (entry.id === "one-piece") return loadOnePieceSeed(entry);
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
  if (entry.id === "hunter-x-hunter") return loadHunterXHunterSeed(entry);
  throw new Error(
    entry.id === "naruto"
      ? "Naruto keeps its richer specialized importer. Use npm run import:naruto."
      : "No runtime adapter for Source World: " + entry.id,
  );
}

async function loadOnePieceSeed(
  entry: SourceWorldCatalogEntry,
): Promise<SourceWorldSeed> {
  const legacySource = upstream(entry, "one-piece-dataset");
  const [characters, crews] = await Promise.all([
    fetchJson(rawUrl(legacySource, "characters.json")),
    fetchJson(rawUrl(legacySource, "pirate-crews.json")),
  ]);
  const legacy = normalizeOnePieceDataset({ characters, crews });
  const richSource = upstream(entry, "one-piece-wiki-graph");
  if (!richSource.repository || !richSource.ref || !richSource.paths)
    throw new Error("One Piece rich source manifest incomplete");

  const rich = withPinnedGitHubCheckout(
    {
      repository: richSource.repository,
      ref: richSource.ref,
      paths: richSource.paths,
    },
    (root) => {
      const base = join(root, "data/universes/one-piece");
      const entities = readJsonObjectsRecursively(join(base, "entities"));
      const translations = readTranslationMap(
        join(base, "translations/en"),
      );
      console.log(
        "One Piece rich graph: " +
          entities.length +
          " entities, " +
          Object.keys(translations).length +
          " English labels",
      );
      return normalizeOnePieceWikiGraph({
        entities,
        translations,
        canonicalByIdentity: buildSourceIdentityBridge(legacy),
      });
    },
  );

  // Rich graph is first so a fresh database gets its detailed evidence as the
  // representative card; the legacy seed maps to the same canonical identity.
  return mergeSourceWorldSeeds(rich, legacy);
}

async function loadHunterXHunterSeed(
  entry: SourceWorldCatalogEntry,
): Promise<SourceWorldSeed> {
  const staticSource = upstream(entry, "hxh-static-database");
  const [hunters, ryodan, chimeraAnts] = await Promise.all([
    fetchJson(rawUrl(staticSource, "src/data/hunters.json")),
    fetchJson(rawUrl(staticSource, "src/data/ryodan.json")),
    fetchJson(rawUrl(staticSource, "src/data/chimeraAnts.json")),
  ]);
  const staticSeed = normalizeHunterXHunterStatic({
    hunters,
    ryodan,
    chimeraAnts,
  });

  const mindMapsSource = upstream(entry, "hxh-mindmaps-world");
  if (
    !mindMapsSource.repository ||
    !mindMapsSource.ref ||
    !mindMapsSource.paths
  )
    throw new Error("HxH MindMaps source manifest incomplete");

  const mindMaps = withPinnedGitHubCheckout(
    {
      repository: mindMapsSource.repository,
      ref: mindMapsSource.ref,
      paths: mindMapsSource.paths,
    },
    (root) => {
      const base = join(root, "src/data/hunterxhunter");
      const characters = readManyStaticArrays(base, [
        ["characters.ts", "hxhCharacters"],
        ["charactersBatch1.ts", "hxhCharactersBatch1"],
        ["charactersBatch2.ts", "hxhCharactersBatch2"],
        ["charactersBatch3.ts", "hxhCharactersBatch3"],
        ["charactersBatch4.ts", "hxhCharactersBatch4"],
        ["charactersBatch5.ts", "hxhCharactersBatch5"],
        ["charactersBatch6.ts", "hxhCharactersBatch6"],
        ["charactersBatch7.ts", "hxhCharactersBatch7"],
        ["completion.ts", "hxhCompletionCharacters"],
      ]);
      const factions = readManyStaticArrays(base, [
        ["factions.ts", "hxhFactions"],
        ["factionsBatch1.ts", "hxhFactionsBatch1"],
        ["completion.ts", "hxhCompletionFactions"],
      ]);
      const locations = readManyStaticArrays(base, [
        ["locations.ts", "hxhLocations"],
        ["locationsBatch1.ts", "hxhLocationsBatch1"],
        ["submapLocations.ts", "hxhSubmapLocations"],
        ["completion.ts", "hxhCompletionLocations"],
      ]);
      const nations = readManyStaticArrays(base, [
        ["nations.ts", "hxhNations"],
      ]);
      const arcs = readManyStaticArrays(base, [["arcs.ts", "hxhArcs"]]);
      const events = readManyStaticArrays(base, [
        ["events.ts", "hxhEvents"],
        ["eventsBatch1.ts", "hxhEventsBatch1"],
        ["eventsBatch2.ts", "hxhEventsBatch2"],
        ["eventsBatch3.ts", "hxhEventsBatch3"],
        ["eventsBatch4.ts", "hxhEventsBatch4"],
        ["completion.ts", "hxhCompletionEvents"],
      ]);
      const abilities = readManyStaticArrays(base, [
        ["nen.ts", "hxhNen"],
        ["nenBatch1.ts", "hxhNenBatch1"],
        ["nenBatch2.ts", "hxhNenBatch2"],
        ["nenBatch3.ts", "hxhNenBatch3"],
      ]);
      const routes = readManyStaticArrays(base, [
        ["routes.ts", "hxhRoutes"],
        ["routesBatch1.ts", "hxhRoutesBatch1"],
        ["routesBatch2.ts", "hxhRoutesBatch2"],
      ]);
      console.log(
        "HxH MindMaps graph: " +
          [
            characters.length + " characters",
            factions.length + " factions",
            locations.length + nations.length + " places/nations",
            events.length + arcs.length + " events/arcs",
            abilities.length + " abilities",
            routes.length + " routes",
          ].join(", "),
      );
      return normalizeHunterXHunterMindMaps({
        characters,
        factions,
        locations,
        nations,
        arcs,
        events,
        abilities,
        routes,
        canonicalByIdentity: buildSourceIdentityBridge(staticSeed),
      });
    },
  );

  const rosterSource = upstream(entry, "hxh-roster");
  if (!rosterSource.repository || !rosterSource.ref || !rosterSource.paths)
    throw new Error("HxH roster source manifest incomplete");
  const roster = withPinnedGitHubCheckout(
    {
      repository: rosterSource.repository,
      ref: rosterSource.ref,
      paths: rosterSource.paths,
    },
    (root) => {
      const parsed = JSON.parse(
        readFileSync(
          join(root, "foundry/website/html/hxh/roster.json"),
          "utf8",
        ),
      ) as unknown;
      if (!Array.isArray(parsed))
        throw new Error("HxH roster is not an array");
      return normalizeHunterXHunterRoster({
        roster: parsed.filter(isJsonObject),
        canonicalByIdentity: buildSourceIdentityBridge(
          staticSeed,
          mindMaps,
        ),
      });
    },
  );

  return mergeSourceWorldSeeds(mindMaps, roster, staticSeed);
}

function readManyStaticArrays(
  base: string,
  specs: ReadonlyArray<readonly [string, string]>,
): JsonObject[] {
  return specs.flatMap(([file, exportName]) =>
    readStaticExportedArray(join(base, file), exportName),
  );
}

function readJsonObjectsRecursively(directory: string): JsonObject[] {
  const out: JsonObject[] = [];
  for (const path of walkFiles(directory)) {
    if (!path.endsWith(".json")) continue;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (isJsonObject(parsed)) out.push(parsed);
  }
  return out;
}

function readTranslationMap(directory: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of walkFiles(directory)) {
    if (!path.endsWith(".json")) continue;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!isJsonObject(parsed)) continue;
    for (const [key, value] of Object.entries(parsed))
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

function walkFiles(directory: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
      resolve(
        root,
        process.env.NARRATIVE_DATA_DIR ?? "data",
        "narralume.sqlite",
      ),
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
      if (projectId) sources.bindProject(projectId, report.canonicalCorpusId);
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
