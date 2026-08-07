import test from "node:test";
import assert from "node:assert/strict";
import { AIV2Action } from "../js/ai-v2/actions/action.js";
import { ACTION_CHANNELS } from "../js/ai-v2/actions/action-channels.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { ActorActionArbiter, ACTION_AUTHORITY_TIERS } from "../js/ai-v2/authority/actor-action-arbiter.js";
import { UnifiedActorBrain } from "../js/ai-v2/actors/unified-actor-brain.js";

class TestAction extends AIV2Action{
  constructor({type,actorId="actor_1",channels=[ACTION_CHANNELS.LOCOMOTION],utility=.5,interruptible=true,destination=null,minimumCommitment=0}={}){
    super({type,actorId,channels,priority:10,interruptible});
    this.utility=utility;
    this.directive={destination,minimumCommitment};
  }
  continuationUtility(){return this.utility;}
}

function setup(){
  const scheduler=new ActionScheduler();
  const arbiter=new ActorActionArbiter({scheduler});
  const brain=new UnifiedActorBrain({scheduler,arbiter,switchMargin:.08});
  const actor={id:"actor_1",teamId:"team_1",x:0,y:0,medical:{condition:"healthy"}};
  const context={game:{actors:[actor]},services:{teamConcerns:{getActive:()=>[]}}};
  return{scheduler,brain,context,actor};
}

function frame(brain,context,now,proposals=[],beforeResolve=null){
  brain.beginFrame({now,context});
  for(const proposal of proposals)brain.submit(proposal);
  beforeResolve?.();
  brain.resolve({now,context});
}

const proposal=(action,{score=action.utility,urgency=.2,tier=ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,source="test",desiredEffect=null}={})=>({
  actorId:action.actorId,action,score,urgency,authorityTier:tier,source,desiredEffect
});

test("healthy incumbent survives a slightly better same-authority challenger",()=>{
  const {scheduler,brain,context}=setup();
  frame(brain,context,1,[proposal(new TestAction({type:"Route",utility:.64}),{score:.64})]);
  frame(brain,context,1.5,[proposal(new TestAction({type:"Cover",utility:.69}),{score:.69,urgency:.22})]);
  assert.equal(scheduler.hasAction("actor_1","Route"),true);
  assert.equal(scheduler.hasAction("actor_1","Cover"),false);
  assert.match(brain.getTrace("actor_1").rejected[0].resultReason,/challenger_below_switch_margin/);
});

test("materially better same-authority action replaces the incumbent without waiting for failure",()=>{
  const {scheduler,brain,context}=setup();
  frame(brain,context,1,[proposal(new TestAction({type:"Route",utility:.5}),{score:.5,desiredEffect:"make_route_progress"})]);
  frame(brain,context,2.5,[proposal(new TestAction({type:"Cover",utility:.82}),{score:.82,urgency:.65,desiredEffect:"break_exposed_contact_route"})]);
  assert.equal(scheduler.hasAction("actor_1","Route"),false);
  assert.equal(scheduler.hasAction("actor_1","Cover"),true);
  assert.equal(brain.getTrace("actor_1").replanning.some(item=>item.decision==="replace"),true);
});

test("immediate survival authority overrides a fresh commitment immediately",()=>{
  const {scheduler,brain,context}=setup();
  frame(brain,context,1,[proposal(new TestAction({type:"Route",utility:.88,minimumCommitment:3}),{score:.88})]);
  frame(brain,context,1.15,[proposal(new TestAction({type:"EmergencyCover",utility:.45}),{score:.45,urgency:1,tier:ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL})]);
  assert.equal(scheduler.hasAction("actor_1","Route"),false);
  assert.equal(scheduler.hasAction("actor_1","EmergencyCover"),true);
});

test("compatible physical channels remain active together during replanning",()=>{
  const {scheduler,brain,context}=setup();
  frame(brain,context,1,[
    proposal(new TestAction({type:"Move",utility:.7,channels:[ACTION_CHANNELS.LOCOMOTION]}),{score:.7}),
    proposal(new TestAction({type:"Fire",utility:.8,channels:[ACTION_CHANNELS.WEAPON]}),{score:.8,tier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE}),
    proposal(new TestAction({type:"Track",utility:.65,channels:[ACTION_CHANNELS.ATTENTION]}),{score:.65,tier:ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN})
  ]);
  assert.deepEqual(new Set(scheduler.getActions("actor_1").map(action=>action.type)),new Set(["Move","Fire","Track"]));
});

