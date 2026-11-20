import { describe, expect, it } from "vitest";
import {
  WorldPackDocumentSchema,
  worldPackReferenceProblems,
} from "../src/world-pack.js";

const fixture = {
  summary: "一处宗门市场与商会的真实关系",
  nodes: [
    {
      localId: "market",
      existingCanonId: null,
      type: "location",
      name: "北原坊市",
      description: "三条商路与宗门药堂相连",
      areaRef: null,
      value: "丹药通道",
      access: "取得商会通行证",
      motive: "为各家提供交易场所",
      currentActivity: "正在大集",
      origin: "original",
      sourceNote: "N",
    },
    {
      localId: "guild",
      existingCanonId: null,
      type: "organization",
      name: "河谷商会",
      description: "有账房、护卫和药材收购队伍",
      areaRef: "market",
      value: "丹药寄售权",
      access: "商会掌柜引荐",
      motive: "争取宗门药堂买断权",
      currentActivity: "买入灵草",
      origin: "original",
      sourceNote: "N",
    },
  ],
  links: [
    {
      fromRef: "guild",
      toRef: "market",
      relation: "operates",
      description: "商会管理大集",
      status: "current",
    },
  ],
  activities: [
    {
      localId: "herb_purchase",
      actorRefs: ["guild"],
      resourceRefs: ["market"],
      description: "商会正在收购灵草",
      reason: "争取药堂供货合约",
      stage: "ongoing",
      worldTime: "宗门大比前一月",
    },
  ],
  openThreads: ["宗门药堂的实际掌权人"],
};

describe("WorldPack referential world-content schema", () => {
  it("accepts a graph of objects linked by local IDs and current activities", () => {
    const document = WorldPackDocumentSchema.parse(fixture);
    expect(worldPackReferenceProblems(document, new Set())).toEqual([]);
  });

  it("allows a living-world increment to change an existing actor without generating a fake replacement character", () => {
    const actorId = "known-master",
      assetId = "known-pill";
    const document = WorldPackDocumentSchema.parse({
      summary: "旧商会与掌柜仍然存在，只增加现在正在发生的交易行动",
      nodes: [],
      links: [],
      activities: [
        {
          localId: "trade_today",
          actorRefs: ["canon:" + actorId],
          resourceRefs: ["canon:" + assetId],
          description: "掌柜在市场为新买家核查丹药归属",
          reason: "商会原有产权发生变化",
          stage: "ongoing",
          worldTime: "大比当天",
        },
      ],
      openThreads: [],
    });
    expect(
      worldPackReferenceProblems(document, new Set([actorId, assetId])),
    ).toEqual([]);
    expect(worldPackReferenceProblems(document, new Set())).toContain(
      "unknown Canon ref: canon:known-master",
    );
    const empty = WorldPackDocumentSchema.parse({
      summary: "空包",
      nodes: [],
      links: [],
      activities: [],
      openThreads: [],
    });
    expect(
      worldPackReferenceProblems(empty, new Set()).some((x) =>
        x.includes("empty world production"),
      ),
    ).toBe(true);
  });

  it("rejects phantom links, duplicate local identities and invalid area types", () => {
    const document = WorldPackDocumentSchema.parse({
      ...fixture,
      nodes: [fixture.nodes[0], { ...fixture.nodes[1], areaRef: "guild" }],
      links: [
        {
          ...fixture.links[0],
          toRef: "phantom",
        },
      ],
    });
    expect(worldPackReferenceProblems(document, new Set())).toEqual(
      expect.arrayContaining([
        "non-location area: guild -> guild",
        "self-referential area: guild",
        "unresolved world ref: phantom",
      ]),
    );
    const duplicated = WorldPackDocumentSchema.parse({
      ...fixture,
      nodes: [fixture.nodes[0], { ...fixture.nodes[0] }],
    });
    expect(worldPackReferenceProblems(duplicated, new Set())).toEqual(
      expect.arrayContaining(["duplicate local node: market"]),
    );
  });

  it("validates existing Canon IDs, possible relations and finished activities", () => {
    const document = WorldPackDocumentSchema.parse({
      ...fixture,
      nodes: [
        fixture.nodes[0],
        { ...fixture.nodes[1], existingCanonId: "old-guild" },
      ],
      links: [
        {
          ...fixture.links[0],
          toRef: "canon:known-location",
          status: "possible",
        },
      ],
      activities: [{ ...fixture.activities[0], stage: "ended" }],
    });
    expect(
      worldPackReferenceProblems(
        document,
        new Set(["old-guild", "known-location"]),
      ),
    ).toEqual([]);
    expect(worldPackReferenceProblems(document, new Set())).toEqual(
      expect.arrayContaining([
        "unknown Canon ref: canon:known-location",
        "unknown existing Canon entity: old-guild",
      ]),
    );
  });

  it("rejects circular parent areas so W1 cannot create an impossible map", () => {
    const document = WorldPackDocumentSchema.parse({
      ...fixture,
      nodes: [
        { ...fixture.nodes[0], areaRef: "inner" },
        {
          ...fixture.nodes[0],
          localId: "inner",
          name: "内坊",
          areaRef: "market",
        },
      ],
      links: [],
      activities: [
        { ...fixture.activities[0], actorRefs: ["market"], resourceRefs: [] },
      ],
    });
    expect(worldPackReferenceProblems(document, new Set())).toEqual(
      expect.arrayContaining(["cyclic area ancestry: market"]),
    );
  });
});
