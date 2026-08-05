import test from "node:test";
import assert from "node:assert/strict";
import { TeamConcernBoard, TEAM_CONCERN_KINDS } from "../js/ai-v2/decisions/team-concern-board.js";

function stores({condition="critical",encounterState="potentially_incompatible",responseId="warn",operationStatus="interrupted"}={}){
  const actor={id:"casualty",name:"Mina",teamId:"team",x:120,y:40,medical:{condition,unconscious:condition==="unconscious",dead:condition==="dead"}};
  const game={
    actors:[actor,{id:"helper",name:"Jo",teamId:"team",x:0,y:0,medical:{condition:"healthy"}}],
    operations:{teams:[{id:"team",operationStatus}]},
    wounds:{getAssessment(subject){return subject.id==="casualty"&&condition!=="healthy"?{condition,unconscious:condition==="unconscious",dead:condition==="dead",bleeding:condition==="critical"?.2:0,need:{type:"pressure_dressing"}}:{condition:"healthy",bleeding:0};}}
  };
  const mission={id:"mission",teamId:"team",liveOperation:true,operationId:"operation",operationKind:"service_infrastructure",title:"Repair relay",objective:"Repair relay",immediateTask:"Restore relay",abortCondition:"No capable team remains",missionSensitivity:.8,decisionContext:{missionValue:.8,timePressure:.55,teamPreservation:.9},objectivePlan:{objectiveId:"relay",desiredState:"operational"}};
  const encounter={subjectId:"enemy",subjectTeamId:"enemy_team",subjectKind:"external_contact",state:encounterState,relevanceScore:.92,reportConfidence:88,approximatePosition:{x:260,y:40},relationship:"hostile",intent:"hostile",activity:"approaching",reason:"A hostile team is closing on the worksite."};
  return{
    game,
    missions:{summary:()=>[mission]},
    teamEncounters:{getTeamHypotheses:()=>encounterState==="stale"?[]:[encounter]},
    teamResponses:{get:()=>responseId?{subjectId:"enemy",selected:{id:responseId}}:null},
    teamAgenda:{get:()=>({intentId:"restore_objective",source:"mission"})},
    teamProcedures:{get:()=>({procedureId:"challenge_unknown_contact",phase:{id:"issue_warning"}})},
    casualtyKnowledge:{getTeamCasualties:()=>condition==="healthy"?[]:[{id:"report",subjectId:"casualty",observedCondition:condition,confidence:94,approximatePosition:{x:120,y:40}}]},
    threatKnowledge:{summary:()=>[]},
    objectives:{get:()=>({id:"relay",state:"offline",x:400,y:80})},
    encounterOutcomes:{getLatest:()=>null}
  };
}

test("concern board preserves mission, hostile contact, casualty, and safe return as concurrent obligations",()=>{
  const board=new TeamConcernBoard();
  board.update({...stores(),now:1});
  const active=board.getActive("team");
  assert.deepEqual(new Set(active.map(concern=>concern.kind)),new Set([
    TEAM_CONCERN_KINDS.MISSION_PROGRESS,
    TEAM_CONCERN_KINDS.HOSTILE_CONTACT,
    TEAM_CONCERN_KINDS.FRIENDLY_CASUALTY,
    TEAM_CONCERN_KINDS.SAFE_RETURN
  ]));
  assert.equal(active.find(concern=>concern.kind===TEAM_CONCERN_KINDS.FRIENDLY_CASUALTY).importance,1);
  assert.equal(active.find(concern=>concern.kind===TEAM_CONCERN_KINDS.HOSTILE_CONTACT).desiredEffect,"clarify_identity_and_enforce_boundary");
});

test("legacy response replacement cannot erase independent concerns",()=>{
  const board=new TeamConcernBoard();
  board.update({...stores({responseId:"warn"}),now:1});
  const casualtyCreatedAt=board.get("team","casualty:casualty").createdAt;
  const contactCreatedAt=board.get("team","contact:enemy").createdAt;
  board.update({...stores({responseId:"heighten_watch"}),now:2});
  assert.equal(board.get("team","casualty:casualty").createdAt,casualtyCreatedAt);
  assert.equal(board.get("team","contact:enemy").createdAt,contactCreatedAt);
  assert.equal(board.getActive("team").length,4);
});

test("concerns resolve independently while the mission remains active",()=>{
  const board=new TeamConcernBoard({resolvedRetention:10});
  board.update({...stores(),now:1});
  board.update({...stores({condition:"healthy",encounterState:"stale",operationStatus:"deployed",responseId:null}),now:2});
  const active=board.getActive("team");
  assert.deepEqual(active.map(concern=>concern.kind),[TEAM_CONCERN_KINDS.MISSION_PROGRESS]);
  assert.equal(board.get("team","casualty:casualty").status,"resolved");
  assert.equal(board.get("team","contact:enemy").status,"resolved");
  assert.equal(board.get("team","return:mission").status,"resolved");
});