test("low-authority local improvement does not steal governing locomotion",()=>{
  const {scheduler,brain,context}=setup();
  frame(brain,context,1,[proposal(new TestAction({type:"RecoverCasualty",utility:.7}),{score:.7,urgency:.8,tier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE})]);
  frame(brain,context,2,[proposal(new TestAction({type:"LocalSpacing",utility:.99}),{score:.99,urgency:.2,tier:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT})]);
  assert.equal(scheduler.hasAction("actor_1","RecoverCasualty"),true);
  assert.equal(scheduler.hasAction("actor_1","LocalSpacing"),false);
  assert.match(brain.getTrace("actor_1").rejected[0].resultReason,/incumbent_higher_authority/);
});

test("3.2A liveness warning lowers switching resistance before hard invalidation",()=>{
  const healthy=setup();
  frame(healthy.brain,healthy.context,1,[proposal(new TestAction({type:"Route",utility:.64}),{score:.64})]);
  frame(healthy.brain,healthy.context,2.5,[proposal(new TestAction({type:"Cover",utility:.7}),{score:.7,urgency:.22})]);
  assert.equal(healthy.scheduler.hasAction("actor_1","Route"),true);

  const warned=setup();
  frame(warned.brain,warned.context,1,[proposal(new TestAction({type:"Route",utility:.64}),{score:.64})]);
  const incumbent=warned.scheduler.getAction("actor_1","Route");
  warned.scheduler.liveness.byAction.set(incumbent.id,{actionId:incumbent.id,actorId:"actor_1",status:"warning",signals:{recentReversals:2,stalledFor:1.1,regression:0}});
  frame(warned.brain,warned.context,2.5,[proposal(new TestAction({type:"Cover",utility:.7}),{score:.7,urgency:.22})]);
  assert.equal(warned.scheduler.hasAction("actor_1","Route"),false);
  assert.equal(warned.scheduler.hasAction("actor_1","Cover"),true);
});

test("procedural replacement requests are soft until the replacement actually wins",()=>{
  const {scheduler,brain,context}=setup();
  frame(brain,context,1,[proposal(new TestAction({type:"ApproachCasualty",utility:.78}),{score:.78,urgency:.7})]);
  const incumbent=scheduler.getAction("actor_1","ApproachCasualty");
  brain.beginFrame({now:1.6,context});
  brain.requestCancel("actor_1",incumbent,{reason:"procedural_role_requires_DragCasualty"});
  brain.submit(proposal(new TestAction({type:"DragCasualty",utility:.7}),{score:.7,urgency:.7}));
  brain.resolve({now:1.6,context});
  assert.equal(scheduler.hasAction("actor_1","ApproachCasualty"),true);
  assert.equal(scheduler.hasAction("actor_1","DragCasualty"),false);

  brain.beginFrame({now:2.8,context});
  brain.requestCancel("actor_1",incumbent,{reason:"procedural_role_requires_DragCasualty"});
  brain.submit(proposal(new TestAction({type:"DragCasualty",utility:.94}),{score:.94,urgency:.85}));
  brain.resolve({now:2.8,context});
  assert.equal(scheduler.hasAction("actor_1","ApproachCasualty"),false);
  assert.equal(scheduler.hasAction("actor_1","DragCasualty"),true);
});

test("recent switch hysteresis prevents immediate A-B-A oscillation",()=>{
  const {scheduler,brain,context}=setup();
  frame(brain,context,1,[proposal(new TestAction({type:"A",utility:.5}),{score:.5})]);
  frame(brain,context,2.5,[proposal(new TestAction({type:"B",utility:.72}),{score:.72,urgency:.35,desiredEffect:"new_effect"})]);
  assert.equal(scheduler.hasAction("actor_1","B"),true);
  frame(brain,context,2.7,[proposal(new TestAction({type:"A",utility:.77}),{score:.77,urgency:.35,desiredEffect:"new_effect"})]);
  assert.equal(scheduler.hasAction("actor_1","B"),true);
  assert.equal(scheduler.hasAction("actor_1","A"),false);
});
