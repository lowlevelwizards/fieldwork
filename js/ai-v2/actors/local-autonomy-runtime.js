import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { RepositionForResponsibilityAction } from "../actions/reposition-for-responsibility-action.js";
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

function provenance({actor,role,agenda,operation,source}){
  return{
    owner:"local_autonomy_runtime",source,teamId:actor.teamId,
    operationId:actor.operationId,missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,
    procedureId:role?.procedureId??null,phaseId:role?.phase?.id??null,roleId:role?.roleId??null,roleLabel:role?.roleLabel??role?.label??null,
    objectiveId:operation?.objectiveId??null
  };
}

export class LocalAutonomyRuntime{
  constructor({scheduler,arbiter,decisionLog=null}={}){
    this.scheduler=scheduler;
    this.arbiter=arbiter;
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,teamProcedures,teamAgenda,roleActions=null,now=0}={}){
    if(game?.scenarioMode!=="live"){this.byActor.clear();return;}
    const live=new Set();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious||!actor.operationId)continue;
      if(this.scheduler?.getActions?.(actor.id)?.length)continue;
      const assignedAction=roleActions?.get?.(actor.id)?.actionType??null;
      if(assignedAction&&!['HoldReady','ObserveSector'].includes(assignedAction))continue;
      live.add(actor.id);
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const operation=game?.livingSandbox?.getOperation?.(actor.operationId)??null;
      const teammates=(game?.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&candidate.id!==actor.id&&!candidate.medical?.dead&&!candidate.medical?.unconscious);
      const centroid=teamCentroid([actor,...teammates]);
      const nearest=teammates.sort((left,right)=>distance(actor,left)-distance(actor,right))[0]??null;
      const roleLabel=role?.roleLabel??role?.label??"Field Operator";
      const common={
        task:operation?.label??actor.currentTask,
        roleId:role?.roleId??null,
        roleLabel,
        procedureId:role?.procedureId??null,
        procedureLabel:role?.procedureLabel??null,
        phaseId:role?.phase?.id??null,
        phaseLabel:role?.phase?.label??null
      };

      let action=null,score=.25,reason="",source="ambient_role_fulfillment",record=null;
      if(role&&centroid&&distance(actor,centroid)>440){
        const angle=stableAngle(actor.id);
        const destination={x:centroid.x+Math.cos(angle)*72,y:centroid.y+Math.sin(angle)*72};
        reason=`${roleLabel} is separated from the active team and autonomously regroups without changing the mission.`;
        action=new RepositionForResponsibilityAction({actorId:actor.id,directive:{...common,destination,initialDistance:distance(actor,destination),reason,policy:{speedMultiplier:.72,arrivalRadius:18},provenance:provenance({actor,role,agenda,operation,source:"local_cohesion"})}});
        score=.68;source="local_cohesion";record={destination:{...destination}};
      }else if(role&&nearest&&distance(actor,nearest)<52){
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
        reason=role
          ?`${roleLabel} uses unclaimed attention time to scan around the assigned responsibility.`
          :"The operator uses unclaimed attention time to remain oriented to the active mission area.";
        action=new HoldReadyAction({actorId:actor.id,directive:{...common,label:role?`${role.label} local scan`:"Local mission scan",focus,reason,provenance:provenance({actor,role,agenda,operation,source})}});
        score=role?.roleId==="local_security"?.42:.25;record={focus:{...focus}};
      }

      this.arbiter?.submit?.({
        actorId:actor.id,action,score,urgency:source==="local_cohesion"?.28:.12,
        authorityTier:role?ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT:ACTION_AUTHORITY_TIERS.AMBIENT_AUTONOMY,
        authorityLabel:role?"Local responsibility improvement":"Ambient autonomy",
        reason,source:"local_autonomy_runtime",operationId:actor.operationId,
        missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,supportingIntentId:agenda?.supporting?.intentId??null,
        procedureId:role?.procedureId??null,roleId:role?.roleId??null
      });
      this.byActor.set(actor.id,{actorId:actor.id,operationId:actor.operationId,roleId:role?.roleId??null,kind:source,reason,lastEvaluatedAt:now,...record});
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
  }

  summary(){return[...this.byActor.values()].map(item=>({...item,focus:item.focus?{...item.focus}:null,destination:item.destination?{...item.destination}:null}));}
}
