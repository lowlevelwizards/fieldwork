import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

function snapshotContact(contact){
  return contact?{
    subjectId:contact.subjectId,
    classification:contact.classification,
    identity:contact.identity,
    factionId:contact.factionId,
    confidence:contact.confidence,
    level:contact.level,
    approximatePosition:{...contact.approximatePosition},
    previousApproximatePosition:contact.track?.previousApproximatePosition?{...contact.track.previousApproximatePosition}:null,
    lastObservedAt:contact.lastObservedAt,
    currentlyVisible:Boolean(contact.currentlyVisible),
    activity:contact.track?.currentActivity??"unknown",
    activityLabel:contact.track?.activityLabel??"Unknown activity",
    activityReason:contact.track?.activityReason??"No activity interpretation available.",
    activityRevision:contact.track?.activityRevision??0,
    movementDirection:contact.track?.movementDirection??"unknown",
    estimatedSpeed:contact.track?.estimatedSpeed??0,
    intentHypothesis:contact.track?.intentHypothesis?{...contact.track.intentHypothesis}:null
  }:null;
}

export class ReportContactUpdateAction extends AIV2Action{
  constructor({actorId,contact,assignment}={}){
    const snapshot=snapshotContact(contact);
    super({
      type:"ReportContactUpdate",
      actorId,
      purpose:`Report meaningful contact activity: ${snapshot?.activityLabel??"activity changed"}`,
      channels:[ACTION_CHANNELS.COMMUNICATION],
      primary:true,
      displayPriority:102,
      metadata:{
        reportKind:"activity_update",
        subjectId:snapshot?.subjectId??null,
        activityRevision:snapshot?.activityRevision??0,
        activity:snapshot?.activity??"unknown",
        method:assignment?.report?.method??"local_voice"
      }
    });
    this.contactSnapshot=snapshot;
    this.assignment=assignment;
    this.transmission=null;
    this.delivery=null;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor||actor.medical?.dead||actor.medical?.unconscious||!this.contactSnapshot?.activityRevision)return false;
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
      reportKind:"activity_update",
      now,
      range,
      duration:.95
    })??null;
    if(actor){
      actor.currentAction="Beginning contact activity update";
      actor.aiV2Communication={
        status:this.transmission?"transmitting_update":"failed",
        reportKind:"activity_update",
        method:this.transmission?.method??"local_voice",
        subjectId:this.contactSnapshot.subjectId,
        activity:this.contactSnapshot.activity,
        activityRevision:this.contactSnapshot.activityRevision,
        recipientIds:[...(this.transmission?.recipientIds??[])],
        progress:0,
        startedAt:now
      };
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.transmission)return{status:"failed",reason:"communication_session_missing"};
    const result=services.communication.advanceContactReport(this.transmission,delta,{game,now});
    this.progress=result.progress??0;
    actor.currentAction=result.status==="active"?"Reporting contact activity":"Contact activity update delivered";
    actor.aiV2Communication={
      status:result.status==="completed"?"delivered_update":result.status,
      reportKind:"activity_update",
      method:this.transmission.method,
      subjectId:this.contactSnapshot.subjectId,
      activity:this.contactSnapshot.activity,
      activityRevision:this.contactSnapshot.activityRevision,
      recipientIds:[...(result.recipientIds??this.transmission.recipientIds)],
      progress:this.progress,
      startedAt:this.transmission.startedAt,
      completedAt:result.status==="completed"?now:null
    };
    if(result.status==="failed")return{status:"failed",reason:result.reason??"communication_failed"};
    if(result.status!=="completed")return null;
    const report=services.teamKnowledge.receiveContactUpdate({
      speaker:actor,
      contact:this.contactSnapshot,
      recipientIds:result.recipientIds,
      method:this.transmission.method,
      now
    });
    if(!report)return{status:"failed",reason:"activity_update_delivery_failed"};
    this.delivery=report;
    this.metadata.reportId=report.id;
    this.metadata.recipientIds=[...report.recipientIds];
    return{
      status:"completed",
      reason:"contact_activity_update_delivered",
      data:{
        reportId:report.id,
        recipientIds:[...report.recipientIds],
        subjectId:report.subjectId,
        activity:report.activity,
        activityRevision:report.activityRevision
      }
    };
  }
}
