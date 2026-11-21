import { describe, expect, it } from "vitest";
import {
  WORLD_ATLAS_CONTENT_FAMILIES,
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
});
