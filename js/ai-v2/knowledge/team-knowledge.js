const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
let nextReportSequence=1;

function stableAngle(text){
  let hash=2166136261;
  for(const character of text){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%3600)/3600*Math.PI*2;
}

function relayedPosition(contact,sourceActorId,reportKind="initial_contact"){
  const angle=stableAngle(`${sourceActorId}>${contact.subjectId}>${reportKind}>${contact.activityRevision??0}`);
  const error=10+(100-clamp(contact.confidence,0,100))*.16+(reportKind==="activity_update"?5:0);
  return{
    x:contact.approximatePosition.x+Math.cos(angle)*error,
    y:contact.approximatePosition.y+Math.sin(angle)*error
  };
}

function relayedPreviousPosition(contact,sourceActorId){
  if(!contact.previousApproximatePosition)return null;
  const angle=stableAngle(`${sourceActorId}>${contact.subjectId}>previous>${contact.activityRevision??0}`);
  const error=12+(100-clamp(contact.confidence,0,100))*.18;
  return{
    x:contact.previousApproximatePosition.x+Math.cos(angle)*error,
    y:contact.previousApproximatePosition.y+Math.sin(angle)*error
  };
}

function cloneReport(report){
  return{
    ...report,
    approximatePosition:{...report.approximatePosition},
    previousApproximatePosition:report.previousApproximatePosition?{...report.previousApproximatePosition}:null,
    recipientIds:[...report.recipientIds],
    intentHypothesis:report.intentHypothesis?{...report.intentHypothesis}:null
  };
}

