import test from "node:test";
import assert from "node:assert/strict";
import { getSandboxFixture } from "../js/combat-sandbox.js";
import { LivingSandboxState } from "../js/ai-v2/sandbox/living-sandbox-state.js";
import { entriesOf, outcomeKinds, simulateFixture } from "./helpers/simulate-fixture.mjs";

function objectiveEntity(spec){
  return{
    ...spec,
    aiObjective:true,
    sandboxNeed:{...spec.sandboxNeed,capabilityNeeds:{...(spec.sandboxNeed?.capabilityNeeds??{})}}
  };
}

test("world needs select a faction roster and move to another faction while the first team recovers",()=>{
  const fixture=getSandboxFixture("objective_initiative");
  const state=new LivingSandboxState({config:fixture.livingSandbox});
  const objectives=fixture.objectives.map(objectiveEntity);

  state.syncObjectives(objectives,{now:0});
  const first=state.proposeDispatch({objectives,now:2});
  assert.equal(first.factionId,"northline");
  assert.equal(first.objectiveId,"central_field_relay");
  assert.deepEqual(first.assignments.map(item=>item.responsibility),["approach_lead","objective_specialist","local_security"]);
  assert.equal(new Set(first.rosterIds).size,3);

  state.markDeployed({operationId:first.id,teamId:"northline_team",actorIds:["a","b","c"],now:2});
  objectives[0].state="operational";
  state.syncObjectives(objectives,{now:12});
  assert.equal(state.beginReturn(first.id,{now:12}),true);
  const readyAt=12+state.postCompletionHold;
  assert.equal(state.readyReturns({now:readyAt-.01}).length,0);
  assert.equal(state.readyReturns({now:readyAt}).length,1);
  assert.equal(state.completeReturn(first.id,{now:readyAt}),true);

  const second=state.proposeDispatch({objectives,now:readyAt+1});
  assert.equal(second.factionId,"commune");
  assert.equal(second.objectiveId,"east_field_relay");
  assert.equal(state.getFaction("northline").roster.every(member=>member.status==="recovering"),true);
});

test("an interrupted operation blocks its need and retries after the blocking operation clears",()=>{
  const fixture=getSandboxFixture("objective_initiative");
  const state=new LivingSandboxState({config:fixture.livingSandbox});
  const objectives=fixture.objectives.map(objectiveEntity);

  state.syncObjectives(objectives,{now:0});
  const blocker=state.proposeDispatch({objectives,now:2});
  state.markDeployed({operationId:blocker.id,teamId:"northline_team",actorIds:["n1","n2","n3"],now:2});
  const interrupted=state.proposeDispatch({objectives,now:4});
  state.markDeployed({operationId:interrupted.id,teamId:"commune_team",actorIds:["c1","c2","c3"],now:4});

  assert.equal(interrupted.factionId,"commune");
  assert.equal(interrupted.objectiveId,"east_field_relay");
  assert.equal(state.interruptOperation(interrupted.id,{
    now:8,
    reason:"withdrew_after_worksite_warning",
    blockingOperationId:blocker.id,
    outcomeId:"withdrawal_outcome"
  }),true);

  const interruptedReadyAt=8+state.interruptedReturnHold;
  assert.equal(state.readyReturns({now:interruptedReadyAt-.01}).length,0);
  assert.deepEqual(state.readyReturns({now:interruptedReadyAt}).map(operation=>operation.id),[interrupted.id]);
  assert.equal(state.completeReturn(interrupted.id,{now:interruptedReadyAt}),true);
  assert.equal(state.getOperation(interrupted.id).status,"deferred");
  assert.equal(state.getNeedByObjective("east_field_relay").status,"blocked");
  assert.equal(state.proposeDispatch({objectives,now:10}),null,"the same need should not immediately redispatch while its blocker is active");

  objectives[0].state="operational";
  state.syncObjectives(objectives,{now:12});
  assert.equal(state.beginReturn(blocker.id,{now:12}),true);
  const blockerReadyAt=12+state.postCompletionHold;
  assert.equal(state.completeReturn(blocker.id,{now:blockerReadyAt}),true);

  const retry=state.proposeDispatch({objectives,now:blockerReadyAt+.1});
  assert.equal(retry.factionId,"freelancers");
  assert.equal(retry.objectiveId,"east_field_relay");
  assert.equal(retry.attemptNumber,2);
  assert.equal(state.getNeedByObjective("east_field_relay").attemptCount,2);
});

