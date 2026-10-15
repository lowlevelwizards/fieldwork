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
    const operation=team?.operationId?game.livingSandbox?.getOperation?.(team.operationId):null;
    const procedure=team?game.aiV2.teamProcedures.get(team.id):null;
    const agenda=team?game.aiV2.teamAgenda.get(team.id):null;
    const objective=game.aiV2.objectives.get("central_field_relay");
    const actors=team?game.actors.filter(actor=>actor.teamId===team.id):[];
    snapshots.push({
      t:Number(game.aiV2.elapsed.toFixed(2)),
      teamStatus:team?.operationStatus??null,
      operationStatus:operation?.status??null,
      objectiveState:objective?.state??null,
      objectiveProgress:Number((objective?.progress??0).toFixed(2)),
      objectiveComplete:Boolean(agenda?.objectiveComplete),
      phase:procedure?.phase?.id??null,
      actors:actors.map(actor=>({role:actor.role,condition:actor.medical?.condition??null,action:actor.currentAction??null,primary:game.aiV2.scheduler.getPrimaryAction(actor.id)?.type??null}))
    });
  }
  const eventSummary=game.aiV2.decisionLog.entries.filter(entry=>{
    const type=String(entry.type??"");
    return type==="team_response_changed"||type==="objective_completed"||type.includes("operation_return")||type==="action_started"&&["ContactFire","ProtectiveFire","DemonstrativeFire","PerformObjectiveWork","ReactToIncomingFire"].includes(entry.actionType);
  }).map(entry=>({t:Number((entry.time??0).toFixed(2)),type:entry.type,actorId:entry.actorId??null,teamId:entry.teamId??null,actionType:entry.actionType??null,data:entry.data??null}));
  console.log("OBJECTIVE_COMPACT",JSON.stringify(snapshots));
  console.log("OBJECTIVE_EVENTS",JSON.stringify(eventSummary));
  console.log("THREAT_EVENTS",JSON.stringify((game.aiV2ThreatEvents??[]).map(event=>({t:event.emittedAt,kind:event.kind,sourceTeamId:event.sourceTeamId,targetActorId:event.targetActorId}))));
  assert.ok(true);
});
