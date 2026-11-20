import type { WorldPackDocument } from "@narralume/contracts";
import type { NarrativeModelClient } from "@narralume/narrative";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
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

const fixtures: Array<{
  app: Awaited<ReturnType<typeof buildApp>>;
  db: NodeNarrativeDatabase;
}> = [];

afterEach(async () => {
  while (fixtures.length) {
    const fixture = fixtures.pop()!;
    await fixture.app.close();
    fixture.db.close();
  }
});

const baseDocument: WorldPackDocument = {
  summary: "玉澜坊市处在宗门、商会、散修和炼丹师交易的真实网络之中。",
  nodes: [
    {
      localId: "jade_market", existingCanonId: null, type: "location",
      name: "玉澜坊市", description: "每旬大集开设三天，拍卖场之外有炼丹房、牙行、散修住店及悬赏集市。",
      areaRef: null, value: "宗门庇护和交易入口", access: "持身份令牌或向管事申请摊位",
      motive: "掌握周边灵材与消息流", currentActivity: "刚刚举行月度丹药交易会",
      origin: "original", sourceNote: "小说世界原创",
    },
    {
      localId: "jade_guild", existingCanonId: null, type: "organization",
      name: "玉澜商会", description: "由三名掌柜和六个行商队共同经营，控制丹药寄售、法器鉴定与护送交易。",
      areaRef: "jade_market", value: "丹药定价和货物分销权",
      access: "通过掌柜引荐或购得商会份额",
      motive: "与宗门药堂争夺利润", currentActivity: "正在准备竞购珍稀丹药",
      origin: "original", sourceNote: "小说世界原创",
    },
    {
      localId: "guild_master", existingCanonId: null, type: "character",
      name: "沈绮罗", description: "商会大掌柜，靠辨识失传丹方建立威望，正在扶植自己掌握的护送商队。",
      areaRef: "jade_market", value: "掌握稀有丹药与交易机会",
      access: "先取得行商信任才能会面",
      motive: "要在下一次宗门年度大比前拿下药坊控制权",
      currentActivity: "私下联络拍卖场掌柜筹措灵石",
      origin: "original", sourceNote: "小说世界原创",
    },
    {
      localId: "moon_pill", existingCanonId: null, type: "item",
      name: "月华补神丹", description: "只能由一位已退隐的炼丹师用月露和青叶蕊炼制，有价无市。",
      areaRef: "jade_market", value: "修补神识、提高筑基修士炼器成功率",
      access: "由商会掌柜主持封闭竞价",
      motive: "供少数修士争夺", currentActivity: "正处于商会代售阶段",
      origin: "original", sourceNote: "小说世界原创",
    },
  ],
  links: [
    { fromRef: "jade_guild", toRef: "jade_market", relation: "controls",
      description: "商会代管坊市的交易牌照", status: "current" },
    { fromRef: "guild_master", toRef: "jade_guild", relation: "leads",
      description: "她主持商会交易与修士谈判", status: "current" },
    { fromRef: "jade_guild", toRef: "moon_pill", relation: "owns",
      description: "商会受托保管月华丹，拥有拍卖主持权", status: "current" },
    { fromRef: "guild_master", toRef: "moon_pill", relation: "plans",
      description: "她打算借丹药打开宗门上层的关系", status: "possible" },
  ],
  activities: [
    {
      localId: "bidding", actorRefs: ["guild_master", "jade_guild"],
      description: "商会正在联系三位筑基高手，组织一场闭门竞拍。",
      reason: "掌柜希望形成价格同盟并取得药堂特许权",
      resourceRefs: ["moon_pill"], stage: "ongoing", worldTime: "宗门大比前七日",
    },
    {
      localId: "future_event", actorRefs: ["guild_master"],
      description: "她可能出资收购宗门旁边的丹房。",
      reason: "扩大对炼丹渠道的控制", resourceRefs: [],
      stage: "potential", worldTime: "未来一个月",
    },
  ],
  openThreads: ["宗门药堂负责人为什么不愿商会进入内门？"],
};

let mockDocument: WorldPackDocument = structuredClone(baseDocument);

