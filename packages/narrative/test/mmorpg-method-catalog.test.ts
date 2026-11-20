import { describe, expect, it } from "vitest";
import { WORLD_METHOD_CATALOG, selectWorldMethodExcerpts } from "../src/mmorpg-method-catalog.js";

describe("MMORPG v0.1-v0.7 original methodology entry selector", () => {
  it("retains distinct version attribution rather than treating v0.7 as the entire system", () => {
    expect(new Set(WORLD_METHOD_CATALOG.map((m) => m.version))).toEqual(
      new Set(["v0.1", "v0.2", "v0.3", "v0.4", "v0.5", "v0.6", "v0.7"]),
    );
    expect(WORLD_METHOD_CATALOG.every((m) =>
      m.verbatim.length > 500 && m.sourceFile.endsWith(".md"),
    )).toBe(true);
  });

  it("starts broad world production with v0.1 root, v0.2 open state machine and v0.5 content production", () => {
    const methods = selectWorldMethodExcerpts({
      premise: "1878年法国世界", focus: "", genre: "历史文娱",
      instruction: "生产社会地理与真实人物", scale: "W0", intent: "create",
    });
    expect(methods.map((m) => m.version)).toEqual(["v0.1", "v0.2", "v0.5"]);
    expect(methods[1]?.verbatim).toContain("五种进入方式");
  });

  it("selects v0.3 powers plus v0.6/v0.7 active-world methods for localized fantasy and GOAP", () => {
    const methods = selectWorldMethodExcerpts({
      premise: "玄幻世界宗门", focus: "山下坊市", genre: "修仙",
      instruction: "旧商会随着世界时间继续经营", scale: "W1", intent: "advance",
    });
    const versions = methods.map((m) => m.version);
    expect(versions).toContain("v0.3");
    expect(versions).toContain("v0.6");
    expect(versions.filter((v) => v === "v0.7")).toHaveLength(2);
    expect(methods.some((m) => m.id === "v07-npc-goap")).toBe(true);
  });

  it("only loads v0.4 player Build when the author actually asks for the protagonist", () => {
    const base = {
      premise: "火影忍者世界", focus: "木叶村", genre: "同人",
      scale: "W1" as const, intent: "create" as const,
    };
    expect(selectWorldMethodExcerpts({
      ...base, instruction: "恢复忍村现有组织和人物生态",
    }).some((m) => m.id === "v04-player-build")).toBe(false);
    expect(selectWorldMethodExcerpts({
      ...base, instruction: "男主初始能力和金手指怎么进入原世界",
    }).some((m) => m.id === "v04-player-build")).toBe(true);
  });
});
