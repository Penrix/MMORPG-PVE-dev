import { describe, expect, it } from "vitest";
import { previewWorldForgeFactions } from "../src/worldforge-faction-bridge.js";
import { createMockLLM } from "../src/vendor/worldforge/full/llm.js";

const seed = {
  worldTitle: "玉澜坊市世界",
  worldTime: "宗门大比前七日",
  organizations: [
    {
      id: "guild",
      name: "玉澜商会",
      description: "掌握法器拍卖权，正在与宗门药堂争夺灵材",
    },
    {
      id: "sect",
      name: "青冥宗",
      description: "宗门药堂掌握丹方授权，需要商会运输灵材",
    },
  ],
  locations: [{ id: "market", name: "玉澜坊市" }],
  relationships: [
    { fromEntityId: "guild", toEntityId: "sect", relation: "competes-with" },
  ],
  history: [
    {
      id: "last-sale",
      title: "交易",
      description: "商会取得稀有丹药寄售权",
      participants: ["guild"],
    },
  ],
};

describe("WorldForge real agent and arbiter integrated as candidate-only NarraLume sandbox", () => {
  it("does not change an accepted WorldPack nor adopt invented powers or costs", async () => {
    const provider = createMockLLM((prompt) => {
      expect(prompt).toContain("玉澜商会");
      return JSON.stringify({
        decisions: ["掌柜准备接触宗门药堂"],
        events: [
          {
            type: "commercial",
            description: "玉澜商会派出掌柜与宗门药堂商讨丹药授权；双方尚未成交",
          },
        ],
      });
    });
    const result = await previewWorldForgeFactions(seed, provider);
    expect(result.engine).toBe("worldforge");
    expect(result.organizations).toEqual(["guild", "sect"]);
    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.proposals.every((item) => item.status === "proposed")).toBe(
      true,
    );
    expect(seed.organizations[0]!.description).toContain("争夺灵材");
    expect(
      result.proposals.some((item) => item.description.includes("掌柜")),
    ).toBe(true);
  });

  it("does not invent a region or calls when no organizations exist", async () => {
    const provider = createMockLLM(() => {
      throw new Error("must not call model with no eligible factions");
    });
    const result = await previewWorldForgeFactions(
      {
        ...seed,
        organizations: [],
      },
      provider,
    );
    expect(result.proposals).toEqual([]);
    expect(result.rejected).toEqual([]);
  });
});
