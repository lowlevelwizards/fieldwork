import test from "node:test";
import assert from "node:assert/strict";
import { AIV2Action, ACTION_STATES } from "../js/ai-v2/actions/action.js";
import { ACTION_CHANNELS } from "../js/ai-v2/actions/action-channels.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { entriesOf, simulateFixture } from "./helpers/simulate-fixture.mjs";

class TestAction extends AIV2Action{
  constructor({type,priority,interruptible=true}={}){
    super({type,actorId:"actor",channels:[ACTION_CHANNELS.ATTENTION],priority,interruptible});
  }
}

test("higher-priority actor initiative safely preempts an interruptible channel owner",()=>{
  const scheduler=new ActionScheduler();
  const baseline=new TestAction({type:"BaselineWatch",priority:20});
  const emergency=new TestAction({type:"EmergencyReaction",priority:1000,interruptible:false});
  assert.equal(scheduler.start(baseline,{now:0}).ok,true);
  const result=scheduler.start(emergency,{now:.1});
  assert.equal(result.ok,true);
  assert.equal(baseline.state,ACTION_STATES.INTERRUPTED);
  assert.equal(baseline.endReason,"preempted_by:EmergencyReaction");
  assert.equal(scheduler.hasAction("actor","EmergencyReaction"),true);
  assert.equal(scheduler.hasAction("actor","BaselineWatch"),false);
});

test("open contact turns physical hostile evidence into a bounded protective breakaway",()=>{
  const game=simulateFixture("open_contact",{seconds:18});
  const commune=game.operations.teams.find(team=>team.factionId==="commune");
  assert.ok(commune);

  const threatObservations=entriesOf(game,"personal_threat_observed");
  assert.equal(threatObservations.length,1);
  assert.equal(threatObservations[0].data.eventKind,"near_miss");
  assert.ok(threatObservations[0].data.confidence>=90);

  assert.equal(entriesOf(game,"action_started","ReactToIncomingFire").length,1);
  assert.equal(entriesOf(game,"action_completed","ReactToIncomingFire").length,1);
  assert.equal(entriesOf(game,"action_started","ReportContact").length,1);
  assert.equal(entriesOf(game,"contact_report_delivered").length,1);

  const responseSelections=entriesOf(game,"team_response_selected");
  assert.ok(responseSelections.some(entry=>entry.teamId===commune.id&&entry.data.responseId==="break_contact_under_fire"));
  const procedureStarts=entriesOf(game,"team_procedure_started");
  assert.ok(procedureStarts.some(entry=>entry.teamId===commune.id&&entry.data.procedureId==="protective_breakaway"));

  assert.equal(entriesOf(game,"action_started","ProtectiveFire").length,1);
  const movementStarts=entriesOf(game,"action_started","WithdrawToRoute");
  assert.equal(movementStarts.length,3);
  const movementCompletions=entriesOf(game,"action_completed","WithdrawToRoute");
  assert.equal(movementCompletions.length,3);
  assert.deepEqual(movementCompletions.map(entry=>entry.data.roleId),["lead_mover","protected_mover","covering_operator"]);

  const coveringActor=game.actors.find(actor=>actor.teamId===commune.id&&actor.role==="Rifleman");
  assert.ok(coveringActor);
  assert.ok((coveringActor.aiV2ProtectiveFire?.shotsFired??0)>0);
  assert.ok((coveringActor.aiV2ProtectiveFire?.shotsFired??0)<=4);
  assert.equal(coveringActor.ammoInMagazine,coveringActor.magazineSize-coveringActor.aiV2ProtectiveFire.shotsFired);

  const outcome=game.aiV2.encounterOutcomes.getLatest(commune.id);
  assert.equal(outcome.kind,"contact_broken_under_fire");
  assert.equal(outcome.missionResolved,true);
  assert.equal(outcome.immediateHazardResolved,true);
  assert.equal(outcome.followUp,"hostile_contact_remembered");
  assert.equal(outcome.violent,true);

  assert.deepEqual(game.aiV2.destinationClaims.summary(game.aiV2.elapsed),[]);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
