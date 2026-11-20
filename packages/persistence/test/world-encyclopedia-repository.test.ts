import {
  createCanonEntity,
  createCanonFact,
  createProject,
  type CanonEntity,
} from "@narralume/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  SqliteCanonRepository,
  SqliteProjectRepository,
  SqliteWorldEncyclopediaRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now = "2026-11-20T00:00:00.000Z";
let database: NodeNarrativeDatabase | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

function addEntity(
  projectId: string,
  id: string,
  name: string,
  type: CanonEntity["type"],
): void {
  const canon = new SqliteCanonRepository(database!);
  canon.insertEntity(
    createCanonEntity({
      id,
      projectId,
      name,
      type,
      description: name + "是世界的独立实体，不是组织简介中的无链接文字",
      now,
    }),
  );
}
function addEvent(
  id: string,
  title: string,
  sequence: number,
  era: string,
): void {
  database!.raw
    .prepare(
      `
    INSERT INTO timeline_events(
      id,project_id,title,description,story_time_start,sequence,
      visibility,source_id,created_at,updated_at
    ) VALUES (?,?,?, ?,?,?,'omniscient',?,?,?)
  `,
    )
    .run(
      id,
      "naruto",
      title,
      title + "的编年史事实条目",
      era,
      sequence,
      "sample-source",
      now,
      now,
    );
}
function addRelation(
  id: string,
  from: string,
  to: string,
  relation: string,
  lifecycle = "active",
): void {
  database!.raw
    .prepare(
      `
    INSERT INTO relationship_events(
      id,project_id,from_entity_id,to_entity_id,relation,state_json,story_time,
      source_id,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `,
    )
    .run(
      id,
      "naruto",
      from,
      to,
      relation,
      JSON.stringify({
        lifecycle,
        description: "在木叶世界中有真实影响和历史含义",
      }),
      "建村前后",
      "sample-source",
      now,
    );
}

