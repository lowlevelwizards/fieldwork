import { getProcedureDefinitionForResponse, getProcedurePhase } from "./procedure-definitions.js?v=20i-position-requirements-repositioning-20260802";

function capable(actor){
  const medical=actor?.medical;
  return Boolean(actor?.id&&!medical?.dead&&!medical?.unconscious&&medical?.condition!=="critical");
}

function cloneRole(role){return role?{...role,fulfillment:role.fulfillment?{...role.fulfillment}:null}:null;}
function cloneProcedure(record){
  if(!record)return null;
  return{
    ...record,
    phase:{...record.phase},
    phases:record.phases.map(item=>({...item})),
    roles:record.roles.map(cloneRole),
    permissions:{...record.permissions},
    reassessmentTriggers:[...record.reassessmentTriggers]
  };
}

function rankActors(actors,roleSpec){
  return actors.slice().sort((a,b)=>{
    const scoreDifference=(roleSpec.preference?.(b)??0)-(roleSpec.preference?.(a)??0);
    if(scoreDifference)return scoreDifference;
    return String(a.id).localeCompare(String(b.id));
  });
}

function assignRoles(definition,teamActors){
  const available=teamActors.filter(capable);
  const assigned=new Set();
  const roles=[];
  for(const roleSpec of definition.roles){
    const candidates=rankActors(available.filter(actor=>!assigned.has(actor.id)),roleSpec);
    const actor=candidates[0]??null;
    if(actor)assigned.add(actor.id);
    roles.push({
      roleId:roleSpec.id,
      label:roleSpec.label,
      actorId:actor?.id??null,
      actorName:actor?.name??null,
      responsibility:roleSpec.responsibility,
      selectionReason:roleSpec.selectionReason,
      fulfillment:roleSpec.fulfillment?{...roleSpec.fulfillment}:null,
      status:actor?"assigned":"unfilled"
    });
  }
  return roles;
}

function assignmentsValid(record,actorsById){
  const assignedIds=new Set();
  for(const role of record.roles){
    if(!role.actorId)continue;
    if(assignedIds.has(role.actorId))return false;
    assignedIds.add(role.actorId);
    if(!capable(actorsById.get(role.actorId)))return false;
  }
  return true;
}

export class TeamProcedureState{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byTeam=new Map();
  }

  update({game,teamResponses,now=0}={}){
    const responses=teamResponses?.summary?.()??[];
    const liveTeams=new Set(responses.map(response=>response.teamId));
    const actorsById=new Map((game?.actors??[]).map(actor=>[actor.id,actor]));

    for(const response of responses){
      const definition=getProcedureDefinitionForResponse(response.selected?.id);
      const existing=this.byTeam.get(response.teamId)??null;
      if(!definition){
        if(existing)this.#invalidate(existing,now,"selected_response_has_no_procedure");
        continue;
      }

      const teamActors=(game?.actors??[]).filter(actor=>actor.teamId===response.teamId);
      const changed=!existing||existing.responseId!==response.selected.id||existing.procedureId!==definition.id;
      if(changed){
        this.#start({response,definition,teamActors,now});
        continue;
      }

      if(!assignmentsValid(existing,actorsById)){
        const previousRoles=existing.roles.map(cloneRole);
        existing.roles=assignRoles(definition,teamActors);
        existing.phase=this.#phase(definition,"establish_responsibilities",now,"A procedural responsibility became invalid and was deliberately reassigned.");
        existing.lastUpdatedAt=now;
        this.#record("team_procedure_roles_reassigned",existing,now,{previousRoles,roles:existing.roles.map(cloneRole)});
        continue;
      }

      if(existing.phase.id==="establish_responsibilities"&&now-existing.phase.enteredAt>=definition.establishDuration){
        const activePhase=getProcedurePhase(definition,definition.activePhaseId);
        existing.phase=this.#phase(definition,activePhase?.id??definition.activePhaseId,now,activePhase?.reason??"Responsibilities are established.");
        existing.lastUpdatedAt=now;
        this.#record("team_procedure_phase_changed",existing,now,{to:existing.phase.id,reason:existing.phase.reason});
      }else{
        existing.lastUpdatedAt=now;
      }
    }

    for(const [teamId,record] of [...this.byTeam]){
      if(liveTeams.has(teamId))continue;
      this.#invalidate(record,now,"team_response_no_longer_selected");
    }
  }

  get(teamId){return cloneProcedure(this.byTeam.get(teamId)??null);}

  getActorRole(actorId){
    for(const record of this.byTeam.values()){
      const role=record.roles.find(item=>item.actorId===actorId);
      if(role)return{...cloneRole(role),teamId:record.teamId,procedureId:record.procedureId,procedureLabel:record.label,phase:{...record.phase},permissions:{...record.permissions}};
    }
    return null;
  }

  count(){return this.byTeam.size;}

  summary(){return [...this.byTeam.values()].map(cloneProcedure);}

  #start({response,definition,teamActors,now}){
    const roles=assignRoles(definition,teamActors);
    const record={
      teamId:response.teamId,
      missionId:response.missionId,
      responseId:response.selected.id,
      responseLabel:response.selected.label,
      procedureId:definition.id,
      label:definition.label,
      description:definition.description,
      status:"active",
      startedAt:now,
      lastUpdatedAt:now,
      selectionReason:`${response.selected.label} requires ${definition.label} to divide the team's responsibilities without directly controlling actors.`,
      phase:this.#phase(definition,"establish_responsibilities",now,"The team response has been translated into explicit temporary responsibilities."),
      phases:definition.phases.map(item=>({...item})),
      roles,
      permissions:{...definition.permissions},
      reassessmentTriggers:[...definition.reassessmentTriggers]
    };
    this.byTeam.set(response.teamId,record);
    this.#record("team_procedure_started",record,now,{roles:roles.map(cloneRole),responseScore:response.selected.score});
  }

  #phase(definition,phaseId,now,fallbackReason){
    const phase=getProcedurePhase(definition,phaseId);
    return{
      id:phase?.id??phaseId,
      label:phase?.label??String(phaseId).replaceAll("_"," "),
      reason:phase?.reason??fallbackReason,
      enteredAt:now
    };
  }

  #invalidate(record,now,reason){
    this.byTeam.delete(record.teamId);
    this.#record("team_procedure_invalidated",record,now,{reason});
  }

  #record(type,record,now,data={}){
    this.decisionLog?.record?.({
      type,
      time:now,
      teamId:record.teamId,
      data:{
        missionId:record.missionId,
        responseId:record.responseId,
        procedureId:record.procedureId,
        phaseId:record.phase?.id??null,
        ...data
      }
    });
  }
}
