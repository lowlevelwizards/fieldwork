import { AIV2Action } from "./action.js?v=20l-silent-withdrawal-deescalation-20260802";
import { ACTION_CHANNELS } from "./action-channels.js?v=20l-silent-withdrawal-deescalation-20260802";

function cloneDirective(directive={}){
  return{
    ...directive,
    targetPoint:directive.targetPoint?{...directive.targetPoint}:null,
    boundary:directive.boundary?{
      ...directive.boundary,
      area:directive.boundary.area?{...directive.boundary.area}:null,
      allowedActivities:[...(directive.boundary.allowedActivities??[])]
    }:null,
    provenance:directive.provenance?{...directive.provenance}:null
  };
}

export class IssueWarningAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"IssueWarning",
      actorId,
      purpose:normalized.reason??"Establish the mission boundary without violence",
      channels:[ACTION_CHANNELS.COMMUNICATION,ACTION_CHANNELS.ATTENTION],
      primary:true,
      displayPriority:110,
      metadata:{
        warningType:normalized.warningType??"stop_and_identify",
        message:normalized.message??"Stop and identify yourselves.",
        subjectId:normalized.subjectId??null,
        provenance:normalized.provenance??null
      }
    });
    this.directive=normalized;
    this.transmission=null;
    this.delivery=null;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor||actor.medical?.dead||actor.medical?.unconscious||!this.directive?.targetPoint)return false;
    const boundary=this.directive.boundary??{};
    return Boolean(services?.communication?.findDirectedRecipients?.(game,actor,{
      targetPoint:this.directive.targetPoint,
      range:boundary.voiceRange,
      coneDegrees:boundary.coneDegrees
    })?.length);
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive?.targetPoint);
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    const boundary=this.directive.boundary??{};
    this.transmission=context?.services?.communication?.beginDirectedWarning?.({
      game:context.game,
      speaker:actor,
      targetPoint:this.directive.targetPoint,
      message:this.directive.message,
      warningType:this.directive.warningType,
      now,
      range:boundary.voiceRange,
      coneDegrees:boundary.coneDegrees,
      duration:boundary.warningDuration
    })??null;
    if(actor){
      actor.currentTask=this.directive.task??actor.currentTask;
      actor.currentAction=this.transmission?"Beginning directed warning":"Unable to issue warning";
      actor.aiV2Warning={
        status:this.transmission?"issuing":"failed",
        warningType:this.directive.warningType,
        message:this.directive.message,
        targetPoint:{...this.directive.targetPoint},
        recipientIds:[...(this.transmission?.recipientIds??[])],
        progress:0,
        startedAt:now,
        provenance:this.directive.provenance?{...this.directive.provenance}:null
      };
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.transmission){
      services.teamProcedures?.notifyEvent?.({teamId:actor.teamId,event:"warning_failed",now,data:{reason:"communication_session_missing"}});
      return{status:"failed",reason:"communication_session_missing"};
    }

    services.attention?.turnToward?.(actor,this.directive.targetPoint,delta,{pose:"signal",turnRate:4.3});
    const result=services.communication.advanceDirectedWarning(this.transmission,delta,{game,now});
    this.progress=result.progress??0;
    actor.currentAction=result.status==="active"?"Issuing warning":"Warning delivered";
    actor.aiV2Warning={
      status:result.status==="completed"?"delivered":result.status,
      warningType:this.directive.warningType,
      message:this.directive.message,
      targetPoint:{...this.directive.targetPoint},
      recipientIds:[...(result.recipientIds??this.transmission.recipientIds)],
      progress:this.progress,
      startedAt:this.transmission.startedAt,
      completedAt:result.status==="completed"?now:null,
      provenance:this.directive.provenance?{...this.directive.provenance}:null
    };

    if(result.status==="failed"){
      services.teamProcedures?.notifyEvent?.({teamId:actor.teamId,event:"warning_failed",now,data:{reason:result.reason??"directed_warning_failed"}});
      return{status:"failed",reason:result.reason??"directed_warning_failed"};
    }
    if(result.status!=="completed")return null;

    const warning=services.heardCommunications?.receiveWarning?.({
      game,
      speaker:actor,
      recipientIds:result.recipientIds,
      message:this.directive.message,
      warningType:this.directive.warningType,
      targetPoint:this.directive.targetPoint,
      now,
      method:this.transmission.method,
      range:this.transmission.range
    })??null;
    if(!warning){
      services.teamProcedures?.notifyEvent?.({teamId:actor.teamId,event:"warning_failed",now,data:{reason:"warning_memory_failed"}});
      return{status:"failed",reason:"warning_memory_failed"};
    }
    this.delivery=warning;
    this.metadata.warningId=warning.id;
    this.metadata.recipientIds=[...warning.recipientIds];
    services.teamProcedures?.notifyEvent?.({
      teamId:actor.teamId,
      event:"warning_delivered",
      now,
      data:{
        warningId:warning.id,
        message:warning.message,
        subjectId:this.directive.subjectId??null,
        recipientIds:[...warning.recipientIds]
      }
    });
    return{
      status:"completed",
      reason:"directed_warning_delivered",
      data:{warningId:warning.id,recipientIds:[...warning.recipientIds],subjectId:this.directive.subjectId??null}
    };
  }
}
