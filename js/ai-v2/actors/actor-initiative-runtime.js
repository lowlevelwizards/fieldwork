import { ReactToIncomingFireAction } from "../actions/react-to-incoming-fire-action.js";
import { ReportContactAction } from "../actions/report-contact-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

export class ActorInitiativeRuntime{
  constructor({scheduler,threatKnowledge,decisionLog=null,arbiter=null}={}){
    this.scheduler=scheduler;
    this.arbiter=arbiter;
    this.threatKnowledge=threatKnowledge;
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,teamKnowledge,now=0,context={}}={}){
    const active=new Map();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious)continue;
      const threat=this.threatKnowledge?.getBestThreat?.(actor.id)??null;
      if(!threat)continue;
      const record={
        actorId:actor.id,
        subjectId:threat.subjectId,
        confidence:threat.confidence,
        immediate:now<=threat.immediateUntil,
        reacted:Boolean(threat.reacted),
        reactionActionId:null,
        reportActionId:null
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
