import test from "node:test";
import assert from "node:assert/strict";
import { ThreatKnowledgeStore } from "../js/ai-v2/knowledge/threat-knowledge.js";

function actor(){
  return{
    id:"scout",
    teamId:"commune",
    x:0,y:0,
    medical:{dead:false,unconscious:false}
  };
}

test("a physical near miss creates approximate personal hostile evidence without revealing shooter identity",()=>{
  const observer=actor();
  const store=new ThreatKnowledgeStore();
  const event={
    id:"near_miss_1",
    kind:"near_miss",
    targetActorId:observer.id,
    sourcePoint:{x:300,y:100},
    impactPoint:{x:12,y:8},
    confidence:94,
    immediateDuration:3
  };
  const threat=store.observeEvent({event,game:{actors:[observer]},now:1});
  assert.ok(threat);
  assert.equal(threat.observerId,observer.id);
  assert.equal(threat.identity,"unknown");
  assert.equal(threat.factionId,null);
  assert.equal(threat.track.intentHypothesis.id,"hostile");
  assert.notDeepEqual(threat.approximatePosition,event.sourcePoint);
  assert.equal(store.isImmediate(observer.id,2),true);
  assert.equal(store.isImmediate(observer.id,5),false);
});
