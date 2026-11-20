import { describe, expect, it } from "vitest";

import {
  buildWorldBuilderInstruction,
  WORLD_STAGES,
  worldBuilderValidation,
  worldStage,
  type WorldBuilderInput,
} from "../src/lib/world-builder";

const base: WorldBuilderInput = {
  scale: "W0",
  stage: "world",
  premise: "1392年大明：朝廷、地方、军队、民间产业和真实的人",
  worldTime: "洪武二十五年",
  focus: "",
  genre: "",
  scarcity: "",
  instruction: "",
};

describe("MMORPG World Builder", () => {
  it("has five independent content rounds plus fact and relation follow-ups", () => {
    expect(WORLD_STAGES.map((stage) => stage.id)).toEqual([
      "world", "factions", "people", "resources", "activities", "claims", "relations",
    ]);
    expect(worldStage("activities").spread).toBe("timeline");
    expect(worldStage("claims").spread).toBe("facts");
    expect(worldStage("relations").spread).toBe("relations");
  });

  it("builds W0 content production rather than a prewritten protagonist outline", () => {
    const result = buildWorldBuilderInstruction(base);
    expect(result).toContain("【WORLD_BUILDER/W0/world】");
    expect(result).toContain("男主进入之前");
    expect(result).toContain("1392年大明");
    expect(result).toContain("不同社会系统");
    expect(result).toContain("Canon");
    expect(result).not.toContain("W1 现有世界局部深化");
  });

  it("requires a grounded geographic focus and Reader genre for W1", () => {
    const incomplete: WorldBuilderInput = { ...base, scale: "W1" };
    expect(worldBuilderValidation(incomplete)).toMatch(/具体区域/);
    const withFocus = { ...incomplete, focus: "南京朝廷" };
    expect(worldBuilderValidation(withFocus)).toMatch(/题材/);
    const complete = {
      ...withFocus,
      genre: "男频历史 / 帝国权力",
      scarcity: "朝廷的正式任命权",
      stage: "people" as const,
    };
    expect(worldBuilderValidation(complete)).toBeNull();
    const instruction = buildWorldBuilderInstruction(complete);
    expect(instruction).toContain("【WORLD_BUILDER/W1/people】");
    expect(instruction).toContain("南京朝廷");
    expect(instruction).toContain("朝廷的正式任命权");
    expect(instruction).toContain("真实的人");
  });

  it("never requires invented scarce targets and preserves accepted reality", () => {
    const instruction = buildWorldBuilderInstruction({
      ...base,
      scale: "W1",
      focus: "宗门山下坊市",
      genre: "玄幻 / 得意、成长",
      scarcity: "",
      stage: "relations",
      instruction: "继续沿用已有商会和师徒人物",
    });
    expect(instruction).toContain("目标未锁定");
    expect(instruction).toContain("已提交正文");
    expect(instruction).toContain("稳定ID");
    expect(instruction).toContain("已存在的实体ID");
    expect(instruction).toContain("继续沿用已有商会和师徒人物");
  });

  it("does not allow generation without any world premise", () => {
    expect(worldBuilderValidation({ ...base, premise: " " })).toBeTruthy();
    expect(() => buildWorldBuilderInstruction({ ...base, premise: " " })).toThrow();
  });
});