async function setup() {
  mockDocument = structuredClone(baseDocument);
  const db = new NodeNarrativeDatabase();
  const model: NarrativeModelClient = {
    async text() {
      throw new Error("WorldPack must request a structured whole-world document");
    },
    async structured(_run, _step, purpose, _request, _contract, validate) {
      if (purpose !== "world-pack") throw new Error(`Wrong purpose: ${purpose}`);
      const result = validate(mockDocument);
      if (!result.success) throw new Error(result.issues.join("; "));
      return {
        value: result.data,
        usage: { inputTokens: 1300, outputTokens: 1900, calls: 1, costUsd: 0, wallTimeMs: 10 },
        mode: "native",
        attempts: 1,
      };
    },
  } as NarrativeModelClient;
  const app = await buildApp({
    config, database: db,
    environment: {
      NARRATIVE_LLM_API_KEY: "test-key",
      NARRATIVE_LLM_BASE_URL: "https://api.example.test/v1",
      NARRATIVE_LLM_MODEL: "mock-world-writer",
    },
    narrativeModelClient: model,
    enableRunWorker: false,
    logger: false,
  });
  fixtures.push({ app, db });
  const created = await app.inject({
    method: "POST", url: "/api/projects",
    payload: {
      requestId: crypto.randomUUID(),
      title: "玄幻世界实演",
      premise: "宗门、坊市、丹药和门阀社会",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  return { app, db, projectId: created.json().id as string };
}

async function generate(
  app: Awaited<ReturnType<typeof buildApp>>,
  projectId: string,
  overrides: Record<string, unknown> = {},
) {
  return app.inject({
    method: "POST", url: `/api/projects/${projectId}/world-packs/generate`,
    payload: {
      requestId: crypto.randomUUID(),
      scale: "W0",
      premise: "玄幻宗门与坊市的真实生活",
      worldTime: "宗门大比前七日",
      focus: "",
      genre: "",
      scarcity: "",
      instruction: "",
      parentAreaId: null,
      ...overrides,
    },
  });
}

async function completeRun(
  app: Awaited<ReturnType<typeof buildApp>>,
  projectId: string,
  runId: string,
) {
  for (let index = 0; index < 9; index++) {
    const response = await app.inject({
      method: "POST",
      url: `/api/runs/${encodeURIComponent(runId)}/advance`,
      payload: { projectId },
    });
    expect(response.statusCode, response.body).toBe(200);
    const snapshot = response.json().snapshot;
    if (snapshot.run.status === "completed") return;
    if (snapshot.run.status === "failed") throw new Error(JSON.stringify(snapshot.steps));
  }
  throw new Error("WorldPack did not finish");
}

describe("WorldPack API and author-controlled canonical Reality", () => {
  it("produces a whole referenced world package without touching Canon until adoption", async () => {
    const { app, projectId, db } = await setup();
    const started = await generate(app, projectId);
    expect(started.statusCode, started.body).toBe(202);
    const runId = started.json().runId as string;
    await completeRun(app, projectId, runId);
    const response = await app.inject({
      method: "GET", url: `/api/projects/${projectId}/world-packs`,
    });
    expect(response.statusCode, response.body).toBe(200);
    const pack = response.json()[0];
    expect(pack.status).toBe("draft");
    expect(pack.document.nodes).toHaveLength(4);
    expect(pack.document.links).toHaveLength(4);
    expect(pack.document.activities).toHaveLength(2);
    const before = await app.inject({
      method: "GET", url: `/api/projects/${projectId}/story-bible`,
    });
    expect(before.json().entities).toHaveLength(0);

    const adopted = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(pack.id)}/adopt`,
      payload: { expectedVersion: pack.version },
    });
    expect(adopted.statusCode, adopted.body).toBe(200);
    const result = adopted.json();
    expect(result.status).toBe("adopted");
    expect(Object.keys(result.canonIds)).toHaveLength(4);
    const after = await app.inject({
      method: "GET", url: `/api/projects/${projectId}/story-bible`,
    });
    expect(after.json().entities).toHaveLength(4);
    expect(after.json().relationships).toHaveLength(3);
    expect(after.json().facts.some((fact: { predicate: string }) =>
      fact.predicate === "world.ongoing_activity",
    )).toBe(true);
    expect(after.json().timeline).toHaveLength(0);
    // Adoption of the same version cannot duplicate official facts.
    const again = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(pack.id)}/adopt`,
      payload: { expectedVersion: pack.version },
    });
    expect(again.statusCode).toBe(409);
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM canon_entities WHERE project_id=?").get(projectId))
      .toMatchObject({ n: 4 });
  });

  it("edits a linked draft with CAS and rejects invalid cross-references", async () => {
    const { app, projectId } = await setup();
    const started = await generate(app, projectId);
    await completeRun(app, projectId, started.json().runId);
    const pack = (await app.inject({
      method: "GET", url: `/api/projects/${projectId}/world-packs`,
    })).json()[0];
    const invalid: WorldPackDocument = structuredClone(pack.document);
    invalid.links[0]!.toRef = "invented_node";
    const rejected = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(pack.id)}`,
      payload: { expectedVersion: pack.version, document: invalid },
    });
    expect(rejected.statusCode).toBe(422);

    const edited: WorldPackDocument = structuredClone(pack.document);
    edited.nodes[0]!.description += "商会正在和远处的银甲宗做生意。";
    const saved = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(pack.id)}`,
      payload: { expectedVersion: pack.version, document: edited },
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().version).toBe(pack.version + 1);
    const stale = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(pack.id)}/adopt`,
      payload: { expectedVersion: pack.version },
    });
    expect(stale.statusCode).toBe(409);
  });

  it("permits W1 to explicitly reuse an adopted W0 entity and rejects duplicates", async () => {
    const { app, projectId } = await setup();
    const w0 = await generate(app, projectId);
    await completeRun(app, projectId, w0.json().runId);
    const pack = (await app.inject({
      method: "GET", url: `/api/projects/${projectId}/world-packs`,
    })).json()[0];
    const adopted = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(pack.id)}/adopt`,
      payload: { expectedVersion: pack.version },
    });
    const marketId = adopted.json().canonIds.jade_market as string;
    mockDocument = structuredClone(baseDocument);
    mockDocument.nodes = [
      { ...mockDocument.nodes[0]!, existingCanonId: marketId },
      {
        ...mockDocument.nodes[3]!, localId: "river_relic",
        name: "河底禁制残图", areaRef: "jade_market", existingCanonId: null,
      },
    ];
    mockDocument.links = [{
      fromRef: "river_relic", toRef: "jade_market", relation: "found_in",
      description: "残图出自玉澜坊市附近的古河道", status: "current",
    }];
    mockDocument.activities = [{
      localId: "discovery", actorRefs: ["jade_market"],
      description: "坊市派出的渔户正在打捞一段古河床的石刻。",
      reason: "河道改道后旧商路露出石刻", resourceRefs: ["river_relic"],
      stage: "ongoing", worldTime: "宗门大比前六日",
    }];
    const w1 = await generate(app, projectId, {
      scale: "W1", focus: "玉澜坊市古河道", genre: "玄幻",
      parentAreaId: marketId,
    });
    expect(w1.statusCode, w1.body).toBe(202);
    await completeRun(app, projectId, w1.json().runId);
    const packs = (await app.inject({
      method: "GET", url: `/api/projects/${projectId}/world-packs`,
    })).json();
    const result = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(packs[0].id)}/adopt`,
      payload: { expectedVersion: packs[0].version },
    });
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().canonIds.jade_market).toBe(marketId);
    const bible = (await app.inject({
      method: "GET", url: `/api/projects/${projectId}/story-bible`,
    })).json();
    expect(bible.entities).toHaveLength(5);
  });
  it("advances existing NPCs, closes old activities, and never silently revokes ownership", async () => {
    const { app, projectId } = await setup();
    const initial = await generate(app, projectId);
    await completeRun(app, projectId, initial.json().runId);
    const initialPack = (await app.inject({
      method: "GET", url: `/api/projects/${projectId}/world-packs`,
    })).json()[0];
    const adopted0 = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(initialPack.id)}/adopt`,
      payload: { expectedVersion: initialPack.version },
    });
    expect(adopted0.statusCode, adopted0.body).toBe(200);
    const ids = adopted0.json().canonIds as Record<string, string>;

    mockDocument = structuredClone(baseDocument);
    mockDocument.nodes = mockDocument.nodes.map((node) => ({
      ...node,
      existingCanonId: ids[node.localId]!,
      currentActivity: "世界时间推进七日，旧商会正发生产权争议。",
    }));
    mockDocument.links = [
      {
        fromRef: "guild_master", toRef: "moon_pill", relation: "owns",
        description: "沈绮罗主张丹药已经由她个人收购，商会的共有权尚待清算",
        status: "current",
      },
    ];
    mockDocument.activities = [
      {
        ...baseDocument.activities[0]!,
        stage: "ended",
        description: "商会原定闭门竞拍已经取消",
      },
    ];
    const advancing = await generate(app, projectId, {
      intent: "advance", scale: "W1",
      worldTime: "宗门大比当日",
      focus: "玉澜商会丹药产权争议", genre: "男频玄幻",
      parentAreaId: ids.jade_market,
    });
    expect(advancing.statusCode, advancing.body).toBe(202);
    await completeRun(app, projectId, advancing.json().runId);
    const advancedPack = (await app.inject({
      method: "GET", url: `/api/projects/${projectId}/world-packs`,
    })).json()[0];
    const adopted1 = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(advancedPack.id)}/adopt`,
      payload: { expectedVersion: advancedPack.version },
    });
    expect(adopted1.statusCode, adopted1.body).toBe(200);

    const graph = (await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/world-graph?centerId=${ids.moon_pill}&hops=2`,
    })).json() as {
      nodes: { id: string; name: string }[];
      edges: { from: string; to: string; relation: string }[];
      ongoingActivities: unknown[];
    };
    expect(graph.nodes.some((node) => node.name === "玉澜商会")).toBe(true);
    expect(graph.edges.filter((edge) =>
      edge.to === ids.moon_pill && edge.relation === "owns",
    )).toHaveLength(2); // New claim never silently confiscates the old claim.

    const actorActivities = (await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/world-graph?centerId=${ids.guild_master}&hops=2`,
    })).json().ongoingActivities as Array<{ detail: { activityLocalId: string } }>;
    expect(actorActivities.filter((act) =>
      act.detail.activityLocalId === "bidding",
    )).toHaveLength(0); // "ended" supersedes the prior ongoing activity.

    // An explicit "ended" relationship can now revoke the old claim with provenance.
    mockDocument.links = [{
      fromRef: "jade_guild", toRef: "moon_pill", relation: "owns",
      description: "商会与掌柜完成产权交割，商会对丹药旧权利终止",
      status: "ended",
    }];
    mockDocument.activities = [{
      ...baseDocument.activities[0]!,
      stage: "ended",
      description: "竞拍取消的事实保持不变",
    }];
    // An already ended activity cannot be updated into a different event
    // without a new action. We use a new ongoing organization action.
    mockDocument.activities = [{
      ...baseDocument.activities[0]!,
      localId: "guild_reorganization",
      stage: "ongoing",
      description: "商会财务正在核对交易后新的股份分配。",
    }];
    const finishing = await generate(app, projectId, {
      intent: "advance", scale: "W1", worldTime: "宗门大比翌日",
      focus: "商会产权交割", genre: "男频玄幻",
      parentAreaId: ids.jade_market,
    });
    await completeRun(app, projectId, finishing.json().runId);
    const finalPack = (await app.inject({
      method: "GET", url: `/api/projects/${projectId}/world-packs`,
    })).json()[0];
    const adopted2 = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(finalPack.id)}/adopt`,
      payload: { expectedVersion: finalPack.version },
    });
    expect(adopted2.statusCode, adopted2.body).toBe(200);
    const after = (await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/world-graph?centerId=${ids.moon_pill}&hops=2`,
    })).json() as { edges: { from: string; to: string; relation: string }[] };
    expect(after.edges.filter((edge) =>
      edge.to === ids.moon_pill && edge.relation === "owns",
    )).toEqual([
      expect.objectContaining({ from: ids.guild_master }),
    ]);
  });

});
