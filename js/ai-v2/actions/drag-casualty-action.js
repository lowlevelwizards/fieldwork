import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class DragCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"DragCasualty",actorId,purpose:directive?.reason??"Move the casualty to the recovery point",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:86,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,destination:directive?.destination?{...directive.destination}:null,policy:directive?.policy?{...directive.policy}:null};this.claimed=false;this.patientClaimed=false;this.initialDistance=directive?.initialDistance??0;
  }
  canStart({game,services}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&this.directive.destination&&!services?.casualtyCare?.getController?.(casualty.id));}
  canContinue({game,services}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const role=services?.teamProcedures?.getActorRole?.(this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="move_to_recovery");}
  start(now,context){
    super.start(now,context);const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);const casualty=context.game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    this.patientClaimed=Boolean(context.services.casualtyCare.claimPatient({patientId:casualty?.id,actorId:this.actorId})?.ok);
    this.claimed=Boolean(context.services.destinationClaims.claim({actorId:this.actorId,point:this.directive.destination,purpose:`${this.directive.procedureId}:drag_casualty`,now,duration:3,radius:this.directive.policy?.claimSpacing??62})?.ok);
    if(actor){actor.currentAction="Beginning casualty drag";actor.aiV2Recovery={status:this.patientClaimed&&this.claimed?"dragging":"blocked",phase:"move_to_recovery",casualtyId:this.directive.casualtyId,destination:{...this.directive.destination},progress:0,startedAt:now};}
  }
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};
    if(!this.patientClaimed||!this.claimed)return{status:"failed",reason:!this.patientClaimed?"patient_claim_rejected":"recovery_point_claim_rejected"};
    services.destinationClaims.renew(actor.id,{now,duration:3});
    const result=services.casualtyCare.dragToward({game,responder:actor,patient:casualty,destination:this.directive.destination,delta,locomotion:services.locomotion,speedMultiplier:this.directive.policy?.speedMultiplier??.44,arrivalRadius:this.directive.policy?.arrivalRadius??14});
    const distance=result.distance??0;this.progress=Math.max(0,Math.min(1,1-distance/Math.max(1,this.initialDistance||distance)));
    actor.currentAction="Dragging casualty to recovery point";actor.aiV2Recovery={status:result.arrived?"at_recovery_point":"dragging",phase:"move_to_recovery",casualtyId:casualty.id,destination:{...this.directive.destination},progress:this.progress,distance,startedAt:this.startedAt};
    if(result.failed){this.#release(services,actor,casualty,now,"drag_failed");services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_recovery_failed",now,data:{actorId:actor.id,phase:"move_to_recovery",reason:result.reason}});return{status:"failed",reason:result.reason};}
    if(!result.arrived)return null;
    this.#release(services,actor,casualty,now,"recovery_point_reached");services.locomotion.stop(actor);actor.currentAction="Casualty at recovery point";
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_moved_to_recovery",now,data:{actorId:actor.id,casualtyId:casualty.id,destination:{...this.directive.destination}}});
    return{status:"completed",reason:"casualty_moved_to_recovery"};
  }
  #release(services,actor,casualty,now,reason){services.destinationClaims.release(actor.id,{now,reason});services.casualtyCare.releasePatient(casualty.id,actor.id);services.casualtyCare.releaseDrag({patient:casualty});}
}
