import test from "node:test";
import assert from "node:assert/strict";
import { AIV2Action } from "../js/ai-v2/actions/action.js";
import { ACTION_CHANNELS } from "../js/ai-v2/actions/action-channels.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { ActorActionArbiter, ACTION_AUTHORITY_TIERS } from "../js/ai-v2/authority/actor-action-arbiter.js";
import { UnifiedActorBrain } from "../js/ai-v2/actors/unified-actor-brain.js";

class TestAction extends AIV2Action{
  constructor({type,actorId,channels,utility}){
    super({type,actorId,channels,priority:10});
    this.utility=utility;
  }
  continuationUtility(){return this.utility;}
}

function setup(){
  const scheduler=new ActionScheduler();
  const arbiter=new ActorActionArbiter({scheduler});
  const brain=new UnifiedActorBrain({scheduler,arbiter,switchMargin:.08});
  const context={game:{actors:[{id:"actor_1",teamId:"team_1",medical:{condition:"healthy"}}]},services:{teamConcerns:{getActive:()=>[]}}};
  return{scheduler,brain,context};
}

function resolve(brain,context,now=1){brain.beginFrame({now,context});return proposal=>{brain.submit(proposal);brain.resolve({now,context});};}

test("the unified brain replaces a lower-utility cross-type incumbent through one comparison path",()=>{
  const {scheduler,brain,context}=setup();
  let submit=resolve(brain,context,1);
  submit({actorId:"actor_1",action:new TestAction({type:"ContinueRoute",actorId:"actor_1",channels:[ACTION_CHANNELS.LOCOMOTION],utility:.42}),score:.42,urgency:.2,authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,source:"test_route"});
  assert.equal(scheduler.getAction("actor_1","ContinueRoute")?.state,"active");

  submit=resolve(brain,context,2);
  submit({actorId:"actor_1",action:new TestAction({type:"RecoverCasualty",actorId:"actor_1",channels:[ACTION_CHANNELS.LOCOMOTION],utility:.84}),score:.84,urgency:.8,authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,source:"test_casualty"});
  assert.equal(scheduler.hasAction("actor_1","ContinueRoute"),false);
  assert.equal(scheduler.getAction("actor_1","RecoverCasualty")?.state,"active");
});

test("the unified brain preserves a stronger incumbent and records why the challenger lost",()=>{
  const {scheduler,brain,context}=setup();
  let submit=resolve(brain,context,1);
  submit({actorId:"actor_1",action:new TestAction({type:"RecoverCasualty",actorId:"actor_1",channels:[ACTION_CHANNELS.LOCOMOTION],utility:.9}),score:.9,urgency:.8,authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,source:"test_casualty"});

  submit=resolve(brain,context,2);
  submit({actorId:"actor_1",action:new TestAction({type:"ContinueRoute",actorId:"actor_1",channels:[ACTION_CHANNELS.LOCOMOTION],utility:.35}),score:.35,urgency:.2,authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,source:"test_route"});
  assert.equal(scheduler.hasAction("actor_1","RecoverCasualty"),true);
  assert.equal(scheduler.hasAction("actor_1","ContinueRoute"),false);
  assert.match(brain.getTrace("actor_1").rejected[0].resultReason,/incumbent_continuation_utility/);
});

test("one actor plan may grant compatible channel intentions together",()=>{
  const {scheduler,brain,context}=setup();
  brain.beginFrame({now:1,context});
  brain.submit({actorId:"actor_1",action:new TestAction({type:"Move",actorId:"actor_1",channels:[ACTION_CHANNELS.LOCOMOTION],utility:.7}),score:.7,authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,source:"test_move"});
  brain.submit({actorId:"actor_1",action:new TestAction({type:"Observe",actorId:"actor_1",channels:[ACTION_CHANNELS.ATTENTION],utility:.65}),score:.65,authorityTier:ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN,source:"test_observe",concernId:"contact:test"});
  brain.resolve({now:1,context});
  assert.deepEqual(new Set(scheduler.getActions("actor_1").map(action=>action.type)),new Set(["Move","Observe"]));
  assert.deepEqual(brain.getPlan("actor_1").concernIds,["contact:test"]);
});
