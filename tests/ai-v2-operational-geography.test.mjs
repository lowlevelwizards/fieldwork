import test from "node:test";
import assert from "node:assert/strict";
import { LIVE_SANDBOX_FIXTURE } from "../data/live-sandbox-2.1.js";
import { OperationalGeographyState } from "../js/ai-v2/campaign/operational-geography-state.js";

function createGeography(){
  const config=LIVE_SANDBOX_FIXTURE.livingSandbox;
  const geography=new OperationalGeographyState({config:config.geography,factions:config.factions});
  geography.syncWorld({objectives:LIVE_SANDBOX_FIXTURE.objectives,now:0});
  return geography;
}

test("operational geography preserves faction-bounded knowledge and turns route surveys into cheaper usable access",()=>{
  const geography=createGeography();
  assert.equal(geography.knowsObjective("northline","central_field_relay"),true);
  assert.equal(geography.knowsObjective("commune","central_field_relay"),false);
  assert.equal(geography.knowsObjective("freelancers","east_quarry_cache"),true);

  const before=geography.findRoute({factionId:"freelancers",fromNodeId:"freelancers_base_node",toNodeId:"quarry_road_node"});
  assert.ok(before);
  assert.equal(geography.isRouteVerified("freelancers","quarry_access_link"),false);
  geography.recordRouteKnowledge("freelancers","quarry_access_link",{state:"verified",now:12});
  const after=geography.findRoute({factionId:"freelancers",fromNodeId:"freelancers_base_node",toNodeId:"quarry_road_node"});
  assert.ok(after.cost<before.cost,"verified geographic knowledge should lower strategic route cost");
  assert.equal(after.unknownRouteIds.includes("quarry_access_link"),false);
});

test("forward positions require known dependencies, become physical launch origins, store returned cargo, and persist",()=>{
  const geography=createGeography();
  const resources={medical:1,technical:3,food:2,fuel:5};
  assert.equal(geography.canAttemptObjective("freelancers","east_quarry_cache",{resources}),false,"the field cache depends on verified quarry access");
  geography.recordRouteKnowledge("freelancers","quarry_access_link",{state:"verified",now:8});
  assert.equal(geography.canAttemptObjective("freelancers","east_quarry_cache",{resources}),true);
  assert.equal(geography.establishForwardPosition("east_quarry_cache","freelancers",{now:20}),true);
  geography.recordPositionReturn("east_quarry_cache",{factionId:"freelancers",resourceType:"fuel",amount:3,now:30});

  const launch=geography.chooseLaunchPlan("freelancers","quarry_fuel");
  assert.equal(launch.origin.id,"east_quarry_cache","nearby work should launch from the connected forward cache instead of the distant headquarters");
  assert.equal(geography.getPosition("east_quarry_cache").storage.fuel,3);

  const snapshot=geography.exportState();
  const restored=createGeography();
  assert.equal(restored.importState(snapshot),true);
  const position=restored.getPosition("east_quarry_cache");
  assert.equal(position.active,true);
  assert.equal(position.ownerFactionId,"freelancers");
  assert.equal(position.storage.fuel,3);
  assert.equal(restored.isRouteVerified("freelancers","quarry_access_link"),true);
});

test("teams become overdue outside communication coverage and regain contact at a connected base",()=>{
  const geography=createGeography();
  const operation={id:"operation_test",factionId:"northline",objectiveId:"marsh_route",contactStatus:"in_contact",outOfContactSince:null,lastCommunicationAt:0};
  assert.equal(geography.updateOperationCommunication(operation,[{x:920,y:3120}],{now:5}),"out_of_contact");
  assert.equal(operation.outOfContactSince,5);
  assert.equal(geography.updateOperationCommunication(operation,[{x:920,y:3120}],{now:50}),"overdue");
  assert.equal(operation.overdueAt,50);
  assert.equal(geography.updateOperationCommunication(operation,[{x:3750,y:260}],{now:55}),"in_contact");
  assert.equal(operation.outOfContactSince,null);
  assert.equal(operation.overdueAt,null);
});

test("infrastructure dependencies reveal and unlock later campaign work",()=>{
  const geography=createGeography();
  assert.equal(geography.knowsObjective("northline","river_pump"),false,"the distant pump begins outside Northline's bounded knowledge");
  const relay={...LIVE_SANDBOX_FIXTURE.objectives.find(objective=>objective.id==="central_field_relay"),state:"operational"};
  geography.applyOperationOutcome({operation:{id:"relay_restore",kind:"restore_infrastructure",factionId:"northline",objectiveId:"central_field_relay",result:"completed"},objective:relay,now:20});
  assert.equal(geography.knowsObjective("northline","river_pump"),true,"restoring the relay should reveal nearby objective state to its beneficiary");

  const resources={medical:2,technical:4,food:2,fuel:4};
  assert.equal(geography.canAttemptObjective("northline","ridge_field_station",{resources}),false,"the ridge station remains gated while its generator is damaged");
  const objectives=LIVE_SANDBOX_FIXTURE.objectives.map(objective=>objective.id==="north_generator"?{...objective,state:"operational"}:objective);
  geography.syncWorld({objectives,now:30});
  assert.equal(geography.canAttemptObjective("northline","ridge_field_station",{resources}),true,"restoring the generator should unlock the connected forward station");
});
