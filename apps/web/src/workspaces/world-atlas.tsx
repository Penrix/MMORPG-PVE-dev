import "../styles/world-atlas.css";

import {
  WORLD_ATLAS_CARD_TYPES,
  worldAtlasCardTemplate,
  worldAtlasNarrativePriority,
} from "@narralume/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Network,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";

import { ErrorNote } from "../components/error-note";
import {
  createAtlasCard,
  createAtlasWorld,
  getAtlasCard,
  getM03LibraryCard,
  getM03LibraryStats,
  listAtlasCards,
  listAtlasWorlds,
  listM03LibraryCards,
  reindexAtlasCard,
  updateAtlasCard,
  type AtlasCard,
  type AtlasSourceKind,
  type AtlasSourceWorld,
} from "../lib/api";

const CARD_TYPE_LABELS = new Map(
  WORLD_ATLAS_CARD_TYPES.map((entry) => [entry.kind, entry.label] as const),
);

function cardTypeLabel(kind: AtlasSourceKind): string {
  return CARD_TYPE_LABELS.get(kind) ?? kind;
}

const KIND_PRIORITY: AtlasSourceKind[] = [
  "character",
  "location",
  "organization",
  "ability",
  "rule",
  "event",
  "creature",
  "item",
  "position",
  "institution",
  "information",
  "resource",
  "population",
  "activity",
  "technology",
  "work",
  "other",
];

type M03Tier = "all" | "curated" | "coarse" | "market_trend";

const M03_TIERS: Array<{ value: M03Tier; label: string }> = [
  { value: "all", label: "全部" },
  { value: "curated", label: "精编" },
  { value: "coarse", label: "底稿" },
  { value: "market_trend", label: "新书风口" },
];

const M03_TIER_LABELS: Record<string, string> = {
  curated: "精编",
  coarse: "底稿",
  market_trend: "风口",
};

const M03_PAGE_SIZE = 30;

type Draft = {
  entityKey: string;
  kind: AtlasSourceKind;
  name: string;
  aliases: string;
  content: string;
  isNew: boolean;
};

function emptyDraft(): Draft {
  return {
    entityKey: `card:${crypto.randomUUID()}`,
    kind: "character",
    name: "",
    aliases: "",
    content: worldAtlasCardTemplate("character"),
    isNew: true,
  };
}

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
  return [...new Set(value.split(/[、,，\n]/u).map((item) => item.trim()).filter(Boolean))];
}

function formatCount(value: number): string {
  return value.toLocaleString("zh-CN");
}

/* 关系行：`所属：[[木叶隐村]]`，从正文抽取后单独进入关系面板。 */
const RELATION_LINE = /^([^\s#>\-*][^:：]{0,15})\s*[:：]\s*\[\[([^\]]+)\]\]\s*$/u;

/* Reader 模式剥离重复的一级标题和关系行，只留百科正文。 */
function extractProse(content: string): string {
  const kept: string[] = [];
  let headingStripped = false;
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!headingStripped && /^#\s+/u.test(line)) {
      headingStripped = true;
      continue;
    }
    if (RELATION_LINE.test(line)) continue;
    kept.push(rawLine);
  }
  return kept.join("\n").trim();
}

type ProseBlock =
  | { kind: "h2" | "h3" | "quote" | "p"; text: string }
  | { kind: "ul"; items: string[] };

function toProseBlocks(markdown: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join("\n").trim();
    if (text) blocks.push({ kind: "p", text });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "ul", items: [...list] });
    list = [];
  };

  for (const rawLine of markdown.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{2,6})\s+(.*)$/u.exec(line);
    if (heading) {
      const [, hashes = "##", text = ""] = heading;
      flushParagraph();
      flushList();
      blocks.push({ kind: hashes.length <= 3 ? "h2" : "h3", text });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/u.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1] ?? "");
      continue;
    }
    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "quote", text: line.replace(/^>\s?/u, "") });
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

const INLINE_TOKEN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*/gu;

