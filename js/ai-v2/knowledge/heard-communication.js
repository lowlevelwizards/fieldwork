const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
let nextWarningSequence=1;

function stableAngle(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%3600)/3600*Math.PI*2;
}

function approximateSource(speaker,warningId){
  const angle=stableAngle(`${warningId}:${speaker.id}`);
  const error=22;
  return{x:speaker.x+Math.cos(angle)*error,y:speaker.y+Math.sin(angle)*error};
}

function cloneWarning(warning){
  return warning?{
    ...warning,
    targetPoint:warning.targetPoint?{...warning.targetPoint}:null,
    approximateSourcePosition:warning.approximateSourcePosition?{...warning.approximateSourcePosition}:null,
    recipientIds:[...(warning.recipientIds??[])]
  }:null;
}

export class HeardCommunicationStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byActor=new Map();
    this.byRecipientTeam=new Map();
    this.outgoingByTeam=new Map();
  }

  receiveWarning({game,speaker,recipientIds=[],message,warningType="stop_and_identify",targetPoint=null,now=0,method="raised_voice",range=1120}={}){
    if(!speaker?.teamId||!recipientIds.length||!message)return null;
    const warningId=`v2_warning_${nextWarningSequence++}`;
    const recipientActors=recipientIds.map(id=>game?.actors?.find?.(actor=>actor.id===id)).filter(Boolean);
    const recipientTeamId=recipientActors[0]?.teamId??null;
    const warning={
      id:warningId,
      kind:"directed_warning",
      warningType,
      message,
      meaning:warningType,
      method,
      sourceActorId:speaker.id,
      sourceTeamId:speaker.teamId,
      sourceFactionId:speaker.factionId??null,
      recipientTeamId,
      recipientIds:[...recipientIds],
      targetPoint:targetPoint?{...targetPoint}:null,
      approximateSourcePosition:approximateSource(speaker,warningId),
      directedAtUs:"likely",
      confidence:88,
      heardAt:now,
      issuedAt:now,
      range,
      relationship:recipientActors[0]&&speaker.factionId===recipientActors[0].factionId?"same_faction":"unknown",
      hostile:false,
      enforcementUsed:false,
      enforcementUsedAt:null,
      enforcementEventId:null,
      response:null
    };

    this.outgoingByTeam.set(speaker.teamId,warning);
    if(recipientTeamId)this.byRecipientTeam.set(recipientTeamId,warning);
    for(const actorId of recipientIds){
      if(!this.byActor.has(actorId))this.byActor.set(actorId,[]);
      const entries=this.byActor.get(actorId);
      entries.unshift(cloneWarning(warning));
      if(entries.length>12)entries.length=12;
      this.decisionLog?.record?.({
        type:"directed_warning_heard",
        time:now,
        actorId,
        teamId:recipientTeamId,
        data:{warningId,warningType,sourceActorId:speaker.id,confidence:warning.confidence,directedAtUs:warning.directedAtUs}
      });
    }
    this.decisionLog?.record?.({
      type:"directed_warning_delivered",
      time:now,
      actorId:speaker.id,
      teamId:speaker.teamId,
      data:{warningId,warningType,message,recipientIds:[...recipientIds],recipientTeamId,method}
    });
    return cloneWarning(warning);
  }


  markEnforcementUsed(teamId,{now=0,eventId=null}={}){
    const warning=this.outgoingByTeam.get(teamId);
    if(!warning||warning.enforcementUsed)return false;
    warning.enforcementUsed=true;
    warning.enforcementUsedAt=now;
    warning.enforcementEventId=eventId;
    this.decisionLog?.record?.({type:"warning_enforcement_used",time:now,teamId,data:{warningId:warning.id,eventId}});
    return true;
  }

  getLatestForActor(actorId){return cloneWarning(this.byActor.get(actorId)?.[0]??null);}
  getLatestForTeam(teamId){return cloneWarning(this.byRecipientTeam.get(teamId)??null);}
  getLatestOutgoing(teamId){return cloneWarning(this.outgoingByTeam.get(teamId)??null);}

  count(){return this.byRecipientTeam.size;}

  summary(){
    return{
      incoming:[...this.byRecipientTeam.entries()].map(([teamId,warning])=>({teamId,warning:cloneWarning(warning)})),
      outgoing:[...this.outgoingByTeam.entries()].map(([teamId,warning])=>({teamId,warning:cloneWarning(warning)}))
    };
  }
}
