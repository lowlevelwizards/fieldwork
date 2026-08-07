import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { RepositionForResponsibilityAction } from "../actions/reposition-for-responsibility-action.js";
import { CooperativeAssistAction } from "../actions/cooperative-assist-action.js";
import { CrossTeamAidAction } from "../actions/cross-team-aid-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function stableAngle(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%6283)/1000;
}

function teamCentroid(actors){
  if(!actors.length)return null;
  return{x:actors.reduce((sum,actor)=>sum+actor.x,0)/actors.length,y:actors.reduce((sum,actor)=>sum+actor.y,0)/actors.length};
}

function provenance({actor,role,agenda,operation,source,interaction=null}){
  return{
    owner:"local_autonomy_runtime",source,teamId:actor.teamId,
    operationId:actor.operationId,missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,
    procedureId:role?.procedureId??null,phaseId:role?.phase?.id??null,roleId:role?.roleId??null,roleLabel:role?.roleLabel??role?.label??null,
    objectiveId:operation?.objectiveId??interaction?.objectiveId??null,
    subjectTeamId:interaction?.subjectTeamId??null,contractId:interaction?.contractId??null
  };
}

function untreatedCasualty(actors){
  return actors.filter(actor=>!actor.medical?.dead&&(
    actor.medical?.unconscious||["critical","serious","wounded"].includes(actor.medical?.condition)||
    (actor.medical?.wounds??[]).some(wound=>!wound.controlled)
  )).sort((a,b)=>{
    const rank=condition=>condition==="critical"?4:condition==="serious"?3:condition==="wounded"?2:1;
    return rank(b.medical?.condition)-rank(a.medical?.condition);
  })[0]??null;
}

