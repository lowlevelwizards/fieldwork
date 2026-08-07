import { ContinuousGameState } from "../js/continuous-game-state.js";

const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
const delta=.05;
for(let step=0;step<Math.ceil(70/delta);step+=1){
  game.update(delta,{x:0,y:0});
  if(step%200===0){
    const t=(step*delta).toFixed(1);
    console.log(`\n=== t=${t}s ===`);
    console.log("operations",game.livingSandbox?.activeOperations?.().map(op=>({id:op.id,faction:op.factionId,kind:op.kind,status:op.status,objective:op.objectiveId,desired:op.desiredState,stage:op.currentStageIndex,route:Object.fromEntries(Object.entries(op.actorRouteProgress??{}).map(([id,v])=>[id,{mode:v.mode,index:v.index,complete:v.complete}]))})));
    for(const team of game.operations?.teams??[]){
      const procedure=game.aiV2?.teamProcedures?.get?.(team.id);
      const agenda=game.aiV2?.teamAgenda?.get?.(team.id);
      const actors=game.actors.filter(a=>a.teamId===team.id).map(a=>({id:a.id,name:a.name,x:Math.round(a.x),y:Math.round(a.y),action:a.currentAction,task:a.currentTask,role:game.aiV2?.teamProcedures?.getActorRole?.(a.id)?.roleId??null,objective:a.aiV2Objective??null,liveness:a.aiV2ActionLiveness?.status??null,steering:a.aiV2Steering?{kind:a.aiV2Steering.kind,mode:a.aiV2Steering.navigationMode,goal:a.aiV2Steering.goal,target:a.aiV2Steering.target}:null,active:(game.aiV2?.scheduler?.getActions?.(a.id)??[]).map(x=>x.type)}));
      console.log("team",team.id,{operationStatus:team.operationStatus,procedure:procedure?{id:procedure.procedureId,phase:procedure.phase?.id,objective:procedure.objective,survey:procedure.survey,events:procedure.events?.slice(-6)}:null,agenda:agenda?{intent:agenda.intentId,objectiveComplete:agenda.objectiveComplete}:null,actors});
    }
    console.log("objectives",game.entities.filter(e=>e.aiObjective).map(o=>({id:o.id,state:o.state,progress:Number((o.progress??0).toFixed?.(2)??o.progress),desired:o.sandboxNeed?.desiredState??o.objectiveRequirements?.desiredState})));
  }
}
console.log("\n=== final recent decision events ===");
for(const entry of (game.aiV2?.decisionLog?.entries??[]).slice(-120))console.log(JSON.stringify({type:entry.type,time:entry.time,actorId:entry.actorId,teamId:entry.teamId,actionType:entry.actionType,data:entry.data}));
