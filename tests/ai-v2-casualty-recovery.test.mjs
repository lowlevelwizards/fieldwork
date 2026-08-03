import test from "node:test";
import assert from "node:assert/strict";
import { entriesOf, simulateFixture } from "./helpers/simulate-fixture.mjs";

test("casualty fixture assesses before movement, stabilizes once, and preserves an evacuation obligation",()=>{
  const game=simulateFixture("casualty_recovery",{seconds:17});
  const commune=game.actors.filter(actor=>actor.factionId==="commune");
  const medic=commune.find(actor=>actor.role==="Field Medic");
  const security=commune.find(actor=>actor.role==="Security");
  const casualty=commune.find(actor=>actor.medical?.condition==="critical");
  assert.ok(medic&&security&&casualty,"fixture roles should remain explicit");

  assert.equal(entriesOf(game,"casualty_report_delivered").length,1);
  const starts=entriesOf(game,"action_started");
  const recoveryTypes=starts
    .filter(entry=>["ApproachCasualty","AssessCasualty","DragCasualty","StabilizeCasualty"].includes(entry.actionType))
    .map(entry=>entry.actionType);
  assert.deepEqual(recoveryTypes,["ApproachCasualty","AssessCasualty","DragCasualty","StabilizeCasualty"]);

  const securityStart=starts.find(entry=>entry.actorId===security.id&&entry.actionType==="ObserveSector");
  const stabilization=entriesOf(game,"action_completed","StabilizeCasualty")[0];
  assert.ok(securityStart&&stabilization&&securityStart.time<stabilization.time,"security should remain a separate responsibility during care");
  assert.ok(game.aiV2.scheduler.hasAction(security.id,"ObserveSector"),"security watch should still be active when stabilization completes");

  const assessment=game.wounds.getAssessment(casualty);
  assert.equal(assessment.bleeding,0);
  assert.equal(casualty.medical.condition,"critical","stabilization must not magically restore the casualty");
  assert.equal(medic.aiV2MedicalSupplies.pressure_dressing,0,"one pressure dressing should be consumed");
  assert.deepEqual(game.aiV2.destinationClaims.summary(game.aiV2.elapsed),[]);
  assert.deepEqual(game.aiV2.casualtyCare.summary(),[]);

  const outcome=game.aiV2.encounterOutcomes.getLatest(casualty.teamId);
  assert.equal(outcome.kind,"casualty_stabilized");
  assert.equal(outcome.immediateHazardResolved,true);
  assert.equal(outcome.missionResolved,false);
  assert.equal(outcome.followUp,"evacuation_required");
  assert.equal(outcome.subjectCondition,"stable_critical");
  assert.equal(outcome.mobility,"non_ambulatory");
  assert.equal(outcome.status,"ongoing_obligation");

  assert.equal(starts.some(entry=>/fire|aim/i.test(entry.actionType??"")),false);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
