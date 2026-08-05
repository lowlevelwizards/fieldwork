import test from "node:test";
import assert from "node:assert/strict";
import { BehavioralTruthMonitor } from "../js/ai-v2/diagnostics/behavioral-truth-monitor.js";
import { simulateFixture } from "./helpers/simulate-fixture.mjs";

test("behavioral truth monitor records reversals, overlap, close nonreaction, and unattended casualty time",()=>{
  const monitor=new BehavioralTruthMonitor({sampleInterval:.25,closeTeamDistance:100});
  const casualty={id:"c",name:"Casualty",teamId:"a",x:0,y:0,radius:18,medical:{condition:"critical"}};
  const teammate={id:"t",name:"Teammate",teamId:"a",x:300,y:0,radius:18,medical:{condition:"healthy"}};
  const enemy={id:"e",name:"Enemy",teamId:"b",x:60,y:0,radius:18,medical:{condition:"healthy"}};
  const game={actors:[casualty,teammate,enemy]};
  const scheduler={getPrimaryAction:()=>null,getActions:()=>[]};
  for(let step=1;step<=16;step+=1){
    teammate.x=step%2===0?295:305;
    monitor.update(.25,{game,scheduler,now:step*.25});
  }
  const report=monitor.report({scenarioId:"synthetic",now:4});
  assert.ok(report.actors.find(actor=>actor.actorId==="t").directionReversals>=3);
  assert.ok(report.teamPairs.some(pair=>pair.unreactedCloseSeconds>0));
  assert.ok(report.casualties.find(item=>item.casualtyId==="c").unattendedSeconds>=3.5);
  assert.ok(report.signals.pacingActors.includes("t"));
  assert.ok(report.signals.unattendedCasualties.includes("c"));
});

test("20-second casualty fixture records concurrent mission and casualty truth",()=>{
  const game=simulateFixture("casualty_recovery",{seconds:20});
  const report=game.aiV2.behavioralTruth.report({scenarioId:"casualty_recovery"});
  const concernFrame=report.concernTimeline.find(frame=>{
    const kinds=new Set(frame.concerns.map(concern=>concern.kind));
    return kinds.has("mission_progress")&&kinds.has("friendly_casualty");
  });
  assert.ok(concernFrame,"the truth fixture should preserve the mission and casualty as simultaneous concerns");
  assert.ok(report.casualties.length>=1);
  assert.ok(report.samples>=70);
});

test("20-second live sandbox fixture records simultaneous mission and contact concerns without changing behavior authority",()=>{
  const game=simulateFixture("objective_initiative",{seconds:20});
  const report=game.aiV2.behavioralTruth.report({scenarioId:"objective_initiative"});
  const concurrent=report.concernTimeline.some(frame=>{
    const kinds=new Set(frame.concerns.map(concern=>concern.kind));
    return kinds.has("mission_progress")&&(kinds.has("uncertain_contact")||kinds.has("hostile_contact"));
  });
  assert.ok(concurrent,"the board should expose contact pressure without replacing mission progress");
  assert.ok(report.actors.length>=3);
  assert.ok(report.duration>=19.5);
});
