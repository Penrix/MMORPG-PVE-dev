// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type {
  InspirationChannel,
  InspirationRollMode,
  InspirationSeedCard,
  InspirationSlotKey,
} from "@narralume/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InspirationSlotsWorkspace } from "../src/workspaces/inspiration-slots";

const keys: InspirationSlotKey[] = [
  "identity",
  "anomalyRule",
  "highValueCircle",
  "twistPressure",
];
const phrases = [
  "木叶报废忍具杂役",
  "提取忍具残留战斗记忆",
  "火影直属与上忍任务圈",
  "却读到根部禁忌情报",
];

function card(
  id: number,
  topic = "原创男频",
  channel: InspirationChannel = "male",
): InspirationSeedCard {
  return {
    id: `seed-${id}-${topic}`,
    channel,
    sentence: `我是${topic}里的第${id}名${phrases[0]}，发现自己能${phrases[1]}，借此进入${phrases[2]}，${phrases[3]}。`,
    slots: Object.fromEntries(
      keys.map((key, index) => [
        key,
        {
          id: `${key}-${id}`,
          slot: key,
          channels: [channel],
          label: phrases[index],
          phrase:
            key === "identity"
              ? `${topic}第${id}号${phrases[index]}`
              : `${phrases[index]}-${id}`,
          sourceLibrary: index === 1 ? "M03" : "slot-bank",
          materialType: index === 1 ? "GF" : null,
          ...(index === 1 ? { materialId: `GF-${id}` } : {}),
          tags: [],
        },
      ]),
    ) as InspirationSeedCard["slots"],
    starterBlueprint: {
      suggestedTitle: `${topic}杂役${id}`,
      genreLabel: topic,
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
  bySlot: Object.fromEntries(
    keys.map((key) => [
      key,
      { slotBankCount: 25, m03Count: 12, total: 37 },
    ]),
  ),
};

function batch(
  count: number,
  mode: InspirationRollMode,
  topic: string | null,
  channel: InspirationChannel,
) {
  return {
    channel,
    mode,
    topic,
    cards: Array.from({ length: count }, (_, i) =>
      card(i + 1, topic ?? "原创男频", channel),
    ),
    poolStats: stats,
  };
}

function json(value: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function mockFetch() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/inspirations/catalog") {
      return json({
        channels: ["male", "hybrid", "female"],
        slots: keys,
        poolStats: stats,
        m03TypeMapping: {},
      });
    }
    if (url === "/api/inspirations/roll") {
      const body = JSON.parse(String(init?.body)) as {
        count: number;
        mode: InspirationRollMode;
        topic?: string;
        channel: InspirationChannel;
      };
      return json(
        batch(body.count, body.mode, body.topic ?? null, body.channel),
      );
    }
    if (url === "/api/inspirations/create-project") {
      return json(
        { project: { id: "new-book" }, outlineNodeId: "outline-1" },
        201,
      );
    }
    throw new Error(`Unexpected request: ${url} (${init?.method})`);
  });
}

