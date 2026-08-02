const distanceBetween=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class CommunicationExecutor{
  constructor({voiceRange=380,baseDuration=1.15}={}){
    this.voiceRange=voiceRange;
    this.baseDuration=baseDuration;
  }

  findVoiceRecipients(game,speaker,{range=this.voiceRange}={}){
    if(!speaker?.teamId)return [];
    return game.actors.filter(actor=>
      actor.id!==speaker.id&&
      actor.teamId===speaker.teamId&&
      !actor.medical?.dead&&
      !actor.medical?.unconscious&&
      distanceBetween(actor,speaker)<=range
    );
  }

  beginContactReport({game,speaker,contact,now=0,range=this.voiceRange}={}){
    const recipients=this.findVoiceRecipients(game,speaker,{range});
    if(!speaker||!contact||!recipients.length)return null;
    return{
      method:"local_voice",
      speakerId:speaker.id,
      teamId:speaker.teamId,
      subjectId:contact.subjectId,
      contact:{
        subjectId:contact.subjectId,
        classification:contact.classification,
        identity:contact.identity,
        factionId:contact.factionId,
        confidence:contact.confidence,
        level:contact.level,
        approximatePosition:{...contact.approximatePosition},
        lastObservedAt:contact.lastObservedAt,
        currentlyVisible:Boolean(contact.currentlyVisible)
      },
      recipientIds:recipients.map(actor=>actor.id),
      startedAt:now,
      elapsed:0,
      duration:this.baseDuration,
      range,
      completed:false
    };
  }

  advanceContactReport(session,delta,{game,now=0}={}){
    if(!session)return {status:"failed",reason:"communication_session_missing",progress:0,recipientIds:[]};
    const speaker=game.actors.find(actor=>actor.id===session.speakerId);
    if(!speaker||speaker.medical?.dead||speaker.medical?.unconscious){
      return {status:"failed",reason:"speaker_unavailable",progress:session.elapsed/session.duration,recipientIds:[]};
    }

    session.elapsed+=Math.max(0,delta);
    const progress=Math.min(1,session.elapsed/Math.max(.01,session.duration));
    if(progress<1)return {status:"active",progress,recipientIds:[...session.recipientIds]};

    const validRecipientIds=session.recipientIds.filter(id=>{
      const actor=game.actors.find(candidate=>candidate.id===id);
      return actor&&actor.teamId===speaker.teamId&&!actor.medical?.dead&&!actor.medical?.unconscious&&distanceBetween(actor,speaker)<=session.range;
    });
    if(!validRecipientIds.length)return {status:"failed",reason:"no_recipients_in_range",progress:1,recipientIds:[]};

    session.completed=true;
    session.completedAt=now;
    return {status:"completed",progress:1,recipientIds:validRecipientIds};
  }
}
