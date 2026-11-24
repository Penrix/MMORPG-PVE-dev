import {
  CreateProjectFromInspirationRequestSchema,
  InspirationCatalogResponseSchema,
  InspirationRollRequestSchema,
  InspirationSlotKeySchema,
  InspirationChannelSchema,
  ProjectSchema,
} from "@narralume/contracts";
import { randomUuid } from "@narralume/domain";
import type { FetchLike } from "@narralume/llm";
import {
  SqliteStoryRepository,
  type NarrativeDatabase,
} from "@narralume/persistence";
import { z } from "zod";
import {
  generateInspirationSeedsWithLlm,
  type InspirationLlmGenerator,
} from "./inspiration-llm-generator.js";
import { bootstrapProject } from "./project-bootstrap.js";
import {
  inspirationPoolStats,
  loadM03SlotItems,
  M03_TYPE_MAPPING,
  rollInspirationSeeds,
} from "./inspiration-slot-bank.js";
import type { RouteApp } from "./route-app.js";

const CatalogQuerySchema = z.object({
  projectId: z.string().trim().min(1).optional(),
});

export interface InspirationSlotRouteOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  fetch?: FetchLike;
  generateWithLlm?: InspirationLlmGenerator;
}

export function registerInspirationSlotRoutes(
  app: RouteApp,
  database: NarrativeDatabase,
  options: InspirationSlotRouteOptions = {},
): void {
  app.route("GET", "/api/inspirations/catalog", (request) => {
    const { projectId } = CatalogQuerySchema.parse(request.query);
    const m03 = loadM03SlotItems(database, projectId);
    // The catalog counts the full shared bank; roll counts remain channel-specific.
    const channels = InspirationChannelSchema.options;
    return InspirationCatalogResponseSchema.parse({
      channels,
      slots: InspirationSlotKeySchema.options,
      poolStats: inspirationPoolStats("all", m03),
      m03TypeMapping: M03_TYPE_MAPPING,
    });
  });

  app.route("POST", "/api/inspirations/roll", async (request) => {
    const input = InspirationRollRequestSchema.parse(request.body);
    if (input.mode === "llm") {
      const generator =
        options.generateWithLlm ?? generateInspirationSeedsWithLlm;
      return generator(database, input, {
        environment: options.environment ?? {},
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      });
    }
    return rollInspirationSeeds(database, input);
  });

  app.route("POST", "/api/inspirations/create-project", (request) => {
    const input = CreateProjectFromInspirationRequestSchema.parse(request.body);
    const { card } = input;
    const now = new Date().toISOString();
    const projectId = randomUuid();
    const outlineNodeId = randomUuid();
    const title = input.title ?? card.starterBlueprint.suggestedTitle;
    const result = database.transaction(() => {
      const project = bootstrapProject(database, {
        projectId,
        rootOutlineNodeId: outlineNodeId,
        title,
        subtitle: null,
        premise: card.sentence,
        language: input.language,
        now,
      });
      const story = new SqliteStoryRepository(database);
      const intent = story.getAuthorIntent(projectId);
      if (!intent) throw new Error("inspiration.missing_bootstrap_intent");
      story.upsertAuthorIntent({
        ...intent,
        promise: card.sentence,
        audience:
          card.channel === "female"
            ? "女频读者"
            : card.channel === "male"
              ? "男频读者"
              : "综合读者",
        tone: card.starterBlueprint.targetEmotion,
        themes: [card.starterBlueprint.readerNeed],
        currentFocus: JSON.stringify(card.starterBlueprint),
        updatedAt: now,
      });
      story.updateOutlineDetails(
        projectId,
        outlineNodeId,
        {
          summary: card.sentence,
          goal: card.starterBlueprint.targetCircle,
          conflict: card.starterBlueprint.openingTension,
          metadata: {
            inspirationCardId: card.id,
            inspirationSeed: card.sentence,
            starterBlueprint: card.starterBlueprint,
            origin: "inspiration-slot-machine",
          },
        },
        now,
      );
      return { project: ProjectSchema.parse(project), outlineNodeId };
    });
    return { status: 201, body: result };
  });
}
