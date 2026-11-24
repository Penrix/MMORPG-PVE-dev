import { NodeNarrativeDatabase } from "@narralume/persistence/node";
import { SqliteStoryRepository } from "@narralume/persistence";
import { describe, expect, it } from "vitest";
import {
  analyzeMarketTrendsWithTr01,
  incubateBenchmarkProposals,
  listMarketM03Materials,
  listMarketRadarBooks,
  parseNewbookJsonl,
  registerMarketRadarRoutes,
  type NewbookPoolSnapshot,
  type RouteApp,
  type RouteHandler,
} from "../src/index.js";

const SAMPLE_JSONL = [
  JSON.stringify({
    id: "qidian:1001",
    platform: "qidian",
    board: "签约作者新书榜",
    boardsSeen: ["签约作者新书榜", "三江推荐"],
    category: "历史",
    title: "大唐：开局为李世民献上避坑指南",
    author: "测试作者A",
    intro: "穿越武德九年，直接向秦王摊牌穿越者身份，剧透玄武门与未来大唐走向。",
    url: "https://www.qidian.com/book/1001",
    latestRank: 2,
    firstSeenAt: "2026-11-22",
    lastSeenAt: "2026-11-24",
    seenCount: 2,
  }),
  JSON.stringify({
    id: "fanqie:2002",
    platform: "fanqie",
    board: "男频新书榜",
    boardsSeen: ["男频新书榜"],
    category: "都市脑洞",
    title: "败家亏钱系统，结果全网以为我是商业教父",
    author: "测试作者B",
    intro: "越亏钱返现越多，偏偏每次反向操作都被业内当成神级布局。",
    url: "https://fanqienovel.com/page/2002",
    latestRank: 5,
    firstSeenAt: "2026-11-20",
    lastSeenAt: "2026-11-24",
    seenCount: 1,
  }),
  JSON.stringify({
    id: "ciweimao:3003",
    platform: "ciweimao",
    board: "新书榜",
    boardsSeen: ["新书榜"],
    category: "科幻无限",
    title: "旧风口测试书",
    author: "测试作者C",
    intro: "半年前上过一次榜的老样本。",
    url: "https://www.ciweimao.com/book/3003",
    latestRank: 25,
    firstSeenAt: "2026-08-01",
    lastSeenAt: "2026-08-10",
    seenCount: 1,
  }),
].join("\n");

function samplePool(): NewbookPoolSnapshot {
  return parseNewbookJsonl(
    SAMPLE_JSONL,
    JSON.stringify({
      updatedAt: "2026-11-24T05:00:00Z",
      snapshotDate: "2026-11-24",
    }),
  );
}

