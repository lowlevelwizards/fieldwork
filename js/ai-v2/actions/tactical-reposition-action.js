import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class TacticalRepositionAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"TacticalReposition",actorId,
      purpose:directive?.reason??"Improve the actor's local tactical position",
      channels:[ACTION_CHANNELS.LOCOMOTION],
      primary:true,displayPriority:135,priority:235,interruptible:true,
      metadata:{directive:{...directive},provenance:directive?.provenance??null}
    });
    this.directive={...directive,destination:directive?.destination?{...directive.destination}:null,threatPoint:directive?.threatPoint?{...directive.threatPoint}:null};
    this.elapsed=0;this.initialDistance=1;this.metadata.utilityScore=Number(directive?.utilityScore??0);
  }
  amendFrom(action){if(!action?.directive)return false;this.directive={...this.directive,...action.directive,destination:action.directive.destination?{...action.directive.destination}:this.directive.destination,threatPoint:action.directive.threatPoint?{...action.directive.threatPoint}:this.directive.threatPoint};this.metadata.utilityScore=Number(action.metadata?.utilityScore??action.directive?.utilityScore??this.metadata.utilityScore??0);return true;}
  continuationUtility(){return Number(this.metadata?.utilityScore??0);}
  canStart({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);return Boolean(actor&&this.directive.destination&&!actor.medical?.dead&&!actor.medical?.unconscious);}
  canContinue({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);return Boolean(actor&&this.directive.destination&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.elapsed<(this.directive.maximumDuration??5.5));}
  start(now,{game}={}){super.start(now,{game});const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(actor){this.initialDistance=Math.max(1,distance(actor,this.directive.destination));actor.aiV2TacticalMove={status:"moving",kind:this.directive.kind??"improve_position",destination:{...this.directive.destination},startedAt:now};actor.currentAction=this.directive.label??"Improving tactical position";}}
  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=Math.max(0,delta);
    if(this.directive.threatPoint)services?.attention?.turnToward?.(actor,this.directive.threatPoint,delta,{pose:"brace",turnRate:7});
    const movement=services?.locomotion?.moveWithIntent?.(actor,{
      kind:this.directive.kind??"improve_position",goal:this.directive.destination,
      acceptanceRadius:this.directive.acceptanceRadius??this.directive.arrivalRadius??28,
      preferredSeparationMin:this.directive.preferredSeparationMin??64,
      preferredSeparationMax:this.directive.preferredSeparationMax??230,
      threatPoint:this.directive.threatPoint,dangerRadius:this.directive.dangerRadius??340,
      threatRepulsionWeight:this.directive.threatRepulsionWeight??1.45,lookAhead:this.directive.lookAhead??78,
      cohesion:this.directive.cohesion!==false
    },delta,{game,now,speedMultiplier:this.directive.speedMultiplier??.78,arrivalRadius:10,task:this.directive.label??"Tactical reposition",pose:this.directive.pose??"brace"})??{arrived:false,distance:this.initialDistance};
    this.progress=Math.max(0,Math.min(1,1-(movement.distance??distance(actor,this.directive.destination))/this.initialDistance));
    actor.aiV2TacticalMove={status:movement.arrived?"holding":"moving",kind:this.directive.kind??"improve_position",destination:{...this.directive.destination},progress:this.progress,updatedAt:now};
    if(movement.failed)return{status:"failed",reason:movement.reason??"movement_failed"};
    if(movement.arrived||this.elapsed>=(this.directive.minimumCommitment??1.4)&&movement.distance<34){services?.locomotion?.stop?.(actor,{pose:"brace"});if(["seek_cover","seek_treatment_cover","acquire_directional_cover"].includes(this.directive.kind)){actor.aiV2CoverOccupancy={status:"protected",kind:this.directive.kind,point:{x:actor.x,y:actor.y},threatPoint:this.directive.threatPoint?{...this.directive.threatPoint}:null,enteredAt:now,lastUsefulAt:now};}return{status:"completed",reason:"tactical_position_reached"};}
    return null;
  }
  onInterrupted({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(actor)actor.aiV2TacticalMove={...(actor.aiV2TacticalMove??{}),status:"interrupted"};}
  onCancelled(context={}){this.onInterrupted(context);}
}
