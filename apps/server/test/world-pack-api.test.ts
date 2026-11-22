import type { WorldPackDocument } from "@narralume/contracts";
import {
  StoryStatePacketBuilder,
  type NarrativeModelClient,
} from "@narralume/narrative";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import {
  SqliteCanonRepository,
  SqliteStoryRepository,
  SqliteNarrativeStateRepository,
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
      localId: "jade_market",
      existingCanonId: null,
      type: "location",
      name: "玉澜坊市",
      description:
        "每旬大集开设三天，拍卖场之外有炼丹房、牙行、散修住店及悬赏集市。",
      areaRef: null,
      value: "宗门庇护和交易入口",
      access: "持身份令牌或向管事申请摊位",
      motive: "掌握周边灵材与消息流",
      currentActivity: "刚刚举行月度丹药交易会",
      origin: "original",
      sourceNote: "小说世界原创",
    },
    {
      localId: "jade_guild",
      existingCanonId: null,
      type: "organization",
      name: "玉澜商会",
      description:
        "由三名掌柜和六个行商队共同经营，控制丹药寄售、法器鉴定与护送交易。",
      areaRef: "jade_market",
      value: "丹药定价和货物分销权",
      access: "通过掌柜引荐或购得商会份额",
      motive: "与宗门药堂争夺利润",
      currentActivity: "正在准备竞购珍稀丹药",
      origin: "original",
      sourceNote: "小说世界原创",
    },
    {
      localId: "guild_master",
      existingCanonId: null,
      type: "character",
      name: "沈绮罗",
      description:
        "商会大掌柜，靠辨识失传丹方建立威望，正在扶植自己掌握的护送商队。",
      areaRef: "jade_market",
      value: "掌握稀有丹药与交易机会",
      access: "先取得行商信任才能会面",
      motive: "要在下一次宗门年度大比前拿下药坊控制权",
      currentActivity: "私下联络拍卖场掌柜筹措灵石",
      origin: "original",
      sourceNote: "小说世界原创",
    },
    {
      localId: "moon_pill",
      existingCanonId: null,
      type: "item",
      name: "月华补神丹",
      description: "只能由一位已退隐的炼丹师用月露和青叶蕊炼制，有价无市。",
      areaRef: "jade_market",
      value: "修补神识、提高筑基修士炼器成功率",
      access: "由商会掌柜主持封闭竞价",
      motive: "供少数修士争夺",
      currentActivity: "正处于商会代售阶段",
      origin: "original",
      sourceNote: "小说世界原创",
    },
  ],
  links: [
    {
      fromRef: "jade_guild",
      toRef: "jade_market",
      relation: "controls",
      description: "商会代管坊市的交易牌照",
      status: "current",
    },
    {
      fromRef: "guild_master",
      toRef: "jade_guild",
      relation: "leads",
      description: "她主持商会交易与修士谈判",
      status: "current",
    },
    {
      fromRef: "jade_guild",
      toRef: "moon_pill",
      relation: "owns",
      description: "商会受托保管月华丹，拥有拍卖主持权",
      status: "current",
    },
    {
      fromRef: "guild_master",
      toRef: "moon_pill",
      relation: "plans",
      description: "她打算借丹药打开宗门上层的关系",
      status: "possible",
    },
  ],
  activities: [
    {
      localId: "bidding",
      actorRefs: ["guild_master", "jade_guild"],
      description: "商会正在联系三位筑基高手，组织一场闭门竞拍。",
      reason: "掌柜希望形成价格同盟并取得药堂特许权",
      resourceRefs: ["moon_pill"],
      stage: "ongoing",
      worldTime: "宗门大比前七日",
    },
    {
      localId: "future_event",
      actorRefs: ["guild_master"],
      description: "她可能出资收购宗门旁边的丹房。",
      reason: "扩大对炼丹渠道的控制",
      resourceRefs: [],
      stage: "potential",
      worldTime: "未来一个月",
    },
  ],
  openThreads: ["宗门药堂负责人为什么不愿商会进入内门？"],
};