describe("market radar TR-01 & benchmark incubator", () => {
  it("slices newbooks by time window and ranks fresh multi-board books highest", () => {
    const database = new NodeNarrativeDatabase(":memory:");
    database.migrate();
    try {
      const recent = listMarketRadarBooks(
        database,
        samplePool(),
        { windowDays: 14, platform: "all" },
        new Date("2026-11-24T08:00:00Z"),
      );
      expect(recent.status.totalBooks).toBe(3);
      expect(recent.status.filteredBooks).toBe(2);
      expect(recent.books.map((book) => book.id)).toEqual([
        "qidian:1001",
        "fanqie:2002",
      ]);
      expect(recent.books[0]!.trendWeight).toBeGreaterThan(
        recent.books[1]!.trendWeight,
      );
      expect(recent.books[0]!.trendLabel).toBe("hot");

      const allTime = listMarketRadarBooks(
        database,
        samplePool(),
        { windowDays: 0, platform: "ciweimao" },
        new Date("2026-11-24T08:00:00Z"),
      );
      expect(allTime.books).toHaveLength(1);
      expect(allTime.books[0]!.id).toBe("ciweimao:3003");
    } finally {
      database.close();
    }
  });

  it("runs TR-01 analysis, saves high-weight M03 trends, incubates benchmark proposals, and seeds M03 on project creation", async () => {
    const database = new NodeNarrativeDatabase(":memory:");
    database.migrate();
    try {
      const pool = samplePool();
      const tr01 = await analyzeMarketTrendsWithTr01(
        database,
        pool,
        { windowDays: 14, platform: "all", sampleLimit: 10, autoSaveM03: true },
        {
          now: () => new Date("2026-11-24T09:00:00Z"),
          generateOverride: () => ({
            macroTrends: [
              {
                name: "历史高位自爆剧透流",
                readerDemandGap: "想看古代顶级权力者被现代信息差震撼与破防",
                whyHotNow: "切入快、省去漫长底层发育，前3章直接进入高位互动",
                weight: "high",
                evidenceTitles: ["大唐：开局为李世民献上避坑指南"],
              },
            ],
            mesoPatterns: {
              goldenFingerFormulas: [
                {
                  formula: "亏钱反向返现系统",
                  mechanism:
                    "主角想故意亏钱却被迫做出神级投资，制造持续迪化反差",
                  evidenceTitles: ["败家亏钱系统，结果全网以为我是商业教父"],
                },
              ],
              protagonistFormulas: [
                {
                  formula: "高位直球摊牌乐子人",
                  mechanism: "面对致命危机不装孙子，直接抛重磅未来情报反客为主",
                  evidenceTitles: ["大唐：开局为李世民献上避坑指南"],
                },
              ],
              openingHooks: [
                {
                  formula: "开局面临处决/绝境直接摊牌",
                  mechanism: "用一句话戳中上位者最隐秘的痛点实现当场翻盘",
                  evidenceTitles: ["大唐：开局为李世民献上避坑指南"],
                },
              ],
            },
            m03Cards: [
              {
                materialType: "情绪钩子",
                name: "高位直球剧透反客为主",
                summary:
                  "在性命攸关的上位者面前直接亮出精准未来预言，让原本要杀自己的大佬瞬间改口求合作。",
                tags: ["历史", "信息差", "高位震惊"],
                evidenceTitles: ["大唐：开局为李世民献上避坑指南"],
                trendWeight: 2.5,
              },
              {
                materialType: "金手指形态",
                name: "反向亏钱迪化返现",
                summary:
                  "系统只奖励合法亏损，主角疯狂做反常识决策却阴差阳错引爆市场膜拜。",
                tags: ["反差金手指", "迪化", "都市"],
                evidenceTitles: ["败家亏钱系统，结果全网以为我是商业教父"],
                trendWeight: 2.3,
              },
              {
                materialType: "核心爽点",
                name: "上位者当场验证预言破防",
                summary:
                  "不靠空口画饼，第一手预言立刻在现实应验，让高位配角心理防线彻底坍塌。",
                tags: ["立即验货", "配角震惊"],
                evidenceTitles: ["大唐：开局为李世民献上避坑指南"],
                trendWeight: 2.4,
              },
            ],
          }),
        },
      );

      expect(tr01.savedToM03Count).toBe(3);
      expect(listMarketM03Materials(database)).toHaveLength(3);

      let capturedPrompt = "";
      const incubated = await incubateBenchmarkProposals(
        database,
        pool,
        {
          bookId: "qidian:1001",
          strategy: "reskin_world",
          targetWorld: "火影忍者",
          useM03Trends: true,
          proposalCount: 2,
        },
        {
          now: () => new Date("2026-11-24T09:10:00Z"),
          generateOverride: ({ prompt }) => {
            capturedPrompt = prompt;
            return {
              benchmarkDeconstruction: {
                benchmarkTitle: "大唐：开局为李世民献上避坑指南",
                targetAudience: "喜欢历史/同人信息差装逼、高位互动的男频读者",
                singleCoreDemand:
                  "用先知信息差不断震撼原著顶级大佬并改写悲剧命运",
                corePayoffMechanism:
                  "直球摊牌预言 -> 大佬怀疑 -> 现场应验破防 -> 地位飙升",
                supportingReactionLoop:
                  "高热度原著大佬从轻视杀意转为震惊敬畏并主动押注配合",
                openingHookPattern:
                  "身陷必死危机时抛出对方最致命的未来秘密自救",
              },
              proposals: [
                {
                  strategy: "reskin_world",
                  strategyLabel: "换皮流·换同人地图",
                  suggestedTitle: "木叶：开局摊牌穿越者，三代和团藏坐不住了",
                  oneLineHook:
                    "九尾之夜前夕面临根部灭口，他直接向波风水门摊牌带土身份与未来四战剧本，全木叶高层当场破防。",
                  preservedDemand:
                    "用精准未来信息差持续震撼原著顶级忍者并改写意难平",
                  noveltyShift:
                    "从大唐秦王府换壳至木叶九尾之夜前夕，把历史朝堂博弈升级为忍界情报与血继阴谋的现场对质",
                  targetWorldSetting: "火影忍者 · 木叶四十八年九尾之夜前夕",
                  protagonistIdentity: "即将被根部清理的宇智波边缘情报分析员",
                  goldenFinger:
                    "未来剧本验证反馈：每当一条关键剧透被原著顶级人物亲眼验证，可解锁对应忍术解析与查克拉提纯",
                  goldenFingerGuardrail:
                    "绝不直接给无敌战力，必须靠主角在高压审讯和派系夹缝里精准抛出筹码才能触发验证收益",
                  firstThreeChaptersPlan: [
                    "第1章：根部地牢行刑前，当着水门与暗部直接点破面具男写轮眼与九尾解封日期，逼停死刑。",
                    "第2章：水门半信半疑带人核查外围异常，当场抓出白绝眼线，第一手预言应验，水门震惊改态。",
                    "第3章：团藏反咬主角勾结外敌要求当场拿下，主角当众抛出宇智波政变与灭族剧本反杀团藏威望。",
                  ],
                  m03TrendTags: [
                    "高位直球剧透反客为主",
                    "上位者当场验证预言破防",
                  ],
                  riskCheck:
                    "避免变成大段科普原著剧情；每次剧透必须绑定当下生死利害和对方真实反制。",
                },
              ],
            };
          },
        },
      );

      expect(capturedPrompt).toContain("高位直球剧透反客为主");
      expect(capturedPrompt).toContain("火影忍者");
      expect(incubated.appliedM03Trends).toHaveLength(3);
      expect(incubated.proposals).toHaveLength(1);

      const handlers = new Map<string, RouteHandler>();
      const fakeApp: RouteApp = {
        route(method, path, handler) {
          handlers.set(`${method} ${path}`, handler);
        },
      };
      registerMarketRadarRoutes(fakeApp, database, {
        loadNewbookPool: () => pool,
      });

      const createHandler = handlers.get(
        "POST /api/market-radar/create-project",
      );
      expect(createHandler).toBeDefined();
      const created = (await createHandler!({
        method: "POST",
        path: "/api/market-radar/create-project",
        params: {},
        query: {},
        body: {
          benchmarkTitle: incubated.benchmarkSource.title,
          deconstruction: incubated.benchmarkDeconstruction,
          proposal: incubated.proposals[0]!,
          seedMarketM03: true,
        },
        headers: {},
      })) as { project: { id: string; title: string }; seededM03Count: number };

      expect(created.project.title).toBe(
        "木叶：开局摊牌穿越者，三代和团藏坐不住了",
      );
      expect(created.seededM03Count).toBe(3);

      const intent = new SqliteStoryRepository(database).getAuthorIntent(
        created.project.id,
      );
      expect(intent?.currentFocus).toContain("大唐：开局为李世民献上避坑指南");
      expect(intent?.boundaries.join("\n")).toContain("单一需求红线");

      const m03Rows = database.raw
        .prepare(
          "SELECT COUNT(*) AS count FROM text_segments WHERE project_id = ? AND source_type = 'creative_material'",
        )
        .all(created.project.id) as unknown as Array<{ count: number }>;
      expect(m03Rows[0]?.count).toBe(3);
    } finally {
      database.close();
    }
  });
});