function renderInline(text: string, onJump: (name: string) => void): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    if (match[1]) {
      const target = match[1];
      nodes.push(
        <button
          className="world-atlas__inline-link"
          key={`link-${index}-${target}`}
          type="button"
          onClick={() => onJump(target)}
        >
          {match[2] ?? target}
        </button>,
      );
    } else {
      nodes.push(<strong key={`bold-${index}`}>{match[3]}</strong>);
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function CardProse({
  markdown,
  onJump,
}: {
  markdown: string;
  onJump: (name: string) => void;
}) {
  const blocks = useMemo(() => toProseBlocks(markdown), [markdown]);

  if (!blocks.length) {
    return <p className="world-atlas__muted">这张卡还没有正文。</p>;
  }

  return (
    <div className="world-atlas__prose">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === "ul") {
          return (
            <ul key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, onJump)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "quote") {
          return <blockquote key={key}>{renderInline(block.text, onJump)}</blockquote>;
        }
        if (block.kind === "h2") {
          return <h3 key={key}>{renderInline(block.text, onJump)}</h3>;
        }
        if (block.kind === "h3") {
          return <h4 key={key}>{renderInline(block.text, onJump)}</h4>;
        }
        return <p key={key}>{renderInline(block.text, onJump)}</p>;
      })}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const tone =
    tier === "curated" ? "curated" : tier === "market_trend" ? "trend" : "coarse";
  return (
    <span className={`world-atlas__badge world-atlas__badge--${tone}`}>
      {M03_TIER_LABELS[tier] ?? tier}
    </span>
  );
}

