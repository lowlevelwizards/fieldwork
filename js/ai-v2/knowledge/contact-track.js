import { classifyObservedActivity, isMovingActivity } from "../senses/activity-classifier.js";
import { inferIntentHypothesis } from "./intent-hypothesis.js";

const clonePoint=point=>point?{x:point.x,y:point.y}:null;

export function createContactTrack({observer,target,position,confidence=0,now=0}={}){
  const facing=Number.isFinite(target?.lookAngle)?target.lookAngle:null;
  return{
    currentActivity:"stationary",
    activityLabel:"Stationary",
    activityReason:"Initial observation establishes a baseline; no activity change has yet been observed.",
    activityRevision:0,
    lastActivityChangedAt:now,
    lastMeaningfulMovementAt:null,
    lastSampleAt:now,
    samplePosition:clonePoint(position),
    activityAnchorPosition:clonePoint(position),
    previousApproximatePosition:null,
    currentApproximatePosition:clonePoint(position),
    movementDirection:"stationary",
    estimatedSpeed:0,
    displacement:0,
    facingEstimate:facing,
    facingTowardObserver:false,
    intentHypothesis:inferIntentHypothesis({activity:"stationary",confidence}),
    history:[{
      time:now,
      activity:"stationary",
      position:clonePoint(position),
      reason:"Initial visual baseline"
    }]
  };
}

export function updateContactTrack({track,observer,target,position,confidence=0,now=0,uncertainty=20,currentlyVisible=true}={}){
  if(!track)return createContactTrack({observer,target,position,confidence,now});
  const elapsed=Math.max(.01,now-(track.lastSampleAt??now));
  if(currentlyVisible&&elapsed<.32){
    track.currentApproximatePosition=clonePoint(position);
    track.facingEstimate=Number.isFinite(target?.lookAngle)?target.lookAngle:track.facingEstimate;
    return track;
  }

  const samplePosition=clonePoint(track.samplePosition??track.currentApproximatePosition??position);
  const sampleDisplacement=Math.hypot((position?.x??0)-(samplePosition?.x??0),(position?.y??0)-(samplePosition?.y??0));
  const currentlyMoving=isMovingActivity(track.currentActivity);
  if(currentlyMoving&&sampleDisplacement>6)track.lastMeaningfulMovementAt=now;
  const previousPosition=currentlyMoving
    ?samplePosition
    :clonePoint(track.activityAnchorPosition??samplePosition);
  const timeSinceMovement=track.lastMeaningfulMovementAt===null?Infinity:Math.max(0,now-track.lastMeaningfulMovementAt);
  const result=classifyObservedActivity({
    observer,
    previousPosition,
    currentPosition:position,
    previousActivity:track.currentActivity,
    targetFacing:Number.isFinite(target?.lookAngle)?target.lookAngle:track.facingEstimate,
    elapsed,
    uncertainty,
    timeSinceMeaningfulMovement:timeSinceMovement,
    wasVisible:currentlyVisible
  });

  const previousActivity=track.currentActivity;
  track.previousApproximatePosition=clonePoint(previousPosition);
  track.currentApproximatePosition=clonePoint(position);
  track.samplePosition=clonePoint(position);
  track.lastSampleAt=now;
  track.displacement=result.displacement??0;
  track.estimatedSpeed=result.estimatedSpeed??0;
  track.movementDirection=result.direction??"unknown";
  track.facingEstimate=Number.isFinite(target?.lookAngle)?target.lookAngle:track.facingEstimate;
  track.facingTowardObserver=Boolean(result.facingTowardObserver);
  track.currentActivity=result.activity;
  track.activityLabel=result.label;
  track.activityReason=result.reason;

  if(isMovingActivity(result.activity)&&result.meaningful)track.lastMeaningfulMovementAt=now;
  if(result.meaningful){
    track.activityRevision+=1;
    track.lastActivityChangedAt=now;
    track.history.push({
      time:now,
      from:previousActivity,
      activity:result.activity,
      position:clonePoint(position),
      previousPosition:clonePoint(previousPosition),
      direction:result.direction,
      displacement:result.displacement,
      reason:result.reason
    });
    if(!isMovingActivity(result.activity))track.activityAnchorPosition=clonePoint(position);
    if(track.history.length>8)track.history.splice(0,track.history.length-8);
  }

  track.intentHypothesis=inferIntentHypothesis({
    activity:track.currentActivity,
    facingTowardObserver:track.facingTowardObserver,
    confidence,
    afterMovement:track.lastMeaningfulMovementAt!==null
  });
  return track;
}

export function markContactTrackLost({track,observer,position,confidence=0,now=0}={}){
  if(!track)return track;
  return updateContactTrack({
    track,
    observer,
    target:null,
    position:position??track.currentApproximatePosition,
    confidence,
    now,
    uncertainty:40,
    currentlyVisible:false
  });
}

export function cloneContactTrack(track){
  if(!track)return null;
  return{
    ...track,
    samplePosition:clonePoint(track.samplePosition),
    activityAnchorPosition:clonePoint(track.activityAnchorPosition),
    previousApproximatePosition:clonePoint(track.previousApproximatePosition),
    currentApproximatePosition:clonePoint(track.currentApproximatePosition),
    intentHypothesis:track.intentHypothesis?{...track.intentHypothesis}:null,
    history:(track.history??[]).map(item=>({
      ...item,
      position:clonePoint(item.position),
      previousPosition:clonePoint(item.previousPosition)
    }))
  };
}
