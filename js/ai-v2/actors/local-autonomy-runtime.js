import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

function stableAngle(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%6283)/1000;
}

export class LocalAutonomyRuntime{
  constructor({scheduler,arbiter,decisionLog=null}={}){
    this.scheduler=scheduler;
    this.arbiter=arbiter;
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,teamProcedures,teamAgenda,now=0}={}){
    if(game?.scenarioMode!=="live"){this.byActor.clear();return;}
    const live=new Set();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious||!actor.operationId)continue;
      if(this.scheduler?.getActions?.(actor.id)?.length)continue;
      live.add(actor.id);
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const operation=game?.livingSandbox?.getOperation?.(actor.operationId)??null;
      const angle=stableAngle(`${actor.id}:${Math.floor(now/5)}`);
      const anchor=operation?.objectivePoint??{x:actor.x,y:actor.y};
      const radius=role?.roleId==="local_security"?280:190;
      const focus={x:anchor.x+Math.cos(angle)*radius,y:anchor.y+Math.sin(angle)*radius};
      const directive={
        task:operation?.label??actor.currentTask,
        label:role?`${role.label} local scan`:"Local mission scan",
        focus,
        roleId:role?.roleId??null,
        roleLabel:role?.roleLabel??role?.label??"Field Operator",
        procedureId:role?.procedureId??null,
        procedureLabel:role?.procedureLabel??null,
        phaseId:role?.phase?.id??null,
        phaseLabel:role?.phase?.label??null,
        reason:role
          ?`${role.roleLabel??role.label} uses unclaimed attention time to scan around the assigned responsibility.`
          :"The operator uses unclaimed attention time to remain oriented to the active mission area.",
        provenance:{
          owner:"local_autonomy_runtime",source:"ambient_role_fulfillment",teamId:actor.teamId,
          operationId:actor.operationId,missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,
          procedureId:role?.procedureId??null,phaseId:role?.phase?.id??null,roleId:role?.roleId??null,roleLabel:role?.roleLabel??role?.label??null
        }
      };
      const action=new HoldReadyAction({actorId:actor.id,directive});
      this.arbiter?.submit?.({
        actorId:actor.id,action,score:role?.roleId==="local_security"?.42:.25,urgency:.12,
        authorityTier:role?ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT:ACTION_AUTHORITY_TIERS.AMBIENT_AUTONOMY,
        authorityLabel:role?"Local responsibility improvement":"Ambient autonomy",
        reason:directive.reason,source:"local_autonomy_runtime",operationId:actor.operationId,
        missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,supportingIntentId:agenda?.supporting?.intentId??null,
        procedureId:role?.procedureId??null,roleId:role?.roleId??null
      });
      this.byActor.set(actor.id,{actorId:actor.id,operationId:actor.operationId,roleId:role?.roleId??null,focus:{...focus},reason:directive.reason,lastEvaluatedAt:now});
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
  }

  summary(){return[...this.byActor.values()].map(item=>({...item,focus:{...item.focus}}));}
}
