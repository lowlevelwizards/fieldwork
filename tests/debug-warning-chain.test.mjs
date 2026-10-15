import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

// Temporary focused trace: removed once the recipient warning-response bridge is repaired.
test("diagnose recipient warning response bridge",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"observation"});
  const communeTeam=game.actors.find(actor=>actor.factionId==="commune")?.teamId;
  const snapshots=[];
  for(let step=0;step<260;step+=1){
    game.update(.05,{x:0,y:0});
    if(step%10!==0)continue;
    const heard=game.aiV2.heardCommunications.getLatestForTeam(communeTeam);
    const reports=game.aiV2.teamKnowledge.getTeamContacts(communeTeam);
    const encounters=game.aiV2.teamEncounters.getTeamHypotheses(communeTeam);
    const response=game.aiV2.teamResponses.get(communeTeam);
    const procedure=game.aiV2.teamProcedures.get(communeTeam);
    snapshots.push({
      t:Number(game.aiV2.elapsed.toFixed(2)),
      heard:heard?{id:heard.id,heardAt:heard.heardAt,sourceActorId:heard.sourceActorId,approximateSourcePosition:heard.approximateSourcePosition}:null,
      reports:reports.map(r=>({id:r.id,kind:r.reportKind,subjectId:r.subjectId,subjectTeamId:r.subjectTeamId,activity:r.activity,confidence:r.confidence,reportedAt:r.reportedAt,position:r.approximatePosition})),
      encounters:encounters.map(e=>({subjectId:e.subjectId,subjectTeamId:e.subjectTeamId,state:e.state,kind:e.reportKind,activity:e.activity,warningHeard:e.warningHeard,reportId:e.reportId,confidence:e.reportConfidence,position:e.approximatePosition})),
      response:response?{subjectId:response.subjectId,id:response.selected?.id,score:response.selected?.score,warningHeard:response.ledger?.warningHeard,withdrawalPlanAvailable:response.ledger?.withdrawalPlanAvailable,encounterState:response.encounterState}:null,
      procedure:procedure?{subjectId:procedure.subjectId,id:procedure.procedureId,phase:procedure.phase?.id,status:procedure.status}:null,
      actions:game.actors.filter(a=>a.teamId===communeTeam).flatMap(a=>(game.aiV2.scheduler.getActions(a.id)??[]).map(x=>({actorId:a.id,type:x.type,state:x.state,endReason:x.endReason??null})))
    });
  }
  const events=game.aiV2.decisionLog.entries.filter(e=>e.teamId===communeTeam&&[
    "directed_warning_heard","contact_report_delivered","contact_update_delivered","team_encounter_hypothesis_created","team_encounter_state_changed","team_response_selected","team_response_changed","team_response_invalidated","procedure_started","procedure_transition","action_started","action_completed","action_rejected"
  ].includes(e.type));
  console.log("RECIPIENT_WARNING_SNAPSHOTS",JSON.stringify(snapshots));
  console.log("RECIPIENT_WARNING_EVENTS",JSON.stringify(events.slice(0,400)));
  assert.ok(true);
});
