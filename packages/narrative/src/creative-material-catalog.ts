import { z } from "zod";

import type { TextSegment } from "@narralume/persistence";

const CuratedCreativeMaterialIndexEntrySchema = z.object({
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

export type CuratedCreativeMaterialIndexEntry = z.infer<
  typeof CuratedCreativeMaterialIndexEntrySchema
>;

export function parseCuratedCreativeMaterialIndex(
  jsonl: string,
): CuratedCreativeMaterialIndexEntry[] {
  return jsonl
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      let value: unknown;
      try {
        value = JSON.parse(line) as unknown;
      } catch {
        throw new Error(`creative_material.invalid_index_json:${index + 1}`);
      }
      const parsed = CuratedCreativeMaterialIndexEntrySchema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`creative_material.invalid_index_entry:${index + 1}`);
      }
      return parsed.data;
    });
}

export function creativeMaterialSegmentFromCuratedCard(input: {
  projectId: string;
  libraryId: string;
  sourceRootLabel: string;
  entry: CuratedCreativeMaterialIndexEntry;
  markdown: string;
  now: string;
}): TextSegment {
  const libraryId = input.libraryId.trim();
  if (!libraryId) throw new Error("creative_material.empty_library");
  const markdown = input.markdown.trim();
  if (
    (input.entry.status === "active" || input.entry.status === "candidate") &&
    !markdown
  ) {
    throw new Error(`creative_material.missing_live_card:${input.entry.id}`);
  }

  const searchable = [
    `素材库：${libraryId}`,
    `组件类型：${input.entry.type}`,
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
    id: `creative-material:${libraryId}:${input.entry.id}`,
    projectId: input.projectId,
    sourceType: "creative_material",
    sourceId: `${libraryId}:${input.entry.id}`,
    title: `${libraryId} ${input.entry.id}｜${input.entry.name}`,
    content: searchable,
    authority: "reference",
    metadata: {
      libraryId,
      materialId: input.entry.id,
      materialType: input.entry.type,
      status: input.entry.status,
      summary: input.entry.summary,
      callWhen: input.entry.call_when,
      tags: input.entry.tags,
      sourcePath: `${input.sourceRootLabel.replace(/\/$/u, "")}/${input.entry.filename}`,
      curationStage: input.entry.curation_stage ?? null,
    },
    entityIds: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
}
