import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditWorldAtlasProduction } from "@narralume/narrative";
import { projectSourceWorldForProduction } from "@narralume/narrative";
import {
  NARUTO_SOURCE_WORLD_ID,
  SqliteUnifiedSourceWorldRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
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
const focus = option("--focus") ?? "Konohagakure";
const worldTime = option("--world-time") ?? "原作全时代参考";

const db = new NodeNarrativeDatabase(dbPath);
try {
  db.migrate();
  const worlds = new SqliteUnifiedSourceWorldRepository(db);
  const world = worlds.getWorld(NARUTO_SOURCE_WORLD_ID);
  if (!world)
    throw new Error(
      "Naruto Source World is not installed. Run npm run import:naruto first.",
    );
  const view = projectSourceWorldForProduction(worlds, NARUTO_SOURCE_WORLD_ID, {
    requestId: "00000000-0000-4000-8000-000000000901",
    scale: "W1",
    premise: "审计火影原生母体局部世界是否足以继续生产",
    worldTime,
    focus,
    genre: "火影同人",
    scarcity: "",
    instruction: "",
    parentAreaId: null,
  });
  const audit = auditWorldAtlasProduction(view);
  const counts = new Map<string, number>();
  for (const node of view.nodes)
    counts.set(node.atlasKind ?? node.type, (counts.get(node.atlasKind ?? node.type) ?? 0) + 1);

  console.log(
    JSON.stringify(
      {
        world: { id: world.id, name: world.name },
        focus,
        selected: {
          nodes: view.nodes.length,
          links: view.links.length,
          activities: view.activities.length,
          interactions: view.interactions?.length ?? 0,
          kinds: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
          sample: view.nodes.slice(0, 30).map((node) => ({
            ref: node.localId,
            kind: node.atlasKind ?? node.type,
            name: node.name,
            areaRef: node.areaRef,
          })),
        },
        families: audit.families.map((family) => ({
          family: family.family,
          status: family.status,
          reason: family.reason,
          evidenceCount: family.evidence.length,
          suggestedWorkshop: family.suggestedWorkshop,
        })),
        peopleConnectedWorldObjects: audit.peopleConnectedWorldObjects.length,
        orphanWorldObjects: audit.orphanWorldObjects.length,
        nextWorkshop: audit.nextWorkshop,
        nextReason: audit.nextReason,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
