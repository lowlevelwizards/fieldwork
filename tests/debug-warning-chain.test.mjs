import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

// Temporary focused trace: removed once the recipient warning-response bridge is repaired.
test("diagnose recipient warning response bridge",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"observation"});
  const snapshots=[];
  for(let step=0;step<260;step+=1){
    game.update(.05,{x:0,y:0});
    if(step%10!==0)continue;
    const communications=game.aiV2.heardCommunications.summary();
    const incoming=communications.incoming?.[0]??null;
    const recipientTeamId=incoming?.teamId??null;
    const heard=recipientTeamId?game.aiV2.heardCommunications.getLatestForTeam(recipientTeamId):null;
    const reports=recipientTeamId?game.aiV2.teamKnowledge.getTeamContacts(recipientTeamId):[];
    const encounters=recipientTeamId?game.aiV2.teamEncounters.getTeamHypotheses(recipientTeamId):[];
    const response=recipientTeamId?game.aiV2.teamResponses.get(recipientTeamId):null;
    const procedure=recipientTeamId?game.aiV2.teamProcedures.get(recipientTeamId):null;
    snapshots.push({
      t:Number(game.aiV2.elapsed.toFixed(2)),
      actors:game.actors.map(actor=>({id:actor.id,teamId:actor.teamId,factionId:actor.factionId,faction:actor.faction})),
      incoming:communications.incoming?.map(entry=>({teamId:entry.teamId,warningId:entry.warning?.id,sourceTeamId:entry.warning?.sourceTeamId,recipientIds:entry.warning?.recipientIds}))??[],
      heard:heard?{id:heard.id,heardAt:heard.heardAt,sourceActorId:heard.sourceActorId,sourceTeamId:heard.sourceTeamId,approximateSourcePosition:heard.approximateSourcePosition}:null,
      reports:reports.map(r=>({id:r.id,kind:r.reportKind,subjectId:r.subjectId,subjectTeamId:r.subjectTeamId,activity:r.activity,confidence:r.confidence,reportedAt:r.reportedAt,position:r.approximatePosition})),
      encounters:encounters.map(e=>({subjectId:e.subjectId,subjectTeamId:e.subjectTeamId,state:e.state,kind:e.reportKind,activity:e.activity,warningHeard:e.warningHeard,reportId:e.reportId,confidence:e.reportConfidence,position:e.approximatePosition})),
      response:response?{subjectId:response.subjectId,id:response.selected?.id,score:response.selected?.score,warningHeard:response.ledger?.warningHeard,withdrawalPlanAvailable:response.ledger?.withdrawalPlanAvailable,encounterState:response.encounterState}:null,
      procedure:procedure?{subjectId:procedure.subjectId,id:procedure.procedureId,phase:procedure.phase?.id,status:procedure.status}:null,
      actions:recipientTeamId?game.actors.filter(a=>a.teamId===recipientTeamId).flatMap(a=>(game.aiV2.scheduler.getActions(a.id)??[]).map(x=>({actorId:a.id,type:x.type,state:x.state,endReason:x.endReason??null}))):[]
    });
  }
  console.log("RECIPIENT_WARNING_SNAPSHOTS",JSON.stringify(snapshots));
  assert.ok(true);
});
