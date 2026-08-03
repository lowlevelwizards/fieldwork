const SUPPORTING_RESPONSE_IDS=new Set(["continue_observation","heighten_watch","wait"]);

function cloneSelected(selected){return selected?{...selected,contributions:(selected.contributions??[]).map(item=>({...item}))}:null;}
function cloneSupporting(supporting){return supporting?{...supporting,selected:cloneSelected(supporting.selected)}:null;}
function cloneRecord(record){return record?{...record,selected:cloneSelected(record.selected),candidates:(record.candidates??[]).map(cloneSelected),supporting:cloneSupporting(record.supporting)}:null;}

function missionAgenda({mission,objective,encounterResponse,now}){
  const complete=objective.state===(mission.objectivePlan.desiredState??"operational");
  const selected={
    id:"restore_objective",
    label:complete?"Hold Restored Objective":"Restore Objective",
    summary:complete?"Maintain a stable worksite around the completed objective.":"Organize an approach, inspect the objective, and complete the required field work.",
    score:1,
    reason:complete
      ?`${objective.label} is operational; retain a coherent worksite posture while the mission remains assigned.`
      :`${objective.label} remains ${objective.state}; the team has an unresolved mission obligation.`,
    contributions:[]
  };
  const supporting=encounterResponse&&SUPPORTING_RESPONSE_IDS.has(encounterResponse.selected?.id)?{
    intentId:encounterResponse.selected.id,
    subjectId:encounterResponse.subjectId,
    reportId:encounterResponse.reportId,
    encounterState:encounterResponse.encounterState,
    selected:cloneSelected(encounterResponse.selected),
    reason:encounterResponse.selected.reason
  }:null;
  return{
    teamId:mission.teamId,
    missionId:mission.id,
    subjectId:objective.id,
    reportId:null,
    encounterState:null,
    selected,
    candidates:[selected],
    ledger:{},
    source:"mission",
    intentId:selected.id,
    objectiveId:objective.id,
    objectiveState:objective.state,
    objectiveComplete:complete,
    supporting,
    selectedAt:now,
    lastEvaluatedAt:now,
    selectionReason:complete?"objective_completed_hold":"unresolved_objective_mission",
    heldReason:null,
    status:"selected"
  };
}

export class TeamAgendaState{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byTeam=new Map();
  }

  update({missions,teamResponses,objectives,now=0}={}){
    const seen=new Set();
    for(const mission of missions?.summary?.()??[]){
      seen.add(mission.teamId);
      const encounterResponse=teamResponses?.get?.(mission.teamId)??null;
      const objectiveId=mission.objectivePlan?.objectiveId??null;
      const objective=objectiveId?objectives?.get?.(objectiveId):null;
      const supporting=Boolean(encounterResponse&&SUPPORTING_RESPONSE_IDS.has(encounterResponse.selected?.id));
      let next=null;

      if(encounterResponse&&!supporting){
        next={
          ...encounterResponse,
          source:"encounter",
          intentId:encounterResponse.selected?.id??null,
          objectiveId,
          objectiveState:objective?.state??null,
          supporting:null
        };
      }else if(objective&&mission.objectivePlan){
        next=missionAgenda({mission,objective,encounterResponse,now});
      }

      const existing=this.byTeam.get(mission.teamId)??null;
      if(!next){
        if(existing)this.#invalidate(existing,now,"no_current_team_agenda");
        continue;
      }
      const unchanged=existing&&existing.source===next.source&&existing.intentId===next.intentId&&existing.subjectId===next.subjectId;
      const priorSupporting=`${existing?.supporting?.intentId??""}:${existing?.supporting?.subjectId??""}`;
      const nextSupporting=`${next.supporting?.intentId??""}:${next.supporting?.subjectId??""}`;
      if(unchanged){
        next.selectedAt=existing.selectedAt;
        next.selectionReason=existing.selectionReason;
        next.heldReason=next.source==="encounter"
          ?"encounter response still governs the team"
          :next.supporting
            ?`baseline mission remains governing while ${next.supporting.selected?.label??"contact awareness"} supports local security`
            :"baseline mission remains unresolved or assigned";
      }
      this.byTeam.set(mission.teamId,next);
      if(!unchanged)this.#record(existing?"team_agenda_changed":"team_agenda_selected",next,now,{from:existing?.intentId??null,to:next.intentId,source:next.source});
      else if(priorSupporting!==nextSupporting)this.#record("team_agenda_supporting_changed",next,now,{supportingIntentId:next.supporting?.intentId??null,supportingSubjectId:next.supporting?.subjectId??null});
    }

    for(const [teamId,record] of [...this.byTeam])if(!seen.has(teamId))this.#invalidate(record,now,"mission_no_longer_available");
  }

  get(teamId){return cloneRecord(this.byTeam.get(teamId)??null);}
  count(){return this.byTeam.size;}
  summary(){return[...this.byTeam.values()].map(cloneRecord);}

  #invalidate(record,now,reason){
    this.byTeam.delete(record.teamId);
    this.#record("team_agenda_invalidated",record,now,{reason});
  }
  #record(type,record,now,data={}){
    this.decisionLog?.record?.({type,time:now,teamId:record.teamId,data:{missionId:record.missionId,intentId:record.intentId,source:record.source,subjectId:record.subjectId,...data}});
  }
}
