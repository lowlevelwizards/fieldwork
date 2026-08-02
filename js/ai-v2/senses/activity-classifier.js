const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const normalizeAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const MOVING_STATES=new Set(["repositioning","approaching","withdrawing","crossing"]);

function directionLabel(dx,dy){
  if(Math.hypot(dx,dy)<.001)return"stationary";
  const angle=Math.atan2(dy,dx);
  const index=Math.round((angle+Math.PI)/(Math.PI/4))%8;
  return["west","northwest","north","northeast","east","southeast","south","southwest"][index];
}

export function isMovingActivity(activity){return MOVING_STATES.has(activity);}

export function classifyObservedActivity({
  observer,
  previousPosition,
  currentPosition,
  previousActivity="stationary",
  targetFacing=null,
  elapsed=.5,
  uncertainty=20,
  timeSinceMeaningfulMovement=Infinity,
  wasVisible=true
}={}){
  if(!wasVisible)return{
    activity:"lost",
    label:"Lost contact",
    meaningful:previousActivity!=="lost",
    reason:"The contact is no longer visible from the assigned observation sector.",
    displacement:0,
    estimatedSpeed:0,
    direction:"unknown",
    facingTowardObserver:false,
    facingError:null
  };

  const dx=(currentPosition?.x??0)-(previousPosition?.x??currentPosition?.x??0);
  const dy=(currentPosition?.y??0)-(previousPosition?.y??currentPosition?.y??0);
  const displacement=Math.hypot(dx,dy);
  const safeElapsed=Math.max(.05,elapsed);
  const estimatedSpeed=displacement/safeElapsed;
  const movementThreshold=Math.max(56,uncertainty*1.05);
  const previousDistance=Math.hypot((previousPosition?.x??0)-(observer?.x??0),(previousPosition?.y??0)-(observer?.y??0));
  const currentDistance=Math.hypot((currentPosition?.x??0)-(observer?.x??0),(currentPosition?.y??0)-(observer?.y??0));
  const radialDelta=currentDistance-previousDistance;
  const targetToObserver=Math.atan2((observer?.y??0)-(currentPosition?.y??0),(observer?.x??0)-(currentPosition?.x??0));
  const facingError=Number.isFinite(targetFacing)?Math.abs(normalizeAngle(targetFacing-targetToObserver)):null;
  const facingTowardObserver=facingError!==null&&facingError<=Math.PI*.34;

  if(displacement>=movementThreshold){
    let activity="repositioning";
    let label="Repositioning";
    let reason="The contact changed position by a meaningful distance.";
    if(radialDelta<=-Math.max(24,uncertainty*.45)){
      activity="approaching";label="Approaching";reason="The contact moved meaningfully closer to the observer's area.";
    }else if(radialDelta>=Math.max(24,uncertainty*.45)){
      activity="withdrawing";label="Withdrawing";reason="The contact moved meaningfully farther from the observer's area.";
    }
    return{
      activity,label,reason,
      meaningful:!isMovingActivity(previousActivity)||previousActivity!==activity,
      displacement,estimatedSpeed,direction:directionLabel(dx,dy),
      facingTowardObserver,facingError,
      radialDelta
    };
  }

  if(isMovingActivity(previousActivity)&&timeSinceMeaningfulMovement>=.65){
    const activity=facingTowardObserver?"observing":"stationary";
    return{
      activity,
      label:facingTowardObserver?"Observing area":"Now stationary",
      meaningful:true,
      reason:facingTowardObserver
        ?"The contact stopped after moving and now appears oriented toward the observer's area."
        :"The contact stopped after a meaningful position change.",
      displacement,estimatedSpeed,direction:"stationary",facingTowardObserver,facingError,radialDelta
    };
  }

  const activity=previousActivity==="lost"?"stationary":previousActivity;
  return{
    activity,
    label:activity==="observing"?"Observing area":"Stationary",
    meaningful:false,
    reason:activity==="observing"?"The contact remains oriented toward the observed area.":"No meaningful activity change is currently visible.",
    displacement,estimatedSpeed,direction:"stationary",facingTowardObserver,facingError,radialDelta,
    stability:clamp(1-displacement/Math.max(1,movementThreshold),0,1)
  };
}
