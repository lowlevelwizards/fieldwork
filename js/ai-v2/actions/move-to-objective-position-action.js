import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class MoveToObjectivePositionAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"MoveToObjectivePosition",actorId,
      purpose:directive?.reason??"Move to the assigned objective approach position",
      channels:[ACTION_CHANNELS.LOCOMOTION],primary:true,displayPriority:58,
      metadata:{directive:{...directive},provenance:directive?.provenance??null}
    });
    this.directive={...directive,destination:directive?.destination?{...directive.destination}:null,policy:directive?.policy?{...directive.policy}:null};
    this.initialDistance=Math.max(1,directive?.initialDistance??1);
    this.claimed=false;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive.destination);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id===(this.directive.phaseId??"approach_objective"));
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    this.claimed=Boolean(context.services.destinationClaims.claim({
      actorId:this.actorId,point:this.directive.destination,purpose:`${this.directive.procedureId}:${this.directive.roleId}`,
      now,duration:3,radius:this.directive.policy?.claimSpacing??68
    })?.ok);
    if(actor){
      actor.currentTask=this.directive.task??actor.currentTask;
      actor.currentAction=this.claimed?`Approaching objective — ${this.directive.roleLabel}`:"Objective approach blocked";
      actor.procedureRole=this.directive.roleLabel??actor.procedureRole;
      actor.aiV2Objective={status:this.claimed?"approaching":"blocked",objectiveId:this.directive.objectiveId,roleId:this.directive.roleId,destination:{...this.directive.destination},progress:0};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.claimed)return{status:"failed",reason:"objective_destination_claim_rejected"};
    services.destinationClaims.renew(actor.id,{now,duration:3});
    const result=services.locomotion.moveToward(actor,this.directive.destination,delta,{
      game,speedMultiplier:this.directive.policy?.speedMultiplier??.68,
      arrivalRadius:this.directive.policy?.arrivalRadius??11,
      task:`Approaching objective — ${this.directive.roleLabel}`,pose:"walk"
    });
    const remaining=result.distance??0;
    this.progress=Math.max(0,Math.min(1,1-remaining/this.initialDistance));
    actor.aiV2Objective={status:result.arrived?"positioned":"approaching",objectiveId:this.directive.objectiveId,roleId:this.directive.roleId,destination:{...this.directive.destination},distance:remaining,progress:this.progress};
    if(result.failed){
      services.destinationClaims.release(actor.id,{now,reason:"objective_approach_failed"});
      return{status:"failed",reason:result.reason??"objective_approach_failed"};
    }
    if(!result.arrived)return null;
    services.destinationClaims.release(actor.id,{now,reason:"objective_position_reached"});
    services.locomotion.stop(actor);
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:this.directive.arrivalEvent??"objective_position_reached",now,data:{actorId:actor.id,roleId:this.directive.roleId,objectiveId:this.directive.objectiveId,...(this.directive.arrivalData??{})}});
    actor.currentAction=`Positioned — ${this.directive.roleLabel}`;
    return{status:"completed",reason:this.directive.arrivalEvent??"objective_position_reached",data:{roleId:this.directive.roleId,objectiveId:this.directive.objectiveId,...(this.directive.arrivalData??{})}};
  }
}
