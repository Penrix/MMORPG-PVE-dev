import { describe,expect,it } from "vitest";
import type { WorldPackDocument, WorldAction } from "@narralume/contracts";
import { playWorldActionPaths,previewWorldAction } from "../src/world-action-runtime.js";

const action = (
 localId: string,
 requires:WorldAction["requires"],
 yields:WorldAction["yields"],
 state:WorldAction["state"]="available",
): WorldAction => ({
 localId,name:localId,offeredByRef:"guild",locationRef:"market",
 action:"有人真正参与的社会或产业活动",requires,yields,state,
});

describe("v0.5 world game interaction and economic affordance simulation",()=>{
 const doc:WorldPackDocument={
   summary:"有具体准入、交易、投资链的市场",
   nodes:[],links:[],activities:[],openThreads:[],
   interactions:[
     action("enter",[],[{kind:"access",ref:"market"}]),
     action("buy",[{kind:"access",ref:"market"}],[{kind:"asset",ref:"relic"}]),
     action("invest",[{kind:"asset",ref:"relic"}],[{kind:"permission",ref:"guild"}]),
     action("future",[],[{kind:"asset",ref:"promise"}],"potential"),
   ],
 };
 it("simulates multiple dependent actions without claiming unrealized outcomes are Canon assets",()=>{
   const result=playWorldActionPaths(doc,{holdings:[]},3);
   expect(result.options.find(x=>x.id==="buy")?.executable).toBe(false);
   expect(result.options.find(x=>x.id==="buy")?.missing).toEqual([{kind:"access",ref:"market"}]);
   expect(result.paths.some(p=>p.actionIds.join(">")==="enter>buy>invest")).toBe(true);
   expect(result.reachableResults).toEqual(expect.arrayContaining([
     {kind:"access",ref:"market"},{kind:"asset",ref:"relic"},{kind:"permission",ref:"guild"},
   ]));
   expect(result.reachableResults).not.toContainEqual({kind:"asset",ref:"promise"});
   expect(doc.interactions?.find(x=>x.localId==="buy")?.requires)
     .toEqual([{kind:"access",ref:"market"}]);
 });
 it("recognizes a right already earned without inventing payment, costs or skill handicaps",()=>{
   const result=previewWorldAction(doc.interactions![1]!,{
     holdings:[{kind:"access",ref:"market"}],
   });
   expect(result.executable).toBe(true);
   expect(result.missing).toEqual([]);
   expect(result.possibleResults).toEqual([{kind:"asset",ref:"relic"}]);
 });
});
