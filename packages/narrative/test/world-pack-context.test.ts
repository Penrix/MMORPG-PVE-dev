import { createCanonEntity, createCanonFact } from "@narralume/domain";
import type { RelationshipEvent } from "@narralume/domain";
import { describe, expect, it } from "vitest";
import { selectWorldContextIds } from "../src/world-pack-context.js";

const now = "2026-11-20T00:00:00.000Z";
const projectId = "story";

function entity(id: string, type: "character" | "location" | "organization", name: string) {
  return createCanonEntity({
    id, projectId, type, name, now,
    description: `${name}正在推进自己的生活和事务，已经有真实权力、地盘或长期目标。`,
  });
}

describe("WorldForge-style W1 context selection", () => {
  it("retrieves an area, its contained people and second-hop resources before unrelated world objects", () => {
    const entities = [
      entity("london", "location", "伦敦"),
      entity("paris", "location", "巴黎"),
      entity("publisher", "organization", "费加罗出版社"),
      entity("writer", "character", "小说家"),
      entity("banker", "character", "银行家"),
    ];
    const facts = [
      createCanonFact({
        id: "inside", projectId, subjectId: "publisher",
        predicate: "world.area", objectEntityId: "paris",
        sourceType: "world-pack", now,
      }),
    ];
    const relationships: RelationshipEvent[] = [{
      id: "negotiation", projectId,
      fromEntityId: "publisher", toEntityId: "writer", relation: "contracts",
      intensity: null, state: { lifecycle: "active" },
      outlineNodeId: null, storyTime: "1878",
      sourceId: null, supersedesEventId: null, createdAt: now,
    }];
    const ids = selectWorldContextIds({
      entities, facts, relationships,
      parentAreaId: "paris", focus: "巴黎出版圈层",
      premise: "1878法国不同的社会阶层", maxCount: 3,
    });
    expect(ids[0]).toBe("paris");
    expect(new Set(ids)).toEqual(new Set(["paris", "publisher", "writer"]));
    expect(ids).not.toContain("london");
  });
  it("ignores voided relationship links and bounds context size", () => {
    const entities = [
      entity("market", "location", "万宝坊市"),
      entity("guild", "organization", "天风商会"),
      entity("elsewhere", "character", "不相关路人"),
    ];
    const relationships: RelationshipEvent[] = [{
      id: "old", projectId,
      fromEntityId: "market", toEntityId: "guild", relation: "owns",
      intensity: null, state: { lifecycle: "voided" },
      outlineNodeId: null, storyTime: null,
      sourceId: null, supersedesEventId: null, createdAt: now,
    }];
    const ids = selectWorldContextIds({
      entities, relationships, facts: [],
      parentAreaId: "market", focus: "万宝坊市",
      premise: "修仙世界", maxCount: 1,
    });
    expect(ids).toEqual(["market"]);
  });
});
