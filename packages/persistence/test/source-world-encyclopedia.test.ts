import { afterEach,describe,expect,it } from "vitest";
import { createProject } from "@narralume/domain";
import {
  SqliteSourceCorpusRepository,SqliteMotherWorldEncyclopediaRepository,
  SqliteProjectRepository,SqliteCanonRepository,
} from "../src/index.js";
import { NodeNarrativeDatabase } from "../src/node.js";

const now="2026-11-21T00:00:00.000Z";
let db:NodeNarrativeDatabase|null=null;
afterEach(()=>{db?.close();db=null;});
function setup(){
  db=new NodeNarrativeDatabase();
  expect(db.migrate()).toBe(53);
  const source=new SqliteSourceCorpusRepository(db);
  const wiki=new SqliteMotherWorldEncyclopediaRepository(db);
  source.upsertCorpus({
    id:"naruto",title:"火影原生母体百科",sourceUrl:"https://example.org/naruto",
    rightsNotice:"fixture",importer:"test",metadata:{},
    importedAt:now,
  });
  source.upsertCorpus({
    id:"history",title:"历史原生母体百科",sourceUrl:"https://example.org/history",
    rightsNotice:"fixture",importer:"test",metadata:{},importedAt:now,
  });
  const entries=[
    ["madara","宇智波斑","character"],
    ["uchiha","宇智波一族","organization"],
    ["hashirama","千手柱间","character"],
    ["konoha","木叶村","location"],
    ["sharingan","写轮眼","ability"],
    ["mangekyou","万花筒写轮眼","ability"],
    ["police","木叶警务部队","organization"],
    ["resource","族内训练资源","item"],
  ] as const;
  for(const [sourceKey,name,kind] of entries){
    source.upsertRecord({
      corpusId:"naruto",sourceKey,name,kind,
      aliases:[],summary:"来源资料中的独立世界对象",
      raw:{name,originalReference:true},
      sourceUrl:"https://example.org/naruto/"+sourceKey,
      originCollection:kind,importedAt:now,
    });
  }
  source.upsertRecord({
    corpusId:"history",sourceKey:"madara",name:"宇智波斑",
    kind:"character",aliases:[],summary:"故意同名，用以检查母体隔离",
    raw:{name:"宇智波斑",unrelated:true},
    sourceUrl:"https://example.org/history/madara",
    originCollection:"test",importedAt:now,
  });
  return{source,wiki};
}

