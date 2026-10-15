import test from "node:test";
import assert from "node:assert/strict";
import { activeActions, entriesOf, simulateFixture } from "./helpers/simulate-fixture.mjs";

test("cover position turns hostile evidence into distinct stable directional cover commitments",()=>{
  const game=simulateFixture("cover_position",{seconds:18});
  const northline=game.operations.teams.find(team=>team.factionId==="northline");
  assert.ok(northline);

  assert.equal(entriesOf(game,"personal_threat_observed").length,1);
  assert.equal(entriesOf(game,"action_started","ReactToIncomingFire").length,1);
  assert.equal(entriesOf(game,"contact_report_delivered").length,1);

  const responses=entriesOf(game,"team_response_selected");
  assert.ok(responses.some(entry=>entry.teamId===northline.id&&entry.data.responseId==="hold_defensively"));
  const procedures=entriesOf(game,"team_procedure_started");
  assert.ok(procedures.some(entry=>entry.teamId===northline.id&&entry.data.procedureId==="defensive_position"));

  assert.equal(entriesOf(game,"action_started","MoveToPositionSlot").length,3);
  assert.equal(entriesOf(game,"action_completed","MoveToPositionSlot").length,3);
  assert.equal(entriesOf(game,"action_started","ProtectiveFire").length,0);
  assert.equal(entriesOf(game,"action_started","WithdrawToRoute").length,0);

  const procedure=game.aiV2.teamProcedures.get(northline.id);
  assert.equal(procedure.procedureId,"defensive_position");
  assert.equal(procedure.phase.id,"defensive_hold");
  assert.equal(new Set(procedure.defensive.occupiedRoleIds).size,3);

  const claims=game.aiV2.positionSlots.summary(game.aiV2.elapsed);
  assert.equal(claims.length,3);
  assert.equal(new Set(claims.map(claim=>claim.slotId)).size,3);
  assert.equal(new Set(claims.map(claim=>claim.sourceObjectId)).size,3);
  assert.ok(claims.every(claim=>claim.status==="occupied"));

  // The defensive-position service owns the durable physical commitment. A
  // higher-authority compatible attention action may remain active instead of
  // replacing itself with the cosmetic HoldPosition atom, so validate the
  // stable occupied relationship rather than requiring three identical atoms.
  const commitments=game.aiV2.defensivePositions.summary();
  assert.equal(commitments.length,3);
  assert.equal(new Set(commitments.map(item=>item.actorId)).size,3);
  assert.ok(commitments.every(item=>item.status==="holding"));
  const activeHolds=activeActions(game).filter(action=>action.type==="HoldPosition");
  assert.ok(activeHolds.length>=2);
  const actors=game.actors.filter(actor=>actor.teamId===northline.id);
  assert.ok(actors.every(actor=>["holding","occupied"].includes(actor.aiV2DefensivePosition?.status)));
  assert.ok(actors.every(actor=>(actor.aiV2DefensivePosition?.protection??0)>=.72));

  assert.equal(entriesOf(game,"defensive_position_selected").length,3);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
