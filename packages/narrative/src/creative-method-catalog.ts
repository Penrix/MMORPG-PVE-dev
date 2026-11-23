import { z } from "zod";

import type { TextSegment } from "@narralume/persistence";

const CuratedCreativeMethodIndexEntrySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["active", "candidate", "merged", "retired"]),
  summary: z.string().min(1),
  call_when: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  filename: z.string().min(1),
  curation_stage: z.string().min(1).optional(),
});

export type CuratedCreativeMethodIndexEntry = z.infer<
  typeof CuratedCreativeMethodIndexEntrySchema
>;

export function parseCuratedCreativeMethodIndex(
  jsonl: string,
): CuratedCreativeMethodIndexEntry[] {
  return jsonl
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      let value: unknown;
      try {
        value = JSON.parse(line) as unknown;
      } catch {
        throw new Error(`creative_method.invalid_index_json:${index + 1}`);
      }
      const parsed = CuratedCreativeMethodIndexEntrySchema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`creative_method.invalid_index_entry:${index + 1}`);
      }
      return parsed.data;
    });
}

export function creativeMethodSegmentFromCuratedCard(input: {
  projectId: string;
  methodFamily: string;
  sourceRootLabel: string;
  entry: CuratedCreativeMethodIndexEntry;
  markdown: string;
  now: string;
}): TextSegment {
  const methodFamily = input.methodFamily.trim();
  if (!methodFamily) throw new Error("creative_method.empty_family");
  const markdown = input.markdown.trim();
  if (
    (input.entry.status === "active" ||
      input.entry.status === "candidate") &&
    !markdown
  ) {
    throw new Error(`creative_method.missing_live_card:${input.entry.id}`);
  }
  const searchable = [
    `方法族：${methodFamily}`,
    `类型：${input.entry.type}`,
    `状态：${input.entry.status}`,
    `摘要：${input.entry.summary}`,
    input.entry.call_when.length
      ? `召回问题：\n- ${input.entry.call_when.join("\n- ")}`
      : null,
    input.entry.tags.length ? `标签：${input.entry.tags.join("、")}` : null,
    markdown ? `\n--- 原卡 ---\n${markdown}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");

  return {
    id: `creative-method:${methodFamily}:${input.entry.id}`,
    projectId: input.projectId,
    sourceType: "creative_method",
    sourceId: `${methodFamily}:${input.entry.id}`,
    title: `${methodFamily} ${input.entry.id}｜${input.entry.name}`,
    content: searchable,
    authority: "reference",
    metadata: {
      methodFamily,
      methodId: input.entry.id,
      methodType: input.entry.type,
      status: input.entry.status,
      summary: input.entry.summary,
      callWhen: input.entry.call_when,
      tags: input.entry.tags,
      sourcePath: `${input.sourceRootLabel.replace(/\/$/u, "")}/${
        input.entry.filename
      }`,
      curationStage: input.entry.curation_stage ?? null,
    },
    entityIds: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
}
