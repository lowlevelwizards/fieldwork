import test from "node:test";
import assert from "node:assert/strict";
import { OperationalRouteProgressService } from "../js/ai-v2/position/operational-route-progress-service.js";
import { OperationalTravelRuntime } from "../js/ai-v2/actors/operational-travel-runtime.js";
import { FollowOperationRouteAction } from "../js/ai-v2/actions/follow-operation-route-action.js";

function fixture(){
  const waypoints=[
    {id:"a",label:"A",x:0,y:0},
    {id:"b",label:"B",x:100,y:0},
    {id:"c",label:"C",x:200,y:0},
    {id:"d",label:"Field site",x:300,y:0}
  ];
  const operation={
    id:"op",label:"Test field operation",status:"deployed",currentStageIndex:0,originPositionId:"base",
    actorIds:["actor"],returnedActorIds:[],unreturnedActorIds:[],
    routePlan:{waypoints,returnWaypoints:[...waypoints].reverse()},
    actorRouteProgress:{actor:{mode:"outbound",index:1,complete:false,lastReachedAt:0}},
    stages:[{status:"active"},{status:"pending"},{status:"pending"}]
  };
  const living={
    geography:{enabled:true},operation,
    getOperation(){return JSON.parse(JSON.stringify(this.operation));},
    operationRouteStatus(operationId,actorId){
      const progress=this.operation.actorRouteProgress[actorId];
      const points=progress.mode==="return"?this.operation.routePlan.returnWaypoints:this.operation.routePlan.waypoints;
      return{operationId,actorId,mode:progress.mode,index:progress.index,complete:progress.complete,waypoint:progress.complete?null:{...points[progress.index]},total:points.length,originPositionId:this.operation.originPositionId,currentStageIndex:this.operation.currentStageIndex};
    },
    markActorRouteWaypoint({actorId,mode,index,now=0}){
      const progress=this.operation.actorRouteProgress[actorId];
      const points=mode==="return"?this.operation.routePlan.returnWaypoints:this.operation.routePlan.waypoints;
      if(progress.mode!==mode||progress.index!==index)return false;
      progress.index+=1;progress.lastReachedAt=now;
      if(progress.index>=points.length){
        progress.complete=true;
        if(mode==="outbound"){
          const all=this.operation.actorIds.every(id=>this.operation.actorRouteProgress[id]?.complete);
          if(all){this.operation.currentStageIndex=1;this.operation.stages[0].status="completed";this.operation.stages[1].status="active";}
        }
      }
      return true;
    }
  };
  const actor={id:"actor",teamId:"team",operationId:"op",x:220,y:60,vx:0,vy:0,medical:{condition:"healthy",dead:false,unconscious:false}};
  const game={scenarioMode:"live",actors:[actor],livingSandbox:living};
  return{game,actor,living,operation};
}

test("broad terminal readiness causally completes outbound travel before 96 percent final-segment progress",()=>{
  const {game,actor,living}=fixture();
  const service=new OperationalRouteProgressService({terminalRadius:140});
  const intent=service.evaluate({game,actor,operationId:"op",mode:"outbound",now:1,syncLegacy:true});

  assert.equal(intent.terminalReady,true,"actor is physically inside the authored broad terminal region");
  assert.ok(intent.rawProgress<.9,"the actor deliberately has not traced 96% of the mathematical route");
  assert.equal(intent.strategicProgress,1);
  assert.equal(intent.complete,true);
  assert.equal(living.operation.actorRouteProgress.actor.complete,true);
  assert.equal(living.operation.currentStageIndex,1,"strategic deployment hands ownership to field work");
  assert.deepEqual(intent.consumedWaypointIds,["b","c","d"],"obsolete markers are consumed because physical terminal arrival proves the route effect");
});

test("terminal handoff makes an incumbent FollowOperationRoute action immediately non-continuable",()=>{
  const {game,actor}=fixture();
  const action=new FollowOperationRouteAction({actorId:actor.id,directive:{
    operationId:"op",operationLabel:"Test",mode:"outbound",destination:{x:300,y:0},utilityScore:3,
    routeIntent:{strategicProgress:.72,rawProgress:.72,lookaheadPoint:{x:300,y:0},corridorSegment:{from:{x:180,y:0},to:{x:300,y:0},width:125}}
  }});
  assert.equal(action.canContinue({game}),true);

  const service=new OperationalRouteProgressService({terminalRadius:140});
  service.evaluate({game,actor,operationId:"op",mode:"outbound",now:1,syncLegacy:true});

  assert.equal(action.canContinue({game}),false,"strategic travel must release locomotion once its desired effect is physically satisfied");
});

test("OperationalTravelRuntime submits no outbound route challenger after field-site terminal handoff",()=>{
  const {game}=fixture();
  const proposals=[];
  const runtime=new OperationalTravelRuntime({brain:{submit:proposal=>proposals.push(proposal)}});
  runtime.update({
    game,
    teamAgenda:{get:()=>({missionId:"op",intentId:"service_infrastructure"})},
    teamProcedures:{getActorRole:()=>({roleId:"objective_specialist",roleLabel:"Objective Specialist"})},
    now:1,
    context:{}
  });

  assert.equal(game.livingSandbox.operation.actorRouteProgress.actor.complete,true);
  assert.equal(game.livingSandbox.operation.currentStageIndex,1);
  assert.equal(proposals.length,0,"field work should not have to outscore a fulfilled strategic route action");
});
