const distanceBetween=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const normalizeAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

function directedAngleTo(source,target){return Math.atan2((target?.y??0)-(source?.y??0),(target?.x??0)-(source?.x??0));}


function cloneContact(contact={}){
  return{
    subjectId:contact.subjectId,
    classification:contact.classification,
    identity:contact.identity,
    factionId:contact.factionId,
    confidence:contact.confidence,
    level:contact.level,
    approximatePosition:contact.approximatePosition?{...contact.approximatePosition}:null,
    previousApproximatePosition:contact.previousApproximatePosition?{...contact.previousApproximatePosition}:null,
    lastObservedAt:contact.lastObservedAt,
    currentlyVisible:Boolean(contact.currentlyVisible),
    activity:contact.activity??contact.track?.currentActivity??null,
    activityLabel:contact.activityLabel??contact.track?.activityLabel??null,
    activityReason:contact.activityReason??contact.track?.activityReason??null,
    activityRevision:contact.activityRevision??contact.track?.activityRevision??0,
    movementDirection:contact.movementDirection??contact.track?.movementDirection??null,
    estimatedSpeed:contact.estimatedSpeed??contact.track?.estimatedSpeed??0,
    intentHypothesis:contact.intentHypothesis?{...contact.intentHypothesis}:contact.track?.intentHypothesis?{...contact.track.intentHypothesis}:null
  };
}

export class CommunicationExecutor{
  constructor({voiceRange=380,baseDuration=1.15}={}){
    this.voiceRange=voiceRange;
    this.baseDuration=baseDuration;
  }

  findVoiceRecipients(game,speaker,{range=this.voiceRange}={}){
    if(!speaker?.teamId)return[];
    return game.actors.filter(actor=>
      actor.id!==speaker.id&&
      actor.teamId===speaker.teamId&&
      !actor.medical?.dead&&
      !actor.medical?.unconscious&&
      distanceBetween(actor,speaker)<=range
    );
  }

  beginContactReport({game,speaker,contact,reportKind="initial_contact",now=0,range=this.voiceRange,duration=this.baseDuration}={}){
    const recipients=this.findVoiceRecipients(game,speaker,{range});
    if(!speaker||!contact||!recipients.length)return null;
    return{
      method:"local_voice",
      reportKind,
      speakerId:speaker.id,
      teamId:speaker.teamId,
      subjectId:contact.subjectId,
      contact:cloneContact(contact),
      recipientIds:recipients.map(actor=>actor.id),
      startedAt:now,
      elapsed:0,
      duration:Math.max(.2,duration),
      range,
      completed:false
    };
  }

  advanceContactReport(session,delta,{game,now=0}={}){
    if(!session)return{status:"failed",reason:"communication_session_missing",progress:0,recipientIds:[]};
    const speaker=game.actors.find(actor=>actor.id===session.speakerId);
    if(!speaker||speaker.medical?.dead||speaker.medical?.unconscious){
      return{status:"failed",reason:"speaker_unavailable",progress:session.elapsed/session.duration,recipientIds:[]};
    }

    session.elapsed+=Math.max(0,delta);
    const progress=Math.min(1,session.elapsed/Math.max(.01,session.duration));
    if(progress<1)return{status:"active",progress,recipientIds:[...session.recipientIds]};

    const validRecipientIds=session.recipientIds.filter(id=>{
      const actor=game.actors.find(candidate=>candidate.id===id);
      return actor&&actor.teamId===speaker.teamId&&!actor.medical?.dead&&!actor.medical?.unconscious&&distanceBetween(actor,speaker)<=session.range;
    });
    if(!validRecipientIds.length)return{status:"failed",reason:"no_recipients_in_range",progress:1,recipientIds:[]};

    session.completed=true;
    session.completedAt=now;
    return{status:"completed",progress:1,recipientIds:validRecipientIds};
  }

  findDirectedRecipients(game,speaker,{targetPoint,range=1120,coneDegrees=88}={}){
    if(!speaker?.teamId||!targetPoint)return[];
    const centerAngle=directedAngleTo(speaker,targetPoint);
    const halfCone=Math.max(10,Math.min(180,coneDegrees))*Math.PI/360;
    return game.actors.filter(actor=>{
      if(actor.id===speaker.id||actor.teamId===speaker.teamId||actor.medical?.dead||actor.medical?.unconscious)return false;
      if(distanceBetween(actor,speaker)>range)return false;
      const angle=directedAngleTo(speaker,actor);
      return Math.abs(normalizeAngle(angle-centerAngle))<=halfCone;
    });
  }

  beginDirectedWarning({game,speaker,targetPoint,message,warningType="stop_and_identify",now=0,range=1120,coneDegrees=88,duration=1.45}={}){
    const recipients=this.findDirectedRecipients(game,speaker,{targetPoint,range,coneDegrees});
    if(!speaker||!targetPoint||!message||!recipients.length)return null;
    return{
      method:"raised_voice",
      communicationKind:"directed_warning",
      warningType,
      message,
      speakerId:speaker.id,
      sourceTeamId:speaker.teamId,
      targetPoint:{...targetPoint},
      recipientIds:recipients.map(actor=>actor.id),
      startedAt:now,
      elapsed:0,
      duration:Math.max(.3,duration),
      range,
      coneDegrees,
      completed:false
    };
  }

  advanceDirectedWarning(session,delta,{game,now=0}={}){
    if(!session)return{status:"failed",reason:"communication_session_missing",progress:0,recipientIds:[]};
    const speaker=game.actors.find(actor=>actor.id===session.speakerId);
    if(!speaker||speaker.medical?.dead||speaker.medical?.unconscious){
      return{status:"failed",reason:"speaker_unavailable",progress:session.elapsed/session.duration,recipientIds:[]};
    }
    session.elapsed+=Math.max(0,delta);
    const progress=Math.min(1,session.elapsed/Math.max(.01,session.duration));
    if(progress<1)return{status:"active",progress,recipientIds:[...session.recipientIds]};
    const currentlyAudible=new Set(this.findDirectedRecipients(game,speaker,{
      targetPoint:session.targetPoint,
      range:session.range,
      coneDegrees:session.coneDegrees
    }).map(actor=>actor.id));
    const validRecipientIds=session.recipientIds.filter(id=>currentlyAudible.has(id));
    if(!validRecipientIds.length)return{status:"failed",reason:"no_recipients_in_directed_voice",progress:1,recipientIds:[]};
    session.completed=true;
    session.completedAt=now;
    return{status:"completed",progress:1,recipientIds:validRecipientIds};
  }
}
