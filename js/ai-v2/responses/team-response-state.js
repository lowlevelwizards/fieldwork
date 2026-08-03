import { evaluateTeamResponses } from "./response-evaluator.js";

const ACTIVE_ENCOUNTER_STATES=new Set(["relevant","potentially_incompatible"]);

function cloneCandidate(candidate){
  return candidate?{
    ...candidate,
    contributions:candidate.contributions.map(item=>({...item}))
  }:null;
}

function cloneRecord(record){
  if(!record)return null;
  return{
    ...record,
    ledger:{...record.ledger,responseBias:{...(record.ledger?.responseBias??{})}},
    selected:cloneCandidate(record.selected),
    candidates:record.candidates.map(cloneCandidate)
  };
}

export class TeamResponseState{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byTeam=new Map();
  }

  update({missions,teamEncounters,encounterOutcomes=null,now=0}={}){
    const seenTeams=new Set();
    for(const mission of missions?.summary?.()??[]){
      seenTeams.add(mission.teamId);
      const encounter=teamEncounters?.getBestTeamHypothesis?.(mission.teamId)??null;
      const existing=this.byTeam.get(mission.teamId)??null;
      const outcome=encounterOutcomes?.getLatest?.(mission.teamId)??null;
      const missionResolved=outcome?.missionResolved??outcome?.resolved??false;
      if(missionResolved){
        const terminalHold=Math.max(0,4-Math.max(0,now-(outcome.createdAt??now)));
        if(existing&&terminalHold>0){
          existing.lastEvaluatedAt=now;
          existing.heldReason=`encounter outcome is resolved; holding the terminal posture for ${terminalHold.toFixed(1)}s`;
          continue;
        }
        if(existing)this.#invalidate(existing,now,"encounter_outcome_resolved");
        continue;
      }
      if(!encounter||!ACTIVE_ENCOUNTER_STATES.has(encounter.state)){
        if(existing)this.#invalidate(existing,now,encounter?`encounter_${encounter.state}`:"no_current_encounter");
        continue;
      }

      const minimumHold=Math.max(0,mission.responsePolicy?.minimumHold??6);
      const reassessEvery=Math.max(.5,mission.responsePolicy?.reassessEvery??3);
      const switchMargin=Math.max(0,mission.responsePolicy?.switchMargin??.08);
      const evidenceChanged=existing&&(
        existing.subjectId!==encounter.subjectId||
        existing.reportId!==encounter.reportId||
        existing.encounterState!==encounter.state
      );
      const due=!existing||evidenceChanged||now-existing.lastEvaluatedAt>=reassessEvery;
      if(!due)continue;

      const evaluation=evaluateTeamResponses({mission,encounter});
      if(!evaluation?.selected){
        if(existing)this.#invalidate(existing,now,"no_eligible_response");
        continue;
      }

      if(!existing){
        this.#select(evaluation,mission,encounter,now,"initial_team_response");
        continue;
      }

      const currentCandidate=evaluation.candidates.find(candidate=>candidate.id===existing.selected.id)??null;
      const elapsed=now-existing.selectedAt;
      const challenger=evaluation.selected;
      const canSwitch=evidenceChanged||elapsed>=minimumHold;
      const margin=currentCandidate?challenger.score-currentCandidate.score:1;
      if(challenger.id!==existing.selected.id&&canSwitch&&margin>=switchMargin){
        this.#select(evaluation,mission,encounter,now,"better_response_after_reassessment",existing);
        continue;
      }

      existing.ledger=evaluation.ledger;
      existing.candidates=evaluation.candidates;
      existing.selected=currentCandidate??existing.selected;
      existing.lastEvaluatedAt=now;
      existing.encounterState=encounter.state;
      existing.reportId=encounter.reportId;
      existing.heldReason=challenger.id===existing.selected.id
        ?"selected response remains the strongest option"
        :`challenger advantage ${Math.round(Math.max(0,margin)*100)} is below the switch requirement`;
      this.#record("team_response_reaffirmed",existing,now,{heldReason:existing.heldReason});
    }

    for(const [teamId,record] of [...this.byTeam]){
      if(seenTeams.has(teamId))continue;
      this.#invalidate(record,now,"mission_no_longer_available");
    }
  }

  get(teamId){
    return cloneRecord(this.byTeam.get(teamId)??null);
  }

  count(){return this.byTeam.size;}

  summary(){
    return [...this.byTeam.values()].map(cloneRecord);
  }

  #select(evaluation,mission,encounter,now,reason,previous=null){
    const record={
      teamId:mission.teamId,
      missionId:mission.id,
      subjectId:encounter.subjectId,
      reportId:encounter.reportId,
      encounterState:encounter.state,
      selected:evaluation.selected,
      candidates:evaluation.candidates,
      ledger:evaluation.ledger,
      selectedAt:previous?.selectedAt&&previous.selected.id===evaluation.selected.id?previous.selectedAt:now,
      lastEvaluatedAt:now,
      selectionReason:reason,
      heldReason:null,
      procedure:null,
      status:"selected"
    };
    this.byTeam.set(mission.teamId,record);
    this.#record(previous?"team_response_changed":"team_response_selected",record,now,{
      from:previous?.selected?.id??null,
      to:record.selected.id,
      reason
    });
  }

  #invalidate(record,now,reason){
    this.byTeam.delete(record.teamId);
    this.#record("team_response_invalidated",record,now,{reason});
  }

  #record(type,record,now,data={}){
    this.decisionLog?.record?.({
      type,
      time:now,
      teamId:record.teamId,
      data:{
        missionId:record.missionId,
        subjectId:record.subjectId,
        responseId:record.selected?.id??null,
        responseScore:Math.round((record.selected?.score??0)*100),
        explanation:record.selected?.reason??null,
        ...data
      }
    });
  }
}
