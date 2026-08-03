import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class ReactToIncomingFireAction extends AIV2Action{
  constructor({actorId,threat,duration=.7}={}){
    super({
      type:"ReactToIncomingFire",
      actorId,
      purpose:"Protect the body, orient to the threat direction, and create space for an urgent report.",
      channels:[ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,
      displayPriority:180,
      priority:1000,
      interruptible:false,
      metadata:{
        subjectId:threat?.subjectId??null,
        eventId:threat?.eventId??null,
        source:"personal_threat_evidence"
      }
    });
    this.threat=threat?{
      ...threat,
      approximatePosition:{...threat.approximatePosition}
    }:null;
    this.duration=Math.max(.25,Number(duration)||.7);
    this.elapsed=0;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.threat?.approximatePosition);
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.threat?.approximatePosition);
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(actor){
      actor.currentAction="Reacting to incoming fire";
      actor.workPose="brace";
      actor.aiV2ThreatReaction={
        status:"active",
        subjectId:this.threat.subjectId,
        sourcePoint:{...this.threat.approximatePosition},
        startedAt:now,
        progress:0
      };
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=Math.max(0,delta);
    this.progress=Math.min(1,this.elapsed/this.duration);
    services?.attention?.turnToward?.(actor,this.threat.approximatePosition,delta,{pose:"brace",turnRate:8});
    actor.currentAction="Taking immediate protection";
    actor.workPose="brace";
    actor.aiV2ThreatReaction={
      status:this.progress>=1?"completed":"active",
      subjectId:this.threat.subjectId,
      sourcePoint:{...this.threat.approximatePosition},
      startedAt:this.startedAt,
      completedAt:this.progress>=1?now:null,
      progress:this.progress
    };
    if(this.progress<1)return null;
    services?.threatKnowledge?.markReacted?.(actor.id,this.threat.subjectId,{now});
    return{status:"completed",reason:"immediate_threat_reaction_completed",data:{subjectId:this.threat.subjectId,eventId:this.threat.eventId}};
  }

  onInterrupted({game}={}){this.#release(game,"interrupted");}
  onCancelled({game}={}){this.#release(game,"cancelled");}

  #release(game,status){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    actor.aiV2ThreatReaction={...(actor.aiV2ThreatReaction??{}),status};
  }
}
