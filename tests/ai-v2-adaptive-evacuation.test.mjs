import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";
import { entriesOf, simulateFixture } from "./helpers/simulate-fixture.mjs";

function communeTeam(game){return game.operations.teams.find(team=>team.factionId==="commune");}
function runPreparedEvacuation(prepare,{seconds=70,delta=.05}={}){
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"casualty_recovery"});
  game.operations.start();
  prepare(game);
  const steps=Math.ceil(seconds/delta);
  for(let step=0;step<steps;step+=1)game.update(delta,{x:0,y:0});
  return game;
}

function evacuationStarts(game){
  return entriesOf(game,"action_started","EvacuateCasualty");
}

function assertSafeReturn(game,{expectedRouteId}={}){
  const team=communeTeam(game);
  const casualty=game.actors.find(actor=>actor.teamId===team.id&&actor.medical?.condition==="critical");
  const outcome=game.aiV2.encounterOutcomes.getLatest(team.id);
  assert.equal(outcome.kind,"casualty_evacuated_alive");
  assert.equal(outcome.missionResolved,true);
  assert.equal(outcome.immediateHazardResolved,true);
  assert.equal(outcome.followUp,"continued_care_required");
  assert.equal(outcome.subjectCondition,"stable_critical");
  assert.equal(outcome.mobility,"unavailable_for_field_duty");
  assert.equal(outcome.routeId,expectedRouteId);
  assert.equal(outcome.carrierHandoffs,1);
  assert.equal(outcome.originalMissionStatus,"suspended_for_casualty_evacuation");
  assert.equal(casualty.aiV2Evacuated,true);
  assert.equal(casualty.medical.condition,"critical");
  assert.equal(game.wounds.getAssessment(casualty).bleeding,0);
  assert.deepEqual(game.aiV2.destinationClaims.summary(game.aiV2.elapsed),[]);
  assert.deepEqual(game.aiV2.casualtyCare.summary(),[]);
  assert.equal(entriesOf(game,"action_started").some(entry=>/fire|aim/i.test(entry.actionType??"")),false);
  assert.deepEqual(game.aiV2.invariants.current,[]);
}

test("adaptive evacuation selects a route, loses one carrier capability, reassigns, and completes safe return",()=>{
  const game=simulateFixture("casualty_recovery",{seconds:55});
  const team=communeTeam(game);
  const routeSelections=entriesOf(game,"evacuation_route_selected");
  assert.equal(routeSelections.length,1);
  assert.equal(routeSelections[0].data.candidateCount,2);
  assert.equal(routeSelections[0].data.routeId,"west_brush_route");

  const secureLegs=entriesOf(game,"action_completed","AdvanceRouteSecurity");
  assert.deepEqual(secureLegs.map(entry=>entry.data.legIndex),[0,1]);

  const transports=entriesOf(game,"action_completed","EvacuateCasualty");
  assert.equal(transports.length,2);
  assert.deepEqual(transports.map(entry=>entry.data.legIndex),[0,1]);
  assert.notEqual(transports[0].actorId,transports[1].actorId,"carrier responsibility should move to another capable operator");
  assert.ok(transports[0].data.transportStaminaAfter<.2,"the first carrier should become locally ineligible after leg one");
  assert.ok(transports[1].data.transportStaminaAfter>=0,"the replacement carrier should complete the final leg");

  const evacuationRoleStarts=entriesOf(game,"role_action_started").filter(entry=>entry.data?.procedureId==="casualty_evacuation");
  assert.ok(evacuationRoleStarts.some(entry=>entry.actionType==="ObserveSector"&&entry.data?.roleId==="rear_security"),"rear security should preserve independent awareness during evacuation");

  const reassignments=entriesOf(game,"team_procedure_roles_reassigned");
  assert.equal(reassignments.length,1);
  assert.equal(reassignments[0].data.previousCarrier,transports[0].actorId);
  assert.equal(reassignments[0].data.nextCarrier,transports[1].actorId);

  assert.equal(entriesOf(game,"action_completed","ReassessEvacuationCasualty").length,1);
  assert.equal(entriesOf(game,"action_completed","TransferCasualty").length,1);
  assertSafeReturn(game,{expectedRouteId:"west_brush_route"});

  const finalResponse=game.aiV2.teamResponses.get(team.id);
  assert.equal(finalResponse,null,"resolved safe return should eventually release the active team response");
});

