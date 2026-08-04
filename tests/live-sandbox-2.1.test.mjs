import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

function simulate(seconds,{delta=.05}={}){
  const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
  const steps=Math.ceil(seconds/delta);
  for(let step=0;step<steps;step+=1)game.update(delta,{x:0,y:0});
  return game;
}

test("2.1 live sandbox sustains three factions, three operation families, persistent rosters, authority traces, and world turnover",()=>{
  const game=simulate(600,{delta:.1});
  const summary=game.livingSandbox.summary();
  assert.equal(game.scenarioMode,"live");
  assert.equal(summary.factions.length,3);
  assert.equal(summary.factions.every(faction=>faction.roster.length===9),true);
  assert.equal(summary.needs.length>=12,true);
  assert.equal(summary.operations.length>12,true,"completed objectives should degrade, reopen their needs, and generate later operations");
  for(const kind of ["restore_infrastructure","recover_supplies","survey_route"])assert.equal(summary.operations.some(operation=>operation.kind===kind),true);
  assert.equal(summary.factions.every(faction=>faction.score>0),true);
  assert.equal(summary.factions.some(faction=>Object.values(faction.resources).some(value=>value>0)),true);
  assert.equal(summary.factions.flatMap(faction=>faction.roster).some(member=>member.experience>0&&member.operationCount>0),true);
  assert.equal(summary.operations.some(operation=>Object.keys(operation.scoreBreakdown??{}).includes("interest")),true);
  assert.equal(game.aiV2.actionArbiter.summary().some(trace=>trace.active.length||trace.granted.length),true);
  assert.deepEqual(game.aiV2.invariants.current,[]);
  assert.equal(summary.history.some(entry=>entry.type==="live_world_objective_changed")||game.aiV2.decisionLog.entries.some(entry=>entry.type==="live_world_objective_changed"),true);
  assert.equal(game.aiV2.decisionLog.entries.some(entry=>entry.type==="world_need_reopened")||summary.history.some(entry=>entry.type==="world_need_reopened"),true,"world turnover must create new work rather than only changing presentation state");
});

test("dead roster members remain permanently unavailable while wounded members recover on a severity timer",()=>{
  const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
  for(let step=0;step<50;step+=1)game.update(.05,{x:0,y:0});
  const operation=game.livingSandbox.activeOperations()[0];
  assert.ok(operation);
  const actors=operation.actorIds.map(id=>game.actors.find(actor=>actor.id===id));
  actors[0].medical={...(actors[0].medical??{}),dead:true,condition:"dead",wounds:[{severity:"catastrophic"}]};
  actors[1].medical={...(actors[1].medical??{}),dead:false,condition:"serious",wounds:[{severity:"major"}]};
  game.livingSandbox.interruptOperation(operation.id,{now:3,reason:"test_return"});
  game.livingSandbox.reconcileReturn(operation.id,{actors,now:4});
  game.livingSandbox.completeReturn(operation.id,{now:4});
  const faction=game.livingSandbox.getFaction(operation.factionId);
  const dead=faction.roster.find(member=>member.id===operation.rosterIds[0]);
  const wounded=faction.roster.find(member=>member.id===operation.rosterIds[1]);
  assert.equal(dead.status,"dead");
  assert.equal(dead.availableAt,Infinity);
  assert.equal(wounded.status,"recovering");
  assert.ok(wounded.availableAt>4+game.livingSandbox.recoveryDuration);
  game.livingSandbox.updateRecovery({now:wounded.availableAt+1});
  const recovered=game.livingSandbox.getFaction(operation.factionId).roster.find(member=>member.id===wounded.id);
  assert.equal(recovered.status,"available");
  assert.equal(game.livingSandbox.getFaction(operation.factionId).roster.find(member=>member.id===dead.id).status,"dead");
});
