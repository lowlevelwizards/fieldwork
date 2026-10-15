import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

test("diagnose interrupted objective casualty recovery and return handoff",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"objective_initiative"});
  const snapshots=[];
  for(let step=0;step<900;step+=1){
    game.update(.05,{x:0,y:0});
    if(step%20!==0)continue;
    const team=game.operations.teams.find(candidate=>candidate.factionId==="northline");
    const procedure=team?game.aiV2.teamProcedures.get(team.id):null;
    const agenda=team?game.aiV2.teamAgenda.get(team.id):null;
    const operation=team?.operationId?game.livingSandbox?.getOperation?.(team.operationId):null;
    const mission=team?game.aiV2.teamMissions.get(team.id):null;
    const objective=game.aiV2.objectives.get("central_field_relay");
    const actors=team?game.actors.filter(actor=>actor.teamId===team.id):[];
    snapshots.push({
      t:Number(game.aiV2.elapsed.toFixed(2)),
      team:team?{id:team.id,operationId:team.operationId,operationStatus:team.operationStatus,currentTask:team.currentTask}:null,
      operation:operation?{id:operation.id,status:operation.status,currentStageIndex:operation.currentStageIndex,objectiveId:operation.objectiveId,objectiveCompletedAt:operation.objectiveCompletedAt,returnStartedAt:operation.returnStartedAt}:null,
      procedure:procedure?{id:procedure.procedureId,phase:procedure.phase?.id,status:procedure.status,subjectId:procedure.subjectId,roles:procedure.roles?.map(role=>({roleId:role.roleId,actorId:role.actorId,phase:role.phase?.id,need:role.fulfillment?.need}))}:null,
      agenda:agenda?{source:agenda.source,intentId:agenda.intentId,objectiveComplete:agenda.objectiveComplete}:null,
      mission:mission?{recoveryPoint:mission.recoveryPlan?.recoveryPoint,exit:mission.withdrawalPlan?.exitPoint}:null,
      objective:objective?{state:objective.state,progress:objective.progress,completedByTeamId:objective.completedByTeamId}:null,
      actors:actors.map(actor=>({
        id:actor.id,role:actor.role,x:Number(actor.x.toFixed(1)),y:Number(actor.y.toFixed(1)),medical:actor.medical?{condition:actor.medical.condition,blood:actor.medical.blood,bleedingRate:actor.medical.bleedingRate,unconscious:actor.medical.unconscious,dead:actor.medical.dead}:null,
        action:actor.currentAction,recovery:actor.aiV2Recovery??null,liveness:actor.aiV2ActionLiveness??null,
        actions:(game.aiV2.scheduler.getActions(actor.id)??[]).map(action=>({id:action.id,type:action.type,state:action.state,endReason:action.endReason??null,destination:action.directive?.destination??action.directive?.recoveryPoint??null}))
      }))
    });
  }
  const interesting=new Set(["DragCasualty","ApproachCasualty","AssessCasualty","StabilizeCasualty","ProtectiveFire","DemonstrativeFire","ContactFire","ReactToIncomingFire","PerformObjectiveWork"]);
  const events=game.aiV2.decisionLog.entries.filter(entry=>{
    const type=String(entry.type??"");
    return interesting.has(entry.actionType)||type.includes("objective")||type.includes("operation")||type.includes("procedure")||type.includes("return")||type.includes("liveness")||type.includes("wound")||type.includes("fire")||type.includes("threat");
  });
  console.log("OBJECTIVE_RECOVERY_SNAPSHOTS",JSON.stringify(snapshots));
  console.log("OBJECTIVE_RECOVERY_EVENTS",JSON.stringify(events.slice(0,1400)));
  assert.ok(true);
});
