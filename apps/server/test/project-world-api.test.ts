import { createCanonEntity, createProject } from "@narralume/domain";
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

describe("Project world: author-facing API, one reality and multiple source worlds", () => {
  it("opens Naruto + One Piece spaces, links original characters and records travel without creating another novel", async () => {
    const db = new NodeNarrativeDatabase();
    const app = await buildApp({
      config,
      database: db,
      enableRunWorker: false,
      logger: false,
    });
    opened.push({ app, db });
    const now = "2026-11-20T14:00:00Z";
    new SqliteProjectRepository(db).insert(
      createProject({
        id: "novel",
        title: "诸天男频同人",
        now,
      }),
    );
    const source = new SqliteSourceCorpusRepository(db);
    for (const corpusId of ["naruto", "onepiece"]) {
      source.upsertCorpus({
        id: corpusId,
        title: corpusId,
        sourceUrl: "https://example.org/" + corpusId,
        rightsNotice: "test",
        importer: "test",
        metadata: {},
        importedAt: now,
      });
      source.bindProject("novel", corpusId);
    }
    source.upsertRecord({
      corpusId: "naruto",
      sourceKey: "itachi",
      kind: "character",
      name: "宇智波鼬",
      aliases: [],
      summary: "源材料中的鼬",
      raw: { world: "naruto" },
      sourceUrl: "https://example.org/itachi",
      originCollection: "characters",
      importedAt: now,
    });
    const canon = new SqliteCanonRepository(db);
    for (const [id, name] of [
      ["hero", "原创男主"],
      ["itachi-proj", "项目世界宇智波鼬"],
    ] as const)
      canon.insertEntity(
        createCanonEntity({
          projectId: "novel",
          id,
          type: "character",
          name,
          now,
        }),
      );
    const createSpace = async (name: string, sourceCorpusId: string) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/projects/novel/world-spaces",
        payload: { name, kind: "realm", sourceCorpusId },
      });
      expect(res.statusCode).toBe(201);
      return res.json() as { id: string; name: string; projectId: string };
    };
    const ninja = await createSpace("忍界", "naruto");
    const ocean = await createSpace("大海世界", "onepiece");
    expect(ninja.projectId).toBe("novel");
    expect(ocean.projectId).toBe("novel");
    const linked = await app.inject({
      method: "POST",
      url: "/api/projects/novel/world-source-links",
      payload: {
        entityId: "itachi-proj",
        corpusId: "naruto",
        sourceKey: "itachi",
        linkKind: "counterpart",
        confidence: 0.9,
        sourceNote: "同人世界人物与原著参照的明确对应",
      },
    });
    expect(linked.statusCode).toBe(201);
    const links = await app.inject({
      method: "GET",
      url: "/api/projects/novel/world-source-links/itachi-proj",
    });
    expect(links.statusCode).toBe(200);
    expect(links.json()).toEqual([
      expect.objectContaining({ corpusId: "naruto", sourceKey: "itachi" }),
    ]);
    const anchored=await app.inject({
      method:"POST",
      url:"/api/projects/novel/world-fork/itachi-proj/core",
      payload:{
        sourceCorpusId:"naruto",sourceKey:"itachi",
        tags:["冷静","珍视重要的人"],
        decisionPattern:"先核实关系与风险再作决定",
        sourceNote:"测试作者明确批准的角色锚点，不是模型从姓名推断",
      },
    });
    expect(anchored.statusCode).toBe(201);
    const field=await app.inject({
      method:"POST",
      url:"/api/projects/novel/world-fork/itachi-proj/source-fields",
      payload:{
        sourceCorpusId:"naruto",sourceKey:"itachi",
        sourceJsonPath:"$.world",projectPredicate:"original_world",
      },
    });
    expect(field.statusCode).toBe(201);
    const fork=await app.inject({
      method:"GET",url:"/api/projects/novel/world-fork/itachi-proj",
    });
    expect(fork.statusCode).toBe(200);
    expect(fork.json()).toEqual(expect.objectContaining({
      core:expect.objectContaining({tags:["冷静","珍视重要的人"]}),
      compared:[expect.objectContaining({
        baseline:"naruto",status:"reference_inherited",
      })],
      additions:[],
    }));
    db.raw
      .prepare(
        `
      INSERT INTO timeline_events(
        id,project_id,title,sequence,visibility,created_at,updated_at
      ) VALUES ('travel','novel','男主进入海贼世界',1,'omniscient',?,?)
    `,
      )
      .run(now, now);
    const travel = await app.inject({
      method: "POST",
      url: "/api/projects/novel/world-travel",
      payload: {
        eventId: "travel",
        travelerEntityId: "hero",
        fromSpaceId: ninja.id,
        toSpaceId: ocean.id,
        departureTime: "忍界第三次忍界大战",
        arrivalTime: "大海贼时代",
        travelKind: "cross_world",
      },
    });
    expect(travel.statusCode).toBe(201);
    const history = await app.inject({
      method: "GET",
      url: "/api/projects/novel/world-travel/hero",
    });
    expect(history.statusCode).toBe(200);
    expect(history.json()).toEqual([
      expect.objectContaining({
        travelerEntityId: "hero",
        storySequence: 1,
        travelKind: "cross_world",
      }),
    ]);
    const coords = await app.inject({
      method: "GET",
      url: "/api/projects/novel/world-event-coordinates/travel",
    });
    expect(coords.json()).toHaveLength(2);
    expect(source.getRecord("naruto", "itachi")?.raw).toEqual({
      world: "naruto",
    });
    expect(
      canon.listEntities("novel").filter((e) => e.id === "hero"),
    ).toHaveLength(1);
    expect(
      db.raw.prepare("SELECT count(*) AS n FROM project_time_branches").get(),
    ).toEqual({ n: 0 });
  });
});
