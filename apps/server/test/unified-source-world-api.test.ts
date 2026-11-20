import { createCanonEntity, createCanonFact, createProject } from "@narralume/domain";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import {
  SqliteSourceCorpusRepository,
  SqliteProjectRepository,
  SqliteCanonRepository,
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

describe("one curated original world wiki over several upstream corpora", () => {
  it("resolves Madara from multiple original sources, then shares that one wiki across projects", async () => {
    const db = new NodeNarrativeDatabase();
    const app = await buildApp({
      config,
      database: db,
      enableRunWorker: false,
      logger: false,
    });
    opened.push({ app, db });
    const now = "2026-11-21T00:00:00Z";
    const source = new SqliteSourceCorpusRepository(db);
    const projects = new SqliteProjectRepository(db);
    projects.insert(createProject({ id: "novel", title: "火影海贼穿越", now }));
    projects.insert(createProject({ id: "other", title: "另一部同人", now }));
    for (const id of ["dattebayo", "wiki-scraper"]) {
      source.upsertCorpus({
        id,
        title: id,
        sourceUrl: "https://example.org/" + id,
        importer: "test",
        rightsNotice: "test",
        metadata: {},
        importedAt: now,
      });
      source.upsertRecord({
        corpusId: id,
        sourceKey: id === "dattebayo" ? "character:123" : "Madara",
        name: "Madara Uchiha",
        kind: "character",
        aliases: [],
        summary: "人物传记来源版本：" + id,
        raw: { origin: id, history: "与源版本相关的历史内容" },
        sourceUrl: "https://example.org/" + id + "/Madara",
        originCollection: "characters",
        importedAt: now,
      });
    }
    const json = async (
      method: "GET" | "POST",
      url: string,
      payload?: unknown,
    ) => {
      const r = await app.inject({
        method,
        url,
        ...(payload === undefined ? {} : { payload }),
      });
      return { status: r.statusCode, body: r.json() };
    };
    const created = await json("POST", "/api/source-worlds", {
      id: "naruto",
      name: "火影原生世界",
      kind: "fictional",
      description: "能反复供新书 Fork 的独立原著维基",
    });
    expect(created.status).toBe(201);
    expect(created.body.canonicalCorpusId).toBe("wiki:naruto");
    const registry = await json("GET", "/api/source-worlds");
    expect(registry.body).toEqual([expect.objectContaining({ id: "naruto" })]);
    for (const corpusId of ["dattebayo", "wiki-scraper"]) {
      const role = await json(
        "POST",
        "/api/source-worlds/naruto/evidence-corpora",
        {
          corpusId,
          evidenceRole: "supporting",
          sourceNote: "不同上游证据",
        },
      );
      expect(role.status).toBe(201);
    }
    const adopted = await json(
      "POST",
      "/api/source-worlds/naruto/entities/from-evidence",
      {
        canonicalKey: "character:madara",
        evidenceCorpusId: "dattebayo",
        evidenceKey: "character:123",
        matchKind: "same_identity",
        reviewStatus: "verified",
        sourceNote: "用户确认 Dattebayo 身份对应到整理版斑",
      },
    );
    expect(adopted.status).toBe(201);
    const linked = await json(
      "POST",
      "/api/source-worlds/naruto/entities/character:madara/evidence",
      {
        evidenceCorpusId: "wiki-scraper",
        evidenceKey: "Madara",
        matchKind: "same_identity",
        reviewStatus: "candidate",
        sourceNote: "待审核的另一版本，不能覆盖已确认资料",
      },
    );
    expect(linked.status).toBe(201);
    const lore = await json(
      "POST",
      "/api/source-corpora/wiki:naruto/encyclopedia/character:madara/sections",
      {
        sectionKey: "biography",
        title: "宇智波斑的完整编年史",
        content: "通过原著母体整理出的完整人物历史，而非某本新书剧情",
        sourceNote: "作者核对的来源说明",
      },
    );
    expect(lore.status).toBe(201);
    const dossier = await json(
      "GET",
      "/api/source-worlds/naruto/entities/character:madara",
    );
    expect(dossier.status).toBe(200);
    expect(dossier.body.dossier.record.sourceKey).toBe("character:madara");
    expect(dossier.body.dossier.lore[0].title).toBe("宇智波斑的完整编年史");
    expect(dossier.body.evidence).toHaveLength(2);
    expect(
      dossier.body.evidence
        .map(
          (e: { sourceDossier: { record: { raw: { origin: string } } } }) =>
            e.sourceDossier.record.raw.origin,
        )
        .sort(),
    ).toEqual(["dattebayo", "wiki-scraper"]);
    const bind = await json(
      "POST",
      "/api/projects/novel/source-worlds/naruto",
      {},
    );
    expect(bind.status).toBe(200);
    const bound = await json(
      "GET",
      "/api/projects/novel/source-worlds/naruto/character:madara",
    );
    expect(bound.status).toBe(200);
    const unbound = await json(
      "GET",
      "/api/projects/other/source-worlds/naruto/character:madara",
    );
    expect(unbound.status).toBe(404);
    const projectCanon=new SqliteCanonRepository(db);
    projectCanon.insertEntity(createCanonEntity({
      id:"madara-in-novel",projectId:"novel",
      name:"项目世界的宇智波斑",type:"character",now,
    }));
    const matched=await json("POST","/api/projects/novel/world-source-links",{
      entityId:"madara-in-novel",corpusId:"wiki:naruto",
      sourceKey:"character:madara",linkKind:"counterpart",
      confidence:1,sourceNote:"同一份原著百科的本书对应人物",
    });
    expect(matched.status).toBe(201);
    projectCanon.insertFact(createCanonFact({
      id:"new-history",projectId:"novel",subjectId:"madara-in-novel",
      predicate:"new_story_experience",value:"男主在新世界改变了其人生",
      authority:"confirmed",sourceType:"project-story",now,
    }));
    const projectDossier=await json("GET",
      "/api/projects/novel/world-encyclopedia/madara-in-novel");
    expect(projectDossier.status).toBe(200);
    expect(projectDossier.body.dossier.sourceIdentities[0]).toEqual(
      expect.objectContaining({
        corpusId:"wiki:naruto",sourceKey:"character:madara",
      }),
    );
    expect(projectDossier.body.dossier.facts.some(
      (fact:{predicate:string})=>fact.predicate==="new_story_experience",
    )).toBe(true);
    // Project changes do not rewrite the independently held original wiki.
    const unchanged=await json("GET",
      "/api/source-worlds/naruto/entities/character:madara");
    expect(unchanged.body.dossier.claims).toHaveLength(0);
    expect(unchanged.body.dossier.lore[0].title).toBe("宇智波斑的完整编年史");
    expect(projectCanon.listEntities("novel")).toHaveLength(1);
    expect(new SqliteCanonRepository(db).listEntities("other")).toHaveLength(0);
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
