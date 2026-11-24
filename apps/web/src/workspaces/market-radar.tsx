import "../styles/market-radar.css";

import type {
  BenchmarkIncubateResponse,
  BenchmarkProposal,
  BenchmarkStrategy,
  MarketM03Material,
  MarketPlatform,
  MarketRadarBooksResponse,
  NewbookRankingEntry,
  Tr01AnalyzeResponse,
} from "@narralume/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Database,
  Flame,
  Radar,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  apiErrorMessage,
  createProjectFromBenchmarkProposal,
  getMarketM03Trends,
  getMarketRadarBooks,
  incubateBenchmarkBook,
  runTr01MarketAnalysis,
} from "../lib/api";

const PLATFORMS: Array<{ value: MarketPlatform; label: string }> = [
  { value: "all", label: "全平台" },
  { value: "qidian", label: "起点新书" },
  { value: "fanqie", label: "番茄男频" },
  { value: "ciweimao", label: "刺猬猫新书" },
];

const WINDOWS = [
  { value: 7, label: "近 7 天" },
  { value: 14, label: "近 14 天" },
  { value: 30, label: "近 30 天" },
  { value: 0, label: "全部累计" },
] as const;

const STRATEGIES: Array<{ value: BenchmarkStrategy; label: string }> = [
  { value: "multi", label: "一键多路对比（换世界 + 硬核 + 反差）" },
  { value: "reskin_world", label: "换皮流 · 换世界 / 换同人地图" },
  { value: "reskin_identity", label: "换皮流 · 换主角身份" },
  { value: "hardcore_graft", label: "硬核植入法 · 塞入硬核知识/民俗体系" },
  { value: "contrast_cheat", label: "身份反差金手指 · 反常识/作死反赚" },
  { value: "character_contrast", label: "人物反差切入 · 大佬穿弱势原主" },
];

const PLATFORM_NAMES: Record<string, string> = {
  qidian: "起点",
  fanqie: "番茄",
  ciweimao: "刺猬猫",
};

