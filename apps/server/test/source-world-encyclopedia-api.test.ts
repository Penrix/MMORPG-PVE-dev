import { createProject } from "@narralume/domain";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import {
  SqliteCanonRepository,
  SqliteProjectRepository,
  SqliteSourceCorpusRepository,
} from "@narralume/persistence";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { ServerConfig } from "../src/config.js";

const config: ServerConfig = {
  dataDirectory: ".",
  databasePath: ":memory:",
  host: "127.0.0.1",
  port: 4317,
  environment: "test",
};
const opened: Array<{
  app: Awaited<ReturnType<typeof buildApp>>;
  db: NodeNarrativeDatabase;
}> = [];
afterEach(async () => {
  while (opened.length) {
    const r = opened.pop()!;
    await r.app.close();
    r.db.close();
  }
});

describe("original mother-world wiki API is independent of novel Canon", () => {
  it("opens and enriches a full Naruto reference dossier without writing either novel", async () => {
    const db = new NodeNarrativeDatabase();
    const app = await buildApp({
      config,
      database: db,
      enableRunWorker: false,
      logger: false,
    });
    opened.push({ app, db });
    const now = "2026-11-21T00:00:00Z";
    const projects = new SqliteProjectRepository(db);
    projects.insert(createProject({ id: "novel", title: "火影同人", now }));
    projects.insert(createProject({ id: "other", title: "其它同人", now }));
    const sources = new SqliteSourceCorpusRepository(db);
    sources.upsertCorpus({
      id: "naruto",
      title: "火影维基",
      sourceUrl: "https://example.org/wiki",
      rightsNotice: "test",
      importer: "fixture",
      metadata: {},
      importedAt: now,
    });
    for (const [key, name, kind] of [
      ["madara", "宇智波斑", "character"],
      ["uchiha", "宇智波一族", "organization"],
      ["sharingan", "写轮眼", "ability"],
    ] as const)
      sources.upsertRecord({
        corpusId: "naruto",
        sourceKey: key,
        kind,
        name,
        aliases: [],
        summary: "原著世界资料",
        raw: { name },
        sourceUrl: "https://example.org/wiki/" + key,
        originCollection: "fixture",
        importedAt: now,
      });
    sources.upsertRelation({
      corpusId: "naruto",
      fromKey: "madara",
      toKey: "uchiha",
      relation: "historical_leader",
      sourceNote: "母体人物关系",
    });
    sources.bindProject("novel", "naruto");
    const read = async (path: string) =>
      app.inject({ method: "GET", url: path });
    const wikiUrl = "/api/source-corpora/naruto/encyclopedia/madara";
    const before = await read(wikiUrl);
    expect(before.statusCode).toBe(200);
    expect(before.json().record.sourceKey).toBe("madara");
    expect(before.json().lore).toHaveLength(0);
    const section = await app.inject({
      method: "POST",
      url: wikiUrl + "/sections",
      payload: {
        sectionKey: "biography",
        title: "宇智波斑的编年史",
        content: "人物的历史和关系需要完整来源，不止姓名和能力列表",
        sourceNote: "作者整理的来源说明",
      },
    });
    expect(section.statusCode).toBe(201);
    const ability = await app.inject({
      method: "POST",
      url: "/api/source-corpora/naruto/encyclopedia/sharingan/ability",
      payload: {
        powerMode: "supernatural",
        mechanism: "瞳术的已核实具体规则",
        actualEffects: "可执行的能力表现",
        sourceNote: "只录入已核对的来源，不强制制造代价",
      },
    });
    expect(ability.statusCode).toBe(201);
    const encyclopedia = await read(wikiUrl);
    expect(encyclopedia.json().lore[0].title).toBe("宇智波斑的编年史");
    expect(encyclopedia.json().relations[0].otherName).toBe("宇智波一族");
    const eye = await read("/api/source-corpora/naruto/encyclopedia/sharingan");
    expect(eye.json().ability).toEqual(
      expect.objectContaining({
        mechanism: "瞳术的已核实具体规则",
        constraints: "",
        counters: "",
      }),
    );
    const bound = await read(
      "/api/projects/novel/source-encyclopedia/naruto/madara",
    );
    expect(bound.statusCode).toBe(200);
    expect(bound.json().record.sourceKey).toBe("madara");
    const denied = await read(
      "/api/projects/other/source-encyclopedia/naruto/madara",
    );
    expect(denied.statusCode).toBe(404);
    expect(new SqliteCanonRepository(db).listEntities("novel")).toHaveLength(0);
    expect(
      new SqliteCanonRepository(db).listEffectiveFacts("novel"),
    ).toHaveLength(0);
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
