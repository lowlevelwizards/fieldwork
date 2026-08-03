import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

function cloneDirective(directive={}){
  return{
    ...directive,
    slot:directive.slot?{
      ...directive.slot,
      point:{...directive.slot.point},
      obstacle:directive.slot.obstacle?{...directive.slot.obstacle}:null,
      threatPoint:directive.slot.threatPoint?{...directive.slot.threatPoint}:null,
      utility:directive.slot.utility?{...directive.slot.utility}:null
    }:null,
    provenance:directive.provenance?{...directive.provenance}:null
  };
}

export class HoldPositionAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"HoldPosition",
      actorId,
      purpose:normalized.reason??"Remain committed to the accepted directional cover slot",
      channels:[ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,
      displayPriority:42,
      metadata:{directive:normalized,provenance:normalized.provenance??null}
    });
    this.directive=normalized;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const claim=services?.positionSlots?.getForActor?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&claim?.slotId===this.directive?.slot?.id&&claim.status==="occupied");
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    const claim=services?.positionSlots?.getForActor?.(this.actorId);
    return Boolean(
      actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&
      role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&
      claim?.slotId===this.directive.slot.id&&claim.status==="occupied"
    );
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    actor.currentTask=this.directive.task??actor.currentTask;
    actor.currentAction=`Holding ${this.directive.roleLabel??"defensive position"}`;
    actor.procedureRole=this.directive.roleLabel??actor.procedureRole;
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    services.positionSlots?.renewActor?.(actor.id,{now,duration:30});
    services.positionSlots?.occupy?.(actor.id,{now,duration:30});
    const attention=services.attention.turnToward(actor,this.directive.slot.threatPoint,delta,{pose:"ready",turnRate:3.5});
    this.progress=1;
    actor.currentAction=attention.settled?`Holding ${this.directive.roleLabel??"defensive position"}`:"Orienting behind directional cover";
    actor.aiV2DefensivePosition={
      status:"holding",
      slotId:this.directive.slot.id,
      sourceObjectId:this.directive.slot.sourceObjectId,
      point:{...this.directive.slot.point},
      threatPoint:{...this.directive.slot.threatPoint},
      roleId:this.directive.roleId,
      roleLabel:this.directive.roleLabel,
      protection:this.directive.slot.utility?.protection??0,
      firingUtility:this.directive.slot.utility?.firing??0,
      observationUtility:this.directive.slot.utility?.observation??0,
      settled:attention.settled,
      committedAt:this.startedAt
    };
    return null;
  }
}
