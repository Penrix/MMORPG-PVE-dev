import { afterEach, describe, expect, it } from "vitest";
import {
  inverseRelation,
  parseTypedWikiLinks,
  SqliteSourceCorpusRepository,
  SqliteUnifiedSourceWorldRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-21T06:30:00.000Z";
let db: NodeNarrativeDatabase | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe("World Atlas lightweight cards and typed wiki links", () => {
  it("parses typed links but leaves plain wiki mentions unindexed", () => {
    const links = parseTypedWikiLinks(`
# 旗木卡卡西

这是正文里的普通提及 [[木叶隐村]]

老师：[[波风水门]]
学生：[[漩涡鸣人]]、[[宇智波佐助]]
所属组织:
  - [[木叶隐村]]
  - [[木叶暗部]]
`);
    expect(links).toEqual([
      { relation: "老师", target: "波风水门", label: null },
      { relation: "学生", target: "漩涡鸣人", label: null },
      { relation: "学生", target: "宇智波佐助", label: null },
      { relation: "所属组织", target: "木叶隐村", label: null },
      { relation: "所属组织", target: "木叶暗部", label: null },
    ]);
    expect(inverseRelation("老师")).toBe("学生");
    expect(inverseRelation("敌对")).toBe("敌对");
    expect(inverseRelation("自定义关系")).toBeNull();
  });

  it("keeps the Markdown card as truth and rebuilds source_relations as a derived index", () => {
    db = new NodeNarrativeDatabase();
    expect(db.migrate()).toBe(54);

    const sources = new SqliteSourceCorpusRepository(db);
    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    sources.upsertCorpus({
      id: "wiki:naruto",
      title: "火影原生母体",
      sourceUrl: "",
      rightsNotice: "test",
      importer: "curated-original-world-wiki",
      metadata: {},
      importedAt: now,
    });
    worlds.createWorld({
      id: "naruto",
      name: "火影忍者",
      kind: "fictional",
      canonicalCorpusId: "wiki:naruto",
      description: "",
      createdAt: now,
    });

    const simpleCard = (
      entityKey: string,
      kind: "character" | "organization" | "ability",
      name: string,
    ) =>
      worlds.upsertCard({
        worldId: "naruto",
        entityKey,
        kind,
        name,
        content: `# ${name}\n\n原生世界资料卡。`,
        now,
      });

    simpleCard("character:minato", "character", "波风水门");
    simpleCard("character:naruto", "character", "漩涡鸣人");
    simpleCard("organization:konoha", "organization", "木叶隐村");
    simpleCard("ability:sharingan", "ability", "写轮眼");

    const saved = worlds.upsertCard({
      worldId: "naruto",
      entityKey: "character:kakashi",
      kind: "character",
      name: "旗木卡卡西",
      aliases: ["卡卡西"],
      content: `# 旗木卡卡西

木叶上忍。

老师：[[波风水门]]
学生：[[漩涡鸣人]]
所属：[[organization:konoha|木叶隐村]]
拥有：[[写轮眼]]
朋友：[[不存在的人]]
`,
      now,
    });

    expect(saved.card.content).toContain("老师：[[波风水门]]");
    expect(saved.unresolvedLinks).toEqual([
      { relation: "朋友", target: "不存在的人" },
    ]);

    const kakashi = worlds.getCard("naruto", "character:kakashi");
    expect(
      kakashi?.relations.map((r) => [r.displayRelation, r.otherName]),
    ).toEqual(
      expect.arrayContaining([
        ["学生", "漩涡鸣人"],
        ["老师", "波风水门"],
        ["拥有", "写轮眼"],
        ["所属", "木叶隐村"],
      ]),
    );

    const minato = worlds.getCard("naruto", "character:minato");
    expect(minato?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: "in",
          displayRelation: "学生",
          otherName: "旗木卡卡西",
        }),
      ]),
    );

    // Removing a typed link and saving the card removes only that derived edge.
    worlds.upsertCard({
      worldId: "naruto",
      entityKey: "character:kakashi",
      kind: "character",
      name: "旗木卡卡西",
      content: `# 旗木卡卡西\n\n老师：[[波风水门]]\n`,
      now,
    });
    expect(
      worlds
        .getCard("naruto", "character:kakashi")
        ?.relations.map((r) => r.otherName),
    ).toEqual(["波风水门"]);

    // The prose card survives deleting/rebuilding the relation index.
    sources.clearOutgoingRelations("wiki:naruto", "character:kakashi");
    expect(worlds.getCard("naruto", "character:kakashi")?.content).toContain(
      "老师：[[波风水门]]",
    );
    expect(worlds.reindexCard("naruto", "character:kakashi")).toEqual([]);
    expect(worlds.getCard("naruto", "character:minato")?.relations[0]).toEqual(
      expect.objectContaining({
        displayRelation: "学生",
        otherName: "旗木卡卡西",
      }),
    );
  });
});
