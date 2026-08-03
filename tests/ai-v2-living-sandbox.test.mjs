import test from "node:test";
import assert from "node:assert/strict";
import { getSandboxFixture } from "../js/combat-sandbox.js";
import { LivingSandboxState } from "../js/ai-v2/sandbox/living-sandbox-state.js";
import { simulateFixture } from "./helpers/simulate-fixture.mjs";

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
  assert.equal(state.readyReturns({now:25}).length,0);
  assert.equal(state.readyReturns({now:26}).length,1);
  assert.equal(state.completeReturn(first.id,{now:26}),true);

  const second=state.proposeDispatch({objectives,now:27});
  assert.equal(second.factionId,"commune");
  assert.equal(second.objectiveId,"east_field_relay");
  assert.equal(state.getFaction("northline").roster.every(member=>member.status==="recovering"),true);
});

test("living sandbox runs concurrent operations, shares ambient contacts, and returns both teams",()=>{
  const activeGame=simulateFixture("objective_initiative",{seconds:10});
  const activeSummary=activeGame.livingSandbox.summary();
  assert.equal(activeSummary.activeOperationIds.length,2);
  assert.ok(activeGame.aiV2.decisionLog.entries.some(entry=>entry.type==="ambient_contact_observed"));
  assert.ok(activeGame.aiV2.decisionLog.entries.some(entry=>entry.type==="contact_report_delivered"));
  assert.ok(activeGame.aiV2.teamAgenda.summary().every(record=>record.intentId==="restore_objective"&&record.supporting?.intentId==="heighten_watch"));
  const securityActors=activeGame.actors.filter(actor=>actor.procedureRole==="Local Security");
  assert.equal(securityActors.length,2);
  assert.equal(securityActors.every(actor=>actor.aiV2HoldReady?.label==="Reported contact watch"),true);

  const game=simulateFixture("objective_initiative",{seconds:90});
  const summary=game.livingSandbox?.summary?.();
  assert.ok(summary);

  const objectives=game.aiV2.objectives.summary();
  assert.equal(objectives.find(objective=>objective.id==="central_field_relay")?.state,"operational");
  assert.equal(objectives.find(objective=>objective.id==="east_field_relay")?.state,"operational");

  assert.equal(summary.operations.length,2);
  assert.deepEqual(summary.operations.map(operation=>operation.factionId),["northline","commune"]);
  assert.equal(summary.operations.every(operation=>operation.status==="completed"),true);
  assert.ok(summary.operations[1].deployedAt<summary.operations[0].completedAt);
  assert.equal(summary.needs.every(need=>need.status==="resolved"),true);
  assert.deepEqual(summary.activeOperationIds,[]);

  assert.deepEqual(game.operations.teams,[]);
  assert.equal(game.actors.some(actor=>actor.sandboxFixtureId==="objective_initiative"),false);
  assert.equal(game.aiV2.teamMissions.summary().length,0);
  assert.equal(summary.history.filter(entry=>entry.type==="faction_operation_deployed").length,2);
  assert.equal(summary.history.filter(entry=>entry.type==="faction_operation_completed").length,2);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
