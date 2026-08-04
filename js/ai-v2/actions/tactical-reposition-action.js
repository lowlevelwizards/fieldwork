import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class TacticalRepositionAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"TacticalReposition",actorId,
      purpose:directive?.reason??"Improve the actor's local tactical position",
      channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,displayPriority:135,priority:235,interruptible:true,
      metadata:{directive:{...directive},provenance:directive?.provenance??null}
    });
    this.directive={...directive,destination:directive?.destination?{...directive.destination}:null,threatPoint:directive?.threatPoint?{...directive.threatPoint}:null};
    this.elapsed=0;this.initialDistance=1;
  }
  canStart({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);return Boolean(actor&&this.directive.destination&&!actor.medical?.dead&&!actor.medical?.unconscious);}
  canContinue({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);return Boolean(actor&&this.directive.destination&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.elapsed<(this.directive.maximumDuration??5.5));}
  start(now,{game}={}){super.start(now,{game});const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(actor){this.initialDistance=Math.max(1,distance(actor,this.directive.destination));actor.aiV2TacticalMove={status:"moving",kind:this.directive.kind??"improve_position",destination:{...this.directive.destination},startedAt:now};actor.currentAction=this.directive.label??"Improving tactical position";}}
  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=Math.max(0,delta);
    if(this.directive.threatPoint)services?.attention?.turnToward?.(actor,this.directive.threatPoint,delta,{pose:"brace",turnRate:7});
    const movement=services?.locomotion?.moveToward?.(actor,this.directive.destination,delta,{game,speedMultiplier:this.directive.speedMultiplier??.78,arrivalRadius:this.directive.arrivalRadius??18,task:this.directive.label??"Tactical reposition",pose:this.directive.pose??"brace"})??{arrived:false,distance:this.initialDistance};
    this.progress=Math.max(0,Math.min(1,1-(movement.distance??distance(actor,this.directive.destination))/this.initialDistance));
    actor.aiV2TacticalMove={status:movement.arrived?"holding":"moving",kind:this.directive.kind??"improve_position",destination:{...this.directive.destination},progress:this.progress,updatedAt:now};
    if(movement.failed)return{status:"failed",reason:movement.reason??"movement_failed"};
    if(movement.arrived||this.elapsed>=(this.directive.minimumCommitment??1.4)&&movement.distance<34){services?.locomotion?.stop?.(actor,{pose:"brace"});return{status:"completed",reason:"tactical_position_reached"};}
    return null;
  }
  onInterrupted({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(actor)actor.aiV2TacticalMove={...(actor.aiV2TacticalMove??{}),status:"interrupted"};}
  onCancelled(context={}){this.onInterrupted(context);}
}
