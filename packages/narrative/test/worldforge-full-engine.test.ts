import { describe, expect, it } from "vitest";

import { createSession, defaultConfig, makeEntity, runTicks } from "../src/vendor/worldforge/full/engine.js";
import { EARTH_LAWS } from "../src/vendor/worldforge/full/physics.js";
import { runAllAgents } from "../src/vendor/worldforge/full/agent.js";
import { createMockLLM } from "../src/vendor/worldforge/full/llm.js";
import { arbitrate } from "../src/vendor/worldforge/full/arbiter.js";
import { buildEntityKnowledge } from "../src/vendor/worldforge/full/context.js";

/**
 * Exercising ORIGINAL WorldForge source, not a new home-made substitute.
 * Simulation remains a sandbox. No proposed event is written to NarraLume Canon.
 */
describe("upstream WorldForge complete simulation source", () => {
  const neutralWorldLaws = {
    ...EARTH_LAWS,
    id: "author-world",
    name: "作者世界",
    rules: [], // A simulation must not invent hard limits or ability costs.
    narrative: [],
    ontology: [],
  };

  function testSession() {
    const first = makeEntity(
      "merchant-guild", "星河商会", "plains-mid", "人类", "商会",
      { population: 1000, economy: 70, military: 100 },
      { 冶金: 25, 航海: 10 }, {},
    );
    const second = makeEntity(
      "sect", "青冥宗", "mountains-north", "人类", "宗门",
      { population: 850, economy: 60, military: 150 },
      { 冶金: 15, 农业: 45 }, {},
    );
    first.geography.neighbors = ["sect"];
    second.geography.neighbors = ["merchant-guild"];
    return createSession({
      worldId: "author-world",
      laws: neutralWorldLaws,
      config: { ...defaultConfig(42), autoJump: false, yearsPerTick: 1 },
      entities: [first, second],
    });
  }

  it("initializes a real simulation with original physics, topology, registry and lore", () => {
    const session = testSession();
    expect(Object.keys(session.entities)).toHaveLength(2);
    expect(session.regions["plains-mid"]).toBeDefined();
    expect(session.registry.dims).toBeDefined();
    expect(session.lore.facts.length).toBeGreaterThan(0);
    expect(buildEntityKnowledge(session, session.entities["merchant-guild"]!)).toBeDefined();
    expect(session.laws.rules).toEqual([]);
  });

  it("advances WorldForge's original engine with real tick/physics/history logic", async () => {
    const session = testSession();
    const result = await runTicks(session, 2);
    expect(result.ticks_run).toBe(2);
    expect(result.session.current_tick).toBe(2);
    expect(result.population_trace).toHaveLength(2);
    expect(result.session.entities["merchant-guild"]?.last_tick).toBe(2);
    expect(result.session.events.every((e) => e.tick <= 2)).toBe(true);
  });

  it("runs independent upstream agents and arbiter against the same world snapshot", async () => {
    const session = testSession();
    const llm = createMockLLM(() =>
      JSON.stringify({
        decisions: ["商会掌柜决定向宗门长老送出新炼器术的合作邀请"],
        events: [
          {
            type: "trade",
            description: "星河商会开始与青冥宗商谈灵材长期供应，交易尚未成交",
            major: false,
          },
        ],
        metric_delta: {},
        tech_delta: {},
        values_delta: {},
      }),
    );
    const independent = await runAllAgents(session, { llm, maxTokens: 1000 });
    expect(independent.events.length).toBeGreaterThan(0);
    expect(independent.events.every((event) => event.source === "agent")).toBe(true);
    const ruling = await arbitrate({
      laws: session.laws,
      config: session.config,
      entities: session.entities,
      lore: session.lore,
      currentTick: session.current_tick,
    }, independent.events);
    expect(ruling.accepted.length + ruling.rejected.length).toBeGreaterThan(0);
    // The arbiter returns candidates; this test does NOT adopt them as novel reality.
    expect(session.events).toHaveLength(0);
  });
});
