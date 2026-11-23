import "../styles/inspiration-slots.css";

import type {
  InspirationChannel,
  InspirationSeedCard,
  InspirationSlotItem,
  InspirationSlotKey,
  InspirationRollResponse,
} from "@narralume/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, LockKeyholeOpen, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import {
  apiErrorMessage,
  createProjectFromInspiration,
  getInspirationCatalog,
  rollInspirationSeeds,
} from "../lib/api";

const SLOT_KEYS: InspirationSlotKey[] = [
  "identity",
  "anomalyRule",
  "highValueCircle",
  "twistPressure",
];
const SLOT_LABELS: Record<InspirationSlotKey, string> = {
  identity: "① 身份",
  anomalyRule: "② 异常规则",
  highValueCircle: "③ 高价圈层",
  twistPressure: "④ 反转压力",
};
const CHANNELS: Array<{ value: InspirationChannel; label: string }> = [
  { value: "male", label: "男频" },
  { value: "hybrid", label: "混合" },
  { value: "female", label: "女频" },
];
type LockedSlots = Partial<Record<InspirationSlotKey, InspirationSlotItem>>;

export function InspirationSlotsWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<InspirationChannel>("male");
  const [keyword, setKeyword] = useState("");
  const [useM03, setUseM03] = useState(true);
  const [lockedSlots, setLockedSlots] = useState<LockedSlots>({});
  const [result, setResult] = useState<InspirationRollResponse | null>(null);
  const [catalogStats, setCatalogStats] = useState<{ slotBankCount: number; m03Count: number } | null>(null);
  const [rolling, setRolling] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);

  const roll = useCallback(async (
    nextChannel: InspirationChannel,
    nextM03: boolean,
    nextLocks: LockedSlots,
    nextKeyword: string,
  ) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const sequence = ++sequenceRef.current;
    setRolling(true);
    setError(null);
    try {
      const response = await rollInspirationSeeds({
        channel: nextChannel,
        count: 6,
        keyword: nextKeyword.trim() || undefined,
        useM03: nextM03,
        lockedSlots: nextLocks,
      }, controller.signal);
      if (mountedRef.current && sequenceRef.current === sequence) setResult(response);
    } catch (cause) {
      if (!controller.signal.aborted && mountedRef.current && sequenceRef.current === sequence) {
        setError(apiErrorMessage(cause));
      }
    } finally {
      if (mountedRef.current && sequenceRef.current === sequence) setRolling(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void getInspirationCatalog({}, controller.signal)
      .then((catalog) => {
        if (!controller.signal.aborted) setCatalogStats(catalog.poolStats);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(cause));
      });
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return roll("male", true, {}, "");
    });
    return () => {
      mountedRef.current = false;
      controller.abort();
      requestRef.current?.abort();
    };
  }, [roll]);

  const onRoll = (event?: FormEvent) => {
    event?.preventDefault();
    void roll(channel, useM03, lockedSlots, keyword);
  };
  const changeChannel = (next: InspirationChannel) => {
    if (next === channel) return;
    setChannel(next);
    // Locked phrases are channel-specific; never send incompatible cards.
    setLockedSlots({});
    void roll(next, useM03, {}, keyword);
  };
  const toggleSlot = (slot: InspirationSlotKey, item: InspirationSlotItem) => {
    setLockedSlots((current) => {
      if (current[slot]?.id === item.id) {
        const next = { ...current };
        delete next[slot];
        return next;
      }
      // A different card's phrase replaces the current lock for this slot.
      if (!current[slot] && Object.keys(current).length >= 3) return current;
      return { ...current, [slot]: item };
    });
  };
  const createBook = async (card: InspirationSeedCard) => {
    if (creatingId) return;
    setCreatingId(card.id);
    setError(null);
    try {
      const created = await createProjectFromInspiration({ card, language: "zh-CN" });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${encodeURIComponent(created.project.id)}/overview`);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      if (mountedRef.current) setCreatingId(null);
    }
  };
  const stats = result?.poolStats ?? catalogStats;
  const locks = SLOT_KEYS.filter((slot) => lockedSlots[slot]);

  return (
    <main className="inspiration-slots">
      <header className="inspiration-slots__hero">
        <div className="inspiration-slots__eyebrow"><Sparkles size={16} /> SPARK · 00</div>
        <h1>灵感老虎机</h1>
        <p>固定四槽出画面种子，融合 M03 素材库与内置词库，不绑定特定世界。喜欢哪张词卡就锁住它，继续换其他三槽。</p>
      </header>

      <form className="inspiration-slots__controls" onSubmit={onRoll}>
        <label className="inspiration-slots__search">
          <span>灵感关键词（可选）</span>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="鉴定 / 药渣 / 按摩 / 边军" maxLength={200} />
        </label>
        <label className="inspiration-slots__toggle">
          <input type="checkbox" checked={useM03} onChange={(event) => setUseM03(event.target.checked)} />
          <span>M03 融合</span>
        </label>
        <div className="inspiration-slots__channels" role="group" aria-label="频道">
          {CHANNELS.map((item) => (
            <button key={item.value} type="button" aria-pressed={channel === item.value} onClick={() => changeChannel(item.value)}>{item.label}</button>
          ))}
        </div>
        <button className="btn btn--primary inspiration-slots__roll" type="submit" disabled={rolling}>
          <RefreshCw size={16} /> {rolling ? "正在摇号…" : result ? "拉一下 / 换一批" : "拉一下"}
        </button>
        <small className="inspiration-slots__pool" aria-live="polite">
          {stats ? `内置词库 ${stats.slotBankCount} 张 · M03 素材 ${stats.m03Count} 张` : "正在读取素材池…"}
        </small>
      </form>

      {locks.length > 0 && (
        <section className="inspiration-slots__locks" aria-label="已锁定槽位">
          <div className="inspiration-slots__locks-heading">
            <strong><LockKeyhole size={16} /> 已锁定 {locks.length}/3</strong>
            <button type="button" onClick={() => setLockedSlots({})}>全部解锁</button>
          </div>
          <div className="inspiration-slots__lock-list">
            {locks.map((slot) => {
              const item = lockedSlots[slot]!;
              return <button type="button" key={slot} onClick={() => toggleSlot(slot, item)} title="点击解锁">
                <LockKeyhole size={13} /><b>{SLOT_LABELS[slot]}</b><span>{item.phrase}</span><LockKeyholeOpen size={14} />
              </button>;
            })}
          </div>
        </section>
      )}

      {error && <div className="inspiration-slots__error" role="alert">操作失败：{error}</div>}
      {rolling && !result && <p className="inspiration-slots__loading" role="status">正在组合第一批男频画面种子…</p>}
      <section className="inspiration-slots__grid" aria-label="灵感种子">
        {(result?.cards ?? []).map((card, index) => (
          <article className="inspiration-slots__card" key={card.id}>
            <div className="inspiration-slots__card-heading"><span>SEED {String(index + 1).padStart(2, "0")}</span><span>{card.channel === "male" ? "男频" : card.channel === "female" ? "女频" : "混合"}</span></div>
            <p className="inspiration-slots__sentence">{card.sentence}</p>
            <div className="inspiration-slots__slot-list">
              {SLOT_KEYS.map((slot) => {
                const item = card.slots[slot];
                const isLocked = lockedSlots[slot]?.id === item.id;
                const blocked = !isLocked && !lockedSlots[slot] && locks.length >= 3;
                return (
                  <button type="button" className={`inspiration-slots__slot inspiration-slots__slot--${slot}`} key={slot}
                    aria-pressed={isLocked} disabled={blocked} title={blocked ? "最多锁定三个槽位" : isLocked ? "点击解锁" : "点击锁定该槽位"}
                    onClick={() => toggleSlot(slot, item)}>
                    <span className="inspiration-slots__slot-label">{SLOT_LABELS[slot]}</span>
                    <strong>{item.phrase}</strong>
                    <span className="inspiration-slots__slot-foot">
                      <small>{item.sourceLibrary === "M03" ? "M03" : "词库"}</small>
                      {isLocked ? <LockKeyhole size={15} /> : <LockKeyholeOpen size={15} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <button className="btn btn--primary inspiration-slots__create" type="button" disabled={creatingId !== null}
              onClick={() => void createBook(card)}>
              {creatingId === card.id ? "正在创建小说…" : "用这条创建小说"}
            </button>
          </article>
        ))}
      </section>
      {!rolling && result?.cards.length === 0 && <p className="inspiration-slots__loading">没有匹配素材，换个关键词试试。</p>}
    </main>
  );
}
