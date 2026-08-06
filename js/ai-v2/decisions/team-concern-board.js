const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const ACTIVE_ENCOUNTER_STATES=new Set(["possible","relevant","potentially_incompatible"]);
const SERIOUS_CONDITIONS=new Set(["wounded","serious","critical","unconscious","dead"]);

export const TEAM_CONCERN_KINDS=Object.freeze({
  MISSION_PROGRESS:"mission_progress",
  HOSTILE_CONTACT:"hostile_contact",
  UNCERTAIN_CONTACT:"uncertain_contact",
  FRIENDLY_CASUALTY:"friendly_casualty",
  SAFE_RETURN:"safe_return"
});

function clonePoint(point){return point?{x:Number(point.x)||0,y:Number(point.y)||0}:null;}
function cloneConcern(concern){
  if(!concern)return null;
  return{
    ...concern,
    point:clonePoint(concern.point),
    evidence:(concern.evidence??[]).map(item=>({...item,point:clonePoint(item.point)})),
    permissions:{...(concern.permissions??{})},
    prohibitions:[...(concern.prohibitions??[])],
    staffing:(concern.staffing??[]).map(item=>({...item,assignedActorIds:[...(item.assignedActorIds??[])],assignedActorNames:[...(item.assignedActorNames??[])]})),
    legacyProjection:{...(concern.legacyProjection??{})},
    history:(concern.history??[]).map(item=>({...item}))
  };
}

function missionDesiredEffect(mission,objectiveComplete){
  if(objectiveComplete)return"preserve_result_and_prepare_return";
  switch(mission.operationKind){
    case"recover_supplies":return"secure_finite_supplies";
    case"survey_route":return"record_and_return_route_intelligence";
    case"establish_forward_position":return"establish_operational_foothold";
    default:return mission.objectivePlan?"complete_field_objective":"sustain_assigned_mission";
  }
}

function missionStaffing(mission){
  if(!mission.objectivePlan)return[{responsibility:"mission_progress",minimum:1,preferred:1,capability:null,status:"unallocated"}];
  return[
    {responsibility:"objective_specialist",minimum:1,preferred:1,capability:"technicalWork",status:"unallocated"},
    {responsibility:"local_security",minimum:1,preferred:2,capability:"security",status:"unallocated"}
  ];
}

function contactKind(hypothesis){
  const hostile=Boolean(
    hypothesis.physicalHostileEvidence||
    hypothesis.intent==="hostile"||
    hypothesis.intentHypothesis?.id==="hostile"||
    hypothesis.activity==="firing"||
    hypothesis.relationship==="hostile"
  );
  return hostile?TEAM_CONCERN_KINDS.HOSTILE_CONTACT:TEAM_CONCERN_KINDS.UNCERTAIN_CONTACT;
}

function contactDesiredEffect(hypothesis,response){
  const responseId=response?.selected?.id??null;
  if(responseId==="break_contact_under_fire"||responseId==="withdraw")return"increase_separation_and_preserve_exit";
  if(responseId==="warn")return"clarify_identity_and_enforce_boundary";
  if(responseId==="reroute"||responseId==="pass_around")return"deconflict_routes";
  if(responseId==="engage_contact"||responseId==="hold_defensively"||responseId==="demonstrative_fire")return"contain_hostile_pressure";
  if(contactKind(hypothesis)===TEAM_CONCERN_KINDS.HOSTILE_CONTACT)return"preserve_standoff_and_survivability";
  return"maintain_awareness_and_resolve_uncertainty";
}

function directCasualtyAssessment(game,actor){
  const woundAssessment=game?.wounds?.getAssessment?.(actor)??null;
  const condition=woundAssessment?.condition??actor?.medical?.condition??"healthy";
  const bleeding=Number(woundAssessment?.bleeding??actor?.medical?.bleeding??0);
  const dead=Boolean(woundAssessment?.dead??actor?.medical?.dead);
  const unconscious=Boolean(woundAssessment?.unconscious??actor?.medical?.unconscious);
  const serious=dead||unconscious||SERIOUS_CONDITIONS.has(condition)||bleeding>.05;
  if(!serious)return null;
  return{
    condition:dead?"dead":unconscious?"unconscious":condition,
    bleeding,
    dead,
    unconscious,
    immediateDanger:dead||unconscious||["serious","critical"].includes(condition)||bleeding>.12,
    treatmentNeed:woundAssessment?.need?{...woundAssessment.need}:null
  };
}

