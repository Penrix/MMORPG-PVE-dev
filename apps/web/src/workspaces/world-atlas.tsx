import "../styles/world-atlas.css";

import {
  WORLD_ATLAS_CARD_TYPES,
  WORLD_ATLAS_CONTENT_FAMILIES,
  WORLD_ATLAS_NARRATIVE_AXIS,
  WORLD_ATLAS_RELATIONS,
  worldAtlasCardTemplate,
  worldAtlasCardType,
  worldAtlasNarrativePriority,
} from "@narralume/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BookOpenText,
  Link2,
  Network,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorNote } from "../components/error-note";
import { PageBand } from "../components/page-band";
import {
  createAtlasCard,
  createAtlasWorld,
  getAtlasCard,
  listAtlasCards,
  listAtlasWorlds,
  reindexAtlasCard,
  updateAtlasCard,
  type AtlasCard,
  type AtlasSourceKind,
  type AtlasSourceWorld,
} from "../lib/api";

const KINDS: Array<{ value: AtlasSourceKind | ""; label: string }> = [
  { value: "", label: "全部类型" },
  ...WORLD_ATLAS_CARD_TYPES.map((entry) => ({
    value: entry.kind,
    label: entry.label,
  })),
];

const RELATION_HINTS = WORLD_ATLAS_RELATIONS.filter(
  (entry, index, all) =>
    index === all.findIndex((candidate) => candidate.relation === entry.relation),
).slice(0, 24);

type Draft = {
  entityKey: string;
  kind: AtlasSourceKind;
  name: string;
  aliases: string;
  content: string;
  isNew: boolean;
};

const emptyDraft = (): Draft => ({
  entityKey: `card:${crypto.randomUUID()}`,
  kind: "character",
  name: "",
  aliases: "",
  content: worldAtlasCardTemplate("character"),
  isNew: true,
});

function draftFromCard(card: AtlasCard): Draft {
  return {
    entityKey: card.record.sourceKey,
    kind: card.record.kind,
    name: card.record.name,
    aliases: card.record.aliases.join("、"),
    content: card.content,
    isNew: false,
  };
}