let mockDocument: WorldPackDocument = structuredClone(baseDocument);

/** The mock produces a different *actual world increment* for every
 * program-selected MMORPG workshop. Returning the same all-in-one list for
 * every stage would conceal the original shortcut and must not pass. */
function workshopPatch(request: unknown): WorldPackDocument {
  const call = request as { messages?: Array<{ content?: string }> };
  const command = JSON.parse(call.messages?.[0]?.content ?? "{}") as {
    operation: string;
    authorRequest: { scale: "W0" | "W1"; intent?: string };
  };
  const op = command.operation;
  const scale = command.authorRequest.scale;
  const advance = command.authorRequest.intent === "advance";
  const later =
    (command.authorRequest as { worldTime?: string }).worldTime?.includes(
      "翌日",
    ) ?? false;
  const market =
    mockDocument.nodes.find((n) => n.type === "location") ??
    baseDocument.nodes[0]!;
  const org = advance
    ? mockDocument.nodes.find((n) => n.localId === "jade_guild")!
    : scale === "W0"
      ? baseDocument.nodes[1]!
      : {
          ...baseDocument.nodes[1]!,
          localId: "river_guild",
          name: "河湾行会",
          areaRef: "jade_market",
        };
  const person = advance
    ? mockDocument.nodes.find((n) => n.localId === "guild_master")!
    : scale === "W0"
      ? baseDocument.nodes[2]!
      : {
          ...baseDocument.nodes[2]!,
          localId: "river_master",
          name: "河湾掌船人",
          areaRef: "jade_market",
        };
  const asset =
    mockDocument.nodes.find((n) => n.type === "item") ?? baseDocument.nodes[3]!;
  const rule = {
    ...baseDocument.nodes[3]!,
    type: "rule" as const,
    localId: "alchemy_rule",
    name: "宗门神识炼丹术",
    areaRef: "jade_market",
    existingCanonId: null,
    description: "已被宗门多个炼丹师修习的公共力量，能炼制补神丹。",
  };
  const relation = (fromRef: string, toRef: string, type: string) => ({
    fromRef,
    toRef,
    relation: type,
    status: "current" as const,
    description: "双方实际进行业务往来，受到各自契约与职位权限制约。",
  });
  const patch: WorldPackDocument = {
    summary: mockDocument.summary,
    nodes: [market],
    links: [],
    activities: [],
    openThreads: [],
    interactions: [],
    dimensionSignals: [],
  };
  const actionPrefix = advance
    ? later
      ? "next_day_"
      : "today_"
    : scale === "W1"
      ? "river_"
      : "";
  const gameActions = () => [
    {
      localId: actionPrefix + "public_arrival",
      name: "商会招徕新人入坊市",
      offeredByRef: org.localId,
      locationRef: market.localId,
      action: "取得进场资格，先接触真实的商会柜台。",
      requires: [],
      yields: [{ kind: "access" as const, ref: market.localId }],
      state: "available" as const,
    },
    {
      localId: actionPrefix + "buy_resource",
      name: "竞购稀有资源",
      offeredByRef: person.localId,
      locationRef: market.localId,
      action: "与柜台掌柜面谈并取得资源的实际交割。",
      requires: [{ kind: "access" as const, ref: market.localId }],
      yields: [{ kind: "asset" as const, ref: asset.localId }],
      state: "available" as const,
    },
    {
      localId: actionPrefix + "invest_resource",
      name: "凭已有资产进入商会更高圈层",
      offeredByRef: person.localId,
      locationRef: market.localId,
      action: "以已取得的资源联系商会关键人物争取资格。",
      requires: [{ kind: "asset" as const, ref: asset.localId }],
      yields: [{ kind: "permission" as const, ref: org.localId }],
      state: "available" as const,
    },
  ];
  if (advance) {
    if (op === "living") {
      patch.nodes = [...mockDocument.nodes];
      patch.links = [...mockDocument.links];
      patch.activities = [
        ...mockDocument.activities,
        {
          localId: later ? "living_followup_2" : "living_followup_1",
          actorRefs: ["guild_master"],
          resourceRefs: ["moon_pill"],
          stage: "ongoing",
          worldTime: later ? "宗门大比翌日" : "宗门大比当日",
          description: "掌柜已开始重新接触丹药买家并调整利益格局",
          reason: "应对既有商会竞争和已发生的权利变化",
        },
      ];
    } else if (op === "events") {
      patch.activities = [
        {
          localId: later ? "trade_followup_2" : "trade_followup_1",
          actorRefs: ["guild_master"],
          resourceRefs: ["moon_pill"],
          stage: "ongoing",
          worldTime: "宗门大比时",
          description: "掌柜正接触另一批丹药买家，旧商会继续营业。",
          reason: "继续利用已有丹药权益经营交易",
        },
      ];
    } else if (op === "social") {
      patch.links = [
        relation("jade_guild", "jade_market", "operates"),
        relation("guild_master", "jade_guild", "leads"),
        relation("guild_master", "jade_market", "visits"),
        relation("guild_master", "moon_pill", "owns"),
      ];
    } else if (op === "playability") {
      patch.links = [relation("moon_pill", "guild_master", "enables")];
      patch.interactions = gameActions();
    }
    return patch;
  }
  if (op === "geography") return patch;
  if (op === "factions") {
    patch.nodes = [org];
    patch.links = [relation(org.localId, market.localId, "operates")];
  } else if (op === "people") {
    patch.nodes = [person];
    patch.links = [relation(person.localId, org.localId, "leads")];
  } else if (op === "economy") {
    patch.nodes = [asset];
    patch.links = [relation(org.localId, asset.localId, "owns")];
  } else if (op === "power") {
    patch.nodes = [rule];
    patch.links = [relation(person.localId, rule.localId, "can_use")];
  } else if (op === "events") {
    patch.activities = [
      {
        ...baseDocument.activities[0]!,
        actorRefs: [person.localId, org.localId],
        resourceRefs: [asset.localId],
      },
    ];
    if (scale === "W0") patch.activities.push(baseDocument.activities[1]!);
  } else if (op === "social") {
    patch.links = [
      relation(person.localId, market.localId, "visits"),
      ...(scale === "W0"
        ? [baseDocument.links[3]!]
        : [relation(asset.localId, market.localId, "found_in")]),
    ];
  } else if (op === "playability") {
    patch.links = [relation(asset.localId, person.localId, "enables")];
    patch.interactions = gameActions();
  }
  return patch;
}

