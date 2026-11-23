import { z } from "zod";

/**
 * Module-2 creative-material object space.
 *
 * Creative materials are reusable imagination objects mined from successful
 * stories or other authorized sources. They are queryable inputs for creation,
 * but they are NOT Project Reality, Source World entities, or M algorithms.
 *
 * The library is deliberately open-ended: new material types, cards and
 * libraries can be added over time without changing the Story runtime schema.
 */
export const CreativeMaterialStatusSchema = z.enum([
  "active",
  "candidate",
  "merged",
  "retired",
]);
export type CreativeMaterialStatus = z.infer<
  typeof CreativeMaterialStatusSchema
>;

export const CreativeMaterialUseScopeSchema = z.enum([
  "world",
  "protagonist_build",
  "ability",
  "resource",
  "relationship",
  "story",
  "scene",
  "combat",
  "information",
  "other",
]);
export type CreativeMaterialUseScope = z.infer<
  typeof CreativeMaterialUseScopeSchema
>;

export const CreativeMaterialSelectionSchema = z.object({
  id: z.string().min(1),
  libraryId: z.string().min(1),
  materialId: z.string().min(1),
  materialType: z.string().min(1),
  status: CreativeMaterialStatusSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceRef: z.string().min(1).nullable(),
  scope: CreativeMaterialUseScopeSchema,
  purpose: z.string().min(1),
  inputObjectIds: z.array(z.string().min(1)).min(1),
  callWhen: z.array(z.string().min(1)),
  tags: z.array(z.string().min(1)),
  curationStage: z.string().min(1).nullable(),
  content: z.string().min(1),
});
export type CreativeMaterialSelection = z.infer<
  typeof CreativeMaterialSelectionSchema
>;
