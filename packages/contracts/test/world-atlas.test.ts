import { describe, expect, it } from "vitest";

import {
  WORLD_ATLAS_CARD_TYPES,
  WORLD_ATLAS_CONTENT_FAMILIES,
  WORLD_ATLAS_NARRATIVE_AXIS,
  WORLD_ATLAS_SEMANTIC_LAYERS,
  WorldAtlasCardKindSchema,
  WorldAtlasReaderSemanticsSchema,
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
      "不是新的 Database Schema",
    );
    expect(worldAtlasNarrativePriority("character")).toBeLessThan(
      worldAtlasNarrativePriority("organization"),
    );
    expect(worldAtlasNarrativePriority("organization")).toBeLessThan(
      worldAtlasNarrativePriority("ability"),
    );
  });

  it("keeps original truth, Reader prior and project current as separate semantic authorities", () => {
    expect(WORLD_ATLAS_SEMANTIC_LAYERS.originalMother.authority).toBe(
      "reference",
    );
    expect(WORLD_ATLAS_SEMANTIC_LAYERS.cognitiveMother.authority).toBe(
      "reader-semantic",
    );
    expect(WORLD_ATLAS_SEMANTIC_LAYERS.projectReality.authority).toBe(
      "current",
    );
    expect(
      WorldAtlasReaderSemanticsSchema.parse({
        readerPrice: "写轮眼在火影读者认知里天然高价",
        preloadedExpectations: ["血继限界", "宇智波"],
        familiarRelations: ["宇智波与木叶政治关系"],
        naturalEntrances: ["忍族", "忍者学校", "任务体系"],
        attentionTriggers: ["非宇智波者使用写轮眼"],
        basis: "author_judgment",
        sourceNote: "Reader-side judgement, not Source Canon",
      }).basis,
    ).toBe("author_judgment");
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
