import { describe, expect, it } from "vitest";

import {
  filterNewbooksByWindow,
  mergeNewbookPool,
  parseNewbooksJsonl,
  parseRankingMarkdown,
  stringifyNewbooksJsonl,
} from "../../../tools/newbook-radar/newbook-pool-core.mjs";

const QIDIAN_SAMPLE = `# 起点 · 签约作者新书榜

---

## #1 无人死寂
*滚开 · 仙侠·幻想修仙*
**字数：13.03万字**
[作品页](https://m.qidian.com/book/1051494950/)

**简介**

一个疯狂的世界。一个扭曲的天地。万物死寂即将到来，觉醒宿慧的主角踏上长生之路。

---

## #2 乱码坏书
*测试 · 玄幻*

**简介**

这是一段包含私用区乱码\uE123的错误简介内容，应当被过滤掉。
`;

const FANQIE_SAMPLE = `# 番茄 · 男频新书榜 · 全 2 题材

## 都市脑洞

### #1 我在废品站修神兵
*青衫客 · 都市脑洞 · 连载中 · 12.5万 在读 · 18.2万字*
[作品页](https://fanqienovel.com/page/7500001)

**简介**

林舟接手旧城废品站后发现经手的破铜烂铁都会显现原主执念，从此引来全城隐世武者求上门。

---
`;

const CIWEIMAO_SAMPLE = `# 刺猬猫 · 新书榜

### #1 木叶停尸房登记员
*一二子 · 同人衍生 · 15.6万点击*
[作品页](https://www.ciweimao.com/book/100999)

**简介**

穿越成木叶暗部停尸房的杂役登记员，每次登记阵亡忍者都能继承对方生前一项未完成执念。

---
`;

describe("newbook ranking pool core", () => {
  it("parses Qidian, Fanqie, and Ciweimao newbook markdown and filters PUA garble", () => {
    const entries = [
      ...parseRankingMarkdown(QIDIAN_SAMPLE, "起点签约作者新书榜_20261124.md"),
      ...parseRankingMarkdown(FANQIE_SAMPLE, "番茄男频新书榜_20261124.md"),
      ...parseRankingMarkdown(CIWEIMAO_SAMPLE, "刺猬猫新书榜_20261124.md"),
    ];
    const merged = mergeNewbookPool([], entries, "2026-11-24");

    expect(merged.stats.total).toBe(3);
    expect(merged.stats.added).toBe(3);
    expect(merged.stats.skippedInvalid).toBe(1);
    expect(merged.records.map((item) => item.platform).sort()).toEqual([
      "ciweimao",
      "fanqie",
      "qidian",
    ]);

    const qidian = merged.records.find((item) => item.platform === "qidian")!;
    expect(qidian.title).toBe("无人死寂");
    expect(qidian.author).toBe("滚开");
    expect(qidian.category).toBe("仙侠·幻想修仙");
    expect(qidian.firstSeenAt).toBe("2026-11-24");
    expect(qidian.lastSeenAt).toBe("2026-11-24");
    expect(qidian.seenCount).toBe(1);

    const fanqie = merged.records.find((item) => item.platform === "fanqie")!;
    expect(fanqie.category).toBe("都市脑洞");
  });

  it("preserves firstSeenAt across refreshes and slices cleanly by 7/14/30-day windows", () => {
    const day1 = mergeNewbookPool(
      [],
      parseRankingMarkdown(QIDIAN_SAMPLE, "起点签约作者新书榜_20261101.md"),
      "2026-11-01",
    );
    const day2 = mergeNewbookPool(
      day1.records,
      [
        ...parseRankingMarkdown(
          QIDIAN_SAMPLE.replace("签约作者新书榜", "三江推荐"),
          "起点三江推荐_20261121.md",
        ),
        ...parseRankingMarkdown(FANQIE_SAMPLE, "番茄男频新书榜_20261121.md"),
      ],
      "2026-11-21",
    );
    const oldBook = mergeNewbookPool(
      day2.records,
      parseRankingMarkdown(CIWEIMAO_SAMPLE, "刺猬猫新书榜_20260901.md"),
      "2026-09-01",
    );

    const roundTrip = parseNewbooksJsonl(
      stringifyNewbooksJsonl(oldBook.records),
    );
    const qidian = roundTrip.find((item) => item.platform === "qidian")!;
    expect(qidian.firstSeenAt).toBe("2026-11-01");
    expect(qidian.lastSeenAt).toBe("2026-11-21");
    expect(qidian.seenCount).toBe(2);
    expect(qidian.boardsSeen).toEqual(["签约作者新书榜", "三江推荐"]);

    const last7 = filterNewbooksByWindow(roundTrip, {
      windowDays: 7,
      referenceDate: "2026-11-24",
    });
    expect(last7.map((item) => item.title).sort()).toEqual([
      "我在废品站修神兵",
      "无人死寂",
    ]);

    const onlyNewlyDiscovered7 = filterNewbooksByWindow(roundTrip, {
      windowDays: 7,
      referenceDate: "2026-11-24",
      onlyNewlyDiscovered: true,
    });
    expect(onlyNewlyDiscovered7.map((item) => item.title)).toEqual([
      "我在废品站修神兵",
    ]);

    const last30 = filterNewbooksByWindow(roundTrip, {
      windowDays: 30,
      referenceDate: "2026-11-24",
    });
    expect(last30).toHaveLength(2);
    expect(last30.some((item) => item.title === "木叶停尸房登记员")).toBe(
      false,
    );
  });
});
