import {
  InspirationRollRequestSchema,
  InspirationRollResponseSchema,
  InspirationSeedCardSchema,
  type InspirationChannel,
  type InspirationRollRequest,
  type InspirationRollResponse,
  type InspirationSlotItem,
  type InspirationSlotKey,
} from "@narralume/contracts";
import {
  ModelGateway,
  createModelAdapter,
  type FetchLike,
  type JsonSchemaContract,
  type ModelRequest,
} from "@narralume/llm";
import {
  SqliteAssignmentRepository,
  resolveCredential,
  type NarrativeDatabase,
} from "@narralume/persistence";
import { z } from "zod";

import {
  dealMaterialBundlesForLlm,
  inspirationPoolStats,
  loadM03SlotItems,
  type InspirationMaterialBundle,
} from "./inspiration-slot-bank.js";
import { ServiceError } from "./service-error.js";

const TURN = /没想到|却|但|不料|结果|反而/u;
const SLOT_FIELDS = {
  identity: "identity",
  anomalyRule: "anomalyRule",
  highValueCircle: "highValueCircle",
  twistPressure: "twistPressure",
} as const satisfies Record<InspirationSlotKey, string>;

const GeneratedCardSchema = z
  .object({
    index: z.number().int().min(1),
    identity: z.string().trim().min(2).max(160),
    anomalyRule: z.string().trim().min(2).max(180),
    highValueCircle: z.string().trim().min(2).max(180),
    twistPressure: z.string().trim().min(2).max(220),
    sentence: z
      .string()
      .trim()
      .min(12)
      .max(600)
      .refine((value) => TURN.test(value), "sentence must contain a reversal"),
    suggestedTitle: z.string().trim().min(1).max(120),
  })
  .strict();

const GeneratedBatchSchema = z
  .object({
    cards: z.array(GeneratedCardSchema),
  })
  .strict();

type GeneratedCard = z.infer<typeof GeneratedCardSchema>;
type GeneratedBatch = z.infer<typeof GeneratedBatchSchema>;

export interface InspirationLlmGenerateOverrideInput {
  request: InspirationRollRequest;
  bundles: readonly InspirationMaterialBundle[];
  prompt: string;
  responseSchema: JsonSchemaContract;
}

export type InspirationLlmGenerateOverride = (
  input: InspirationLlmGenerateOverrideInput,
) => Promise<unknown> | unknown;

export interface InspirationLlmGeneratorOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  fetch?: FetchLike;
  generateOverride?: InspirationLlmGenerateOverride;
}

export class InspirationModelUnavailableError extends ServiceError {
  constructor() {
    super(
      "inspiration.model_unavailable",
      "未配置可用的写作模型或凭证。请先在设置中配置写作模型，或改用“免费词库速摇”。",
      422,
    );
    this.name = "InspirationModelUnavailableError";
  }
}

