/* World Builder desk.
 * One run produces a candidate batch of World Atlas objects, typed relations
 * and independent activities. WorldPack is a staging envelope, not the world.
 */
import "../styles/world-builder.css";

import {
  WorldPackDocumentSchema,
  type WorldPackDocument,
  type WorldPackNode,
  type WorldPackRecord,
  type WorldPackRequest,
} from "@narralume/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Compass, Layers3, Network, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { ErrorNote } from "../components/error-note";
import { PageBand } from "../components/page-band";
import { ProjectRequiredState } from "../components/project-required-state";
import {
  adoptWorldPack,
  generateWorldPack,
  getProjectRuns,
  getStoryBible,
  getWorldGraph,
  listWorldPacks,
  reviseWorldPack,
} from "../lib/api";
import { projectWorkspacePath, useProjectId } from "../lib/project-route";

const ENDED = new Set(["completed", "failed", "cancelled"]);
type FormValues = Omit<WorldPackRequest, "requestId">;

const EMPTY: FormValues = {
  intent: "create",
  scale: "W0",
  premise: "",
  worldTime: "",
  focus: "",
  genre: "",
  scarcity: "",
  instruction: "",
  parentAreaId: null,
  sourcePackageText: "",
};

function loadForm(projectId: string): FormValues {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(`mmorpg:world-pack:${projectId}`) ?? "null",
    ) as Partial<FormValues> | null;
    if (!saved || typeof saved !== "object") return { ...EMPTY };
    return {
      intent: saved.intent === "advance" ? "advance" : "create",
      scale: saved.scale === "W1" ? "W1" : "W0",
      premise: typeof saved.premise === "string" ? saved.premise : "",
      worldTime: typeof saved.worldTime === "string" ? saved.worldTime : "",
      focus: typeof saved.focus === "string" ? saved.focus : "",
      genre: typeof saved.genre === "string" ? saved.genre : "",
      ...(saved.worldPower === "ordinary" || saved.worldPower === "supernatural"
        ? { worldPower: saved.worldPower } : {}),
      scarcity: typeof saved.scarcity === "string" ? saved.scarcity : "",
      instruction: typeof saved.instruction === "string" ? saved.instruction : "",
      parentAreaId: typeof saved.parentAreaId === "string" ? saved.parentAreaId : null,
      sourcePackageText: typeof saved.sourcePackageText === "string" ? saved.sourcePackageText : "",
    };
  } catch {
    return { ...EMPTY };
  }
}

export function WorldBuilderWorkspace() {
  const projectId = useProjectId();
  if (!projectId) {
    return (
      <div className="world-builder">
        <ProjectRequiredState
          seal="界"
          title="先选择一本作品"
          description="世界内容与该作品的Canon和正文共享身份与时间。请先从书架打开作品。"
        />
      </div>
    );
  }
  return <WorldBuilderProject key={projectId} projectId={projectId} />;
}

