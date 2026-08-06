import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

function cloneIntent(intent={}){
  return{
    ...intent,
    goal:intent.goal?{...intent.goal}:null,
    focus:intent.focus?{...intent.focus}:null,
    threatPoint:intent.threatPoint?{...intent.threatPoint}:null,
    region:intent.region?{...intent.region,center:intent.region.center?{...intent.region.center}:null}:null
  };
}

export class MoveWithinIntentFieldAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized={...directive,intent:cloneIntent(directive?.intent)};
    super({
      type:"MoveWithinIntentField",actorId,
      purpose:normalized.reason??normalized.intent?.reason??"Move into a valid concern-support position",
      channels:[ACTION_CHANNELS.LOCOMOTION],primary:true,displayPriority:36,priority:300,interruptible:true,
      metadata:{directive:normalized,provenance:normalized.provenance??null,utilityScore:Number(normalized.utilityScore??normalized.intent?.utilityScore??0)}
    });
    this.directive=normalized;
    this.elapsed=0;
    this.initialDistance=1;
  }

  amendFrom(action,{now=0}={}){
    if(!action?.directive?.intent)return false;
    this.directive={...this.directive,...action.directive,intent:cloneIntent(action.directive.intent)};
    this.purpose=this.directive.reason??this.directive.intent.reason??this.purpose;
    this.metadata.directive={...this.directive,intent:cloneIntent(this.directive.intent)};
    this.metadata.utilityScore=Number(action.metadata?.utilityScore??action.directive.utilityScore??this.metadata.utilityScore??0);
    return true;
  }

  continuationUtility(){return Number(this.metadata?.utilityScore??this.directive?.intent?.utilityScore??0);}

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&actor.medical?.condition!=="critical"&&this.directive?.intent?.region?.center&&services?.concernStaffing?.hasAssignment?.(actor.id,this.directive.assignmentId));
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&actor.medical?.condition!=="critical"&&this.elapsed<(this.directive.maximumDuration??12)&&services?.concernStaffing?.hasAssignment?.(actor.id,this.directive.assignmentId));
  }

  start(now,{game}={}){
    super.start(now,{game});
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(!actor)return;
    const center=this.directive.intent.region.center;
    this.initialDistance=Math.max(1,Math.hypot(center.x-actor.x,center.y-actor.y));
    actor.currentAction=this.directive.intent.label??"Moving to support a concern";
    actor.aiV2IntentField={status:"moving",assignmentId:this.directive.assignmentId,concernId:this.directive.concernId,responsibility:this.directive.responsibility,intent:cloneIntent(this.directive.intent),startedAt:now};
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=Math.max(0,delta);
    const intent=this.directive.intent;
    const result=services?.locomotion?.moveWithIntent?.(actor,intent,delta,{game,now,speedMultiplier:this.directive.speedMultiplier??.66,arrivalRadius:10,task:intent.label??"Supporting concurrent concern",pose:this.directive.pose??"ready"});
    if(!result)return{status:"failed",reason:"locomotion_executor_missing"};
    const center=intent.region.center;
    const remaining=Math.hypot(center.x-actor.x,center.y-actor.y);
    this.progress=Math.max(0,Math.min(1,1-remaining/this.initialDistance));
    actor.aiV2IntentField={status:result.arrived?"satisfied":"moving",assignmentId:this.directive.assignmentId,concernId:this.directive.concernId,responsibility:this.directive.responsibility,intent:cloneIntent(intent),progress:this.progress,updatedAt:now};
    if(result.failed)return{status:"failed",reason:result.reason??"intent_field_movement_failed"};
    if(!result.arrived)return null;
    services?.locomotion?.stop?.(actor,{pose:"ready"});
    actor.currentAction=`Positioned for ${String(this.directive.responsibility??"support").replaceAll("_"," ")}`;
    return{status:"completed",reason:"intent_field_satisfied",data:{assignmentId:this.directive.assignmentId,concernId:this.directive.concernId}};
  }

  onInterrupted({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(actor?.aiV2IntentField)actor.aiV2IntentField={...actor.aiV2IntentField,status:"interrupted"};}
  onCancelled(context={}){this.onInterrupted(context);}
}
