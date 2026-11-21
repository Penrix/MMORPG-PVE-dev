import { describe, expect, it } from "vitest";

import {
  WORLD_ATLAS_CARD_TYPES,
  WORLD_ATLAS_CONTENT_FAMILIES,
  WorldAtlasCardKindSchema,
  inverseWorldAtlasRelation,
  worldAtlasCardTemplate,
  worldAtlasCardType,
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
    expect(inverseWorldAtlasRelation("参与")).toBe("参与者");
    expect(inverseWorldAtlasRelation("敌对")).toBe("敌对");
    expect(inverseWorldAtlasRelation("作者自定义关系")).toBeNull();
  });
});