function WorldBuilderProject({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues>(() => loadForm(projectId));
  const [graphCenter, setGraphCenter] = useState<string | null>(null);
  const requestRef = useRef<{ serialized: string; id: string } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(`mmorpg:world-pack:${projectId}`, JSON.stringify(form));
    } catch {
      // Browser preference, not Canon.
    }
  }, [form, projectId]);

  const bible = useQuery({
    queryKey: ["project", projectId, "bible"],
    queryFn: ({ signal }) => getStoryBible(projectId, signal),
  });
  const graph = useQuery({
    queryKey: ["project", projectId, "world-graph", graphCenter],
    queryFn: ({ signal }) => getWorldGraph(projectId, graphCenter ?? undefined, signal),
  });
  const runs = useQuery({
    queryKey: ["project", projectId, "runs"],
    queryFn: ({ signal }) => getProjectRuns(projectId, signal),
    refetchInterval: 3_000,
  });
  const packs = useQuery({
    queryKey: ["project", projectId, "world-packs"],
    queryFn: ({ signal }) => listWorldPacks(projectId, signal),
    refetchInterval: 4_000,
  });
  const worldRuns = (runs.data ?? []).filter((run) => run.recipe === "world-pack-production");
  const activeRun = worldRuns.find((run) => !ENDED.has(run.status));
  const recentRun = worldRuns.at(-1);
  const generation = useMutation({
    mutationFn: (input: WorldPackRequest) => generateWorldPack(projectId, input),
    onSuccess: () => {
      requestRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "runs"] });
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "world-packs"] });
    },
  });

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((existing) => ({ ...existing, [field]: value }));
  }
  const valid = form.premise.trim() && form.worldTime.trim() &&
    (form.scale === "W0" || (form.focus.trim() && form.genre.trim()));
  const start = () => {
    if (!valid) return;
    const serialized = JSON.stringify(form);
    if (requestRef.current?.serialized !== serialized) {
      requestRef.current = { serialized, id: crypto.randomUUID() };
    }
    generation.mutate({ ...form, requestId: requestRef.current.id });
  };
  const areas = useMemo(() =>
    (bible.data?.entities ?? []).filter((entity) =>
      entity.status === "active" && entity.type === "location",
    ), [bible.data?.entities]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["project", projectId, "world-packs"] });
    void queryClient.invalidateQueries({ queryKey: ["project", projectId, "bible"] });
    void queryClient.invalidateQueries({ queryKey: ["project", projectId, "world-graph"] });
  };

  return (
    <div className="world-builder">
      <PageBand
        index="WORLD · PVE"
        title="世界生成"
        meta={<span>{bible.data?.project.title ?? "World Builder"} · {packs.data?.length ?? 0} 个候选生产批次</span>}
      />
      <div className="world-builder__intro">
        <h2>把世界持续生产成可查询的 World Atlas</h2>
        <p>
          第一模块不再追求一次生成一篇“完整世界观”。程序读取现有 Reality，
          按 World Atlas 的十个内容 Family 与 People-centered 叙事轴发现缺口，
          逐步生产真实对象、typed relations、当前事务、社会价格和可进入路径。
          每个 WorldPack 只是一次候选生产批次，作者采用前不会改变 Reality。
        </p>
      </div>
      <div className="world-builder__layout">
        <section className="world-builder__form" aria-label="世界内容生产配置">
          <div className="world-builder__scale" role="group" aria-label="世界分辨率">
            <button className="btn" type="button" aria-pressed={form.scale === "W0"}
              onClick={() => update("scale", "W0")}>W0 · 世界战略底图</button>
            <button className="btn" type="button" aria-pressed={form.scale === "W1"}
              onClick={() => update("scale", "W1")}>W1 · 新地图与社会圈层</button>
          </div>
          <div className="world-builder__scale" role="group" aria-label="世界工作">
            <button className="btn" type="button" aria-pressed={form.intent !== "advance"}
              onClick={() => update("intent", "create")}>制作新区域与内容</button>
            <button className="btn" type="button" aria-pressed={form.intent === "advance"}
              onClick={() => update("intent", "advance")}>推进已有NPC / 组织的生活</button>
          </div>
          <p className="world-builder__hint">
            {form.intent === "advance"
              ? "使用已有世界的真实人物、资源和当前状态，生成新的行动及状态变化候选。重复出现的人物必须复用旧 Canon 身份。"
              : "制作能进入、能经营、能争夺、能生活的新世界内容。"}
          </p>
          <p className="world-builder__hint">
            {form.scale === "W0"
              ? "涵盖真实地区、各类势力、不同生活与产业、社会力量和可争取的高价对象。不是只为男主修一条任务路线。"
              : "在已有世界上打开新地图：保留既有人物、历史和资产，让局部生活和权利网络更加具体。"}
          </p>

          <div className="world-builder__scale" role="group" aria-label="世界力量规律">
            <button className="btn" type="button"
              aria-pressed={form.worldPower === "ordinary"}
              onClick={() => update("worldPower", "ordinary")}>现实力量 · 无超凡</button>
            <button className="btn" type="button"
              aria-pressed={form.worldPower === "supernatural"}
              onClick={() => update("worldPower", "supernatural")}>超凡力量 · 魔法 / 修炼等</button>
          </div>
          <p className="world-builder__hint">
            历史、同人、原创都走同一套世界内容生产程序。此处仅决定世界是否存在超凡规律；
            不选择时沿用已有题材推断，世界事实始终按各自来源校验。
          </p>

          <label htmlFor="wp-premise">世界根设想</label>
          <textarea id="wp-premise" rows={3} maxLength={8_000} value={form.premise}
            onChange={(event) => update("premise", event.target.value)}
            placeholder="例如：1878年法国；或一个皇朝、修仙宗门、商会与凡人共同生活的玄幻世界" />

          <label htmlFor="wp-time">当前世界时间</label>
          <input id="wp-time" maxLength={500} value={form.worldTime}
            onChange={(event) => update("worldTime", event.target.value)}
            placeholder="例如：1878年5月、开书之前。不是未来章纲时间" />

          {form.scale === "W1" ? (
            <div className="world-builder__w1">
              <label htmlFor="wp-parent">已存在的父级区域（可选）</label>
              <select id="wp-parent" value={form.parentAreaId ?? ""}
                onChange={(event) => update("parentAreaId", event.target.value || null)}>
                <option value="">从整书世界根部展开</option>
                {areas.map((area) => (
                  <option value={area.id} key={area.id}>{area.name}</option>
                ))}
              </select>
              <label htmlFor="wp-focus">当前具体地点 / 圈层</label>
              <input id="wp-focus" value={form.focus} maxLength={2_000}
                onChange={(event) => update("focus", event.target.value)}
                placeholder="例如：巴黎的出版商与银行家社会、宗门山下坊市" />
              <label htmlFor="wp-genre">题材 / Reader情绪</label>
              <input id="wp-genre" value={form.genre} maxLength={2_000}
                onChange={(event) => update("genre", event.target.value)}
                placeholder="例如：玄幻，修炼、得意、风流、财富、上位" />
              <label htmlFor="wp-scarcity">已经锁定的高价目标与稀缺性（可留空）</label>
              <textarea id="wp-scarcity" rows={2} value={form.scarcity} maxLength={2_000}
                onChange={(event) => update("scarcity", event.target.value)}
                placeholder="谁掌握什么、为何有价、哪些人正在争；有目标先给原目标立价" />
            </div>
          ) : null}

          <label htmlFor="wp-covel">Covel 格式的已有世界包（可选，真正解析原生格式）</label>
          <textarea id="wp-covel" rows={4} maxLength={100_000} value={form.sourcePackageText ?? ""}
            onChange={(event) => update("sourcePackageText", event.target.value)}
            placeholder={"===WORLD_YAML===\\nworld: 你的世界\\n===WORLD_MD===\\n现有世界资料、势力与人物……\\n===END==="} />
          <p className="world-builder__hint">使用实际移植的 Covel 分段解析器读取 WORLD_YAML / WORLD_MD / WORLD_PACKAGE_YAML，不要求作者自行拆成单项实体卡。</p>
          <label htmlFor="wp-extra">本轮世界生产重点（可选）</label>
          <textarea id="wp-extra" rows={3} value={form.instruction} maxLength={8_000}
            onChange={(event) => update("instruction", event.target.value)}
            placeholder="例如：特别展开商会资产、掌柜的私人生活、几笔正在流动的交易和可进入的上层社会" />
          <div className="world-builder__actions">
            <button type="button" className="btn btn--primary"
              disabled={!valid || generation.isPending || Boolean(activeRun)}
              onClick={start}>
              <Sparkles size={14} />
              {generation.isPending ? "创建任务中…" : "AI 生产 / 扩张世界内容"}
            </button>
            <Link className="world-builder__link" to={projectWorkspacePath(projectId, "runs")}>
              运行中心 <ArrowUpRight size={14} />
            </Link>
          </div>
          {!valid ? <p className="world-builder__hint">先填写世界设想与当前时间；W1 还需指定地图和题材情绪。</p> : null}
          {generation.isError ? <ErrorNote title="世界生产未启动" error={generation.error} /> : null}
          {activeRun ? (
            <p className="world-builder__running">
              <Layers3 size={15} /> 世界内容生产批次正在运行：{activeRun.status}。
              <Link to={`${projectWorkspacePath(projectId,"runs")}?run=${encodeURIComponent(activeRun.id)}`}>
                查看步骤
              </Link>
            </p>
          ) : recentRun?.status === "failed" ? (
            <p className="world-builder__validation">最近任务失败，请到运行中心查看模型或输出校验错误。</p>
          ) : null}
        </section>

        <aside className="world-builder__status">
          <div className="world-builder__status-head"><Compass size={18} /><h3>世界当前 Reality</h3></div>
          <p>已采纳 Canon：{bible.data?.entities.filter((e) => e.status === "active").length ?? 0} 个实体、{bible.data?.facts.length ?? 0} 条事实、{bible.data?.relationships.length ?? 0} 条关系。</p>
          <p className="world-builder__hint">
            这里展示的是已确认的 Reality，不是本轮候选生产批次。
            过去正文和世界卡的现有关系会进入下一轮世界生产与缺口判断。
          </p>
          {bible.isError ? <ErrorNote title="读取世界资料失败" error={bible.error} /> : null}
          {areas.length ? (
            <div>
              <strong>已有可再次展开的地图</strong>
              <ul className="world-builder__entity-list">
                {areas.slice(-15).map((area) => (
                  <li key={area.id}>
                    <button className="world-builder__area-btn" type="button"
                      onClick={() => {
                        setGraphCenter(area.id);
                        update("parentAreaId", area.id);
                        update("scale", "W1");
                        update("focus", area.name);
                      }}>{area.name}</button>
                    <small>{area.id.slice(0,8)}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="world-builder__hint">暂无已确认的区域，可先生成 W0。</p>}
          <div className="world-builder__graph">
            <h4>{graphCenter ? "所选地区的两跳世界关系" : "当前世界的关系网"}</h4>
            {graphCenter ? <button type="button" className="btn"
              onClick={() => setGraphCenter(null)}>查看全世界</button> : null}
            <p className="world-builder__hint">
              {graph.data?.nodes.length ?? 0} 个关联对象 · {graph.data?.edges.length ?? 0} 条关系 ·
              {graph.data?.ongoingActivities.length ?? 0} 项正在进行的事务
            </p>
            {graph.isError ? <ErrorNote error={graph.error} title="世界关系读取失败" /> : null}
            <ul className="world-builder__entity-list">
              {(graph.data?.edges ?? []).slice(0, 12).map((edge) => {
                const from = graph.data!.nodes.find((e) => e.id === edge.from)?.name ?? edge.from;
                const to = graph.data!.nodes.find((e) => e.id === edge.to)?.name ?? edge.to;
                return <li key={edge.id}><span>{from} · {edge.relation} · {to}</span></li>;
              })}
            </ul>
            {(graph.data?.ongoingActivities ?? []).slice(0, 5).map((activity) => (
              <p className="world-builder__hint" key={activity.id}>
                {graph.data!.nodes.find((e) => e.id === activity.actorId)?.name}：
                {typeof activity.detail === "object" && activity.detail !== null &&
                  "description" in activity.detail
                    ? String(activity.detail.description)
                    : "正在进行的世界事务"}
              </p>
            ))}
          </div>
          <Link className="world-builder__link" to={projectWorkspacePath(projectId, "bible")}>
            查看世界百科与人物资料 <ArrowUpRight size={14}/>
          </Link>
          <p className="world-builder__hint">
            正在发生的事务是 actor 的当前事实；未发生的可能事件只留在候选包，不写成历史时间线。
          </p>
        </aside>
      </div>

      <section className="world-builder__results">
        <header><h2><Network size={18}/> 世界内容候选批次与审阅</h2>
          <p>每批都是一组互相引用的世界对象、typed relations 和人物事务。WorldPack 只负责暂存与原子审阅，不是第二套世界数据库。</p>
        </header>
        {packs.isError ? <ErrorNote title="读取世界内容候选失败" error={packs.error} /> : null}
        {packs.data?.length ? packs.data.slice(0, 12).map((pack) => (
          <WorldPackReview key={`${pack.id}:${pack.version}`}
            pack={pack} projectId={projectId} onSaved={refresh}/>
        )) : (
          <p className="world-builder__hint">还没有候选生产批次。填写上面的世界设想后即可开始生产或扩张世界内容。</p>
        )}
      </section>
    </div>
  );
}

function WorldPackReview({
  pack, projectId, onSaved,
}: { pack: WorldPackRecord; projectId: string; onSaved: () => void }) {
  const [raw, setRaw] = useState(() => JSON.stringify(pack.document, null, 2));
  const [edit, setEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirm, setConfirm] = useState(false);

  const save = useMutation({
    mutationFn: (document: WorldPackDocument) =>
      reviseWorldPack(projectId, pack.id, pack.version, document),
    onSuccess: onSaved,
  });
  const adoption = useMutation({
    mutationFn: () => adoptWorldPack(projectId, pack.id, pack.version),
    onSuccess: onSaved,
  });

  const saveEdits = () => {
    try {
      const result = WorldPackDocumentSchema.parse(JSON.parse(raw));
      setEditError("");
      save.mutate(result);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const nodeName = (ref: string) =>
    pack.document.nodes.find((node) => node.localId === ref)?.name ??
    (ref.startsWith("canon:") ? `已确认Canon · ${ref.slice(6, 14)}` : ref);

  return (
    <article className="world-builder__pack" data-status={pack.status}>
      <div className="world-builder__pack-head">
        <div>
          <small>{pack.request.scale} · {pack.request.worldTime} · {pack.status === "adopted" ? "已采纳" : "候选待采用"}</small>
          <h3>{pack.request.focus || pack.request.premise}</h3>
          <p>{pack.document.summary}</p>
        </div>
        <strong>v{pack.version}</strong>
      </div>
      <div className="world-builder__numbers">
        <span>{pack.document.nodes.length} 个对象</span>
        <span>{pack.document.links.length} 条联系</span>
        <span>{pack.document.activities.length} 项自主活动</span>
        <span>{pack.document.interactions?.length ?? 0} 种可执行玩法</span>
      </div>
      {pack.document.production ? (
        <details>
          <summary>程序实际执行的世界生产工序（{pack.document.production.executed.length}）</summary>
          <ul className="world-builder__relations">
            {pack.document.production.executed.map((step,index) => (
              <li key={index}>
                <strong>{step.workshop}</strong>
                {step.subjectRef ? " · " + nodeName(step.subjectRef) : ""}
                ：实际变更 {step.changedRefs.length} 处
              </li>
            ))}
          </ul>
          <p>沙盒试玩产生 {pack.document.production.playtestedPaths.length} 条行动路径（不等于剧情已发生）。</p>
        </details>
      ) : null}
      {(pack.document.interactions?.length ?? 0) > 0 ? (
        <details>
          <summary>实际玩法与取得路径（{pack.document.interactions?.length ?? 0}）</summary>
          <ul className="world-builder__relations">
            {pack.document.interactions?.map((action) => (
              <li key={action.localId}>
                <strong>{action.name}</strong> · {nodeName(action.offeredByRef)}
                ：{action.action}
                <p>前置：{action.requires.length ? action.requires.map(t => t.kind + " · " + nodeName(t.ref)).join("；") : "公开入口"}</p>
                <p>可能取得：{action.yields.map(t => t.kind + " · " + nodeName(t.ref)).join("；")}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <details open={pack.status === "draft"}>
        <summary>地点、势力、人物与高价资源</summary>
        <div className="world-builder__nodes">
          {pack.document.nodes.map((node: WorldPackNode) => (
            <div className="world-builder__node" key={node.localId}>
              <div><small>{node.type} · {node.localId}{node.existingCanonId ? " · 复用旧Canon" : ""}</small><h4>{node.name}</h4></div>
              <p>{node.description}</p>
              {node.value ? <p><b>实际价值：</b>{node.value}</p> : null}
              {node.access ? <p><b>取得 / 进入：</b>{node.access}</p> : null}
              {node.motive ? <p><b>独立意图：</b>{node.motive}</p> : null}
              {node.currentActivity ? <p><b>当前行动：</b>{node.currentActivity}</p> : null}
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary>对象之间的真实关系（{pack.document.links.length}）</summary>
        <ul className="world-builder__relations">
          {pack.document.links.map((link, index) => (
            <li key={index}><strong>{nodeName(link.fromRef)}</strong> · {link.relation} ·
              <strong>{nodeName(link.toRef)}</strong>：{link.description}
              {link.status === "possible" ? "（尚未发生）" : ""}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>人物 / 组织正在推进的事情（{pack.document.activities.length}）</summary>
        <ul className="world-builder__relations">
          {pack.document.activities.map((activity) => (
            <li key={activity.localId}>
              <strong>{activity.actorRefs.map(nodeName).join("、")}</strong>：
              {activity.description}。缘由：{activity.reason}
              {activity.stage === "potential" ? "（可能发生，尚非现实）" : activity.stage === "ended" ? "（这项事务已经结束）" : "（当前正在进行）"}
            </li>
          ))}
        </ul>
      </details>
      {pack.document.dimensionSignals?.length ? <details>
        <summary>世界正在涌现的力量与发展维度</summary>
        <ul className="world-builder__relations">{pack.document.dimensionSignals.map((signal) => <li key={signal.dim}>{signal.dim} · {signal.kind} · {signal.description}</li>)}</ul>
      </details> : null}
      {pack.document.openThreads.length ? <details>
        <summary>以后还能继续打开的世界内容</summary>
        <ul className="world-builder__relations">
          {pack.document.openThreads.map((thread, index) => <li key={index}>{thread}</li>)}
        </ul>
      </details> : null}
      {pack.status === "draft" ? (
        <div className="world-builder__pack-controls">
          <button className="btn" type="button" onClick={() => setEdit((value) => !value)}>
            {edit ? "收起修改" : "修改世界包内容 / 引用（JSON）"}
          </button>
          {edit ? (
            <div className="world-builder__json">
              <p className="world-builder__hint">当前候选生产批次。可改人物、资源、关系、状态；保存前会校验 schema 和引用。采用前不会影响 Reality。</p>
              <textarea aria-label="世界包完整JSON" value={raw} rows={18}
                onChange={(event) => setRaw(event.target.value)} />
              <button className="btn btn--primary" type="button" disabled={save.isPending}
                onClick={saveEdits}>保存世界包修订</button>
              {editError ? <p className="world-builder__validation">{editError}</p> : null}
              {save.isError ? <ErrorNote error={save.error} title="世界包保存失败" /> : null}
            </div>
          ) : null}
          <label className="world-builder__confirm">
            <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)}/>
            我已审阅这批世界对象、关系和当前活动，确认把候选事实采用到 Reality
          </label>
          <button className="btn btn--primary" type="button"
            disabled={!confirm || adoption.isPending}
            onClick={() => adoption.mutate()}>采用本批世界内容（原子提交）</button>
          {adoption.isError ? <ErrorNote error={adoption.error} title="世界包采用失败" /> : null}
        </div>
      ) : (
        <p className="world-builder__hint">此包已采用：{Object.keys(pack.canonIds).length} 个对象映射到统一 Canon ID。可从世界百科查看，也能从这里开启新的 W1。</p>
      )}
    </article>
  );
}
