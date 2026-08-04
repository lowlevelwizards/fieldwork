import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class ApproachCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"ApproachCasualty",actorId,purpose:directive?.reason??"Reach the assigned casualty",channels:[ACTION_CHANNELS.LOCOMOTION],primary:true,displayPriority:70,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,destination:directive?.destination?{...directive.destination}:null,policy:directive?.policy?{...directive.policy}:null};
    this.initialDistance=directive?.initialDistance??0;
    this.claimed=false;
  }
  canStart({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&this.directive.destination);}
  canContinue({game,services}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const role=services?.teamProcedures?.getActorRole?.(this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="reach_casualty");}
  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    const claim=context.services.destinationClaims.claim({actorId:this.actorId,point:this.directive.destination,purpose:`${this.directive.procedureId}:approach_casualty`,now,duration:2.5,radius:48});
    this.claimed=Boolean(claim?.ok);
    if(actor){actor.currentAction="Approaching casualty";actor.aiV2Recovery={status:this.claimed?"approaching":"blocked",phase:"reach_casualty",casualtyId:this.directive.casualtyId,destination:{...this.directive.destination},progress:0,startedAt:now};}
  }
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.claimed)return{status:"failed",reason:"approach_destination_claim_rejected"};
    services.destinationClaims.renew(actor.id,{now,duration:2.5});
    const result=services.locomotion.moveToward(actor,this.directive.destination,delta,{game,speedMultiplier:this.directive.policy?.speedMultiplier??.78,arrivalRadius:this.directive.policy?.arrivalRadius??10,task:"Reaching casualty",pose:"walk"});
    const distance=result.distance??0;this.progress=Math.max(0,Math.min(1,1-distance/Math.max(1,this.initialDistance||distance)));
    actor.aiV2Recovery={status:result.arrived?"at_casualty":"approaching",phase:"reach_casualty",casualtyId:this.directive.casualtyId,destination:{...this.directive.destination},progress:this.progress,distance,startedAt:this.startedAt};
    if(result.failed){services.destinationClaims.release(actor.id,{now,reason:"casualty_approach_failed"});services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_recovery_failed",now,data:{actorId:actor.id,phase:"reach_casualty",reason:result.reason}});return{status:"failed",reason:result.reason};}
    if(!result.arrived)return null;
    services.destinationClaims.release(actor.id,{now,reason:"casualty_reached"});services.locomotion.stop(actor);actor.currentAction="At casualty";
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_reached",now,data:{actorId:actor.id,casualtyId:this.directive.casualtyId}});
    return{status:"completed",reason:"casualty_reached"};
  }
}