export async function generateInspirationSeedsWithLlm(
  database: NarrativeDatabase,
  request: InspirationRollRequest,
  options: InspirationLlmGeneratorOptions = {},
): Promise<InspirationRollResponse> {
  const input = InspirationRollRequestSchema.parse({ ...request, mode: "llm" });
  const bundles = dealMaterialBundlesForLlm(database, input);
  const topic =
    input.topic?.trim() ||
    input.keyword?.trim() ||
    (input.channel === "male"
      ? "原创男频"
      : input.channel === "female"
        ? "原创女频"
        : "原创类型小说");
  const prompt = buildPrompt(input, bundles, topic);
  const responseSchema = llmResponseSchema(input.count);
  const validationSchema = buildBatchValidationSchema(input);

  let generated: GeneratedBatch;
  if (options.generateOverride) {
    const raw = await options.generateOverride({
      request: input,
      bundles,
      prompt,
      responseSchema,
    });
    generated = validationSchema.parse(raw);
  } else {
    const gateway = buildGateway(database, options);
    const assignment = new SqliteAssignmentRepository(database).resolve("writing");
    if (!assignment) throw new InspirationModelUnavailableError();
    const modelRequest: ModelRequest = {
      model: assignment.model.modelId,
      instructions:
        "你是中国商业类型小说的灵感发牌器。必须严格执行用户给出的四槽模具与 JSON 合同，不得把任务改成自由脑暴。",
      messages: [{ role: "user", content: prompt }],
      temperature: samplingNumber(assignment.model.sampling.temperature) ?? 0.9,
      ...(samplingNumber(assignment.model.sampling.topP) === null
        ? {}
        : { topP: samplingNumber(assignment.model.sampling.topP)! }),
      maxOutputTokens: Math.min(
        assignment.model.maxOutputTokens ?? Math.max(8_000, input.count * 360),
        16_000,
      ),
      responseSchema,
    };
    const structured = await gateway.generateStructured(
      modelRequest,
      (value) => {
        const parsed = validationSchema.safeParse(value);
        return parsed.success
          ? { success: true as const, data: parsed.data }
          : {
              success: false as const,
              issues: parsed.error.issues.map(
                (issue) =>
                  `${issue.path.join(".") || "root"}: ${issue.message}`,
              ),
            };
      },
      { maxRepairAttempts: 0 },
    );
    generated = structured.value;
  }

  const cards = generated.cards.map((card, offset) =>
    buildSeedCard(input, bundles[offset]!, card),
  );
  const m03 = input.useM03 ? loadM03SlotItems(database, input.projectId) : [];
  return InspirationRollResponseSchema.parse({
    channel: input.channel,
    mode: "llm",
    topic: input.topic?.trim() || input.keyword?.trim() || null,
    cards,
    poolStats: inspirationPoolStats(input.channel, m03),
  });
}

export type InspirationLlmGenerator = typeof generateInspirationSeedsWithLlm;

function buildGateway(
  database: NarrativeDatabase,
  options: InspirationLlmGeneratorOptions,
): ModelGateway {
  const resolved = new SqliteAssignmentRepository(database).resolve("writing");
  if (!resolved) throw new InspirationModelUnavailableError();
  const environment = options.environment ?? {};
  const credential = resolveCredential(resolved.provider, environment);
  if (!credential.ok) throw new InspirationModelUnavailableError();

  return new ModelGateway(
    createModelAdapter({
      protocol: resolved.provider.wireApi,
      baseUrl: resolved.provider.baseUrl,
      apiKey: credential.apiKey,
      ...(resolved.provider.endpoint === null
        ? {}
        : { endpoint: resolved.provider.endpoint }),
      ...(resolved.provider.anthropicVersion === null
        ? {}
        : { anthropicVersion: resolved.provider.anthropicVersion }),
      headers: resolved.provider.headers,
      queryParams: resolved.provider.queryParams,
      ...(resolved.provider.requestStartTimeoutMs === null
        ? {}
        : { requestStartTimeoutMs: resolved.provider.requestStartTimeoutMs }),
      ...(resolved.provider.streamIdleTimeoutMs === null
        ? {}
        : { streamIdleTimeoutMs: resolved.provider.streamIdleTimeoutMs }),
      timeoutMs: 60_000,
      maxRetries: 1,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    }),
  );
}

