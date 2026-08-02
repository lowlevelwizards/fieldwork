const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
let nextReportSequence=1;

function relayedPosition(contact,sourceActorId){
  const text=`${sourceActorId}>${contact.subjectId}>report`;
  let hash=2166136261;
  for(const character of text){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  const angle=((hash>>>0)%3600)/3600*Math.PI*2;
  const error=10+(100-clamp(contact.confidence,0,100))*.16;
  return{
    x:contact.approximatePosition.x+Math.cos(angle)*error,
    y:contact.approximatePosition.y+Math.sin(angle)*error
  };
}

export class TeamKnowledgeStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.reportsByTeam=new Map();
    this.receivedByActor=new Map();
  }

  receiveContactReport({speaker,contact,recipientIds=[],method="local_voice",now=0}={}){
    if(!speaker?.teamId||!contact?.subjectId||!recipientIds.length)return null;
    const report={
      id:`v2_report_${nextReportSequence++}`,
      teamId:speaker.teamId,
      sourceActorId:speaker.id,
      subjectId:contact.subjectId,
      classification:contact.classification??"unknown_person",
      identity:contact.identity??"unknown",
      factionId:null,
      confidence:clamp((contact.confidence??0)*.82,0,88),
      evidenceType:"reported",
      method,
      approximatePosition:relayedPosition(contact,speaker.id),
      sourceObservationAt:contact.lastObservedAt??now,
      reportedAt:now,
      lastUpdatedAt:now,
      recipientIds:[...recipientIds],
      independentlyConfirmed:false
    };

    if(!this.reportsByTeam.has(report.teamId))this.reportsByTeam.set(report.teamId,new Map());
    this.reportsByTeam.get(report.teamId).set(report.id,report);

    for(const actorId of recipientIds){
      if(!this.receivedByActor.has(actorId))this.receivedByActor.set(actorId,new Map());
      this.receivedByActor.get(actorId).set(report.id,{...report,approximatePosition:{...report.approximatePosition},recipientIds:[...report.recipientIds]});
      this.decisionLog?.record?.({
        type:"reported_contact_received",
        time:now,
        actorId,
        teamId:report.teamId,
        data:{reportId:report.id,sourceActorId:speaker.id,subjectId:report.subjectId,confidence:Math.round(report.confidence),method}
      });
    }

    this.decisionLog?.record?.({
      type:"contact_report_delivered",
      time:now,
      actorId:speaker.id,
      teamId:report.teamId,
      data:{reportId:report.id,subjectId:report.subjectId,recipientIds:[...recipientIds],confidence:Math.round(report.confidence),method}
    });
    return report;
  }

  hasReportFrom(teamId,sourceActorId,subjectId){
    return this.getTeamReports(teamId).some(report=>report.sourceActorId===sourceActorId&&report.subjectId===subjectId);
  }

  getTeamReports(teamId){
    return [...(this.reportsByTeam.get(teamId)?.values()??[])].sort((a,b)=>b.reportedAt-a.reportedAt);
  }

  getTeamContacts(teamId){
    const bySubject=new Map();
    for(const report of this.getTeamReports(teamId)){
      const existing=bySubject.get(report.subjectId);
      if(!existing||report.confidence>existing.confidence||report.reportedAt>existing.reportedAt)bySubject.set(report.subjectId,report);
    }
    return [...bySubject.values()].sort((a,b)=>b.confidence-a.confidence);
  }

  getBestTeamContact(teamId){
    return this.getTeamContacts(teamId)[0]??null;
  }

  getReceivedContacts(actorId){
    return [...(this.receivedByActor.get(actorId)?.values()??[])].sort((a,b)=>b.confidence-a.confidence);
  }

  getBestReceivedContact(actorId){
    return this.getReceivedContacts(actorId)[0]??null;
  }

  update(delta,{now=0}={}){
    const removedReportIds=new Set();
    for(const [teamId,reports] of this.reportsByTeam){
      for(const [reportId,report] of reports){
        const age=Math.max(0,now-report.reportedAt);
        if(age>8)report.confidence=clamp(report.confidence-Math.max(0,delta)*.8,0,88);
        report.lastUpdatedAt=now;
        if(report.confidence<=0){reports.delete(reportId);removedReportIds.add(reportId);}
      }
      if(!reports.size)this.reportsByTeam.delete(teamId);
    }
    for(const [actorId,reports] of this.receivedByActor){
      for(const id of removedReportIds)reports.delete(id);
      for(const report of reports.values()){
        const authoritative=this.reportsByTeam.get(report.teamId)?.get(report.id);
        if(authoritative)report.confidence=authoritative.confidence;
      }
      if(!reports.size)this.receivedByActor.delete(actorId);
    }
  }

  reportCount(){
    let total=0;
    for(const reports of this.reportsByTeam.values())total+=reports.size;
    return total;
  }

  recipientCount(){
    let total=0;
    for(const reports of this.receivedByActor.values())total+=reports.size;
    return total;
  }

  summary(){
    return [...this.reportsByTeam.entries()].map(([teamId,reports])=>({
      teamId,
      reports:[...reports.values()].map(report=>({...report,approximatePosition:{...report.approximatePosition},recipientIds:[...report.recipientIds]}))
    }));
  }
}
