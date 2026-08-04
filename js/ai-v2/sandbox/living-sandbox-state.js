const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function stableUnit(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%10000)/10000;
}

function buildCargoPackages(need,objective,seed){
  if(need.kind!=="recover_supplies")return[];
  const count=Math.max(1,Math.round(need.resourceAmount||3));
  return Array.from({length:count},(_,index)=>{
    const angle=(Math.PI*2*index/count)+stableUnit(`${seed}:${need.id}:${index}`)*.55;
    const radius=34+(index%2)*18;
    return{
      id:`${need.id}_package_${index+1}`,resourceType:need.resourceType??"technical",units:1,weight:1,
      status:"at_site",holderActorId:null,claimedByActorId:null,returnedByFactionId:null,
      x:(objective?.x??0)+Math.cos(angle)*radius,y:(objective?.y??0)+Math.sin(angle)*radius,origin:{x:objective?.x??0,y:objective?.y??0}
    };
  });
}

function buildSurveyPoints(need,objective,seed){
  if(need.kind!=="survey_route")return[];
  const count=4;
  const base=stableUnit(`${seed}:${need.id}:survey`)*Math.PI*2;
  return Array.from({length:count},(_,index)=>{
    const angle=base+(index-1.5)*.52;
    const radius=170+index*92;
    return{id:`${need.id}_survey_${index+1}`,label:`Survey point ${index+1}`,index,x:(objective?.x??0)+Math.cos(angle)*radius,y:(objective?.y??0)+Math.sin(angle)*radius,status:"pending",recordedByActorId:null,recordedAt:null};
  });
}

function cloneCargo(item){return{...item,origin:item.origin?{...item.origin}:null};}
function cloneSurveyPoint(item){return{...item};}

function cloneCapabilities(capabilities={}){
  return Object.fromEntries(Object.entries(capabilities).map(([key,value])=>[key,clamp(value)]));
}

function cloneRosterMember(member){
  return{
    ...member,
    capabilities:cloneCapabilities(member.capabilities),
    wounds:(member.wounds??[]).map(wound=>({...wound})),
    equipment:[...(member.equipment??[])],
    unlockedAbilities:[...(member.unlockedAbilities??[])],
    traits:[...(member.traits??[])],
    fieldHistory:(member.fieldHistory??[]).map(item=>({...item})),
    deployedActorId:member.deployedActorId??null,
    operationId:member.operationId??null,
    availableAt:member.availableAt===Infinity?Infinity:finite(member.availableAt,0)
  };
}

function cloneFaction(faction){
  return{
    ...faction,
    priorities:{...faction.priorities},
    interests:{...faction.interests},
    resources:{...faction.resources},
    entryPoint:{...faction.entryPoint},
    roster:faction.roster.map(cloneRosterMember)
  };
}

function cloneNeed(need){
  return need?{
    ...need,
    capabilityNeeds:{...need.capabilityNeeds},
    cargoPackages:(need.cargoPackages??[]).map(cloneCargo),
    surveyPoints:(need.surveyPoints??[]).map(cloneSurveyPoint),
    operationalMemory:(need.operationalMemory??[]).map(item=>({...item})),
    scoreBreakdown:need.scoreBreakdown?{...need.scoreBreakdown}:null
  }:null;
}

function cloneOperation(operation){
  return operation?{
    ...operation,
    rosterIds:[...(operation.rosterIds??[])],
    actorIds:[...(operation.actorIds??[])],
    assignments:(operation.assignments??[]).map(item=>({...item})),
    objectivePoint:operation.objectivePoint?{...operation.objectivePoint}:null,
    entryPoint:operation.entryPoint?{...operation.entryPoint}:null,
    capabilityNeeds:{...(operation.capabilityNeeds??{})},
    scoreBreakdown:{...(operation.scoreBreakdown??{})},
    resourceCost:{...(operation.resourceCost??{})},
    cargoPackages:(operation.cargoPackages??[]).map(cloneCargo),
    surveyPoints:(operation.surveyPoints??[]).map(cloneSurveyPoint),
    operationalMemory:(operation.operationalMemory??[]).map(item=>({...item})),
    rosterOutcome:(operation.rosterOutcome??[]).map(item=>({...item,wounds:(item.wounds??[]).map(wound=>({...wound}))}))
  }:null;
}

function normalizedFaction(spec,index){
  return{
    id:spec.id,
    label:spec.label??spec.id,
    priorityOrder:index,
    priorities:Object.fromEntries(Object.entries(spec.priorities??{restore_infrastructure:.5}).map(([key,value])=>[key,clamp(value)])),
    interests:Object.fromEntries(Object.entries(spec.interests??{}).map(([key,value])=>[key,clamp(value)])),
    contactResolve:clamp(spec.contactResolve??.5),
    riskTolerance:clamp(spec.riskTolerance??.55),
    casualtyPriority:clamp(spec.casualtyPriority??.82),
    entryPoint:{x:finite(spec.entryPoint?.x,0),y:finite(spec.entryPoint?.y,0),facing:spec.entryPoint?.facing??"down"},
    score:finite(spec.score,0),
    resources:{medical:0,technical:0,food:0,fuel:0,...(spec.resources??{})},
    roster:(spec.roster??[]).map((member,memberIndex)=>({
      id:member.id??`${spec.id}_operator_${memberIndex+1}`,
      name:member.name??`${spec.label??spec.id} Operator ${memberIndex+1}`,
      role:member.role??"Field Operator",
      kitId:member.kitId??null,
      capabilities:cloneCapabilities(member.capabilities),
      status:member.status??"available",
      dutyStatus:member.dutyStatus??"available",
      healthStatus:member.healthStatus??"healthy",
      wounds:(member.wounds??[]).map(wound=>({...wound})),
      fatigue:clamp(member.fatigue??0),
      experience:Math.max(0,finite(member.experience,0)),
      level:Math.max(1,Math.round(finite(member.level,1))),
      operationCount:Math.max(0,Math.round(finite(member.operationCount,0))),
      successfulReturns:Math.max(0,Math.round(finite(member.successfulReturns,0))),
      equipment:[...(member.equipment??[])],
      unlockedAbilities:[...(member.unlockedAbilities??[])],
      traits:[...(member.traits??[])],
      fieldHistory:(member.fieldHistory??[]).map(item=>({...item})),
      capabilityImprovements:{...(member.capabilityImprovements??{})},
      operationId:null,
      deployedActorId:null,
      availableAt:0,
      deathAt:null
    }))
  };
}

