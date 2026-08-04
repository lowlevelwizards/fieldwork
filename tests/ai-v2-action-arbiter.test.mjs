import test from "node:test";
import assert from "node:assert/strict";
import { AIV2Action } from "../js/ai-v2/actions/action.js";
import { ACTION_CHANNELS } from "../js/ai-v2/actions/action-channels.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { ActorActionArbiter, ACTION_AUTHORITY_TIERS } from "../js/ai-v2/authority/actor-action-arbiter.js";

class TestAction extends AIV2Action{
  constructor({actorId,type,channels,priority=10}){super({actorId,type,channels,priority,displayPriority:priority});}
}

test("authority arbiter grants one physical owner per channel and explains rejected lower authority proposals",()=>{
  const scheduler=new ActionScheduler();
  const arbiter=new ActorActionArbiter({scheduler});
  const context={};
  arbiter.beginFrame({now:1});
  arbiter.submit({
    actorId:"actor",action:new TestAction({actorId:"actor",type:"AmbientScan",channels:[ACTION_CHANNELS.ATTENTION]}),
    score:.9,authorityTier:ACTION_AUTHORITY_TIERS.AMBIENT_AUTONOMY,authorityLabel:"Ambient autonomy",source:"ambient",reason:"scan"
  });
  arbiter.submit({
    actorId:"actor",action:new TestAction({actorId:"actor",type:"MissionWatch",channels:[ACTION_CHANNELS.ATTENTION]}),
    score:.5,authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,authorityLabel:"Mission responsibility",source:"mission",reason:"watch objective"
  });
  arbiter.submit({
    actorId:"actor",action:new TestAction({actorId:"actor",type:"LocalMove",channels:[ACTION_CHANNELS.LOCOMOTION]}),
    score:.4,authorityTier:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT,authorityLabel:"Local improvement",source:"local",reason:"improve spacing"
  });
  arbiter.resolve({now:1,context});

  assert.deepEqual(scheduler.getActions("actor").map(action=>action.type).sort(),["LocalMove","MissionWatch"]);
  const trace=arbiter.getTrace("actor");
  assert.equal(trace.granted.some(item=>item.actionType==="MissionWatch"),true);
  assert.equal(trace.granted.some(item=>item.actionType==="LocalMove"),true);
  assert.equal(trace.rejected.find(item=>item.actionType==="AmbientScan")?.resultReason,"higher_authority_proposal_owns_channel");
});