function buildBatchValidationSchema(input: InspirationRollRequest) {
  return GeneratedBatchSchema.superRefine((batch, context) => {
    if (batch.cards.length !== input.count) {
      context.addIssue({
        code: "custom",
        path: ["cards"],
        message: `expected exactly ${input.count} cards`,
      });
    }
    const locked = input.lockedSlots ?? {};
    const uniqueFields = [
      "identity",
      "anomalyRule",
      "highValueCircle",
    ] as const;

    for (let offset = 0; offset < batch.cards.length; offset++) {
      const card = batch.cards[offset]!;
      if (card.index !== offset + 1) {
        context.addIssue({
          code: "custom",
          path: ["cards", offset, "index"],
          message: `card must correspond to dealt mold #${offset + 1}`,
        });
      }
      for (const slot of Object.keys(SLOT_FIELDS) as InspirationSlotKey[]) {
        const field = SLOT_FIELDS[slot];
        const phrase = card[field];
        const fixed = locked[slot];
        if (fixed && phrase !== fixed.phrase) {
          context.addIssue({
            code: "custom",
            path: ["cards", offset, field],
            message: "locked slot must be preserved verbatim",
          });
        }
        if (!card.sentence.includes(phrase)) {
          context.addIssue({
            code: "custom",
            path: ["cards", offset, "sentence"],
            message: `sentence must contain ${field} verbatim`,
          });
        }
      }
    }

    for (const field of uniqueFields) {
      const slot = field as InspirationSlotKey;
      if (locked[slot]) continue;
      const values = batch.cards.map((card) => card[field]);
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: ["cards"],
          message: `${field} must not repeat within the batch`,
        });
      }
    }
    const sentences = batch.cards.map((card) => card.sentence);
    if (new Set(sentences).size !== sentences.length) {
      context.addIssue({
        code: "custom",
        path: ["cards"],
        message: "sentences must be unique within the batch",
      });
    }
  });
}

function buildSeedCard(
  input: InspirationRollRequest,
  bundle: InspirationMaterialBundle,
  generated: GeneratedCard,
) {
  const locked = input.lockedSlots ?? {};
  const slots = {
    identity:
      locked.identity ??
      generatedSlot(
        input.channel,
        "identity",
        bundle.identityHint!,
        generated.identity,
        bundle.index,
      ),
    anomalyRule:
      locked.anomalyRule ??
      generatedSlot(
        input.channel,
        "anomalyRule",
        bundle.anomalyHint,
        generated.anomalyRule,
        bundle.index,
      ),
    highValueCircle:
      locked.highValueCircle ??
      generatedSlot(
        input.channel,
        "highValueCircle",
        bundle.circleHint!,
        generated.highValueCircle,
        bundle.index,
      ),
    twistPressure:
      locked.twistPressure ??
      generatedSlot(
        input.channel,
        "twistPressure",
        bundle.twistHint,
        generated.twistPressure,
        bundle.index,
      ),
  } satisfies Record<InspirationSlotKey, InspirationSlotItem>;

  if (!TURN.test(generated.sentence))
    throw new Error("inspiration.hollow_seed");

  return InspirationSeedCardSchema.parse({
    id: `inspiration:llm:${input.seed ?? "random"}:${bundle.index}`,
    channel: input.channel,
    sentence: generated.sentence,
    slots,
    starterBlueprint: {
      suggestedTitle: generated.suggestedTitle,
      genreLabel:
        input.topic?.trim() ||
        input.keyword?.trim() ||
        (input.channel === "male"
          ? "原创男频"
          : input.channel === "female"
            ? "原创女频"
            : "类型幻想"),
      readerNeed:
        input.channel === "female" ? "偏爱与主动权" : "得意与阶层跃升",
      targetEmotion:
        input.channel === "female"
          ? "被偏爱、掌握命运"
          : "得意、惊艳、赢麻了",
      protagonistIdentity: slots.identity.phrase,
      advantageHook: slots.anomalyRule.phrase,
      targetCircle: slots.highValueCircle.phrase,
      openingTension: slots.twistPressure.phrase,
    },
  });
}

function generatedSlot(
  channel: InspirationChannel,
  slot: InspirationSlotKey,
  hint: InspirationSlotItem,
  phrase: string,
  index: number,
): InspirationSlotItem {
  return {
    ...hint,
    id: `llm:${index}:${slot}:${hint.id}`,
    slot,
    channels: [channel],
    label: phrase,
    phrase,
  };
}

