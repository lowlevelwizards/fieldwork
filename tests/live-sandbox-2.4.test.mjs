import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";
import { LIVE_SANDBOX_FIXTURE } from "../data/live-sandbox-2.1.js";
import { operatorKits } from "../data/operator-kits.js";

function simulate(seconds,{delta=.1}={}){
  const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
  const seen=new Map();
  for(let step=0;step<Math.ceil(seconds/delta);step+=1){
    game.update(delta,{x:0,y:0});
    for(const actor of game.actors){
      if(!seen.has(actor.factionId))seen.set(actor.factionId,new Set());
      seen.get(actor.factionId).add(actor.id);
    }
  }
  return{game,seen};
}

test("2.4 live rosters use real faction kits and all three factions physically spawn",()=>{
  const roster=LIVE_SANDBOX_FIXTURE.livingSandbox.factions.flatMap(faction=>faction.roster.map(member=>({...member,factionId:faction.id})));
  assert.equal(roster.every(member=>Boolean(operatorKits[member.kitId])),true,"no persistent operator may silently fall back to the generic visual kit");
  assert.equal(new Set(roster.filter(member=>member.factionId==="northline").map(member=>member.kitId)).size>=3,true);
  assert.equal(new Set(roster.filter(member=>member.factionId==="commune").map(member=>member.kitId)).size>=4,true);
  assert.equal(new Set(roster.filter(member=>member.factionId==="freelancers").map(member=>member.kitId)).size>=4,true);

  const {game,seen}=simulate(6);
  for(const factionId of ["northline","commune","freelancers"]){
    assert.equal((seen.get(factionId)?.size??0)>=3,true,`${factionId} should have a physical team in the world within the opening dispatch window`);
  }
  assert.equal(game.actors.every(actor=>Boolean(operatorKits[actor.kitId])),true);
});

test("2.4 live sandbox forms recognized local contracts without erasing armed incompatible encounters",()=>{
  const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
  const seen=new Map(),contractTypes=new Set();
  let recognized=false,assistanceObserved=false;
  for(let step=0;step<1800;step+=1){
    game.update(.1,{x:0,y:0});
    for(const actor of game.actors){if(!seen.has(actor.factionId))seen.set(actor.factionId,new Set());seen.get(actor.factionId).add(actor.id);}
    for(const contract of game.aiV2.relationships.summary({now:game.aiV2.elapsed}))contractTypes.add(contract.type);
    recognized ||= game.aiV2.teamUnderstanding.summary().some(group=>group.contacts.some(contact=>contact.factionId&&contact.subjectTeamId));
    assistanceObserved ||= game.aiV2.objectives.assistanceSummary().length>0||game.aiV2.decisionLog.entries.some(entry=>entry.type==="objective_assistance_started");
  }
  const summary=game.livingSandbox.summary();
  for(const factionId of ["northline","commune","freelancers"])assert.equal((seen.get(factionId)?.size??0)>0,true);
  assert.equal(recognized,true,"teams should aggregate observed operators into recognized team contacts");
  assert.equal([...contractTypes].some(type=>["pass_through","parallel_work","shared_security","casualty_aid"].includes(type)),true,"the deterministic campaign should produce at least one bounded local interaction contract");
  assert.equal(assistanceObserved,true,"a recognized team should be able to contribute spare local capacity through the existing objective-assistance system");
  assert.equal(summary.operations.some(operation=>operation.result==="deferred_after_armed_contact"),true,"explicitly incompatible contested operations must still be able to escalate and defer");

  for(const outgoing of game.aiV2.heardCommunications.summary().outgoing){
    const speaker=game.actors.find(actor=>actor.teamId===outgoing.teamId);
    for(const recipientId of outgoing.warning.recipientIds){
      const recipient=game.actors.find(actor=>actor.id===recipientId);
      if(speaker&&recipient)assert.notEqual(recipient.factionId,speaker.factionId,"same-faction teams must never receive one another's warnings");
    }
  }
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
