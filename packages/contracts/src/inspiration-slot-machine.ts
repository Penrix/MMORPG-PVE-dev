import { z } from "zod";

export const InspirationChannelSchema = z.enum(["male", "female", "hybrid"]);
export type InspirationChannel = z.infer<typeof InspirationChannelSchema>;

export const InspirationSlotKeySchema = z.enum([
  "identity",
  "anomalyRule",
  "highValueCircle",
  "twistPressure",
]);
export type InspirationSlotKey = z.infer<typeof InspirationSlotKeySchema>;

export const InspirationSlotSourceSchema = z.enum([
  "slot-bank",
  "M03",
  "custom",
]);
export type InspirationSlotSource = z.infer<typeof InspirationSlotSourceSchema>;

export const InspirationSlotItemSchema = z.object({
  id: z.string().trim().min(1),
  slot: InspirationSlotKeySchema,
  channels: z.array(InspirationChannelSchema).min(1),
  label: z.string().trim().min(1),
  phrase: z.string().trim().min(1),
  sourceLibrary: InspirationSlotSourceSchema,
  materialType: z.string().nullable(),
  materialId: z.string().optional(),
  tags: z.array(z.string()),
});
export type InspirationSlotItem = z.infer<typeof InspirationSlotItemSchema>;

export const InspirationSlotCollectionSchema = z.object({
  identity: InspirationSlotItemSchema,
  anomalyRule: InspirationSlotItemSchema,
  highValueCircle: InspirationSlotItemSchema,
  twistPressure: InspirationSlotItemSchema,
});

export const InspirationStarterBlueprintSchema = z.object({
  suggestedTitle: z.string().min(1),
  genreLabel: z.string().min(1),
  readerNeed: z.string().min(1),
  targetEmotion: z.string().min(1),
  protagonistIdentity: z.string().min(1),
  advantageHook: z.string().min(1),
  targetCircle: z.string().min(1),
  openingTension: z.string().min(1),
});

export const InspirationSeedCardSchema = z
  .object({
    id: z.string().min(1),
    channel: InspirationChannelSchema,
    sentence: z
      .string()
      .min(1)
      .refine(
        (value) => /没想到|却|但|不料|结果|反而/u.test(value),
        "The seed must contain a visible reversal",
      ),
    slots: InspirationSlotCollectionSchema,
    starterBlueprint: InspirationStarterBlueprintSchema,
  })
  .superRefine((card, context) => {
    for (const slot of InspirationSlotKeySchema.options) {
      if (card.slots[slot].slot !== slot) {
        context.addIssue({
          code: "custom",
          path: ["slots", slot],
          message: "Slot key and item slot must match",
        });
      }
    }
  });
export type InspirationSeedCard = z.infer<typeof InspirationSeedCardSchema>;

export const InspirationRollRequestSchema = z
  .object({
    channel: InspirationChannelSchema.default("male"),
    count: z.number().int().min(1).max(12).default(6),
    keyword: z.string().trim().max(200).optional(),
    projectId: z.string().trim().min(1).optional(),
    useM03: z.boolean().default(true),
    lockedSlots: InspirationSlotCollectionSchema.partial().optional(),
    seed: z.string().optional(),
  })
  .superRefine((request, context) => {
    const entries = Object.entries(request.lockedSlots ?? {});
    if (entries.length > 3) {
      context.addIssue({
        code: "custom",
        path: ["lockedSlots"],
        message: "Lock at most three slots",
      });
    }
    for (const [key, item] of entries) {
      if (
        item &&
        (item.slot !== key || !item.channels.includes(request.channel))
      ) {
        context.addIssue({
          code: "custom",
          path: ["lockedSlots", key],
          message: "Locked item has a different slot or channel",
        });
      }
    }
  });
export type InspirationRollRequest = z.infer<
  typeof InspirationRollRequestSchema
>;

export const InspirationPoolStatsSchema = z.object({
  slotBankCount: z.number().int().nonnegative(),
  m03Count: z.number().int().nonnegative(),
  bySlot: z.record(
    InspirationSlotKeySchema,
    z.object({
      slotBankCount: z.number().int().nonnegative(),
      m03Count: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  ),
});

export const InspirationRollResponseSchema = z.object({
  channel: InspirationChannelSchema,
  cards: z.array(InspirationSeedCardSchema),
  poolStats: InspirationPoolStatsSchema,
});
export type InspirationRollResponse = z.infer<
  typeof InspirationRollResponseSchema
>;

export const InspirationCatalogResponseSchema = z.object({
  channels: z.array(InspirationChannelSchema),
  slots: z.array(InspirationSlotKeySchema),
  poolStats: InspirationPoolStatsSchema,
  m03TypeMapping: z.record(z.string(), InspirationSlotKeySchema),
});
export type InspirationCatalogResponse = z.infer<
  typeof InspirationCatalogResponseSchema
>;

export const CreateProjectFromInspirationRequestSchema = z.object({
  card: InspirationSeedCardSchema,
  title: z.string().trim().min(1).max(200).optional(),
  language: z.enum(["zh-CN", "en"]).default("zh-CN"),
});
export type CreateProjectFromInspirationRequest = z.infer<
  typeof CreateProjectFromInspirationRequestSchema
>;
