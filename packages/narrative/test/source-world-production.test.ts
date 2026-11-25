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
          expect(prompt).toContain("Selection decides what deserves production");
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
