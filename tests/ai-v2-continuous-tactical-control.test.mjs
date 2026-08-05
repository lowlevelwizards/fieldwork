import test from "node:test";
import assert from "node:assert/strict";
import { TacticalSteeringService } from "../js/ai-v2/execution/tactical-steering-service.js";
import { ActorActionArbiter, ACTION_AUTHORITY_TIERS } from "../js/ai-v2/authority/actor-action-arbiter.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { TacticalRepositionAction } from "../js/ai-v2/actions/tactical-reposition-action.js";

test("soft steering deforms route progress away from a nearby teammate without replacing the goal",()=>{
  const service=new TacticalSteeringService();
  const actor={id:"a",teamId:"t",x:0,y:0,radius:18};
  const game={actors:[actor,{id:"b",teamId:"t",x:8,y:5,radius:18}],map:{obstacles:[]}};
  const target=service.steer(actor,{kind:"route",goal:{x:200,y:0},preferredSeparationMin:60,cohesion:false},{game,now:1});
  assert.ok(target.x>0,"route progress should remain positive");
  assert.notEqual(target.y,0,"the live steering target should deform rather than preserve a rigid shared line");
  assert.deepEqual(actor.aiV2Steering.goal,{x:200,y:0});
});

test("same-type tactical movement can amend an obsolete destination before arrival",()=>{
  const scheduler=new ActionScheduler();
  const arbiter=new ActorActionArbiter({scheduler,switchMargin:.05});
  const game={actors:[{id:"a",x:0,y:0,medical:{}}]};
  const context={game};
  arbiter.beginFrame({now:0});
  arbiter.submit({actorId:"a",action:new TacticalRepositionAction({actorId:"a",directive:{destination:{x:100,y:0},utilityScore:.5}}),score:.5,authorityTier:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT});
  arbiter.resolve({now:0,context});
  const active=scheduler.getAction("a","TacticalReposition");
  assert.deepEqual(active.directive.destination,{x:100,y:0});
  arbiter.beginFrame({now:.1});
  arbiter.submit({actorId:"a",action:new TacticalRepositionAction({actorId:"a",directive:{destination:{x:0,y:120},utilityScore:.9}}),score:.9,authorityTier:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT});
  arbiter.resolve({now:.1,context});
  assert.equal(scheduler.getAction("a","TacticalReposition"),active,"the action identity should remain stable");
  assert.deepEqual(active.directive.destination,{x:0,y:120},"the live intent should be amended immediately");
  assert.equal(arbiter.getTrace("a").granted[0].resultReason,"matching_action_amended");
});