export class TeamKnowledgeStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.reportsByTeam=new Map();
    this.receivedByActor=new Map();
  }

  receiveContactReport({speaker,contact,recipientIds=[],method="local_voice",now=0}={}){
    return this.#receive({speaker,contact,recipientIds,method,now,reportKind:"initial_contact"});
  }

  receiveContactUpdate({speaker,contact,recipientIds=[],method="local_voice",now=0}={}){
    if(!(contact?.activityRevision>0))return null;
    return this.#receive({speaker,contact,recipientIds,method,now,reportKind:"activity_update"});
  }

  #receive({speaker,contact,recipientIds,method,now,reportKind}){
    if(!speaker?.teamId||!contact?.subjectId||!contact?.approximatePosition||!recipientIds.length)return null;
    const previous=this.getTeamReports(speaker.teamId).find(report=>report.sourceActorId===speaker.id&&report.subjectId===contact.subjectId)??null;
    const report={
      id:`v2_report_${nextReportSequence++}`,
      reportKind,
      teamId:speaker.teamId,
      sourceActorId:speaker.id,
      subjectId:contact.subjectId,
      classification:contact.classification??"unknown_person",
      identity:contact.identity??previous?.identity??"unknown",
      factionId:contact.factionId??previous?.factionId??null,
      factionConfidence:contact.factionConfidence??previous?.factionConfidence??0,
      subjectTeamId:contact.subjectTeamId??previous?.subjectTeamId??null,
      relationship:contact.relationship??previous?.relationship??"unknown",
      confidence:clamp((contact.confidence??0)*(reportKind==="activity_update"?.76:.82),0,88),
      evidenceType:reportKind==="activity_update"?"reported_activity":"reported_contact",
      method,
      approximatePosition:relayedPosition(contact,speaker.id,reportKind),
      previousApproximatePosition:reportKind==="activity_update"?relayedPreviousPosition(contact,speaker.id):null,
      sourceObservationAt:contact.lastObservedAt??now,
      reportedAt:now,
      lastUpdatedAt:now,
      recipientIds:[...recipientIds],
      independentlyConfirmed:false,
      supersedesReportId:previous?.id??null,
      activity:contact.activity??null,
      activityLabel:contact.activityLabel??null,
      activityReason:contact.activityReason??null,
      activityRevision:contact.activityRevision??0,
      movementDirection:contact.movementDirection??null,
      estimatedSpeed:contact.estimatedSpeed??0,
      intentHypothesis:contact.intentHypothesis?{...contact.intentHypothesis}:null
    };

    if(!this.reportsByTeam.has(report.teamId))this.reportsByTeam.set(report.teamId,new Map());
    this.reportsByTeam.get(report.teamId).set(report.id,report);

    for(const actorId of recipientIds){
      if(!this.receivedByActor.has(actorId))this.receivedByActor.set(actorId,new Map());
      this.receivedByActor.get(actorId).set(report.id,cloneReport(report));
      this.decisionLog?.record?.({
        type:reportKind==="activity_update"?"reported_activity_received":"reported_contact_received",
        time:now,
        actorId,
        teamId:report.teamId,
        data:{
          reportId:report.id,
          reportKind,
          sourceActorId:speaker.id,
          subjectId:report.subjectId,
          confidence:Math.round(report.confidence),
          activity:report.activity,
          activityRevision:report.activityRevision,
          method
        }
      });
    }

    this.decisionLog?.record?.({
      type:reportKind==="activity_update"?"contact_activity_update_delivered":"contact_report_delivered",
      time:now,
      actorId:speaker.id,
      teamId:report.teamId,
      data:{
        reportId:report.id,
        reportKind,
        subjectId:report.subjectId,
        recipientIds:[...recipientIds],
        confidence:Math.round(report.confidence),
        activity:report.activity,
        activityRevision:report.activityRevision,
        intentHypothesis:report.intentHypothesis?.id??null,
        method
      }
    });
    return cloneReport(report);
  }

  hasReportFrom(teamId,sourceActorId,subjectId){
    return this.getTeamReports(teamId).some(report=>report.reportKind==="initial_contact"&&report.sourceActorId===sourceActorId&&report.subjectId===subjectId);
  }

  hasInitialReportFrom(teamId,sourceActorId){
    return this.getTeamReports(teamId).some(report=>report.reportKind==="initial_contact"&&report.sourceActorId===sourceActorId);
  }

  hasActivityRevision(teamId,sourceActorId,subjectId,revision){
    return this.getTeamReports(teamId).some(report=>
      report.reportKind==="activity_update"&&
      report.sourceActorId===sourceActorId&&
      report.subjectId===subjectId&&
      report.activityRevision>=revision
    );
  }

  getTeamReports(teamId){
    return[...(this.reportsByTeam.get(teamId)?.values()??[])].sort((a,b)=>b.reportedAt-a.reportedAt).map(cloneReport);
  }

  getTeamContacts(teamId){
    const bySubject=new Map();
    for(const report of this.getTeamReports(teamId)){
      const existing=bySubject.get(report.subjectId);
      if(!existing||report.reportedAt>existing.reportedAt||(report.reportedAt===existing.reportedAt&&report.confidence>existing.confidence))bySubject.set(report.subjectId,report);
    }
    return[...bySubject.values()].sort((a,b)=>b.reportedAt-a.reportedAt||b.confidence-a.confidence);
  }

  getBestTeamContact(teamId){return this.getTeamContacts(teamId)[0]??null;}

  getReceivedContacts(actorId){
    return[...(this.receivedByActor.get(actorId)?.values()??[])].sort((a,b)=>b.reportedAt-a.reportedAt||b.confidence-a.confidence).map(cloneReport);
  }

  getBestReceivedContact(actorId){return this.getReceivedContacts(actorId)[0]??null;}

  update(delta,{now=0}={}){
    const removedReportIds=new Set();
    for(const [teamId,reports] of this.reportsByTeam){
      for(const [reportId,report] of reports){
        const age=Math.max(0,now-report.reportedAt);
        if(age>8)report.confidence=clamp(report.confidence-Math.max(0,delta)*(report.reportKind==="activity_update"?1:.8),0,88);
        report.lastUpdatedAt=now;
        if(report.confidence<=0){reports.delete(reportId);removedReportIds.add(reportId);}
      }
      if(!reports.size)this.reportsByTeam.delete(teamId);
    }
    for(const [actorId,reports] of this.receivedByActor){
      for(const id of removedReportIds)reports.delete(id);
      for(const [id,report] of reports){
        const authoritative=this.reportsByTeam.get(report.teamId)?.get(id);
        if(authoritative)reports.set(id,cloneReport(authoritative));
      }
      if(!reports.size)this.receivedByActor.delete(actorId);
    }
  }

  reportCount(){
    let total=0;
    for(const reports of this.reportsByTeam.values())total+=reports.size;
    return total;
  }

  activityReportCount(){
    let total=0;
    for(const reports of this.reportsByTeam.values())for(const report of reports.values())if(report.reportKind==="activity_update")total+=1;
    return total;
  }

  recipientCount(){
    let total=0;
    for(const reports of this.receivedByActor.values())total+=reports.size;
    return total;
  }

  summary(){
    return[...this.reportsByTeam.entries()].map(([teamId,reports])=>({
      teamId,
      reports:[...reports.values()].map(cloneReport)
    }));
  }
}
