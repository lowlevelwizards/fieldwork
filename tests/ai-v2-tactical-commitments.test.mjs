import test from "node:test";
import assert from "node:assert/strict";
import { ActorTacticalCommitmentStore } from "../js/ai-v2/actors/actor-tactical-commitment-store.js";
import { FiringEdgeQueryService } from "../js/ai-v2/position/firing-edge-query-service.js";
import { ReloadWeaponAction } from "../js/ai-v2/actions/reload-weapon-action.js";

test("tactical commitments reaffirm the same responsibility without duplicating identity",()=>{
  const store=new ActorTacticalCommitmentStore();
  const first=store.commit({actorId:"a",kind:"maintain_security_sector",responsibilityId:"p:r",threatTrackId:"t",minimumUntil:2,maximumUntil:8},{now:1});
  const second=store.commit({actorId:"a",kind:"maintain_security_sector",responsibilityId:"p:r",threatTrackId:"t",minimumUntil:4,maximumUntil:9},{now:2});
  assert.equal(store.summary().length,1);assert.equal(first.key,second.key);assert.equal(second.selectedAt,1);assert.equal(second.reaffirmedAt,2);
  assert.equal(second.minimumUntil,2,"reaffirmation should not slide the minimum commitment window forward");
  assert.equal(second.maximumUntil,8,"reaffirmation should not make one local tactic immortal");
});

test("firing edges expose distinct lateral choices and reject a friendly-blocked lane",()=>{
  const service=new FiringEdgeQueryService();
  const slot={id:"cover",point:{x:0,y:45},obstacle:{x:0,y:0,radius:25}};const threatPoint={x:0,y:-200};const actor={id:"a",x:0,y:45};
  const initial=service.evaluate({game:{},actor,slot,threatPoint,friendlies:[]});
  assert.equal(initial.candidates.length,2);assert.ok(initial.best);assert.notDeepEqual(initial.candidates[0].point,initial.candidates[1].point);
  const blockedPoint=initial.best.point;const blocked=service.evaluate({game:{},actor,slot,threatPoint,friendlies:[{id:"b",x:blockedPoint.x,y:blockedPoint.y-20}]});
  assert.ok(blocked.candidates.some(item=>item.blockReason==="friendly_blocks_lane"));assert.ok(blocked.best);
});

test("reload is finite, interruptible, and restores the existing magazine",()=>{
  const actor={id:"a",ammoInMagazine:0,magazineSize:20,medical:{condition:"healthy"}};const game={actors:[actor]};
  const action=new ReloadWeaponAction({actorId:"a",directive:{duration:1}});assert.equal(action.canStart({game}),true);action.start(0,{game});
  let result=action.update(.5,{game,services:{locomotion:{stop(){}}},now:.5});assert.equal(result,null);assert.equal(actor.reloading,true);
  result=action.update(.5,{game,services:{locomotion:{stop(){}}},now:1});assert.equal(result.status,"completed");assert.equal(actor.ammoInMagazine,20);assert.equal(actor.reloading,false);
});
