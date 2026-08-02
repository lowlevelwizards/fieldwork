import { cloneContactTrack, createContactTrack, markContactTrackLost, updateContactTrack } from "./contact-track.js?v=20j-observable-activity-intent-hypotheses-20260802";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function stableAngle(observerId,subjectId){
  const text=`${observerId}>${subjectId}`;
  let hash=2166136261;
  for(const character of text){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return ((hash>>>0)%3600)/3600*Math.PI*2;
}

function uncertaintyRadius(evidence,confidence){
  return 6+(evidence.concealment??0)*90+(1-confidence/100)*52;
}

function approximatePosition(observer,target,evidence,confidence){
  const uncertainty=uncertaintyRadius(evidence,confidence);
  const angle=stableAngle(observer.id,target.id);
  return{
    x:target.x+Math.cos(angle)*uncertainty,
    y:target.y+Math.sin(angle)*uncertainty
  };
}

function contactLevel(confidence){
  if(confidence>=70)return"tracked";
  if(confidence>=35)return"observed";
  return"glimpse";
}

function cloneRecord(record){
  return{
    ...record,
    approximatePosition:{...record.approximatePosition},
    track:cloneContactTrack(record.track)
  };
}

export class PersonalKnowledgeStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.contactsByObserver=new Map();
  }

  getContacts(observerId){
    return[...(this.contactsByObserver.get(observerId)?.values()??[])]
      .sort((a,b)=>b.confidence-a.confidence)
      .map(cloneRecord);
  }

  getBestContact(observerId){
    const contact=[...(this.contactsByObserver.get(observerId)?.values()??[])]
      .sort((a,b)=>b.confidence-a.confidence)[0]??null;
    return contact?cloneRecord(contact):null;
  }

  getContact(observerId,subjectId){
    const contact=this.contactsByObserver.get(observerId)?.get(subjectId)??null;
    return contact?cloneRecord(contact):null;
  }

  observe({observer,target,evidence,now=0,delta=0}={}){
    if(!observer?.id||!target?.id||!evidence?.visible)return null;
    if(!this.contactsByObserver.has(observer.id))this.contactsByObserver.set(observer.id,new Map());
    const contacts=this.contactsByObserver.get(observer.id);
    let record=contacts.get(target.id);
    const created=!record;
    if(!record){
      const initialPosition=approximatePosition(observer,target,evidence,8);
      record={
        observerId:observer.id,
        subjectId:target.id,
        classification:"armed_person",
        identity:"unknown",
        factionId:null,
        confidence:8,
        level:"glimpse",
        approximatePosition:initialPosition,
        lastObservedAt:now,
        currentlyVisible:true,
        concealment:evidence.concealment??0,
        distance:evidence.distance??null,
        observationCount:0,
        track:createContactTrack({observer,target,position:initialPosition,confidence:8,now})
      };
      contacts.set(target.id,record);
    }

    const previousLevel=record.level;
    const wasVisible=record.currentlyVisible;
    const previousActivityRevision=record.track?.activityRevision??0;
    record.confidence=clamp(record.confidence+(evidence.confidenceRate??10)*Math.max(0,delta),0,92);
    record.level=contactLevel(record.confidence);
    record.approximatePosition=approximatePosition(observer,target,evidence,record.confidence);
    record.lastObservedAt=now;
    record.currentlyVisible=true;
    record.concealment=evidence.concealment??0;
    record.distance=evidence.distance??record.distance;
    record.observationCount+=1;
    record.track=updateContactTrack({
      track:record.track,
      observer,
      target,
      position:record.approximatePosition,
      confidence:record.confidence,
      now,
      uncertainty:uncertaintyRadius(evidence,record.confidence),
      currentlyVisible:true
    });

    if(created){
      this.#record("personal_observation_created",observer,record,now,{classification:record.classification});
    }else if(!wasVisible){
      this.#record("personal_contact_reacquired",observer,record,now,{});
    }
    if(record.level!==previousLevel){
      this.#record("personal_contact_confidence_changed",observer,record,now,{from:previousLevel,to:record.level});
    }
    if((record.track?.activityRevision??0)>previousActivityRevision){
      this.#record("personal_contact_activity_changed",observer,record,now,{
        activity:record.track.currentActivity,
        activityRevision:record.track.activityRevision,
        direction:record.track.movementDirection,
        intentHypothesis:record.track.intentHypothesis?.id??"no_clear_intent",
        reason:record.track.activityReason
      });
    }
    return cloneRecord(record);
  }

  update(delta,{now=0,visibleByObserver=new Map()}={}){
    for(const [observerId,contacts] of this.contactsByObserver){
      const visibleIds=visibleByObserver.get(observerId)??new Set();
      for(const [subjectId,record] of contacts){
        if(visibleIds.has(subjectId))continue;
        if(record.currentlyVisible){
          record.currentlyVisible=false;
          const previousRevision=record.track?.activityRevision??0;
          record.track=markContactTrackLost({
            track:record.track,
            observer:{id:observerId},
            position:record.approximatePosition,
            confidence:record.confidence,
            now
          });
          this.#record("personal_contact_lost",{id:observerId},record,now,{lastPosition:{...record.approximatePosition}});
          if((record.track?.activityRevision??0)>previousRevision){
            this.#record("personal_contact_activity_changed",{id:observerId},record,now,{
              activity:"lost",
              activityRevision:record.track.activityRevision,
              intentHypothesis:record.track.intentHypothesis?.id??"no_clear_intent",
              reason:record.track.activityReason
            });
          }
        }
        const age=Math.max(0,now-record.lastObservedAt);
        const decayRate=age<2?1.25:age<8?2.4:4.5;
        record.confidence=clamp(record.confidence-decayRate*Math.max(0,delta),0,92);
        record.level=contactLevel(record.confidence);
        if(record.confidence<=0){
          contacts.delete(subjectId);
          this.#record("personal_contact_forgotten",{id:observerId},record,now,{});
        }
      }
      if(!contacts.size)this.contactsByObserver.delete(observerId);
    }
  }

  count(){
    let total=0;
    for(const contacts of this.contactsByObserver.values())total+=contacts.size;
    return total;
  }

  activityCount(){
    let total=0;
    for(const contacts of this.contactsByObserver.values())for(const record of contacts.values()){
      if((record.track?.activityRevision??0)>0)total+=1;
    }
    return total;
  }

  summary(){
    return[...this.contactsByObserver.entries()].map(([observerId,contacts])=>({
      observerId,
      contacts:[...contacts.values()].map(cloneRecord)
    }));
  }

  #record(type,observer,record,now,data){
    this.decisionLog?.record?.({
      type,
      time:now,
      actorId:observer.id,
      data:{
        subjectId:record.subjectId,
        confidence:Math.round(record.confidence),
        level:record.level,
        ...data
      }
    });
  }
}