export function WorldAtlasWorkspace() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"atlas" | "m03">("atlas");

  const [worldId, setWorldId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AtlasSourceKind | "">("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [unresolved, setUnresolved] = useState<Array<{ relation: string; target: string }>>([]);
  const [newWorldOpen, setNewWorldOpen] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldKind, setNewWorldKind] = useState<AtlasSourceWorld["kind"]>("fictional");

  const [m03Query, setM03Query] = useState("");
  const deferredM03Query = useDeferredValue(m03Query);
  const [m03Tier, setM03Tier] = useState<M03Tier>("all");
  const [m03Type, setM03Type] = useState("all");
  const [m03Page, setM03Page] = useState(0);
  const [m03SelectedId, setM03SelectedId] = useState<string | null>(null);

  const worlds = useQuery({
    queryKey: ["atlas", "worlds"],
    queryFn: ({ signal }) => listAtlasWorlds(signal),
  });

  const activeWorldId = worldId ?? worlds.data?.[0]?.id ?? null;

  const cards = useQuery({
    queryKey: ["atlas", activeWorldId, "cards", query],
    enabled: Boolean(activeWorldId),
    queryFn: ({ signal }) =>
      listAtlasCards(activeWorldId!, { q: query, limit: 200 }, signal),
  });

  const cardCount = useQuery({
    queryKey: ["atlas", activeWorldId, "card-count"],
    enabled: Boolean(activeWorldId) && query.trim().length > 0,
    staleTime: 60_000,
    queryFn: ({ signal }) => listAtlasCards(activeWorldId!, { limit: 200 }, signal),
  });

  const visibleCards = useMemo(
    () => (cards.data ?? []).filter((entry) => !kind || entry.kind === kind),
    [cards.data, kind],
  );

  const kindFacets = useMemo(() => {
    const counts = new Map<AtlasSourceKind, number>();
    for (const entry of cards.data ?? []) {
      counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
    }
    const ordered = [...KIND_PRIORITY, ...counts.keys()].filter(
      (value, index, all) => all.indexOf(value) === index,
    );
    const facets = ordered
      .map((value) => ({ value, label: cardTypeLabel(value), count: counts.get(value) ?? 0 }))
      .filter((facet) => facet.count > 0)
      .slice(0, 10);

    if (kind && !facets.some((facet) => facet.value === kind)) {
      facets.unshift({ value: kind, label: cardTypeLabel(kind), count: counts.get(kind) ?? 0 });
    }
    return facets;
  }, [cards.data, kind]);

  const activeSelectedKey =
    selectedKey && visibleCards.some((entry) => entry.sourceKey === selectedKey)
      ? selectedKey
      : (visibleCards[0]?.sourceKey ?? null);

  const card = useQuery({
    queryKey: ["atlas", activeWorldId, "card", activeSelectedKey],
    enabled: Boolean(activeWorldId && activeSelectedKey),
    queryFn: ({ signal }) => getAtlasCard(activeWorldId!, activeSelectedKey!, signal),
  });

  const currentWorld =
    worlds.data?.find((world) => world.id === activeWorldId) ?? null;
  const currentCard = card.data ?? null;
  const worldCardCount = query.trim() ? cardCount.data?.length : cards.data?.length;

  const cardKeyByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of cards.data ?? []) map.set(entry.name, entry.sourceKey);
    return map;
  }, [cards.data]);

  const relationGroups = useMemo(() => {
    const groups = new Map<string, AtlasCard["relations"]>();
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
      ([labelA, left], [labelB, right]) =>
        Math.min(...left.map((item) => worldAtlasNarrativePriority(item.otherKind))) -
          Math.min(...right.map((item) => worldAtlasNarrativePriority(item.otherKind))) ||
        labelA.localeCompare(labelB, "zh-CN"),
    );
  }, [currentCard]);

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
      const savedKey = result.card.record.sourceKey;
      setUnresolved(result.unresolvedLinks);
      setSelectedKey(savedKey);
      setDraft(null);
      setKind("");
      setQuery("");
      queryClient.setQueryData(["atlas", activeWorldId, "card", savedKey], result.card);
      await queryClient.invalidateQueries({ queryKey: ["atlas", activeWorldId, "cards"] });
      await queryClient.invalidateQueries({ queryKey: ["atlas", activeWorldId, "card-count"] });
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

  const m03Stats = useQuery({
    queryKey: ["m03", "stats"],
    queryFn: ({ signal }) => getM03LibraryStats(signal),
  });

  const m03List = useQuery({
    queryKey: ["m03", "cards", deferredM03Query, m03Tier, m03Type, m03Page],
    queryFn: ({ signal }) =>
      listM03LibraryCards(
        {
          ...(deferredM03Query.trim() ? { q: deferredM03Query.trim() } : {}),
          ...(m03Tier !== "all" ? { tier: m03Tier } : {}),
          ...(m03Type !== "all" ? { type: m03Type } : {}),
          limit: M03_PAGE_SIZE,
          offset: m03Page * M03_PAGE_SIZE,
        },
        signal,
      ),
  });

  const m03Total = m03List.data?.total ?? 0;
  const m03PageCount = Math.max(1, Math.ceil(m03Total / M03_PAGE_SIZE));
  const activeM03Id =
    m03SelectedId && m03List.data?.cards.some((entry) => entry.id === m03SelectedId)
      ? m03SelectedId
      : (m03List.data?.cards[0]?.id ?? null);

  const m03Card = useQuery({
    queryKey: ["m03", "card", activeM03Id],
    enabled: Boolean(activeM03Id),
    queryFn: ({ signal }) => getM03LibraryCard(activeM03Id!, signal),
  });

  const selectWorld = (id: string) => {
    setWorldId(id);
    setSelectedKey(null);
    setDraft(null);
    setUnresolved([]);
  };

  const selectCard = (sourceKey: string) => {
    setSelectedKey(sourceKey);
    setDraft(null);
    setUnresolved([]);
  };

  const jumpToCard = (nameOrKey: string) => {
    setKind("");
    setQuery("");
    selectCard(cardKeyByName.get(nameOrKey) ?? nameOrKey);
  };

  const startEdit = () => {
    if (!currentCard) return;
    setDraft(draftFromCard(currentCard));
    setUnresolved([]);
  };

  const startNewCard = () => {
    setSelectedKey(null);
    setDraft(emptyDraft());
    setUnresolved([]);
  };

  const cancelEdit = () => {
    setDraft(null);
    setUnresolved([]);
  };

  const changeM03Query = (value: string) => {
    setM03Query(value);
    setM03Page(0);
  };

  const changeM03Tier = (value: M03Tier) => {
    setM03Tier(value);
    setM03Page(0);
  };

  const changeM03Type = (value: string) => {
    setM03Type(value);
    setM03Page(0);
  };

  const byTier = m03Stats.data?.byTier ?? {};
  const tierCount = (tier: M03Tier) =>
    tier === "all" ? (m03Stats.data?.total ?? 0) : (byTier[tier] ?? 0);
  const m03Types = m03Stats.data?.types ?? [];

  return (
    <div className="world-atlas">
      <header className="world-atlas__topbar">
        <div className="world-atlas__tabs" role="tablist" aria-label="第二模块视图">
          <button
            className="world-atlas__tab"
            type="button"
            role="tab"
            aria-selected={tab === "atlas"}
            onClick={() => setTab("atlas")}
          >
            世界资料库
            <span className="world-atlas__tab-meta">
              {currentWorld
                ? `${currentWorld.name} · ${worldCardCount === undefined ? "…" : formatCount(worldCardCount)} 张`
                : "尚未建立母体世界"}
            </span>
          </button>
          <button
            className="world-atlas__tab"
            type="button"
            role="tab"
            aria-selected={tab === "m03"}
            onClick={() => setTab("m03")}
          >
            M03 素材库
            <span className="world-atlas__tab-meta">
              {m03Stats.isPending ? "读取中…" : `${formatCount(m03Stats.data?.total ?? 0)} 张`}
            </span>
          </button>
        </div>

        {tab === "atlas" ? (
          <div className="world-atlas__toolbar">
            <select
              className="world-atlas__select"
              aria-label="切换母体世界"
              value={activeWorldId ?? ""}
              onChange={(event) => selectWorld(event.target.value)}
              disabled={!worlds.data?.length}
            >
              {!worlds.data?.length ? <option value="">尚无母体世界</option> : null}
              {(worlds.data ?? []).map((world) => (
                <option key={world.id} value={world.id}>
                  {world.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              type="button"
              aria-expanded={newWorldOpen}
              onClick={() => setNewWorldOpen((open) => !open)}
            >
              <Plus size={14} /> 新建世界
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!activeWorldId}
              onClick={startNewCard}
            >
              <Plus size={14} /> 新卡片
            </button>
          </div>
        ) : null}
      </header>

      {tab === "atlas" && newWorldOpen ? (
        <div className="world-atlas__newworld">
          <input
            value={newWorldName}
            onChange={(event) => setNewWorldName(event.target.value)}
            placeholder="例如：火影忍者（完整母体世界）"
            aria-label="世界名称"
          />
          <select
            value={newWorldKind}
            aria-label="世界类型"
            onChange={(event) => setNewWorldKind(event.target.value as AtlasSourceWorld["kind"])}
          >
            <option value="fictional">虚构原作</option>
            <option value="historical">历史世界</option>
            <option value="era">现实年代</option>
            <option value="original_reference">原创参考世界</option>
          </select>
          <button
            className="btn btn--primary"
            type="button"
            disabled={createWorld.isPending || !newWorldName.trim()}
            onClick={() => createWorld.mutate()}
          >
            创建世界
          </button>
          <button className="btn" type="button" onClick={() => setNewWorldOpen(false)}>
            取消
          </button>
          {createWorld.isError ? <ErrorNote error={createWorld.error} title="创建失败" /> : null}
        </div>
      ) : null}

      {tab === "atlas" ? (
        <div className="world-atlas__split">
          <aside className="world-atlas__directory">
            <div className="world-atlas__directory-head">
              <label className="world-atlas__search">
                <Search size={14} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索卡片名称、别名或关键词…"
                  aria-label="搜索世界卡片"
                />
              </label>
              <div className="world-atlas__pills">
                <button
                  className="world-atlas__pill"
                  type="button"
                  aria-pressed={kind === ""}
                  onClick={() => setKind("")}
                >
                  全部
                  <span className="world-atlas__pill-count">
                    {formatCount(cards.data?.length ?? 0)}
                  </span>
                </button>
                {kindFacets.map((facet) => (
                  <button
                    className="world-atlas__pill"
                    key={facet.value}
                    type="button"
                    aria-pressed={kind === facet.value}
                    onClick={() => setKind(facet.value)}
                  >
                    {facet.label}
                    <span className="world-atlas__pill-count">{formatCount(facet.count)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="world-atlas__list">
              {cards.isPending ? <p className="world-atlas__hint">读取卡片…</p> : null}
              {!cards.isPending && !visibleCards.length ? (
                <p className="world-atlas__hint">
                  {cards.data?.length ? "没有符合筛选的卡片。" : "这个世界还没有卡片。"}
                </p>
              ) : null}
              {visibleCards.map((entry) => (
                <button
                  className="world-atlas__row"
                  key={entry.sourceKey}
                  type="button"
                  aria-pressed={entry.sourceKey === activeSelectedKey}
                  onClick={() => selectCard(entry.sourceKey)}
                >
                  <strong className="world-atlas__row-name">{entry.name}</strong>
                  <span className="world-atlas__row-badge">{cardTypeLabel(entry.kind)}</span>
                  <small className="world-atlas__row-summary">{entry.summary || "暂无摘要"}</small>
                </button>
              ))}
              {cards.isError ? <ErrorNote error={cards.error} title="读取卡片失败" /> : null}
            </div>

            <footer className="world-atlas__listfoot">
              {formatCount(visibleCards.length)} 张
              {kind || query.trim() ? "（筛选后）" : ""}
            </footer>
          </aside>

          <section className="world-atlas__stage">
            {draft ? (
              <div className="world-atlas__edit">
                <header className="world-atlas__stage-head">
                  <div>
                    <small className="world-atlas__kicker">
                      {draft.isNew ? "新建卡片" : "编辑卡片"}
                    </small>
                    <h1 className="world-atlas__title">{draft.name.trim() || "未命名卡片"}</h1>
                  </div>
                  <button
                    className="world-atlas__icon-btn"
                    type="button"
                    aria-label="取消编辑"
                    onClick={cancelEdit}
                  >
                    <X size={16} />
                  </button>
                </header>

                <div className="world-atlas__meta">
                  <label className="world-atlas__field">
                    名称
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                  </label>
                  <label className="world-atlas__field">
                    类型
                    <select
                      value={draft.kind}
                      onChange={(event) =>
                        setDraft({ ...draft, kind: event.target.value as AtlasSourceKind })
                      }
                    >
                      {WORLD_ATLAS_CARD_TYPES.map((entry) => (
                        <option key={entry.kind} value={entry.kind}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="world-atlas__field">
                    别名
                    <input
                      value={draft.aliases}
                      onChange={(event) => setDraft({ ...draft, aliases: event.target.value })}
                      placeholder="多个别名用、或逗号分隔"
                    />
                  </label>
                  {draft.isNew ? (
                    <label className="world-atlas__field world-atlas__field--wide">
                      卡片 ID
                      <input
                        value={draft.entityKey}
                        onChange={(event) => setDraft({ ...draft, entityKey: event.target.value })}
                      />
                    </label>
                  ) : null}
                </div>

                <textarea
                  className="world-atlas__markdown"
                  value={draft.content}
                  onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                  spellCheck={false}
                  aria-label="世界卡片 Markdown"
                />

                <details className="world-atlas__help">
                  <summary>关系链接语法提示</summary>
                  <p>
                    在正文中单独一行写 <code>关系名：[[目标卡片名]]</code>，例如{" "}
                    <code>所属：[[木叶隐村]]</code>、<code>老师：[[波风水门]]</code>
                    。保存或重建索引后会自动生成关系网。
                  </p>
                </details>

                <div className="world-atlas__editfoot">
                  <button
                    className="btn btn--primary"
                    type="button"
                    disabled={!activeWorldId || saveCard.isPending}
                    onClick={() => saveCard.mutate(draft)}
                  >
                    <Save size={14} /> {saveCard.isPending ? "保存中…" : "保存卡片"}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    disabled={saveCard.isPending}
                    onClick={cancelEdit}
                  >
                    取消
                  </button>
                </div>

                {saveCard.isError ? <ErrorNote error={saveCard.error} title="卡片保存失败" /> : null}
                {unresolved.length ? (
                  <div className="world-atlas__unresolved">
                    <strong>未解析链接</strong>
                    <p>卡片已经保存；这些目标还没有对应卡片，建好后点「重建索引」即可。</p>
                    <div>
                      {unresolved.map((item) => (
                        <code key={`${item.relation}:${item.target}`}>
                          {item.relation} → {item.target}
                        </code>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : currentCard ? (
              <article className="world-atlas__reader">
                <header className="world-atlas__stage-head">
                  <div className="world-atlas__stage-title">
                    <div className="world-atlas__headline">
                      <h1 className="world-atlas__title">{currentCard.record.name}</h1>
                      <span className="world-atlas__badge">
                        {cardTypeLabel(currentCard.record.kind)}
                      </span>
                    </div>
                    {currentCard.record.aliases.length ? (
                      <div className="world-atlas__aliases">
                        {currentCard.record.aliases.map((alias) => (
                          <span className="world-atlas__alias" key={alias}>
                            {alias}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="world-atlas__stage-actions">
                    <button className="btn" type="button" onClick={startEdit}>
                      编辑
                    </button>
                    <button
                      className="world-atlas__icon-btn"
                      type="button"
                      title="从卡片正文重新生成关系索引"
                      aria-label="重建索引"
                      disabled={reindex.isPending}
                      onClick={() => reindex.mutate()}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </header>

                {reindex.isError ? <ErrorNote error={reindex.error} title="重建索引失败" /> : null}
                {unresolved.length ? (
                  <div className="world-atlas__unresolved world-atlas__unresolved--inline">
                    <strong>未解析链接</strong>
                    <div>
                      {unresolved.map((item) => (
                        <code key={`${item.relation}:${item.target}`}>
                          {item.relation} → {item.target}
                        </code>
                      ))}
                    </div>
                  </div>
                ) : null}

                <CardProse markdown={extractProse(currentCard.content)} onJump={jumpToCard} />

                <section className="world-atlas__relations">
                  <div className="world-atlas__relations-head">
                    <Network size={15} />
                    <h2>关系图谱 / 关联卡片</h2>
                    <span>{currentCard.relations.length} 条</span>
                  </div>
                  {relationGroups.length ? (
                    <div className="world-atlas__relation-groups">
                      {relationGroups.map(([label, relations]) => (
                        <div className="world-atlas__relation-group" key={label}>
                          <span className="world-atlas__relation-label">{label}</span>
                          <div className="world-atlas__relation-links">
                            {relations.map((relation) => (
                              <button
                                className="world-atlas__relation-link"
                                key={`${relation.fromKey}:${relation.toKey}:${relation.relation}`}
                                type="button"
                                onClick={() =>
                                  selectCard(
                                    relation.direction === "out"
                                      ? relation.toKey
                                      : relation.fromKey,
                                  )
                                }
                              >
                                {relation.otherName}
                                <span>{cardTypeLabel(relation.otherKind)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="world-atlas__muted">
                      这张卡还没有 typed link。在正文里写一行「关系名：[[目标卡]]」并保存即可生成。
                    </p>
                  )}
                </section>
              </article>
            ) : (
              <>
                {worlds.isError ? (
                  <ErrorNote error={worlds.error} title="读取母体世界失败" />
                ) : null}
                <div className="world-atlas__blank">
                  <BookOpenText size={30} />
                  <h2>
                    {worlds.isPending
                      ? "正在读取母体世界…"
                      : activeWorldId
                        ? "这个世界还没有可读的卡片"
                        : "先建立一个母体世界"}
                  </h2>
                  <p>
                    {activeWorldId
                      ? "从右侧新卡片开始：人物、地点、组织、能力、规则——每一张都是一条可检索的世界资料。"
                      : "世界资料库把完整母体世界写成卡片，再把卡片之间真正有意义的关系织起来。"}
                  </p>
                  {worlds.isPending ? null : activeWorldId ? (
                    <button className="btn btn--primary" type="button" onClick={startNewCard}>
                      <Plus size={14} /> 新卡片
                    </button>
                  ) : (
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={() => setNewWorldOpen(true)}
                    >
                      <Plus size={14} /> 新建世界
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="world-atlas__split">
          <aside className="world-atlas__directory">
            <div className="world-atlas__directory-head">
              <label className="world-atlas__search">
                <Search size={14} />
                <input
                  value={m03Query}
                  onChange={(event) => changeM03Query(event.target.value)}
                  placeholder="搜索 M03 素材（如：写轮眼、打脸、信息差、金手指）…"
                  aria-label="搜索 M03 素材"
                />
              </label>

              <div className="world-atlas__pills">
                {M03_TIERS.map((tier) => (
                  <button
                    className="world-atlas__pill"
                    key={tier.value}
                    type="button"
                    aria-pressed={m03Tier === tier.value}
                    onClick={() => changeM03Tier(tier.value)}
                  >
                    {tier.label}
                    <span className="world-atlas__pill-count">
                      {m03Stats.isPending ? "…" : formatCount(tierCount(tier.value))}
                    </span>
                  </button>
                ))}
              </div>

              <select
                className="world-atlas__select world-atlas__select--block"
                aria-label="按素材类型筛选"
                value={m03Type}
                onChange={(event) => changeM03Type(event.target.value)}
              >
                <option value="all">
                  全部类型 ({formatCount(m03Stats.data?.total ?? 0)})
                </option>
                {m03Types.map((entry) => (
                  <option key={entry.type} value={entry.type}>
                    {entry.type} ({formatCount(entry.count)})
                  </option>
                ))}
              </select>

              {m03Stats.isError ? (
                <ErrorNote error={m03Stats.error} title="读取素材统计失败" />
              ) : null}
            </div>

            <div className="world-atlas__list">
              {m03List.isPending ? <p className="world-atlas__hint">检索素材…</p> : null}
              {!m03List.isPending && !m03List.data?.cards.length ? (
                <p className="world-atlas__hint">没有匹配的 M03 素材。</p>
              ) : null}
              {(m03List.data?.cards ?? []).map((entry) => (
                <button
                  className="world-atlas__row world-atlas__row--m03"
                  key={entry.id}
                  type="button"
                  aria-pressed={entry.id === activeM03Id}
                  onClick={() => setM03SelectedId(entry.id)}
                >
                  <strong className="world-atlas__row-name">{entry.name}</strong>
                  <span className="world-atlas__row-badge">
                    <TierBadge tier={entry.curationTier} />
                  </span>
                  <small className="world-atlas__row-id">{entry.materialId}</small>
                  <small className="world-atlas__row-summary">{entry.summary || "暂无摘要"}</small>
                </button>
              ))}
              {m03List.isError ? <ErrorNote error={m03List.error} title="检索失败" /> : null}
            </div>

            <footer className="world-atlas__pager">
              <button
                className="world-atlas__page-btn"
                type="button"
                disabled={m03Page <= 0}
                onClick={() => setM03Page((page) => Math.max(0, page - 1))}
              >
                <ChevronLeft size={14} /> 上一页
              </button>
              <span>
                {m03Page + 1} / {m03PageCount}
              </span>
              <button
                className="world-atlas__page-btn"
                type="button"
                disabled={m03Page + 1 >= m03PageCount}
                onClick={() => setM03Page((page) => page + 1)}
              >
                下一页 <ChevronRight size={14} />
              </button>
            </footer>
          </aside>

          <section className="world-atlas__stage">
            {m03Card.isPending && activeM03Id ? (
              <p className="world-atlas__hint">读取素材卡片…</p>
            ) : null}
            {m03Card.isError ? (
              <ErrorNote error={m03Card.error} title="读取素材卡片失败" />
            ) : null}
            {!activeM03Id && !m03List.isPending ? (
              <div className="world-atlas__blank">
                <BookOpenText size={30} />
                <h2>没有可读的素材</h2>
                <p>换一个搜索词或筛选条件，素材库包含全部 5,519 张 M03 卡片。</p>
              </div>
            ) : null}
            {m03Card.data ? (
              <article className="world-atlas__reader world-atlas__reader--m03">
                <header className="world-atlas__stage-head">
                  <div className="world-atlas__stage-title">
                    <div className="world-atlas__headline">
                      <h1 className="world-atlas__title">{m03Card.data.name}</h1>
                      <TierBadge tier={m03Card.data.curationTier} />
                    </div>
                    <div className="world-atlas__m03meta">
                      <code>{m03Card.data.materialId}</code>
                      <span>{m03Card.data.materialType}</span>
                      <span>趋势权重 {m03Card.data.trendWeight}</span>
                    </div>
                    {m03Card.data.tags.length ? (
                      <div className="world-atlas__aliases">
                        {m03Card.data.tags.map((tag) => (
                          <span className="world-atlas__alias" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </header>

                <section className="world-atlas__section">
                  <h2>摘要</h2>
                  <p>{m03Card.data.summary || "暂无摘要。"}</p>
                </section>

                <section className="world-atlas__section">
                  <h2>适用召回问题</h2>
                  {m03Card.data.callWhen.length ? (
                    <ul className="world-atlas__callwhen">
                      {m03Card.data.callWhen.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="world-atlas__muted">暂无召回条件。</p>
                  )}
                </section>

                <section className="world-atlas__section">
                  <h2>卡片正文</h2>
                  <div className="world-atlas__m03body">
                    {m03Card.data.content?.trim() ? m03Card.data.content : "暂无正文。"}
                  </div>
                </section>
              </article>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
