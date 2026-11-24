import { afterEach, describe, expect, it } from "vitest";
import {
  SqliteSourceCorpusRepository,
  SqliteSourceWorldProductionRepository,
  SqliteUnifiedSourceWorldRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

let db: NodeNarrativeDatabase | null = null;
const now = "2026-11-24T14:50:00.000Z";

afterEach(() => {
  db?.close();
  db = null;
});

describe("Source World production drafts", () => {
  it("stores author-reviewable World Builder candidates without creating a fake Project", () => {
    db = new NodeNarrativeDatabase();
    expect(db.migrate()).toBe(57);
    const sources = new SqliteSourceCorpusRepository(db);
    const worlds = new SqliteUnifiedSourceWorldRepository(db);
    const drafts = new SqliteSourceWorldProductionRepository(db);
    sources.upsertCorpus({
      id: "wiki:naruto",
      title: "火影",
      sourceUrl: "",
      rightsNotice: "test",
      importer: "test",
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
    const request = {
      requestId: "00000000-0000-4000-8000-000000000057",
      scale: "W1" as const,
      premise: "恢复木叶忍者社会",
      worldTime: "第三次忍界大战前",
      focus: "木叶医院",
      genre: "火影同人",
      scarcity: "",
      instruction: "",
      parentAreaId: null,
    };
    const document = {
      summary: "候选世界内容",
      nodes: [],
      links: [],
      activities: [],
      openThreads: ["继续补人物"],
      interactions: [],
      dimensionSignals: [],
    };
    const first = drafts.insert({
      id: "draft:naruto:1",
      worldId: "naruto",
      request,
      document,
      now,
    });
    expect(first.status).toBe("draft");
    expect(drafts.byRequest("naruto", request.requestId)?.id).toBe(first.id);
    const revised = drafts.revise({
      worldId: "naruto",
      id: first.id,
      expectedVersion: 1,
      document: { ...document, summary: "作者修订后的候选" },
      now,
    });
    expect(revised.version).toBe(2);
    const adopted = drafts.markAdopted(
      "naruto",
      first.id,
      2,
      { hospital: "location:konoha-hospital" },
      now,
    );
    expect(adopted.status).toBe("adopted");
    expect(adopted.adoptedKeys.hospital).toBe("location:konoha-hospital");
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM projects").get()).toEqual({
      n: 0,
    });
  });
});