function teamRecord(game,teamId){return(game?.operations?.teams??[]).find(team=>team.id===teamId)??null;}

function changeSignature(concern){
  return JSON.stringify({
    status:concern.status,
    importance:Math.round(concern.importance*100),
    urgency:Math.round(concern.urgency*100),
    confidence:Math.round(concern.confidence*100),
    desiredEffect:concern.desiredEffect,
    legacyProjection:concern.legacyProjection,
    point:concern.point
  });
}

export class TeamConcernBoard{
  constructor({decisionLog=null,resolvedRetention=24}={}){
    this.decisionLog=decisionLog;
    this.resolvedRetention=Math.max(1,Number(resolvedRetention)||24);
    this.byTeam=new Map();
  }

  update({game=null,missions=null,teamEncounters=null,teamResponses=null,teamAgenda=null,teamProcedures=null,casualtyKnowledge=null,threatKnowledge=null,objectives=null,encounterOutcomes=null,now=0}={}){
    const candidates=[];
    const missionList=missions?.summary?.()??[];
    const missionByTeam=new Map(missionList.map(mission=>[mission.teamId,mission]));

    for(const mission of missionList){
      const response=teamResponses?.get?.(mission.teamId)??null;
      const agenda=teamAgenda?.get?.(mission.teamId)??null;
      const procedure=teamProcedures?.get?.(mission.teamId)??null;
      const objective=mission.objectivePlan?.objectiveId?objectives?.get?.(mission.objectivePlan.objectiveId)??null:null;
      const objectiveComplete=Boolean(objective&&objective.state===(mission.objectivePlan?.desiredState??"operational"));
      const outcome=encounterOutcomes?.getLatest?.(mission.teamId)??null;
      const legacyProjection={
        agendaId:agenda?.intentId??null,
        agendaSource:agenda?.source??null,
        responseId:response?.selected?.id??null,
        procedureId:procedure?.procedureId??null,
        phaseId:procedure?.phase?.id??null
      };

      if(!objectiveComplete&&!outcome?.missionResolved){
        candidates.push({
          id:`mission:${mission.id}`,
          teamId:mission.teamId,
          missionId:mission.id,
          kind:TEAM_CONCERN_KINDS.MISSION_PROGRESS,
          subjectId:mission.objectivePlan?.objectiveId??mission.id,
          label:mission.title??"Mission progress",
          desiredEffect:missionDesiredEffect(mission,false),
          importance:clamp(mission.decisionContext?.missionValue??mission.missionSensitivity??.7),
          urgency:clamp(mission.decisionContext?.timePressure??.35),
          confidence:1,
          point:objective?{x:objective.x,y:objective.y}:mission.concernArea?{x:mission.concernArea.x,y:mission.concernArea.y}:null,
          evidence:[{type:"authored_mission",sourceId:mission.id,summary:mission.immediateTask??mission.objective,point:objective?{x:objective.x,y:objective.y}:null}],
          permissions:{continueMission:true,allocateResponsibilities:true},
          prohibitions:[mission.abortCondition?`avoid violating abort condition: ${mission.abortCondition}`:"avoid abandoning the mission without evidence"],
          staffing:missionStaffing(mission),
          legacyProjection,
          sourceKinds:["mission","objective","legacy_projection"]
        });
      }

      const team=teamRecord(game,mission.teamId);
      const operationReturning=["returning","interrupted"].includes(team?.operationStatus);
      const returnProcedure=["protective_breakaway","casualty_evacuation"].includes(procedure?.procedureId);
      if(mission.liveOperation&&(objectiveComplete||operationReturning||returnProcedure||outcome?.followUp==="safe_return")){
        candidates.push({
          id:`return:${mission.id}`,
          teamId:mission.teamId,
          missionId:mission.id,
          kind:TEAM_CONCERN_KINDS.SAFE_RETURN,
          subjectId:mission.operationId??mission.id,
          label:"Preserve a safe return",
          desiredEffect:returnProcedure?"complete_protected_return":"return_capable_operators_and_cargo",
          importance:clamp(Math.max(.55,mission.decisionContext?.teamPreservation??.75)),
          urgency:clamp((operationReturning||returnProcedure) ? 0.5 : 0.25),
          confidence:1,
          point:mission.withdrawalPlan?.exitPoint??mission.evacuationPlan?.routeOptions?.[0]?.waypoints?.at?.(-1)??null,
          evidence:[
            {type:objectiveComplete?"objective_complete":"operation_state",sourceId:mission.operationId??mission.id,summary:objectiveComplete?"The objective reached its desired state.":`Operation status is ${team?.operationStatus??procedure?.phase?.id??"return-relevant"}.`}
          ],
          permissions:{withdraw:true,preserveCargo:true,continueCare:true},
          prohibitions:["do not treat return as complete until capable actors physically leave the field"],
          staffing:[{responsibility:"route_security",minimum:1,preferred:1,capability:"security",status:"unallocated"}],
          legacyProjection,
          sourceKinds:["mission","operation","legacy_projection"]
        });
      }

      for(const hypothesis of teamEncounters?.getTeamHypotheses?.(mission.teamId)??[]){
        if(hypothesis.subjectKind==="friendly_casualty"||!ACTIVE_ENCOUNTER_STATES.has(hypothesis.state))continue;
        const kind=contactKind(hypothesis);
        const importance=clamp(Math.max(hypothesis.relevanceScore??0,kind===TEAM_CONCERN_KINDS.HOSTILE_CONTACT?.88:.32));
        candidates.push({
          id:`contact:${hypothesis.subjectId}`,
          teamId:mission.teamId,
          missionId:mission.id,
          kind,
          subjectId:hypothesis.subjectId,
          subjectTeamId:hypothesis.subjectTeamId??null,
          label:kind===TEAM_CONCERN_KINDS.HOSTILE_CONTACT?"Hostile contact":"Unresolved nearby team",
          desiredEffect:contactDesiredEffect(hypothesis,response?.subjectId===hypothesis.subjectId?response:null),
          importance,
          urgency:clamp(kind===TEAM_CONCERN_KINDS.HOSTILE_CONTACT?Math.max(.72,importance):importance*.62),
          confidence:clamp((hypothesis.reportConfidence??0)/100),
          point:clonePoint(hypothesis.approximatePosition),
          evidence:[{
            type:hypothesis.physicalHostileEvidence?"physical_hostile_evidence":"team_encounter_hypothesis",
            sourceId:hypothesis.reportId??hypothesis.subjectId,
            summary:hypothesis.reason,
            point:clonePoint(hypothesis.approximatePosition)
          }],
          permissions:{observe:true,report:true,avoid:true,fire:kind===TEAM_CONCERN_KINDS.HOSTILE_CONTACT},
          prohibitions:[kind===TEAM_CONCERN_KINDS.HOSTILE_CONTACT?"do not continue an unchanged collision course":"do not infer hostility without evidence"],
          staffing:[{responsibility:"contact_security",minimum:1,preferred:2,capability:"security",status:"unallocated"}],
          legacyProjection,
          sourceKinds:["encounter","knowledge","legacy_projection"]
        });
      }
    }

    // Friendly casualties are projected directly from physical state as well as
    // communicated knowledge. The board is descriptive, so this does not assign
    // a carrier or start care; it prevents a casualty obligation from disappearing
    // merely because another encounter currently wins the legacy response slot.
    for(const actor of game?.actors??[]){
      const assessment=directCasualtyAssessment(game,actor);
      if(!assessment||!actor.teamId)continue;
      const mission=missionByTeam.get(actor.teamId)??null;
      const response=teamResponses?.get?.(actor.teamId)??null;
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const procedure=teamProcedures?.get?.(actor.teamId)??null;
      const report=casualtyKnowledge?.getTeamCasualties?.(actor.teamId)?.find(item=>item.subjectId===actor.id)??null;
      candidates.push({
        id:`casualty:${actor.id}`,
        teamId:actor.teamId,
        missionId:mission?.id??null,
        kind:TEAM_CONCERN_KINDS.FRIENDLY_CASUALTY,
        subjectId:actor.id,
        label:`Recover ${actor.name??"wounded teammate"}`,
        desiredEffect:assessment.dead?"recover_remains_without_compounding_losses":"preserve_life_and_move_to_protection",
        importance:assessment.dead?.72:assessment.immediateDanger?1:.78,
        urgency:assessment.dead?.35:assessment.immediateDanger?1:.68,
        confidence:report?clamp((report.confidence??90)/100):1,
        point:{x:actor.x,y:actor.y},
        evidence:[
          {type:"physical_actor_state",sourceId:actor.id,summary:`${actor.name??actor.id} is ${assessment.condition}.`,point:{x:actor.x,y:actor.y}},
          ...(report?[{type:"shared_casualty_report",sourceId:report.id,summary:`Shared casualty report: ${report.observedCondition}.`,point:clonePoint(report.approximatePosition)}]:[])
        ],
        permissions:{approach:true,treat:!assessment.dead,transport:true,provideSecurity:true},
        prohibitions:[assessment.immediateDanger?"do not ignore the casualty while capable teammates remain":"avoid exposed care when a safer treatment window is available"],
        staffing:[
          {responsibility:"carrier_or_aid_provider",minimum:1,preferred:1,capability:assessment.dead?"patientTransport":"casualtyCare",status:"unallocated"},
          {responsibility:"casualty_security",minimum:0,preferred:1,capability:"security",status:"unallocated"}
        ],
        legacyProjection:{
          agendaId:agenda?.intentId??null,
          agendaSource:agenda?.source??null,
          responseId:response?.selected?.id??null,
          procedureId:procedure?.procedureId??null,
          phaseId:procedure?.phase?.id??null
        },
        sourceKinds:["physical_state",report?"casualty_knowledge":null,"legacy_projection"].filter(Boolean)
      });
    }

    // Personal incoming-fire evidence is aggregated as a team concern before it
    // necessarily becomes the best shared encounter hypothesis.
    const threatsByTeam=new Map();
    for(const entry of threatKnowledge?.summary?.()??[]){
      const observer=(game?.actors??[]).find(actor=>actor.id===entry.actorId)??null;
      if(!observer?.teamId)continue;
      for(const threat of entry.threats??[]){
        const key=`${observer.teamId}:${threat.subjectId}`;
        const existing=threatsByTeam.get(key);
        if(!existing||threat.confidence>existing.threat.confidence)threatsByTeam.set(key,{teamId:observer.teamId,threat,observer});
      }
    }
    for(const {teamId,threat,observer} of threatsByTeam.values()){
      if(candidates.some(candidate=>candidate.teamId===teamId&&candidate.kind===TEAM_CONCERN_KINDS.HOSTILE_CONTACT&&candidate.subjectId===threat.subjectId))continue;
      const mission=missionByTeam.get(teamId)??null;
      candidates.push({
        id:`contact:${threat.subjectId}`,
        teamId,
        missionId:mission?.id??null,
        kind:TEAM_CONCERN_KINDS.HOSTILE_CONTACT,
        subjectId:threat.subjectId,
        label:"Immediate hostile pressure",
        desiredEffect:"survive_and_establish_team_awareness",
        importance:clamp(Math.max(.9,(threat.confidence??0)/100)),
        urgency:1,
        confidence:clamp((threat.confidence??0)/100),
        point:clonePoint(threat.approximatePosition),
        evidence:[{type:"personal_incoming_fire",sourceId:threat.eventId??threat.id,summary:`${observer.name??observer.id} perceived ${threat.eventKind??"incoming fire"}.`,point:clonePoint(threat.approximatePosition)}],
        permissions:{survivalMovement:true,observe:true,report:true,returnFire:true},
        prohibitions:["do not preserve ordinary travel as though no hostile event occurred"],
        staffing:[{responsibility:"immediate_security",minimum:1,preferred:2,capability:"security",status:"unallocated"}],
        legacyProjection:{},
        sourceKinds:["personal_threat","physical_state"]
      });
    }

    this.#reconcile(candidates,now);
  }


