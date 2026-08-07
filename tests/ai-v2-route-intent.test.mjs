import test from "node:test";
import assert from "node:assert/strict";
import { OperationalRouteProgressService } from "../js/ai-v2/position/operational-route-progress-service.js";
import { FollowOperationRouteAction } from "../js/ai-v2/actions/follow-operation-route-action.js";

function makeOperation(){
  const waypoints=[
    {id:"a",label:"A",x:0,y:0},
    {id:"b",label:"B",x:100,y:0},
    {id:"c",label:"C",x:200,y:0},
    {id:"d",label:"D",x:300,y:0}
  ];
  return{
    id:"op",status:"deployed",currentStageIndex:0,originPositionId:"base",
    actorIds:["actor"],returnedActorIds:[],unreturnedActorIds:[],
    routePlan:{waypoints,returnWaypoints:[...waypoints].reverse()},
    actorRouteProgress:{actor:{mode:"outbound",index:1,complete:false,lastReachedAt:0}},
    stages:[{status:"active"},{status:"pending"},{status:"pending"}]
  };
}

function makeGame(operation=makeOperation()){
  const living={
    operation,
    getOperation(){return JSON.parse(JSON.stringify(this.operation));},
    operationRouteStatus(operationId,actorId){
      const progress=this.operation.actorRouteProgress[actorId];
      const points=progress.mode==="return"?this.operation.routePlan.returnWaypoints:this.operation.routePlan.waypoints;
      return{operationId,actorId,mode:progress.mode,index:progress.index,complete:progress.complete,waypoint:progress.complete?null:{...points[progress.index]},total:points.length,originPositionId:this.operation.originPositionId,currentStageIndex:this.operation.currentStageIndex};
    },
    markActorRouteWaypoint({actorId,mode,index}){
      const progress=this.operation.actorRouteProgress[actorId];
      const points=mode==="return"?this.operation.routePlan.returnWaypoints:this.operation.routePlan.waypoints;
      if(progress.mode!==mode||progress.index!==index)return false;
      progress.index+=1;
      if(progress.index>=points.length)progress.complete=true;
      return true;
    }
  };
  const actor={id:"actor",teamId:"team",operationId:"op",x:0,y:0,medical:{condition:"healthy",dead:false,unconscious:false}};
  return{game:{actors:[actor],livingSandbox:living},actor,living};
}

test("route progress consumes a waypoint passed beside rather than touched",()=>{
  const {game,actor,living}=makeGame();
  actor.x=120;actor.y=70;
  const service=new OperationalRouteProgressService();
  const intent=service.evaluate({game,actor,operationId:"op",mode:"outbound",now:1,syncLegacy:true});
  assert.ok(intent.strategicProgress>.35);
  assert.equal(living.operation.actorRouteProgress.actor.index,2);
  assert.deepEqual(intent.consumedWaypointIds,["b"]);
  assert.ok(Math.hypot(actor.x-100,actor.y)>42,"actor never entered the old waypoint acceptance radius");
});

test("rejoining near a later segment consumes multiple obsolete markers",()=>{
  const {game,actor,living}=makeGame();
  actor.x=270;actor.y=100;
  const service=new OperationalRouteProgressService();
  const intent=service.evaluate({game,actor,operationId:"op",mode:"outbound",now:1,syncLegacy:true});
  assert.ok(intent.strategicProgress>.85);
  assert.equal(living.operation.actorRouteProgress.actor.index,3);
  assert.deepEqual(intent.consumedWaypointIds,["b","c"]);
});

test("strategic route progress does not regress during ordinary deployment movement",()=>{
  const {game,actor}=makeGame();
  const service=new OperationalRouteProgressService();
  actor.x=180;service.evaluate({game,actor,operationId:"op",mode:"outbound",now:1,syncLegacy:false});
  const high=service.get(actor.id).strategicProgress;
  actor.x=135;
  const later=service.evaluate({game,actor,operationId:"op",mode:"outbound",now:2,syncLegacy:false});
  assert.equal(later.strategicProgress,high);
  assert.ok(later.rawProgress<later.strategicProgress);
});

