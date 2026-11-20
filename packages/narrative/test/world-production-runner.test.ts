import { describe, expect, it } from "vitest";
import type { NarrativeRun, NarrativeRunStep } from "@narralume/domain";
import type { NarrativeModelClient } from "../src/model-client.js";
import {
  runWorldWorkshops,
  type WorldWorkshopCheckpoint,
} from "../src/world-production-runner.js";
import { WORLD_PACK_MODEL_CONTRACT } from "../src/world-pack-workers.js";
import type { WorldPackRequest, WorldPackDocument } from "@narralume/contracts";

const request: WorldPackRequest = {
  requestId: "00000000-0000-4000-8000-000000000000",
  scale: "W0",
  premise: "原创玄幻宗门",
  genre: "玄幻",
  focus: "",
  worldTime: "开书前",
  scarcity: "",
  instruction: "",
  parentAreaId: null,
};
const usage = {
  inputTokens: 20,
  outputTokens: 30,
  calls: 1,
  costUsd: 0,
  wallTimeMs: 1,
};
const place: WorldPackDocument = {
  summary: "山下山门有真正可往来的生活区域",
  nodes: [
    {
      localId: "mount",
      existingCanonId: null,
      type: "location",
      name: "青云山门",
      description: "山门外有商路、仓库、住店、药材市集及普通人工作场所",
      areaRef: null,
      value: "宗门与凡俗世界的交通要道",
      access: "从山下官道步行抵达",
      motive: "供货物与人口往来",
      currentActivity: "正在开市",
      origin: "original",
      sourceNote: "原创",
    },
  ],
  links: [],
  activities: [],
  openThreads: [],
  interactions: [],
  dimensionSignals: [],
};
const run = {
  id: "run-world",
  projectId: "novel",
  policy: {},
} as unknown as NarrativeRun;
const step = {
  id: "world-generate",
  kind: "world.generate",
} as unknown as NarrativeRunStep;

/** Bad LLMs often return the same cards repeatedly. This test proves the
 * engine refuses to count those responses as distinct MMORPG world systems. */
describe("program-owned world production, not LLM self-reported completion", () => {
  it("forces distinct real-world workshop outputs and resumes without repeating completed ones", async () => {
    let calls: string[] = [];
    const checkpoints: WorldWorkshopCheckpoint[] = [];
    const model = {
      async structured<T>(
        _run: NarrativeRun,
        _step: NarrativeRunStep,
        _purpose: string,
        prompt: { messages: Array<{ content: string }> },
        _schema: unknown,
        validate: (
          value: unknown,
        ) => { success: true; data: T } | { success: false; issues: string[] },
      ) {
        const input = JSON.parse(prompt.messages[0]!.content) as {
          operation: string;
        };
        calls.push(input.operation);
        const parsed = validate(place);
        if (!parsed.success) throw new Error(parsed.issues.join("; "));
        return {
          value: parsed.data,
          usage,
          mode: "native" as const,
          attempts: 1,
        };
      },
    } as unknown as NarrativeModelClient;
    const args = {
      run,
      step,
      model,
      request,
      basePrompt: "世界原创研究",
      knownCanonIds: new Set<string>(),
      contract: WORLD_PACK_MODEL_CONTRACT,
      signal: new AbortController().signal,
      onCheckpoint: (saved: WorldWorkshopCheckpoint) => {
        checkpoints.push(saved);
      },
    };
    await expect(runWorldWorkshops(args)).rejects.toThrow(
      "world.workshop.no_product",
    );
    expect(calls).toEqual(["geography", "factions"]);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]?.steps).toHaveLength(1);
    expect(checkpoints[0]?.steps[0]?.workshop).toBe("geography");
    calls = [];
    await expect(
      runWorldWorkshops({ ...args, initialCheckpoint: checkpoints[0] }),
    ).rejects.toThrow("world.workshop.no_product");
    expect(calls).toEqual(["factions"]);
  });
  it("starts W1 from a known historical power instead of recreating geography", async () => {
    const focus: WorldPackRequest = {
      ...request,
      scale: "W1",
      worldPower: "ordinary",
      premise: "1878巴黎报业与版权社会",
      genre: "历史",
      focus: "版权经营制度",
    };
    const existingWorld: WorldPackDocument = {
      ...place,
      nodes: [
        {
          ...place.nodes[0]!,
          localId: "canon:licensing-rights",
          existingCanonId: "licensing-rights",
          type: "rule",
          name: "版权经营制度",
          description: "报业许可与出版契约赋予具体法人经营权利",
          origin: "source_canon",
        },
      ],
    };
    const seen:string[]=[];
    const model = {
      async structured<T>(
        _run:NarrativeRun,
        _step:NarrativeRunStep,
        _purpose:string,
        prompt:{messages:Array<{content:string}>},
        _contract:unknown,
        validate:(value:unknown)=>{success:true;data:T}|{success:false;issues:string[]},
      ){
        const input=JSON.parse(prompt.messages[0]!.content) as {operation:string};
        seen.push(input.operation);
        const parsed=validate(place);
        if(!parsed.success)throw new Error(parsed.issues.join("; "));
        return {value:parsed.data,usage,mode:"native" as const,attempts:1};
      },
    } as unknown as NarrativeModelClient;
    await expect(runWorldWorkshops({
      run,step,model,request:focus,basePrompt:"真实世界制作",
      existingWorld,knownCanonIds:new Set(["licensing-rights"]),
      contract:WORLD_PACK_MODEL_CONTRACT,
      signal:new AbortController().signal,
    })).rejects.toThrow("world.workshop.no_product");
    expect(seen).toEqual(["power"]);
  });

});
