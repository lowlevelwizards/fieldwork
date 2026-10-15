import test from "node:test";
import assert from "node:assert/strict";
import { simulateFixture, entriesOf } from "./helpers/simulate-fixture.mjs";

function compactActor(game,actor){
  const actions=(game.aiV2.scheduler.getActions(actor.id)??[]).map(action=>({id:action.id,type:action.type,state:action.state,endReason:action.endReason??null,goal:action.directive?.destination??action.directive?.slot?.point??null}));
  return {id:actor.id,teamId:actor.teamId,x:Number(actor.x.toFixed(1)),y:Number(actor.y.toFixed(1)),action:actor.currentAction,defensive:actor.aiV2DefensivePosition??null,withdrawal:actor.aiV2Withdrawal??null,liveness:actor.aiV2ActionLiveness??null,actions};
}

function relevantEvents(game,types){
  return game.aiV2.decisionLog.entries.filter(entry=>types.has(entry.actionType)||[
    "action_liveness_invalidated","action_interrupted","action_failed","action_completed","action_started","role_action_started","procedure_transition","team_procedure_transition"
  ].includes(entry.type)).filter(entry=>!entry.actionType||types.has(entry.actionType)).map(entry=>({time:entry.time,type:entry.type,actorId:entry.actorId,actionType:entry.actionType,data:entry.data}));
}

test("debug defensive position closure",()=>{
  const game=simulateFixture("cover_position",{seconds:18});
  const team=game.operations.teams.find(candidate=>candidate.factionId==="northline")??game.operations.teams[0];
  console.log("DEBUG_DEFENSIVE",JSON.stringify({procedure:team?game.aiV2.teamProcedures.get(team.id):null,actors:game.actors.filter(actor=>!team||actor.teamId===team.id).map(actor=>compactActor(game,actor)),defensive:game.aiV2.defensivePositions?.summary?.()??[],slots:game.aiV2.positionSlots?.summary?.(game.aiV2.elapsed)??[],events:relevantEvents(game,new Set(["MoveToPositionSlot","HoldPosition"]))}));
  assert.ok(true);
});

test("debug protective breakaway closure",()=>{
  const game=simulateFixture("objective_initiative",{seconds:20});
  const team=game.operations.teams.find(candidate=>candidate.id==="living_team_sandbox_operation_2");
  console.log("DEBUG_BREAKAWAY",JSON.stringify({procedure:team?game.aiV2.teamProcedures.get(team.id):null,response:team?game.aiV2.teamResponses.get(team.id):null,actors:game.actors.filter(actor=>!team||actor.teamId===team.id).map(actor=>compactActor(game,actor)),claims:game.aiV2.destinationClaims?.summary?.(game.aiV2.elapsed)??[],events:relevantEvents(game,new Set(["WithdrawToRoute","ProtectiveFire"]))}));
  assert.ok(true);
});