export function MarketRadarWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"benchmark" | "tr01">("benchmark");
  const [windowDays, setWindowDays] = useState<number>(14);
  const [platform, setPlatform] = useState<MarketPlatform>("all");
  const [search, setSearch] = useState("");
  const [booksResp, setBooksResp] = useState<MarketRadarBooksResponse | null>(
    null,
  );
  const [m03Trends, setM03Trends] = useState<MarketM03Material[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);

  // 对标书微创新状态
  const [useCustomBook, setUseCustomBook] = useState(false);
  const [selectedBook, setSelectedBook] = useState<NewbookRankingEntry | null>(
    null,
  );
  const [customTitle, setCustomTitle] = useState("");
  const [customIntro, setCustomIntro] = useState("");
  const [publicChapterExcerpt, setPublicChapterExcerpt] = useState("");
  const [strategy, setStrategy] = useState<BenchmarkStrategy>("multi");
  const [targetWorld, setTargetWorld] = useState("");
  const [targetIdentityHint, setTargetIdentityHint] = useState("");
  const [useM03Trends, setUseM03Trends] = useState(true);
  const [proposalCount, setProposalCount] = useState(3);
  const [incubating, setIncubating] = useState(false);
  const [incubateResult, setIncubateResult] =
    useState<BenchmarkIncubateResponse | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  // TR-01 市场趋势分析状态
  const [sampleLimit, setSampleLimit] = useState(24);
  const [autoSaveM03, setAutoSaveM03] = useState(true);
  const [analyzingTr01, setAnalyzingTr01] = useState(false);
  const [tr01Result, setTr01Result] = useState<Tr01AnalyzeResponse | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = useCallback(
    async (signal?: AbortSignal) => {
      const [booksData, trendsData] = await Promise.all([
        getMarketRadarBooks(
          {
            windowDays,
            platform,
            ...(search.trim() ? { search: search.trim() } : {}),
            limit: 150,
          },
          signal,
        ),
        getMarketM03Trends(signal),
      ]);
      if (signal?.aborted) return;
      setBooksResp(booksData);
      setM03Trends(trendsData.cards);
      setSelectedBook((current) => {
        if (
          current &&
          booksData.books.some((item) => item.id === current.id)
        ) {
          return current;
        }
        return booksData.books[0] ?? null;
      });
    },
    [platform, search, windowDays],
  );

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    setError(null);
    try {
      await fetchMarketData();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoadingBooks(false);
    }
  }, [fetchMarketData]);

  useEffect(() => {
    const controller = new AbortController();
    fetchMarketData(controller.signal).catch((caught) => {
      if (!controller.signal.aborted) setError(apiErrorMessage(caught));
    });
    return () => controller.abort();
  }, [fetchMarketData]);

  const handleRunTr01 = async () => {
    setAnalyzingTr01(true);
    setError(null);
    try {
      const res = await runTr01MarketAnalysis({
        windowDays,
        platform,
        ...(search.trim() ? { search: search.trim() } : {}),
        sampleLimit,
        autoSaveM03,
      });
      setTr01Result(res);
      const refreshedTrends = await getMarketM03Trends();
      setM03Trends(refreshedTrends.cards);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setAnalyzingTr01(false);
    }
  };

  const handleIncubate = async () => {
    setIncubating(true);
    setError(null);
    try {
      const res = await incubateBenchmarkBook({
        ...(useCustomBook
          ? {
              customTitle: customTitle.trim(),
              customIntro: customIntro.trim(),
            }
          : selectedBook
            ? { bookId: selectedBook.id }
            : {}),
        ...(publicChapterExcerpt.trim()
          ? { publicChapterExcerpt: publicChapterExcerpt.trim() }
          : {}),
        strategy,
        ...(targetWorld.trim() ? { targetWorld: targetWorld.trim() } : {}),
        ...(targetIdentityHint.trim()
          ? { targetIdentityHint: targetIdentityHint.trim() }
          : {}),
        useM03Trends,
        proposalCount,
      });
      setIncubateResult(res);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setIncubating(false);
    }
  };

  const handleCreateProject = async (proposal: BenchmarkProposal) => {
    if (!incubateResult) return;
    setCreatingId(proposal.id);
    setError(null);
    try {
      const created = await createProjectFromBenchmarkProposal({
        benchmarkTitle: incubateResult.benchmarkSource.title,
        deconstruction: incubateResult.benchmarkDeconstruction,
        proposal,
        language: "zh-CN",
        seedMarketM03: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${created.project.id}/overview`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setCreatingId(null);
    }
  };

  const stats = booksResp?.status;

  return (
    <div className="market-radar">
      <header className="market-radar__hero">
        <div>
          <div className="market-radar__eyebrow">
            <Radar size={15} />
            <span>M0 · 市场新书雷达 → TR-01 高权重入 M03 → 对标微创新开书</span>
          </div>
          <h1>市场对标开书工作台</h1>
          <p>
            先看近 7～14 天真实男频新书榜风口，用 TR-01 拆解沉淀高权重 M03
            素材；再挑一本市场验证过的对标书，锁死它的单一核心读者需求，通过「换世界 /
            换身份 / 硬核植入 / 反差金手指」微创新生成新书方案并一键建书。
          </p>
        </div>

        <div className="market-radar__stats">
          <div className="market-radar__stat">
            <span>男频新书总库</span>
            <strong>{stats?.totalBooks ?? "—"}</strong>
          </div>
          <div className="market-radar__stat">
            <span>起点 / 番茄 / 刺猬猫</span>
            <strong>
              {stats
                ? `${stats.byPlatform.qidian ?? 0}/${stats.byPlatform.fanqie ?? 0}/${stats.byPlatform.ciweimao ?? 0}`
                : "—"}
            </strong>
          </div>
          <div className="market-radar__stat">
            <span>M03 高权重风口卡</span>
            <strong>{m03Trends.length}</strong>
          </div>
          <div className="market-radar__stat">
            <span>最新抓取日期</span>
            <strong>{stats?.snapshotDate ?? "—"}</strong>
          </div>
        </div>
      </header>

      <div className="market-radar__tabs">
        <button
          type="button"
          className="market-radar__tab"
          aria-pressed={tab === "benchmark"}
          onClick={() => setTab("benchmark")}
        >
          <BookOpenCheck size={16} />① 选对标书 · 微创新开书（讲师基础课）
        </button>
        <button
          type="button"
          className="market-radar__tab"
          aria-pressed={tab === "tr01"}
          onClick={() => setTab("tr01")}
        >
          <Flame size={16} />② TR-01 市场风口解码 &amp; M03 高权重素材库（
          {m03Trends.length}）
        </button>
      </div>

      <section className="market-radar__filterbar">
        <div className="market-radar__pillgroup" aria-label="时间窗口">
          {WINDOWS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={windowDays === item.value}
              onClick={() => setWindowDays(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="market-radar__pillgroup" aria-label="平台筛选">
          {PLATFORMS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={platform === item.value}
              onClick={() => setPlatform(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          className="market-radar__search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索书名、分类、金手指或题材（如：火影 / 历史 / 亏钱 / 诡异 / 民俗）…"
        />

        <button
          type="button"
          className="btn"
          onClick={() => void loadBooks()}
          disabled={loadingBooks}
        >
          <RefreshCw size={14} />
          {loadingBooks ? "加载中…" : `筛选出 ${stats?.filteredBooks ?? 0} 本`}
        </button>
      </section>

      {error ? (
        <div className="market-radar__error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn"
            onClick={() => navigate("/settings")}
          >
            检查模型设置
          </button>
        </div>
      ) : null}

      {tab === "benchmark" ? (
        <div className="market-radar__split">
          <aside className="market-radar__list" aria-label="男频新书榜候选">
            {(booksResp?.books ?? []).map((book) => (
              <button
                key={book.id}
                type="button"
                className="market-radar__book"
                aria-pressed={!useCustomBook && selectedBook?.id === book.id}
                onClick={() => {
                  setUseCustomBook(false);
                  setSelectedBook(book);
                }}
              >
                <div className="market-radar__book-meta">
                  <span
                    className={`market-radar__badge market-radar__badge--${book.trendLabel}`}
                  >
                    {book.trendLabel === "hot"
                      ? `热风口 ${book.trendWeight}`
                      : book.trendLabel === "rising"
                        ? `上升 ${book.trendWeight}`
                        : `权重 ${book.trendWeight}`}
                  </span>
                  <span>
                    {PLATFORM_NAMES[book.platform] ?? book.platform} ·{" "}
                    {book.board}
                  </span>
                  {book.latestRank ? <span>#{book.latestRank}</span> : null}
                  <span>{book.category}</span>
                </div>
                <h3 className="market-radar__book-title">{book.title}</h3>
                <p className="market-radar__book-intro">
                  {book.intro || "（暂无简介）"}
                </p>
              </button>
            ))}
            {!loadingBooks && (booksResp?.books.length ?? 0) === 0 ? (
              <div className="market-radar__card">
                当前筛选条件下没有新书样本，请切换时间窗口或清空搜索词。
              </div>
            ) : null}
          </aside>

          <section className="market-radar__panel">
            <div className="market-radar__actions">
              <h2>对标书微创新开书台</h2>
              <label className="market-radar__check">
                <input
                  type="checkbox"
                  checked={useCustomBook}
                  onChange={(event) => setUseCustomBook(event.target.checked)}
                />
                改为手动输入对标书
              </label>
            </div>

            {!useCustomBook && selectedBook ? (
              <div className="market-radar__selected-box">
                <div className="market-radar__book-meta">
                  <span className="market-radar__badge market-radar__badge--hot">
                    当前对标书
                  </span>
                  <span>
                    {PLATFORM_NAMES[selectedBook.platform] ??
                      selectedBook.platform}{" "}
                    · {selectedBook.board} · {selectedBook.category}
                  </span>
                  <span>首次上榜 {selectedBook.firstSeenAt}</span>
                </div>
                <h3>《{selectedBook.title}》</h3>
                <p>{selectedBook.intro || "（该书暂无简介）"}</p>
              </div>
            ) : (
              <div className="market-radar__form-grid">
                <label className="market-radar__field market-radar__field--full">
                  自定义对标书名
                  <input
                    value={customTitle}
                    onChange={(event) => setCustomTitle(event.target.value)}
                    placeholder="例如：大明：剧透未来，朱元璋崩溃了 / 火影：练假成真，斑震惊了"
                  />
                </label>
                <label className="market-radar__field market-radar__field--full">
                  对标书简介
                  <textarea
                    value={customIntro}
                    onChange={(event) => setCustomIntro(event.target.value)}
                    placeholder="粘贴对标书简介，AI 会从中拆出单一核心读者需求与配角反应机制…"
                  />
                </label>
              </div>
            )}

            <div className="market-radar__form-grid">
              <label className="market-radar__field">
                微创新策略（讲师第 0 课）
                <select
                  value={strategy}
                  onChange={(event) =>
                    setStrategy(event.target.value as BenchmarkStrategy)
                  }
                >
                  {STRATEGIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="market-radar__field">
                生成方案数
                <select
                  value={proposalCount}
                  onChange={(event) =>
                    setProposalCount(Number(event.target.value))
                  }
                >
                  <option value={2}>2 个方案</option>
                  <option value={3}>3 个方案（推荐）</option>
                  <option value={4}>4 个方案</option>
                </select>
              </label>

              <label className="market-radar__field">
                目标世界 / 同人地图（可选）
                <input
                  value={targetWorld}
                  onChange={(event) => setTargetWorld(event.target.value)}
                  placeholder="留空让 AI 推荐，或指定如：火影忍者 / 大唐 / 斗破 / 港综 / 都市民俗"
                />
              </label>

              <label className="market-radar__field">
                主角身份偏好（可选）
                <input
                  value={targetIdentityHint}
                  onChange={(event) =>
                    setTargetIdentityHint(event.target.value)
                  }
                  placeholder="可选，如：边缘族人 / 小狱卒 / 落魄画师 / 假太监"
                />
              </label>

              <label className="market-radar__field market-radar__field--full">
                对标书前几章公共章节节选（可选，粘贴后拆解更精准）
                <textarea
                  value={publicChapterExcerpt}
                  onChange={(event) =>
                    setPublicChapterExcerpt(event.target.value)
                  }
                  placeholder="可粘贴该对标书第 1～3 章关键情节片段；留空则仅依据书名与简介拆解。"
                />
              </label>
            </div>

            <div className="market-radar__actions">
              <label className="market-radar__check">
                <input
                  type="checkbox"
                  checked={useM03Trends}
                  onChange={(event) => setUseM03Trends(event.target.checked)}
                />
                融合 M03 高权重市场风口素材（当前库内 {m03Trends.length} 条）
              </label>

              <button
                type="button"
                className="btn btn--primary"
                disabled={
                  incubating ||
                  (!useCustomBook && !selectedBook) ||
                  (useCustomBook && !customTitle.trim())
                }
                onClick={() => void handleIncubate()}
              >
                <Sparkles size={15} />
                {incubating
                  ? "正在拆解对标书并孵化新书方案…"
                  : "拆对标书并生成微创新方案"}
              </button>
            </div>

            {incubateResult ? (
              <>
                <div className="market-radar__deconstruct">
                  <h3>
                    对标书底层解码：《
                    {incubateResult.benchmarkDeconstruction.benchmarkTitle}》
                    <small style={{ marginLeft: 10, fontWeight: 500 }}>
                      模型：{incubateResult.modelId}
                    </small>
                  </h3>
                  <div className="market-radar__kv">
                    <div>
                      <strong>目标读者人群</strong>
                      {incubateResult.benchmarkDeconstruction.targetAudience}
                    </div>
                    <div>
                      <strong>单一核心缺憾 / 需求（绝不混需求）</strong>
                      {incubateResult.benchmarkDeconstruction.singleCoreDemand}
                    </div>
                    <div>
                      <strong>核心爽感机制</strong>
                      {
                        incubateResult.benchmarkDeconstruction
                          .corePayoffMechanism
                      }
                    </div>
                    <div>
                      <strong>配角 / 周围人反应循环</strong>
                      {
                        incubateResult.benchmarkDeconstruction
                          .supportingReactionLoop
                      }
                    </div>
                  </div>
                </div>

                <div className="market-radar__proposals">
                  {incubateResult.proposals.map((proposal) => (
                    <article
                      key={proposal.id}
                      className="market-radar__proposal"
                    >
                      <div className="market-radar__proposal-head">
                        <div>
                          <span className="market-radar__badge market-radar__badge--hot">
                            {proposal.strategyLabel}
                          </span>
                          <h4 style={{ marginTop: 6 }}>
                            《{proposal.suggestedTitle}》
                          </h4>
                        </div>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={creatingId === proposal.id}
                          onClick={() => void handleCreateProject(proposal)}
                        >
                          {creatingId === proposal.id
                            ? "建书中…"
                            : "以此方案正式开书 →"}
                        </button>
                      </div>

                      <p className="market-radar__hook">
                        {proposal.oneLineHook}
                      </p>

                      <div className="market-radar__kv">
                        <div>
                          <strong>保留的核心需求</strong>
                          {proposal.preservedDemand}
                        </div>
                        <div>
                          <strong>微创新换壳点</strong>
                          {proposal.noveltyShift}
                        </div>
                        <div>
                          <strong>目标世界 / 主角身份</strong>
                          {proposal.targetWorldSetting} ｜{" "}
                          {proposal.protagonistIdentity}
                        </div>
                        <div>
                          <strong>金手指 &amp; 原则2防崩边界</strong>
                          {proposal.goldenFinger}
                          <br />
                          <small>约束：{proposal.goldenFingerGuardrail}</small>
                        </div>
                      </div>

                      <div>
                        <strong style={{ fontSize: 12 }}>
                          黄金前三章推进路线：
                        </strong>
                        <ol className="market-radar__chapters">
                          {proposal.firstThreeChaptersPlan.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="market-radar__book-meta">
                        <span>毒点自检：{proposal.riskCheck}</span>
                      </div>

                      {proposal.m03TrendTags.length > 0 ? (
                        <div className="market-radar__tags">
                          {proposal.m03TrendTags.map((tag) => (
                            <span key={tag} className="market-radar__tag">
                              M03 风口：{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : (
        <section className="market-radar__panel">
          <div className="market-radar__actions">
            <div>
              <h2>TR-I-01 市场趋势与爆款解码（自动沉淀高权重 M03）</h2>
              <p style={{ margin: "6px 0 0", color: "var(--text-secondary)" }}>
                对当前筛选窗口内的真实男频新书榜执行三层漏斗分析，提炼可复用的金手指、人设、爽点与情绪钩子，自动打上高风口权重存入
                M03 素材库。
              </p>
            </div>

            <div className="market-radar__actions">
              <label className="market-radar__field">
                抽样新书数
                <select
                  value={sampleLimit}
                  onChange={(event) =>
                    setSampleLimit(Number(event.target.value))
                  }
                >
                  <option value={15}>Top 15 本</option>
                  <option value={24}>Top 24 本（推荐）</option>
                  <option value={36}>Top 36 本</option>
                </select>
              </label>

              <label className="market-radar__check">
                <input
                  type="checkbox"
                  checked={autoSaveM03}
                  onChange={(event) => setAutoSaveM03(event.target.checked)}
                />
                分析完自动写入 M03 高权重库
              </label>

              <button
                type="button"
                className="btn btn--primary"
                disabled={analyzingTr01}
                onClick={() => void handleRunTr01()}
              >
                <Flame size={15} />
                {analyzingTr01
                  ? "TR-01 正在解码新书榜…"
                  : "运行 TR-01 三层漏斗分析"}
              </button>
            </div>
          </div>

          {tr01Result ? (
            <>
              <h3>
                第一层 · 宏观风口趋势（已分析 {tr01Result.analyzedBookCount}{" "}
                本 · {tr01Result.windowLabel} · 入库 M03{" "}
                {tr01Result.savedToM03Count} 张）
              </h3>
              <div className="market-radar__tr01-grid">
                {tr01Result.macroTrends.map((trend, idx) => (
                  <div key={idx} className="market-radar__card">
                    <div>
                      <span className="market-radar__badge market-radar__badge--hot">
                        {trend.weight === "high" ? "高权重风口" : "次热趋势"}
                      </span>{" "}
                      <strong>{trend.name}</strong>
                    </div>
                    <div>核心缺口：{trend.readerDemandGap}</div>
                    <div>为什么现在火：{trend.whyHotNow}</div>
                    <div className="market-radar__tags">
                      {trend.evidenceTitles.map((title) => (
                        <span key={title} className="market-radar__tag">
                          《{title}》
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <h3>第二层 · 中观爆款公式（金手指 / 主角人设 / 开篇钩子）</h3>
              <div className="market-radar__tr01-grid">
                <div className="market-radar__card">
                  <strong>热门金手指公式</strong>
                  {tr01Result.mesoPatterns.goldenFingerFormulas.map(
                    (item, idx) => (
                      <div key={idx}>
                        <b>{item.formula}</b>：{item.mechanism}（
                        {item.evidenceTitles.join("、")}）
                      </div>
                    ),
                  )}
                </div>
                <div className="market-radar__card">
                  <strong>热门主角人设公式</strong>
                  {tr01Result.mesoPatterns.protagonistFormulas.map(
                    (item, idx) => (
                      <div key={idx}>
                        <b>{item.formula}</b>：{item.mechanism}（
                        {item.evidenceTitles.join("、")}）
                      </div>
                    ),
                  )}
                </div>
                <div className="market-radar__card">
                  <strong>热门开篇钩子模式</strong>
                  {tr01Result.mesoPatterns.openingHooks.map((item, idx) => (
                    <div key={idx}>
                      <b>{item.formula}</b>：{item.mechanism}（
                      {item.evidenceTitles.join("、")}）
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <h3>
            <Database
              size={16}
              style={{ verticalAlign: "text-bottom", marginRight: 6 }}
            />
            当前已沉淀的 M03 高权重风口素材库（{m03Trends.length} 条）
          </h3>
          {m03Trends.length > 0 ? (
            <div className="market-radar__tr01-grid">
              {m03Trends.map((card) => (
                <div key={card.id} className="market-radar__card">
                  <div className="market-radar__book-meta">
                    <span className="market-radar__badge market-radar__badge--hot">
                      {card.materialType} · 权重 {card.trendWeight}
                    </span>
                    <span>{card.marketWindow}</span>
                  </div>
                  <strong>{card.name}</strong>
                  <div>{card.summary}</div>
                  <div className="market-radar__tags">
                    {card.evidenceTitles.map((title) => (
                      <span key={title} className="market-radar__tag">
                        《{title}》
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="market-radar__card">
              还没有沉淀市场风口素材。点击右上角「运行 TR-01
              三层漏斗分析」，就会自动从最新男频新书榜提炼高权重 M03 素材卡！
            </div>
          )}
        </section>
      )}
    </div>
  );
}
