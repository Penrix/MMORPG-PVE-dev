import { describe, expect, it } from "vitest";

import {
  WORLD_ATLAS_CARD_TYPES,
  WORLD_ATLAS_CONTENT_FAMILIES,
  WORLD_ATLAS_NARRATIVE_AXIS,
  WorldAtlasCardKindSchema,
  inverseWorldAtlasRelation,
  worldAtlasCardTemplate,
  worldAtlasCardType,
  worldAtlasNarrativePriority,
} from "../src/world-atlas.js";

describe("World Atlas content framework", () => {
  it("keeps the v0.1-v0.7 world framework as content families rather than SQL-shaped entities", () => {
    expect(WORLD_ATLAS_CONTENT_FAMILIES.map((entry) => entry.id)).toEqual([
      "space",
      "people",
      "organization",
      "power",
      "asset",
      "economy",
      "activity",
      "information",
      "value",
      "playable",
    ]);
  });

  it("keeps content families parallel while people-centered stays a view/query priority", () => {
    expect(WORLD_ATLAS_CONTENT_FAMILIES).toHaveLength(10);
    expect(WORLD_ATLAS_NARRATIVE_AXIS.centerKind).toBe("character");
    expect(WORLD_ATLAS_NARRATIVE_AXIS.databaseRule).toContain(
      "not a new Database Schema",
    );
    expect(worldAtlasNarrativePriority("character")).toBeLessThan(
      worldAtlasNarrativePriority("organization"),
    );
    expect(worldAtlasNarrativePriority("organization")).toBeLessThan(
      worldAtlasNarrativePriority("ability"),
    );
  });

  it("accepts every registered card kind through the shared validation schema", () => {
    for (const definition of WORLD_ATLAS_CARD_TYPES) {
      expect(WorldAtlasCardKindSchema.parse(definition.kind)).toBe(
        definition.kind,
      );
    }
  });

  it("creates author-facing suggested Markdown instead of mandatory fields", () => {
    const character = worldAtlasCardType("character");
    expect(character.templateSections).toContain("人物关系");
    expect(worldAtlasCardTemplate("character", "旗木卡卡西")).toContain(
      "# 旗木卡卡西",
    );
    expect(worldAtlasCardTemplate("character", "旗木卡卡西")).toContain(
      "## 力量与资源",
    );
  });

  it("derives inverse labels from the shared relation vocabulary while leaving unknown relations open", () => {
    expect(inverseWorldAtlasRelation("老师")).toBe("学生");
    expect(inverseWorldAtlasRelation("学生")).toBe("老师");
    expect(inverseWorldAtlasRelation("所属组织")).toBe("成员");
    expect(inverseWorldAtlasRelation("成员")).toBe("所属");
    expect(inverseWorldAtlasRelation("参与")).toBe("参与者");
    expect(inverseWorldAtlasRelation("参与者")).toBe("参与");
    expect(inverseWorldAtlasRelation("敌对")).toBe("敌对");
    expect(inverseWorldAtlasRelation("作者自定义关系")).toBeNull();
  });
});
