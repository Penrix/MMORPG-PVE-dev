/* MMORPG-PVE World Builder: independent world-content production desk.
 * Reuse NarraLume's candidate->review->Canon path; never silently commit LLM output.
 */
import "../styles/world-builder.css";
import "../styles/bible.css";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Compass, Sparkles } from "lucide-react";

import { PageBand } from "../components/page-band";
import { ProjectRequiredState } from "../components/project-required-state";
import { ErrorNote } from "../components/error-note";
import { useI18n } from "../i18n";
import {
  getCanonCandidates,
  getProjectRuns,
  getRunDetail,
  getStoryBible,
  startCanonCandidate,
  type NarrativeRun,
} from "../lib/api";
import { projectWorkspacePath, useProjectId } from "../lib/project-route";
import {
  buildWorldBuilderInstruction,
  WORLD_STAGES,
  worldBuilderValidation,
  worldStage,
  type WorldBuilderInput,
} from "../lib/world-builder";
import { CanonCandidateSetReview } from "./bible/candidate-panel";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const DEFAULT_INPUT: WorldBuilderInput = {
  scale: "W0",
  stage: "world",
  premise: "",
  worldTime: "",
  focus: "",
  genre: "",
  scarcity: "",
  instruction: "",
};

function readDraft(projectId: string | null): WorldBuilderInput {
  if (!projectId) return { ...DEFAULT_INPUT };
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(`mmorpg:world-builder:${projectId}`) ?? "null",
    ) as Partial<WorldBuilderInput> | null;
    if (!stored || typeof stored !== "object") return { ...DEFAULT_INPUT };
    return {
      scale: stored.scale === "W1" ? "W1" : "W0",
      stage: WORLD_STAGES.some((step) => step.id === stored.stage)
        ? stored.stage!
        : "world",
      premise: typeof stored.premise === "string" ? stored.premise : "",
      worldTime: typeof stored.worldTime === "string" ? stored.worldTime : "",
      focus: typeof stored.focus === "string" ? stored.focus : "",
      genre: typeof stored.genre === "string" ? stored.genre : "",
      scarcity: typeof stored.scarcity === "string" ? stored.scarcity : "",
      instruction:
        typeof stored.instruction === "string" ? stored.instruction : "",
    };
  } catch {
    return { ...DEFAULT_INPUT };
  }
}

function isWorldRun(run: NarrativeRun): boolean {
  return (
    run.recipe === "canon-spread-candidate" &&
    typeof run.policy.canonInstruction === "string" &&
    run.policy.canonInstruction.startsWith("【WORLD_BUILDER/")
  );
}