describe("Original mother-world encyclopedia: independent, rich and reusable",()=>{
  it("queries Madara's chronicle, clan, social map, Sharingan lineage and social valuation before any novel exists",()=>{
    const {source,wiki}=setup();
    wiki.upsertLore({
      corpusId:"naruto",sourceKey:"madara",sectionKey:"life",
      title:"人生与人物关系史",content:"人物历史的长篇文字设定，带资料出处；不是项目世界新发生的历史。",
      sourceUrl:"https://example.org/naruto/madara",sourceNote:"来源文本测试样本",
      updatedAt:now,
    });
    wiki.upsertChronicle({
      corpusId:"naruto",eventKey:"village-foundation",
      title:"木叶建立时期",worldTime:"建村时期",sequence:20,
      description:"该时期各人、各组织的历史关联，应按证据分别记录。",
      sourceNote:"示例编年史",updatedAt:now,
    });
    for(const [sourceKey,role] of [
      ["madara","参与者"],["uchiha","组织关联"],["hashirama","参与者"],
    ] as const)wiki.linkChronicle({
      corpusId:"naruto",eventKey:"village-foundation",sourceKey,
      role,sourceNote:"相互链接到同一个源历史事件",
    });
    wiki.upsertOrganization({
      corpusId:"naruto",sourceKey:"uchiha",organizationForm:"clan",
      governance:"氏族内部治理方式，须按具体历史阶段分辨",
      duties:"氏族与正式村政机构的职责不可直接等同",
      internalFactions:"按人物与事件记录派系，不给全族强行统一立场",
      ordinaryLife:"族人日常生产和家庭关系属于百科内容",
      sourceNote:"专门组织资料测试",updatedAt:now,
    });
    wiki.upsertAbility({
      corpusId:"naruto",sourceKey:"sharingan",powerMode:"supernatural",
      mechanism:"瞳术机制的原著资料需要逐项入库",
      actualEffects:"有效的已知能力需分阶段附证据保存",
      progression:"按真实能力关系链接，不靠名称模糊匹配",
      acquisition:"来源及历史时间信息单独记录",
      sourceNote:"能力资料测试，不自动制造限制或代价",
      updatedAt:now,
    });
    source.upsertRelation({
      corpusId:"naruto",fromKey:"madara",toKey:"uchiha",
      relation:"historical_clan_leader",sourceNote:"历史关联示例",
    });
    source.upsertRelation({
      corpusId:"naruto",fromKey:"madara",toKey:"sharingan",
      relation:"uses_ability",sourceNote:"实际能力与人物关联",
    });
    source.upsertRelation({
      corpusId:"naruto",fromKey:"sharingan",toKey:"mangekyou",
      relation:"evolves_to",sourceNote:"力量体系升级分支",
    });
    wiki.addClaim({
      id:"claim-madara-clan",corpusId:"naruto",subjectKey:"madara",
      predicate:"clan_affiliation",objectKey:"uchiha",
      worldTimeFrom:"战国时期",assertion:"recorded",
      sourceNote:"人物和组织身份之间的明确引用",createdAt:now,
    });
    wiki.addClaim({
      id:"claim-era",corpusId:"naruto",subjectKey:"madara",
      predicate:"historical_position",value:{position:"重要历史人物"},
      sourceNote:"结构化原著描述测试",createdAt:now,
    });
    // Other specialized world facets are source-linked, not novel Canon.
    db!.raw.prepare(`
      INSERT INTO source_world_map_edges(
        id,corpus_id,from_key,to_key,layer,relation,
        access_conditions,world_time,source_note
      ) VALUES ('edge','naruto','uchiha','konoha','social',
       'political_contact','经过具体组织或个人','建村时期','测试示意')
    `).run();
    db!.raw.prepare(`
      INSERT INTO source_world_social_standings(
        id,corpus_id,subject_key,evaluator_key,dimension,
        assessment,world_time,source_note
      ) VALUES ('standing','naruto','madara','konoha',
        'political_importance','各时期评价存在差异',
        '建村时期','测试示意，不能当原著引用')
    `).run();
    db!.raw.prepare(`
      INSERT INTO source_world_resource_flows(
        id,corpus_id,input_key,output_key,operator_key,site_key,
        process_kind,process,source_note
      ) VALUES ('training','naruto','resource','sharingan',
       'uchiha','konoha','train','族内训练具体内容须另查来源',
       '测试用机制结构')
    `).run();
    db!.raw.prepare(`
      INSERT INTO source_world_value_appraisals(
        id,corpus_id,subject_key,evaluator_key,value_kind,
        value_basis,scarcity,source_note
      ) VALUES ('price','naruto','madara','uchiha','person',
       '人物的力量、历史和组织影响自成价值',
       '高价值与男主是否接近或控制无关',
       '测试用价值记录')
    `).run();

    const madara=wiki.getDossier("naruto","madara")!;
    expect(madara.record.name).toBe("宇智波斑");
    expect(madara.chronicle[0]?.eventKey).toBe("village-foundation");
    expect(madara.lore[0]?.sectionKey).toBe("life");
    expect(madara.claims.map(c=>c.predicate)).toEqual([
      "clan_affiliation","historical_position",
    ]);
    expect(madara.relations.some(x=>x.otherName==="宇智波一族")).toBe(true);
    expect(madara.standings).toHaveLength(1);
    expect(madara.values).toHaveLength(1);
    expect(madara.linkedRecords.map(x=>x.sourceKey)).toEqual(
      expect.arrayContaining(["uchiha","sharingan","konoha"]),
    );
    const eye=wiki.getDossier("naruto","sharingan")!;
    expect(eye.ability?.mechanism).toContain("瞳术");
    expect(eye.ability?.constraints).toBe("");
    expect(eye.ability?.counters).toBe("");
    expect(eye.production).toHaveLength(1);
    expect(eye.relations.some(x=>x.otherName==="万花筒写轮眼")).toBe(true);
    const clan=wiki.getDossier("naruto","uchiha")!;
    expect(clan.organization?.organizationForm).toBe("clan");
    expect(clan.chronicle[0]?.title).toBe("木叶建立时期");
    expect(clan.maps).toHaveLength(1);
    expect(wiki.getDossier("history","madara")?.chronicle).toHaveLength(0);
    expect(wiki.getDossier("naruto","missing")).toBeNull();
    expect(new SqliteCanonRepository(db!).listEntities("not-a-project")).toHaveLength(0);
    expect(db!.raw.prepare("SELECT count(*) AS n FROM projects").get()).toEqual({n:0});
    expect(db!.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("keeps original-world wiki stable across projects and non-destructive reimports",()=>{
    const {source,wiki}=setup();
    new SqliteProjectRepository(db!).insert(createProject({
      id:"book-a",title:"火影同人 A",now,
    }));
    new SqliteProjectRepository(db!).insert(createProject({
      id:"book-b",title:"火影同人 B",now,
    }));
    source.bindProject("book-a","naruto");
    source.bindProject("book-b","naruto");
    wiki.upsertLore({
      corpusId:"naruto",sourceKey:"madara",sectionKey:"biography",
      title:"人物传记",content:"作者精修的原著资料正文，不应被重新导入删除",
      sourceNote:"已核实与精修的原著资料测试",updatedAt:now,
    });
    const preserved=source.getRecord("naruto","madara")!;
    source.beginCorpusSnapshot("naruto");
    source.upsertRecord({...preserved,summary:"上游补充了更多内容",importedAt:now});
    expect(wiki.getDossier("naruto","madara")?.lore[0]?.content)
      .toBe("作者精修的原著资料正文，不应被重新导入删除");
    expect(source.search("宇智波斑",{corpusId:"naruto"})).toHaveLength(1);
    expect(source.search("写轮眼",{corpusId:"naruto"})).toHaveLength(0);
    // Old source links remain readable for provenance, but stale raw
    // entries are excluded from *new* discovery until the next import sees them.
    expect(source.getRecord("naruto","sharingan")).not.toBeNull();
    expect(source.listProjectCorpora("book-a")).toHaveLength(1);
    expect(source.listProjectCorpora("book-b")).toHaveLength(1);
    expect(new SqliteCanonRepository(db!).listEntities("book-a")).toHaveLength(0);
    expect(new SqliteCanonRepository(db!).listEntities("book-b")).toHaveLength(0);
    expect(db!.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("refuses cross-corpus source graph edges and invalid assertions",()=>{
    const {wiki}=setup();
    expect(()=>wiki.addClaim({
      id:"bad",corpusId:"naruto",subjectKey:"madara",
      predicate:"identity",objectKey:"uchiha",
      value:"a second target",createdAt:now,
    })).toThrow("source.claim.requires_one_target");
    expect(()=>wiki.addClaim({
      id:"bad-cross",corpusId:"naruto",subjectKey:"madara",
      predicate:"reference",objectKey:"not-in-naruto",createdAt:now,
    })).toThrow();
    expect(()=>db!.raw.prepare(`
      INSERT INTO source_world_map_edges(
        id,corpus_id,from_key,to_key,layer,relation
      ) VALUES('bad','naruto','madara','not-in-naruto','social','claimed')
    `).run()).toThrow();
  });
});