export class LocalAutonomyRuntime{
  constructor({scheduler,brain=null,arbiter=null,decisionLog=null}={}){
    this.scheduler=scheduler;
    this.brain=brain??arbiter;
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,teamProcedures,teamAgenda,teamInteractions=null,roleActions=null,now=0}={}){
    if(game?.scenarioMode!=="live"){this.byActor.clear();return;}
    const live=new Set();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious||!actor.operationId)continue;
      // 3.2B: local autonomy is now a continuous low-authority candidate source.
      // It no longer disappears merely because another substantive action is
      // active; channel ownership and centralized replanning decide whether a
      // local improvement may coexist with or replace the incumbent.
      const activeActionTypes=(this.scheduler?.getActions?.(actor.id)??[]).map(action=>action.type);
      const assignedAction=roleActions?.get?.(actor.id)?.actionType??null;
      live.add(actor.id);
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const operation=game?.livingSandbox?.getOperation?.(actor.operationId)??null;
      const teammates=(game?.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&candidate.id!==actor.id&&!candidate.medical?.dead&&!candidate.medical?.unconscious);
      const centroid=teamCentroid([actor,...teammates]);
      const nearest=teammates.slice().sort((left,right)=>distance(actor,left)-distance(actor,right))[0]??null;
      const interaction=teamInteractions?.getBestForTeam?.(actor.teamId)??null;
      const subjectActors=interaction?(game?.actors??[]).filter(candidate=>candidate.teamId===interaction.subjectTeamId&&!candidate.medical?.dead):[];
      const subjectCentroid=teamCentroid(subjectActors);
      const roleLabel=role?.roleLabel??role?.label??"Field Operator";
      const specialistAnchored=Boolean(role?.roleId==="objective_specialist"&&actor.aiV2Objective?.status==="positioned");
      const common={
        task:operation?.label??actor.currentTask,
        roleId:role?.roleId??null,
        roleLabel,
        procedureId:role?.procedureId??null,
        procedureLabel:role?.procedureLabel??null,
        phaseId:role?.phase?.id??null,
        phaseLabel:role?.phase?.label??null
      };

      let action=null,score=.25,reason="",source="ambient_role_fulfillment",record=null,urgency=.12;
      const patient=interaction?.type==="casualty_aid"?untreatedCasualty(subjectActors):null;
      const medicalCapability=Number(actor.aiV2Capabilities?.medicalCare??actor.aiV2Capabilities?.medical??0);
      if(patient&&medicalCapability>.7&&distance(actor,patient)<620){
        reason=`${roleLabel} recognizes a nearby team casualty and can provide one bounded stabilization without taking over their evacuation.`;
        action=new CrossTeamAidAction({actorId:actor.id,directive:{...common,patientId:patient.id,subjectTeamId:patient.teamId,contractId:interaction.contractId,reason,provenance:provenance({actor,role,agenda,operation,source:"cross_team_casualty_aid",interaction})}});
        score=.88;urgency=.74;source="cross_team_casualty_aid";record={subjectTeamId:patient.teamId,patientId:patient.id,contractId:interaction.contractId};
      }else if(interaction&&["parallel_work","shared_security"].includes(interaction.type)&&interaction.objectiveId&&role?.roleId==="approach_lead"&&["HoldReady","ObserveSector"].includes(assignedAction)&&interaction.objectivePoint&&distance(actor,interaction.objectivePoint)<430){
        const angle=stableAngle(`${actor.id}:${interaction.contractId}`);
        const assistPoint={x:interaction.objectivePoint.x+Math.cos(angle)*64,y:interaction.objectivePoint.y+Math.sin(angle)*64};
        reason=`${roleLabel} recognizes compatible work and contributes bounded assistance while the other team retains objective ownership.`;
        action=new CooperativeAssistAction({actorId:actor.id,directive:{...common,objectiveId:interaction.objectiveId,objectivePoint:{...interaction.objectivePoint},assistPoint,subjectTeamId:interaction.subjectTeamId,contractId:interaction.contractId,reason,provenance:provenance({actor,role,agenda,operation,source:"cooperative_objective_assist",interaction})}});
        score=.58;urgency=.2;source="cooperative_objective_assist";record={subjectTeamId:interaction.subjectTeamId,objectiveId:interaction.objectiveId,contractId:interaction.contractId};
      }else if(!specialistAnchored&&interaction&&["pass_through","parallel_work","shared_security"].includes(interaction.type)&&role?.roleId!=="objective_specialist"&&subjectCentroid&&distance(actor,subjectCentroid)<150){
        let dx=actor.x-subjectCentroid.x,dy=actor.y-subjectCentroid.y;const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;
        const side=(stableAngle(`${actor.teamId}:${interaction.subjectTeamId}`)>Math.PI)?1:-1;
        const destination={x:actor.x+dx*94-dy*side*48,y:actor.y+dy*94+dx*side*48};
        reason=`${roleLabel} recognizes ${interaction.subjectTeamId} and moves around the team instead of crowding or challenging it.`;
        action=new RepositionForResponsibilityAction({actorId:actor.id,directive:{...common,destination,initialDistance:distance(actor,destination),reason,policy:{speedMultiplier:.58,arrivalRadius:16},provenance:provenance({actor,role,agenda,operation,source:"inter_team_deconfliction",interaction})}});
        score=.7;urgency=.3;source="inter_team_deconfliction";record={destination:{...destination},subjectTeamId:interaction.subjectTeamId,contractId:interaction.contractId};
      }else if(interaction?.type==="shared_security"&&role?.roleId==="local_security"&&subjectCentroid){
        const anchor=interaction.objectivePoint??subjectCentroid;
        const away={x:actor.x+(actor.x-anchor.x)*2.4,y:actor.y+(actor.y-anchor.y)*2.4};
        reason=`${roleLabel} recognizes a compatible team at the worksite and covers an outward sector rather than duplicating or confronting their position.`;
        action=new HoldReadyAction({actorId:actor.id,directive:{...common,label:"Shared worksite security",focus:away,reason,provenance:provenance({actor,role,agenda,operation,source:"shared_security",interaction})}});
        score=.52;urgency=.16;source="shared_security";record={focus:{...away},subjectTeamId:interaction.subjectTeamId,contractId:interaction.contractId};
      }else if(role&&!specialistAnchored&&centroid&&distance(actor,centroid)>440){
        const angle=stableAngle(actor.id);
        const destination={x:centroid.x+Math.cos(angle)*72,y:centroid.y+Math.sin(angle)*72};
        reason=`${roleLabel} is separated from the active team and autonomously regroups without changing the mission.`;
        action=new RepositionForResponsibilityAction({actorId:actor.id,directive:{...common,destination,initialDistance:distance(actor,destination),reason,policy:{speedMultiplier:.72,arrivalRadius:18},provenance:provenance({actor,role,agenda,operation,source:"local_cohesion"})}});
        score=.68;urgency=.28;source="local_cohesion";record={destination:{...destination}};
      }else if(role&&!specialistAnchored&&nearest&&distance(actor,nearest)<52){
        let dx=actor.x-nearest.x,dy=actor.y-nearest.y;const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;
        const destination={x:actor.x+dx*88,y:actor.y+dy*88};
        reason=`${roleLabel} is crowding ${nearest.name??"a teammate"} and autonomously widens spacing while preserving responsibility.`;
        action=new RepositionForResponsibilityAction({actorId:actor.id,directive:{...common,destination,initialDistance:distance(actor,destination),reason,policy:{speedMultiplier:.58,arrivalRadius:14},provenance:provenance({actor,role,agenda,operation,source:"local_spacing"})}});
        score=.56;source="local_spacing";record={destination:{...destination},nearestActorId:nearest.id};
      }else{
        const angle=stableAngle(`${actor.id}:${Math.floor(now/5)}`);
        const anchor=operation?.objectivePoint??centroid??{x:actor.x,y:actor.y};
        const radius=role?.roleId==="local_security"?280:190;
        const focus={x:anchor.x+Math.cos(angle)*radius,y:anchor.y+Math.sin(angle)*radius};
        reason=role?`${roleLabel} uses unclaimed attention time to scan around the assigned responsibility.`:"The operator uses unclaimed attention time to remain oriented to the active mission area.";
        action=new HoldReadyAction({actorId:actor.id,directive:{...common,label:role?`${role.label} local scan`:"Local mission scan",focus,reason,provenance:provenance({actor,role,agenda,operation,source})}});
        score=role?.roleId==="local_security"?.42:.25;record={focus:{...focus}};
      }

      this.brain?.submit?.({
        actorId:actor.id,action,score,urgency,
        authorityTier:source==="cross_team_casualty_aid"?ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN:role?ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT:ACTION_AUTHORITY_TIERS.AMBIENT_AUTONOMY,
        authorityLabel:source==="cross_team_casualty_aid"?"Supporting team concern":role?"Local responsibility improvement":"Ambient autonomy",
        reason,source:"local_autonomy_runtime",operationId:actor.operationId,
        missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,supportingIntentId:interaction?.type??agenda?.supporting?.intentId??null,
        procedureId:role?.procedureId??null,roleId:role?.roleId??null
      });
      this.byActor.set(actor.id,{actorId:actor.id,operationId:actor.operationId,roleId:role?.roleId??null,kind:source,reason,lastEvaluatedAt:now,activeActionTypes,...record});
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
  }

  summary(){return[...this.byActor.values()].map(item=>({...item,activeActionTypes:[...(item.activeActionTypes??[])],focus:item.focus?{...item.focus}:null,destination:item.destination?{...item.destination}:null}));}
}
