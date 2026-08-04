import test from "node:test";
import assert from "node:assert/strict";
import { TeamRelationshipService } from "../js/ai-v2/relationships/team-relationship-service.js";
import { TeamContactUnderstandingStore } from "../js/ai-v2/knowledge/team-contact-understanding.js";
import { TeamInteractionRuntime } from "../js/ai-v2/interactions/team-interaction-runtime.js";

function actor(id,teamId,factionId,x,y,{operationId,currentAction="Traveling route",medical={condition:"healthy"}}={}){
  return{id,teamId,factionId,x,y,operationId,currentAction,medical,aiV2Capabilities:{medical:.8}};
}
function report(subject,{factionId=subject.factionId,confidence=78}={}){
  return{subjectId:subject.id,subjectTeamId:subject.teamId,factionId,factionConfidence:confidence,confidence,reportedAt:2,approximatePosition:{x:subject.x,y:subject.y},activity:"traveling",relationship:"unknown"};
}
function storesFor(game,reportsByTeam){
  const relationships=new TeamRelationshipService();
  const understanding=new TeamContactUnderstandingStore();
  const teamKnowledge={getTeamContacts:teamId=>reportsByTeam.get(teamId)??[]};
  understanding.update({game,teamKnowledge,relationships,now:2});
  return{relationships,understanding};
}

test("recognized inter-faction route traffic becomes a bounded pass-through contract instead of a warning",()=>{
  const north=actor("north","north_team","northline",0,0,{operationId:"north_op"});
  const commune=actor("commune","commune_team","commune",180,0,{operationId:"commune_op"});
  const operations=new Map([
    ["north_op",{id:"north_op",kind:"survey_route",objectiveId:"north_route",objectiveLabel:"North Route"}],
    ["commune_op",{id:"commune_op",kind:"recover_supplies",objectiveId:"clinic",objectiveLabel:"Clinic Cache"}]
  ]);
  const game={actors:[north,commune],objectives:[],livingSandbox:{getOperation:id=>operations.get(id)??null}};
  const reports=new Map([[north.teamId,[report(commune)]]]);
  const {relationships,understanding}=storesFor(game,reports);
  const recognized=understanding.get(north.teamId,commune.teamId);
  assert.equal(recognized.factionId,"commune");
  assert.equal(recognized.operationHypothesis.kind,"traveling");
  assert.equal(recognized.protocol,"pass_through");

  const interactions=new TeamInteractionRuntime();
  interactions.update({game,understanding,relationships,teamMissions:new Map([[north.teamId,{decisionContext:{timePressure:.4}}]]),now:2});
  const contract=relationships.getContract(north.teamId,commune.teamId,{now:2});
  assert.equal(contract.type,"pass_through");
  assert.equal(relationships.relationshipBetweenTeams(game,north.teamId,commune.teamId,{now:2}),"deconflicting");
});

test("compatible work and visible distress create separate shared-security and casualty-aid contracts",()=>{
  const north=actor("north","north_team","northline",0,0,{operationId:"north_op",currentAction:"Performing technical work"});
  const commune=actor("commune","commune_team","commune",120,0,{operationId:"commune_op",currentAction:"Assisting technical work"});
  const operations=new Map([
    ["north_op",{id:"north_op",kind:"service_infrastructure",objectiveId:"relay",objectiveLabel:"Central Relay"}],
    ["commune_op",{id:"commune_op",kind:"service_infrastructure",objectiveId:"relay",objectiveLabel:"Central Relay"}]
  ]);
  const objective={id:"relay",name:"Central Relay",x:80,y:0};
  const game={actors:[north,commune],objectives:[objective],livingSandbox:{getOperation:id=>operations.get(id)??null}};
  let reports=new Map([[north.teamId,[report(commune)]]]);
  let {relationships,understanding}=storesFor(game,reports);
  assert.equal(understanding.get(north.teamId,commune.teamId).protocol,"parallel_work_candidate");
  const interactions=new TeamInteractionRuntime();
  interactions.update({game,understanding,relationships,teamMissions:new Map([[north.teamId,{decisionContext:{timePressure:.3}}]]),now:2});
  assert.equal(relationships.getContract(north.teamId,commune.teamId,{now:2}).type,"parallel_work");

  commune.medical={condition:"serious",unconscious:true,dead:false};
  commune.currentAction="Awaiting casualty evacuation";
  reports=new Map([[north.teamId,[report(commune)]]]);
  ({relationships,understanding}=storesFor(game,reports));
  interactions.update({game,understanding,relationships,teamMissions:new Map([[north.teamId,{decisionContext:{timePressure:.25}}]]),now:3});
  assert.equal(understanding.get(north.teamId,commune.teamId).distress.active,true);
  assert.equal(relationships.getContract(north.teamId,commune.teamId,{now:3}).type,"casualty_aid");
});
