import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  installNarutoThirdWarKonohaSlice,
  NARUTO_THIRD_WAR_KONOHA_SLICE_KEY,
  NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
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
    resolve(root, process.env.NARRATIVE_DATA_DIR ?? "data", "narralume.sqlite"),
);

const db = new NodeNarrativeDatabase(dbPath);
try {
  db.migrate();
  const report = installNarutoThirdWarKonohaSlice(db);
  console.log(
    JSON.stringify(
      {
        database: dbPath,
        sliceKey: NARUTO_THIRD_WAR_KONOHA_SLICE_KEY,
        worldTime: NARUTO_THIRD_WAR_KONOHA_WORLD_TIME,
        ...report,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
