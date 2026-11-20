import { describe, expect, it } from "vitest";
import type { WorldPackRequest } from "@narralume/contracts";
import {
  WORLD_DESIGN_SYSTEMS,
  initialWorldWorkshopOrder,
  powerDesignProducts,
  resolveWorldDesignEntry,
  worldPowerMode,
} from "../src/world-design-policy.js";
import {
  emptyWorldDocument,
  playtestWorld,
} from "../src/world-production-engine.js";

const base: WorldPackRequest = {
  requestId: "00000000-0000-4000-8000-000000000003",
  scale: "W0",
  premise: "1878年巴黎及其出版、金融、社交世界",
  worldTime: "1878-05",
  focus: "巴黎",
  genre: "历史文豪",
  scarcity: "版权、资本、名望",
  instruction: "",
  parentAreaId: null,
};

describe("v0.1-v0.7 is ONE textual world-production framework", () => {
  it("applies all common world systems to historical, existing-IP, and original settings", () => {
    const history: WorldPackRequest = { ...base, premise: "1878巴黎" };
    const existingIp: WorldPackRequest = {
      ...base,
      premise: "火影忍者二战前木叶",
      genre: "火影同人",
    };
    const original: WorldPackRequest = {
      ...base,
      premise: "架空都会",
      genre: "原创都市",
    };
    for (const request of [history, existingIp, original]) {
      const stages = initialWorldWorkshopOrder(request);
      expect(stages).toEqual([
        "geography",
        "factions",
        "people",
        "economy",
        "power",
        "events",
        "social",
        "playability",
      ]);
    }
    expect(WORLD_DESIGN_SYSTEMS).toHaveLength(10);
  });

  it("branches only for the world's supernatural laws, not by source origin", () => {
    const history = { ...base, worldPower: "ordinary" as const };
    const magicHistory = { ...base, worldPower: "supernatural" as const };
    expect(worldPowerMode(history)).toBe("ordinary");
    expect(worldPowerMode(magicHistory)).toBe("supernatural");
    expect(initialWorldWorkshopOrder(history)).toEqual(
      initialWorldWorkshopOrder(magicHistory),
    );
    expect(powerDesignProducts(history).join("")).toContain("资本");
    expect(powerDesignProducts(magicHistory).join("")).toContain("超凡");
    expect(powerDesignProducts(history).join("")).toContain("不凭空写超凡");
  });

  it("uses an already available source as world evidence, never a different production mode", () => {
    const basedOnText: WorldPackRequest = {
      ...base,
      sourcePackageText: "1878巴黎历史事实、已知人物与组织",
    };
    expect(initialWorldWorkshopOrder(basedOnText)).toEqual(
      initialWorldWorkshopOrder(base),
    );
    expect(worldPowerMode(basedOnText)).toBe(worldPowerMode(base));
  });

  it("begins from the actual named organization, person, resource or rule, not an obligatory map", () => {
    const empty=emptyWorldDocument();
    const doc={
      ...empty,
      nodes:[
        {localId:"paris",existingCanonId:null,type:"location" as const,name:"巴黎"},
        {localId:"press",existingCanonId:null,type:"organization" as const,name:"费加罗报社"},
        {localId:"editor",existingCanonId:null,type:"character" as const,name:"编辑先生"},
        {localId:"rights",existingCanonId:null,type:"item" as const,name:"报纸出版权益"},
        {localId:"press_law",existingCanonId:null,type:"rule" as const,name:"出版许可制度"},
      ],
    } as unknown as typeof empty;
    expect(resolveWorldDesignEntry({...base,focus:"编辑先生"},doc))
      .toEqual({workshop:"people",subjectRef:"editor"});
    expect(resolveWorldDesignEntry({...base,focus:"费加罗报社"},doc))
      .toEqual({workshop:"factions",subjectRef:"press"});
    expect(resolveWorldDesignEntry({...base,focus:"报纸出版权益"},doc))
      .toEqual({workshop:"economy",subjectRef:"rights"});
    expect(resolveWorldDesignEntry({...base,focus:"出版许可制度"},doc))
      .toEqual({workshop:"power",subjectRef:"press_law"});
    expect(resolveWorldDesignEntry({...base,focus:"完全不存在的宗门"},doc))
      .toBeNull();
  });

  it("does not reject a world bible for lacking a two-action game rewards sequence", () => {
    const place = {
      localId: "paris",
      existingCanonId: null,
      type: "location" as const,
      name: "巴黎",
      description: "1878巴黎的城街与社会布局",
      areaRef: null,
      value: "出版金融中心",
      access: "有铁路和城市交通",
      motive: "城市生活",
      currentActivity: "报社印刷与金融交易",
      origin: "historical_claim" as const,
      sourceNote: "历史资料待逐条核实",
    };
    const guild = {
      ...place,
      localId: "publisher",
      type: "organization" as const,
      name: "出版商会",
      areaRef: "paris",
    };
    const actor = {
      ...place,
      localId: "editor",
      type: "character" as const,
      name: "编辑",
      areaRef: "paris",
    };
    const resource = {
      ...place,
      localId: "copyright",
      type: "item" as const,
      name: "版权",
      areaRef: "paris",
    };
    const power = {
      ...place,
      localId: "copyright_law",
      type: "rule" as const,
      name: "版权经营与契约制度",
      value: "允许作品交易并转化为长期经济权利",
    };
    const doc = {
      ...emptyWorldDocument(),
      nodes: [place, guild, actor, resource, power],
      links: [
        {
          fromRef: "publisher",
          toRef: "paris",
          relation: "operates",
          description: "出版商会在巴黎有自己的印刷和书店经营网络",
          status: "current" as const,
        },
        {
          fromRef: "editor",
          toRef: "publisher",
          relation: "employed_by",
          description: "编辑主持稿件采购并决定与作家谈判",
          status: "current" as const,
        },
        {
          fromRef: "publisher",
          toRef: "copyright",
          relation: "owns",
          description: "出版社拥有某批作品的出版许可",
          status: "current" as const,
        },
        {
          fromRef: "editor",
          toRef: "copyright_law",
          relation: "uses",
          description: "编辑根据法律商谈文本授权权利",
          status: "current" as const,
        },
      ],
      activities: [
        {
          localId: "printing",
          actorRefs: ["editor"],
          resourceRefs: ["copyright"],
          description: "编辑正在为已有新稿安排印刷和发行",
          reason: "商会谋求利润",
          stage: "ongoing" as const,
          worldTime: "1878-05",
        },
      ],
    };
    const report = playtestWorld(doc, base);
    expect(report.next).toBeNull();
    expect(report.interactionPaths).toEqual([]);
  });
});
