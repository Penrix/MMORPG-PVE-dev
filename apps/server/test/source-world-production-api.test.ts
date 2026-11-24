import { afterEach, describe, expect, it } from "vitest";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
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
    const item = opened.pop()!;
    await item.app.close();
    item.db.close();
  }
});

describe("Source World production target", () => {
  it("generates, reviews and adopts into Source Atlas without touching Project Reality", async () => {
    const db = new NodeNarrativeDatabase();
    const app = await buildApp({
      config,
      database: db,
      enableRunWorker: false,
      logger: false,
      sourceWorldGenerateProduction: async () => ({
        summary: "木叶医疗体系候选扩展",
        nodes: [
          {
            localId: "konoha_hospital",
            existingCanonId: null,
            existingSourceKey: null,
            type: "location",
            atlasKind: "location",
            name: "木叶医院",
            description: "木叶承担忍者伤病救治与战时医疗的核心医疗场所。",
            areaRef: null,
            value: "医疗忍者、伤员与高层都需要的重要公共设施",
            access: "木叶内部正常就医或任务伤员转送",
            motive: "维持忍者体系的医疗能力",
            currentActivity: "接收任务伤员并进行治疗",
            origin: "inference",
            sourceNote: "待作者继续用原作资料核验",
            readerSemantics: {
              readerPrice: "医疗忍者线天然连接纲手、医疗忍术与战争伤员",
              preloadedExpectations: ["医疗忍术", "战时伤员"],
              familiarRelations: ["医疗体系与忍者任务体系"],
              naturalEntrances: ["伤员转送", "医疗忍者任职"],
              attentionTriggers: ["异常治疗能力"],
              basis: "author_judgment",
              sourceNote: "Reader-side prior, not Source Canon",
            },
          },
          {
            localId: "chief_medic",
            existingCanonId: null,
            existingSourceKey: null,
            type: "character",
            atlasKind: "character",
            name: "值班医疗忍者",
            description: "负责当班伤员分流和具体治疗安排的医疗忍者。",
            areaRef: "konoha_hospital",
            value: "掌握伤员接触与医疗安排入口",
            access: "医院值班体系",
            motive: "完成伤员救治",
            currentActivity: "处理新送来的任务伤员",
            origin: "original",
            sourceNote: "World Builder 原创补充，非原作具名角色",
            readerSemantics: null,
          },
        ],
        links: [
          {
            fromRef: "chief_medic",
            toRef: "konoha_hospital",
            relation: "任职于",
            description: "值班医疗忍者在木叶医院工作",
            status: "current",
          },
        ],
        activities: [],
        interactions: [],
        openThreads: [],
        dimensionSignals: [],
      }),
    });
    opened.push({ app, db });

    const json = async (
      method: "GET" | "POST" | "PUT",
      url: string,
      payload?: unknown,
    ) => {
      const response = await app.inject({
        method,
        url,
        ...(payload === undefined ? {} : { payload }),
      });
      return { status: response.statusCode, body: response.json() };
    };

    expect(
      (
        await json("POST", "/api/source-worlds", {
          id: "naruto",
          name: "火影忍者",
          kind: "fictional",
          description: "原生母体",
        })
      ).status,
    ).toBe(201);

    const cognitive = await json(
      "PUT",
      "/api/source-worlds/naruto/cognitive-mother",
      {
        summary: "火影 Reader 预装的忍者世界底盘",
        preloadedWorldGrammar: ["忍村、忍族、任务、师承"],
        priceLogic: ["血继限界、尾兽与顶级忍者天然高价"],
        naturalEntrances: ["忍者学校", "任务体系"],
        expectedInertia: ["忍村政治和战争历史持续作用"],
        attentionLogic: ["突破忍界常识的能力会迅速被注意"],
        basis: "author_judgment",
        sourceNote: "Reader-side world prior",
      },
    );
    expect(cognitive.status).toBe(200);
    expect(cognitive.body.cognitiveMother.summary).toContain("火影 Reader");

    const generated = await json(
      "POST",
      "/api/source-worlds/naruto/productions/generate",
      {
        requestId: "00000000-0000-4000-8000-000000000157",
        scale: "W1",
        premise: "恢复木叶医疗社会",
        worldTime: "第三次忍界大战前",
        focus: "木叶医院",
        genre: "火影同人",
        scarcity: "",
        instruction: "",
        parentAreaId: null,
      },
    );
    expect(generated.status).toBe(201);
    expect(generated.body.status).toBe("draft");
    const draftId = generated.body.id as string;

    const adopted = await json(
      "POST",
      `/api/source-worlds/naruto/productions/${encodeURIComponent(draftId)}/adopt`,
      { expectedVersion: 1 },
    );
    expect(adopted.status).toBe(200);
    expect(adopted.body.status).toBe("adopted");

    const hospital = await json(
      "GET",
      "/api/source-worlds/naruto/cards/location:konoha_hospital",
    );
    expect(hospital.status).toBe(200);
    expect(hospital.body.content).toContain("木叶承担忍者伤病救治");
    expect(hospital.body.content).not.toContain("医疗忍者线天然连接纲手");

    const medic = await json(
      "GET",
      "/api/source-worlds/naruto/cards/character:chief_medic",
    );
    expect(medic.status).toBe(200);
    expect(medic.body.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayRelation: "任职于",
          otherName: "木叶医院",
        }),
      ]),
    );

    const semantics = await json(
      "GET",
      "/api/source-worlds/naruto/cards/location:konoha_hospital/reader-semantics",
    );
    expect(semantics.status).toBe(200);
    expect(semantics.body.semantics.readerPrice).toContain("医疗忍者线");

    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM projects").get()).toEqual({
      n: 0,
    });
    expect(
      db.raw.prepare("SELECT COUNT(*) AS n FROM canon_entities").get(),
    ).toEqual({ n: 0 });
  });
});
