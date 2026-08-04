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
    policy:directive.policy?{...directive.policy}:null,
    provenance:directive.provenance?{...directive.provenance}:null
  };
}

export class MoveToPositionSlotAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"MoveToPositionSlot",
      actorId,
      purpose:normalized.reason??"Occupy the assigned directional cover slot",
      channels:[ACTION_CHANNELS.LOCOMOTION],
      primary:true,
      displayPriority:52,
      metadata:{directive:normalized,provenance:normalized.provenance??null}
    });
    this.directive=normalized;
    this.lastDistance=Infinity;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const claim=services?.positionSlots?.getForActor?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive?.slot?.point&&claim?.slotId===this.directive.slot.id);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    const claim=services?.positionSlots?.getForActor?.(this.actorId);
    return Boolean(
      actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&
      role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role.permissions?.relocate&&
      claim?.slotId===this.directive.slot.id
    );
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    actor.currentTask=this.directive.task??actor.currentTask;
    actor.currentAction=`Moving to ${this.directive.roleLabel??"defensive position"}`;
    actor.procedureRole=this.directive.roleLabel??actor.procedureRole;
    actor.aiV2DefensivePosition={
      status:"moving",
      slotId:this.directive.slot.id,
      sourceObjectId:this.directive.slot.sourceObjectId,
      point:{...this.directive.slot.point},
      threatPoint:{...this.directive.slot.threatPoint},
      roleId:this.directive.roleId,
      roleLabel:this.directive.roleLabel,
      protection:this.directive.slot.utility?.protection??0,
      startedAt:now
    };
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    services.positionSlots?.renewActor?.(actor.id,{now,duration:8});
    const destination=this.directive.slot.point;
    const result=services.locomotion.moveToward(actor,destination,delta,{
      game,
      speedMultiplier:this.directive.policy?.speedMultiplier??.62,
      arrivalRadius:this.directive.policy?.arrivalRadius??10,
      task:`Occupying cover — ${this.directive.roleLabel??"defensive position"}`,
      pose:"ready"
    });
    this.lastDistance=result.distance??this.lastDistance;
    const totalDistance=Math.max(1,this.directive.initialDistance??this.lastDistance);
    this.progress=Math.max(0,Math.min(1,1-this.lastDistance/totalDistance));
    actor.aiV2DefensivePosition={
      status:result.arrived?"occupied":"moving",
      slotId:this.directive.slot.id,
      sourceObjectId:this.directive.slot.sourceObjectId,
      point:{...destination},
      threatPoint:{...this.directive.slot.threatPoint},
      roleId:this.directive.roleId,
      roleLabel:this.directive.roleLabel,
      protection:this.directive.slot.utility?.protection??0,
      progress:this.progress,
      distance:this.lastDistance,
      startedAt:this.startedAt
    };
    if(result.failed)return{status:"failed",reason:result.reason??"position_slot_move_failed"};
    if(!result.arrived)return null;
    services.positionSlots?.occupy?.(actor.id,{now,duration:30});
    services.locomotion.stop(actor);
    services.teamProcedures?.notifyEvent?.({
      teamId:actor.teamId,
      event:"defensive_slot_occupied",
      now,
      data:{actorId:actor.id,roleId:this.directive.roleId,slotId:this.directive.slot.id}
    });
    actor.currentAction=`Holding ${this.directive.roleLabel??"defensive position"}`;
    return{status:"completed",reason:"defensive_slot_occupied",data:{roleId:this.directive.roleId,slotId:this.directive.slot.id}};
  }
}
