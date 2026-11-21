import { afterEach, describe, expect, it } from "vitest";
import {
  createCanonEntity,
  createCanonFact,
  createOutlineNode,
  createProject,
} from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteNarrativeStateRepository,
  SqliteProjectRealityRepository,
  SqliteProjectRepository,
  SqliteProjectWorldRepository,
  SqliteSourceCorpusRepository,
  SqliteStoryRepository,
  SqliteUnifiedSourceWorldRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-21T10:30:00.000Z";
let db: NodeNarrativeDatabase | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe("Project Reality ↔ lightweight World Atlas adapter", () => {
  it("prefers Markdown Atlas cards for source baseline and projects native project facts/relations", () => {
    db = new NodeNarrativeDatabase();
    expect(db.migrate()).toBe(54);

    const projects = new SqliteProjectRepository(db);
    projects.insert(createProject({ id: "p1", title: "火影同人", now }));

    const sources = new SqliteSourceCorpusRepository(db);
    sources.upsertCorpus({
      id: "wiki:naruto",
      title: "火影原生母体",
      sourceUrl: "",
      rightsNotice: "test",
      importer: "test",
      metadata: {},
      importedAt: now,
    });
    sources.bindProject("p1", "wiki:naruto");

    const atlas = new SqliteUnifiedSourceWorldRepository(db);
    atlas.createWorld({
      id: "naruto",
      name: "火影忍者",
      kind: "fictional",
      canonicalCorpusId: "wiki:naruto",
      description: "",
      createdAt: now,
    });
    atlas.upsertCard({
      worldId: "naruto",
      entityKey: "character:minato",
      kind: "character",
      name: "波风水门",
      content: "# 波风水门\n\n木叶忍者。",
      now,
    });
    atlas.upsertCard({
      worldId: "naruto",
      entityKey: "character:kakashi",
      kind: "character",
      name: "旗木卡卡西",
      content: "# 旗木卡卡西\n\n木叶忍者。\n\n老师：[[波风水门]]",
      now,
    });

    const canon = new SqliteCanonRepository(db);
    canon.insertEntity(
      createCanonEntity({
        id: "kakashi",
        projectId: "p1",
        type: "character",
        worldScopeId: "project:p1",
        name: "旗木卡卡西",
        now,
      }),
    );
    canon.insertEntity(
      createCanonEntity({
        id: "minato",
        projectId: "p1",
        type: "character",
        worldScopeId: "project:p1",
        name: "波风水门",
        now,
      }),
    );
    const projectWorld = new SqliteProjectWorldRepository(db);
    projectWorld.linkSourceEntity({
      projectId: "p1",
      entityId: "kakashi",
      corpusId: "wiki:naruto",
      sourceKey: "character:kakashi",
      linkKind: "counterpart",
      confidence: 1,
      sourceNote: "原著身份",
      createdAt: now,
    });

    const story = new SqliteStoryRepository(db);
    const book = story.insertOutlineNode(
      createOutlineNode({
        id: "book",
        projectId: "p1",
        parent: null,
        kind: "book",
        ordinal: 0,
        title: "Book",
        now,
      }),
    );
    story.insertOutlineNode(
      createOutlineNode({
        id: "chapter-1",
        projectId: "p1",
        parent: book,
        kind: "chapter",
        ordinal: 0,
        title: "Chapter 1",
        now,
      }),
    );

    canon.insertFact(
      createCanonFact({
        id: "fact-rank",
        projectId: "p1",
        subjectId: "kakashi",
        predicate: "当前身份",
        value: "木叶上忍",
        authority: "confirmed",
        sourceType: "chapter",
        now,
      }),
    );
    const state = new SqliteNarrativeStateRepository(db, canon, story);
    state.insertRelationship({
      id: "rel-project",
      projectId: "p1",
      fromEntityId: "kakashi",
      toEntityId: "minato",
      relation: "怀念",
      intensity: 8,
      state: {},
      outlineNodeId: "chapter-1",
      storyTime: null,
      sourceId: "chapter",
      supersedesEventId: null,
      createdAt: now,
    });

    const view = new SqliteProjectRealityRepository(db).getEntityReality(
      "p1",
      "kakashi",
    );

    expect(view.sourceAtlasReferences).toHaveLength(1);
    expect(view.sourceAtlasReferences[0]?.card.content).toContain(
      "老师：[[波风水门]]",
    );
    expect(view.effectiveSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facet: "lore",
          slotKey: "card",
          origin: "reference",
        }),
        expect.objectContaining({
          facet: "relationship",
          origin: "reference",
          value: expect.objectContaining({
            relation: "老师",
            otherName: "波风水门",
          }),
        }),
        expect.objectContaining({
          facet: "claim",
          slotKey: "当前身份",
          origin: "project",
          value: ["木叶上忍"],
        }),
        expect.objectContaining({
          facet: "relationship",
          slotKey: "rel-project",
          origin: "project",
          value: expect.objectContaining({
            relation: "怀念",
            from_entity_id: "kakashi",
            to_entity_id: "minato",
          }),
        }),
      ]),
    );
  });
});
