import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class ApproachEvacuationCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"ApproachEvacuationCasualty",actorId,purpose:directive?.reason??"Reach the casualty before taking over transport",channels:[ACTION_CHANNELS.LOCOMOTION],primary:true,displayPriority:91,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,destination:directive?.destination?{...directive.destination}:null,policy:directive?.policy?{...directive.policy}:null};
    this.initialDistance=Math.max(1,directive?.initialDistance??1);
    this.destinationClaimed=false;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    const controller=services?.casualtyCare?.getController?.(casualty?.id);
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&this.directive.destination&&(!controller||controller===this.actorId));
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&["transport_leg","reassess_casualty","transfer_casualty"].includes(role?.phase?.id));
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    const claim=context.services.destinationClaims.claim({actorId:this.actorId,point:this.directive.destination,purpose:`${this.directive.procedureId}:approach_evacuation_casualty`,now,duration:2.5,radius:this.directive.policy?.claimSpacing??48});
    this.destinationClaimed=Boolean(claim?.ok);
    if(actor){
      actor.currentAction="Approaching evacuation casualty";
      actor.aiV2Evacuation={status:this.destinationClaimed?"approaching_casualty":"blocked",phase:"transport_leg",casualtyId:this.directive.casualtyId,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,destination:{...this.directive.destination},progress:0,startedAt:now};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};
    if(!this.destinationClaimed)return{status:"failed",reason:"evacuation_casualty_approach_claim_rejected"};

    const interactionRange=this.directive.interactionRange??82;
    const patientDistance=Math.hypot(casualty.x-actor.x,casualty.y-actor.y);
    if(patientDistance<=interactionRange){
      services.destinationClaims.release(actor.id,{now,reason:"evacuation_casualty_reached"});
      services.locomotion.stop(actor);
      actor.currentAction="Ready to take casualty";
      actor.aiV2Evacuation={status:"at_casualty",phase:"transport_leg",casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,distanceToCasualty:patientDistance,progress:1,completedAt:now};
      services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"evacuation_carrier_reached_casualty",now,data:{actorId:actor.id,casualtyId:casualty.id,routeId:this.directive.routeId,legIndex:this.directive.legIndex,distanceToCasualty:patientDistance}});
      return{status:"completed",reason:"evacuation_carrier_reached_casualty",data:{casualtyId:casualty.id,routeId:this.directive.routeId,legIndex:this.directive.legIndex,distanceToCasualty:patientDistance}};
    }

    services.destinationClaims.renew(actor.id,{now,duration:2.5});
    const result=services.locomotion.moveToward(actor,this.directive.destination,delta,{game,speedMultiplier:this.directive.policy?.speedMultiplier??.8,arrivalRadius:this.directive.policy?.arrivalRadius??10,task:"Reaching evacuation casualty",pose:"walk"});
    const distance=result.distance??0;
    this.progress=Math.max(0,Math.min(1,1-distance/this.initialDistance));
    actor.currentAction="Approaching evacuation casualty";
    actor.aiV2Evacuation={status:"approaching_casualty",phase:"transport_leg",casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,destination:{...this.directive.destination},distanceToCasualty:patientDistance,progress:this.progress,startedAt:this.startedAt};
    if(result.failed){
      services.destinationClaims.release(actor.id,{now,reason:"evacuation_casualty_approach_failed"});
      services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_evacuation_failed",now,data:{actorId:actor.id,phase:"transport_leg",legIndex:this.directive.legIndex,reason:result.reason}});
      return{status:"failed",reason:result.reason};
    }
    return null;
  }
  onInterrupted({services,now=0}={}){
    if(this.destinationClaimed)services?.destinationClaims?.release?.(this.actorId,{now,reason:"evacuation_casualty_approach_interrupted"});
    this.destinationClaimed=false;
  }

  onCancelled(context={}){this.onInterrupted(context);}

}
