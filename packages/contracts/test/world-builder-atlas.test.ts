import { describe, expect, it } from "vitest";
import { WORLD_ATLAS_CONTENT_FAMILIES } from "../src/world-atlas.js";
import {
  WorldPackDocumentSchema,
  worldPackAtlasKind,
  worldPackCoarseTypeForAtlasKind,
  worldPackReferenceProblems,
} from "../src/world-pack.js";
import {
  WORLD_BUILDER_ATLAS_CONTRACT,
  WORLD_BUILDER_ATLAS_CROSSWALK,
  WORLD_BUILDER_STAGES,
  worldBuilderAtlasTarget,
} from "../src/world-builder-atlas.js";

describe("World Builder → World Atlas production contract", () => {
  it("covers all ten World Families without turning them into ten generators", () => {
    const families = new Set(
      WORLD_BUILDER_ATLAS_CROSSWALK.flatMap((entry) => entry.families),
    );
    expect(families).toEqual(
      new Set(WORLD_ATLAS_CONTENT_FAMILIES.map((entry) => entry.id)),
    );
    expect(WORLD_BUILDER_ATLAS_CROSSWALK).toHaveLength(9);
    expect(WORLD_BUILDER_ATLAS_CONTRACT.contentAxis).toContain(
      "not ten mandatory generators",
    );
  });

  it("makes people interfaces explicit across non-person workshops", () => {
    for (const workshop of [
      "geography",
      "factions",
      "economy",
      "power",
      "events",
      "social",
      "playability",
      "living",
    ] as const) {
      const target = worldBuilderAtlasTarget(workshop);
      expect(target.peopleQuestions.length).toBeGreaterThan(0);
      expect(target.completionRule.length).toBeGreaterThan(10);
    }
  });

  it("keeps the production state machine open rather than a fixed pipeline", () => {
    const audit = WORLD_BUILDER_STAGES.find((stage) => stage.id === "audit")!;
    expect(audit.next).toEqual(
      expect.arrayContaining([
        "root",
        "skeleton",
        "zone",
        "humanize",
        "connect",
        "activate",
        "price",
      ]),
    );
    const zone = WORLD_BUILDER_STAGES.find((stage) => stage.id === "zone")!;
    expect(zone.next).toContain("audit");
    expect(zone.next).toContain("humanize");
  });
  it("preserves rich Atlas kinds over the legacy six coarse staging types", () => {
    expect(worldPackCoarseTypeForAtlasKind("resource")).toBe("item");
    expect(worldPackCoarseTypeForAtlasKind("information")).toBe("concept");
    expect(worldPackCoarseTypeForAtlasKind("position")).toBe("concept");
    expect(worldPackAtlasKind({ type: "item", atlasKind: "resource" })).toBe(
      "resource",
    );
    expect(worldPackAtlasKind({ type: "concept" })).toBe("other");

    const oldNode = {
      localId: "old_concept",
      existingCanonId: null,
      type: "concept",
      name: "旧资料",
      description: "旧 WorldPack 仍然可以读取",
      areaRef: null,
      value: "",
      access: "",
      motive: "",
      currentActivity: "",
      origin: "original",
      sourceNote: "",
    };
    expect(
      WorldPackDocumentSchema.safeParse({
        summary: "旧包兼容",
        nodes: [oldNode],
        links: [],
        activities: [],
        interactions: [],
        openThreads: [],
        dimensionSignals: [],
      }).success,
    ).toBe(true);

    const mismatch = WorldPackDocumentSchema.parse({
      summary: "错误映射",
      nodes: [
        {
          ...oldNode,
          localId: "ore",
          type: "concept",
          atlasKind: "resource",
          name: "紫金矿",
        },
      ],
      links: [],
      activities: [],
      interactions: [],
      openThreads: [],
      dimensionSignals: [],
    });
    expect(worldPackReferenceProblems(mismatch, new Set())).toContain(
      "atlas kind/type mismatch: ore resource requires item, got concept",
    );
  });

});
