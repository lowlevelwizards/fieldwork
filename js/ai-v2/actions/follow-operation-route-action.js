import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class FollowOperationRouteAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"FollowOperationRoute",actorId,
      purpose:directive?.reason??"Travel through the assigned campaign route",
      channels:[ACTION_CHANNELS.LOCOMOTION],primary:true,displayPriority:72,priority:430,
      metadata:{directive:{...directive},provenance:directive?.provenance??null}
    });
    this.directive={...directive,waypoint:directive?.waypoint?{...directive.waypoint}:null,destination:directive?.destination?{...directive.destination}:null};
    this.initialDistance=Math.max(1,Number(directive?.initialDistance)||1);
    this.metadata.utilityScore=Number(directive?.utilityScore??3);
  }

  amendFrom(action){
    if(!action?.directive)return false;
    this.directive={...this.directive,...action.directive,waypoint:action.directive.waypoint?{...action.directive.waypoint}:this.directive.waypoint,destination:action.directive.destination?{...action.directive.destination}:this.directive.destination};
    this.initialDistance=Math.max(1,Number(action.directive.initialDistance)||this.initialDistance);
    return true;
  }

  continuationUtility(){return Number(this.directive?.utilityScore??3);}

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const status=game?.livingSandbox?.operationRouteStatus?.(this.directive.operationId,this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&status&&!status.complete&&status.mode===this.directive.mode&&status.index===this.directive.index&&status.waypoint);
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const status=game?.livingSandbox?.operationRouteStatus?.(this.directive.operationId,this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&status&&!status.complete&&status.mode===this.directive.mode&&status.index===this.directive.index&&status.waypoint?.id===this.directive.waypoint?.id);
  }

  start(now,{game}={}){
    super.start(now,{game});
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(actor){
      actor.currentTask=this.directive.operationLabel??actor.currentTask;
      actor.currentAction=this.directive.mode==="return"?`Returning via ${this.directive.waypoint?.label??"campaign route"}`:`Deploying via ${this.directive.waypoint?.label??"campaign route"}`;
      actor.aiV2Route={operationId:this.directive.operationId,mode:this.directive.mode,index:this.directive.index,total:this.directive.total,waypointId:this.directive.waypoint?.id??null,waypointLabel:this.directive.waypoint?.label??null,progress:0};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    const destination=this.directive.destination??this.directive.waypoint;
    const result=services.locomotion.moveWithIntent(actor,{
      kind:"operation_route_corridor",goal:destination,acceptanceRadius:this.directive.acceptanceRadius??34,
      corridor:this.directive.corridor,minimumProgress:.86,preferredSeparationMin:54,preferredSeparationMax:210,
      threatPoint:actor.aiV2TacticalPicture?.threatPoint??null,dangerRadius:360,lookAhead:105
    },delta,{
      game,now,speedMultiplier:this.directive.mode==="return"?.76:.72,arrivalRadius:12,
      task:this.directive.mode==="return"?`Returning through ${this.directive.waypoint?.label??"route"}`:`Traveling through ${this.directive.waypoint?.label??"route"}`,
      pose:"walk"
    });
    const remaining=result.distance??distance(actor,destination);
    this.progress=Math.max(0,Math.min(1,1-remaining/this.initialDistance));
    actor.aiV2Route={operationId:this.directive.operationId,mode:this.directive.mode,index:this.directive.index,total:this.directive.total,waypointId:this.directive.waypoint?.id??null,waypointLabel:this.directive.waypoint?.label??null,distance:remaining,progress:this.progress};
    if(result.failed)return{status:"failed",reason:result.reason??"campaign_route_travel_failed"};
    if(!result.arrived)return null;
    services.locomotion.stop(actor);
    const marked=game.livingSandbox?.markActorRouteWaypoint?.({operationId:this.directive.operationId,actorId:actor.id,mode:this.directive.mode,index:this.directive.index,now});
    if(!marked)return{status:"failed",reason:"campaign_route_progress_rejected"};
    actor.currentAction=this.directive.mode==="return"?`Reached return waypoint — ${this.directive.waypoint?.label??"route"}`:`Reached deployment waypoint — ${this.directive.waypoint?.label??"route"}`;
    return{status:"completed",reason:"campaign_route_waypoint_reached",data:{operationId:this.directive.operationId,mode:this.directive.mode,index:this.directive.index,waypointId:this.directive.waypoint?.id??null}};
  }
}