  setStaffingAssignments(teamId,assignments=[],{now=0}={}){
    const records=this.byTeam.get(teamId);
    if(!records)return false;
    let changed=false;
    for(const concern of records.values()){
      if(concern.status!=="active")continue;
      const concernAssignments=assignments.filter(item=>item.concernId===concern.id);
      concern.staffing=(concern.staffing??[]).map(requirement=>{
        const matches=concernAssignments.filter(item=>item.responsibility===requirement.responsibility);
        const minimum=Math.max(0,Number(requirement.minimum)||0);
        const preferred=Math.max(minimum,Number(requirement.preferred)||0);
        const status=matches.length>=preferred?"preferred_met":matches.length>=minimum?"minimum_met":"understaffed";
        return{...requirement,status,filled:matches.length,assignedActorIds:matches.map(item=>item.actorId),assignedActorNames:matches.map(item=>item.actorName)};
      });
      concern.staffingUpdatedAt=now;
      concern.staffedActorIds=[...new Set(concernAssignments.map(item=>item.actorId))];
      changed=true;
    }
    return changed;
  }

  get(teamId,concernId){return cloneConcern(this.byTeam.get(teamId)?.get(concernId)??null);}
  getActive(teamId){return[...(this.byTeam.get(teamId)?.values()??[])].filter(item=>item.status==="active").sort((a,b)=>b.importance-a.importance||b.urgency-a.urgency).map(cloneConcern);}
  getAll(teamId){return[...(this.byTeam.get(teamId)?.values()??[])].sort((a,b)=>(a.status===b.status?0:a.status==="active"?-1:1)||b.importance-a.importance).map(cloneConcern);}
  count({activeOnly=true}={}){let total=0;for(const records of this.byTeam.values())for(const concern of records.values())if(!activeOnly||concern.status==="active")total+=1;return total;}
  summary(){return[...this.byTeam.entries()].map(([teamId,records])=>({teamId,concerns:[...records.values()].sort((a,b)=>(a.status===b.status?0:a.status==="active"?-1:1)||b.importance-a.importance).map(cloneConcern)}));}

