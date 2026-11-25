import { afterEach, describe, expect, it } from "vitest";
import {
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
} from "@narralume/persistence";
import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import {
  generateSourceWorldProduction,
  projectSourceWorldForProduction,
} from "../src/source-world-production.js";

let db: NodeNarrativeDatabase | null = null;
const now = "2026-11-24T15:00:00.000Z";

function seedWorld() {
  db = new NodeNarrativeDatabase();
  db.migrate();
  const sources = new SqliteSourceCorpusRepository(db);
  sources.upsertCorpus({
    id: "wiki:naruto",
    title: "火影忍者",
    sourceUrl: "",
    rightsNotice: "test",
    importer: "test",
    metadata: {},
    importedAt: now,
  });
  const worlds = new SqliteUnifiedSourceWorldRepository(db);
  worlds.createWorld({
    id: "naruto",
    name: "火影忍者",
    kind: "fictional",
    canonicalCorpusId: "wiki:naruto",
    description: "原生母体",
    createdAt: now,
  });
  worlds.upsertCard({
    worldId: "naruto",
    entityKey: "ability:sharingan",
    kind: "ability",
    name: "写轮眼",
    content: "# 写轮眼\n\n宇智波一族代表性的瞳术能力。",
    now,
  });
  return worlds;
}

afterEach(() => {
  db?.close();
  db = null;
});