function renderSlots() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/inspirations"]}>
        <Routes>
          <Route
            path="/inspirations"
            element={<InspirationSlotsWorkspace />}
          />
          <Route
            path="/projects/:projectId/overview"
            element={<p>新项目概览已打开</p>}
          />
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
  it("打开即用 local 模式零等待生成 12 张男频种子，并默认选中 12", async () => {
    renderSlots();
    expect(await screen.findAllByRole("article")).toHaveLength(12);
    expect(screen.getByRole("button", { name: "男频" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "12" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText("内置词库 100 张 · M03 素材 50 张"),
    ).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    const firstRoll = fetchMock.mock.calls.find(
      ([url]) => String(url) === "/api/inspirations/roll",
    );
    expect(JSON.parse(String(firstRoll?.[1]?.body))).toMatchObject({
      channel: "male",
      count: 12,
      mode: "local",
      useM03: true,
    });
  });

  it("支持 20 / 24 / 30 数量切换", async () => {
    renderSlots();
    await screen.findAllByRole("article");
    for (const value of ["20", "30", "24"]) {
      fireEvent.click(screen.getByRole("button", { name: value }));
      expect(screen.getByRole("button", { name: value })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
  });

  it("点击 AI 按主题摇一批携带 llm 模式、火影主题、数量与 M03 开关", async () => {
    renderSlots();
    await screen.findAllByRole("article");
    fireEvent.change(
      screen.getByPlaceholderText(
        "输入题材或作品，如：火影忍者、大明、海贼、诡异修仙、都市高武…",
      ),
      { target: { value: "火影忍者" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    fireEvent.click(
      screen.getByRole("button", { name: "AI 按主题摇一批" }),
    );

    await waitFor(() => {
      const calls = vi
        .mocked(fetch)
        .mock.calls.filter(
          ([url]) => String(url) === "/api/inspirations/roll",
        );
      expect(calls).toHaveLength(2);
      expect(JSON.parse(String(calls[1]?.[1]?.body))).toMatchObject({
        channel: "male",
        count: 20,
        mode: "llm",
        topic: "火影忍者",
        useM03: true,
      });
    });
    expect(await screen.findAllByRole("article")).toHaveLength(20);
  });

  it("锁定第一张身份后免费重摇，真实传输完整 lockedSlots 词卡", async () => {
    renderSlots();
    const articles = await screen.findAllByRole("article");
    fireEvent.click(
      articles[0]!.querySelector(".inspiration-slots__slot--identity")!,
    );
    expect(
      screen.getByRole("region", { name: "已锁定槽位" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "免费词库速摇" }),
    );
    await waitFor(() => {
      const calls = vi
        .mocked(fetch)
        .mock.calls.filter(
          ([url]) => String(url) === "/api/inspirations/roll",
        );
      expect(calls).toHaveLength(2);
      expect(JSON.parse(String(calls[1]?.[1]?.body)).lockedSlots).toEqual({
        identity: card(1).slots.identity,
      });
    });
  });

  it("LLM 未配置时显示清晰错误并可一键切回免费速摇", async () => {
    const failingFetch = mockFetch();
    failingFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/inspirations/catalog") {
          return json({
            channels: ["male", "hybrid", "female"],
            slots: keys,
            poolStats: stats,
            m03TypeMapping: {},
          });
        }
        if (url === "/api/inspirations/roll") {
          const body = JSON.parse(String(init?.body)) as {
            count: number;
            mode: InspirationRollMode;
            topic?: string;
            channel: InspirationChannel;
          };
          if (body.mode === "llm") {
            return json(
              {
                error: {
                  code: "inspiration.model_unavailable",
                  message:
                    "未配置可用的写作模型或凭证。请先配置写作模型，或改用“免费词库速摇”。",
                },
              },
              422,
            );
          }
          return json(
            batch(body.count, body.mode, body.topic ?? null, body.channel),
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );
    vi.stubGlobal("fetch", failingFetch);

    renderSlots();
    await screen.findAllByRole("article");
    fireEvent.click(
      screen.getByRole("button", { name: "AI 按主题摇一批" }),
    );
    expect(
      await screen.findByRole("button", { name: "改用免费词库速摇" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "改用免费词库速摇" }),
    );
    await waitFor(() => {
      const rollCalls = failingFetch.mock.calls.filter(
        ([url]) => String(url) === "/api/inspirations/roll",
      );
      expect(rollCalls).toHaveLength(3);
      expect(JSON.parse(String(rollCalls[2]?.[1]?.body)).mode).toBe("local");
    });
  });

  it("点击创建小说后 POST 完整卡片并跳转新项目概览", async () => {
    renderSlots();
    const buttons = await screen.findAllByRole("button", {
      name: "用这条创建小说",
    });
    fireEvent.click(buttons[0]!);
    expect(await screen.findByText("新项目概览已打开")).toBeInTheDocument();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url]) => String(url) === "/api/inspirations/create-project",
      );
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      card: card(1),
      language: "zh-CN",
    });
  });
});