  #reconcile(candidates,now){
    const seen=new Set();
    for(const candidate of candidates){
      if(!candidate?.teamId||!candidate.id)continue;
      if(!this.byTeam.has(candidate.teamId))this.byTeam.set(candidate.teamId,new Map());
      const records=this.byTeam.get(candidate.teamId);
      const key=`${candidate.teamId}:${candidate.id}`;
      seen.add(key);
      const existing=records.get(candidate.id)??null;
      const next={
        ...candidate,
        status:"active",
        createdAt:existing?.createdAt??now,
        activatedAt:existing?.status==="active"?existing.activatedAt??existing.createdAt:now,
        lastUpdatedAt:now,
        lastEvidenceAt:now,
        resolvedAt:null,
        history:existing?.history??[]
      };
      const changed=!existing||changeSignature(existing)!==changeSignature(next)||existing.status!=="active";
      if(changed){
        next.history=[...(existing?.history??[]),{at:now,event:existing?"updated":"created",importance:next.importance,desiredEffect:next.desiredEffect}].slice(-12);
        this.#record(existing?"team_concern_updated":"team_concern_created",next,now,{previousStatus:existing?.status??null});
      }
      records.set(candidate.id,next);
    }

    for(const [teamId,records] of [...this.byTeam]){
      for(const [id,concern] of [...records]){
        if(seen.has(`${teamId}:${id}`))continue;
        if(concern.status==="active"){
          concern.status="resolved";
          concern.resolvedAt=now;
          concern.lastUpdatedAt=now;
          concern.history=[...(concern.history??[]),{at:now,event:"resolved",importance:concern.importance,desiredEffect:concern.desiredEffect}].slice(-12);
          this.#record("team_concern_resolved",concern,now,{});
        }else if(now-(concern.resolvedAt??now)>=this.resolvedRetention)records.delete(id);
      }
      if(!records.size)this.byTeam.delete(teamId);
    }
  }

  #record(type,concern,now,data={}){
    this.decisionLog?.record?.({
      type,time:now,teamId:concern.teamId,
      data:{
        concernId:concern.id,kind:concern.kind,subjectId:concern.subjectId??null,
        desiredEffect:concern.desiredEffect,importance:Math.round(concern.importance*100),
        urgency:Math.round(concern.urgency*100),status:concern.status,...data
      }
    });
  }
}
