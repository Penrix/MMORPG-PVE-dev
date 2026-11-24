import { createHash } from "node:crypto";

const PUA_RE = /[\uE000-\uF8FF]/u;

/**
 * Normalize a book title for cross-run deduplication without losing identity.
 */
export function normalizeBookTitle(title) {
  return String(title ?? "")
    .replace(/[《》\s\u3000]+/gu, "")
    .trim()
    .toLowerCase();
}

export function hasPuaGarble(text) {
  return PUA_RE.test(String(text ?? ""));
}

function detectPlatform(headerLine, filename) {
  const probe = `${headerLine} ${filename}`;
  if (probe.includes("起点") || /qidian/i.test(probe)) return "qidian";
  if (probe.includes("番茄") || /fanqie/i.test(probe)) return "fanqie";
  if (probe.includes("刺猬猫") || /ciweimao/i.test(probe)) return "ciweimao";
  return "other";
}

function detectBoard(headerLine, filename) {
  const cleaned = String(headerLine ?? "")
    .replace(/^#+\s*/u, "")
    .replace(/^(?:起点|番茄|刺猬猫)\s*[·・-]\s*/u, "")
    .replace(/\s*[·・]\s*全\s*\d+\s*题材.*$/u, "")
    .trim();
  if (cleaned) return cleaned;
  return String(filename ?? "新书榜")
    .replace(/\.md$/iu, "")
    .replace(/_\d{8}$/u, "")
    .trim();
}

function extractAuthorAndCategory(metaLine, fallbackCategory) {
  const raw = String(metaLine ?? "")
    .replace(/^\*+|\*+$/gu, "")
    .trim();
  if (!raw) {
    return { author: "", category: fallbackCategory };
  }
  const parts = raw
    .split(/\s*·\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const author = parts[0] ?? "";
  const categoryCandidates = parts
    .slice(1)
    .filter(
      (part) =>
        !/^(?:连载中|已完结|完结|未完结|\d+(?:\.\d+)?\s*万?\s*(?:在读|字|点击|月票|推荐|收藏|订阅|刀片|吐槽))$/u.test(
          part,
        ),
    );
  const category =
    categoryCandidates.length > 0
      ? categoryCandidates.join("·")
      : fallbackCategory;
  return { author, category };
}

/**
 * Parse Markdown files produced by Qidian, Fanqie, or Ciweimao newbook scrapers.
 */
export function parseRankingMarkdown(markdown, filename = "") {
  const lines = String(markdown ?? "").split(/\r?\n/u);
  const h1 = lines.find((line) => /^#\s+/u.test(line)) ?? "";
  const platform = detectPlatform(h1, filename);
  const board = detectBoard(h1, filename);

  const entries = [];
  let currentSectionCategory = "";
  let current = null;
  let inIntro = false;
  let introLines = [];

  const flush = () => {
    if (!current) return;
    const intro = introLines
      .join("\n")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();
    entries.push({
      ...current,
      intro,
    });
    current = null;
    inIntro = false;
    introLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^---+$/.test(line)) {
      flush();
      continue;
    }

    const rankMatch = line.match(/^#{2,3}\s+#(\d+)\s+(.+)$/u);
    if (rankMatch) {
      flush();
      current = {
        platform,
        board,
        category: currentSectionCategory,
        rank: Number.parseInt(rankMatch[1], 10),
        title: rankMatch[2].trim(),
        author: "",
        url: "",
        intro: "",
      };
      continue;
    }

    const sectionMatch = line.match(/^##\s+(?!#)(.+)$/u);
    if (sectionMatch) {
      flush();
      currentSectionCategory = sectionMatch[1]
        .replace(/\s*[（(].*[）)]$/u, "")
        .trim();
      continue;
    }

    if (!current) continue;

    if (inIntro) {
      if (/^\*\*[^*]+\*\*/u.test(line) && !line.startsWith("**简介")) {
        inIntro = false;
        continue;
      }
      if (line.length > 0 || introLines.length > 0) {
        introLines.push(rawLine.trimEnd());
      }
      continue;
    }

    if (line === "**简介**" || line === "**简介：**") {
      inIntro = true;
      continue;
    }

    const inlineIntro = line.match(/^\*\*简介[：:]\*\*\s*(.+)$/u);
    if (inlineIntro) {
      introLines.push(inlineIntro[1].trim());
      inIntro = true;
      continue;
    }

    if (!current.author && /^\*[^*].*\*$/u.test(line)) {
      const parsed = extractAuthorAndCategory(line, current.category);
      current.author = parsed.author;
      if (parsed.category) current.category = parsed.category;
      continue;
    }

    const urlMatch = line.match(/^\[作品页\]\((https?:\/\/[^)\s]+)\)$/u);
    if (urlMatch) {
      current.url = urlMatch[1];
    }
  }

  flush();
  return entries;
}

export function newbookRecordId(platform, title) {
  const key = `${platform}:${normalizeBookTitle(title)}`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `${platform}:${hash}`;
}

export function isValidNewbookEntry(entry) {
  if (!entry || typeof entry.title !== "string") return false;
  const title = entry.title.trim();
  const intro = String(entry.intro ?? "").trim();
  if (title.length < 1 || intro.length < 10) return false;
  if (hasPuaGarble(title) || hasPuaGarble(intro)) return false;
  return true;
}

/**
 * Incrementally merge newbook snapshots into the cumulative time-tagged pool.
 * Existing entries keep their original firstSeenAt while updating lastSeenAt,
 * seenCount, boardsSeen, and keeping the richest clean metadata.
 */
export function mergeNewbookPool(
  existingRecords,
  incomingEntries,
  observedDate,
) {
  const date = String(observedDate).slice(0, 10);
  const byId = new Map();

  for (const record of existingRecords) {
    if (!record || !record.id) continue;
    byId.set(record.id, {
      ...record,
      boardsSeen: [
        ...new Set(record.boardsSeen ?? [record.board].filter(Boolean)),
      ],
    });
  }

  let added = 0;
  let updated = 0;
  let skippedInvalid = 0;
  const touchedIds = new Set();

  for (const entry of incomingEntries) {
    if (!isValidNewbookEntry(entry)) {
      skippedInvalid += 1;
      continue;
    }

    const id = newbookRecordId(entry.platform, entry.title);
    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, {
        id,
        platform: entry.platform,
        board: entry.board,
        boardsSeen: [entry.board],
        category: entry.category || "未分类",
        title: entry.title.trim(),
        author: entry.author.trim(),
        intro: entry.intro.trim(),
        url: entry.url || "",
        latestRank: Number.isFinite(entry.rank) ? entry.rank : null,
        firstSeenAt: date,
        lastSeenAt: date,
        seenCount: 1,
      });
      touchedIds.add(id);
      added += 1;
      continue;
    }

    const boardsSeen = [
      ...new Set([...(existing.boardsSeen ?? []), entry.board].filter(Boolean)),
    ];
    const isNewRunSighting = !touchedIds.has(id);
    const nextIntro =
      entry.intro.trim().length > existing.intro.length
        ? entry.intro.trim()
        : existing.intro;
    const nextCategory =
      existing.category && existing.category !== "未分类"
        ? existing.category
        : entry.category || "未分类";

    byId.set(id, {
      ...existing,
      board: entry.board || existing.board,
      boardsSeen,
      category: nextCategory,
      author: existing.author || entry.author.trim(),
      intro: nextIntro,
      url: existing.url || entry.url || "",
      latestRank: Number.isFinite(entry.rank)
        ? entry.rank
        : (existing.latestRank ?? null),
      firstSeenAt:
        existing.firstSeenAt && existing.firstSeenAt <= date
          ? existing.firstSeenAt
          : date,
      lastSeenAt:
        existing.lastSeenAt && existing.lastSeenAt >= date
          ? existing.lastSeenAt
          : date,
      seenCount: isNewRunSighting
        ? (existing.seenCount ?? 1) + 1
        : (existing.seenCount ?? 1),
    });
    if (isNewRunSighting) {
      touchedIds.add(id);
      updated += 1;
    }
  }

  const records = [...byId.values()].sort(
    (left, right) =>
      right.lastSeenAt.localeCompare(left.lastSeenAt) ||
      right.firstSeenAt.localeCompare(left.firstSeenAt) ||
      left.platform.localeCompare(right.platform) ||
      left.title.localeCompare(right.title, "zh-CN"),
  );

  return {
    records,
    stats: {
      observedDate: date,
      total: records.length,
      added,
      updated,
      skippedInvalid,
    },
  };
}

/**
 * Slice the cumulative pool by time window (e.g., last 7 / 14 / 30 days)
 * so TR-I-01 never mixes stale half-year-old trends with fresh newbook signals.
 */
export function filterNewbooksByWindow(records, options = {}) {
  const {
    windowDays = 14,
    referenceDate = new Date().toISOString().slice(0, 10),
    platform,
    category,
    onlyNewlyDiscovered = false,
  } = options;

  const refMs = Date.parse(`${String(referenceDate).slice(0, 10)}T00:00:00Z`);
  const cutoffMs = refMs - Math.max(0, windowDays - 1) * 24 * 60 * 60 * 1000;

  return records.filter((record) => {
    if (platform && record.platform !== platform) return false;
    if (category && !String(record.category ?? "").includes(category)) {
      return false;
    }
    const dateField = onlyNewlyDiscovered
      ? record.firstSeenAt
      : record.lastSeenAt;
    const recordMs = Date.parse(
      `${String(dateField ?? "").slice(0, 10)}T00:00:00Z`,
    );
    if (Number.isNaN(recordMs)) return false;
    return recordMs >= cutoffMs && recordMs <= refMs;
  });
}

export function parseNewbooksJsonl(text) {
  return String(text ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function stringifyNewbooksJsonl(records) {
  if (records.length === 0) return "";
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}
