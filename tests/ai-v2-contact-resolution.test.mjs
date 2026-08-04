import test from "node:test";
import assert from "node:assert/strict";
import { ContactResolutionService } from "../js/ai-v2/encounters/contact-resolution-service.js";
import { evaluateTeamResponses } from "../js/ai-v2/responses/response-evaluator.js";

function actor(id,teamId,factionId,x,y,vx=0,vy=0){return{id,teamId,factionId,x,y,vx,vy,radius:18,medical:{condition:"healthy"}};}
function mission(teamId){return{id:`mission_${teamId}`,teamId,liveOperation:true,decisionContext:{missionValue:.75,teamPreservation:.8,mobilityOrientation:.8,securityOrientation:.65,exitOptions:.8},responseBias:{},responsePolicy:{}};}
function encounter(spatial,relationship="neutral"){return{subjectId:"actor_b",subjectTeamId:"team_b",state:"relevant",reportId:"report_1",reportConfidence:90,relevanceScore:.9,intent:relationship==="hostile"?"hostile":"unknown",relationship,contactResolution:spatial};}

test("opposing teams on a closing route create an avoidance obligation",()=>{
 const game={actors:[actor("a1","team_a","northline",100,100,1,0),actor("a2","team_a","northline",100,150,1,0),actor("b1","team_b","commune",430,100,-1,0),actor("b2","team_b","commune",430,150,-1,0)]};
 const service=new ContactResolutionService();
 const spatial=service.assess({game,observerTeamId:"team_a",subjectTeamId:"team_b",relationship:"neutral",now:4});
 assert.equal(spatial.materiallyRelevant,true);
 assert.equal(spatial.routeConflict,true);
 const result=evaluateTeamResponses({mission:mission("team_a"),encounter:encounter(spatial)});
 assert.equal(result.selected.id,"avoid_contact");
});

test("shared objective access selects contest while hostile contact selects engagement",()=>{
 const operations={op_a:{objectiveId:"relay"},op_b:{objectiveId:"relay"}};
 const game={actors:[{...actor("a1","team_a","northline",100,100),operationId:"op_a"},{...actor("b1","team_b","commune",520,100),operationId:"op_b"}],livingSandbox:{getOperation:id=>operations[id]}};
 const service=new ContactResolutionService();
 const spatial=service.assess({game,observerTeamId:"team_a",subjectTeamId:"team_b",relationship:"neutral",now:2});
 assert.equal(spatial.objectiveConflict,true);
 assert.equal(evaluateTeamResponses({mission:mission("team_a"),encounter:encounter(spatial)}).selected.id,"contest_access");
 const hostile={...spatial,relationship:"hostile",kind:"engage"};
 assert.equal(evaluateTeamResponses({mission:mission("team_a"),encounter:encounter(hostile,"hostile")}).selected.id,"engage_contact");
});


test("a pass-through contract remains fire-safe but still requires physical separation",()=>{
 const game={actors:[actor("a1","team_a","northline",100,100,1,0),actor("b1","team_b","commune",360,100,-1,0)]};
 const spatial=new ContactResolutionService().assess({game,observerTeamId:"team_a",subjectTeamId:"team_b",relationship:"deconflicting",now:3});
 assert.equal(spatial.materiallyRelevant,true);
 assert.equal(spatial.kind,"avoid");
 const result=evaluateTeamResponses({mission:mission("team_a"),encounter:encounter(spatial,"deconflicting")});
 assert.equal(result.selected.id,"avoid_contact");
});
