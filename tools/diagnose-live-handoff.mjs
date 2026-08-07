import { ContinuousGameState } from "../js/continuous-game-state.js";

const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
const delta=.05;
let tracked=[];
for(let step=0;step<Math.ceil(120/delta);step+=1){
  game.update(delta,{x:0,y:0});
  const now=step*delta;
  if(!tracked.length&&now>=2)tracked=(game.livingSandbox?.activeOperations?.()??[]).slice(0,3).map(op=>op.id);
  if(step%200!==0||!tracked.length)continue;
  const rows=[];
  for(const operationId of tracked){
    const op=game.livingSandbox?.getOperation?.(operationId);if(!op)continue;
    const team=(game.operations?.teams??[]).find(item=>item.operationId===operationId);
    const procedure=team?game.aiV2?.teamProcedures?.get?.(team.id):null;
    const objective=game.entities.find(e=>e.id===op.objectiveId)??null;
    rows.push({
      t:Number(now.toFixed(1)),operationId,kind:op.kind,status:op.status,stage:op.currentStageIndex,
      objective:{id:op.objectiveId,state:objective?.state??null,progress:Number((objective?.progress??0).toFixed(2))},
      phase:procedure?.phase?.id??null,
      actors:(op.actorIds??[]).map(id=>{const a=game.actors.find(x=>x.id===id);const rs=game.livingSandbox.operationRouteStatus(operationId,id);const ri=a?.aiV2RouteIntent;return{id,name:a?.name,x:Math.round(a?.x??0),y:Math.round(a?.y??0),action:a?.currentAction,route:{mode:rs?.mode,index:rs?.index,total:rs?.total,complete:rs?.complete},intent:ri?{progress:Number((ri.strategicProgress??0).toFixed(3)),raw:Number((ri.rawProgress??0).toFixed(3)),terminalDistance:Math.round(ri.terminalDistance??0),terminalReady:Boolean(ri.terminalReady),deviation:Math.round(ri.lateralDeviation??0)}:null};})
    });
  }
  console.log("HANDOFF",JSON.stringify(rows));
}
