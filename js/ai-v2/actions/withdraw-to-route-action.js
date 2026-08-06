import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

function cloneDirective(directive={}){
  return{
    ...directive,
    destination:directive.destination?{...directive.destination}:null,
    policy:directive.policy?{...directive.policy}:null,
    provenance:directive.provenance?{...directive.provenance}:null
  };
}

export class WithdrawToRouteAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"WithdrawToRoute",
      actorId,
      purpose:normalized.reason??"Move along the procedure-authorized withdrawal route",
      channels:[ACTION_CHANNELS.LOCOMOTION],
      primary:true,
      displayPriority:52,
      metadata:{directive:normalized,provenance:normalized.provenance??null}
    });
    this.directive=normalized;
    this.elapsed=0;
    this.lastDistance=Infinity;
    this.claimAccepted=false;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive?.destination);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor||actor.medical?.dead||actor.medical?.unconscious||!this.directive?.destination)return false;
    const role=services?.teamProcedures?.getActorRole?.(actor.id);
    return Boolean(
      role&&
      role.roleId===this.directive.roleId&&
      role.procedureId===this.directive.procedureId&&
      role.phase?.id===this.directive.phaseId&&
      role.permissions?.relocate
    );
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    const claim=context?.services?.destinationClaims?.claim?.({
      actorId:this.actorId,
      point:this.directive.destination,
      purpose:`${this.directive.procedureId}:${this.directive.roleId}:withdrawal`,
      now,
      duration:2.5,
      radius:this.directive.policy?.claimSpacing??68
    });
    this.claimAccepted=Boolean(claim?.ok);
    if(actor){
      actor.aiV2Withdrawal={
        status:this.claimAccepted?"moving":"waiting_for_route",
        destination:{...this.directive.destination},
        reason:this.purpose,
        roleId:this.directive.roleId,
        roleLabel:this.directive.roleLabel,
        procedureId:this.directive.procedureId,
        stageId:this.directive.phaseId,
        startedAt:now,
        progress:0
      };
      actor.currentAction="Withdrawing along assigned route";
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.claimAccepted){
      services?.teamProcedures?.notifyEvent?.({
        teamId:actor.teamId,event:"withdrawal_move_failed",now,
        data:{actorId:actor.id,roleId:this.directive.roleId,reason:"destination_claim_rejected"}
      });
      return{status:"failed",reason:"destination_claim_rejected"};
    }

    this.elapsed+=delta;
    services.destinationClaims?.renew?.(actor.id,{now,duration:2.5});
    const result=services.locomotion.moveToward(actor,this.directive.destination,delta,{
      game,
      speedMultiplier:this.directive.policy?.speedMultiplier??.62,
      arrivalRadius:this.directive.policy?.arrivalRadius??12,
      task:`Silent withdrawal — ${this.directive.roleLabel??"assigned mover"}`,
      pose:"walk"
    });
    this.lastDistance=result.distance??this.lastDistance;
    const totalDistance=Math.max(1,this.directive.initialDistance??this.lastDistance);
    this.progress=Math.max(0,Math.min(1,1-this.lastDistance/totalDistance));
    actor.aiV2Withdrawal={
      status:result.arrived?"arrived":"moving",
      destination:{...this.directive.destination},
      reason:this.purpose,
      roleId:this.directive.roleId,
      roleLabel:this.directive.roleLabel,
      procedureId:this.directive.procedureId,
      stageId:this.directive.phaseId,
      progress:this.progress,
      distance:this.lastDistance,
      startedAt:this.startedAt
    };

    if(result.failed){
      services.destinationClaims?.release?.(actor.id,{now,reason:"withdrawal_locomotion_failed"});
      services.teamProcedures?.notifyEvent?.({
        teamId:actor.teamId,event:"withdrawal_move_failed",now,
        data:{actorId:actor.id,roleId:this.directive.roleId,reason:result.reason??"locomotion_failed"}
      });
      return{status:"failed",reason:result.reason??"locomotion_failed"};
    }
    if(result.arrived){
      services.destinationClaims?.release?.(actor.id,{now,reason:"withdrawal_stage_reached"});
      services.locomotion.stop(actor);
      actor.currentAction=`Reached ${this.directive.routeLabel??"withdrawal route"}`;
      services.teamProcedures?.notifyEvent?.({
        teamId:actor.teamId,event:"withdrawal_stage_completed",now,
        data:{actorId:actor.id,roleId:this.directive.roleId,phaseId:this.directive.phaseId,destination:{...this.directive.destination}}
      });
      return{status:"completed",reason:"withdrawal_stage_reached",data:{destination:{...this.directive.destination},roleId:this.directive.roleId}};
    }
    return null;
  }
  onInterrupted({services,now=0}={}){
    if(this.claimAccepted)services?.destinationClaims?.release?.(this.actorId,{now,reason:"withdrawal_interrupted"});
    this.claimAccepted=false;
  }

  onCancelled(context={}){this.onInterrupted(context);}

}
