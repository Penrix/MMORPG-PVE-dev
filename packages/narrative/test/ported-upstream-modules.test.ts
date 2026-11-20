import { describe, expect, it } from "vitest";

import { parseWorldOutput, parseWorldSection } from "../src/vendor/covel/lore-processor.js";
import { createRevisionCache } from "../src/vendor/covel/revision-cache.js";
import { orderSources } from "../src/vendor/covel/source-order.js";
import { backfillCausals, causalCandidates } from "../src/vendor/worldforge/causality.js";
import { emptyRegistry, tryRegisterDimension } from "../src/vendor/worldforge/registry.js";
import type { SimulationEvent } from "../src/vendor/worldforge/types.js";

describe("ported Covel world authoring modules (actual upstream implementations)", () => {
  it("parses Covel's three-section world package without losing author lore", () => {
    const text = [
      "===WORLD_YAML===",
      "id: jade-realm",
      "name: 玉岚世界",
      "===WORLD_MD===",
      "本世界里宗门、坊市和商会各有具体的权利及生活。",
      "===WORLD_PACKAGE_YAML===",
      "characters:",
      "  - id: chief",
      "    name: 商会掌柜",
      "===END===",
    ].join("\n");
    const parsed = parseWorldOutput(text);
    expect(parsed?.yaml).toContain("jade-realm");
    expect(parsed?.lore).toContain("商会");
    expect(parsed?.packageYaml).toContain("chief");
    expect(parseWorldSection(text, "WORLD_MD")).toContain("权利");
    expect(parseWorldOutput("只有一个随意摘要，没有世界文件分段")).toBeNull();
  });

  it("topologically orders source packages and rejects unknown or cyclic dependencies", () => {
    const valid = orderSources([
      { id: "author", order: 3, descriptor: { after: "canon" } },
      { id: "v07", order: 0, descriptor: {} },
      { id: "canon", order: 2, descriptor: { after: "covel" } },
      { id: "covel", order: 1, descriptor: { after: "v07" } },
    ]);
    expect(valid.diagnostics).toEqual([]);
    expect(valid.sources.map((s) => s.id)).toEqual(["v07", "covel", "canon", "author"]);
    expect(orderSources([
      { id: "a", order: 0, descriptor: { after: "b" } },
      { id: "b", order: 1, descriptor: { after: "a" } },
    ]).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "error" }),
    ]));
  });

  it("reuses a revision-specific cache without sharing mutable copies", async () => {
    const cache = createRevisionCache<{ content: string[] }>(2);
    let calls = 0;
    const loader = async () => ({ content: [String(++calls)] });
    const first = await cache("novel", "v1", loader);
    first.content.push("tampered");
    const second = await cache("novel", "v1", loader);
    expect(calls).toBe(1);
    expect(second.content).toEqual(["1"]);
    const third = await cache("novel", "v2", loader);
    expect(calls).toBe(2);
    expect(third.content).toEqual(["2"]);
  });
});

describe("ported WorldForge causality and emerging dimension registry", () => {
  const ev = (id: string, tick: number, participants: string[], major = false): SimulationEvent => ({
    id, tick, time_label: String(tick), type: "economic-event",
    participants, region: "market",
    description: `商会 ${id} 已发生的经营变化`,
    major, changes: [],
  });

  it("only suggests older related events, preserving user-confirmed cause links", () => {
    const old = ev("deal", 1, ["merchant", "herbalist"], true);
    const other = ev("unrelated", 2, ["soldier"]);
    const current = ev("negotiation", 3, ["merchant"]);
    const session = { events: [old, other] };
    expect(causalCandidates(session, current, 2).map((x) => x.id)).toEqual(["deal", "unrelated"]);
    backfillCausals(session, [current]);
    expect(current.causals).toEqual(["deal", "unrelated"]);
    const fixed = { ...current, id: "fixed", causals: ["author-verified-cause"] };
    backfillCausals(session, [fixed]);
    expect(fixed.causals).toEqual(["author-verified-cause"]);
  });

  it("registers dimensions only with enough observed consequences and does not invent power costs", () => {
    const registry = emptyRegistry();
    const weak = tryRegisterDimension(registry, {
      dim: "炼器工艺", kind: "tech", frequency: 0.1, consequence: 0.1,
      lawConsistency: 0.8, potential: 100,
    }, 1);
    expect(weak.registered).toBe(false);
    const strong = tryRegisterDimension(registry, {
      dim: "炼器工艺", kind: "tech", frequency: 0.9, consequence: 0.9,
      lawConsistency: 1, potential: 100,
    }, 2);
    expect(strong.registered).toBe(true);
    expect(registry.dims["炼器工艺"]?.potential).toBe(100);
  });
});
