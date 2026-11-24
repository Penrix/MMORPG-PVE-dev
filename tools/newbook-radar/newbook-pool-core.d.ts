export type NewbookPlatform = "qidian" | "fanqie" | "ciweimao" | "other";

export interface ParsedRankingEntry {
  platform: NewbookPlatform;
  board: string;
  category: string;
  rank: number;
  title: string;
  author: string;
  url: string;
  intro: string;
}

export interface NewbookRecord {
  id: string;
  platform: NewbookPlatform;
  board: string;
  boardsSeen: string[];
  category: string;
  title: string;
  author: string;
  intro: string;
  url: string;
  latestRank: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
}

export interface MergeNewbookPoolResult {
  records: NewbookRecord[];
  stats: {
    observedDate: string;
    total: number;
    added: number;
    updated: number;
    skippedInvalid: number;
  };
}

export interface FilterNewbooksWindowOptions {
  windowDays?: number;
  referenceDate?: string;
  platform?: NewbookPlatform;
  category?: string;
  onlyNewlyDiscovered?: boolean;
}

export function normalizeBookTitle(title: string): string;
export function hasPuaGarble(text: string): boolean;
export function parseRankingMarkdown(
  markdown: string,
  filename?: string,
): ParsedRankingEntry[];
export function newbookRecordId(
  platform: NewbookPlatform,
  title: string,
): string;
export function isValidNewbookEntry(entry: ParsedRankingEntry): boolean;
export function mergeNewbookPool(
  existingRecords: readonly NewbookRecord[],
  incomingEntries: readonly ParsedRankingEntry[],
  observedDate: string,
): MergeNewbookPoolResult;
export function filterNewbooksByWindow(
  records: readonly NewbookRecord[],
  options?: FilterNewbooksWindowOptions,
): NewbookRecord[];
export function parseNewbooksJsonl(text: string): NewbookRecord[];
export function stringifyNewbooksJsonl(
  records: readonly NewbookRecord[],
): string;