test("a replacement carrier walks to the released casualty before taking control",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"casualty_recovery"});
  game.operations.start();
  const team=communeTeam(game);
  const casualty=game.actors.find(actor=>actor.teamId===team.id&&actor.medical?.condition==="critical");
  const interactionRange=team.aiV2Mission.evacuationPlan.interactionRange??82;
  let nextCarrier=null;
  let releasePosition=null;
  let sawApproach=false;
  let secondTransportStarted=false;

  for(let step=0;step<1600;step+=1){
    game.update(.05,{x:0,y:0});
    const reassignments=entriesOf(game,"team_procedure_roles_reassigned");
    if(!nextCarrier&&reassignments.length){
      nextCarrier=game.actors.find(actor=>actor.id===reassignments[0].data.nextCarrier);
      releasePosition={x:casualty.x,y:casualty.y};
      assert.ok(nextCarrier&&releasePosition);
    }
    if(!nextCarrier)continue;

    if(entriesOf(game,"action_started","ApproachEvacuationCasualty").some(entry=>entry.actorId===nextCarrier.id))sawApproach=true;
    const transports=evacuationStarts(game);
    const displacement=Math.hypot(casualty.x-releasePosition.x,casualty.y-releasePosition.y);
    if(transports.length<2){
      assert.ok(displacement<.5,`released casualty moved ${displacement.toFixed(2)} before replacement carrier acquired them`);
      const distanceToPatient=Math.hypot(casualty.x-nextCarrier.x,casualty.y-nextCarrier.y);
      if(distanceToPatient>interactionRange)assert.equal(game.aiV2.casualtyCare.getController(casualty.id),null,"remote carrier must not claim the casualty");
      continue;
    }

    secondTransportStarted=true;
    const distanceAtAcquisition=Math.hypot(casualty.x-nextCarrier.x,casualty.y-nextCarrier.y);
    assert.equal(transports[1].actorId,nextCarrier.id);
    assert.ok(distanceAtAcquisition<=interactionRange+1,`replacement carrier acquired casualty from ${distanceAtAcquisition.toFixed(2)} units away`);
    assert.equal(game.aiV2.casualtyCare.getController(casualty.id),nextCarrier.id);
    break;
  }

  assert.equal(sawApproach,true,"replacement carrier should use a physical approach action");
  assert.equal(secondTransportStarted,true,"replacement carrier should eventually begin the next transport leg");
});

test("the same evacuation procedure adapts to different carrier capabilities and a different viable route",()=>{
  const game=runPreparedEvacuation(game=>{
    const team=communeTeam(game);
    const healthy=game.actors.filter(actor=>actor.teamId===team.id&&!actor.medical?.dead&&actor.medical?.condition!=="critical");
    const medic=healthy.find(actor=>actor.role==="Field Medic");
    const scout=healthy.find(actor=>actor.role==="Scout");
    assert.ok(medic&&scout);

    medic.aiV2Capabilities.patientTransport=.4;
    medic.aiV2Capabilities.transportStamina=1;
    scout.aiV2Capabilities.patientTransport=1;
    scout.aiV2Capabilities.transportStamina=.5;

    const mission=team.aiV2Mission;
    mission.evacuationPlan.routeOptions.find(route=>route.id==="west_brush_route").available=false;
  });

  const selections=entriesOf(game,"evacuation_route_selected");
  assert.equal(selections.length,1);
  assert.equal(selections[0].data.routeId,"east_open_route");

  const transports=evacuationStarts(game);
  assert.equal(transports.length,2);
  const firstCarrier=game.actors.find(actor=>actor.id===transports[0].actorId);
  const secondCarrier=game.actors.find(actor=>actor.id===transports[1].actorId);
  assert.equal(firstCarrier.role,"Scout","capability scoring, not a fixed actor name, should select the initial carrier");
  assert.equal(secondCarrier.role,"Field Medic","the remaining capable operator should take over after the first carrier exhausts transport stamina");
  assert.notEqual(firstCarrier.id,secondCarrier.id);
  assert.ok(entriesOf(game,"action_started","ApproachEvacuationCasualty").some(entry=>entry.actorId===firstCarrier.id||entry.actorId===secondCarrier.id),"a carrier who is not already beside the patient should physically approach before transport");

  assertSafeReturn(game,{expectedRouteId:"east_open_route"});
});