test("living sandbox turns ignored warning into bounded armed contact, deferral, retry, and stable completion",()=>{
  const warningGame=simulateFixture("objective_initiative",{seconds:12});
  const warningSummary=warningGame.livingSandbox.summary();
  assert.equal(warningSummary.operations.length,2);
  assert.deepEqual(warningSummary.operations.map(operation=>operation.factionId),["northline","commune"]);
  assert.deepEqual(warningSummary.operations.map(operation=>operation.status),["deployed","deployed"]);

  const approachingUpdate=entriesOf(warningGame,"contact_activity_update_delivered")
    .find(entry=>entry.data.activity==="approaching"&&entry.teamId==="living_team_sandbox_operation_1");
  const warnings=entriesOf(warningGame,"directed_warning_delivered");
  const pressed=entriesOf(warningGame,"team_response_changed")
    .find(entry=>entry.teamId==="living_team_sandbox_operation_2"&&entry.data.to==="press_operation");
  const warningShots=entriesOf(warningGame,"action_completed","DemonstrativeFire");
  assert.ok(approachingUpdate,"ambient mission reporting should identify the approaching operation");
  assert.equal(warnings.length,1,"the temporary worksite boundary should produce one warning");
  assert.equal(warnings[0].data.warningType,"keep_clear");
  assert.ok(approachingUpdate.time<warnings[0].time,"activity evidence should precede the warning decision");
  assert.ok(pressed&&warnings[0].time<pressed.time,"the warned team should deliberately press its operation after hearing the warning");
  assert.equal(warningShots.length,1,"ignored warning should produce exactly one demonstrative round");
  assert.ok(pressed.time<warningShots[0].time,"mission refusal should precede controlled enforcement");

  const exchangeGame=simulateFixture("objective_initiative",{seconds:18});
  const breakContact=entriesOf(exchangeGame,"team_response_changed")
    .find(entry=>entry.teamId==="living_team_sandbox_operation_2"&&entry.data.to==="break_contact_under_fire");
  const defensiveHold=entriesOf(exchangeGame,"team_response_changed")
    .find(entry=>entry.teamId==="living_team_sandbox_operation_1"&&entry.data.to==="hold_defensively");
  const protectiveStarts=entriesOf(exchangeGame,"action_started","ProtectiveFire");
  const withdrawalStarts=entriesOf(exchangeGame,"action_started","WithdrawToRoute");
  assert.ok(breakContact,"physical hostile evidence should govern the intruding team");
  assert.equal(protectiveStarts.length,1,"one operator should own the bounded protective burst");
  assert.ok(defensiveHold,"return fire should make the worksite team hold defensively rather than pursue");
  assert.deepEqual(withdrawalStarts.map(entry=>entry.data.provenance?.roleId),["lead_mover","protected_mover"]);
  assert.ok(protectiveStarts[0].time>=breakContact.time);

  const deferredGame=simulateFixture("objective_initiative",{seconds:24});
  const deferredSummary=deferredGame.livingSandbox.summary();
  assert.deepEqual(deferredSummary.operations.map(operation=>operation.status),["deployed","deferred"]);
  assert.deepEqual(deferredSummary.activeOperationIds,["sandbox_operation_1"]);
  const interrupted=deferredSummary.operations[1];
  assert.equal(interrupted.result,"deferred_after_armed_contact");
  assert.equal(interrupted.violent,true);
  assert.deepEqual(new Set(outcomeKinds(deferredGame)),new Set(["contact_broken_under_fire"]));
  assert.equal(entriesOf(deferredGame,"faction_operation_interrupted").length,1);
  assert.equal(entriesOf(deferredGame,"faction_operation_deferred").length,1);

  const blockedNeed=deferredSummary.needs.find(need=>need.objectiveId==="east_field_relay");
  assert.equal(blockedNeed.status,"blocked");
  assert.equal(blockedNeed.blockedByOperationId,"sandbox_operation_1");
  assert.equal(blockedNeed.attemptCount,1);
  const partialEast=deferredGame.aiV2.objectives.get("east_field_relay");
  assert.equal(partialEast.state,"being_restored");
  assert.ok(partialEast.progress>0&&partialEast.progress<1,"interrupted physical work should remain in the world for a later retry");

  const game=simulateFixture("objective_initiative",{seconds:70});
  const summary=game.livingSandbox.summary();
  const objectives=game.aiV2.objectives.summary();
  assert.equal(objectives.find(objective=>objective.id==="central_field_relay")?.state,"operational");
  assert.equal(objectives.find(objective=>objective.id==="east_field_relay")?.state,"operational");

  assert.equal(summary.operations.length,3);
  assert.deepEqual(summary.operations.map(operation=>operation.factionId),["northline","commune","freelancers"]);
  assert.deepEqual(summary.operations.map(operation=>operation.status),["completed","deferred","completed"]);
  assert.deepEqual(summary.operations.map(operation=>operation.attemptNumber),[1,1,2]);
  assert.equal(summary.operations[1].result,"deferred_after_armed_contact");
  assert.equal(summary.operations[1].violent,true);
  assert.ok(summary.operations[1].deployedAt<summary.operations[0].completedAt,"the interrupted operation must overlap the blocking operation");
  assert.equal(summary.needs.every(need=>need.status==="resolved"),true);
  assert.equal(summary.needs.find(need=>need.objectiveId==="east_field_relay")?.attemptCount,2);
  assert.deepEqual(summary.activeOperationIds,[]);

  const allWarningShots=entriesOf(game,"action_completed","DemonstrativeFire");
  const protectiveActions=entriesOf(game,"action_started","ProtectiveFire");
  assert.equal(allWarningShots.length,1);
  assert.equal(protectiveActions.length,1);
  const coveringActor=game.aiV2.decisionLog.entries.find(entry=>entry.type==="action_started"&&entry.actionType==="ProtectiveFire")?.actorId;
  const historicalRounds=game.aiV2.decisionLog.entries
    .filter(entry=>entry.type==="physical_threat_event_consumed"&&String(entry.data?.eventId??"").includes(coveringActor??"__none__"));
  assert.ok(historicalRounds.length<=4,"protective return fire must remain bounded");
  assert.equal(entriesOf(game,"action_started").some(entry=>/pursu/i.test(entry.actionType??"")),false);

  assert.deepEqual(game.operations.teams,[]);
  assert.equal(game.actors.some(actor=>actor.sandboxFixtureId==="objective_initiative"),false);
  assert.equal(game.aiV2.teamMissions.summary().length,0);
  assert.equal(summary.history.filter(entry=>entry.type==="faction_operation_deployed").length,3);
  assert.equal(summary.history.filter(entry=>entry.type==="faction_operation_completed").length,2);
  assert.equal(summary.history.filter(entry=>entry.type==="faction_operation_deferred").length,1);
  assert.equal(summary.history.filter(entry=>entry.type==="world_need_retry_opened").length,1);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