let independentFactionAgentCalls = 0;

async function setup() {
  independentFactionAgentCalls = 0;
  mockDocument = structuredClone(baseDocument);
  const db = new NodeNarrativeDatabase();
  const model: NarrativeModelClient = {
    async text(_run, _step, purpose) {
      if (purpose !== "world-pack")
        throw new Error(
          "WorldForge faction agents must share the world-pack model assignment",
        );
      independentFactionAgentCalls += 1;
      return {
        text: JSON.stringify({
          decisions: ["商会准备继续交涉丹药流通"],
          events: [
            {
              type: "commercial",
              description: "玉澜商会已提出与宗门药堂谈判，但授权尚未成交",
            },
          ],
        }),
        usage: {
          inputTokens: 30,
          outputTokens: 80,
          calls: 1,
          costUsd: 0,
          wallTimeMs: 1,
        },
      };
    },
    async structured(_run, _step, purpose, _request, _contract, validate) {
      if (purpose !== "world-pack")
        throw new Error(`Wrong purpose: ${purpose}`);
      const result = validate(workshopPatch(_request));
      if (!result.success) throw new Error(result.issues.join("; "));
      return {
        value: result.data,
        usage: {
          inputTokens: 1300,
          outputTokens: 1900,
          calls: 1,
          costUsd: 0,
          wallTimeMs: 10,
        },
        mode: "native",
        attempts: 1,
      };
    },
  } as NarrativeModelClient;
  const app = await buildApp({
    config,
    database: db,
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
    method: "POST",
    url: "/api/projects",
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
    method: "POST",
    url: `/api/projects/${projectId}/world-packs/generate`,
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
    if (snapshot.run.status === "failed")
      throw new Error(JSON.stringify(snapshot.steps));
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
      method: "GET",
      url: `/api/projects/${projectId}/world-packs`,
    });
    expect(response.statusCode, response.body).toBe(200);
    const pack = response.json()[0];
    expect(pack.status).toBe("draft");
    expect(pack.document.nodes).toHaveLength(5);
    expect(pack.document.activities).toHaveLength(2);
    expect(pack.document.interactions).toHaveLength(0);
    expect(pack.document.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: "operates" }),
        expect.objectContaining({ relation: "leads" }),
        expect.objectContaining({ relation: "owns" }),
        expect.objectContaining({ relation: "can_use" }),
      ]),
    );
    expect(pack.document.production?.engine).toBe("mmorpg-world-workshop-v1");
    const actualWorkshops: string[] =
      pack.document.production?.executed.map(
        (step: { workshop: string }) => step.workshop,
      ) ?? [];
    expect(actualWorkshops).toEqual([
      "geography",
      "factions",
      "people",
      "economy",
      "events",
      "power",
    ]);
    // Existing typed relations already supply a social route and textual
    // access/value describe usable world content. The open state machine does
    // not invent extra social/action workshops merely to tick a checklist.
    expect(actualWorkshops).not.toContain("social");
    expect(actualWorkshops).not.toContain("playability");
    expect(actualWorkshops.indexOf("events")).toBeLessThan(
      actualWorkshops.indexOf("power"),
    );
    const checkpointCount = db.raw
      .prepare(
        "SELECT COUNT(*) AS n FROM checkpoints WHERE run_id=? AND kind='world.production'",
      )
      .get(runId) as { n: number };
    expect(checkpointCount.n).toBeGreaterThanOrEqual(actualWorkshops.length);
    const before = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/story-bible`,
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
    expect(Object.keys(result.canonIds)).toHaveLength(5);
    const after = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/story-bible`,
    });
    expect(after.json().entities).toHaveLength(5);
    // Adoption must reflect what this deficiency-driven batch actually
    // produced. Social/playability were intentionally not executed above,
    // so old fixed-pipeline counts (6 relationships / 3 affordances) are
    // not valid completion criteria.
    const stagedCurrentLinks = pack.document.links.filter(
      (link: { status: string }) => link.status === "current",
    );
    expect(after.json().relationships).toHaveLength(stagedCurrentLinks.length);
    expect(
      after
        .json()
        .relationships.map(
          (relationship: { relation: string }) => relationship.relation,
        ),
    ).toEqual(
      expect.arrayContaining(
        stagedCurrentLinks.map((link: { relation: string }) => link.relation),
      ),
    );
    expect(
      after
        .json()
        .facts.some(
          (fact: { predicate: string }) =>
            fact.predicate === "world.ongoing_activity",
        ),
    ).toBe(true);
    expect(after.json().timeline).toHaveLength(0);
    expect(
      after
        .json()
        .facts.filter(
          (fact: { predicate: string }) =>
            fact.predicate === "world.affordance",
        ),
    ).toHaveLength(pack.document.interactions?.length ?? 0);
    // This is the actual bridge into NarraLume's writing context:
    // all important world objects carry an adopted world.content fact.
    const canonRepo = new SqliteCanonRepository(db);
    const storyRepo = new SqliteStoryRepository(db);
    const stateRepo = new SqliteNarrativeStateRepository(
      db,
      canonRepo,
      storyRepo,
    );
    const promptPacket = new StoryStatePacketBuilder(
      canonRepo,
      stateRepo,
      storyRepo,
    ).build({ projectId, audience: "author" });
    const storyContext = promptPacket.sources
      .map((source) => source.content)
      .join("\\n");
    expect(storyContext).toContain("月华补神丹");
    expect(storyContext).toContain("修补神识");
    expect(storyContext).toContain("商会");

    // Adoption of the same version cannot duplicate official facts.
    const again = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(pack.id)}/adopt`,
      payload: { expectedVersion: pack.version },
    });
    expect(again.statusCode).toBe(409);
    expect(
      db.raw
        .prepare("SELECT COUNT(*) AS n FROM canon_entities WHERE project_id=?")
        .get(projectId),
    ).toMatchObject({ n: 5 });
  });

  it("edits a linked draft with CAS and rejects invalid cross-references", async () => {
    const { app, projectId } = await setup();
    const started = await generate(app, projectId);
    await completeRun(app, projectId, started.json().runId);
    const pack = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-packs`,
      })
    ).json()[0];
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

  it("permits W1 to reuse an adopted W0 entity while adding only explicit local content", async () => {
    const { app, projectId } = await setup();
    const w0 = await generate(app, projectId);
    await completeRun(app, projectId, w0.json().runId);
    const pack = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-packs`,
      })
    ).json()[0];
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
        ...mockDocument.nodes[3]!,
        localId: "river_relic",
        name: "河底禁制残图",
        areaRef: "jade_market",
        existingCanonId: null,
      },
    ];
    mockDocument.links = [
      {
        fromRef: "river_relic",
        toRef: "jade_market",
        relation: "found_in",
        description: "残图出自玉澜坊市附近的古河道",
        status: "current",
      },
    ];
    mockDocument.activities = [
      {
        localId: "discovery",
        actorRefs: ["jade_market"],
        description: "坊市派出的渔户正在打捞一段古河床的石刻。",
        reason: "河道改道后旧商路露出石刻",
        resourceRefs: ["river_relic"],
        stage: "ongoing",
        worldTime: "宗门大比前六日",
      },
    ];
    const w1 = await generate(app, projectId, {
      scale: "W1",
      focus: "玉澜坊市古河道",
      genre: "玄幻",
      parentAreaId: marketId,
    });
    expect(w1.statusCode, w1.body).toBe(202);
    await completeRun(app, projectId, w1.json().runId);
    const packs = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-packs`,
      })
    ).json();
    const generatedW1 = packs[0];

    // The open production state machine may stop after establishing/reusing
    // the focused parent when the surrounding Reality already satisfies its
    // structural coverage. Do not pretend objects from the test fixture were
    // generated if they never entered the staged document. Explicitly add the
    // local object we want this API test to adopt.
    const edited: WorldPackDocument = structuredClone(generatedW1.document);
    if (!edited.nodes.some((node) => node.localId === "river_relic")) {
      edited.nodes.push({
        ...baseDocument.nodes[3]!,
        localId: "river_relic",
        name: "河底禁制残图",
        areaRef: "jade_market",
        existingCanonId: null,
      });
      edited.links.push({
        fromRef: "river_relic",
        toRef: "jade_market",
        relation: "found_in",
        description: "残图出自玉澜坊市附近的古河道",
        status: "current",
      });
    }
    const saved = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(generatedW1.id)}`,
      payload: { expectedVersion: generatedW1.version, document: edited },
    });
    expect(saved.statusCode, saved.body).toBe(200);

    const result = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(generatedW1.id)}/adopt`,
      payload: { expectedVersion: saved.json().version },
    });
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().canonIds.jade_market).toBe(marketId);
    expect(result.json().canonIds.river_relic).toBeTruthy();
    const bible = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/story-bible`,
      })
    ).json();
    expect(bible.entities).toHaveLength(6);
    expect(
      bible.entities.filter(
        (entity: { name: string }) => entity.name === "玉澜坊市",
      ),
    ).toHaveLength(1);
    expect(
      bible.entities.filter(
        (entity: { name: string }) => entity.name === "河底禁制残图",
      ),
    ).toHaveLength(1);
  });
  it("advances existing NPCs, closes old activities, and never silently revokes ownership", async () => {
    const { app, projectId } = await setup();
    const initial = await generate(app, projectId);
    await completeRun(app, projectId, initial.json().runId);
    const initialPack = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-packs`,
      })
    ).json()[0];
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
        fromRef: "guild_master",
        toRef: "moon_pill",
        relation: "owns",
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
      intent: "advance",
      scale: "W1",
      worldTime: "宗门大比当日",
      focus: "玉澜商会丹药产权争议",
      genre: "男频玄幻",
      parentAreaId: ids.jade_market,
    });
    expect(advancing.statusCode, advancing.body).toBe(202);
    await completeRun(app, projectId, advancing.json().runId);
    // This now exercises the actual upstream WorldForge runAllAgents
    // and arbiter path, not only the WorldPack structured-document model.
    expect(independentFactionAgentCalls).toBeGreaterThan(0);
    const advancedPack = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-packs`,
      })
    ).json()[0];
    const adopted1 = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(advancedPack.id)}/adopt`,
      payload: { expectedVersion: advancedPack.version },
    });
    expect(adopted1.statusCode, adopted1.body).toBe(200);

    const graph = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-graph?centerId=${ids.moon_pill}&hops=2`,
      })
    ).json() as {
      nodes: { id: string; name: string }[];
      edges: { from: string; to: string; relation: string }[];
      ongoingActivities: unknown[];
    };
    expect(graph.nodes.some((node) => node.name === "玉澜商会")).toBe(true);
    expect(
      graph.edges.filter(
        (edge) => edge.to === ids.moon_pill && edge.relation === "owns",
      ),
    ).toHaveLength(2); // New claim never silently confiscates the old claim.

    const actorActivities = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-graph?centerId=${ids.guild_master}&hops=2`,
      })
    ).json().ongoingActivities as Array<{
      detail: { activityLocalId: string };
    }>;
    expect(
      actorActivities.filter((act) => act.detail.activityLocalId === "bidding"),
    ).toHaveLength(0); // "ended" supersedes the prior ongoing activity.

    // An explicit "ended" relationship can now revoke the old claim with provenance.
    mockDocument.links = [
      {
        fromRef: "jade_guild",
        toRef: "moon_pill",
        relation: "owns",
        description: "商会与掌柜完成产权交割，商会对丹药旧权利终止",
        status: "ended",
      },
    ];
    mockDocument.activities = [
      {
        ...baseDocument.activities[0]!,
        stage: "ended",
        description: "竞拍取消的事实保持不变",
      },
    ];
    // An already ended activity cannot be updated into a different event
    // without a new action. We use a new ongoing organization action.
    mockDocument.activities = [
      {
        ...baseDocument.activities[0]!,
        localId: "guild_reorganization",
        stage: "ongoing",
        description: "商会财务正在核对交易后新的股份分配。",
      },
    ];
    const finishing = await generate(app, projectId, {
      intent: "advance",
      scale: "W1",
      worldTime: "宗门大比翌日",
      focus: "商会产权交割",
      genre: "男频玄幻",
      parentAreaId: ids.jade_market,
    });
    await completeRun(app, projectId, finishing.json().runId);
    const finalPack = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-packs`,
      })
    ).json()[0];
    const adopted2 = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/world-packs/${encodeURIComponent(finalPack.id)}/adopt`,
      payload: { expectedVersion: finalPack.version },
    });
    expect(adopted2.statusCode, adopted2.body).toBe(200);
    const after = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/world-graph?centerId=${ids.moon_pill}&hops=2`,
      })
    ).json() as { edges: { from: string; to: string; relation: string }[] };
    expect(
      after.edges.filter(
        (edge) => edge.to === ids.moon_pill && edge.relation === "owns",
      ),
    ).toEqual([expect.objectContaining({ from: ids.guild_master })]);
  });
});