function aliasesFromText(value: string): string[] {
  return [...new Set(value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

export function WorldAtlasWorkspace() {
  const queryClient = useQueryClient();
  const [worldId, setWorldId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AtlasSourceKind | "">("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [unresolved, setUnresolved] = useState<Array<{ relation: string; target: string }>>([]);
  const [newWorldOpen, setNewWorldOpen] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldKind, setNewWorldKind] = useState<AtlasSourceWorld["kind"]>("fictional");

  const worlds = useQuery({
    queryKey: ["atlas", "worlds"],
    queryFn: ({ signal }) => listAtlasWorlds(signal),
  });

  const activeWorldId = worldId ?? worlds.data?.[0]?.id ?? null;

  const cards = useQuery({
    queryKey: ["atlas", activeWorldId, "cards", query, kind],
    enabled: Boolean(activeWorldId),
    queryFn: ({ signal }) =>
      listAtlasCards(
        activeWorldId!,
        { q: query, ...(kind ? { kind } : {}), limit: 200 },
        signal,
      ),
  });

  const activeSelectedKey = selectedKey ?? cards.data?.[0]?.sourceKey ?? null;

  const card = useQuery({
    queryKey: ["atlas", activeWorldId, "card", activeSelectedKey],
    enabled: Boolean(activeWorldId && activeSelectedKey),
    queryFn: ({ signal }) =>
      getAtlasCard(activeWorldId!, activeSelectedKey!, signal),
  });

  const currentWorld =
    worlds.data?.find((world) => world.id === activeWorldId) ?? null;
  const currentCard = card.data ?? null;
  const activeDraft =
    draft ?? (currentCard ? draftFromCard(currentCard) : null);

  const createWorld = useMutation({
    mutationFn: async () => {
      const name = newWorldName.trim();
      if (!name) throw new Error("请填写世界名称");
      return createAtlasWorld({
        id: `world-${crypto.randomUUID().slice(0, 8)}`,
        name,
        kind: newWorldKind,
        description: "",
      });
    },
    onSuccess: async (world) => {
      await queryClient.invalidateQueries({ queryKey: ["atlas", "worlds"] });
      setWorldId(world.id);
      setSelectedKey(null);
      setDraft(null);
      setNewWorldName("");
      setNewWorldOpen(false);
    },
  });

  const saveCard = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        kind: value.kind,
        name: value.name.trim(),
        aliases: aliasesFromText(value.aliases),
        content: value.content,
      };
      if (!payload.name) throw new Error("卡片名称不能为空");
      if (!payload.content.trim()) throw new Error("卡片正文不能为空");
      return value.isNew
        ? createAtlasCard(activeWorldId!, { entityKey: value.entityKey, ...payload })
        : updateAtlasCard(activeWorldId!, value.entityKey, payload);
    },
    onSuccess: async (result) => {
      setUnresolved(result.unresolvedLinks);
      setSelectedKey(result.card.record.sourceKey);
      setDraft(draftFromCard(result.card));
      await queryClient.invalidateQueries({ queryKey: ["atlas", activeWorldId, "cards"] });
      queryClient.setQueryData(
        ["atlas", activeWorldId, "card", result.card.record.sourceKey],
        result.card,
      );
    },
  });

  const reindex = useMutation({
    mutationFn: () => reindexAtlasCard(activeWorldId!, activeSelectedKey!),
    onSuccess: (result) => {
      setUnresolved(result.unresolvedLinks);
      queryClient.setQueryData(
        ["atlas", activeWorldId, "card", result.card.record.sourceKey],
        result.card,
      );
    },
  });

  const activeCardType = activeDraft
    ? worldAtlasCardType(activeDraft.kind)
    : null;

  const relationGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof currentCard>["relations"]>();
    const relations = [...(currentCard?.relations ?? [])].sort(
      (left, right) =>
        worldAtlasNarrativePriority(left.otherKind) -
          worldAtlasNarrativePriority(right.otherKind) ||
        left.otherName.localeCompare(right.otherName, "zh-CN"),
    );
    for (const relation of relations) {
      const list = groups.get(relation.displayRelation) ?? [];
      list.push(relation);
      groups.set(relation.displayRelation, list);
    }
    return [...groups.entries()].sort(
      ([, left], [, right]) =>
        Math.min(...left.map((item) => worldAtlasNarrativePriority(item.otherKind))) -
        Math.min(...right.map((item) => worldAtlasNarrativePriority(item.otherKind))),
    );
  }, [currentCard]);

  const selectWorld = (id: string) => {
    setWorldId(id);
    setSelectedKey(null);
    setDraft(null);
    setUnresolved([]);
  };

  const newCard = () => {
    setSelectedKey(null);
    setDraft(emptyDraft());
    setUnresolved([]);
  };

  const applySuggestedTemplate = () => {
    if (!activeDraft) return;
    setDraft({
      ...activeDraft,
      content: worldAtlasCardTemplate(
        activeDraft.kind,
        activeDraft.name.trim() || "新卡片",
      ),
    });
  };

  const openRelation = (relation: NonNullable<typeof currentCard>["relations"][number]) => {
    setSelectedKey(relation.direction === "out" ? relation.toKey : relation.fromKey);
    setDraft(null);
    setUnresolved([]);
  };

  return (
    <div className="world-atlas">
      <PageBand
        index="WORLD · ATLAS"
        title="世界资料库"
        meta={<span>{currentWorld?.name ?? "原生母体世界"} · 卡片是资料真相，关系网由卡片自动生成</span>}
      />

      <div className="world-atlas__principle">
        <BookOpenText size={17} />
        <strong>卡片写内容</strong>
        <ArrowLeftRight size={15} />
        <strong>typed links 写关系</strong>
        <ArrowLeftRight size={15} />
        <strong>索引负责反向查询与关系网</strong>
      </div>

      <div className="world-atlas__axes">
        <section>
          <small>World Content Axis · 世界有什么</small>
          <strong>十个 World Family 并排</strong>
          <div>
            {WORLD_ATLAS_CONTENT_FAMILIES.map((family) => (
              <span key={family.id}>{family.label}</span>
            ))}
          </div>
        </section>
        <section>
          <small>Narrative Axis · 故事从哪里发动</small>
          <strong>{WORLD_ATLAS_NARRATIVE_AXIS.label} · People-centered</strong>
          <p>
            人物是默认关系展开与检索中心，但不改变数据库层级。非人物卡的关系网会优先把相关人物与组织放到前面。
          </p>
        </section>
      </div>

      <div className="world-atlas__layout">
        <aside className="world-atlas__worlds">
          <div className="world-atlas__section-head">
            <div>
              <small>母体世界</small>
              <h2>Worlds</h2>
            </div>
            <button className="btn" type="button" onClick={() => setNewWorldOpen((open) => !open)}>
              <Plus size={14} /> 新建
            </button>
          </div>

          {newWorldOpen ? (
            <div className="world-atlas__new-world">
              <input
                value={newWorldName}
                onChange={(event) => setNewWorldName(event.target.value)}
                placeholder="例如：火影忍者原生世界"
              />
              <select
                value={newWorldKind}
                onChange={(event) => setNewWorldKind(event.target.value as AtlasSourceWorld["kind"])}
              >
                <option value="fictional">虚构原作</option>
                <option value="historical">历史世界</option>
                <option value="era">现实年代</option>
                <option value="original_reference">原创参考世界</option>
              </select>
              <button
                type="button"
                className="btn btn--primary"
                disabled={createWorld.isPending || !newWorldName.trim()}
                onClick={() => createWorld.mutate()}
              >
                创建世界
              </button>
              {createWorld.isError ? <ErrorNote error={createWorld.error} title="创建失败" /> : null}
            </div>
          ) : null}

          <div className="world-atlas__world-list">
            {(worlds.data ?? []).map((world) => (
              <button
                key={world.id}
                type="button"
                className="world-atlas__world"
                aria-pressed={world.id === activeWorldId}
                onClick={() => selectWorld(world.id)}
              >
                <strong>{world.name}</strong>
                <span>{world.kind}</span>
              </button>
            ))}
          </div>
          {worlds.isError ? <ErrorNote error={worlds.error} title="读取母体世界失败" /> : null}
          {!worlds.isPending && !worlds.data?.length ? (
            <p className="world-atlas__empty">还没有母体世界。先创建一个，之后所有人物、组织、能力、地点都在里面以卡片存在。</p>
          ) : null}
        </aside>

        <section className="world-atlas__cards">
          <div className="world-atlas__section-head">
            <div>
              <small>世界卡片</small>
              <h2>{currentWorld?.name ?? "Cards"}</h2>
            </div>
            <button className="btn btn--primary" type="button" disabled={!activeWorldId} onClick={newCard}>
              <Plus size={14} /> 新卡片
            </button>
          </div>

          <div className="world-atlas__filters">
            <label>
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人物、组织、能力…" />
            </label>
            <select value={kind} onChange={(event) => setKind(event.target.value as AtlasSourceKind | "")}>
              {KINDS.map((entry) => <option key={entry.value || "all"} value={entry.value}>{entry.label}</option>)}
            </select>
          </div>

          <div className="world-atlas__card-list">
            {(cards.data ?? []).map((entry) => (
              <button
                type="button"
                key={entry.sourceKey}
                aria-pressed={entry.sourceKey === activeSelectedKey}
                className="world-atlas__card-row"
                onClick={() => { setSelectedKey(entry.sourceKey); setDraft(null); setUnresolved([]); }}
              >
                <span className="world-atlas__kind">{KINDS.find((item) => item.value === entry.kind)?.label ?? entry.kind}</span>
                <strong>{entry.name}</strong>
                <small>{entry.summary || "暂无摘要"}</small>
              </button>
            ))}
          </div>
          {cards.isError ? <ErrorNote error={cards.error} title="读取卡片失败" /> : null}
        </section>

        <main className="world-atlas__editor">
          {activeDraft ? (
            <>
              <div className="world-atlas__section-head">
                <div>
                  <small>{activeDraft.isNew ? "新建卡片" : activeDraft.entityKey}</small>
                  <h2>{activeDraft.name || "未命名卡片"}</h2>
                </div>
                <div className="world-atlas__actions">
                  {!activeDraft.isNew ? (
                    <button
                      className="btn"
                      type="button"
                      disabled={reindex.isPending}
                      onClick={() => reindex.mutate()}
                      title="从卡片正文重新生成关系索引"
                    >
                      <RefreshCw size={14} /> 重建索引
                    </button>
                  ) : null}
                  <button
                    className="btn btn--primary"
                    type="button"
                    disabled={!activeWorldId || saveCard.isPending}
                    onClick={() => saveCard.mutate(activeDraft)}
                  >
                    <Save size={14} /> {saveCard.isPending ? "保存中…" : "保存卡片"}
                  </button>
                </div>
              </div>

              <div className="world-atlas__meta">
                {activeDraft.isNew ? (
                  <label>
                    卡片 ID
                    <input value={activeDraft.entityKey} onChange={(event) => setDraft({ ...activeDraft, entityKey: event.target.value })} />
                  </label>
                ) : null}
                <label>
                  名称
                  <input value={activeDraft.name} onChange={(event) => setDraft({ ...activeDraft, name: event.target.value })} />
                </label>
                <label>
                  类型
                  <select value={activeDraft.kind} onChange={(event) => setDraft({ ...activeDraft, kind: event.target.value as AtlasSourceKind })}>
                    {KINDS.filter((entry) => entry.value).map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </select>
                </label>
                <label className="world-atlas__aliases">
                  别名
                  <input
                    value={activeDraft.aliases}
                    onChange={(event) => setDraft({ ...activeDraft, aliases: event.target.value })}
                    placeholder="多个别名用、或逗号分隔"
                  />
                </label>
              </div>

              {activeCardType ? (
                <div className="world-atlas__framework">
                  <div>
                    <strong>{activeCardType.label}</strong>
                    <span>{activeCardType.description}</span>
                  </div>
                  <div className="world-atlas__framework-sections">
                    {activeCardType.templateSections.map((section) => (
                      <span key={section}>{section}</span>
                    ))}
                  </div>
                  <button
                    className="btn"
                    type="button"
                    onClick={applySuggestedTemplate}
                    title="用当前类型的建议章节替换编辑区内容；它只是写作提示，不是强制字段"
                  >
                    填入建议结构
                  </button>
                </div>
              ) : null}

              <div className="world-atlas__link-tip">
                <Link2 size={15} />
                <span>写法示例：<code>老师：[[波风水门]]</code>、<code>所属：[[木叶隐村]]</code>。普通正文里的 <code>[[链接]]</code> 不会自动变成结构化关系。</span>
              </div>

              <div className="world-atlas__relation-hints">
                <small>常用关系词，只是提示；未登记的新关系也允许直接写：</small>
                <div>
                  {RELATION_HINTS.map((entry) => (
                    <code key={entry.relation}>
                      {entry.relation} ↔ {entry.inverse}
                    </code>
                  ))}
                </div>
              </div>

              <textarea
                className="world-atlas__markdown"
                value={activeDraft.content}
                onChange={(event) => setDraft({ ...activeDraft, content: event.target.value })}
                spellCheck={false}
                aria-label="世界卡片 Markdown"
              />

              {saveCard.isError ? <ErrorNote error={saveCard.error} title="卡片保存失败" /> : null}
              {unresolved.length ? (
                <div className="world-atlas__unresolved">
                  <strong>未解析链接</strong>
                  <p>卡片已经保存；这些目标还没有对应卡片，创建后再点“重建索引”即可。</p>
                  {unresolved.map((item) => <code key={`${item.relation}:${item.target}`}>{item.relation} → {item.target}</code>)}
                </div>
              ) : null}

              {!activeDraft.isNew && currentCard ? (
                <section className="world-atlas__relations">
                  <div className="world-atlas__relations-title">
                    <Network size={17} />
                    <div>
                      <strong>一跳关系网</strong>
                      <small>{currentCard.relations.length} 条关系，incoming 已换成当前卡片视角；人物相关节点优先展示</small>
                    </div>
                  </div>
                  <div className="world-atlas__relation-center">{currentCard.record.name}</div>
                  <div className="world-atlas__relation-groups">
                    {relationGroups.map(([label, relations]) => (
                      <div className="world-atlas__relation-group" key={label}>
                        <span>{label}</span>
                        <div>
                          {relations.map((relation) => (
                            <button
                              type="button"
                              key={`${relation.fromKey}:${relation.toKey}:${relation.relation}`}
                              onClick={() => openRelation(relation)}
                            >
                              {relation.otherName}
                              <small>{relation.otherKind}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!currentCard.relations.length ? (
                    <p className="world-atlas__empty">这张卡还没有 typed link。保存一条“关系：[[目标卡]]”以后，这里会自动出现关系。</p>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <div className="world-atlas__welcome">
              <Network size={34} />
              <h2>选一张世界卡，或者新建一张</h2>
              <p>这里不是剧情运行数据库。它只负责把完整世界资料写成卡片，再把卡片之间真正有意义的关系织起来。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
