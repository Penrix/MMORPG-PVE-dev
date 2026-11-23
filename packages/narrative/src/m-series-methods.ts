import type { CreativeMethodScope } from "@narralume/contracts";

export type CreativeMethodPhase =
  | "project-seed"
  | "story-search"
  | "story-design"
  | "long-form"
  | "character-design"
  | "migration"
  | "performance"
  | "casting"
  | "verification";

export interface CreativeMethodDefinition {
  methodFamily: string;
  methodId: string;
  title: string;
  sourceRef: string;
  scope: CreativeMethodScope;
  phases: readonly CreativeMethodPhase[];
  storySearchEligible: boolean;
  requiresMaterials: boolean;
  minimumMaterials?: number;
  requiredMaterialTypes?: readonly string[];
  requiresPriorStoryState: boolean;
  useWhen: string;
  avoidWhen: string;
  instruction: string;
}

const DOC26 = "docs/mmorpg/26-m-series-tr02-creative-method-catalog.md";

export const CREATIVE_METHOD_DEFINITIONS: readonly CreativeMethodDefinition[] =
  [
    {
      methodFamily: "M01A",
      methodId: "m01a-playability",
      title: "六问可玩性搜索",
      sourceRef: `${DOC26}#2-m01a六问可玩性搜索`,
      scope: "story",
      phases: ["story-search", "story-design"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "当前已经有具体世界对象，但不知道这些人、能力、资源、规则和关系还能怎样发生新的高价作用。",
      avoidWhen:
        "Story Director 连当前目标和故事问题都没有确定时，不要用它替代上位编剧决策。",
      instruction:
        "先清点当前真正有价格的具体对象，再搜索对象之间的新作用；让男主按P_A选择怎么下手，让其他人物按自己的欲望与筹码主动回应；比较哪种可能最值得Reader消费，并追问这次行动留下什么可再用的人、关系、资格、资产或新入口。六问是观察方向，不是六格表。",
    },
    {
      methodFamily: "M01B",
      methodId: "m01b-three-consciousness",
      title: "三意识深层搜索",
      sourceRef: `${DOC26}#3-m01b三意识深层搜索`,
      scope: "story",
      phases: ["story-search", "story-design"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "当前事件因果基本可行，但升级价格、人物主动找事或Reader观看张力太薄。",
      avoidWhen:
        "不要把升级、人物行动、张力机械变成三步剧情流程，也不要临时造反派代替真实人物因果。",
      instruction:
        "同时从三种意识搜索：升级意识寻找S0到真正变贵的S1及解锁对象；人物因果意识寻找本来就有欲望、资源和触发条件的高因果人物；Reader张力意识寻找谁知道什么、误判什么、哪一拍最值得等待和兑现。三者允许互相反推和回返。",
    },
    {
      methodFamily: "M02",
      methodId: "m02-six-chain",
      title: "六条思维链",
      sourceRef: `${DOC26}#4-m02六条思维链`,
      scope: "story",
      phases: ["story-search", "story-design"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "第一批答案过于熟悉、同质或已经卡在一条惯性路径，需要真正改变搜索运动。",
      avoidWhen:
        "不要为了显示完整而把六条链全部跑一遍，也不要先锁定结局再倒填六链。",
      instruction:
        "根据当前卡点只选真正需要的搜索运动：星型打开根本不同方向；网状寻找两张高价牌的特殊接口和双向增值；树型改变承重条件继续分叉；对立反转一个明确默认预设并追真实后果；维度交叉让旧玩法撞上不同世界维度；链式从人物真实下一手继续生长。允许重复、回返、换链，不按固定顺序。",
    },
    {
      methodFamily: "M03",
      methodId: "m03-five-anchor",
      title: "TR02五锚点N案快搜",
      sourceRef: `${DOC26}#5-m03tr02-三战略--五锚点-n-案快搜`,
      scope: "story",
      phases: ["project-seed"],
      storySearchEligible: false,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen: "新书或新方案早期，需要快速拉开多个底层赢法不同的候选。",
      avoidWhen:
        "不要在当前Story节点里重抽整书RULE/GF/CP/END，也不要把五锚点当完整故事。",
      instruction:
        "在同一题材/IP内，以市场接受度、AI生产效率、可持续爽感三项AND筛选，围绕RULE、GF、CP起势过程高潮、END/GOAL/SCALE快速分叉，并明确每案主角靠什么赢、赢到什么；未要求深化时不要填满21槽。",
    },
    {
      methodFamily: "M03",
      methodId: "m03-select",
      title: "成熟素材SELECT",
      sourceRef: `${DOC26}#6-m03-历史有效方法select--compose--verify`,
      scope: "story",
      phases: ["story-search", "verification"],
      storySearchEligible: false,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "当前缺口已经明确，需要先从成熟素材库检索少量真正匹配的创意对象。",
      avoidWhen:
        "SELECT本身不生成故事；没有接入素材检索服务时不要假装已经查过数据库。",
      instruction:
        "围绕当前真实问题，从可回读素材库选择少量相容组件，保留来源、类别、原义、适用对象和误用边界；没有合适素材就返回没有，不硬塞。",
    },
    {
      methodFamily: "M03",
      methodId: "m03-compose",
      title: "成熟素材COMPOSE",
      sourceRef: `${DOC26}#6-m03-历史有效方法select--compose--verify`,
      scope: "story",
      phases: ["story-search", "story-design"],
      storySearchEligible: true,
      requiresMaterials: true,
      minimumMaterials: 1,
      requiresPriorStoryState: false,
      useWhen:
        "已经召回了M03等成熟素材，需要让素材真正撞到当前世界对象，而不是停在标签。",
      avoidWhen:
        "没有CreativeMaterialSelection时不要选择COMPOSE，也不能让素材自动变成Reality。",
      instruction:
        "把已选成熟素材作用到具体高价对象X：男主凭实际手段R下手，素材只提供特殊机制；另一人物按自己的利益和认知回应；明确Reader可见兑现Y，以及Y留下的资产、关系或新问题。不同候选必须是机制不同，不是换名。",
    },
    {
      methodFamily: "M03",
      methodId: "m03-verify",
      title: "成熟玩法VERIFY",
      sourceRef: `${DOC26}#6-m03-历史有效方法select--compose--verify`,
      scope: "story",
      phases: ["verification"],
      storySearchEligible: false,
      requiresMaterials: true,
      requiresPriorStoryState: false,
      useWhen: "已有候选，需要验它到底有没有真正兑现某个成熟玩法。",
      avoidWhen:
        "不要把事后对应伪装成此前就是由该素材驱动，也不要用评分替代具体证据。",
      instruction:
        "核查素材来源、实际动作、Reader可见兑现、P_A、Concept权限和连续性，返回PASS/PARTIAL/FAIL及最小修正。",
    },
    {
      methodFamily: "M04",
      methodId: "m04-mature-story-prototype",
      title: "成熟故事原型复入",
      sourceRef: `${DOC26}#7-m04成熟故事原型复入--当前世界重写人物因果`,
      scope: "story",
      phases: ["story-search", "story-design"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "GF、CP、OS等标签都有，但仍只能得到展示才华、众人震惊、美女欣赏之类空故事。",
      avoidWhen:
        "不要只报作品名或套路标签；不能复制原作人物事件顺序，也不能把悲剧净亏原样留给男主。",
      instruction:
        "主动唤起可辨认的成熟故事人物因果：谁想要什么、谁掌握什么、谁借谁、谁误认谁、谁因此采取第二手；再把真正好看的因果迁到当前世界，重配人物、准入价格、男主主动权、GF作用、收益归属和后续资产。原型只是先验，不是Reality。",
    },
    {
      methodFamily: "M05",
      methodId: "m05-play-variation",
      title: "PLAY反差与新鲜感增补",
      sourceRef: `${DOC26}#8-m05play-反差与新鲜感增补`,
      scope: "story",
      phases: ["story-search", "story-design"],
      storySearchEligible: true,
      requiresMaterials: true,
      minimumMaterials: 1,
      requiredMaterialTypes: ["PLAY"],
      requiresPriorStoryState: true,
      useWhen:
        "当前底层赢法已经成立，但演法太直、太单、缺少可以反复变化的操作机制。",
      avoidWhen:
        "不重选RULE/GF/CP/OS/END，不借PLAY偷加新能力，也不拿反差去掩盖本来就不成立的故事。",
      instruction:
        "先找当前身份、知识、价格、规则、职业/私生活、关系或公开度中尚未利用的落差；在不改变原赢法的前提下设计一种可重复PLAY。至少试演一次具体互动，再改变一个有意义条件做第二次变奏，证明不是同一套低估→震惊复制。",
    },
    {
      methodFamily: "M06",
      methodId: "m06-long-form-score",
      title: "故事总谱与具体T长篇运行",
      sourceRef: `${DOC26}#9-m06故事总谱--具体-t-长篇运行`,
      scope: "story",
      phases: ["story-search", "long-form"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: true,
      useWhen:
        "长篇已经留下旧资产、人物线、具体T或未结关系，需要判断它们怎样继续供戏、交叉、换挡和复利。",
      avoidWhen:
        "不要把Active误读成下一章必须写，也不要把未取得的未来资产当成当前真实输入。",
      instruction:
        "恢复当前真实T的对象X→稳定做法R→已取得Y，以及仍在活着的Story Movement。按问题检查T供料、人物线状态、Reader主奏换挡、对象适配、自然交汇、跨区段延续、事实更新或删除旧Y后的反事实检验。只使用已发生资产作为下一手真实输入。",
    },
    {
      methodFamily: "M07",
      methodId: "m07-character-cause-rebuild",
      title: "男主人格果因重建",
      sourceRef: `${DOC26}#10-m07男主人格果--因重建`,
      scope: "protagonist_build",
      phases: ["character-design"],
      storySearchEligible: false,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "需要保留成功人物的行为味道，但不能复制原履历或只剩几个性格标签。",
      avoidWhen:
        "不要在普通当前Story搜索里突然重造男主，也不要用一段童年创伤解释全部行为。",
      instruction:
        "从A正文恢复能预测下一手的行为果、欲望次序、本事、手段与边界，再在B世界反推不同但足以生出这些果的成长史与关系，并用陌生场景检验。",
    },
    {
      methodFamily: "M08",
      methodId: "m08-concept-engine-migration",
      title: "Story Concept×Story Engine双轨迁移",
      sourceRef: `${DOC26}#11-m08成功旧书-story-concept--story-engine-双轨迁移`,
      scope: "story",
      phases: ["migration", "project-seed"],
      storySearchEligible: false,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "把成功旧书A迁到新地图B，需要同时保留它卖的男人生活和长期供戏机制。",
      avoidWhen:
        "不要只换时代、职业、城市、女人或GF，也不要直接搬A的卷章事件顺序。",
      instruction:
        "分别恢复A-Concept和A-Engine，再分别迁到B：B中如何继续卖同一种高价男性人生，B中哪些具体T、关系和社会接口继续供戏，最后互相校准。",
    },
    {
      methodFamily: "M09",
      methodId: "m09-performance-semantics",
      title: "Reader情绪演奏转译",
      sourceRef: `${DOC26}#12-m09reader-情绪乐句--演奏语义--b-新戏`,
      scope: "scene",
      phases: ["performance", "story-search", "story-design"],
      storySearchEligible: false,
      requiresMaterials: true,
      requiresPriorStoryState: false,
      useWhen:
        "当前因果能写通但不好看，需要借成功样本恢复这一场Reader到底吃什么、怎么演才有味道。",
      avoidWhen:
        "没有A场景或可靠演奏素材时不要伪称已提取原著乐句，也不要把A表面事件直接换皮。",
      instruction:
        "从已提供的成熟演奏素材中分开事实、Reader体验和演奏语义，再用短导演句回到B当前对象搜索新动作。P_A决定这个男人怎样活，演奏语义决定这一场想让Reader吃什么，搜索方法决定往哪里找，三者不得混同。",
    },
    {
      methodFamily: "M10",
      methodId: "m10-crossworld-casting",
      title: "多圈人物动力与A/B选角",
      sourceRef: `${DOC26}#13-m10多圈人物动力--三个-why--ab-选角`,
      scope: "relationship",
      phases: ["casting", "migration"],
      storySearchEligible: false,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen: "A书人物关系很贵，换B地图后不知道为什么该换成谁。",
      avoidWhen: "不要按职位、官衔、社会地位或单一功能位机械对位。",
      instruction:
        "先恢复A的圈子与独立事务，再拆Why-A-casting、Why-A-character、Why-B-choice。真正替换单位是圈子+欲望+关系+策略+后果+Reader价格+长篇资产。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-matrix-combine",
      title: "矩阵组合",
      sourceRef: `${DOC26}#15-tr02-方法去重后的可调用动作表`,
      scope: "story",
      phases: ["project-seed", "story-search"],
      storySearchEligible: true,
      requiresMaterials: true,
      minimumMaterials: 2,
      requiresPriorStoryState: false,
      useWhen: "已有多种成熟创意对象，希望寻找它们互相增值的化学反应。",
      avoidWhen:
        "不要随机拼贴互不相干的标签；至少要解释组合后为什么出现新的作用机制。",
      instruction:
        "从少量成熟对象中寻找相互增益的接口，说明组合前各自最贵的性质、组合后新增的作用和人物选择；没有新增机制就判为弱组合。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-open-association",
      title: "开放联想召回",
      sourceRef: `${DOC26}#146-微观元素矩阵-v13开放式数据库加权检索`,
      scope: "story",
      phases: ["project-seed", "story-search"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "当前素材库方向有价值，但召回过窄，需要在高权重方向外继续调用模型的影视、小说、游戏、现实经验。",
      avoidWhen:
        "不能脱离当前世界对象自由漂移，也不能把模型联想到的东西伪称素材库已存在。",
      instruction:
        "把当前对象与已有高价值方向当搜索锚，不封死在数据库里；继续跨影视、小说、游戏、现实案例联想，分清库内对象和模型新候选，并把新联想重新落到当前具体人事物。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-anti-inertia",
      title: "反惰性跨域组合",
      sourceRef: `${DOC26}#148-v23-策略驱动反惰性-vs-爆款热插拔`,
      scope: "story",
      phases: ["project-seed", "story-search"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "模型总把某种能力、人物或玩法放回最熟悉的原配环境，需要故意打破第一先验。",
      avoidWhen:
        "跨域不是越怪越好；必须重新解释它为什么能在当前世界成立并产生Reader价值。",
      instruction:
        "先指出当前默认原配是什么，再故意禁止该原配，寻找性质不同的职业、时代、阶层、关系或制度接口；只保留能在当前世界重新成立、且确实长出新玩法的候选。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-hot-swap",
      title: "成熟基座热插拔",
      sourceRef: `${DOC26}#148-v23-策略驱动反惰性-vs-爆款热插拔`,
      scope: "story",
      phases: ["project-seed", "story-search"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: true,
      useWhen:
        "当前方案的承重基座已经很好，只想改变一两个高杠杆变量获得新鲜感。",
      avoidWhen: "不能借热插拔把整本Concept、男主核心或底层赢法一起换掉。",
      instruction:
        "先锁住已经验证的承重基座，只替换一个或少数高杠杆变量，如开局困境、关系位置、社会接口、对象或局部矛盾；比较替换前后新增的具体行动和Reader趣味。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-theme-5d",
      title: "题材五维深潜",
      sourceRef: `${DOC26}#1410-v30-主题深潜先理解赛道再组合`,
      scope: "world",
      phases: ["project-seed"],
      storySearchEligible: false,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen: "组合之前对赛道理解太浅，容易把不相容的东西硬拼。",
      avoidWhen: "当前世界对象已经明确时，不要用五维分析替代具体故事创作。",
      instruction:
        "从规则/力量体系、社会结构、核心矛盾、关键势力、时代/氛围五维理解赛道，再选择可用组件。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-hunting-ground",
      title: "猎场扫描",
      sourceRef: `${DOC26}#1412-v35-remake--v36-diamond-class猎场非对称优势冲突战利品`,
      scope: "story",
      phases: ["project-seed", "story-search"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "世界对象很多，但不知道哪些时机、靶子、资产、生态位、规则入口最值得男主下手。",
      avoidWhen:
        "不能变成百科扫描；只扫描与当前目标和男主主动行动有关的高价入口。",
      instruction:
        "围绕当前目标扫描时机、靶子、资产、生态位、介入点、风险、爽感放大、剧情惯性、势力人脉、规则解释权，找能让男主真实下手并留下战利品的入口。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-jump-random",
      title: "跳跃随机生成",
      sourceRef: `${DOC26}#1413-v23-r-连载生存改进稿双引擎`,
      scope: "story",
      phases: ["project-seed", "story-search"],
      storySearchEligible: true,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen: "需要故意寻找低概率但有潜力的连接，避免所有候选都落回稳妥套路。",
      avoidWhen:
        "一个候选只保留一个真正高跳跃核心，不要同时塞五个奇点；跳跃后仍要落回人物行动和当前Reality。",
      instruction:
        "先产生一个真正跨远的连接，再用树型归类、链式深挖把它落回当前人物和世界；若无法产生清楚的行动、收益和后续，就把它降级为弱枝。",
    },
    {
      methodFamily: "TR02",
      methodId: "tr02-serial-survival",
      title: "连载生存压力测试",
      sourceRef: `${DOC26}#1413-v23-r-连载生存改进稿双引擎`,
      scope: "story",
      phases: ["project-seed", "verification"],
      storySearchEligible: false,
      requiresMaterials: false,
      requiresPriorStoryState: false,
      useWhen:
        "候选已经有趣，需要检查它是不是只有三章脑洞，还是能持续到上架和长篇扩张。",
      avoidWhen:
        "它是候选压力测试，不是讲师Story Director，也不能靠评分把一个无故事的设定救活。",
      instruction:
        "检查一句话卖点、男主行动、黄金三章、三万字循环、十万字/上架、长篇扩张和生产风险；失败应指出具体断点。",
    },
  ] as const;

export function getCreativeMethodDefinition(
  methodId: string,
): CreativeMethodDefinition | null {
  return (
    CREATIVE_METHOD_DEFINITIONS.find(
      (definition) => definition.methodId === methodId,
    ) ?? null
  );
}

export interface CreativeMethodEligibilityInput {
  materials: readonly { materialType: string }[];
  hasPriorStoryState: boolean;
}

export function creativeMethodEligibilityIssue(
  definition: CreativeMethodDefinition,
  input: CreativeMethodEligibilityInput,
): string | null {
  if (definition.requiresPriorStoryState && !input.hasPriorStoryState) {
    return "requires prior story state";
  }

  const minimumMaterials = definition.minimumMaterials ?? 1;
  if (
    definition.requiresMaterials &&
    input.materials.length < minimumMaterials
  ) {
    return `requires at least ${minimumMaterials} creative material(s)`;
  }

  if (definition.requiredMaterialTypes?.length) {
    const required = new Set(
      definition.requiredMaterialTypes.map((value) => value.toUpperCase()),
    );
    const hasRequiredType = input.materials.some((material) =>
      required.has(material.materialType.toUpperCase()),
    );
    if (!hasRequiredType) {
      return `requires material type: ${definition.requiredMaterialTypes.join(
        " | ",
      )}`;
    }
  }

  return null;
}

export function storySearchMethodDefinitions(
  input: CreativeMethodEligibilityInput,
): CreativeMethodDefinition[] {
  return CREATIVE_METHOD_DEFINITIONS.filter(
    (definition) =>
      definition.storySearchEligible &&
      creativeMethodEligibilityIssue(definition, input) === null,
  );
}
