const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

const CAPABILITY_ALIASES=Object.freeze({
  technicalWork:["technicalWork","repair","engineering"],
  carrying:["carrying","patientTransport","transportStamina"],
  security:["security","observation","fireControl"],
  casualtyCare:["casualtyCare","medicalCare","medical"],
  patientTransport:["patientTransport","transportStamina","carrying"],
  observation:["observation","scouting","security"],
  navigation:["navigation","scouting"]
});

const RESPONSIBILITY_CAPABILITIES=Object.freeze({
  objective_specialist:"technicalWork",
  mission_progress:"navigation",
  local_security:"security",
  contact_security:"security",
  immediate_security:"security",
  casualty_security:"security",
  route_security:"security",
  carrier_or_aid_provider:"casualtyCare"
});

function capable(actor){
  return Boolean(actor?.id&&!actor.medical?.dead&&!actor.medical?.unconscious&&actor.medical?.condition!=="critical");
}

function capabilityValue(actor,capability){
  if(!capability)return .5;
  const capabilities=actor?.aiV2Capabilities??{};
  const aliases=CAPABILITY_ALIASES[capability]??[capability];
  let best=0;
  for(const key of aliases)best=Math.max(best,Number(capabilities[key])||0);
  if(capability==="casualtyCare"&&best<=0)best=Math.max(Number(capabilities.patientTransport)||0,Number(capabilities.carrying)||0)*.62;
  return clamp(best);
}

function normalizedRequirement(requirement={}){
  return{
    responsibility:requirement.responsibility??"general_support",
    capability:requirement.capability??RESPONSIBILITY_CAPABILITIES[requirement.responsibility]??null,
    minimum:Math.max(0,Math.floor(Number(requirement.minimum)||0)),
    preferred:Math.max(Math.max(0,Math.floor(Number(requirement.minimum)||0)),Math.floor(Number(requirement.preferred)||0)),
    status:requirement.status??"unallocated"
  };
}

function cloneAssignment(assignment){
  return assignment?{
    ...assignment,
    point:assignment.point?{...assignment.point}:null,
    legacyRole:assignment.legacyRole?{...assignment.legacyRole}:null
  }:null;
}

function concernPriority(concern){
  return clamp((Number(concern.importance)||0)*.62+(Number(concern.urgency)||0)*.38);
}

function slotKey(concernId,responsibility,index){return`${concernId}:${responsibility}:${index}`;}

export class TeamConcernStaffingService{
  constructor({decisionLog=null,maxAssignmentsPerActor=2,continuityBonus=.22,switchMargin=.12,updateInterval=.3}={}){
    this.decisionLog=decisionLog;
    this.maxAssignmentsPerActor=Math.max(1,Math.floor(Number(maxAssignmentsPerActor)||2));
    this.continuityBonus=Math.max(0,Number(continuityBonus)||.22);
    this.switchMargin=Math.max(0,Number(switchMargin)||.12);
    this.updateInterval=Math.max(0,Number(updateInterval)||0);
    this.bySlot=new Map();
    this.byActor=new Map();
    this.byConcern=new Map();
    this.updatedAt=0;
  }

