import "../styles/world-atlas.css";

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
import { useEffect, useMemo, useState } from "react";

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
  { value: "character", label: "人物" },
  { value: "organization", label: "组织" },
  { value: "location", label: "地点" },
  { value: "ability", label: "能力" },
  { value: "item", label: "物品" },
  { value: "event", label: "事件" },
  { value: "creature", label: "生物" },
  { value: "other", label: "其他" },
];

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
  content: "# 新卡片\n\n",
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

  useEffect(() => {
    if (!worldId && worlds.data?.length) setWorldId(worlds.data[0]!.id);
  }, [worldId, worlds.data]);

  const cards = useQuery({
    queryKey: ["atlas", worldId, "cards", query, kind],
    enabled: Boolean(worldId),
    queryFn: ({ signal }) =>
      listAtlasCards(
        worldId!,
        { q: query, ...(kind ? { kind } : {}), limit: 200 },
        signal,
      ),
  });

  const card = useQuery({
    queryKey: ["atlas", worldId, "card", selectedKey],
    enabled: Boolean(worldId && selectedKey),
    queryFn: ({ signal }) => getAtlasCard(worldId!, selectedKey!, signal),
  });

  useEffect(() => {
    if (card.data) {
      setDraft(draftFromCard(card.data));
      setUnresolved([]);
    }
  }, [card.data]);

  useEffect(() => {
    if (!selectedKey && cards.data?.length) setSelectedKey(cards.data[0]!.sourceKey);
  }, [cards.data, selectedKey]);

  const currentWorld = worlds.data?.find((world) => world.id === worldId) ?? null;
  const currentCard = card.data ?? null;

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
        ? createAtlasCard(worldId!, { entityKey: value.entityKey, ...payload })
        : updateAtlasCard(worldId!, value.entityKey, payload);
    },
    onSuccess: async (result) => {
      setUnresolved(result.unresolvedLinks);
      setSelectedKey(result.card.record.sourceKey);
      setDraft(draftFromCard(result.card));
      await queryClient.invalidateQueries({ queryKey: ["atlas", worldId, "cards"] });
      queryClient.setQueryData(
        ["atlas", worldId, "card", result.card.record.sourceKey],
        result.card,
      );
    },
  });

  const reindex = useMutation({
    mutationFn: () => reindexAtlasCard(worldId!, selectedKey!),
    onSuccess: (result) => {
      setUnresolved(result.unresolvedLinks);
      queryClient.setQueryData(
        ["atlas", worldId, "card", result.card.record.sourceKey],
        result.card,
      );
    },
  });

  const relationGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof currentCard>["relations"]>();
    for (const relation of currentCard?.relations ?? []) {
      const list = groups.get(relation.displayRelation) ?? [];
      list.push(relation);
      groups.set(relation.displayRelation, list);
    }
    return [...groups.entries()];
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

  const openRelation = (relation: NonNullable<typeof currentCard>["relations"][number]) => {
    setSelectedKey(relation.direction === "out" ? relation.toKey : relation.fromKey);
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
                aria-pressed={world.id === worldId}
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
            <button className="btn btn--primary" type="button" disabled={!worldId} onClick={newCard}>
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
                aria-pressed={entry.sourceKey === selectedKey}
                className="world-atlas__card-row"
                onClick={() => setSelectedKey(entry.sourceKey)}
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
          {draft ? (
            <>
              <div className="world-atlas__section-head">
                <div>
                  <small>{draft.isNew ? "新建卡片" : draft.entityKey}</small>
                  <h2>{draft.name || "未命名卡片"}</h2>
                </div>
                <div className="world-atlas__actions">
                  {!draft.isNew ? (
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
                    disabled={!worldId || saveCard.isPending}
                    onClick={() => saveCard.mutate(draft)}
                  >
                    <Save size={14} /> {saveCard.isPending ? "保存中…" : "保存卡片"}
                  </button>
                </div>
              </div>

              <div className="world-atlas__meta">
                {draft.isNew ? (
                  <label>
                    卡片 ID
                    <input value={draft.entityKey} onChange={(event) => setDraft({ ...draft, entityKey: event.target.value })} />
                  </label>
                ) : null}
                <label>
                  名称
                  <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </label>
                <label>
                  类型
                  <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AtlasSourceKind })}>
                    {KINDS.filter((entry) => entry.value).map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </select>
                </label>
                <label className="world-atlas__aliases">
                  别名
                  <input
                    value={draft.aliases}
                    onChange={(event) => setDraft({ ...draft, aliases: event.target.value })}
                    placeholder="多个别名用、或逗号分隔"
                  />
                </label>
              </div>

              <div className="world-atlas__link-tip">
                <Link2 size={15} />
                <span>写法示例：<code>老师：[[波风水门]]</code>、<code>所属：[[木叶隐村]]</code>。普通正文里的 <code>[[链接]]</code> 不会自动变成结构化关系。</span>
              </div>

              <textarea
                className="world-atlas__markdown"
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
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

              {!draft.isNew && currentCard ? (
                <section className="world-atlas__relations">
                  <div className="world-atlas__relations-title">
                    <Network size={17} />
                    <div>
                      <strong>一跳关系网</strong>
                      <small>{currentCard.relations.length} 条关系，incoming 已自动换成当前卡片视角</small>
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
