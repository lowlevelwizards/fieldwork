import { AIV2Action } from "./action.js?v=20l-silent-withdrawal-deescalation-20260802";
import { ACTION_CHANNELS } from "./action-channels.js?v=20l-silent-withdrawal-deescalation-20260802";

function cloneDirective(directive={}){
  return{
    ...directive,
    destination:directive.destination?{...directive.destination}:null,
    sector:directive.sector?{...directive.sector}:null,
    policy:directive.policy?{...directive.policy}:null,
    provenance:directive.provenance?{...directive.provenance}:null,
    positionEvaluation:directive.positionEvaluation?{
      ...directive.positionEvaluation,
      position:directive.positionEvaluation.position?{...directive.positionEvaluation.position}:null,
      reasons:[...(directive.positionEvaluation.reasons??[])]
    }:null
  };
}

export class RepositionForResponsibilityAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"RepositionForResponsibility",
      actorId,
      purpose:normalized.reason??"Move to a position that can fulfill the assigned responsibility",
      channels:[ACTION_CHANNELS.LOCOMOTION],
      primary:true,
      displayPriority:48,
      metadata:{directive:normalized,provenance:normalized.provenance??null}
    });
    this.directive=normalized;
    this.elapsed=0;
    this.lastDistance=Infinity;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive?.destination);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor||actor.medical?.dead||actor.medical?.unconscious||!this.directive?.destination)return false;
    const role=services?.teamProcedures?.getActorRole?.(actor.id);
    return Boolean(role&&role.roleId===this.directive.roleId&&role.procedureId===this.directive.procedureId&&role.permissions?.relocate);
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(actor){
      actor.aiV2Reposition={
        status:"moving",
        destination:{...this.directive.destination},
        reason:this.purpose,
        roleId:this.directive.roleId,
        roleLabel:this.directive.roleLabel,
        procedureId:this.directive.procedureId,
        startedAt:now
      };
      actor.currentAction="Repositioning for assigned responsibility";
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=delta;
    services.destinationClaims?.renew?.(actor.id,{now,duration:2.5});
    const result=services.locomotion.moveToward(actor,this.directive.destination,delta,{
      game,
      speedMultiplier:this.directive.policy?.speedMultiplier??.58,
      arrivalRadius:this.directive.policy?.arrivalRadius??10,
      task:`Repositioning — ${this.directive.roleLabel??"responsibility"}`,
      pose:"walk"
    });
    this.lastDistance=result.distance??this.lastDistance;
    const totalDistance=Math.max(1,this.directive.initialDistance??this.lastDistance);
    this.progress=Math.max(0,Math.min(1,1-this.lastDistance/totalDistance));
    actor.aiV2Reposition={
      status:result.arrived?"arrived":"moving",
      destination:{...this.directive.destination},
      reason:this.purpose,
      failureReason:this.directive.failureReason??null,
      roleId:this.directive.roleId,
      roleLabel:this.directive.roleLabel,
      procedureId:this.directive.procedureId,
      progress:this.progress,
      distance:this.lastDistance,
      startedAt:this.startedAt
    };
    if(result.failed)return{status:"failed",reason:result.reason??"locomotion_failed"};
    if(result.arrived){
      services.destinationClaims?.release?.(actor.id,{now,reason:"responsibility_position_reached"});
      services.locomotion.stop(actor);
      actor.currentAction=`Resuming ${this.directive.roleLabel??"assigned responsibility"}`;
      return{status:"completed",reason:"responsibility_position_reached",data:{destination:{...this.directive.destination}}};
    }
    return null;
  }
}
