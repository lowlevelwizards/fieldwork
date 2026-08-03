import test from "node:test";
import assert from "node:assert/strict";
import { AmbientPerceptionRuntime } from "../js/ai-v2/senses/ambient-perception-runtime.js";
import { PersonalKnowledgeStore } from "../js/ai-v2/knowledge/personal-knowledge.js";

function actor(id,teamId,factionId,x,y,lookAngle=0){return{id,teamId,factionId,x,y,lookAngle,aiV2Capabilities:{observation:.8},medical:{condition:"healthy"}};}
function missionStore(){return{has:()=>true,get:()=>({contactPolicy:{passiveVision:true,maximumRange:800,fieldOfViewDegrees:100}})};}
function scan(game){
  const personalKnowledge=new PersonalKnowledgeStore();
  const visibleByObserver=new Map();
  const runtime=new AmbientPerceptionRuntime({scanInterval:.1});
  runtime.update(.11,{game,missions:missionStore(),personalKnowledge,visibleByObserver,now:.11});
  return{personalKnowledge,visibleByObserver};
}

test("ambient perception creates private evidence only for visible forward contacts",()=>{
  const observer=actor("observer","team_a","northline",0,0,0);
  const forward=actor("forward","team_b","commune",300,0,Math.PI);
  let result=scan({actors:[observer,forward],map:{obstacles:[],brush:[]}});
  assert.ok(result.personalKnowledge.getContact(observer.id,forward.id));
  assert.equal(result.personalKnowledge.getContact(forward.id,observer.id)?.currentlyVisible,true);

  const behind=actor("behind","team_b","commune",-300,0,0);
  result=scan({actors:[observer,behind],map:{obstacles:[],brush:[]}});
  assert.equal(result.personalKnowledge.getContact(observer.id,behind.id),null);

  const blocked=actor("blocked","team_b","commune",300,0,Math.PI);
  result=scan({actors:[observer,blocked],map:{obstacles:[{type:"rock",x:150,y:0,radius:70}],brush:[]}});
  assert.equal(result.personalKnowledge.getContact(observer.id,blocked.id),null);
});
