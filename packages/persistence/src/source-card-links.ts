export interface TypedWikiLink {
  relation: string;
  target: string;
  label: string | null;
}

const WIKI_LINK = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;

const INVERSE_RELATIONS: Readonly<Record<string, string>> = {
  老师: "学生",
  学生: "老师",
  师父: "徒弟",
  师傅: "徒弟",
  徒弟: "师父",
  父亲: "子女",
  母亲: "子女",
  父母: "子女",
  子女: "父母",
  上级: "下级",
  下级: "上级",
  领导: "下属",
  下属: "领导",
  所属: "成员",
  所属组织: "成员",
  所属家族: "成员",
  成员: "所属",
  隶属: "成员",
  掌握: "掌握者",
  拥有能力: "掌握者",
  掌握者: "掌握",
  拥有: "拥有者",
  拥有者: "拥有",
  位于: "包含",
  属于: "包含",
  包含: "属于",
  出身: "出身者",
  出身者: "出身",
  创建: "创建者",
  创建者: "创建",
  teacher: "student",
  student: "teacher",
  parent: "child",
  child: "parent",
  member_of: "member",
  member: "member_of",
  owns: "owned_by",
  owned_by: "owns",
  located_in: "contains",
  contains: "located_in",
};

const SYMMETRIC_RELATIONS = new Set([
  "兄弟",
  "姐妹",
  "兄弟姐妹",
  "配偶",
  "夫妻",
  "伴侣",
  "朋友",
  "好友",
  "盟友",
  "同盟",
  "敌对",
  "敌人",
  "对手",
  "竞争",
  "竞争者",
  "搭档",
  "同伴",
  "spouse",
  "partner",
  "friend",
  "ally",
  "enemy",
  "rival",
]);

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
    const heading = /^\s*([^:：\[\]]{1,80})\s*[:：]\s*(.*)$/.exec(line);
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
  if (!normalized) return null;
  if (SYMMETRIC_RELATIONS.has(normalized)) return normalized;
  return INVERSE_RELATIONS[normalized] ?? null;
}