test("follow route action survives compatibility marker transitions",()=>{
  const {game,living}=makeGame();
  const directive={operationId:"op",operationLabel:"Test",mode:"outbound",destination:{x:190,y:0},utilityScore:3,routeIntent:{strategicProgress:.2,rawProgress:.2,segmentIndex:0,segmentProgress:.6,lateralDeviation:0,lookaheadProgress:.63,lookaheadPoint:{x:190,y:0},corridorSegment:{from:{x:20,y:0},to:{x:260,y:0},width:125}}};
  const action=new FollowOperationRouteAction({actorId:"actor",directive});
  assert.equal(action.canStart({game}),true);
  living.operation.actorRouteProgress.actor.index=2;
  assert.equal(action.canContinue({game}),true,"legacy index changes must not terminate the physical action");
});

test("same persistent route action accepts a moving lookahead without resetting progress",()=>{
  const initial=new FollowOperationRouteAction({actorId:"actor",directive:{operationId:"op",mode:"outbound",destination:{x:150,y:0},utilityScore:3,routeIntent:{strategicProgress:.25,lookaheadPoint:{x:150,y:0},corridorSegment:{from:{x:0,y:0},to:{x:220,y:0},width:125}}}});
  initial.progress=.25;
  const next=new FollowOperationRouteAction({actorId:"actor",directive:{operationId:"op",mode:"outbound",destination:{x:220,y:0},utilityScore:3,routeIntent:{strategicProgress:.48,lookaheadPoint:{x:220,y:0},corridorSegment:{from:{x:80,y:0},to:{x:290,y:0},width:125}}}});
  assert.equal(initial.amendFrom(next),true);
  assert.equal(initial.directive.destination.x,220);
  assert.equal(initial.progress,.48);
});

test("deployment may complete beside the final marker without exact checkpoint entry",()=>{
  const {game,actor,living}=makeGame();
  actor.x=310;actor.y=100;
  const service=new OperationalRouteProgressService();
  const intent=service.evaluate({game,actor,operationId:"op",mode:"outbound",now:1,syncLegacy:true});
  assert.equal(intent.complete,true);
  assert.equal(living.operation.actorRouteProgress.actor.complete,true);
  assert.ok(Math.hypot(actor.x-300,actor.y)>42,"completion did not require old checkpoint radius");
});

test("return mode measures monotonic progress toward origin using reversed route geometry",()=>{
  const operation=makeOperation();
  operation.status="returning";
  operation.currentStageIndex=2;
  operation.actorRouteProgress.actor={mode:"return",index:1,complete:false,lastReachedAt:0};
  const {game,actor,living}=makeGame(operation);
  const service=new OperationalRouteProgressService();
  actor.x=140;
  const first=service.evaluate({game,actor,operationId:"op",mode:"return",now:1,syncLegacy:true});
  assert.ok(first.strategicProgress>.5);
  assert.equal(living.operation.actorRouteProgress.actor.index,2);
  actor.x=60;
  const second=service.evaluate({game,actor,operationId:"op",mode:"return",now:2,syncLegacy:true});
  assert.ok(second.strategicProgress>first.strategicProgress);
  assert.equal(living.operation.actorRouteProgress.actor.index,3);
});

test("moving backward after markers were consumed cannot reactivate them",()=>{
  const {game,actor,living}=makeGame();
  const service=new OperationalRouteProgressService();
  actor.x=235;service.evaluate({game,actor,operationId:"op",mode:"outbound",now:1,syncLegacy:true});
  assert.equal(living.operation.actorRouteProgress.actor.index,3);
  const high=service.get(actor.id).strategicProgress;
  actor.x=80;
  const later=service.evaluate({game,actor,operationId:"op",mode:"outbound",now:2,syncLegacy:true});
  assert.equal(living.operation.actorRouteProgress.actor.index,3);
  assert.equal(later.strategicProgress,high);
});
