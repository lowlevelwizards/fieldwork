import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class AdvanceRouteSecurityAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"AdvanceRouteSecurity",actorId,purpose:directive?.reason??"Secure the next evacuation waypoint",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.ATTENTION],primary:true,displayPriority:82,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
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
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="secure_route_leg");
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    this.claimed=Boolean(context.services.destinationClaims.claim({actorId:this.actorId,point:this.directive.destination,purpose:`${this.directive.procedureId}:secure_route_leg_${this.directive.legIndex}`,now,duration:3,radius:this.directive.policy?.claimSpacing??68})?.ok);
    if(actor){
      actor.currentAction="Advancing to secure evacuation route";
      actor.aiV2Evacuation={status:this.claimed?"securing_route":"blocked",phase:"secure_route_leg",routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,waypointLabel:this.directive.waypointLabel,destination:{...this.directive.destination},progress:0,startedAt:now};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.claimed)return{status:"failed",reason:"route_waypoint_claim_rejected"};
    services.destinationClaims.renew(actor.id,{now,duration:3});
    const result=services.locomotion.moveToward(actor,this.directive.destination,delta,{game,speedMultiplier:this.directive.policy?.speedMultiplier??.78,arrivalRadius:this.directive.policy?.arrivalRadius??14,task:"Securing evacuation route",pose:"walk"});
    const distance=result.distance??0;
    this.progress=Math.max(0,Math.min(1,1-distance/this.initialDistance));
    actor.aiV2Evacuation={status:result.arrived?"route_leg_secured":"securing_route",phase:"secure_route_leg",routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,legIndex:this.directive.legIndex,waypointLabel:this.directive.waypointLabel,destination:{...this.directive.destination},distance,progress:this.progress,startedAt:this.startedAt};
    if(result.failed){
      services.destinationClaims.release(actor.id,{now,reason:"route_security_failed"});
      services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_evacuation_failed",now,data:{actorId:actor.id,phase:"secure_route_leg",legIndex:this.directive.legIndex,reason:result.reason}});
      return{status:"failed",reason:result.reason};
    }
    if(!result.arrived)return null;
    services.destinationClaims.release(actor.id,{now,reason:"route_leg_secured"});
    services.locomotion.stop(actor);
    actor.currentAction="Holding secured evacuation waypoint";
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"route_leg_secured",now,data:{actorId:actor.id,routeId:this.directive.routeId,legIndex:this.directive.legIndex,waypointId:this.directive.waypointId,destination:{...this.directive.destination}}});
    return{status:"completed",reason:"route_leg_secured",data:{routeId:this.directive.routeId,legIndex:this.directive.legIndex,waypointId:this.directive.waypointId}};
  }
}
