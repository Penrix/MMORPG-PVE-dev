// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { InspirationSeedCard, InspirationSlotKey } from "@narralume/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InspirationSlotsWorkspace } from "../src/workspaces/inspiration-slots";

const keys: InspirationSlotKey[] = [
  "identity", "anomalyRule", "highValueCircle", "twistPressure",
];
const phrases = ["报废忍具杂役", "提取战斗记忆", "木叶上忍圈", "却读到禁忌情报"];
function card(id: number): InspirationSeedCard {
  return {
    id: `seed-${id}`,
    channel: "male",
    sentence: `我是木叶第${id}名杂役，发现废忍具藏着忍术，却读到了禁忌情报。`,
    slots: Object.fromEntries(keys.map((key, index) => [
      key,
      {
        id: `${key}-${id}`,
        slot: key,
        channels: ["male"],
        label: phrases[index],
        phrase: phrases[index],
        sourceLibrary: index === 1 ? "M03" : "slot-bank",
        materialType: null,
        tags: [],
      },
    ])) as InspirationSeedCard["slots"],
    starterBlueprint: {
      suggestedTitle: `木叶杂役${id}`,
      genreLabel: "火影",
      readerNeed: "得意",
      targetEmotion: "昂扬",
      protagonistIdentity: "杂役",
      advantageHook: "忍具记忆",
      targetCircle: "上忍",
      openingTension: "禁忌情报",
    },
  };
}
const stats = {
  slotBankCount: 100,
  m03Count: 50,
  bySlot: Object.fromEntries(keys.map((key) => [
    key, { slotBankCount: 25, m03Count: 12, total: 37 },
  ])),
};
const batch = { channel: "male", cards: Array.from({ length: 6 }, (_, i) => card(i + 1)), poolStats: stats };
function json(value: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(value), {
    status, headers: { "content-type": "application/json" },
  }));
}
function mockFetch() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/inspirations/catalog") {
      return json({ channels: ["male", "hybrid", "female"], slots: keys, poolStats: stats, m03TypeMapping: {} });
    }
    if (url === "/api/inspirations/roll") return json(batch);
    if (url === "/api/inspirations/create-project") {
      return json({ project: { id: "new-book" }, outlineNodeId: "outline-1" }, 201);
    }
    throw new Error(`Unexpected request: ${url} (${init?.method})`);
  });
}
function renderSlots() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/inspirations"]}>
        <Routes>
          <Route path="/inspirations" element={<InspirationSlotsWorkspace />} />
          <Route path="/projects/:projectId/overview" element={<p>新项目概览已打开</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.stubGlobal("fetch", mockFetch()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("灵感老虎机", () => {
  it("打开即自动生成六张男频画面种子", async () => {
    renderSlots();
    expect(await screen.findAllByRole("article")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "男频" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("内置词库 100 张 · M03 素材 50 张")).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    const firstRoll = fetchMock.mock.calls.find(([url]) => String(url) === "/api/inspirations/roll");
    expect(JSON.parse(String(firstRoll?.[1]?.body))).toMatchObject({
      channel: "male", count: 6, useM03: true,
    });
  });

  it("锁定第一张身份后换一批，真实传输完整 lockedSlots 词卡", async () => {
    renderSlots();
    const articles = await screen.findAllByRole("article");
    fireEvent.click(articles[0]!.querySelector(".inspiration-slots__slot--identity")!);
    expect(screen.getByRole("region", { name: "已锁定槽位" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "拉一下 / 换一批" }));
    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === "/api/inspirations/roll");
      expect(calls).toHaveLength(2);
      expect(JSON.parse(String(calls[1]?.[1]?.body)).lockedSlots).toEqual({
        identity: card(1).slots.identity,
      });
    });
  });

  it("点击创建小说后 POST 完整卡片并跳转新项目概览", async () => {
    renderSlots();
    const buttons = await screen.findAllByRole("button", { name: "用这条创建小说" });
    fireEvent.click(buttons[0]!);
    expect(await screen.findByText("新项目概览已打开")).toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([url]) =>
      String(url) === "/api/inspirations/create-project");
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      card: card(1), language: "zh-CN",
    });
  });
});
