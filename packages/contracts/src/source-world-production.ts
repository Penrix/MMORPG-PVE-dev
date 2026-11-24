import { z } from "zod";
import {
  WorldPackDocumentSchema,
  WorldPackRequestSchema,
} from "./world-pack.js";

export const SourceWorldProductionDraftSchema = z
  .object({
    id: z.string().min(1),
    worldId: z.string().min(1),
    requestId: z.string().uuid(),
    status: z.enum(["draft", "adopted"]),
    version: z.number().int().positive(),
    request: WorldPackRequestSchema,
    document: WorldPackDocumentSchema,
    adoptedKeys: z.record(z.string(), z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type SourceWorldProductionDraft = z.infer<
  typeof SourceWorldProductionDraftSchema
>;

export const UpdateSourceWorldProductionDraftRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    document: WorldPackDocumentSchema,
  })
  .strict();

export const AdoptSourceWorldProductionDraftRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
  })
  .strict();