describe("Source World World Builder target", () => {
  it("expands a concrete Naruto focus through people into clans and powers", () => {
    const worlds = seedWorld();
    for (const card of [
      {
        entityKey: "village:3",
        kind: "location" as const,
        name: "Konohagakure",
        content: "# Konohagakure\n\n木叶隐村。",
      },
      {
        entityKey: "clan:45",
        kind: "organization" as const,
        name: "Uchiha",
        content: "# Uchiha\n\n宇智波一族。",
      },
      {
        entityKey: "kekkei:5",
        kind: "ability" as const,
        name: "Sharingan",
        content: "# Sharingan\n\n写轮眼。",
      },
    ])
      worlds.upsertCard({
        worldId: "naruto",
        ...card,
        now,
      });
    worlds.upsertCard({
      worldId: "naruto",
      entityKey: "character:1293",
      kind: "character",
      name: "Itachi Uchiha",
      content: [
        "# Itachi Uchiha",
        "",
        "village_affiliation_recorded：[[village:3|Konohagakure]]",
        "clan_member_recorded：[[clan:45|Uchiha]]",
        "kekkei_genkai_recorded：[[kekkei:5|Sharingan]]",
      ].join("\n"),
      now,
    });

    const view = projectSourceWorldForProduction(worlds, "naruto", {
      requestId: "00000000-0000-4000-8000-000000000457",
      scale: "W1",
      premise: "深化木叶村",
      worldTime: "第三次忍界大战前",
      focus: "Konohagakure",
      genre: "火影同人",
      scarcity: "",
      instruction: "",
      parentAreaId: null,
    });

    expect(view.nodes.map((node) => node.name)).toEqual(
      expect.arrayContaining([
        "Konohagakure",
        "Itachi Uchiha",
        "Uchiha",
        "Sharingan",
      ]),
    );
    expect(
      view.nodes.find((node) => node.name === "Itachi Uchiha")?.areaRef,
    ).toBe("source:village:3");
    expect(view.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromRef: "source:character:1293",
          toRef: "source:clan:45",
        }),
        expect.objectContaining({
          fromRef: "source:character:1293",
          toRef: "source:kekkei:5",
        }),
      ]),
    );
  });

  it("keeps an explicit time-slice focus isolated from all-era second-hop contamination", () => {
    const worlds = seedWorld();
    for (const card of [
      {
        entityKey: "village:konoha",
        kind: "location" as const,
        name: "Konohagakure",
        content: "# Konohagakure\n\n木叶隐村。",
      },
      {
        entityKey: "character:kakashi",
        kind: "character" as const,
        name: "Kakashi Hatake",
        content:
          "# Kakashi Hatake\n\nvillage_affiliation_recorded：[[village:konoha|Konohagakure]]",
      },
      {
        entityKey: "character:boruto",
        kind: "character" as const,
        name: "Boruto Uzumaki",
        content:
          "# Boruto Uzumaki\n\nvillage_affiliation_recorded：[[village:konoha|Konohagakure]]",
      },
    ])
      worlds.upsertCard({
        worldId: "naruto",
        ...card,
        now,
      });
    worlds.upsertCard({
      worldId: "naruto",
      entityKey: "slice:third-war-konoha",
      kind: "event",
      name: "第三次忍界大战｜木叶切片",
      content: [
        "# 第三次忍界大战｜木叶切片",
        "",
        "世界时间：第三次忍界大战",
        "母体地点：[[village:konoha|Konohagakure]]",
        "当期人物：[[character:kakashi|Kakashi Hatake]]",
      ].join("\n"),
      now,
    });

    const view = projectSourceWorldForProduction(worlds, "naruto", {
      requestId: "00000000-0000-4000-8000-000000000458",
      scale: "W1",
      premise: "审计三战时期木叶",
      worldTime: "第三次忍界大战",
      focus: "第三次忍界大战｜木叶切片",
      genre: "火影同人",
      scarcity: "",
      instruction: "",
      parentAreaId: null,
    });

    expect(view.nodes.map((node) => node.name)).toEqual(
      expect.arrayContaining([
        "第三次忍界大战｜木叶切片",
        "Konohagakure",
        "Kakashi Hatake",
      ]),
    );
    expect(view.nodes.map((node) => node.name)).not.toContain("Boruto Uzumaki");
  });

  it("projects existing Source identities instead of pretending they are Project Canon", async () => {
    seedWorld();
    const document = await generateSourceWorldProduction(
      db!,
      {
        worldId: "naruto",
        request: {
          requestId: "00000000-0000-4000-8000-000000000257",
          scale: "W1",
          premise: "深化写轮眼力量网络",
          worldTime: "原作全时代参考",
          focus: "写轮眼",
          genre: "火影同人",
          scarcity: "",
          instruction: "",
          parentAreaId: null,
        },
      },
      {
        generateOverride: ({ existingWorld, operation, prompt }) => {
          expect(operation).toBe("power");
          expect(prompt).toContain("source:<stable-key>");
          expect(prompt).toContain("意淫承重");
          expect(prompt).toContain("承重不是平衡税");
          expect(prompt).toContain(
            "Selection decides what deserves production",
          );
          expect(existingWorld.nodes).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                localId: "source:ability:sharingan",
                existingCanonId: null,
                existingSourceKey: "ability:sharingan",
              }),
            ]),
          );
          return {
            summary: "补写轮眼的社会连接",
            nodes: [
              {
                localId: "sharingan_training",
                existingCanonId: null,
                existingSourceKey: null,
                type: "rule",
                atlasKind: "ability",
                name: "写轮眼训练经验",
                description: "围绕写轮眼使用形成的训练经验与能力理解。",
                areaRef: null,
                value: "对掌握写轮眼的人具有明显能力价值",
                access: "由掌握者的训练与传授进入",
                motive: "提高写轮眼运用水平",
                currentActivity: "被掌握者持续训练和总结",
                origin: "inference",
                sourceNote: "模型推断候选，待原作资料核验",
                readerSemantics: null,
              },
            ],
            links: [
              {
                fromRef: "sharingan_training",
                toRef: "source:ability:sharingan",
                relation: "依赖",
                description: "训练经验围绕写轮眼形成",
                status: "current",
              },
            ],
            activities: [],
            interactions: [],
            openThreads: [],
            dimensionSignals: [],
          };
        },
      },
    );
    expect(document.production?.executed[0]?.workshop).toBe("power");
    expect(document.nodes[0]?.origin).toBe("inference");
  });

  it("auto-plans source-reusable multi-thread fantasy before generic Atlas coverage", async () => {
    seedWorld();
    const document = await generateSourceWorldProduction(
      db!,
      {
        worldId: "naruto",
        request: {
          requestId: "00000000-0000-4000-8000-000000000557",
          scale: "W1",
          premise: "深化火影中真正值得男频长期使用的高价力量对象",
          worldTime: "原作全时代参考",
          focus: "写轮眼",
          genre: "火影同人",
          scarcity: "",
          instruction: "",
          parentAreaId: null,
        },
      },
      {
        planWishFulfillmentOverride: ({ existingWorld, prompt }) => {
          expect(existingWorld.nodes.map((node) => node.localId)).toContain(
            "source:ability:sharingan",
          );
          expect(prompt).toContain("source:ability:sharingan");
          expect(prompt).toContain("readerSemantics");
          expect(prompt).toContain("selectionPolicy");
          return {
            readerFantasy:
              "未来男主围绕写轮眼不断获得力量、身份重估和更高忍者圈层入口",
            threads: [
              {
                id: "wish:source:sharingan-mastery",
                targetRefs: ["source:ability:sharingan"],
                targetNames: ["写轮眼"],
                dimension: "power",
                readerFantasy: "真正掌握并开发写轮眼，使它成为男主独有战斗资产",
                protagonistDesire: null,
                desiredChange: "从旁观高价血继变成实际掌握和开发者",
                privatePrivilege: "获得普通忍者无法拥有的力量权限",
                publicRepricing: "高手开始按写轮眼掌握者重新评估未来男主",
                upgradeLeverage: ["高阶忍术", "宇智波相关高价人物"],
                phase: "selected",
              },
              {
                id: "wish:source:sharingan-status",
                targetRefs: ["source:ability:sharingan"],
                targetNames: ["写轮眼"],
                dimension: "status",
                readerFantasy:
                  "写轮眼不只是一项技能，还改变未来男主在忍界的身份价格",
                protagonistDesire: null,
                desiredChange: "由低位忍者变成必须被高手和组织重新定价的人",
                privatePrivilege: null,
                publicRepricing: "忍村高层和敌人公开改变对他的战略估值",
                upgradeLeverage: ["高价任务", "核心忍者圈"],
                phase: "candidate",
              },
            ],
            bearingRequirements: [
              {
                id: "bearing:source:sharingan-rule",
                threadIds: ["wish:source:sharingan-mastery"],
                kind: "rule",
                requirement: "补清写轮眼真实能力规则、掌握者与可执行动作",
                evidenceRefs: [],
                status: "missing",
                raisesPriceBecause:
                  "力量规则与真实掌握者越清楚，取得以后越不是廉价白送",
              },
              {
                id: "bearing:source:sharingan-price",
                threadIds: ["wish:source:sharingan-status"],
                kind: "price",
                requirement: "补清忍界人物和组织怎样给写轮眼及掌握者定价",
                evidenceRefs: [],
                status: "candidate",
                raisesPriceBecause: "公开社会价格让身份重估可被Reader看见",
              },
            ],
            settlementTargets: [
              {
                threadId: "wish:source:sharingan-mastery",
                assetKind: "ability",
                targetGain: "写轮眼成为未来男主可持续开发的高价能力资产",
              },
            ],
          };
        },
        generateOverride: ({ request, operation, prompt }) => {
          expect(request.wishFulfillment?.mode).toBe("source_reusable");
          expect(request.wishFulfillment?.threads).toHaveLength(2);
          expect(operation).toBe("power");
          expect(prompt).toContain("wish:source:sharingan-mastery");
          expect(prompt).toContain("bearing:source:sharingan-rule");
          return {
            summary: "补写轮眼的力量承重",
            nodes: [
              {
                localId: "sharingan_rule_detail",
                existingCanonId: null,
                existingSourceKey: null,
                type: "rule",
                atlasKind: "ability",
                name: "写轮眼运用规则候选",
                description:
                  "围绕写轮眼实际掌握、使用与开发形成的候选规则说明。",
                areaRef: null,
                value: "对写轮眼掌握者与忍界高层具有高能力价格",
                access: "通过真实掌握、训练与传承关系进入",
                motive: "解释并加厚写轮眼高价能力的实际运行",
                currentActivity: "由掌握者在战斗和训练中持续体现",
                origin: "inference",
                sourceNote: "模型推断候选，待原作资料核验",
                readerSemantics: null,
              },
            ],
            links: [
              {
                fromRef: "sharingan_rule_detail",
                toRef: "source:ability:sharingan",
                relation: "依赖",
                description: "候选规则围绕既有写轮眼对象形成",
                status: "current",
              },
            ],
            activities: [],
            interactions: [],
            openThreads: [],
            dimensionSignals: [],
          };
        },
      },
    );

    expect(document.production?.executed[0]).toMatchObject({
      workshop: "power",
      wishFulfillmentThreadIds: ["wish:source:sharingan-mastery"],
      bearingRequirementIds: ["bearing:source:sharingan-rule"],
    });
    expect(document.nodes[0]?.origin).toBe("inference");
  });

  it("rejects a newly generated object that falsely claims source_canon", async () => {
    seedWorld();
    await expect(
      generateSourceWorldProduction(
        db!,
        {
          worldId: "naruto",
          request: {
            requestId: "00000000-0000-4000-8000-000000000357",
            scale: "W1",
            premise: "深化写轮眼",
            worldTime: "原作全时代参考",
            focus: "写轮眼",
            genre: "火影同人",
            scarcity: "",
            instruction: "",
            parentAreaId: null,
          },
        },
        {
          generateOverride: () => ({
            summary: "错误候选",
            nodes: [
              {
                localId: "fake_canon",
                existingCanonId: null,
                existingSourceKey: null,
                type: "rule",
                atlasKind: "ability",
                name: "不存在的原作忍术",
                description: "模型自行生成，却试图冒充原作事实。",
                areaRef: null,
                value: "高",
                access: "未知",
                motive: "",
                currentActivity: "",
                origin: "source_canon",
                sourceNote: "",
                readerSemantics: null,
              },
            ],
            links: [],
            activities: [],
            interactions: [],
            openThreads: [],
            dimensionSignals: [],
          }),
        },
      ),
    ).rejects.toMatchObject({
      code: "source.world.production.fabricated_canon",
    });
  });
});
