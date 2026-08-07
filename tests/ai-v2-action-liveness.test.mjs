import test from "node:test";
import assert from "node:assert/strict";
import { ActionLivenessMonitor } from "../js/ai-v2/diagnostics/action-liveness-monitor.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { AIV2Action, ACTION_STATES } from "../js/ai-v2/actions/action.js";
import { ACTION_CHANNELS } from "../js/ai-v2/actions/action-channels.js";

class MoveAction extends AIV2Action{
  constructor({actorId="a",destination={x:300,y:0},type="TestMove"}={}){
    super({type,actorId,channels:[ACTION_CHANNELS.LOCOMOTION],priority:200,interruptible:true});
    this.directive={destination,acceptanceRadius:18,kind:"test_move"};
  }
  update(){return null;}
}

const gameWithActor=()=>({actors:[{id:"a",teamId:"t",x:0,y:0,radius:18,obstacleSteerRemaining:0}]});

function context(game){return{game,services:{behavioralTruth:{actorMetrics:new Map()},tacticalPictures:{get:()=>null}}};}

test("movement action is invalidated after sustained lack of meaningful progress",()=>{
  const monitor=new ActionLivenessMonitor({stallSeconds:1.2});
  const game=gameWithActor();
  const action=new MoveAction();action.start(0);monitor.start(action,{game,now:0});
  let result=monitor.inspect(action,{...context(game),now:.7});
  assert.equal(result.invalid,false);
  result=monitor.inspect(action,{...context(game),now:1.3});
  assert.equal(result.invalid,true);
  assert.equal(result.reason,"no_meaningful_progress");
});

test("recently invalidated destination is cooled down but alternate destination remains legal",()=>{
  const monitor=new ActionLivenessMonitor({stallSeconds:1,destinationCooldown:3});
  const game=gameWithActor();
  const action=new MoveAction();action.start(0);monitor.start(action,{game,now:0});
  monitor.inspect(action,{...context(game),now:1.1});
  const same=new MoveAction({destination:{x:310,y:8}});
  const alternate=new MoveAction({destination:{x:300,y:180}});
  assert.equal(monitor.canStart(same,context(game),1.2).ok,false);
  assert.equal(monitor.canStart(alternate,context(game),1.2).ok,true);
  assert.equal(monitor.canStart(same,context(game),4.3).ok,true);
});

test("route travel toward a materially more dangerous threat position is invalidated",()=>{
  const monitor=new ActionLivenessMonitor();
  const game=gameWithActor();
  const action=new MoveAction({destination:{x:240,y:0},type:"FollowOperationRoute"});
  action.start(0);monitor.start(action,{game,now:0});
  const services={behavioralTruth:{actorMetrics:new Map()},tacticalPictures:{get:()=>({contactPressure:.78,threatPoint:{x:260,y:0}})}};
  const result=monitor.inspect(action,{game,services,now:.8});
  assert.equal(result.invalid,true);
  assert.equal(result.reason,"destination_became_tactically_dangerous");
});

test("scheduler interrupts a stalled active move and rejects immediate recreation of the same destination",()=>{
  const scheduler=new ActionScheduler({liveness:new ActionLivenessMonitor({stallSeconds:1})});
  const game=gameWithActor();
  const ctx=context(game);
  const action=new MoveAction();
  assert.equal(scheduler.start(action,{now:0,context:ctx}).ok,true);
  scheduler.update(.6,{now:.6,context:ctx});
  scheduler.update(.6,{now:1.2,context:ctx});
  assert.equal(action.state,ACTION_STATES.INTERRUPTED);
  assert.match(action.endReason,/^liveness:/);
  const retry=new MoveAction({destination:{x:304,y:0}});
  const result=scheduler.start(retry,{now:1.3,context:ctx});
  assert.equal(result.ok,false);
  assert.equal(result.reason,"recently_invalidated_destination");
});
