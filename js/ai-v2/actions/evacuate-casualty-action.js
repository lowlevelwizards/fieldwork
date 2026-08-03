import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export class EvacuateCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"EvacuateCasualty",actorId,purpose:directive?.reason??"Transport the casualty along the secured route leg",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:92,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,destination:directive?.destination?{...directive.destination}:null,policy:directive?.policy?{...directive.policy}:null};
    this.initialDistance=Math.max(1,directive?.initialDistance??1);
    this.patientClaimed=false;
    this.destinationClaimed=false;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    const stamina=Number(actor?.aiV2Capabilities?.transportStamina??0);
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&this.directive.destination&&stamina>=(this.directive.minimumTransportStamina??.2)&&!services?.casualtyCare?.getController?.(casualty.id));
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="transport_leg");
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    const casualty=context.game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    this.patientClaimed=Boolean(context.services.casualtyCare.claimPatient({patientId:casualty?.id,actorId:this.actorId})?.ok);
    this.destinationClaimed=Boolean(context.services.destinationClaims.claim({actorId:this.actorId,point:this.directive.destination,purpose:`${this.directive.procedureId}:transport_leg_${this.directive.legIndex}`,now,duration:3,radius:this.directive.policy?.claimSpacing??68})?.ok);
    if(actor){
      actor.currentAction="Beginning casualty evacuation";
      actor.aiV2Evacuation={status:this.patientClaimed&&this.destinationClaimed?"transporting":"blocked",phase:"transport_leg",casualtyId:this.directive.casualtyId,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,waypointLabel:this.directive.waypointLabel,destination:{...this.directive.destination},progress:0,transportStamina:actor.aiV2Capabilities?.transportStamina??0,startedAt:now};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};
    if(!this.patientClaimed||!this.destinationClaimed)return{status:"failed",reason:!this.patientClaimed?"patient_claim_rejected":"evacuation_waypoint_claim_rejected"};
    services.destinationClaims.renew(actor.id,{now,duration:3});
    const result=services.casualtyCare.dragToward({game,responder:actor,patient:casualty,destination:this.directive.destination,delta,locomotion:services.locomotion,speedMultiplier:this.directive.policy?.speedMultiplier??.42,arrivalRadius:this.directive.policy?.arrivalRadius??14});
    const distance=result.distance??0;
    this.progress=Math.max(0,Math.min(1,1-distance/this.initialDistance));
    actor.currentAction="Evacuating casualty";
    actor.aiV2Evacuation={status:result.arrived?"at_route_waypoint":"transporting",phase:"transport_leg",casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,waypointLabel:this.directive.waypointLabel,destination:{...this.directive.destination},distance,progress:this.progress,transportStamina:actor.aiV2Capabilities?.transportStamina??0,startedAt:this.startedAt};
    if(result.failed){
      this.#release(services,actor,casualty,now,"evacuation_transport_failed");
      services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_evacuation_failed",now,data:{actorId:actor.id,phase:"transport_leg",legIndex:this.directive.legIndex,reason:result.reason}});
      return{status:"failed",reason:result.reason};
    }
    if(!result.arrived)return null;

    this.#release(services,actor,casualty,now,"evacuation_route_waypoint_reached");
    services.locomotion.stop(actor);
    actor.aiV2Capabilities??={};
    const before=clamp(actor.aiV2Capabilities.transportStamina??0);
    const cost=clamp(this.directive.staminaCost??.35);
    const after=clamp(before-cost);
    actor.aiV2Capabilities.transportStamina=after;
    actor.currentAction=this.directive.finalLeg?"Casualty reached extraction":"Casualty at intermediate waypoint";
    actor.aiV2Evacuation={status:this.directive.finalLeg?"at_extraction":"at_route_waypoint",phase:"transport_leg",casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,waypointLabel:this.directive.waypointLabel,destination:{...this.directive.destination},progress:1,transportStamina:after,completedAt:now};
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_transport_leg_completed",now,data:{actorId:actor.id,casualtyId:casualty.id,routeId:this.directive.routeId,legIndex:this.directive.legIndex,waypointId:this.directive.waypointId,finalLeg:Boolean(this.directive.finalLeg),transportStaminaBefore:before,transportStaminaAfter:after,staminaCost:cost,destination:{...this.directive.destination}}});
    return{status:"completed",reason:"casualty_transport_leg_completed",data:{routeId:this.directive.routeId,legIndex:this.directive.legIndex,finalLeg:Boolean(this.directive.finalLeg),transportStaminaBefore:before,transportStaminaAfter:after}};
  }

  #release(services,actor,casualty,now,reason){
    services.destinationClaims.release(actor.id,{now,reason});
    services.casualtyCare.releasePatient(casualty.id,actor.id);
    services.casualtyCare.releaseDrag({patient:casualty});
  }
}
