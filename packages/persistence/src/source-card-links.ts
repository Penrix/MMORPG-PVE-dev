import { inverseWorldAtlasRelation } from "@narralume/contracts";

export interface TypedWikiLink {
  relation: string;
  target: string;
  label: string | null;
}

const WIKI_LINK = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;

function cleanRelation(value: string): string {
  return value
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^[#>]+\s*/, "")
    .replace(/[*_`]/g, "")
    .trim();
}

function linksFromText(text: string, relation: string): TypedWikiLink[] {
  const links: TypedWikiLink[] = [];
  WIKI_LINK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKI_LINK.exec(text)) !== null) {
    const target = match[1]?.trim();
    if (!target) continue;
    links.push({
      relation,
      target,
      label: match[2]?.trim() || null,
    });
  }
  return links;
}

/**
 * Parse lightweight typed wiki links from an author-facing Markdown card.
 *
 * Supported forms:
 *   老师：[[波风水门]]
 *   学生：[[漩涡鸣人]]、[[宇智波佐助]]
 *   所属组织:
 *     - [[木叶隐村]]
 *
 * A plain [[link]] with no relation heading stays a normal wiki link and does
 * not become a structured relation. The card remains the source of truth; the
 * resulting edges are only a rebuildable index.
 */
export function parseTypedWikiLinks(markdown: string): TypedWikiLink[] {
  const result: TypedWikiLink[] = [];
  let currentRelation: string | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const heading = /^\s*([^:：[\]]{1,80})\s*[:：]\s*(.*)$/.exec(line);
    if (heading) {
      const relation = cleanRelation(heading[1] ?? "");
      currentRelation = relation || null;
      if (currentRelation) {
        result.push(...linksFromText(heading[2] ?? "", currentRelation));
      }
      continue;
    }

    const listItem = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (currentRelation && listItem) {
      result.push(...linksFromText(listItem[1] ?? "", currentRelation));
      continue;
    }

    if (!line.trim()) {
      currentRelation = null;
      continue;
    }

    // A non-list prose line ends a preceding YAML-style relation block.
    currentRelation = null;
  }

  const seen = new Set<string>();
  return result.filter((edge) => {
    const key = `${edge.relation}\0${edge.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function inverseRelation(relation: string): string | null {
  const normalized = cleanRelation(relation);
  return normalized ? inverseWorldAtlasRelation(normalized) : null;
}
