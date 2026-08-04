import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class ReactToIncomingFireAction extends AIV2Action{
  constructor({actorId,threat,duration=2.2}={}){
    super({
      type:"ReactToIncomingFire",
      actorId,
      purpose:"Break the exposed route, move to immediate directional cover, and orient toward the threat.",
      channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,
      displayPriority:200,
      priority:1250,
      interruptible:false,
      metadata:{subjectId:threat?.subjectId??null,eventId:threat?.eventId??null,source:"personal_threat_evidence"}
    });
    this.threat=threat?{...threat,approximatePosition:{...threat.approximatePosition}}:null;
    this.duration=Math.max(.8,Number(duration)||2.2);
    this.elapsed=0;
    this.destination=null;
    this.initialDistance=1;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.threat?.approximatePosition);
  }
  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.threat?.approximatePosition);
  }

  start(now,{game,services}={}){
    super.start(now,{game,services});
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    const teamActors=(game.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
    const cover=services?.directionalCover?.findBestSlot?.({
      game,actor,roleId:"immediate_survival",threatPoint:this.threat.approximatePosition,teamActors,
      policy:{maximumCoverDistance:430,maximumTravel:430,minimumProtection:.46,maximumCohesionDistance:720}
    })?.best??null;
    if(cover?.point)this.destination={...cover.point};
    else{
      const angle=Math.atan2(actor.y-this.threat.approximatePosition.y,actor.x-this.threat.approximatePosition.x);
      const side=String(actor.id).length%2?1:-1;
      this.destination={x:actor.x+Math.cos(angle+side*Math.PI/2)*150+Math.cos(angle)*55,y:actor.y+Math.sin(angle+side*Math.PI/2)*150+Math.sin(angle)*55};
    }
    this.initialDistance=Math.max(1,distance(actor,this.destination));
    actor.operationPausedByEncounter=true;
    actor.currentAction="Breaking the line of fire";
    actor.workPose="brace";
    actor.aiV2ThreatReaction={status:"moving_to_cover",subjectId:this.threat.subjectId,sourcePoint:{...this.threat.approximatePosition},destination:{...this.destination},startedAt:now,progress:0};
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=Math.max(0,delta);
    services?.attention?.turnToward?.(actor,this.threat.approximatePosition,delta,{pose:"brace",turnRate:9});
    const movement=services?.locomotion?.moveToward?.(actor,this.destination,delta,{game,speedMultiplier:.96,arrivalRadius:20,task:"Seeking immediate cover",pose:"brace"})??{arrived:false,distance:this.initialDistance};
    this.progress=Math.max(0,Math.min(1,1-(movement.distance??distance(actor,this.destination))/this.initialDistance));
    actor.currentAction=movement.arrived?"Holding immediate cover":"Evading incoming fire";
    actor.workPose="brace";
    actor.aiV2ThreatReaction={status:movement.arrived?"in_cover":"moving_to_cover",subjectId:this.threat.subjectId,sourcePoint:{...this.threat.approximatePosition},destination:{...this.destination},startedAt:this.startedAt,progress:this.progress};
    if(!movement.arrived&&this.elapsed<this.duration)return null;
    services?.locomotion?.stop?.(actor,{pose:"brace"});
    services?.threatKnowledge?.markReacted?.(actor.id,this.threat.subjectId,{now});
    actor.aiV2ThreatReaction={...(actor.aiV2ThreatReaction??{}),status:"completed",completedAt:now,progress:1};
    return{status:"completed",reason:movement.arrived?"immediate_cover_reached":"emergency_evasion_completed",data:{subjectId:this.threat.subjectId,eventId:this.threat.eventId}};
  }

  onInterrupted({game}={}){this.#release(game,"interrupted");}
  onCancelled({game}={}){this.#release(game,"cancelled");}
  #release(game,status){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);if(actor){actor.operationPausedByEncounter=false;actor.aiV2ThreatReaction={...(actor.aiV2ThreatReaction??{}),status};}}
}