function capabilityScore(member,key){return clamp(member?.capabilities?.[key]??0);}
function roleCapabilitiesForNeed(need){
  if(need.kind==="recover_supplies")return{specialist:"carrying",lead:"navigation",support:"security"};
  if(need.kind==="survey_route")return{specialist:"observation",lead:"scouting",support:"security"};
  return{specialist:"technicalWork",lead:"navigation",support:"security"};
}

function specialtyForMember(member){
  const preferred=/medic/i.test(member?.role??"")?"medical":/tech|repair|fixer|utility/i.test(member?.role??"")?"technicalWork":/carrier|handler/i.test(member?.role??"")?"carrying":/scout|pathfinder|surveyor|recon/i.test(member?.role??"")?"scouting":/security|guard/i.test(member?.role??"")?"security":null;
  if(preferred)return preferred;
  return Object.entries(member?.capabilities??{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??"observation";
}

function deploymentUtility(member,key){
  const capability=capabilityScore(member,key);
  const fatiguePenalty=clamp(member?.fatigue??0)*.24;
  const usagePenalty=Math.min(.22,(member?.operationCount??0)*.012);
  const readinessBonus=Math.min(.08,Math.max(0,(member?.level??1)-1)*.025);
  return capability-fatiguePenalty-usagePenalty+readinessBonus;
}

export class LivingSandboxState{
  constructor({config={},decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.liveMode=Boolean(config.liveMode);
    this.seed=Math.round(finite(config.seed,2101));
    this.dispatchDelay=Math.max(0,finite(config.dispatchDelay,1.2));
    this.minimumDispatchGap=Math.max(0,finite(config.minimumDispatchGap,1.5));
    this.postCompletionHold=Math.max(0,finite(config.postCompletionHold,4));
    this.interruptedReturnHold=Math.max(0,finite(config.interruptedReturnHold,1.2));
    this.blockedRetryDelay=Math.max(1,finite(config.blockedRetryDelay,30));
    this.recoveryDuration=Math.max(0,finite(config.recoveryDuration,24));
    this.woundedRecoveryMultiplier=Math.max(1,finite(config.woundedRecoveryMultiplier,3));
    this.teamSize=Math.max(1,Math.round(finite(config.teamSize,3)));
    this.maxActiveOperations=Math.max(1,Math.round(finite(config.maxActiveOperations,1)));
    this.turnover={...(config.turnover??{})};
    this.contention={enabled:true,minimumPrimaryAge:3.5,chance:.72,...(config.contention??{})};
    this.factions=new Map((config.factions??[]).map((spec,index)=>[spec.id,normalizedFaction(spec,index)]));
    this.needs=new Map();
    this.operations=new Map();
    this.history=[];
    this.operationSequence=0;
    this.lastDispatchAt=-Infinity;
    this.lastCandidateScores=[];
  }

  syncObjectives(objectives,{now=0}={}){
    for(const objective of objectives??[]){
      if(!objective?.id||!objective.aiObjective)continue;
      const desiredState=objective.sandboxNeed?.desiredState??objective.objectiveRequirements?.desiredState??"operational";
      const complete=objective.state===desiredState;
      const existing=this.needs.get(objective.id)??null;
      if(complete){
        if(existing&&existing.status==="assigned"){
          existing.status="satisfied";
          existing.satisfiedAt=existing.satisfiedAt??now;
          existing.lastChangedAt=now;
        }else if(existing&&existing.status!=="resolved"){
          existing.status="resolved";
          existing.resolvedAt=now;
          existing.lastChangedAt=now;
          this.#record("world_need_resolved",now,{needId:existing.id,objectiveId:objective.id});
        }
        continue;
      }

      const spec=objective.sandboxNeed??{};
      if(existing){
        existing.objectiveState=objective.state??"unknown";
        existing.urgency=clamp(spec.urgency??existing.urgency??.5);
        existing.lastChangedAt=now;
        if(["resolved","satisfied"].includes(existing.status)){
          const priorOperation=existing.operationId?this.operations.get(existing.operationId):null;
          const priorStillActive=Boolean(priorOperation&&["proposed","deployed","returning","interrupted"].includes(priorOperation.status));
          if(!priorStillActive){
            existing.previousOperationId=existing.operationId??existing.previousOperationId??null;
            existing.status="open";
            existing.operationId=null;
            existing.resolvedAt=null;
            existing.satisfiedAt=null;
            existing.cargoPackages=buildCargoPackages(existing,objective,this.seed+Math.round(now));
            existing.surveyPoints=buildSurveyPoints(existing,objective,this.seed+Math.round(now));
            this.#record("world_need_reopened",now,{needId:existing.id,objectiveId:objective.id,previousOperationId:existing.previousOperationId});
          }
        }
        continue;
      }

      const need={
        id:spec.id??`need_${objective.id}`,
        kind:spec.kind??"restore_infrastructure",
        family:spec.family??"infrastructure",
        interestKey:spec.interestKey??spec.family??"infrastructure",
        label:spec.label??`Restore ${objective.name??objective.label??objective.id}`,
        objectiveId:objective.id,
        objectiveState:objective.state??"unknown",
        desiredState,
        urgency:clamp(spec.urgency??.5),
        strategicValue:clamp(spec.strategicValue??.65),
        scoreValue:Math.max(1,Math.round(finite(spec.scoreValue,50))),
        resourceType:spec.resourceType??null,
        resourceAmount:Math.max(0,finite(spec.resourceAmount,0)),
        capabilityNeeds:Object.fromEntries(Object.entries(spec.capabilityNeeds??{
          technicalWork:.72,navigation:.45,security:.45
        }).map(([key,value])=>[key,clamp(value)])),
        status:"open",
        operationId:null,
        attemptCount:0,
        blockedAt:null,
        blockedByOperationId:null,
        retryAfter:null,
        createdAt:now,
        lastChangedAt:now,
        satisfiedAt:null,
        resolvedAt:null,
        scoreBreakdown:null,
        cargoPackages:[],
        surveyPoints:[],
        operationalMemory:[]
      };
      need.cargoPackages=buildCargoPackages(need,objective,this.seed);
      need.surveyPoints=buildSurveyPoints(need,objective,this.seed);
      this.needs.set(objective.id,need);
      this.#record("world_need_created",now,{needId:need.id,objectiveId:objective.id,kind:need.kind,urgency:need.urgency});
    }
  }

  updateRecovery({now=0}={}){
    for(const faction of this.factions.values())for(const member of faction.roster){
      if(member.status!=="recovering"||member.availableAt>now)continue;
      member.status="available";
      member.dutyStatus="available";
      member.operationId=null;
      member.deployedActorId=null;
      member.availableAt=0;
      member.fatigue=Math.max(0,(member.fatigue??0)-.55);
      if(member.healthStatus!=="dead"){
        member.healthStatus="healthy";
        member.wounds=[];
      }
      this.#record("roster_member_available",now,{factionId:faction.id,rosterId:member.id});
    }
  }

  proposeDispatch({objectives=[],now=0}={}){
    this.updateBlockedNeeds({now});
    const active=[...this.operations.values()].filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status));
    const contentionReserve=this.liveMode&&this.contention?.enabled?1:0;
    const normalCapacity=Math.max(1,this.maxActiveOperations-contentionReserve);
    if(active.length>=normalCapacity)return null;
    if(now<this.dispatchDelay||now-this.lastDispatchAt<this.minimumDispatchGap)return null;

    const objectiveById=new Map((objectives??[]).map(objective=>[objective.id,objective]));
    const candidates=[];
    for(const need of this.needs.values()){
      if(need.status!=="open")continue;
      const objective=objectiveById.get(need.objectiveId);
      if(!objective||objective.state===need.desiredState)continue;
      for(const faction of this.factions.values()){
        const available=faction.roster.filter(member=>member.status==="available"&&member.healthStatus!=="dead");
        if(available.length<this.teamSize)continue;
        const team=this.#selectTeam(faction,need);
        if(team.length<this.teamSize)continue;
        const priority=clamp(faction.priorities[need.kind]??0);
        const capabilityFit=this.#teamCapabilityFit(team,need.capabilityNeeds);
        let score;
        let scoreBreakdown;
        if(!this.liveMode){
          score=priority*.58+need.urgency*.27+capabilityFit*.15-faction.priorityOrder*.0001;
          scoreBreakdown={priority:priority*.58,urgency:need.urgency*.27,capabilityFit:capabilityFit*.15,total:score};
        }else{
          const interest=clamp(faction.interests[need.interestKey]??.5);
          const travelDistance=distance(faction.entryPoint,objective);
          const worldDiagonal=Math.hypot(7600,4200);
          const travelCost=clamp(travelDistance/worldDiagonal);
          const scarcity=clamp(1-(available.length-this.teamSize)/Math.max(1,faction.roster.length-this.teamSize));
          const retryPressure=clamp((need.attemptCount??0)*.08,0,.24);
          const continuity=objective.progress>0?clamp(objective.progress)*.1:0;
          const variation=(stableUnit(`${this.seed}:${this.operationSequence+1}:${faction.id}:${need.id}`)-.5)*.05;
          const terms={
            priority:priority*.22,
            interest:interest*.2,
            urgency:need.urgency*.18,
            strategicValue:need.strategicValue*.14,
            capabilityFit:capabilityFit*.16,
            continuity,
            travelCost:-travelCost*.11,
            rosterScarcity:-scarcity*.08,
            retryPressure:-retryPressure,
            variation
          };
          score=Object.values(terms).reduce((sum,value)=>sum+value,0);
          scoreBreakdown={...terms,total:score,travelDistance:Math.round(travelDistance),availableRoster:available.length};
        }
        const travelDistance=distance(faction.entryPoint,objective);
        const resourceCost={
          fuel:travelDistance>3600?1:0,
          technical:need.kind==="restore_infrastructure"?1:0,
          medical:0
        };
        const required=Object.values(resourceCost).reduce((sum,value)=>sum+value,0);
        const covered=Object.entries(resourceCost).reduce((sum,[key,value])=>sum+Math.min(value,faction.resources[key]??0),0);
        const resourceCoverage=required?covered/required:1;
        if(this.liveMode){score+=(resourceCoverage-1)*.16;scoreBreakdown.resourceCoverage=resourceCoverage*.06;scoreBreakdown.resourceShortage=-(1-resourceCoverage)*.16;scoreBreakdown.total=score;}
        candidates.push({need,objective,faction,team,score,scoreBreakdown,capabilityFit,resourceCost,resourceCoverage});
      }
    }
    candidates.sort((left,right)=>right.score-left.score||right.need.urgency-left.need.urgency||left.faction.priorityOrder-right.faction.priorityOrder||left.need.id.localeCompare(right.need.id));
    this.lastCandidateScores=candidates.slice(0,18).map(candidate=>({
      factionId:candidate.faction.id,factionLabel:candidate.faction.label,needId:candidate.need.id,objectiveId:candidate.need.objectiveId,
      objectiveLabel:candidate.objective.name??candidate.need.objectiveId,kind:candidate.need.kind,score:candidate.score,scoreBreakdown:{...candidate.scoreBreakdown},
      rosterIds:candidate.team.map(member=>member.id)
    }));
    const selected=candidates[0];
    if(!selected)return null;

    const operationId=`sandbox_operation_${++this.operationSequence}`;
    const assignments=this.#assignResponsibilities(selected.team,selected.need);
    const operation={
      id:operationId,
      kind:selected.need.kind,
      templateId:selected.need.kind,
      family:selected.need.family,
      label:selected.need.label,
      status:"proposed",
      factionId:selected.faction.id,
      factionLabel:selected.faction.label,
      needId:selected.need.id,
      objectiveId:selected.need.objectiveId,
      objectiveLabel:selected.objective.name??selected.objective.label??selected.need.objectiveId,
      objectivePoint:{x:selected.objective.x,y:selected.objective.y},
      desiredState:selected.need.desiredState,
      urgency:selected.need.urgency,
      strategicValue:selected.need.strategicValue,
      scoreValue:selected.need.scoreValue,
      resourceType:selected.need.resourceType,
      resourceAmount:selected.need.resourceAmount,
      resourceCost:{...selected.resourceCost},
      resourceCoverage:selected.resourceCoverage,
      cargoPackages:(selected.need.cargoPackages??[]).map(cloneCargo),
      surveyPoints:(selected.need.surveyPoints??[]).map(cloneSurveyPoint),
      operationalMemory:(selected.need.operationalMemory??[]).map(item=>({...item})),
      returnedResourceAmount:0,
      abandonedResourceAmount:0,
      casualtyCount:0,
      deathCount:0,
      capabilityNeeds:{...selected.need.capabilityNeeds},
      capabilityFit:selected.capabilityFit,
      score:selected.score,
      scoreBreakdown:{...selected.scoreBreakdown},
      contactResolve:selected.faction.contactResolve,
      rosterIds:selected.team.map(member=>member.id),
      assignments,
      actorIds:[],
      teamId:null,
      entryPoint:{...selected.faction.entryPoint},
      proposedAt:now,
      deployedAt:null,
      objectiveCompletedAt:null,
      returnReadyAt:null,
      completedAt:null,
      attemptNumber:(selected.need.attemptCount??0)+1,
      result:null,
      violent:false,
      interruptedAt:null,
      interruptionReason:null,
      blockingOperationId:null,
      outcomeId:null,
      rosterOutcome:[]
    };
    this.operations.set(operationId,operation);
    selected.need.status="assigned";
    selected.need.operationId=operationId;
    selected.need.attemptCount=(selected.need.attemptCount??0)+1;
    selected.need.blockedAt=null;
    selected.need.blockedByOperationId=null;
    selected.need.retryAfter=null;
    selected.need.lastChangedAt=now;
    selected.need.scoreBreakdown={...selected.scoreBreakdown};
    for(const member of selected.team){
      member.status="assigned";
      member.dutyStatus="assigned";
      member.operationId=operationId;
    }
    for(const [key,cost] of Object.entries(operation.resourceCost??{})){
      const spent=Math.min(Math.max(0,cost),selected.faction.resources[key]??0);
      selected.faction.resources[key]=(selected.faction.resources[key]??0)-spent;
      if(spent>0)this.#record("faction_resource_spent",now,{factionId:selected.faction.id,operationId,resourceType:key,amount:spent,remaining:selected.faction.resources[key]});
    }
    this.lastDispatchAt=now;
    this.#record("faction_operation_proposed",now,{operationId,factionId:operation.factionId,needId:operation.needId,objectiveId:operation.objectiveId,score:operation.score,scoreBreakdown:{...operation.scoreBreakdown}});
    return cloneOperation(operation);
  }

  proposeContestedDispatch({objectives=[],now=0}={}){
    if(!this.liveMode||!this.contention?.enabled)return null;
    const active=[...this.operations.values()].filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status));
    if(active.length>=this.maxActiveOperations)return null;
    if(now-this.lastDispatchAt<this.minimumDispatchGap)return null;
    const objectiveById=new Map((objectives??[]).map(objective=>[objective.id,objective]));
    const primary=[...this.operations.values()]
      .filter(operation=>operation.status==="deployed"&&!operation.contested&&operation.family==="infrastructure"&&!operation.contestedDispatchCreated&&now-(operation.deployedAt??now)>=Math.max(1,finite(this.contention.minimumPrimaryAge,3.5)))
      .sort((a,b)=>(b.strategicValue??0)-(a.strategicValue??0)||(a.deployedAt??0)-(b.deployedAt??0))[0]??null;
    if(!primary)return null;
    const objective=objectiveById.get(primary.objectiveId);
    if(!objective||objective.state===primary.desiredState){primary.contestedDispatchCreated=true;return null;}
    const roll=stableUnit(`${this.seed}:${primary.id}:contention`);
    if(roll>clamp(this.contention.chance??.72)){primary.contestedDispatchCreated=true;this.#record("faction_contention_declined",now,{operationId:primary.id,objectiveId:primary.objectiveId,roll});return null;}
    const need=[...this.needs.values()].find(candidate=>candidate.id===primary.needId)??null;
    if(!need)return null;
    const candidates=[];
    for(const faction of this.factions.values()){
      if(faction.id===primary.factionId)continue;
      if(active.some(operation=>operation.contested&&operation.primaryOperationId===primary.id&&operation.factionId===faction.id))continue;
      const available=faction.roster.filter(member=>member.status==="available"&&member.healthStatus!=="dead");
      if(available.length<this.teamSize)continue;
      const team=this.#selectTeam(faction,need);
      if(team.length<this.teamSize)continue;
      const priority=clamp(faction.priorities[need.kind]??0);
      const interest=clamp(faction.interests[need.interestKey]??.5);
      const capabilityFit=this.#teamCapabilityFit(team,need.capabilityNeeds);
      const travelCost=clamp(distance(faction.entryPoint,objective)/Math.hypot(7600,4200));
      const conflictCost=(1-clamp(faction.riskTolerance??.5))*.14;
      const variation=(stableUnit(`${this.seed}:${primary.id}:${faction.id}:rival`)-.5)*.04;
      const score=priority*.2+interest*.23+need.urgency*.14+need.strategicValue*.17+capabilityFit*.14+(faction.riskTolerance??.5)*.16-travelCost*.24-conflictCost+variation;
      candidates.push({faction,team,score,capabilityFit,travelCost});
    }
    candidates.sort((a,b)=>b.score-a.score||b.faction.riskTolerance-a.faction.riskTolerance||a.faction.priorityOrder-b.faction.priorityOrder);
    const selected=candidates[0];
    if(!selected){primary.contestedDispatchCreated=true;return null;}
    const operationId=`sandbox_operation_${++this.operationSequence}`;
    const resourceCost={fuel:distance(selected.faction.entryPoint,objective)>3600?1:0,technical:1,medical:0};
    const operation={
      id:operationId,kind:primary.kind,templateId:primary.templateId,family:primary.family,
      label:`Contest access to ${primary.objectiveLabel}`,status:"proposed",
      factionId:selected.faction.id,factionLabel:selected.faction.label,needId:primary.needId,
      objectiveId:primary.objectiveId,objectiveLabel:primary.objectiveLabel,objectivePoint:{...primary.objectivePoint},desiredState:primary.desiredState,
      urgency:primary.urgency,strategicValue:primary.strategicValue,scoreValue:0,resourceType:null,resourceAmount:0,
      resourceCost,resourceCoverage:1,cargoPackages:[],surveyPoints:[],operationalMemory:[{type:"rival_operation_detected",at:now,operationId:primary.id,factionId:primary.factionId}],
      returnedResourceAmount:0,abandonedResourceAmount:0,casualtyCount:0,deathCount:0,
      capabilityNeeds:{...primary.capabilityNeeds},capabilityFit:selected.capabilityFit,score:selected.score,
      scoreBreakdown:{contention:1,riskTolerance:selected.faction.riskTolerance,travelCost:-selected.travelCost*.24,total:selected.score},
      contactResolve:Math.max(.84,selected.faction.contactResolve??.5),rosterIds:selected.team.map(member=>member.id),assignments:this.#assignResponsibilities(selected.team,need),
      actorIds:[],teamId:null,entryPoint:{...selected.faction.entryPoint},proposedAt:now,deployedAt:null,objectiveCompletedAt:null,returnReadyAt:null,completedAt:null,
      attemptNumber:1,result:null,violent:false,interruptedAt:null,interruptionReason:null,blockingOperationId:primary.id,outcomeId:null,rosterOutcome:[],
      contested:true,contestedRole:"challenger",primaryOperationId:primary.id,contestedDispatchCreated:true
    };
    primary.contestedDispatchCreated=true;
    primary.contestedByOperationId=operationId;
    this.operations.set(operationId,operation);
    for(const member of selected.team){member.status="assigned";member.dutyStatus="assigned";member.operationId=operationId;}
    for(const [key,cost] of Object.entries(resourceCost)){
      const spent=Math.min(Math.max(0,cost),selected.faction.resources[key]??0);
      selected.faction.resources[key]=(selected.faction.resources[key]??0)-spent;
      if(spent>0)this.#record("faction_resource_spent",now,{factionId:selected.faction.id,operationId,resourceType:key,amount:spent,remaining:selected.faction.resources[key]});
    }
    this.lastDispatchAt=now;
    this.#record("faction_contested_operation_proposed",now,{operationId,primaryOperationId:primary.id,factionId:operation.factionId,defendingFactionId:primary.factionId,objectiveId:operation.objectiveId,score:operation.score});
    return cloneOperation(operation);
  }

  markDeployed({operationId,teamId,actorIds=[],now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||operation.status!=="proposed")return false;
    operation.status="deployed";
    operation.teamId=teamId;
    operation.actorIds=[...actorIds];
    operation.deployedAt=now;
    const faction=this.factions.get(operation.factionId);
    for(let index=0;index<operation.rosterIds.length;index+=1){
      const member=faction?.roster.find(candidate=>candidate.id===operation.rosterIds[index]);
      if(!member)continue;
      member.status="deployed";
      member.dutyStatus="deployed";
      member.operationId=operationId;
      member.deployedActorId=actorIds[index]??null;
      member.operationCount=(member.operationCount??0)+1;
    }
    this.#record("faction_operation_deployed",now,{operationId,teamId,factionId:operation.factionId,actorIds:[...actorIds]});
    return true;
  }

  beginReturn(operationId,{now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||operation.status!=="deployed")return false;
    operation.status="returning";
    operation.objectiveCompletedAt=now;
    operation.returnReadyAt=now+this.postCompletionHold;
    this.#record("faction_operation_returning",now,{operationId,teamId:operation.teamId,objectiveId:operation.objectiveId,returnReadyAt:operation.returnReadyAt});
    return true;
  }

  interruptOperation(operationId,{now=0,reason="mission_interrupted",blockingOperationId=null,outcomeId=null,result="deferred",violent=false}={}){
    const operation=this.operations.get(operationId);
    if(!operation||operation.status!=="deployed")return false;
    operation.status="interrupted";
    operation.result=result;
    operation.violent=Boolean(violent);
    operation.interruptedAt=now;
    operation.interruptionReason=reason;
    operation.blockingOperationId=blockingOperationId;
    operation.outcomeId=outcomeId;
    operation.returnReadyAt=now+this.interruptedReturnHold;
    if(operation.contested&&operation.primaryOperationId){
      const primary=this.operations.get(operation.primaryOperationId);
      if(primary){
        primary.contentionResolvedAt=now;
        primary.contestedByOperationId=null;
        primary.operationalMemory=[...(primary.operationalMemory??[]),{type:violent?"rival_broke_contact_under_fire":"rival_operation_withdrew",at:now,operationId:operation.id,factionId:operation.factionId}].slice(-12);
      }
    }
    const need=[...this.needs.values()].find(candidate=>candidate.id===operation.needId)??null;
    if(need&&!operation.contested){
      need.status="blocked";
      need.blockedAt=now;
      need.blockedByOperationId=blockingOperationId;
      need.retryAfter=now+this.blockedRetryDelay;
      need.lastChangedAt=now;
    }
    this.#record("faction_operation_interrupted",now,{operationId,teamId:operation.teamId,factionId:operation.factionId,needId:operation.needId,reason,result:operation.result,violent:operation.violent,blockingOperationId,outcomeId,returnReadyAt:operation.returnReadyAt});
    return true;
  }

  resolveContestedStandoffs({now=0}={}){
    if(!this.liveMode||!this.contention?.enabled)return[];
    const resolved=[];
    const maximumDuration=Math.max(12,finite(this.contention.maximumStandoffDuration,64));
    for(const challenger of this.operations.values()){
      if(!challenger.contested||challenger.contestedRole!=="challenger"||challenger.status!=="deployed")continue;
      const primary=this.operations.get(challenger.primaryOperationId);
      if(!primary||primary.status!=="deployed"){
        if(this.interruptOperation(challenger.id,{now,reason:"contested_primary_no_longer_active",blockingOperationId:primary?.id??null,result:"deferred_after_standoff",violent:false}))resolved.push(challenger.id);
        continue;
      }
      if(now-(challenger.deployedAt??now)<maximumDuration)continue;
      if(this.interruptOperation(challenger.id,{now,reason:"contested_worksite_standoff_expired",blockingOperationId:primary.id,result:"deferred_after_standoff",violent:false})){
        primary.operationalMemory=[...(primary.operationalMemory??[]),{type:"rival_standoff_ended",at:now,operationId:challenger.id,factionId:challenger.factionId}].slice(-12);
        this.#record("faction_contested_standoff_resolved",now,{operationId:challenger.id,primaryOperationId:primary.id,factionId:challenger.factionId,objectiveId:challenger.objectiveId,duration:now-(challenger.deployedAt??now)});
        resolved.push(challenger.id);
      }
    }
    return resolved;
  }

  updateBlockedNeeds({now=0}={}){
    for(const need of this.needs.values()){
      if(need.status!=="blocked"||need.operationId)continue;
      const blocker=need.blockedByOperationId?this.operations.get(need.blockedByOperationId):null;
      const blockerActive=Boolean(blocker&&["proposed","deployed","returning","interrupted"].includes(blocker.status));
      if(blockerActive&&finite(need.retryAfter,Infinity)>now)continue;
      need.status="open";
      need.blockedAt=null;
      need.blockedByOperationId=null;
      need.retryAfter=null;
      need.lastChangedAt=now;
      this.#record("world_need_retry_opened",now,{needId:need.id,objectiveId:need.objectiveId,attemptCount:need.attemptCount??0});
    }
  }

  readyReturns({now=0}={}){
    return[...this.operations.values()]
      .filter(operation=>["returning","interrupted"].includes(operation.status)&&finite(operation.returnReadyAt,Infinity)<=now)
      .map(cloneOperation);
  }

  reconcileReturn(operationId,{actors=[],now=0}={}){
    const operation=this.operations.get(operationId);
    const faction=operation?this.factions.get(operation.factionId):null;
    if(!operation||!faction)return false;
    const actorsById=new Map(actors.map(actor=>[actor.id,actor]));
    operation.rosterOutcome=[];
    for(let index=0;index<operation.rosterIds.length;index+=1){
      const rosterId=operation.rosterIds[index];
      const member=faction.roster.find(candidate=>candidate.id===rosterId);
      const actor=actorsById.get(operation.actorIds[index])??actors.find(candidate=>candidate.rosterId===rosterId)??null;
      if(!member)continue;
      const medical=actor?.medical??{};
      const dead=Boolean(medical.dead);
      const wounded=!dead&&Boolean((medical.wounds??[]).length||medical.condition&&medical.condition!=="healthy");
      member.wounds=(medical.wounds??[]).map(wound=>({...wound}));
      member.healthStatus=dead?"dead":wounded?"wounded":"healthy";
      if(dead)operation.deathCount=(operation.deathCount??0)+1;
      else if(wounded)operation.casualtyCount=(operation.casualtyCount??0)+1;
      const returnedCargo=(operation.cargoPackages??[]).filter(item=>item.status==="returned"&&item.holderActorId===actor?.id).reduce((sum,item)=>sum+(item.units??1),0);
      const recordedSurvey=(operation.surveyPoints??[]).filter(item=>item.recordedByActorId===actor?.id).length;
      const responsibility=operation.assignments?.[index]?.responsibility??null;
      const responsibilityBonus=operation.status==="returning"&&responsibility?4:0;
      const experienceGain=(operation.status==="returning"?16:8)+(operation.violent?5:0)+returnedCargo*4+recordedSurvey*3+responsibilityBonus;
      const previousLevel=member.level??1;
      member.experience=(member.experience??0)+experienceGain;
      member.level=Math.max(1,1+Math.floor(member.experience/100));
      if(member.level>previousLevel){
        const specialty=specialtyForMember(member);
        const gain=Math.min(.06,(member.level-previousLevel)*.025);
        member.capabilities[specialty]=clamp((member.capabilities[specialty]??0)+gain);
        member.capabilityImprovements={...(member.capabilityImprovements??{}),[specialty]:(member.capabilityImprovements?.[specialty]??0)+gain};
        this.#record("roster_member_leveled",now,{factionId:faction.id,rosterId:member.id,level:member.level,specialty,capability:member.capabilities[specialty]});
      }
      member.fatigue=clamp((member.fatigue??0)+(operation.status==="returning"?.32:.24)+(operation.violent?.12:0));
      if(operation.status==="returning")member.successfulReturns=(member.successfulReturns??0)+1;
      let medicalSupportUsed=0;
      if(dead){
        member.status="dead";
        member.dutyStatus="dead";
        member.availableAt=Infinity;
        member.deathAt=now;
      }else{
        const severity=medical.condition==="critical"?3:medical.condition==="serious"||medical.condition==="unconscious"?2:wounded?1:0;
        let recovery=this.recoveryDuration*(1+severity*(this.woundedRecoveryMultiplier-1));
        if(wounded&&(faction.resources.medical??0)>0){
          faction.resources.medical-=1;medicalSupportUsed=1;recovery*=.68;
          this.#record("medical_resource_used_for_recovery",now,{factionId:faction.id,rosterId:member.id,operationId:operation.id,recoveryDuration:recovery,remaining:faction.resources.medical});
        }
        member.status=recovery>0?"recovering":"available";
        member.dutyStatus=member.status;
        member.availableAt=recovery>0?now+recovery:0;
      }
      member.fieldHistory=[...(member.fieldHistory??[]),{operationId:operation.id,kind:operation.kind,result:operation.status==="returning"?"returned":operation.result??"interrupted",at:now,wounded,dead,experienceGain,returnedCargo,recordedSurvey,medicalSupportUsed}].slice(-20);
      member.operationId=null;
      member.deployedActorId=null;
      const outcome={rosterId:member.id,actorId:actor?.id??null,healthStatus:member.healthStatus,wounds:member.wounds.map(wound=>({...wound})),experience:member.experience,level:member.level,availableAt:member.availableAt};
      operation.rosterOutcome.push(outcome);
      this.#record(dead?"roster_member_killed":wounded?"roster_member_wounded":"roster_member_returned",now,{factionId:faction.id,operationId:operation.id,...outcome});
    }
    return true;
  }

  completeReturn(operationId,{now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||!["returning","interrupted"].includes(operation.status))return false;
    const interrupted=operation.status==="interrupted";
    operation.status=interrupted?"deferred":"completed";
    operation.result=interrupted?(operation.result??"deferred"):"completed";
    operation.completedAt=now;
    const need=[...this.needs.values()].find(candidate=>candidate.id===operation.needId)??null;
    if(need&&!operation.contested){
      if(interrupted){
        need.status="blocked";
        need.operationId=null;
        need.cargoPackages=(operation.cargoPackages??[]).filter(item=>item.status!=="returned").map(item=>({...cloneCargo(item),status:item.status==="carried"?"dropped":item.status,holderActorId:null,claimedByActorId:null}));
        need.surveyPoints=(operation.surveyPoints??[]).map(cloneSurveyPoint);
        need.operationalMemory=[...(need.operationalMemory??[]),{type:operation.violent?"armed_contact":"interrupted_operation",at:now,operationId:operation.id,result:operation.result}].slice(-8);
        need.blockedAt=need.blockedAt??now;
        need.retryAfter=need.retryAfter??now+this.blockedRetryDelay;
      }else{
        need.status="resolved";
        need.operationId=operationId;
        need.resolvedAt=now;
      }
      need.lastChangedAt=now;
    }
    const faction=this.factions.get(operation.factionId);
    if(!operation.rosterOutcome?.length){
      for(const rosterId of operation.rosterIds){
        const member=faction?.roster.find(candidate=>candidate.id===rosterId);
        if(!member||member.status==="dead")continue;
        member.status=this.recoveryDuration>0?"recovering":"available";
        member.dutyStatus=member.status;
        member.operationId=null;
        member.deployedActorId=null;
        member.availableAt=this.recoveryDuration>0?now+this.recoveryDuration:0;
      }
    }
    if(!interrupted&&faction&&!operation.contested){
      faction.score+=operation.scoreValue??50;
      const returnedAmount=operation.resourceType?Math.max(0,finite(operation.returnedResourceAmount,operation.resourceAmount)):0;
      if(operation.resourceType&&returnedAmount>0)faction.resources[operation.resourceType]=(faction.resources[operation.resourceType]??0)+returnedAmount;
      this.#record("faction_score_awarded",now,{factionId:faction.id,operationId:operation.id,points:operation.scoreValue??50,totalScore:faction.score,resourceType:operation.resourceType,resourceAmount:returnedAmount,abandonedResourceAmount:operation.abandonedResourceAmount??0});
    }
    this.#record(interrupted?"faction_operation_deferred":"faction_operation_completed",now,{operationId,factionId:operation.factionId,needId:operation.needId,objectiveId:operation.objectiveId,result:operation.result,violent:Boolean(operation.violent),blockingOperationId:operation.blockingOperationId,outcomeId:operation.outcomeId});
    return true;
  }

  getOperationAssets(operationId){
    const operation=this.operations.get(operationId);
    return operation?{cargoPackages:(operation.cargoPackages??[]).map(cloneCargo),surveyPoints:(operation.surveyPoints??[]).map(cloneSurveyPoint)}:null;
  }

  claimCargo({operationId,actorId,packageId=null,now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||!actorId)return null;
    const item=(operation.cargoPackages??[]).find(candidate=>(!packageId||candidate.id===packageId)&&["at_site","dropped"].includes(candidate.status)&&(!candidate.claimedByActorId||candidate.claimedByActorId===actorId))??null;
    if(!item)return null;
    const newlyClaimed=item.claimedByActorId!==actorId;
    item.claimedByActorId=actorId;item.claimedAt=item.claimedAt??now;
    if(newlyClaimed)this.#record("cargo_package_claimed",now,{operationId,actorId,packageId:item.id});
    return cloneCargo(item);
  }

  releaseCargoClaim({operationId,actorId,packageId,now=0,reason="released"}={}){
    const operation=this.operations.get(operationId);
    const item=operation?.cargoPackages?.find(candidate=>candidate.id===packageId);
    if(!item||item.claimedByActorId!==actorId)return false;
    item.claimedByActorId=null;item.claimedAt=null;
    this.#record("cargo_package_claim_released",now,{operationId,actorId,packageId,reason});
    return true;
  }

  pickupCargo({operationId,actorId,packageId,now=0}={}){
    const operation=this.operations.get(operationId);
    const item=operation?.cargoPackages?.find(candidate=>candidate.id===packageId);
    if(!item||item.claimedByActorId!==actorId||!["at_site","dropped"].includes(item.status))return null;
    item.status="carried";item.holderActorId=actorId;item.claimedByActorId=null;item.pickedUpAt=now;
    this.#record("cargo_package_picked_up",now,{operationId,actorId,packageId,units:item.units,resourceType:item.resourceType});
    return cloneCargo(item);
  }

  dropCargoForActor({operationId,actorId,x=0,y=0,now=0,reason="actor_incapable"}={}){
    const operation=this.operations.get(operationId);
    if(!operation)return[];
    const dropped=[];
    for(const item of operation.cargoPackages??[]){
      if(item.holderActorId!==actorId||item.status!=="carried")continue;
      item.status="dropped";item.holderActorId=null;item.claimedByActorId=null;item.x=x;item.y=y;item.droppedAt=now;item.dropReason=reason;dropped.push(cloneCargo(item));
      this.#record("cargo_package_dropped",now,{operationId,actorId,packageId:item.id,reason,x,y});
    }
    return dropped;
  }

  cargoStatus(operationId){
    const operation=this.operations.get(operationId);
    const items=operation?.cargoPackages??[];
    const count=status=>items.filter(item=>item.status===status).reduce((sum,item)=>sum+(item.units??1),0);
    return{total:items.reduce((sum,item)=>sum+(item.units??1),0),atSite:count("at_site"),claimed:items.filter(item=>item.claimedByActorId).length,carried:count("carried"),dropped:count("dropped"),returned:count("returned"),items:items.map(cloneCargo)};
  }

  markCargoReturned({operationId,actors=[],factionId=null,now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation)return 0;
    const liveIds=new Set(actors.filter(actor=>!actor.medical?.dead).map(actor=>actor.id));
    let returned=0,abandoned=0;
    for(const item of operation.cargoPackages??[]){
      if(item.status==="carried"&&liveIds.has(item.holderActorId)){item.status="returned";item.returnedByFactionId=factionId;item.returnedAt=now;returned+=item.units??1;}
      else if(item.status!=="returned")abandoned+=item.units??1;
    }
    operation.returnedResourceAmount=returned;operation.abandonedResourceAmount=abandoned;
    this.#record("operation_cargo_reconciled",now,{operationId,factionId,returned,abandoned});
    return returned;
  }

  recordSurveyPoint({operationId,pointId,actorId,now=0}={}){
    const operation=this.operations.get(operationId);
    const point=operation?.surveyPoints?.find(candidate=>candidate.id===pointId);
    if(!point||point.status==="recorded")return null;
    point.status="recorded";point.recordedByActorId=actorId;point.recordedAt=now;
    const completed=operation.surveyPoints.filter(item=>item.status==="recorded").length;
    const total=operation.surveyPoints.length;
    this.#record("survey_point_recorded",now,{operationId,pointId,actorId,completed,total});
    return{point:cloneSurveyPoint(point),completed,total,complete:completed>=total,nextPointIndex:Math.min(total-1,completed)};
  }

  surveyStatus(operationId){
    const operation=this.operations.get(operationId);const items=operation?.surveyPoints??[];
    const completed=items.filter(item=>item.status==="recorded").length;
    return{completed,total:items.length,complete:items.length>0&&completed>=items.length,next:items.find(item=>item.status!=="recorded")??null,points:items.map(cloneSurveyPoint)};
  }

  recordOperationMemory(operationId,memory,{now=0}={}){
    const operation=this.operations.get(operationId);if(!operation)return false;
    operation.operationalMemory=[...(operation.operationalMemory??[]),{...memory,at:memory?.at??now}].slice(-12);
    return true;
  }

  getOperation(operationId){return cloneOperation(this.operations.get(operationId)??null);}
  getFaction(factionId){const faction=this.factions.get(factionId);return faction?cloneFaction(faction):null;}
  getNeedByObjective(objectiveId){return cloneNeed(this.needs.get(objectiveId)??null);}
  getCandidateScores(){return this.lastCandidateScores.map(candidate=>({...candidate,scoreBreakdown:{...candidate.scoreBreakdown},rosterIds:[...candidate.rosterIds]}));}
  activeOperations(){return[...this.operations.values()].filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status)).map(cloneOperation);}

  summary(){
    return{
      liveMode:this.liveMode,
      seed:this.seed,
      factions:[...this.factions.values()].map(faction=>({
        id:faction.id,
        label:faction.label,
        score:faction.score,
        resources:{...faction.resources},
        available:faction.roster.filter(member=>member.status==="available").length,
        assigned:faction.roster.filter(member=>member.status==="assigned").length,
        deployed:faction.roster.filter(member=>member.status==="deployed").length,
        recovering:faction.roster.filter(member=>member.status==="recovering").length,
        wounded:faction.roster.filter(member=>member.healthStatus==="wounded").length,
        dead:faction.roster.filter(member=>member.healthStatus==="dead").length,
        roster:faction.roster.map(cloneRosterMember)
      })),
      needs:[...this.needs.values()].map(cloneNeed),
      operations:[...this.operations.values()].map(cloneOperation),
      candidates:this.getCandidateScores(),
      activeOperationIds:this.activeOperations().map(operation=>operation.id),
      history:this.history.map(entry=>({...entry,data:{...entry.data}}))
    };
  }

  #selectTeam(faction,need){
    const available=faction.roster.filter(member=>member.status==="available"&&member.healthStatus!=="dead");
    if(available.length<this.teamSize)return[];
    const keys=roleCapabilitiesForNeed(need);
    const specialist=[...available].sort((a,b)=>
      deploymentUtility(b,keys.specialist)-deploymentUtility(a,keys.specialist)||
      deploymentUtility(b,"technicalWork")-deploymentUtility(a,"technicalWork")||a.id.localeCompare(b.id)
    )[0];
    const remaining=available.filter(member=>member!==specialist);
    const lead=[...remaining].sort((a,b)=>
      (deploymentUtility(b,keys.lead)+deploymentUtility(b,"navigation")*.45+deploymentUtility(b,"scouting")*.35)-
      (deploymentUtility(a,keys.lead)+deploymentUtility(a,"navigation")*.45+deploymentUtility(a,"scouting")*.35)||a.id.localeCompare(b.id)
    )[0];
    const securityPool=remaining.filter(member=>member!==lead);
    const security=[...securityPool].sort((a,b)=>
      (deploymentUtility(b,keys.support)+deploymentUtility(b,"observation")*.45)-
      (deploymentUtility(a,keys.support)+deploymentUtility(a,"observation")*.45)||a.id.localeCompare(b.id)
    )[0];
    const selected=[lead,specialist,security].filter(Boolean);
    for(const member of available)if(selected.length<this.teamSize&&!selected.includes(member))selected.push(member);
    return selected.slice(0,this.teamSize);
  }

  #assignResponsibilities(team,need){
    const [lead,specialist,security]=team;
    const specialistLabel=need.kind==="recover_supplies"?"supply_handler":need.kind==="survey_route"?"survey_recorder":"objective_specialist";
    return[
      lead?{rosterId:lead.id,responsibility:need.kind==="survey_route"?"route_scout":"approach_lead"}:null,
      specialist?{rosterId:specialist.id,responsibility:specialistLabel}:null,
      security?{rosterId:security.id,responsibility:"local_security"}:null
    ].filter(Boolean);
  }

  #teamCapabilityFit(team,needs){
    if(!team.length)return 0;
    let weighted=0,total=0;
    for(const [key,weight] of Object.entries(needs??{})){
      weighted+=Math.max(...team.map(member=>capabilityScore(member,key)),0)*weight;
      total+=weight;
    }
    return total>0?clamp(weighted/total):1;
  }

  #record(type,time,data={}){
    const entry={type,time,data:{...data}};
    this.history.push(entry);
    if(this.history.length>360)this.history.splice(0,this.history.length-360);
    this.decisionLog?.record?.({type,time,teamId:data.teamId??null,data:{...data}});
  }
}
