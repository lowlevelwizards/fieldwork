const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function stableAngle(observerId,subjectId){
  const text=`${observerId}>${subjectId}`;
  let hash=2166136261;
  for(const character of text){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return ((hash>>>0)%3600)/3600*Math.PI*2;
}

function approximatePosition(observer,target,evidence,confidence){
  const uncertainty=6+(evidence.concealment??0)*90+(1-confidence/100)*52;
  const angle=stableAngle(observer.id,target.id);
  return{
    x:target.x+Math.cos(angle)*uncertainty,
    y:target.y+Math.sin(angle)*uncertainty
  };
}

function contactLevel(confidence){
  if(confidence>=70)return "tracked";
  if(confidence>=35)return "observed";
  return "glimpse";
}

export class PersonalKnowledgeStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.contactsByObserver=new Map();
  }

  getContacts(observerId){
    return [...(this.contactsByObserver.get(observerId)?.values()??[])]
      .sort((a,b)=>b.confidence-a.confidence);
  }

  getBestContact(observerId){
    return this.getContacts(observerId)[0]??null;
  }

  getContact(observerId,subjectId){
    return this.contactsByObserver.get(observerId)?.get(subjectId)??null;
  }

  observe({observer,target,evidence,now=0,delta=0}={}){
    if(!observer?.id||!target?.id||!evidence?.visible)return null;
    if(!this.contactsByObserver.has(observer.id))this.contactsByObserver.set(observer.id,new Map());
    const contacts=this.contactsByObserver.get(observer.id);
    let record=contacts.get(target.id);
    const created=!record;
    if(!record){
      record={
        observerId:observer.id,
        subjectId:target.id,
        classification:"armed_person",
        identity:"unknown",
        factionId:null,
        confidence:8,
        level:"glimpse",
        approximatePosition:approximatePosition(observer,target,evidence,8),
        lastObservedAt:now,
        currentlyVisible:true,
        concealment:evidence.concealment??0,
        distance:evidence.distance??null,
        observationCount:0
      };
      contacts.set(target.id,record);
    }

    const previousLevel=record.level;
    const wasVisible=record.currentlyVisible;
    record.confidence=clamp(record.confidence+(evidence.confidenceRate??10)*Math.max(0,delta),0,92);
    record.level=contactLevel(record.confidence);
    record.approximatePosition=approximatePosition(observer,target,evidence,record.confidence);
    record.lastObservedAt=now;
    record.currentlyVisible=true;
    record.concealment=evidence.concealment??0;
    record.distance=evidence.distance??record.distance;
    record.observationCount+=1;

    if(created){
      this.#record("personal_observation_created",observer,record,now,{classification:record.classification});
    }else if(!wasVisible){
      this.#record("personal_contact_reacquired",observer,record,now,{});
    }
    if(record.level!==previousLevel){
      this.#record("personal_contact_confidence_changed",observer,record,now,{from:previousLevel,to:record.level});
    }
    return record;
  }

  update(delta,{now=0,visibleByObserver=new Map()}={}){
    for(const [observerId,contacts] of this.contactsByObserver){
      const visibleIds=visibleByObserver.get(observerId)??new Set();
      for(const [subjectId,record] of contacts){
        if(visibleIds.has(subjectId))continue;
        if(record.currentlyVisible){
          record.currentlyVisible=false;
          this.#record("personal_contact_lost",{id:observerId},record,now,{lastPosition:{...record.approximatePosition}});
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

  summary(){
    return [...this.contactsByObserver.entries()].map(([observerId,contacts])=>({
      observerId,
      contacts:[...contacts.values()].map(record=>({...record,approximatePosition:{...record.approximatePosition}}))
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
