import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

test("diagnose objective completion to operation return handoff",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"objective_initiative"});
  const snapshots=[];
  for(let step=0;step<900;step+=1){
    game.update(.05,{x:0,y:0});
    if(step%40!==0)continue;
    const team=game.operations.teams.find(candidate=>candidate.factionId==="northline");
    const procedure=team?game.aiV2.teamProcedures.get(team.id):null;
    const agenda=team?game.aiV2.teamAgenda.get(team.id):null;
    const operation=team?.operationId?game.livingSandbox?.getOperation?.(team.operationId):null;
    const objective=game.aiV2.objectives.get("central_field_relay");
    snapshots.push({
      t:Number(game.aiV2.elapsed.toFixed(2)),
      team:team?{id:team.id,operationId:team.operationId,operationStatus:team.operationStatus,currentTask:team.currentTask}:null,
      operation:operation?{id:operation.id,status:operation.status,currentStageIndex:operation.currentStageIndex,objectiveId:operation.objectiveId,objectiveCompletedAt:operation.objectiveCompletedAt,returnStartedAt:operation.returnStartedAt}:null,
      procedure:procedure?{id:procedure.procedureId,phase:procedure.phase?.id,status:procedure.status}:null,
      agenda:agenda?{source:agenda.source,intentId:agenda.intentId,objectiveComplete:agenda.objectiveComplete}:null,
      objective:objective?{state:objective.state,progress:objective.progress,completedByTeamId:objective.completedByTeamId}:null
    });
  }
  const events=game.aiV2.decisionLog.entries.filter(entry=>
    String(entry.type).includes("objective")||String(entry.type).includes("operation")||String(entry.type).includes("procedure")||String(entry.type).includes("return")
  );
  console.log("OBJECTIVE_RETURN_SNAPSHOTS",JSON.stringify(snapshots));
  console.log("OBJECTIVE_RETURN_EVENTS",JSON.stringify(events.slice(0,500)));
  console.log("LIVING_HISTORY",JSON.stringify(game.livingSandbox?.summary?.().history?.slice(-100)??[]));
  assert.ok(true);
});
