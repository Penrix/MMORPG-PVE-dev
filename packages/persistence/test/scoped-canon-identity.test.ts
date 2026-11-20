import { afterEach, describe, expect, it } from "vitest";
import {
  createCanonEntity,
  createCanonFact,
  createProject,
} from "@narralume/domain";
import {
  SqliteCanonRepository,
  SqliteProjectRepository,
  SqliteProjectWorldRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-20T00:00:00.000Z";
let db: NodeNarrativeDatabase | null = null;
afterEach(() => {
  db?.close();
  db = null;
});

describe("Canon names do not identify people across different project world spaces", () => {
  it("keeps two literally same-name people separate while preserving ordinary legacy name conflicts and FTS", () => {
    db = new NodeNarrativeDatabase();
    expect(db.migrate()).toBe(53);
    const projects = new SqliteProjectRepository(db);
    projects.insert(
      createProject({ id: "novel", title: "火影与海贼同一本书", now }),
    );
    projects.insert(createProject({ id: "other", title: "另一部作品", now }));
    const worlds = new SqliteProjectWorldRepository(db);
    for (const [id, name] of [
      ["ninja", "火影忍界"],
      ["ocean", "海贼世界"],
    ] as const)
      worlds.createSpace({
        id,
        projectId: "novel",
        name,
        kind: "realm",
        parentSpaceId: null,
        sourceCorpusId: null,
        description: "项目内具体世界",
        createdAt: now,
      });
    worlds.createSpace({
      id: "other-world",
      projectId: "other",
      name: "另一本书的地方",
      kind: "realm",
      parentSpaceId: null,
      sourceCorpusId: null,
      description: "其他项目",
      createdAt: now,
    });
    const canon = new SqliteCanonRepository(db);
    const name = "宇智波鼬";
    const first = createCanonEntity({
      id: "itachi-ninja",
      projectId: "novel",
      type: "character",
      name,
      worldScopeId: "ninja",
      now,
    });
    const second = createCanonEntity({
      id: "itachi-ocean",
      projectId: "novel",
      type: "character",
      name,
      worldScopeId: "ocean",
      now,
    });
    canon.insertEntity(first);
    canon.insertEntity(second);
    expect(canon.getEntity("novel", "itachi-ninja")).toEqual(first);
    expect(canon.getEntity("novel", "itachi-ocean")).toEqual(second);
    expect(canon.listEntities("novel", { type: "character" })).toHaveLength(2);
    expect(() =>
      canon.insertEntity(
        createCanonEntity({
          id: "duplicate",
          projectId: "novel",
          type: "character",
          name,
          worldScopeId: "ninja",
          now,
        }),
      ),
    ).toThrow();
    expect(() =>
      canon.insertEntity(
        createCanonEntity({
          id: "foreign-scope",
          projectId: "novel",
          type: "character",
          name,
          worldScopeId: "other-world",
          now,
        }),
      ),
    ).toThrow("world.scope_not_found");
    canon.insertFact(
      createCanonFact({
        id: "ninja-status",
        projectId: "novel",
        subjectId: "itachi-ninja",
        predicate: "social_role",
        value: "忍界人物",
        authority: "confirmed",
        sourceType: "author",
        now,
      }),
    );
    canon.insertFact(
      createCanonFact({
        id: "ocean-status",
        projectId: "novel",
        subjectId: "itachi-ocean",
        predicate: "social_role",
        value: "海贼世界同名者",
        authority: "confirmed",
        sourceType: "author",
        now,
      }),
    );
    expect(
      canon
        .listEffectiveFacts("novel", { subjectId: "itachi-ninja" })
        .map((f) => f.value),
    ).toEqual(["忍界人物"]);
    expect(
      canon
        .listEffectiveFacts("novel", { subjectId: "itachi-ocean" })
        .map((f) => f.value),
    ).toEqual(["海贼世界同名者"]);
    const fts = db.raw
      .prepare(
        `
      SELECT rowid,name FROM canon_entities_fts
      WHERE canon_entities_fts MATCH ?
    `,
      )
      .all("宇智波鼬") as Array<{ rowid: number; name: string }>;
    expect(fts.map((x) => x.name)).toEqual([name, name]);
    const updated = canon.updateEntity({
      ...first,
      description: "已发生的新人生经历",
    });
    expect(updated.worldScopeId).toBe("ninja");
    expect(canon.getEntity("novel", "itachi-ninja")?.worldScopeId).toBe(
      "ninja",
    );
    expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("retains old single-world exact-name uniqueness for unscoped Canon entries", () => {
    db = new NodeNarrativeDatabase();
    db.migrate();
    new SqliteProjectRepository(db).insert(
      createProject({
        id: "novel",
        title: "普通单世界小说",
        now,
      }),
    );
    const canon = new SqliteCanonRepository(db);
    const first = createCanonEntity({
      id: "first",
      projectId: "novel",
      type: "character",
      name: "张三",
      now,
    });
    canon.insertEntity(first);
    expect(canon.getEntity("novel", "first")).toEqual(first);
    expect(() =>
      canon.insertEntity(
        createCanonEntity({
          id: "second",
          projectId: "novel",
          type: "character",
          name: "张三",
          now,
        }),
      ),
    ).toThrow();
  });
});
