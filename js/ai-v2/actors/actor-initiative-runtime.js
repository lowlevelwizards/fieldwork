import { ReactToIncomingFireAction } from "../actions/react-to-incoming-fire-action.js";
import { ReportContactAction } from "../actions/report-contact-action.js";
import { SelfAidAction } from "../actions/self-aid-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

export class ActorInitiativeRuntime{
  constructor({scheduler,threatKnowledge,decisionLog=null,arbiter=null}={}){
    this.scheduler=scheduler;
    this.arbiter=arbiter;
    this.threatKnowledge=threatKnowledge;
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,teamKnowledge,tacticalPictures=null,now=0,context={}}={}){
    const active=new Map();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious)continue;
      const assessment=game?.wounds?.getAssessment?.(actor)??null;
      const treatmentNeed=game?.wounds?.getTreatmentNeed?.(actor)??null;
      const bleeding=Number(assessment?.bleeding??actor.medical?.bleedingRate??0);
      const selfAidUrgent=Boolean(treatmentNeed&&bleeding>.05&&Number(actor.aiV2MedicalSupplies?.[treatmentNeed.type]??0)>0);
      const tacticalPicture=tacticalPictures?.get?.(actor.id)??null;
      const activeFire=Boolean(tacticalPicture?.incomingFire?.length||tacticalPicture?.visibleThreats?.length&&tacticalPicture?.exposed);
      const treatmentSafe=Boolean(tacticalPicture?.currentCover?.protected&&!activeFire||!tacticalPicture?.threatPoint);
      const catastrophic=bleeding>1.2||actor.medical?.condition==="critical";
      const mayTreatHere=catastrophic||treatmentSafe;
      if(selfAidUrgent&&mayTreatHere&&!this.scheduler.hasAction(actor.id,"SelfAid")){
        const action=new SelfAidAction({actorId:actor.id,duration:bleeding>1.2?2.1:2.8});
        const onGranted=result=>this.#record("actor_initiative_started",actor,now,{actionType:action.type,reason:catastrophic?"catastrophic_personal_bleeding":"protected_personal_bleeding",bleeding,treatmentType:treatmentNeed.type});
        if(this.arbiter)this.arbiter.submit({
          actorId:actor.id,action,score:1,urgency:Math.min(1,.72+bleeding*.18),
          authorityTier:ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL,
          authorityLabel:"Immediate survival",reason:catastrophic?"Catastrophic bleeding justifies immediate aid despite exposure.":"A conscious operator may perform self aid only after reaching a protected treatment window.",
          source:"actor_initiative",operationId:actor.operationId??null,missionId:actor.squadMission??null,onGranted
        });
        else{const result=this.scheduler.start(action,{now,context});if(result.ok)onGranted(result);}
      }
      const threat=this.threatKnowledge?.getBestThreat?.(actor.id)??null;
      if(!threat){
        if(selfAidUrgent)active.set(actor.id,{actorId:actor.id,subjectId:null,confidence:0,immediate:true,reacted:false,reactionActionId:null,reportActionId:null,selfAidActionId:this.scheduler.getAction(actor.id,"SelfAid")?.id??null});
        continue;
      }
      const record={
        actorId:actor.id,
        subjectId:threat.subjectId,
        confidence:threat.confidence,
        immediate:now<=threat.immediateUntil,
        reacted:Boolean(threat.reacted),
        reactionActionId:null,
        reportActionId:null,
        selfAidActionId:this.scheduler.getAction(actor.id,"SelfAid")?.id??null
      };

      if(record.immediate&&!threat.reacted&&!this.scheduler.hasAction(actor.id,"ReactToIncomingFire")){
        const action=new ReactToIncomingFireAction({actorId:actor.id,threat});
        const onGranted=result=>{
          record.reactionActionId=result.action?.id??action.id;
          this.#record("actor_initiative_started",actor,now,{actionType:action.type,subjectId:threat.subjectId,reason:"immediate_personal_threat"});
        };
        if(this.arbiter)this.arbiter.submit({
          actorId:actor.id,action,score:1,urgency:1,
          authorityTier:ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL,
          authorityLabel:"Immediate survival",reason:"Personally perceived incoming fire requires an immediate physical reaction.",
          source:"actor_initiative",operationId:actor.operationId??null,missionId:actor.squadMission??null,onGranted
        });
        else{
          const result=this.scheduler.start(action,{now,context});
          if(result.ok)onGranted(result);
        }
      }else{
        record.reactionActionId=this.scheduler.getAction(actor.id,"ReactToIncomingFire")?.id??null;
      }

      const alreadyReported=teamKnowledge?.hasReportFrom?.(actor.teamId,actor.id,threat.subjectId)??false;
      if(!alreadyReported&&threat.confidence>=45&&!this.scheduler.hasAction(actor.id,"ReportContact")){
        const assignment={
          report:{
            method:"local_voice",
            range:560,
            minimumConfidence:45,
            reason:"Report immediate hostile fire using only the personally perceived threat direction."
          }
        };
        const action=new ReportContactAction({actorId:actor.id,contact:threat,assignment});
        const onGranted=result=>{
          record.reportActionId=result.action?.id??action.id;
          this.#record("actor_initiative_started",actor,now,{actionType:action.type,subjectId:threat.subjectId,reason:"urgent_threat_report"});
        };
        if(this.arbiter)this.arbiter.submit({
          actorId:actor.id,action,score:.98,urgency:.96,
          authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,
          authorityLabel:"Governing team response",reason:"A personally perceived hostile direction must be reported before it can govern team behavior.",
          source:"actor_initiative",operationId:actor.operationId??null,missionId:actor.squadMission??null,onGranted
        });
        else{
          const result=this.scheduler.start(action,{now,context});
          if(result.ok)onGranted(result);
        }
      }else{
        record.reportActionId=this.scheduler.getAction(actor.id,"ReportContact")?.id??null;
      }
      active.set(actor.id,record);
    }
    this.byActor=active;
  }

  summary(){return[...this.byActor.values()].map(item=>({...item}));}

  #record(type,actor,now,data){
    this.decisionLog?.record?.({type,time:now,actorId:actor.id,teamId:actor.teamId,data});
  }
}
