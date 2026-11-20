import { afterEach, describe, expect, it } from "vitest";
import { createCanonEntity, createProject } from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteProjectRepository,
  SqliteSourceCorpusRepository,
  SqliteProjectWorldRepository,
  SqliteWorldEncyclopediaRepository,
  type ProjectTravel,
  type SourceRecord,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-20T13:00:00.000Z";
let db: NodeNarrativeDatabase | null = null;
afterEach(() => {
  db?.close();
  db = null;
});

function setup() {
  db = new NodeNarrativeDatabase();
  expect(db.migrate()).toBe(51);
  const projects = new SqliteProjectRepository(db);
  projects.insert(
    createProject({ id: "novel", title: "火影海贼同一个男主", now }),
  );
  projects.insert(createProject({ id: "other", title: "独立另一本小说", now }));
  const source = new SqliteSourceCorpusRepository(db);
  for (const [id, title] of [
    ["naruto", "火影原生母体"],
    ["onepiece", "海贼原生母体"],
  ] as const) {
    source.upsertCorpus({
      id,
      title,
      sourceUrl: "https://example.org/" + id,
      rightsNotice: "测试资料",
      importer: "test",
      metadata: {},
      importedAt: now,
    });
  }
  const record: SourceRecord = {
    corpusId: "naruto",
    sourceKey: "character:itachi",
    kind: "character",
    name: "宇智波鼬",
    aliases: [],
    summary: "源材料原有角色",
    raw: { name: "宇智波鼬", source: "test" },
    sourceUrl: "https://example.org/naruto/itachi",
    originCollection: "characters",
    importedAt: now,
  };
  source.upsertRecord(record);
  source.bindProject("novel", "naruto");
  source.bindProject("novel", "onepiece");

  const canon = new SqliteCanonRepository(db);
  for (const [projectId, id, name, type] of [
    ["novel", "hero", "原创穿越男主", "character"],
    ["novel", "itachi", "宇智波鼬", "character"],
    ["novel", "dragon", "楼兰龙脉", "concept"],
    ["other", "other-hero", "另一小说男主", "character"],
  ] as const)
    canon.insertEntity(createCanonEntity({ projectId, id, name, type, now }));
  const worlds = new SqliteProjectWorldRepository(db);
  for (const [id, name, kind, parent, corpus] of [
    ["ninja", "忍界", "realm", null, "naruto"],
    ["loulan", "楼兰", "region", "ninja", "naruto"],
    ["ocean", "大海世界", "realm", null, "onepiece"],
  ] as const)
    worlds.createSpace({
      projectId: "novel",
      id,
      name,
      kind,
      parentSpaceId: parent,
      sourceCorpusId: corpus,
      description: "一个项目世界中的具体地点或世界区",
      createdAt: now,
    });
  worlds.createSpace({
    projectId: "other",
    id: "other-world",
    name: "另一本小说的世界",
    kind: "realm",
    parentSpaceId: null,
    sourceCorpusId: null,
    description: "不应与其他小说相互引用",
    createdAt: now,
  });
  return { worlds, source, canon };
}

function event(
  id: string,
  seq: number,
  title: string,
  projectId = "novel",
): void {
  db!.raw
    .prepare(
      `
    INSERT INTO timeline_events(
      id,project_id,title,description,sequence,visibility,
      story_time_start,source_id,created_at,updated_at
    ) VALUES (?,?,?, ?,?,'omniscient',?,?,?,?)
  `,
    )
    .run(
      id,
      projectId,
      title,
      title + "是本小说中实际发生的事件",
      seq,
      "故事主观时间第" + seq + "段",
      "project-story",
      now,
      now,
    );
}
function travel(
  id: string,
  eventId: string,
  fromSpaceId: string,
  toSpaceId: string,
  departureTime: string,
  arrivalTime: string,
  travelKind: ProjectTravel["travelKind"],
): ProjectTravel {
  return {
    id,
    projectId: "novel",
    eventId,
    travelerEntityId: "hero",
    fromSpaceId,
    toSpaceId,
    departureTime,
    arrivalTime,
    fromBranchId: null,
    toBranchId: null,
    travelKind,
    mechanismEntityId: null,
    consequenceNote: "男主的既有身份与已发生事实不重置",
    createdAt: now,
  };
}

