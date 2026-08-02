import { AIV2Action } from "./action.js?v=20k-boundaries-challenge-warning-20260802";
import { ACTION_CHANNELS } from "./action-channels.js?v=20k-boundaries-challenge-warning-20260802";

export class ReportContactAction extends AIV2Action{
  constructor({actorId,contact,assignment}={}){
    super({
      type:"ReportContact",
      actorId,
      purpose:assignment?.report?.reason??"Share a credible personal observation with nearby teammates",
      channels:[ACTION_CHANNELS.COMMUNICATION],
      primary:true,
      displayPriority:100,
      metadata:{
        subjectId:contact?.subjectId??null,
        method:assignment?.report?.method??"local_voice",
        sourceConfidence:contact?.confidence??0
      }
    });
    this.contactSnapshot=contact?{
      subjectId:contact.subjectId,
      classification:contact.classification,
      identity:contact.identity,
      factionId:contact.factionId,
      confidence:contact.confidence,
      level:contact.level,
      approximatePosition:{...contact.approximatePosition},
      lastObservedAt:contact.lastObservedAt,
      currentlyVisible:Boolean(contact.currentlyVisible),
      activity:contact.track?.currentActivity??null,
      activityLabel:contact.track?.activityLabel??null,
      activityReason:contact.track?.activityReason??null,
      activityRevision:contact.track?.activityRevision??0,
      movementDirection:contact.track?.movementDirection??null,
      estimatedSpeed:contact.track?.estimatedSpeed??0,
      intentHypothesis:contact.track?.intentHypothesis?{...contact.track.intentHypothesis}:null,
      previousApproximatePosition:contact.track?.previousApproximatePosition?{...contact.track.previousApproximatePosition}:null
    }:null;
    this.assignment=assignment;
    this.transmission=null;
    this.delivery=null;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor||actor.medical?.dead||actor.medical?.unconscious||!this.contactSnapshot)return false;
    const range=this.assignment?.report?.range??services?.communication?.voiceRange;
    return Boolean(services?.communication?.findVoiceRecipients?.(game,actor,{range})?.length);
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious);
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    const range=this.assignment?.report?.range??context?.services?.communication?.voiceRange;
    this.transmission=context?.services?.communication?.beginContactReport?.({
      game:context.game,
      speaker:actor,
      contact:this.contactSnapshot,
      now,
      range,
      reportKind:"initial_contact"
    })??null;
    if(actor){
      actor.currentAction="Beginning contact report";
      actor.aiV2Communication={
        status:this.transmission?"transmitting":"failed",
        method:this.transmission?.method??"local_voice",
        subjectId:this.contactSnapshot.subjectId,
        recipientIds:[...(this.transmission?.recipientIds??[])],
        reportKind:"initial_contact",
        progress:0,
        startedAt:now
      };
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return {status:"failed",reason:"actor_missing"};
    if(!this.transmission)return {status:"failed",reason:"communication_session_missing"};

    const result=services.communication.advanceContactReport(this.transmission,delta,{game,now});
    this.progress=result.progress??0;
    actor.currentAction=result.status==="active"?"Reporting contact":"Contact report delivered";
    actor.aiV2Communication={
      status:result.status==="completed"?"delivered":result.status,
      reportKind:"initial_contact",
      method:this.transmission.method,
      subjectId:this.contactSnapshot.subjectId,
      recipientIds:[...(result.recipientIds??this.transmission.recipientIds)],
      progress:this.progress,
      startedAt:this.transmission.startedAt,
      completedAt:result.status==="completed"?now:null
    };

    if(result.status==="failed")return {status:"failed",reason:result.reason??"communication_failed"};
    if(result.status!=="completed")return null;

    const report=services.teamKnowledge.receiveContactReport({
      speaker:actor,
      contact:this.contactSnapshot,
      recipientIds:result.recipientIds,
      method:this.transmission.method,
      now
    });
    if(!report)return {status:"failed",reason:"report_delivery_failed"};
    this.delivery=report;
    this.metadata.reportId=report.id;
    this.metadata.recipientIds=[...report.recipientIds];
    return{
      status:"completed",
      reason:"contact_report_delivered",
      data:{reportId:report.id,recipientIds:[...report.recipientIds],subjectId:report.subjectId}
    };
  }
}