describe("v0.1-v0.7 world encyclopedia database over the ONE NarraLume Canon", () => {
  it("assembles a real clan dossier with history, founding members, duties, stances, evaluators and influential people", () => {
    database = new NodeNarrativeDatabase();
    expect(database.migrate()).toBe(52);
    const projects = new SqliteProjectRepository(database);
    projects.insert(
      createProject({ id: "naruto", title: "火影同人世界资料工程", now }),
    );
    projects.insert(createProject({ id: "other", title: "独立原创世界", now }));
    for (const [id, name, type] of [
      ["uchiha", "宇智波一族", "organization"],
      ["konoha", "木叶隐村", "location"],
      ["leaf_authority", "木叶高层", "organization"],
      ["police", "木叶警务部队", "organization"],
      ["madara", "宇智波斑", "character"],
      ["hashirama", "千手柱间", "character"],
      ["fugaku", "宇智波富岳", "character"],
      ["itachi", "宇智波鼬", "character"],
      ["shisui", "宇智波止水", "character"],
      ["sharingan", "写轮眼", "rule"],
      ["governance", "家族治理与村内权力分配", "concept"],
    ] as const)
      addEntity("naruto", id, name, type);
    addEntity("other", "other_clan", "异世界家族", "organization");
    addRelation("founder", "madara", "uchiha", "historical_leadership");
    addRelation("member", "fugaku", "uchiha", "clan_head");
    addRelation("police-org", "police", "konoha", "polices");
    addRelation(
      "clan-police",
      "uchiha",
      "police",
      "historical_institutional_role",
    );
    addRelation("rival", "madara", "hashirama", "political_rivalry");
    new SqliteCanonRepository(database).insertFact(
      createCanonFact({
        id: "bloodline",
        projectId: "naruto",
        subjectId: "uchiha",
        predicate: "bloodline_ability",
        objectEntityId: "sharingan",
        authority: "confirmed",
        sourceType: "sample-world",
        now,
      }),
    );

    addEvent("e-formation", "斑所处的战国时代与一族的政治关系", 10, "建村前");
    addEvent("e-village", "宇智波一族参与木叶建立", 20, "建村时期");
    addEvent("e-police", "木叶警务权力结构形成", 30, "建村之后");
    for (const [i, eventId, relevance] of [
      [1, "e-formation", "历史源流与重要首领"],
      [2, "e-village", "建村联盟与政治转折"],
      [3, "e-police", "组织职权及社会地位变化"],
    ] as const) {
      database.raw
        .prepare(
          `
        INSERT INTO world_chronicle_links(
          id,project_id,entity_id,timeline_event_id,relevance,
          consequence,source_note,created_at
        ) VALUES (?, 'naruto','uchiha',?,?,?,?,?)
      `,
        )
        .run(
          "chron" + i,
          eventId,
          relevance,
          "该事件改变了家族的制度位置、对外网络或行动空间",
          "说明示例；历史细节仍需原著逐条核实",
          now,
        );
    }

    database.raw
      .prepare(
        `
      INSERT INTO lorebooks(id,project_id,name,description,created_at,updated_at)
      VALUES ('lorebook','naruto','火影世界设定集','持续补齐的文字世界',?,?)
    `,
      )
      .run(now, now);
    for (const [id, title, content, facet] of [
      [
        "entry-history",
        "宇智波编年史",
        "这里记录战国到建村、警务制度与后续事件的完整史料，并给出来源。",
        "chronicle",
      ],
      [
        "entry-life",
        "宇智波社会与私人生活",
        "这里记录族地、家庭关系、宗族内部政治、生活和社会评价，而非只有人物名单。",
        "social_ecology",
      ],
    ] as const) {
      database.raw
        .prepare(
          `
        INSERT INTO lore_entries(
          id,lorebook_id,title,content,keys_json,created_at,updated_at
        ) VALUES (?,'lorebook',?,?, '["宇智波"]',?,?)
      `,
        )
        .run(id, title, content, now, now);
      database.raw
        .prepare(
          `
        INSERT INTO world_lore_bindings(
          id,project_id,entity_id,lore_entry_id,facet,source_note,created_at
        ) VALUES (?,?,?,?,?,'版本内文字设定',?)
      `,
        )
        .run("binding-" + id, "naruto", "uchiha", id, facet, now);
    }

    database.raw
      .prepare(
        `
      INSERT INTO world_organization_profiles(
        organization_id,project_id,social_kind,governance,membership,
        succession,funding,purpose,current_agenda,source_note,updated_at
      ) VALUES ('uchiha','naruto','clan_network',
       '族长与家族成员关系，具体派系不可混同为全族意见',
       '血缘与家族成员资格','族长更迭需要结合具体时期',
       '家族资产和组织职务必须分别核实',
       '生存、成员利益与村内地位','需按开书时间明确各派行动',
       '样本要求，尚不当作逐条原著证据',?)
    `,
      )
      .run(now);
    for (const [id, name, officeholder, unit, decision] of [
      [
        "f-leadership",
        "族长领导与协调",
        "fugaku",
        null,
        "族内组织领导，不等于全村最高决策权",
      ],
      [
        "f-police",
        "警务关联及执行",
        null,
        "police",
        "警务职责受木叶制度制约，不能说宇智波掌握木叶所有武装",
      ],
    ] as const) {
      database.raw
        .prepare(
          `
        INSERT INTO world_organization_functions(
          id,project_id,organization_id,officeholder_entity_id,
          unit_entity_id,function_name,responsibility,decision_right,
          real_process,source_note,created_at
        ) VALUES (?,'naruto','uchiha',?,?,?, '有实际工作与权力边界',?,
          '通过具体机构、职位和执行人员完成，不靠一句话调动全村',
          '示意，时期需要核实',?)
      `,
        )
        .run(id, officeholder, unit, name, decision, now);
    }
    database.raw
      .prepare(
        `
      INSERT INTO world_stances(
        id,project_id,actor_entity_id,issue_entity_id,target_entity_id,
        stance,interest,intended_action,visibility,source_note,created_at
      ) VALUES ('stance','naruto','uchiha','governance','leaf_authority',
        '对村内治理和家族权限的立场有内部差异',
        '不同家族成员所重视的地位与安全并非完全相同',
        '按人物与时期展开，而非全族一句反抗','author_secret',
        '作为多派立场的数据库测试',?)
    `,
      )
      .run(now);
    for (const [id, evaluator, dim, assessment] of [
      [
        "st1",
        "leaf_authority",
        "faction_standing",
        "警务与政治信任需要分开评估",
      ],
      [
        "st2",
        "police",
        "professional_credibility",
        "忍术战斗能力与警务工作能力有其具体专业价格",
      ],
    ] as const) {
      database.raw
        .prepare(
          `
        INSERT INTO world_standings(
          id,project_id,subject_entity_id,evaluator_entity_id,dimension,
          assessment,actual_response,source_note,created_at
        ) VALUES (?,'naruto','uchiha',?,?,?,
          '只有具体任命/限制已发生才能记作实际权限变化',
          '样本示意，不当作无来源原著结论',?)
      `,
        )
        .run(id, evaluator, dim, assessment, now);
    }
    database.raw
      .prepare(
        `
      INSERT INTO world_power_channels(
        id,project_id,holder_entity_id,intermediary_entity_id,
        authority_entity_id,target_entity_id,jurisdiction_entity_id,
        real_action,prerequisites,cannot_grant,source_note,created_at
      ) VALUES ('channel','naruto','fugaku','uchiha','leaf_authority',
       'police','konoha','通过实际警务指挥链影响警务事务',
       '受时点、职务与权限规则约束',
       '不可凭家族族长身份直接取代火影或统领整个忍村',
       '权力中介示意',?)
    `,
      )
      .run(now);
    for (const [id, person, value] of [
      ["value-madara", "madara", "战国历史、战力与家族认同的象征价值"],
      ["value-shisui", "shisui", "具有独特能力与政治选择空间的高价人物"],
    ] as const) {
      database.raw
        .prepare(
          `
        INSERT INTO world_value_appraisals(
          id,project_id,subject_entity_id,evaluator_entity_id,value_kind,
          value_basis,scarcity,access_path,future_use,source_note,created_at
        ) VALUES (?,'naruto',?,'uchiha','person',?,
        '独特经历和能力','并非族人就能直接命令、收服或继承全部能力',
        '未来可以产生完全不同的组织与个人关系',
        '高价人物不能当作无条件领取奖励',?)
      `,
        )
        .run(id, person, value, now);
    }

    // v0.2: four simultaneous maps are different views, not four copies
    // of Konoha or four ungrounded arrow labels.
    database.raw
      .prepare(
        `
      INSERT INTO world_map_edges(
        id,project_id,from_entity_id,to_entity_id,layer,edge_kind,
        intermediary_entity_id,access_conditions,source_type,source_note,created_at
      ) VALUES ('map-control','naruto','uchiha','police','control',
        'institutional_access','leaf_authority',
        '警务权限由具体村政授权和岗位程序决定',
        'author_design','测试关系示例，不能当作无来源原著结论',?)
    `,
      )
      .run(now);
    database.raw
      .prepare(
        `
      INSERT INTO world_map_edges(
        id,project_id,from_entity_id,to_entity_id,layer,edge_kind,
        intermediary_entity_id,access_conditions,source_type,created_at
      ) VALUES ('map-social','naruto','fugaku','leaf_authority','social',
        'political_contact','uchiha','与村政的交往需经过实际人物与安排',
        'author_design',?)
    `,
      )
      .run(now);
    // v0.3: mechanism and social value of the ability are independently
    // expandable, linked to actual holders and other abilities.
    database.raw
      .prepare(
        `
      INSERT INTO world_capability_profiles(
        entity_id,project_id,power_mode,mechanism,actual_actions,
        effective_scope,activation_conditions,countermeasures,
        knowledge_or_training,social_effects,source_type,updated_at
      ) VALUES ('sharingan','naruto','supernatural',
        '血继限界及其瞳术机制须以原作资料作有证据的细化',
        '洞察、幻术等各项能力分开记录作用事实',
        '具体距离、适用环境与对象需分技能核实',
        '开眼条件需与人物经历和时间对照',
        '对抗与反制需按具体忍术核实',
        '传承与能力取得不等于直接移植',
        '忍族社会价格与保密机制','author_design',?)
    `,
      )
      .run(now);
    database.raw
      .prepare(
        `
      INSERT INTO world_capability_links(
        id,project_id,source_entity_id,target_entity_id,relation,
        mechanism,source_type,created_at
      ) VALUES ('ability-holder','naruto','sharingan','madara','used_by',
        '有关持有与作用的原著时间事实仍需逐条证据化',
        'author_design',?)
    `,
      )
      .run(now);
    // v0.5 economy and logistics: a process is linked to an actual
    // organization, location and resource instead of one generic reward.
    database.raw
      .prepare(
        `
      INSERT INTO world_production_links(
        id,project_id,input_entity_id,output_entity_id,operator_entity_id,
        site_entity_id,process_kind,concrete_process,prerequisites,
        source_type,source_note,created_at
      ) VALUES ('train-clan','naruto','sharingan','sharingan','uchiha',
        'konoha','train','族内忍术教育与人员训练，详细分工待补齐',
        '血继能力不因普通训练自动授予所有族人',
        'author_design','这里只测试生产与培训的数据库引用',?)
    `,
      )
      .run(now);
    // v0.6: public world fact and another person's belief are distinct.
    // This is an example transmission, not a claim that the cited characters
    // actually exchanged such information in the source work.
    database.raw
      .prepare(
        `
      INSERT INTO world_information_flows(
        id,project_id,fact_id,sender_entity_id,receiver_entity_id,
        carrier_entity_id,event_id,world_time,belief,transmission,
        source_type,source_note,created_at
      ) VALUES ('info-flow','naruto','bloodline','fugaku','leaf_authority',
        'police','e-police','建村后某阶段','suspected',
        '警务机构掌握的信息，经具体联系人传递，收件方仍需要核验',
        'author_design','示例传播链，与实际原作情节分开',?)
    `,
      )
      .run(now);

    const encyclopedia = new SqliteWorldEncyclopediaRepository(database);
    const dossier = encyclopedia.getDossier("naruto", "uchiha");
    expect(dossier.entity.name).toBe("宇智波一族");
    expect(dossier.chronicle.map((e) => e.timeline_event_id)).toEqual([
      "e-formation",
      "e-village",
      "e-police",
    ]);
    expect(dossier.lore.map((l) => l.facet)).toEqual([
      "chronicle",
      "social_ecology",
    ]);
    expect(dossier.organizationProfile?.social_kind).toBe("clan_network");
    expect(dossier.functions.map((x) => x.function_name)).toEqual(
      ["族长领导与协调", "警务关联及执行"].sort(),
    );
    expect(dossier.stances).toHaveLength(1);
    expect(dossier.standings).toHaveLength(2);
    expect(dossier.standings[0]!.evaluator_entity_id).not.toBe(
      dossier.standings[1]!.evaluator_entity_id,
    );
    expect(dossier.powerChannels).toHaveLength(1);
    expect(dossier.mapEdges.map((x) => x.layer).sort()).toEqual([
      "control",
      "social",
    ]);
    expect(dossier.capability).toBeNull(); // a clan is not itself a jutsu
    expect(dossier.productionLinks).toHaveLength(1);
    expect(dossier.informationFlows).toHaveLength(1);
    const eye = encyclopedia.getDossier("naruto", "sharingan");
    expect(eye.capability?.power_mode).toBe("supernatural");
    expect(eye.capabilityLinks[0]?.target_entity_id).toBe("madara");
    expect(eye.productionLinks).toHaveLength(1);
    expect(
      encyclopedia.getDossier("naruto", "leaf_authority").informationFlows[0]
        ?.belief,
    ).toBe("suspected");
    expect(
      encyclopedia
        .getDossier("naruto", "fugaku")
        .mapEdges.some((e) => e.layer === "social"),
    ).toBe(true);
    expect(
      dossier.valueAppraisals.map((v) => v.subject_entity_id).sort(),
    ).toEqual(["madara", "shisui"]);
    const linked = encyclopedia
      .listLinkedEntities("naruto", "uchiha")
      .map((e) => e.name);
    expect(linked).toEqual(
      expect.arrayContaining([
        "宇智波斑",
        "木叶警务部队",
        "木叶高层",
        "宇智波富岳",
        "宇智波止水",
        "写轮眼",
      ]),
    );
    expect(
      dossier.network.some(
        (x) => x.relation === "historical_institutional_role",
      ),
    ).toBe(true);
    expect(dossier.facts.some((x) => x.predicate === "bloodline_ability")).toBe(
      true,
    );
    expect(database.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    // A different novel's clan cannot be attached to this novel's lore/history.
    expect(() =>
      database!.raw
        .prepare(
          `
      INSERT INTO world_chronicle_links(
        id,project_id,entity_id,timeline_event_id,relevance,created_at
      ) VALUES ('foreign','other','other_clan','e-police','cross-novel',?)
    `,
        )
        .run(now),
    ).toThrow("world.project_mismatch");
    expect(() =>
      database!.raw
        .prepare(
          `
      INSERT INTO world_lore_bindings(
        id,project_id,entity_id,lore_entry_id,facet,created_at
      ) VALUES ('foreign','other','other_clan','entry-history','history',?)
    `,
        )
        .run(now),
    ).toThrow("world.project_mismatch");
  });
});