describe("Module 2: one Project Reality with many mother worlds and time travel", () => {
  it("keeps a single hero identity through Loulan, Naruto → One Piece → Naruto", () => {
    const { worlds, source, canon } = setup();
    worlds.linkSourceEntity({
      projectId: "novel",
      entityId: "itachi",
      corpusId: "naruto",
      sourceKey: "character:itachi",
      linkKind: "counterpart",
      confidence: 0.95,
      sourceNote: "明确的原著角色对应，非自动采纳原著未来",
      createdAt: now,
    });
    worlds.attachEntityToSpace({
      projectId: "novel",
      entityId: "hero",
      spaceId: "ninja",
      linkKind: "origin",
      sourceNote: "穿越入场的已确认位置",
      createdAt: now,
    });
    event("e-loulan", 1, "通过楼兰龙脉进入忍界过去");
    event("e-ocean", 2, "从火影进入海贼");
    event("e-return", 3, "从海贼返回火影");
    worlds.recordTravel(
      travel(
        "travel1",
        "e-loulan",
        "ninja",
        "loulan",
        "第三次忍界大战",
        "木叶更早的年代",
        "time_travel",
      ),
    );
    worlds.recordTravel(
      travel(
        "travel2",
        "e-ocean",
        "loulan",
        "ocean",
        "忍界某个时间",
        "大海世界某一时期",
        "cross_world",
      ),
    );
    worlds.recordTravel(
      travel(
        "travel3",
        "e-return",
        "ocean",
        "ninja",
        "大海世界后期",
        "忍界未来某年",
        "cross_world",
      ),
    );

    const history = worlds.listTravelerHistory("novel", "hero");
    expect(history.map((h) => h.storyEventTitle)).toEqual([
      "通过楼兰龙脉进入忍界过去",
      "从火影进入海贼",
      "从海贼返回火影",
    ]);
    expect(history.map((h) => h.storySequence)).toEqual([1, 2, 3]);
    // A second write of the SAME person's SAME event must fail atomically.
    expect(() =>
      worlds.recordTravel(
        travel(
          "duplicate-trip",
          "e-ocean",
          "loulan",
          "ocean",
          "忍界某个时间",
          "大海贼时代",
          "cross_world",
        ),
      ),
    ).toThrow();
    expect(worlds.listEventCoordinates("novel", "e-ocean")).toHaveLength(2);
    expect(history.map((h) => h.travelerEntityId)).toEqual([
      "hero",
      "hero",
      "hero",
    ]);
    expect(history[0]?.arrivalTime).toBe("木叶更早的年代");
    expect(history[0]?.departureTime).toBe("第三次忍界大战");
    expect(
      worlds
        .listEventCoordinates("novel", "e-loulan")
        .map((p) => [p.coordinateRole, p.spaceId, p.branchId]),
    ).toEqual([
      ["departure", "ninja", null],
      ["arrival", "loulan", null],
    ]);
    expect(
      db!.raw.prepare("SELECT count(*) AS n FROM project_time_branches").get(),
    ).toEqual({ n: 0 });
    expect(worlds.listSpaces("novel")).toHaveLength(3);
    expect(source.listProjectCorpora("novel")).toHaveLength(2);
    expect(source.listProjectCorpora("other")).toHaveLength(0);
    expect(worlds.listSourceLinks("novel", "itachi")[0]?.sourceKey).toBe(
      "character:itachi",
    );
    const encyclopedia = new SqliteWorldEncyclopediaRepository(db!);
    const itachiDossier = encyclopedia.getDossier("novel", "itachi");
    const heroDossier = encyclopedia.getDossier("novel", "hero");
    expect(itachiDossier.sourceIdentities).toEqual([
      expect.objectContaining({
        corpusId: "naruto",
        sourceKey: "character:itachi",
      }),
    ]);
    expect(heroDossier.worldAffiliations).toEqual([
      expect.objectContaining({ spaceId: "ninja", linkKind: "origin" }),
    ]);
    expect(heroDossier.travelHistory).toHaveLength(3);
    expect(source.getRecord("naruto", "character:itachi")?.raw).toEqual({
      name: "宇智波鼬",
      source: "test",
    });
    expect(
      canon.listEntities("novel").filter((e) => e.id === "hero"),
    ).toHaveLength(1);
    expect(
      canon.listEntities("other").filter((e) => e.id === "hero"),
    ).toHaveLength(0);
    expect(db!.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("rejects cross-project identity, locations, events, sources and branch references", () => {
    const { worlds } = setup();
    event("e-novel", 1, "小说世界真实事件");
    event("e-other", 1, "别的小说事件", "other");
    expect(() =>
      worlds.linkSourceEntity({
        projectId: "novel",
        entityId: "other-hero",
        corpusId: "naruto",
        sourceKey: "character:itachi",
        linkKind: "counterpart",
        confidence: null,
        sourceNote: "非法跨小说角色对应",
        createdAt: now,
      }),
    ).toThrow(/world.project_mismatch/);
    expect(() =>
      worlds.recordTravel({
        ...travel(
          "cross1",
          "e-novel",
          "ninja",
          "other-world",
          "a",
          "b",
          "cross_world",
        ),
      }),
    ).toThrow();
    expect(worlds.listEventCoordinates("novel", "e-novel")).toHaveLength(0);
    expect(() =>
      worlds.recordTravel({
        ...travel(
          "cross2",
          "e-other",
          "ninja",
          "ocean",
          "a",
          "b",
          "cross_world",
        ),
      }),
    ).toThrow(/world.project_mismatch/);
    expect(() =>
      worlds.createBranch({
        id: "other-branch",
        projectId: "novel",
        name: "非法跨小说事件分支",
        parentBranchId: null,
        divergenceEventId: "e-other",
        causalRule: "不得用别的小说事件作此书分支节点",
        createdAt: now,
      }),
    ).toThrow(/world.project_mismatch/);
    expect(db!.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("only creates branches and simultaneous selves when the author actually declares them", () => {
    const { worlds } = setup();
    event("e-diverge", 1, "作者明确规定发生分支");
    worlds.createBranch({
      id: "branch-declared",
      projectId: "novel",
      name: "作者指定的时间分支",
      parentBranchId: null,
      divergenceEventId: "e-diverge",
      causalRule: "作者在本小说中已经确认的规则",
      createdAt: now,
    });
    worlds.registerInstance({
      id: "hero-past-body",
      projectId: "novel",
      entityId: "hero",
      spaceId: "loulan",
      branchId: "branch-declared",
      instanceKind: "temporal_self",
      appearedEventId: "e-diverge",
      endedEventId: null,
      description: "只有真实出现两个同场实例时才建立此条",
      createdAt: now,
    });
    expect(worlds.listEntityInstances("novel", "hero")).toEqual([
      expect.objectContaining({
        id: "hero-past-body",
        entityId: "hero",
        branchId: "branch-declared",
      }),
    ]);
    expect(worlds.listTravelerHistory("novel", "hero")).toHaveLength(0);
  });
});
