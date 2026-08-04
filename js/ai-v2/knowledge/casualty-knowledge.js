const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
let nextCasualtyReportSequence=1;

function cloneAssessment(assessment){
  if(!assessment)return null;
  return{
    ...assessment,
    activeWounds:(assessment.activeWounds??[]).map(wound=>({...wound})),
    treatmentNeed:assessment.treatmentNeed?{...assessment.treatmentNeed}:null
  };
}

function cloneRecord(record){
  return record?{
    ...record,
    approximatePosition:record.approximatePosition?{...record.approximatePosition}:null,
    recipientIds:[...(record.recipientIds??[])],
    assessment:cloneAssessment(record.assessment)
  }:null;
}

function visibleCondition(casualty){
  const medical=casualty?.medical;
  if(medical?.dead)return"dead";
  if(medical?.unconscious)return"unconscious";
  if(medical?.condition==="critical")return"critical";
  if(medical?.condition==="serious")return"serious";
  return medical?.condition??"unknown";
}

export class CasualtyKnowledgeStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.personalByObserver=new Map();
    this.teamByTeam=new Map();
    this.receivedByActor=new Map();
    this.initialReportKeys=new Set();
  }

  observe({observer,casualty,evidence,now=0,delta=0}={}){
    if(!observer?.id||!casualty?.id||observer.teamId!==casualty.teamId||!evidence?.visible)return null;
    if(!this.personalByObserver.has(observer.id))this.personalByObserver.set(observer.id,new Map());
    const records=this.personalByObserver.get(observer.id);
    let record=records.get(casualty.id);
    const created=!record;
    if(!record){
      record={
        observerId:observer.id,
        teamId:observer.teamId,
        subjectId:casualty.id,
        subjectName:casualty.name,
        classification:"friendly_casualty",
        identity:"known_teammate",
        confidence:58,
        observedCondition:visibleCondition(casualty),
        mobility:"unable_to_self_move",
        urgency:"urgent",
        approximatePosition:{x:casualty.x+4,y:casualty.y-3},
        currentlyVisible:true,
        firstObservedAt:now,
        lastObservedAt:now,
        observationCount:0,
        assessment:null,
        assessmentRevision:0
      };
      records.set(casualty.id,record);
    }
    record.confidence=clamp(record.confidence+(evidence.confidenceRate??16)*Math.max(0,delta),0,96);
    record.observedCondition=visibleCondition(casualty);
    record.mobility=["critical","unconscious"].includes(record.observedCondition)?"unable_to_self_move":"impaired";
    record.urgency=["critical","unconscious"].includes(record.observedCondition)?"urgent":"elevated";
    record.approximatePosition={x:casualty.x+4,y:casualty.y-3};
    record.currentlyVisible=true;
    record.lastObservedAt=now;
    record.observationCount+=1;
    if(created)this.#record("personal_casualty_observation_created",observer.id,observer.teamId,now,{subjectId:casualty.id,condition:record.observedCondition,confidence:Math.round(record.confidence)});
    return cloneRecord(record);
  }

  markNotVisible(observerId,visibleIds=new Set(),now=0){
    const records=this.personalByObserver.get(observerId);
    if(!records)return;
    for(const record of records.values()){
      if(visibleIds.has(record.subjectId))continue;
      if(record.currentlyVisible){
        record.currentlyVisible=false;
        this.#record("personal_casualty_lost",observerId,record.teamId,now,{subjectId:record.subjectId});
      }
    }
  }

  receiveInitialReport({speaker,casualtyRecord,recipientIds=[],method="local_voice",now=0}={}){
    if(!speaker?.teamId||!casualtyRecord?.subjectId||!recipientIds.length)return null;
    const report={
      id:`v2_casualty_report_${nextCasualtyReportSequence++}`,
      reportKind:"casualty_initial",
      teamId:speaker.teamId,
      sourceActorId:speaker.id,
      subjectId:casualtyRecord.subjectId,
      subjectName:casualtyRecord.subjectName,
      classification:"friendly_casualty",
      identity:"known_teammate",
      confidence:clamp((casualtyRecord.confidence??0)*.9,0,94),
      observedCondition:casualtyRecord.observedCondition,
      mobility:casualtyRecord.mobility,
      urgency:casualtyRecord.urgency,
      approximatePosition:{...casualtyRecord.approximatePosition},
      assessment:null,
      assessmentRevision:0,
      method,
      recipientIds:[...recipientIds],
      reportedAt:now,
      lastUpdatedAt:now
    };
    this.initialReportKeys.add(`${speaker.teamId}:${speaker.id}:${casualtyRecord.subjectId}`);
    this.#storeTeamReport(report);
    this.#deliverToActors(report,recipientIds,now,"casualty_report_received");
    this.#record("casualty_report_delivered",speaker.id,speaker.teamId,now,{reportId:report.id,subjectId:report.subjectId,recipientIds:[...recipientIds]});
    return cloneRecord(report);
  }

  recordAssessment({assessor,casualty,assessment,recipientIds=[],method="local_voice",now=0}={}){
    if(!assessor?.teamId||!casualty?.id||!assessment)return null;
    const normalized={
      condition:assessment.condition,
      conscious:Boolean(assessment.conscious),
      dead:Boolean(assessment.dead),
      bleeding:Number(assessment.bleeding??0),
      blood:Number(assessment.blood??0),
      shock:Number(assessment.shock??0),
      mobility:assessment.dead?"none":assessment.conscious&&assessment.condition!=="critical"?"impaired":"requires_assisted_movement",
      immediateDanger:Number(assessment.bleeding??0)>.05||["critical","unconscious"].includes(assessment.condition),
      activeWounds:(assessment.active??[]).map(wound=>({id:wound.id,region:wound.region,severity:wound.severity,controlled:Boolean(wound.controlled)})),
      treatmentNeed:assessment.need?{...assessment.need}:null,
      assessedAt:now,
      assessedBy:assessor.id
    };
    if(!this.personalByObserver.has(assessor.id))this.personalByObserver.set(assessor.id,new Map());
    const personal=this.personalByObserver.get(assessor.id);
    const existing=personal.get(casualty.id)??{
      observerId:assessor.id,teamId:assessor.teamId,subjectId:casualty.id,subjectName:casualty.name,
      classification:"friendly_casualty",identity:"known_teammate",confidence:96,
      observedCondition:visibleCondition(casualty),mobility:normalized.mobility,urgency:"urgent",
      approximatePosition:{x:casualty.x,y:casualty.y},currentlyVisible:true,firstObservedAt:now,lastObservedAt:now,observationCount:1,
      assessment:null,assessmentRevision:0
    };
    existing.assessment=normalized;
    existing.assessmentRevision=(existing.assessmentRevision??0)+1;
    existing.observedCondition=normalized.condition;
    existing.mobility=normalized.mobility;
    existing.confidence=98;
    existing.lastObservedAt=now;
    personal.set(casualty.id,existing);

    const report={
      id:`v2_casualty_report_${nextCasualtyReportSequence++}`,
      reportKind:"casualty_assessment",
      teamId:assessor.teamId,
      sourceActorId:assessor.id,
      subjectId:casualty.id,
      subjectName:casualty.name,
      classification:"friendly_casualty",
      identity:"known_teammate",
      confidence:96,
      observedCondition:normalized.condition,
      mobility:normalized.mobility,
      urgency:normalized.immediateDanger?"urgent":"elevated",
      approximatePosition:{x:casualty.x,y:casualty.y},
      assessment:normalized,
      assessmentRevision:existing.assessmentRevision,
      method,
      recipientIds:[...recipientIds],
      reportedAt:now,
      lastUpdatedAt:now
    };
    this.#storeTeamReport(report);
    this.#deliverToActors(report,recipientIds,now,"casualty_assessment_received");
    this.#record("casualty_assessment_shared",assessor.id,assessor.teamId,now,{reportId:report.id,subjectId:casualty.id,recipientIds:[...recipientIds],treatmentNeed:normalized.treatmentNeed?.type??null});
    return cloneRecord(report);
  }

  getPersonalCasualties(observerId){return[...(this.personalByObserver.get(observerId)?.values()??[])].map(cloneRecord);}
  getBestPersonalCasualty(observerId){return this.getPersonalCasualties(observerId).sort((a,b)=>b.confidence-a.confidence)[0]??null;}
  getTeamCasualties(teamId){return[...(this.teamByTeam.get(teamId)?.values()??[])].sort((a,b)=>(b.assessmentRevision??0)-(a.assessmentRevision??0)||b.reportedAt-a.reportedAt).map(cloneRecord);}
  getBestTeamCasualty(teamId){return this.getTeamCasualties(teamId)[0]??null;}
  getReceivedCasualties(actorId){return[...(this.receivedByActor.get(actorId)?.values()??[])].sort((a,b)=>b.reportedAt-a.reportedAt).map(cloneRecord);}
  getLatestReceived(actorId){return this.getReceivedCasualties(actorId)[0]??null;}
  hasInitialReport(teamId,sourceActorId,subjectId){
    return this.initialReportKeys.has(`${teamId}:${sourceActorId}:${subjectId}`);
  }
  count(){let total=0;for(const records of this.teamByTeam.values())total+=records.size;return total;}
  summary(){return[...this.teamByTeam.entries()].map(([teamId,records])=>({teamId,casualties:[...records.values()].map(cloneRecord)}));}

  #storeTeamReport(report){
    if(!this.teamByTeam.has(report.teamId))this.teamByTeam.set(report.teamId,new Map());
    this.teamByTeam.get(report.teamId).set(report.subjectId,report);
  }

  #deliverToActors(report,recipientIds,now,type){
    for(const actorId of recipientIds){
      if(!this.receivedByActor.has(actorId))this.receivedByActor.set(actorId,new Map());
      this.receivedByActor.get(actorId).set(report.subjectId,cloneRecord(report));
      this.#record(type,actorId,report.teamId,now,{reportId:report.id,sourceActorId:report.sourceActorId,subjectId:report.subjectId,reportKind:report.reportKind});
    }
  }

  #record(type,actorId,teamId,time,data={}){this.decisionLog?.record?.({type,actorId,teamId,time,data});}
}
