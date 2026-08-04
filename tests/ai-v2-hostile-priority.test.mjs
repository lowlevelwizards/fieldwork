import test from "node:test";
import assert from "node:assert/strict";
import { TeamEncounterMemory } from "../js/ai-v2/encounters/team-encounter-memory.js";

const mission={
  id:"mission_live",teamId:"team_a",factionId:"a",liveOperation:true,problemKind:"baseline_objective",
  missionSensitivity:1,minimumRelevantConfidence:20,incompatibleConfidence:45,staleAfter:20,forgetAfter:60,
  concernArea:{x:0,y:0,radius:500,falloff:200},interference:{kind:"worksite",reason:"Contact may interfere."}
};

function report(id,subjectId,{confidence=90,activity="stationary",intent="no_clear_intent",classification="unknown_person",reportedAt=1}={}){
  return{id,subjectId,sourceActorId:"observer",reportKind:"initial_contact",confidence,activity,classification,reportedAt,
    approximatePosition:{x:100,y:20},intentHypothesis:{id:intent,label:intent,confidence:.8}};
}

test("physical hostile evidence outranks an older higher-confidence visual contact without merging identity",()=>{
  const memory=new TeamEncounterMemory();
  const reports=[
    report("visual","living_actor_visual",{confidence:94,activity:"approaching",intent:"approaching_area_of_concern"}),
    report("fire","threat_source_unknown",{confidence:79,activity:"firing",intent:"hostile",classification:"armed_contact",reportedAt:2})
  ];
  memory.update({
    game:{actors:[{id:"living_actor_visual"}]},
    missions:{summary:()=>[mission]},
    teamKnowledge:{getTeamContacts:()=>reports},
    now:2.1
  });
  const best=memory.getBestTeamHypothesis("team_a");
  assert.equal(best.subjectId,"threat_source_unknown");
  assert.equal(best.physicalHostileEvidence,true);
  assert.equal(best.intent,"hostile");
  assert.equal(best.identity,"unknown");
  assert.equal(best.factionId,null);
});
