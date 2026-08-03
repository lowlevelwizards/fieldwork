import test from "node:test";
import assert from "node:assert/strict";
import { TeamAgendaState } from "../js/ai-v2/missions/team-agenda-state.js";

const mission={id:"mission",teamId:"team",objectivePlan:{objectiveId:"relay",desiredState:"operational"}};
const missions={summary:()=>[mission]};
const objectives={get:()=>({id:"relay",label:"Relay",state:"offline"})};

test("uncertain contact awareness supports rather than replaces objective work",()=>{
  const agenda=new TeamAgendaState();
  const teamResponses={get:()=>({teamId:"team",missionId:"mission",subjectId:"contact",reportId:"report",encounterState:"relevant",selected:{id:"heighten_watch",label:"Heighten Watch",reason:"uncertain contact",contributions:[]}})};
  agenda.update({missions,teamResponses,objectives,now:2});
  const record=agenda.get("team");
  assert.equal(record.source,"mission");
  assert.equal(record.intentId,"restore_objective");
  assert.equal(record.supporting.intentId,"heighten_watch");
  assert.equal(record.supporting.subjectId,"contact");
});


test("mission resolve can support pressing the operation without replacing objective work",()=>{
  const agenda=new TeamAgendaState();
  const teamResponses={get:()=>({teamId:"team",missionId:"mission",subjectId:"contact",reportId:"report",encounterState:"potentially_incompatible",selected:{id:"press_operation",label:"Press Operation",reason:"warning alone does not outweigh the mission",contributions:[]}})};
  agenda.update({missions,teamResponses,objectives,now:2});
  const record=agenda.get("team");
  assert.equal(record.source,"mission");
  assert.equal(record.intentId,"restore_objective");
  assert.equal(record.supporting.intentId,"press_operation");
  assert.equal(record.supporting.subjectId,"contact");
});

test("a governing encounter response still interrupts objective work",()=>{
  const agenda=new TeamAgendaState();
  const teamResponses={get:()=>({teamId:"team",missionId:"mission",subjectId:"contact",reportId:"report",encounterState:"potentially_incompatible",selected:{id:"break_contact_under_fire",label:"Break Contact Under Fire",reason:"hostile fire",contributions:[]}})};
  agenda.update({missions,teamResponses,objectives,now:2});
  const record=agenda.get("team");
  assert.equal(record.source,"encounter");
  assert.equal(record.intentId,"break_contact_under_fire");
  assert.equal(record.supporting,null);
});
