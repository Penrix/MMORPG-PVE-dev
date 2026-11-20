import type { WorldAction, WorldPackDocument } from "@narralume/contracts";

export type WorldCapabilityKind =
  "asset" | "permission" | "relationship" | "knowledge" | "ability" | "access";

export interface WorldSandboxState {
  holdings: readonly { kind: WorldCapabilityKind; ref: string }[];
}
export interface WorldActionOption {
  id: string;
  name: string;
  executable: boolean;
  missing: readonly { kind: WorldCapabilityKind; ref: string }[];
  possibleResults: readonly { kind: WorldCapabilityKind; ref: string }[];
}
export interface WorldActionPath {
  actionIds: string[];
  gained: { kind: WorldCapabilityKind; ref: string }[];
}
export interface WorldActionPlaytest {
  options: WorldActionOption[];
  paths: WorldActionPath[];
  reachableResults: { kind: WorldCapabilityKind; ref: string }[];
}

function token(kind: WorldCapabilityKind, ref: string): string {
  return kind + "::" + ref;
}

/**
 * v0.5 executable Affordance prototype. The same world data powers author
 * playtesting: specific requirements open specific options, and a result
 * becomes a possible prerequisite for another world action. This is a
 * sandbox: not a prewritten scene, not a Canon settlement, and no implicit
 * payment/cost or protagonist handicap.
 */
export function previewWorldAction(
  action: WorldAction,
  state: WorldSandboxState,
): WorldActionOption {
  const holdings=new Set(state.holdings.map((t)=>token(t.kind,t.ref)));
  const missing=action.requires.filter((requirement)=>
    !holdings.has(token(requirement.kind,requirement.ref)));
  return {
    id:action.localId,name:action.name,
    executable:action.state==="available" && missing.length===0,
    missing,
    possibleResults:action.yields,
  };
}

/** Bounded breadth-first exploration, not a fake single route.
 * Actions may be taken in different orders; each yields a new local sandbox
 * state. Nothing alters a real NPC, property deed or confirmed history.
 */
export function playWorldActionPaths(
  doc: WorldPackDocument,
  initial: WorldSandboxState={holdings:[]},
  maxDepth=3,
): WorldActionPlaytest {
  const actions=(doc.interactions??[]).filter(a=>a.state==="available");
  const options=(doc.interactions??[]).map(a=>previewWorldAction(a,initial));
  const initialTokens=new Set(initial.holdings.map(t=>token(t.kind,t.ref)));
  type State={tokens:Set<string>;path:string[];gained:WorldActionPath["gained"]};
  const queue:State[]=[{tokens:initialTokens,path:[],gained:[]}];
  const seen=new Set([Array.from(initialTokens).sort().join("|")]);
  const paths:WorldActionPath[]=[];
  const reachable=new Map<string,{kind:WorldCapabilityKind;ref:string}>();
  while(queue.length){
    const next=queue.shift()!;
    if(next.path.length>=Math.max(0,Math.min(maxDepth,7)))continue;
    for(const action of actions){
      if(next.path.includes(action.localId))continue;
      if(action.requires.some(t=>!next.tokens.has(token(t.kind,t.ref))))continue;
      const tokens=new Set(next.tokens);
      const gained=[...next.gained];
      let changed=false;
      for(const gain of action.yields){
        const key=token(gain.kind,gain.ref);
        if(!tokens.has(key)){
          changed=true;tokens.add(key);gained.push(gain);reachable.set(key,gain);
        }
      }
      const path=[...next.path,action.localId];
      paths.push({actionIds:path,gained:[...gained]});
      if(!changed)continue;
      const signature=[...tokens].sort().join("|");
      if(!seen.has(signature)){
        seen.add(signature);queue.push({tokens,path,gained});
      }
    }
  }
  return {options,paths,reachableResults:[...reachable.values()]};
}
