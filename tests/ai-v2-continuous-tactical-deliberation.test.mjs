import test from "node:test";
import assert from "node:assert/strict";
import { ActorTacticalPictureService } from "../js/ai-v2/actors/actor-tactical-picture-service.js";
import { ActorTacticalDeliberationRuntime } from "../js/ai-v2/actors/actor-tactical-deliberation-runtime.js";
import { ContactFireAction } from "../js/ai-v2/actions/contact-fire-action.js";

const actor=(id,teamId,x,y)=>({id,teamId,x,y,radius:18,medical:{condition:"healthy"},aiV2Suppression:0});

test("tactical picture combines personal threat, suppression, cover, and responsibility",()=>{
  const a=actor("a","blue",100,100),enemy=actor("e","red",380,100);
  a.aiV2Suppression=64;
  const service=new ActorTacticalPictureService({directionalCover:{findBestSlot:()=>({best:{point:{x:140,y:130},utility:{protection:.82}}})}});
  service.update({
    game:{actors:[a,enemy],map:{obstacles:[]},wounds:{getAssessment:()=>({condition:"healthy",bleeding:0}),getTreatmentNeed:()=>null}},
    personalKnowledge:{getContacts:()=>[{subjectId:"e",subjectTeamId:"red",relationship:"unknown",currentlyVisible:true,confidence:80,approximatePosition:{x:380,y:100},lastObservedAt:1}]},
    teamKnowledge:{getTeamContacts:()=>[]},threatKnowledge:{getThreats:()=>[]},
    teamProcedures:{getActorRole:()=>({roleId:"local_security",label:"Local Security",procedureId:"restore",phase:{id:"work"}})},
    teamAgenda:{get:()=>({intentId:"restore",selected:{label:"Restore relay"}})},now:1
  });
  const picture=service.get("a");
  assert.equal(picture.suppressionState,"pinned");
  assert.equal(picture.visibleThreats.length,1);
  assert.deepEqual(picture.bestCover.point,{x:140,y:130});
  assert.equal(picture.responsibility.roleId,"local_security");
});

test("continuous deliberation proposes terrain cover at survival authority when pinned and exposed",()=>{
  const a=actor("a","blue",100,100);a.aiV2Suppression=70;
  const submissions=[];
  const runtime=new ActorTacticalDeliberationRuntime({arbiter:{submit:proposal=>{submissions.push(proposal);proposal.onGranted?.();}}});
  runtime.update({game:{actors:[a]},tacticalPictures:{get:()=>({actorId:"a",suppressionState:"pinned",incomingFire:[{}],exposed:true,bestCover:{point:{x:160,y:130},utility:{protection:.8}},currentCover:{protection:.1},threatPoint:{x:400,y:100},nearestFriendly:null,visibleThreats:[]})},teamProcedures:{getActorRole:()=>null},teamAgenda:{get:()=>null},now:2});
  assert.equal(submissions.length,1);
  assert.equal(submissions[0].authorityTier,600);
  assert.equal(submissions[0].action.type,"TacticalReposition");
});

test("contact fire requires personal visibility for aimed fire and uses recent memory only for suppression",()=>{
  const shooter=actor("s","blue",0,0),enemy=actor("e","red",100,0);shooter.operationPausedByEncounter=true;
  const game={actors:[shooter,enemy]};
  const action=new ContactFireAction({actorId:"s",directive:{subjectTeamId:"red",targetActorId:"e",targetPoint:{x:100,y:0},maximumRounds:1}});
  const modes=[];
  const services={personalKnowledge:{getContacts:()=>[{subjectId:"e",subjectTeamId:"red",currentlyVisible:false,confidence:60,lastObservedAt:0,approximatePosition:{x:98,y:4}}]},attention:{turnToward:()=>({settled:true})},fire:{fireProtectiveShot:args=>{modes.push(args.allowInjury?"aimed":"suppression");return{fired:true};}}};
  const result=action.update(.4,{game,services,now:1});
  assert.equal(result.status,"completed");
  assert.deepEqual(modes,["suppression"]);
  assert.equal(shooter.aiV2ContactFire.fireMode,"suppression");
});
