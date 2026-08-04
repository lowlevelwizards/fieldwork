import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class RecordSurveyPointAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"RecordSurveyPoint",actorId,purpose:directive?.reason??"Observe and record the current route point",channels:[ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:74,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,point:directive?.point?{...directive.point}:null};this.elapsed=0;
  }
  canStart({game}={}){const actor=game?.actors?.find(item=>item.id===this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive.point);}
  canContinue({game,services}={}){const actor=game?.actors?.find(item=>item.id===this.actorId);const role=services?.teamProcedures?.getActorRole?.(this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="record_survey_point");}
  start(now,{game}={}){super.start(now,{game});const actor=game.actors.find(item=>item.id===this.actorId);if(actor){actor.currentAction=`Recording ${this.directive.point.label??"route point"}`;actor.aiV2Survey={status:"recording",pointId:this.directive.point.id,operationId:this.directive.operationId,progress:0};}}
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(item=>item.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};
    services.attention.turnToward(actor,this.directive.point,delta,{pose:"brace",turnRate:3.8});this.elapsed+=delta;const duration=Math.max(.5,this.directive.duration??1.4);this.progress=Math.min(1,this.elapsed/duration);actor.aiV2Survey={status:"recording",pointId:this.directive.point.id,operationId:this.directive.operationId,progress:this.progress};
    if(this.elapsed<duration)return null;
    const result=game.livingSandbox?.recordSurveyPoint?.({operationId:this.directive.operationId,pointId:this.directive.point.id,actorId:actor.id,now});
    if(!result)return{status:"failed",reason:"survey_point_unavailable"};
    services.objectives.setExternalProgress({objectiveId:this.directive.objectiveId,progress:result.total?result.completed/result.total:1,state:result.complete?this.directive.desiredState:(this.directive.workingState??"being_surveyed"),desiredState:result.complete?this.directive.desiredState:null,teamId:actor.teamId,now,reason:"route_point_recorded"});
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"survey_point_recorded",now,data:{pointId:this.directive.point.id,complete:result.complete,nextPointIndex:result.nextPointIndex,completedPoints:result.completed,totalPoints:result.total,now}});
    actor.currentAction=result.complete?"Route survey complete":`Recorded ${result.completed}/${result.total} route points`;
    return{status:"completed",reason:"survey_point_recorded",data:result};
  }
}