function buildPrompt(
  input: InspirationRollRequest,
  bundles: readonly InspirationMaterialBundle[],
  topic: string,
): string {
  const locked = input.lockedSlots ?? {};
  const lockText = (Object.keys(locked) as InspirationSlotKey[])
    .map((slot) => `${slot}=「${locked[slot]!.phrase}」`)
    .join("；");
  const deals = bundles
    .map(
      (bundle) =>
        [
          `#${bundle.index}`,
          `① identityHint: ${renderHint(bundle.identityHint!)}`,
          `② anomalyHint: ${renderHint(bundle.anomalyHint)}`,
          `③ circleHint: ${renderHint(bundle.circleHint!)}`,
          `④ twistHint: ${renderHint(bundle.twistHint)}`,
        ].join("\n"),
    )
    .join("\n\n");

  return `主题 / 作品：${topic}
频道：${input.channel}
本批必须生成：${input.count} 条。

这不是自由脑暴。后台已经发了 #1～#${input.count} 共 ${input.count} 组 M03 / 四槽词库模具，你必须逐号一对一把“模具结构”翻译成「${topic}」的具体世界语义。

先在内部激活该主题真正有辨识度的世界观：人物、势力、职业、资源、规则、能力体系、社会门槛、高价值圈层与冲突关系。若主题是已有作品或历史题材，优先使用读者能识别的真实/原作语义，不要把它稀释成无名的通用玄幻占位词；若是原创题材，则建立内部一致的具体语义。

每条固定四槽，缺一不可：
① identity：具体身份 / 出生位置，必须一眼能见到人在世界哪里。
② anomalyRule：异常规则 / 外挂 / 玩法，必须能让男主主动做事。
③ highValueCircle：高价值人物群、势力、职业圈或资源入口，必须有价格和门槛。
④ twistPressure：明确对手、反向压力或危险信息，不能只是“变强了”。

硬规则：
- #N 必须明显继承 #N 发到的玩法/反转模具，不得跨号换牌，不得把 24 条写成同一个套路的改名版。
- 未锁定时，本批 identity、anomalyRule、highValueCircle 不得逐字重复，且应尽量在职业、力量、圈层和矛盾类型上拉开。
- sentence 必须逐字包含本条四个槽位字符串，并包含“没想到 / 却 / 但 / 不料 / 结果 / 反而”至少一个转折词。
- sentence 必须同时出现“能做什么”与“谁/什么因此形成反向压力”，禁止只有设定没有故事。
- 每条只返回一个 concise suggestedTitle；不要解释、点评、排序。
${lockText ? `- 锁槽：${lockText}。每一条对应字段必须逐字原样输出，只生成其余槽位。\n` : ""}
发牌如下：

${deals}

严格返回 JSON 合同中的 cards 数组，index 必须从 1 连续到 ${input.count}。\n`;
}

function renderHint(item: InspirationSlotItem): string {
  const source =
    item.sourceLibrary === "M03"
      ? `M03/${item.materialType ?? "?"}/${item.materialId ?? item.id}`
      : "slot-bank/" + item.id;
  return `[${source}] 「${item.phrase}」`;
}

function llmResponseSchema(count: number): JsonSchemaContract {
  return {
    name: "inspiration_slot_batch",
    description: `Exactly ${count} four-slot inspiration seeds`,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["cards"],
      properties: {
        cards: {
          type: "array",
          minItems: count,
          maxItems: count,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "index",
              "identity",
              "anomalyRule",
              "highValueCircle",
              "twistPressure",
              "sentence",
              "suggestedTitle",
            ],
            properties: {
              index: { type: "integer", minimum: 1, maximum: count },
              identity: { type: "string", minLength: 2, maxLength: 160 },
              anomalyRule: { type: "string", minLength: 2, maxLength: 180 },
              highValueCircle: { type: "string", minLength: 2, maxLength: 180 },
              twistPressure: { type: "string", minLength: 2, maxLength: 220 },
              sentence: { type: "string", minLength: 12, maxLength: 600 },
              suggestedTitle: { type: "string", minLength: 1, maxLength: 120 },
            },
          },
        },
      },
    },
  };
}

function samplingNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
