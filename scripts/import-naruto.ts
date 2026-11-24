/**
 * Install Naruto ORIGINAL SOURCE reference material into the SAME NarraLume
 * narralume.sqlite. Never copy all-time wiki claims into Project Canon.
 *
 * npm run import:naruto -- --project <existing-project-id>
 * npm run import:naruto -- --db /path/to/narralume.sqlite --offline /downloaded/data
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import {
  NARUTO_COLLECTIONS,
  NARUTO_DATTEBAYO_CORPUS,
  NARUTO_WIKI_CORPUS,
  SqliteSourceCorpusRepository,
  importNarutoDattebayo,
  importNarutoWikiScraper,
  installNarutoSourceWorld,
  type NarutoData,
} from "@narralume/persistence";

const DATTEBAYO_REF = "a3871a6c931cd1f503af0bc16c80007c3a9ecda9";
const WIKI_REF = "99ee5a0ff082e7c79540e0ad17b8f308ea965803";
const DATTEBAYO = `https://raw.githubusercontent.com/viniciusschuelter/dattebayo-api/${DATTEBAYO_REF}/src/data`;
const WIKI = `https://raw.githubusercontent.com/simon8800/naruto-wiki-scraper/${WIKI_REF}/cleanCharacters.json`;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}
const flag = (name: string): boolean => process.argv.includes(name);
async function loadJson(url: string, localPath?: string): Promise<unknown> {
  if (localPath)
    return JSON.parse(await readFile(localPath, "utf8")) as unknown;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok)
    throw new Error(`Download failed ${response.status}: ${url}`);
  return (await response.json()) as unknown;
}
async function main(): Promise<void> {
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
  const offline = option("--offline");
  const projectId = option("--project");
  const skipWiki = flag("--skip-wiki");
  if (flag("--help")) {
    console.log(
      "npm run import:naruto -- [--db /path/narralume.sqlite] [--project PROJECT_ID] [--offline DIRECTORY] [--skip-wiki]",
    );
    return;
  }

  // Download / parse BEFORE touching the database. A failure in the source
  // fetch leaves the existing NarraLume DB unchanged.
  const data: Partial<NarutoData> = {};
  for (const collection of NARUTO_COLLECTIONS) {
    const value = await loadJson(
      `${DATTEBAYO}/${collection}.json`,
      offline ? resolve(offline, collection + ".json") : undefined,
    );
    if (!Array.isArray(value))
      throw new Error(`${collection}.json is not a JSON array`);
    data[collection] = value;
    console.log(`Downloaded ${collection}: ${value.length}`);
  }
  const wiki = skipWiki
    ? null
    : await loadJson(
        WIKI,
        offline ? resolve(offline, "cleanCharacters.json") : undefined,
      );
  if (!skipWiki && !Array.isArray(wiki))
    throw new Error("cleanCharacters.json is not a JSON array");

  const db = new NodeNarrativeDatabase(dbPath);
  try {
    db.migrate();
    const refs = new SqliteSourceCorpusRepository(db);
    const sourceStats = importNarutoDattebayo(db, data as NarutoData);
    const wikiStats = Array.isArray(wiki)
      ? importNarutoWikiScraper(db, wiki)
      : null;
    const sourceWorld = installNarutoSourceWorld(db);
    if (projectId) {
      // Bind reference sources to ONE novel's reader context. No Canon
      // entities, actual character abilities or future events are promoted.
      db.transaction(() => {
        refs.bindProject(projectId, NARUTO_DATTEBAYO_CORPUS);
        if (wikiStats) refs.bindProject(projectId, NARUTO_WIKI_CORPUS);
      });
    }
    console.log(
      JSON.stringify(
        {
          database: dbPath,
          projectId: projectId ?? null,
          source: sourceStats,
          wiki: wikiStats,
          sourceWorld,
          corpusList: refs.listCorpora(),
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
