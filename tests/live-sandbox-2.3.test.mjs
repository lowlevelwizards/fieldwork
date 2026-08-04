import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

function simulate(seconds,{delta=.1,snapshot=null}={}){
  const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2",campaignSnapshot:snapshot});
  for(let step=0;step<Math.ceil(seconds/delta);step+=1)game.update(delta,{x:0,y:0});
  return game;
}

test("2.3 turns the map into a persistent campaign network with physical bases, routes, forward origins, bounded knowledge, and save continuation",()=>{
  const game=simulate(1200);
  const summary=game.livingSandbox.summary();
  const geography=summary.geography;

  assert.equal(geography.positions.filter(position=>position.kind==="base"&&position.active).length,3);
  assert.equal(geography.routes.length>=20,true);
  assert.equal(summary.operations.some(operation=>(operation.routePlan?.routeIds??[]).length>1&&operation.stages?.length===3),true);
  assert.equal(summary.history.some(entry=>entry.type==="operation_deploy_route_completed"),true);
  assert.equal(summary.history.some(entry=>entry.type==="operation_return_route_completed"),true);
  assert.equal(summary.history.some(entry=>entry.type==="operation_went_out_of_contact"),true);
  assert.equal(summary.history.some(entry=>entry.type==="operation_contact_restored"),true);

  const forward=geography.positions.find(position=>position.active&&position.kind!=="base");
  assert.ok(forward,"at least one dependency-gated forward position should be established during the deterministic campaign");
  assert.equal(summary.operations.some(operation=>operation.originPositionId===forward.id&&operation.kind!=="establish_forward_position"),true,"later work should launch from the persistent forward position");

  const knowledge=geography.knowledge.map(record=>({factionId:record.factionId,objectives:new Set(record.knownObjectives.map(item=>item.objectiveId))}));
  const north=knowledge.find(item=>item.factionId==="northline");
  const commune=knowledge.find(item=>item.factionId==="commune");
  assert.notDeepEqual([...north.objectives].sort(),[...commune.objectives].sort(),"factions should make decisions from different geographic knowledge");
  assert.equal(summary.operations.some(operation=>operation.kind==="survey_route"&&(operation.routeSurveyIds??[]).length>0&&(operation.surveyPoints??[]).some(point=>point.routeId)),true);
  assert.deepEqual(game.aiV2.invariants.current,[]);

  const snapshot=game.operations.exportCampaignSnapshot();
  const loaded=new ContinuousGameState({scenario:"live",aiRuntime:"v2",campaignSnapshot:snapshot});
  loaded.operations.start();
  const restored=loaded.livingSandbox.summary();
  const restoredForward=restored.geography.positions.find(position=>position.id===forward.id);
  assert.equal(restoredForward.active,true);
  assert.equal(restoredForward.ownerFactionId,forward.ownerFactionId);
  assert.equal(restored.factions.find(faction=>faction.id==="freelancers").score,summary.factions.find(faction=>faction.id==="freelancers").score);
  assert.deepEqual(restored.factions.find(faction=>faction.id==="freelancers").resources,summary.factions.find(faction=>faction.id==="freelancers").resources);
  assert.equal(restored.operations.some(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status)),false,"active field teams normalize into deferred campaign history on save");
  assert.equal(restored.geography.knowledge.length,3);
});
