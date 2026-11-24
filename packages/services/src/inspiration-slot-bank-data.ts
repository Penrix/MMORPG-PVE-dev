import type {
  InspirationChannel,
  InspirationSlotItem,
  InspirationSlotKey,
} from "@narralume/contracts";

/**
 * One inspiration = one chain, not four independent slots.
 *
 * identity    where he stands (S0)
 * leverage    the rule that lets him move
 * gatekeeper  who owns the thing he wants, and what gate it sits behind
 * firstTake   what he actually walks away with the first time
 * inbound     who shows up because of that, carrying something more valuable
 *
 * A pack is one place or one organization. Chains inside a pack share a
 * world, so any chain in it can be dealt on its own without stitching two
 * unrelated stories together. Deals never mix chains.
 */
export interface InspirationChain {
  readonly id: string;
  readonly channel: InspirationChannel;
  readonly packId: string;
  readonly packLabel: string;
  readonly identity: string;
  readonly leverage: string;
  readonly gatekeeper: string;
  readonly firstTake: string;
  readonly inbound: string;
}

export const INSPIRATION_CHAINS: readonly InspirationChain[] = [
  // ── 男频 · 边镇军帐 ────────────────────────────────────────────────
  {
    id: "male-border-01",
    channel: "male",
    packId: "male-border",
    packLabel: "边镇军帐",
    identity: "边军粮草账房",
    leverage:
      "我记下的每一笔亏空，夜里会自己长出一条只有我能走的路，通向那批粮真正被藏的地方",
    gatekeeper: "边军统帅与三条粮道上的大粮商",
    firstTake:
      "我照着账目走了一夜，摸进一座没报过关的仓，手里多出三十车军粮的提货竹牌",
    inbound: "统帅派人来查账，来的是他亲儿子——他想借我这本账，换掉他爹的位置",
  },
  {
    id: "male-border-02",
    channel: "male",
    packId: "male-border",
    packLabel: "边镇军帐",
    identity: "军营伙夫",
    leverage: "吃我做的饭的人，会把明天最不想说的一句实话讲给我听",
    gatekeeper: "监军太监手里的密折与三千石过冬粮",
    firstTake: "一个亲兵扒完饭，说了句“监军今夜要烧粮”，我提前把粮车挪出了营",
    inbound:
      "监军先一步找上门，没杀我，反倒要我替他写一本假账，价码是让我当管粮官",
  },
  {
    id: "male-border-03",
    channel: "male",
    packId: "male-border",
    packLabel: "边镇军帐",
    identity: "替马看病的马夫",
    leverage: "我摸过的战马，会让我看见它上一任主人是怎么死的",
    gatekeeper: "将门嫡子的亲兵营与那匹御赐马",
    firstTake: "我在御赐马的眼里，看见老将军是被自己人从背后射穿的",
    inbound:
      "将门嫡子把马连同我一起要走，许我一个亲兵名额——条件是那句话永远烂在我肚子里",
  },

  // ── 男频 · 仙门药谷 ────────────────────────────────────────────────
  {
    id: "male-sect-01",
    channel: "male",
    packId: "male-sect",
    packLabel: "仙门药谷",
    identity: "药谷烧火杂役",
    leverage: "我烧剩的药渣，能还原那炉丹里最贵的一味药性",
    gatekeeper: "丹堂长老与内门首席弟子",
    firstTake:
      "我攒出一炉没人认得出品相的丹，转手卖给外门执事，换到一块能进内门的腰牌",
    inbound:
      "长老查出丹出自药谷，第一个来问的是首席——他要我替他炼，炼成了算他的",
  },
  {
    id: "male-sect-02",
    channel: "male",
    packId: "male-sect",
    packLabel: "仙门药谷",
    identity: "藏经阁扫地的",
    leverage: "被撕掉的书页，会在我眼前自己长回来",
    gatekeeper: "戒律堂与掌门亲传手里的半部禁术",
    firstTake:
      "我补全了半部禁术，抄本落到戒律堂手里，换到一次不必跪着说话的机会",
    inbound:
      "掌门亲自下到藏经阁，问我还记得多少页——他手里那半部，正好缺我这一半",
  },
  {
    id: "male-sect-03",
    channel: "male",
    packId: "male-sect",
    packLabel: "仙门药谷",
    identity: "灵兽园喂食的",
    leverage: "被我喂过的灵兽，会替我说出它主人藏得最深的一句话",
    gatekeeper: "圣女与掌教亲传的院子",
    firstTake: "一头灵兽当众说出了圣女私藏的东西，满园长老脸色都变了",
    inbound: "圣女没有杀我，反而把我调进她的院子——她要我先替她喂另一头",
  },

  // ── 男频 · 港城黑市 ────────────────────────────────────────────────
  {
    id: "male-port-01",
    channel: "male",
    packId: "male-port",
    packLabel: "港城黑市",
    identity: "码头记账的",
    leverage: "我记的货单，会显出一件没人报关的东西",
    gatekeeper: "三大帮口与海关稽查科",
    firstTake:
      "我从货单上认出一批军火，转手把消息卖给对家，换到一张能进内场的牌",
    inbound: "海关的人先来找我，开的价比帮口高——他们要我继续记，只记给他们看",
  },
  {
    id: "male-port-02",
    channel: "male",
    packId: "male-port",
    packLabel: "港城黑市",
    identity: "修船匠",
    leverage: "我修好的船，能短暂开进另一条没人走过的航线",
    gatekeeper: "走私船队与海事局",
    firstTake: "试航那晚我靠上一条不存在的栈桥，从空船上捡回一整箱货",
    inbound: "船队老大要我当领航，海事局同时贴出我的画像——两边开的价，我都能听",
  },
  {
    id: "male-port-03",
    channel: "male",
    packId: "male-port",
    packLabel: "港城黑市",
    identity: "殡仪馆背尸的",
    leverage: "我碰过的尸体会告诉我，他把钱藏在了哪",
    gatekeeper: "地下钱庄与警局的赃物科",
    firstTake: "我从一具无名尸身上摸到钱庄的暗号，取走第一笔没人认领的钱",
    inbound: "钱庄掌柜主动上门，不讨钱，只求我替他背下一具还没送来的尸体",
  },

  // ── 男频 · 拍卖行 ──────────────────────────────────────────────────
  {
    id: "male-auction-01",
    channel: "male",
    packId: "male-auction",
    packLabel: "夜拍场",
    identity: "拍卖行学徒",
    leverage: "经我手的拍品，会显出上一个买家肯出的底价",
    gatekeeper: "顶级藏家与世家账房",
    firstTake: "我在一场夜拍上看穿三家底牌，替一位藏家省下两千万，抽成够我脱身",
    inbound:
      "那位藏家把整场拍卖的委托交给我，包括一件他不想让任何人知道来源的东西",
  },
  {
    id: "male-auction-02",
    channel: "male",
    packId: "male-auction",
    packLabel: "夜拍场",
    identity: "私人保镖",
    leverage: "我挨过的打，会让我记住对手使过的每一招",
    gatekeeper: "地下拳场与财团老板",
    firstTake: "我在拳场连胜七场，被财团老板当场买走，成了他女儿的贴身保镖",
    inbound: "老板的对头先送来一份聘书，年薪翻倍——他要的只是我站到另一边",
  },
  {
    id: "male-auction-03",
    channel: "male",
    packId: "male-auction",
    packLabel: "夜拍场",
    identity: "老宅修缮工",
    leverage: "我拆开的墙里，会浮现这家人藏过、又砌回去的东西",
    gatekeeper: "世家三房的遗产争夺",
    firstTake: "我拆出一份被砌进墙里的遗嘱，抄了一份，原件留在原地",
    inbound: "三房人同时找上我，各开一个价——没有一个人问遗嘱上写的是谁",
  },

  // ── 女频 · 豪门婚宴 ────────────────────────────────────────────────
  {
    id: "female-wedding-01",
    channel: "female",
    packId: "female-wedding",
    packLabel: "豪门婚宴",
    identity: "豪门婚礼策划师",
    leverage: "我剪断婚纱丝线，就能看见一段被瞒下来的婚约",
    gatekeeper: "顶级豪门继承人圈",
    firstTake: "我在一场临时取消的婚礼上剪断头纱，看见了新郎的另一份婚约",
    inbound: "没想到三家人同时找我要那截丝线，各开一个价，谁都不肯说为什么",
  },
  {
    id: "female-wedding-02",
    channel: "female",
    packId: "female-wedding",
    packLabel: "豪门婚宴",
    identity: "高奢珠宝维修学徒",
    leverage: "修复珠宝时，我能听见上一代女主人的秘密",
    gatekeeper: "国际珠宝收藏家圈",
    firstTake: "我修好一枚旧戒指，听见原主人亲口说出遗嘱要怎么改",
    inbound: "却被告知，这枚戒指的继承人已经找了它十年——她出的价是一座工作室",
  },
  {
    id: "female-wedding-03",
    channel: "female",
    packId: "female-wedding",
    packLabel: "豪门婚宴",
    identity: "旧城区私人化妆师",
    leverage: "我化的妆，能改写对象在旁人眼里的第一印象",
    gatekeeper: "顶流影帝与资本局",
    firstTake: "我给一个被雪藏的演员改了一次妆，他当天被导演点名进组",
    inbound: "结果影帝的经纪人连夜找上门，只求我以后别再给别人化",
  },

  // ── 女频 · 深宅宫闱 ────────────────────────────────────────────────
  {
    id: "female-mansion-01",
    channel: "female",
    packId: "female-mansion",
    packLabel: "深宅宫闱",
    identity: "世家祠堂抄经女史",
    leverage: "我抄家谱时，能看见被抹去的那个继承人名字",
    gatekeeper: "皇室后宫与权臣家眷",
    firstTake: "我抄出一页被刮掉的名字，顺着它找到那个还活着的人",
    inbound: "但掌家的老夫人先一步把我叫去，让我把那一页忘掉，许我一座别院",
  },
  {
    id: "female-mansion-02",
    channel: "female",
    packId: "female-mansion",
    packLabel: "深宅宫闱",
    identity: "宫廷绣坊末等绣娘",
    leverage: "我每绣出一只凤凰，就能唤醒一条失传的宫廷密令",
    gatekeeper: "皇室后宫与权臣家眷",
    firstTake: "我绣完一只凤，绣绷上浮出一道废太子的赦令",
    inbound: "不料皇后身边的女官亲自来取这只绣绷，还说皇后要见我",
  },
  {
    id: "female-mansion-03",
    channel: "female",
    packId: "female-mansion",
    packLabel: "深宅宫闱",
    identity: "古堡里的临时女管家",
    leverage: "我能看见每一位贵族来客身上挂着的谎言标价",
    gatekeeper: "豪门联姻名利场",
    firstTake: "我在一场订婚宴上看穿三家的底价，替主家省下一半聘礼",
    inbound: "没想到主家把整座古堡的钥匙交给了我，包括那间不许开的",
  },

  // ── 女频 · 名利场 ──────────────────────────────────────────────────
  {
    id: "female-spotlight-01",
    channel: "female",
    packId: "female-spotlight",
    packLabel: "名利场",
    identity: "顶流剧组服装助理",
    leverage: "我替演员试穿戏服，能预演她未来最出名的那一场",
    gatekeeper: "电影节红毯与影后争夺局",
    firstTake: "我替替补演员试了一件戏服，看见她三年后站在领奖台上",
    inbound: "结果原定女主连夜换了造型师，点名要我去她组里",
  },
  {
    id: "female-spotlight-02",
    channel: "female",
    packId: "female-spotlight",
    packLabel: "名利场",
    identity: "拍卖行遗物整理师",
    leverage: "我触碰遗物，就能重播它最贵的一次交易",
    gatekeeper: "顶级藏家与遗产拍卖会",
    firstTake: "我从一只旧箱子里翻出一段从没被出过价的交易，记下了买家名字",
    inbound: "但拍卖行老板要我把它从目录里删掉，条件是从此每场拍卖都带我",
  },
  {
    id: "female-spotlight-03",
    channel: "female",
    packId: "female-spotlight",
    packLabel: "名利场",
    identity: "贵族学院代课老师",
    leverage: "我教给学生的东西，会在现实里结成能交换的好运",
    gatekeeper: "贵族学院继承人社交圈",
    firstTake: "我随口点拨一个差生，他家里第二天签成一笔大单",
    inbound: "结果全班家长排队要把孩子换到我的课，校董却先来查我的来历",
  },

  // ── 女频 · 新赛道 ──────────────────────────────────────────────────
  {
    id: "female-agenda-01",
    channel: "female",
    packId: "female-agenda",
    packLabel: "新赛道",
    identity: "财阀家族私人营养师",
    leverage: "我做的家常菜，能临时改写食客当天的运势",
    gatekeeper: "财阀家族董事会",
    firstTake: "我给一个被排挤的董事做了一顿饭，他第二天就拿下了表决",
    inbound: "没想到董事长亲自点名要我进宅子，只做他一个人的饭",
  },
  {
    id: "female-agenda-02",
    channel: "female",
    packId: "female-agenda",
    packLabel: "新赛道",
    identity: "电竞俱乐部战队分析员",
    leverage: "我看一眼录像，就能预知队伍下一次关键失误",
    gatekeeper: "顶尖职业战队与巨额赞助商",
    firstTake: "我在赛前点出三处失误，弱队赢了冠军，奖金分了我一份",
    inbound: "结果资本方连夜改收购方案，条件里加了我的名字",
  },
  {
    id: "female-agenda-03",
    channel: "female",
    packId: "female-agenda",
    packLabel: "新赛道",
    identity: "仙门灵兽园喂养女弟子",
    leverage: "我喂过的灵兽，会替我说出它主人压在心底的那句话",
    gatekeeper: "仙门圣女与掌教亲传圈",
    firstTake: "一头灵兽当众说出圣女藏起来的那个人，满园弟子都听见了",
    inbound: "圣女没有罚我，把我调进她的院子，要我替她喂另一头",
  },

  // ── 混合 · 午夜街铺 ────────────────────────────────────────────────
  {
    id: "hybrid-street-01",
    channel: "hybrid",
    packId: "hybrid-street",
    packLabel: "午夜街铺",
    identity: "老城区按摩师",
    leverage: "我按对穴位，能改掉一个人一时的情绪",
    gatekeeper: "黑帮老大与片警",
    firstTake: "我给一个腰痛的老客按完，他当场把一条街的场子交给我看",
    inbound: "第二天片警上门，说那条街的账本在他手里，问我昨晚按的是哪一下",
  },
  {
    id: "hybrid-street-02",
    channel: "hybrid",
    packId: "hybrid-street",
    packLabel: "午夜街铺",
    identity: "便利店夜班店员",
    leverage: "我打出的收银小票，会印出顾客明天要做的一个选择",
    gatekeeper: "跨江财团与地下钱庄",
    firstTake: "我打出一张“明天三点，转账八千万”的小票，留了一份底",
    inbound: "财团的人来买这张小票，钱庄的人来抢——两边都以为我只剩一张",
  },
  {
    id: "hybrid-street-03",
    channel: "hybrid",
    packId: "hybrid-street",
    packLabel: "午夜街铺",
    identity: "乡镇兽医",
    leverage: "我治好的牲畜，会替主人说出一句它听来的话",
    gatekeeper: "县里的养殖大户与收购商",
    firstTake: "一头牛开口说出收购商压价的内幕，我转手把话卖给了大户",
    inbound: "大户把全村兽医的活都包给我，收购商派了人来我的棚里",
  },

  // ── 混合 · 异界入口 ────────────────────────────────────────────────
  {
    id: "hybrid-threshold-01",
    channel: "hybrid",
    packId: "hybrid-threshold",
    packLabel: "异界入口",
    identity: "废弃游乐园守夜人",
    leverage: "午夜开动的设施，会把人送到另一个地方",
    gatekeeper: "异界远征队与本地商会",
    firstTake: "我坐了一趟摩天轮，从对面带回一块这里没有的矿石",
    inbound: "远征队包下整座园子，要我当向导——商会同时在门口等我开价",
  },
  {
    id: "hybrid-threshold-02",
    channel: "hybrid",
    packId: "hybrid-threshold",
    packLabel: "异界入口",
    identity: "末班地铁司机",
    leverage: "末班车每晚多出一节车厢，坐着的都是还没到的人",
    gatekeeper: "城市应急办与秘密调查局",
    firstTake: "我从那节车厢里带下一个自称明天会死的人",
    inbound: "调查局封锁整条线，却先来问我他死在哪，愿用一个编制换",
  },
  {
    id: "hybrid-threshold-03",
    channel: "hybrid",
    packId: "hybrid-threshold",
    packLabel: "异界入口",
    identity: "深夜电台接线员",
    leverage: "求助电话里，我能听见另一个时空的回声",
    gatekeeper: "失踪者家属与警方",
    firstTake: "我接起一通二十年前的求助，报出了埋尸的地点",
    inbound: "警方不信，家属带着钱来了，还带来一张同名失踪者的照片",
  },

  // ── 混合 · 老物件 ──────────────────────────────────────────────────
  {
    id: "hybrid-relic-01",
    channel: "hybrid",
    packId: "hybrid-relic",
    packLabel: "老物件",
    identity: "民俗博物馆库管",
    leverage: "月圆那晚，库房里的标本会活过来一刻钟",
    gatekeeper: "收藏家与文物贩子",
    firstTake: "一只标本指给我看，库房里哪一件被换成了假的",
    inbound: "收藏家开价买我的嘴，文物贩子开始在我下班路上等",
  },
  {
    id: "hybrid-relic-02",
    channel: "hybrid",
    packId: "hybrid-relic",
    packLabel: "老物件",
    identity: "修锁师傅",
    leverage: "我配出的钥匙，能打开主人早就忘掉的一扇门",
    gatekeeper: "老宅继承人与拆迁办",
    firstTake: "我给一户人家配钥匙，顺手开出一间封了三十年的房",
    inbound: "拆迁办和继承人同一天找上门，一个要拆，一个要我作证",
  },
  {
    id: "hybrid-relic-03",
    channel: "hybrid",
    packId: "hybrid-relic",
    packLabel: "老物件",
    identity: "旧书店收银员",
    leverage: "旧书里的空白页，会自己写出明天要发生的事",
    gatekeeper: "学者与拍卖行",
    firstTake: "一本旧书提前写出明天的头条，我照着它躲过一场车祸",
    inbound: "学者要买这本书，拍卖行要买我这个人",
  },

  // ── 混合 · 雨夜救援 ────────────────────────────────────────────────
  {
    id: "hybrid-rescue-01",
    channel: "hybrid",
    packId: "hybrid-rescue",
    packLabel: "雨夜救援",
    identity: "暴雨天的道路救援员",
    leverage: "我救出来的每个人，都会给我一张只有他能看懂的地图",
    gatekeeper: "被困的富豪与救援队",
    firstTake: "我从隧道里拖出一个老板，他给了我一张画着公司地下通道的纸",
    inbound: "老板的对手先找到我，出三倍价钱买那张纸，还说老板已经签了放弃救援",
  },
  {
    id: "hybrid-rescue-02",
    channel: "hybrid",
    packId: "hybrid-rescue",
    packLabel: "雨夜救援",
    identity: "山村药铺学徒",
    leverage: "我煎药时，能看见病人命里一个绕不过去的断点",
    gatekeeper: "县医院与药材商",
    firstTake: "我看出一位老村医三天后会出事，提前把他从那条路上拦了下来",
    inbound: "药材商先来封口，县医院后脚来请人，两边都说认识我师父",
  },
  {
    id: "hybrid-rescue-03",
    channel: "hybrid",
    packId: "hybrid-rescue",
    packLabel: "雨夜救援",
    identity: "流动餐车厨师",
    leverage: "吃下这口饭的人，会想起一件自己忘掉的事",
    gatekeeper: "夜市地头蛇与美食评审",
    firstTake: "一个混子吃完哭着说出老大埋钱的地方，满摊子人都听见了",
    inbound: "评审当场要给我一个固定摊位，地头蛇来收保护费，顺手把那混子带走了",
  },
];

const CHAIN_SLOT_FIELDS = {
  identity: "identity",
  anomalyRule: "leverage",
  highValueCircle: "gatekeeper",
  twistPressure: "inbound",
} as const satisfies Record<InspirationSlotKey, keyof InspirationChain>;

/** Derived slot view kept for the LLM mold API and pool statistics. */
export const BUILTIN_INSPIRATION_SLOT_BANK: readonly InspirationSlotItem[] =
  INSPIRATION_CHAINS.flatMap((chain) =>
    (Object.keys(CHAIN_SLOT_FIELDS) as InspirationSlotKey[]).map((slot) => {
      const phrase = chain[CHAIN_SLOT_FIELDS[slot]] as string;
      return {
        id: "chain:" + chain.id + ":" + slot,
        slot,
        channels: [chain.channel],
        label: phrase,
        phrase,
        sourceLibrary: "slot-bank" as const,
        materialType: null,
        tags: [chain.channel, slot, chain.packId, chain.id],
      };
    }),
  );
