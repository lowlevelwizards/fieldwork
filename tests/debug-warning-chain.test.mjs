import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

// Temporary focused trace: removed once the broken warning-chain link is repaired.
test("diagnose boundary warning chain",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"observation"});
  const snapshots=[];
  for(let step=0;step<360;step+=1){
    game.update(.05,{x:0,y:0});
    if(step%20!==0)continue;
    snapshots.push({
      t:Number(game.aiV2.elapsed.toFixed(2)),
      reports:game.aiV2.teamKnowledge.summary().map(team=>({teamId:team.teamId,reports:team.reports?.map(r=>({kind:r.reportKind,subjectId:r.subjectId,activity:r.activity,confidence:r.confidence,reportedAt:r.reportedAt}))})),
      encounters:game.aiV2.teamEncounters.summary().map(e=>({teamId:e.teamId,subjectId:e.subjectId,state:e.state,kind:e.reportKind,activity:e.activity,confidence:e.reportConfidence,position:e.approximatePosition,warningIssued:e.warningIssued,response:e.response})),
      responses:game.aiV2.teamResponses.summary().map(r=>({teamId:r.teamId,selected:r.selected?.id,score:r.selected?.score,ledger:r.ledger?{boundaryTrigger:r.ledger.boundaryTrigger,boundaryInside:r.ledger.boundaryInside,activityEvidence:r.ledger.activityEvidence,informationCertainty:r.ledger.informationCertainty,warningIssued:r.ledger.warningIssued}:null})),
      procedures:game.aiV2.teamProcedures.summary().map(p=>({teamId:p.teamId,id:p.procedureId,phase:p.phase?.id,status:p.status})),
      actions:game.actors.flatMap(a=>(game.aiV2.scheduler.getActions(a.id)??[]).map(x=>({actorId:a.id,type:x.type,state:x.state})))
    });
  }
  const interesting=game.aiV2.decisionLog.entries.filter(e=>["contact_report_delivered","contact_update_delivered","team_response_selected","team_response_changed","procedure_started","procedure_transition","directed_warning_delivered","action_started","action_completed","action_rejected"].includes(e.type));
  console.log("WARNING_SNAPSHOTS",JSON.stringify(snapshots));
  console.log("WARNING_EVENTS",JSON.stringify(interesting.slice(0,500)));
  assert.ok(true);
});