export function WorldBuilderWorkspace() {
  const { t } = useI18n();
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<WorldBuilderInput>(() => readDraft(projectId));
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const idempotencyRef = useRef<{ instruction: string; requestId: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const stage = worldStage(draft.stage);
  const validation = worldBuilderValidation(draft);
  const prompt = useMemo(
    () => (validation ? "" : buildWorldBuilderInstruction(draft)),
    [draft, validation],
  );

  useEffect(() => {
    if (!projectId) return;
    try {
      window.localStorage.setItem(
        `mmorpg:world-builder:${projectId}`,
        JSON.stringify(draft),
      );
    } catch {
      // A browser draft is optional; accepted Canon data is kept in SQLite.
    }
  }, [draft, projectId]);

  const bibleQuery = useQuery({
    queryKey: ["project", projectId, "bible"],
    queryFn: ({ signal }) => getStoryBible(projectId!, signal),
    enabled: Boolean(projectId),
  });
  const candidatesQuery = useQuery({
    queryKey: ["project", projectId, "canon-candidates", stage.spread],
    queryFn: ({ signal }) => getCanonCandidates(projectId!, stage.spread, signal),
    enabled: Boolean(projectId),
    refetchInterval: 5_000,
  });
  const runsQuery = useQuery({
    queryKey: ["project", projectId, "runs"],
    queryFn: ({ signal }) => getProjectRuns(projectId!, signal),
    enabled: Boolean(projectId),
    refetchInterval: 4_000,
  });
  const activeRun = (runsQuery.data ?? [])
    .filter((run) => isWorldRun(run) && !TERMINAL.has(run.status))
    .at(-1);
  const watchedRunId = activeRun?.id ?? startedRunId;
  const runQuery = useQuery({
    queryKey: ["run", watchedRunId],
    queryFn: ({ signal }) => getRunDetail(projectId!, watchedRunId!, signal),
    enabled: Boolean(projectId && watchedRunId),
    refetchInterval: (query) =>
      query.state.data && TERMINAL.has(query.state.data.run.status)
        ? false
        : 2_500,
  });

  useEffect(() => {
    if (!runQuery.data || !TERMINAL.has(runQuery.data.run.status)) return;
    void queryClient.invalidateQueries({
      queryKey: ["project", projectId, "canon-candidates"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["project", projectId, "bible"],
    });
  }, [runQuery.data?.run.status, projectId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const generation = useMutation({
    mutationFn: (instruction: string) => {
      if (!projectId) throw new Error("Project required");
      if (idempotencyRef.current?.instruction !== instruction) {
        idempotencyRef.current = {
          instruction,
          requestId: crypto.randomUUID(),
        };
      }
      return startCanonCandidate(projectId, stage.spread, {
        instruction,
        requestId: idempotencyRef.current.requestId,
      });
    },
    onSuccess: (result) => {
      idempotencyRef.current = null;
      setStartedRunId(result.runId);
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "runs"] });
      void queryClient.invalidateQueries({
        queryKey: ["project", projectId, "canon-candidates"],
      });
    },
  });
  const visibleSets = (candidatesQuery.data ?? [])
    .filter((set) => set.instruction.startsWith("【WORLD_BUILDER/"))
    .filter((set) => set.instruction.startsWith(`【WORLD_BUILDER/${draft.scale}/${draft.stage}】`))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const committedCount = bibleQuery.data?.entities.filter(
    (entity) => entity.status === "active",
  ).length ?? 0;
  function modify<K extends keyof WorldBuilderInput>(
    field: K,
    value: WorldBuilderInput[K],
  ) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  if (!projectId) {
    return (
      <div className="world-builder">
        <ProjectRequiredState
          seal="界"
          title="先选择一本作品"
          description="世界设计可以随时开展，但必须归属于一本书的世界资料库。"
        />
      </div>
    );
  }

  return (
    <div className="world-builder">
      <PageBand
        index="WORLD · 01"
        title={t("shell.nav.world")}
        meta={<span>{bibleQuery.data?.project.title ?? "MMORPG-PVE"} · {committedCount} 个已登记实体</span>}
      />
      <div className="world-builder__intro">
        <h2>创造一个在男主到来之前就真实存在的世界</h2>
        <p>
          生产世界地图、组织、人物、宝物、现实活动及它们之间的权利和关系。
          这不是章节大纲生成器。每轮 AI 产生可审阅的候选，采纳后写入现有世界百科；
          原版长篇创作会直接使用同一份 Canon。
        </p>
      </div>

      <div className="world-builder__layout">
        <section className="world-builder__form" aria-label="世界生成工作台">
          <div className="world-builder__scale" role="group" aria-label="世界分辨率">
            {(["W0", "W1"] as const).map((scale) => (
              <button key={scale} type="button" className="btn"
                aria-pressed={draft.scale === scale}
                onClick={() => modify("scale", scale)}>
                {scale === "W0" ? "W0 · 整体世界底图" : "W1 · 深化新地图 / 圈层"}
              </button>
            ))}
          </div>
          <p className="world-builder__hint">
            {draft.scale === "W0"
              ? "先创造世界本来就存在的高价人物、不同社会系统、力量、资源和通路，不围绕一份预写章纲搭景。"
              : "沿已确认世界与正文历史打开新地图。使用题材、当前时间地点和稀缺性来决定深入哪里。"}
          </p>

          <label htmlFor="world-premise">世界设想 / 已有世界</label>
          <textarea id="world-premise" rows={3} maxLength={4_000}
            placeholder="例如：1878年法国；或一个皇朝、宗门、商会和凡人城镇共存的玄幻世界"
            value={draft.premise}
            onChange={(event) => modify("premise", event.target.value)} />

          <label htmlFor="world-time">当前世界时间（不是未来剧情）</label>
          <input id="world-time" maxLength={400}
            placeholder="例如：1878年巴黎万博期间、开书前一个月"
            value={draft.worldTime}
            onChange={(event) => modify("worldTime", event.target.value)} />

          {draft.scale === "W1" ? (
            <div className="world-builder__w1">
              <label htmlFor="world-focus">要打开的实际地点、区域或社会圈层</label>
              <input id="world-focus" maxLength={1_000}
                placeholder="例如：巴黎的出版和戏剧界、宗门山下坊市"
                value={draft.focus}
                onChange={(event) => modify("focus", event.target.value)} />
              <label htmlFor="world-genre">题材和 Reader 想消费的情绪</label>
              <input id="world-genre" maxLength={1_000}
                placeholder="例如：男频文娱；风流、得意、事业成长"
                value={draft.genre}
                onChange={(event) => modify("genre", event.target.value)} />
              <label htmlFor="world-scarcity">已知高价目标与稀缺性（可留空）</label>
              <textarea id="world-scarcity" rows={2} maxLength={2_000}
                placeholder="有目标则写清谁控制、为什么珍贵；暂无则由世界内容发现候选"
                value={draft.scarcity}
                onChange={(event) => modify("scarcity", event.target.value)} />
            </div>
          ) : null}

          <fieldset className="world-builder__stages">
            <legend>选择本轮内容生产</legend>
            <div className="world-builder__stage-grid">
              {WORLD_STAGES.map((item) => (
                <button key={item.id} type="button" className="world-builder__stage"
                  aria-pressed={draft.stage === item.id}
                  onClick={() => modify("stage", item.id)}>
                  <strong>{item.label}</strong>
                  <small>{item.blurb}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <p className="world-builder__hint">
            本轮只写入「{stage.spread}」一类候选。关联事实、关系必须使用已采纳的实体 ID；
            可以回到任一轮继续创作，无须机械跑完七项。
          </p>
          <label htmlFor="world-instruction">本轮特别想创造或查清的内容（可选）</label>
          <textarea id="world-instruction" rows={3} maxLength={4_000}
            placeholder="例如：先打开出版社与银行的权力中介，人物自己已经在经营和争取利益"
            value={draft.instruction}
            onChange={(event) => modify("instruction", event.target.value)} />

          <div className="world-builder__actions">
            <button type="button" className="btn"
              onClick={() => setShowInstructions((visible) => !visible)}>
              {showInstructions ? "收起本轮生成指令" : "查看本轮生成指令"}
            </button>
            <button type="button" className="btn btn--primary"
              disabled={Boolean(validation) || generation.isPending || Boolean(activeRun)}
              onClick={() => generation.mutate(prompt)}>
              <Sparkles size={14} />
              {generation.isPending ? "正在创建任务" : "AI 生产世界候选"}
            </button>
          </div>
          {validation ? <p className="world-builder__validation">{validation}</p> : null}
          {showInstructions && prompt ? <pre className="world-builder__preview">{prompt}</pre> : null}
          {generation.isError ? <ErrorNote error={generation.error} title="创建世界生成任务失败" /> : null}
        </section>

        <aside className="world-builder__status">
          <div className="world-builder__status-head">
            <Compass size={18} />
            <h3>已存在的世界 Reality</h3>
          </div>
          <p>当前作品已有 {committedCount} 个可用实体、{bibleQuery.data?.facts.length ?? 0} 条事实、{bibleQuery.data?.relationships.length ?? 0} 条关系、{bibleQuery.data?.timeline.length ?? 0} 条世界事件。</p>
          {bibleQuery.isError ? <ErrorNote error={bibleQuery.error} title="世界资料读取失败" /> : null}
          {bibleQuery.data?.entities.length ? (
            <ul className="world-builder__entity-list">
              {bibleQuery.data.entities.filter((item) => item.status === "active").slice(-10).map((item) => (
                <li key={item.id}><strong>{item.name}</strong><small>{item.type}</small></li>
              ))}
            </ul>
          ) : (
            <p className="world-builder__hint">尚无已登记世界对象。可从 W0 世界底图开始。</p>
          )}
          <Link className="world-builder__link" to={projectWorkspacePath(projectId, "bible")}>
            查看、修订整个世界百科 <ArrowUpRight size={14} />
          </Link>
          <p className="world-builder__hint">
            表单草稿只保存于当前浏览器；AI任务和采纳后的世界对象存于原项目数据库。
            历史/原著事实应核对证据，模型推测不能自动算已确认史实。
          </p>
        </aside>
      </div>

      <section className="world-builder__results" aria-label="世界生成候选">
        <header>
          <h2>本轮候选与采纳</h2>
          <p>未采纳的对象不是世界事实。接受后原版故事工作区及后续世界生成都能读取。</p>
        </header>
        {activeRun ? (
          <p className="world-builder__running">
            正在运行世界内容生产任务（{activeRun.status}）。
            <Link to={`${projectWorkspacePath(projectId, "runs")}?run=${encodeURIComponent(activeRun.id)}`}>
              查看运行过程 <ArrowUpRight size={13} />
            </Link>
          </p>
        ) : null}
        {runQuery.data && ["failed", "cancelled"].includes(runQuery.data.run.status) ? (
          <p className="world-builder__validation">最近一次运行未完成。可到运行中心检查详细错误并重试。</p>
        ) : null}
        {candidatesQuery.isError ? <ErrorNote error={candidatesQuery.error} title="世界候选读取失败" /> : null}
        {visibleSets.length ? (
          <div className="bible-ai__sets">
            {visibleSets.slice(0, 8).map((set) => (
              <CanonCandidateSetReview key={set.id} projectId={projectId} value={set} />
            ))}
          </div>
        ) : (
          <p className="world-builder__hint">当前范围与轮次没有候选。发起生成后，这里可以逐项查看和采纳。</p>
        )}
      </section>
    </div>
  );
}