  update({game=null,teamConcerns=null,teamProcedures=null,now=0,force=false}={}){
    if(!force&&this.updatedAt>0&&now-this.updatedAt<this.updateInterval)return false;
    const previous=this.bySlot;
    const nextBySlot=new Map();
    const nextByActor=new Map();
    const nextByConcern=new Map();
    const liveSlots=new Set();
    const teamEntries=teamConcerns?.summary?.()??[];

    for(const entry of teamEntries){
      const concerns=(entry.concerns??[]).filter(concern=>concern.status==="active");
      if(!concerns.length)continue;
      const actors=(game?.actors??[]).filter(actor=>actor.teamId===entry.teamId&&capable(actor));
      const loads=new Map(actors.map(actor=>[actor.id,0]));
      const actorConcernKeys=new Set();
      const slots=[];

      for(const concern of concerns){
        for(const rawRequirement of concern.staffing??[]){
          const requirement=normalizedRequirement(rawRequirement);
          for(let index=0;index<requirement.preferred;index++)slots.push({
            key:slotKey(concern.id,requirement.responsibility,index),
            concern,
            requirement,
            slotIndex:index,
            required:index<requirement.minimum,
            priority:concernPriority(concern)+(index<requirement.minimum?.35:.02)
          });
        }
      }
      slots.sort((a,b)=>Number(b.required)-Number(a.required)||b.priority-a.priority||String(a.key).localeCompare(String(b.key)));

      for(const slot of slots){
        liveSlots.add(slot.key);
        const prior=previous.get(slot.key)??null;
        const candidates=actors
          .filter(actor=>actor.id!==slot.concern.subjectId)
          .filter(actor=>(loads.get(actor.id)??0)<this.maxAssignmentsPerActor)
          .filter(actor=>!actorConcernKeys.has(`${actor.id}:${slot.concern.id}`))
          .map(actor=>this.#scoreActor({actor,slot,prior,teamProcedures,load:loads.get(actor.id)??0}))
          .sort((a,b)=>b.score-a.score||String(a.actor.id).localeCompare(String(b.actor.id)));
        let selected=candidates[0]??null;
        const priorCandidate=prior?candidates.find(candidate=>candidate.actor.id===prior.actorId)??null:null;
        if(priorCandidate&&selected&&selected.actor.id!==priorCandidate.actor.id&&selected.score<priorCandidate.score+this.switchMargin)selected=priorCandidate;
        if(!selected){
          if(slot.required)this.#record("team_concern_staffing_unfilled",now,{teamId:entry.teamId,concernId:slot.concern.id,responsibility:slot.requirement.responsibility,slotIndex:slot.slotIndex});
          continue;
        }

        const actor=selected.actor;
        loads.set(actor.id,(loads.get(actor.id)??0)+1);
        actorConcernKeys.add(`${actor.id}:${slot.concern.id}`);
        const assignment={
          id:slot.key,slotKey:slot.key,teamId:entry.teamId,concernId:slot.concern.id,
          concernKind:slot.concern.kind,subjectId:slot.concern.subjectId??null,
          missionId:slot.concern.missionId??null,desiredEffect:slot.concern.desiredEffect,
          responsibility:slot.requirement.responsibility,capability:slot.requirement.capability,
          slotIndex:slot.slotIndex,required:slot.required,priority:slot.priority,
          actorId:actor.id,actorName:actor.name??actor.id,capabilityScore:selected.capabilityScore,
          score:selected.score,status:"assigned",point:slot.concern.point?{...slot.concern.point}:null,
          legacyRole:selected.legacyRole?{roleId:selected.legacyRole.roleId,label:selected.legacyRole.label,procedureId:selected.legacyRole.procedureId}:null,
          assignedAt:prior?.actorId===actor.id?prior.assignedAt??now:now,lastConfirmedAt:now
        };
        nextBySlot.set(slot.key,assignment);
        if(!nextByActor.has(actor.id))nextByActor.set(actor.id,[]);
        nextByActor.get(actor.id).push(assignment);
        if(!nextByConcern.has(slot.concern.id))nextByConcern.set(slot.concern.id,[]);
        nextByConcern.get(slot.concern.id).push(assignment);
        if(!prior||prior.actorId!==actor.id)this.#record(prior?"team_concern_staffing_reassigned":"team_concern_staffing_assigned",now,{teamId:entry.teamId,concernId:slot.concern.id,responsibility:slot.requirement.responsibility,slotIndex:slot.slotIndex,actorId:actor.id,previousActorId:prior?.actorId??null,score:selected.score});
      }
    }

    for(const [key,prior] of previous)if(!nextBySlot.has(key))this.#record("team_concern_staffing_released",now,{teamId:prior.teamId,concernId:prior.concernId,responsibility:prior.responsibility,slotIndex:prior.slotIndex,actorId:prior.actorId,reason:liveSlots.has(key)?"no_capable_actor":"concern_or_slot_ended"});
    for(const assignments of nextByActor.values())assignments.sort((a,b)=>Number(b.required)-Number(a.required)||b.priority-a.priority||String(a.id).localeCompare(String(b.id)));
    for(const assignments of nextByConcern.values())assignments.sort((a,b)=>Number(b.required)-Number(a.required)||String(a.id).localeCompare(String(b.id)));
    this.bySlot=nextBySlot;this.byActor=nextByActor;this.byConcern=nextByConcern;this.updatedAt=now;

    for(const entry of teamEntries)teamConcerns?.setStaffingAssignments?.(entry.teamId,this.getTeamAssignments(entry.teamId),{now});
    for(const actor of game?.actors??[])actor.aiV2ConcernAssignments=this.getActorAssignments(actor.id);
    return true;
  }

  getAssignment(id){return cloneAssignment(this.bySlot.get(id)??null);}
  hasAssignment(actorId,assignmentId){return this.bySlot.get(assignmentId)?.actorId===actorId;}
  getActorAssignments(actorId){return(this.byActor.get(actorId)??[]).map(cloneAssignment);}
  getPrimaryForActor(actorId){return cloneAssignment(this.byActor.get(actorId)?.[0]??null);}
  getConcernAssignments(concernId){return(this.byConcern.get(concernId)??[]).map(cloneAssignment);}
  getTeamAssignments(teamId){return[...this.bySlot.values()].filter(item=>item.teamId===teamId).map(cloneAssignment);}
  findForActor(actorId,{responsibility=null,concernKind=null,concernId=null}={}){
    return cloneAssignment((this.byActor.get(actorId)??[]).find(item=>(!responsibility||item.responsibility===responsibility)&&(!concernKind||item.concernKind===concernKind)&&(!concernId||item.concernId===concernId))??null);
  }
  summary(){return[...this.bySlot.values()].map(cloneAssignment);}

  #scoreActor({actor,slot,prior,teamProcedures,load}){
    const capabilityScore=capabilityValue(actor,slot.requirement.capability);
    const legacyRole=teamProcedures?.getActorRole?.(actor.id)??null;
    let roleMatch=0;
    if(legacyRole?.roleId===slot.requirement.responsibility)roleMatch=1;
    else if(legacyRole?.roleId==="local_security"&&slot.requirement.responsibility.includes("security"))roleMatch=.82;
    else if(legacyRole?.roleId==="objective_specialist"&&slot.requirement.responsibility==="carrier_or_aid_provider")roleMatch=.35;
    const proximity=slot.concern.point?clamp(1-distance(actor,slot.concern.point)/900):.5;
    const continuity=prior?.actorId===actor.id?this.continuityBonus:0;
    const loadPenalty=load*.16;
    const woundPenalty=actor.medical?.condition==="wounded"?.16:actor.medical?.condition==="serious"?.35:0;
    const score=capabilityScore*.48+roleMatch*.22+proximity*.14+slot.priority*.16+continuity-loadPenalty-woundPenalty;
    return{actor,score,capabilityScore,legacyRole};
  }

  #record(type,time,data){this.decisionLog?.record?.({type,time,teamId:data.teamId??null,actorId:data.actorId??null,data});}
}
