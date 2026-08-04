import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

function simulate(seconds,{delta=.1}={}){
  const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
  for(let step=0;step<Math.ceil(seconds/delta);step+=1)game.update(delta,{x:0,y:0});
  return game;
}

test("2.2 live sandbox produces distinct physical operations, bounded armed contention, cargo, survey coverage, attrition, and persistent progression",()=>{
  const game=simulate(900);
  const summary=game.livingSandbox.summary();
  const byKind=kind=>summary.operations.filter(operation=>operation.kind===kind);
  assert.equal(byKind("restore_infrastructure").length>0,true);
  assert.equal(byKind("recover_supplies").some(operation=>(operation.cargoPackages??[]).length>0),true);
  assert.equal(byKind("survey_route").some(operation=>(operation.surveyPoints??[]).length>=3),true);
  assert.equal(summary.operations.reduce((sum,operation)=>sum+(operation.returnedResourceAmount??0),0)>0,true,"only physically returned cargo should become strategic resources");
  assert.equal(summary.operations.reduce((sum,operation)=>sum+(operation.surveyPoints??[]).filter(point=>point.status==="recorded").length,0)>0,true);
  assert.equal(summary.operations.some(operation=>operation.result==="deferred_after_armed_contact"),true,"a systemic rival operation should be capable of warning, refusal, protective breakaway, and strategic deferral");
  assert.equal(summary.operations.some(operation=>operation.violent),true,"the running campaign should preserve the strategic record of bounded armed contact; exact wound persistence is covered by the ballistic and roster regressions");
  assert.equal(summary.factions.flatMap(faction=>faction.roster).some(member=>(member.fieldHistory??[]).length>0&&member.experience>0),true);
  assert.equal(game.aiV2.decisionLog.entries.some(entry=>entry.type==="world_need_reopened")||summary.history.some(entry=>entry.type==="world_need_reopened"),true);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
