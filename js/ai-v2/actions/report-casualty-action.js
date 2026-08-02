import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class ReportCasualtyAction extends AIV2Action{
  constructor({actorId,casualty,assignment}={}){
    super({
      type:"ReportCasualty",
      actorId,
      purpose:assignment?.report?.reason??"Report a witnessed friendly casualty to nearby teammates",
      channels:[ACTION_CHANNELS.COMMUNICATION],
      primary:true,
      displayPriority:110,
      metadata:{subjectId:casualty?.subjectId??null,reportKind:"casualty_initial"}
    });
    this.casualtySnapshot=casualty?{
      ...casualty,
      approximatePosition:casualty.approximatePosition?{...casualty.approximatePosition}:null,
      assessment:casualty.assessment?{...casualty.assessment}:null
    }:null;
    this.assignment=assignment??{};
    this.transmission=null;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const range=this.assignment?.report?.range??460;
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.casualtySnapshot&&services?.communication?.findVoiceRecipients?.(game,actor,{range})?.length);
  }
  canContinue({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious);}
  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    const range=this.assignment?.report?.range??460;
    this.transmission=context.services.communication.beginContactReport({game:context.game,speaker:actor,contact:this.casualtySnapshot,reportKind:"casualty_initial",now,range,duration:1.05});
    if(actor){
      actor.currentAction="Reporting friendly casualty";
      actor.aiV2Communication={status:this.transmission?"reporting_casualty":"failed",reportKind:"casualty_initial",subjectId:this.casualtySnapshot.subjectId,recipientIds:[...(this.transmission?.recipientIds??[])],progress:0,startedAt:now};
    }
  }
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.transmission)return{status:"failed",reason:"communication_session_missing"};
    const result=services.communication.advanceContactReport(this.transmission,delta,{game,now});
    this.progress=result.progress??0;
    actor.aiV2Communication={status:result.status==="completed"?"casualty_report_delivered":"reporting_casualty",reportKind:"casualty_initial",subjectId:this.casualtySnapshot.subjectId,recipientIds:[...(result.recipientIds??this.transmission.recipientIds)],progress:this.progress,startedAt:this.transmission.startedAt,completedAt:result.status==="completed"?now:null};
    actor.currentAction=result.status==="active"?"Reporting friendly casualty":"Casualty report delivered";
    if(result.status==="failed")return{status:"failed",reason:result.reason??"communication_failed"};
    if(result.status!=="completed")return null;
    const report=services.casualtyKnowledge.receiveInitialReport({speaker:actor,casualtyRecord:this.casualtySnapshot,recipientIds:result.recipientIds,method:this.transmission.method,now});
    if(!report)return{status:"failed",reason:"casualty_report_delivery_failed"};
    return{status:"completed",reason:"casualty_report_delivered",data:{reportId:report.id,subjectId:report.subjectId,recipientIds:[...report.recipientIds]}};
  }
}
