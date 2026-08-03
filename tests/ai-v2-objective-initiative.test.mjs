import test from "node:test";
import assert from "node:assert/strict";
import { activeActions, entriesOf, simulateFixture } from "./helpers/simulate-fixture.mjs";

test("objective initiative begins useful work without an authored assignment or encounter",()=>{
  const game=simulateFixture("objective_initiative",{seconds:22});
  const team=game.operations.teams.find(candidate=>candidate.factionId==="northline");
  assert.ok(team);
  const actors=game.actors.filter(actor=>actor.teamId===team.id);
  assert.equal(actors.length,3);
  assert.equal(actors.some(actor=>actor.aiV2Assignment),false);
  assert.equal(game.aiV2.teamResponses.count(),0);

  const agenda=game.aiV2.teamAgenda.get(team.id);
  assert.equal(agenda.source,"mission");
  assert.equal(agenda.intentId,"restore_objective");
  assert.equal(agenda.objectiveComplete,true);

  const procedure=game.aiV2.teamProcedures.get(team.id);
  assert.equal(procedure.procedureId,"restore_field_relay");
  assert.equal(procedure.phase.id,"objective_operational");
  assert.deepEqual(procedure.roles.map(role=>role.roleId),["approach_lead","objective_specialist","local_security"]);
  assert.equal(actors.find(actor=>actor.id===procedure.roles.find(role=>role.roleId==="approach_lead").actorId).role,"Scout");
  assert.equal(actors.find(actor=>actor.id===procedure.roles.find(role=>role.roleId==="objective_specialist").actorId).role,"Engineer");
  assert.equal(actors.find(actor=>actor.id===procedure.roles.find(role=>role.roleId==="local_security").actorId).role,"Security");

  const moves=entriesOf(game,"action_completed","MoveToObjectivePosition");
  assert.equal(moves.length,3);
  assert.equal(new Set(moves.map(entry=>entry.data.roleId)).size,3);
  assert.equal(entriesOf(game,"action_completed","InspectObjective").length,1);
  assert.equal(entriesOf(game,"action_completed","PerformObjectiveWork").length,1);
  assert.equal(entriesOf(game,"objective_approach_selected").length,1);
  assert.equal(entriesOf(game,"objective_completed").length,1);

  const objective=game.aiV2.objectives.get("central_field_relay");
  assert.equal(objective.state,"operational");
  assert.equal(objective.progress,1);
  assert.equal(objective.completedByTeamId,team.id);
  assert.equal(game.aiV2.objectives.claimSummary().length,0);
  assert.deepEqual(game.aiV2.destinationClaims.summary(game.aiV2.elapsed),[]);

  const holds=activeActions(game).filter(action=>action.type==="HoldReady");
  assert.equal(holds.length,3);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
