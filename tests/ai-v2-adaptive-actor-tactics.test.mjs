import test from "node:test";
import assert from "node:assert/strict";
import { ReactToIncomingFireAction } from "../js/ai-v2/actions/react-to-incoming-fire-action.js";
import { ContactFireAction } from "../js/ai-v2/actions/contact-fire-action.js";
import { SelfAidAction } from "../js/ai-v2/actions/self-aid-action.js";

test("incoming fire reaction owns locomotion and selects a cover or evasion destination",()=>{
  const actor={id:"a",teamId:"t",x:100,y:100,radius:18,medical:{condition:"healthy"}};
  const game={actors:[actor],map:{obstacles:[{id:"rock",type:"rock",x:180,y:100,radius:45}]}};
  const action=new ReactToIncomingFireAction({actorId:"a",threat:{subjectId:"enemy",eventId:"shot",approximatePosition:{x:300,y:100}}});
  const context={game,services:{directionalCover:{findBestSlot:()=>({best:{point:{x:130,y:100}}})},locomotion:{stop(){},moveToward(a,d){a.x=d.x;a.y=d.y;return{arrived:true,distance:0};}},attention:{turnToward:()=>({settled:true})},threatKnowledge:{markReacted:()=>true}}};
  assert.equal(action.canStart(context),true);
  action.start(0,context);
  assert.deepEqual(action.destination,{x:130,y:100});
  const result=action.update(.25,{...context,now:.25});
  assert.equal(result.status,"completed");
});

test("contact fire excludes critical unconscious and dead bodies from target selection",()=>{
  const shooter={id:"s",teamId:"blue",x:0,y:0,medical:{condition:"healthy"},operationPausedByEncounter:true};
  const dead={id:"dead",teamId:"red",x:20,y:0,medical:{condition:"dead",dead:true}};
  const unconscious={id:"down",teamId:"red",x:30,y:0,medical:{condition:"critical",unconscious:true}};
  const active={id:"active",teamId:"red",x:80,y:0,medical:{condition:"healthy"}};
  const game={actors:[shooter,dead,unconscious,active]};
  const action=new ContactFireAction({actorId:"s",directive:{subjectTeamId:"red",targetPoint:{x:20,y:0},maximumRounds:1}});
  const result=action.update(.4,{game,now:.4,services:{attention:{turnToward:()=>({settled:true})},fire:{fireProtectiveShot:({targetPoint})=>({fired:true,targetPoint})}}});
  assert.equal(action.directive.targetActorId,"active");
  assert.equal(result.status,"completed");
});

test("self aid stops movement and consumes the actor's own treatment supply",()=>{
  const actor={id:"a",x:0,y:0,medical:{condition:"wounded"},aiV2MedicalSupplies:{bandage:1}};
  const game={actors:[actor],wounds:{getTreatmentNeed:()=>({type:"bandage"})}};
  const action=new SelfAidAction({actorId:"a",duration:.8});
  const context={game,services:{locomotion:{stop:()=>{}},casualtyCare:{stabilize:()=>({ok:true,treatmentType:"bandage"})}}};
  assert.equal(action.canStart(context),true);
  action.start(0,context);
  const result=action.update(1,{...context,now:1});
  assert.equal(result.status,"completed");
  assert.equal(actor.operationPausedByEncounter,false);
});
