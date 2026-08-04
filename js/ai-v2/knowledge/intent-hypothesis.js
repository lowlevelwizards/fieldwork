export const INTENT_HYPOTHESES=Object.freeze({
  NO_CLEAR_INTENT:"no_clear_intent",
  MONITORING_AREA:"monitoring_area",
  IMPROVING_POSITION:"improving_position",
  APPROACHING_AREA_OF_CONCERN:"approaching_area_of_concern",
  LEAVING_AREA:"leaving_area",
  POSSIBLE_DETECTION:"possible_detection"
});

export function inferIntentHypothesis({activity,facingTowardObserver=false,confidence=0,afterMovement=false}={}){
  if(activity==="approaching")return{
    id:INTENT_HYPOTHESES.APPROACHING_AREA_OF_CONCERN,
    label:"Approaching area of concern",
    confidence:Math.min(72,Math.max(24,confidence*.62)),
    reason:"Observed movement is carrying the contact closer to the observer's relevant area."
  };
  if(activity==="withdrawing")return{
    id:INTENT_HYPOTHESES.LEAVING_AREA,
    label:"Leaving area",
    confidence:Math.min(76,Math.max(28,confidence*.68)),
    reason:"Observed movement is carrying the contact away from the observer's relevant area."
  };
  if(activity==="repositioning")return{
    id:INTENT_HYPOTHESES.IMPROVING_POSITION,
    label:"Possibly improving position",
    confidence:Math.min(66,Math.max(22,confidence*.56)),
    reason:"The contact changed position, but the purpose of the movement is not directly observable."
  };
  if(activity==="observing"){
    if(facingTowardObserver&&afterMovement&&confidence>=65)return{
      id:INTENT_HYPOTHESES.POSSIBLE_DETECTION,
      label:"Possible detection",
      confidence:Math.min(58,Math.max(24,confidence*.48)),
      reason:"The contact moved, stopped, and appears oriented toward the observer's area; awareness is possible but unconfirmed."
    };
    return{
      id:INTENT_HYPOTHESES.MONITORING_AREA,
      label:"Possibly monitoring area",
      confidence:Math.min(62,Math.max(20,confidence*.5)),
      reason:"The contact appears stationary and oriented toward a relevant sector, but its exact purpose is unknown."
    };
  }
  return{
    id:INTENT_HYPOTHESES.NO_CLEAR_INTENT,
    label:"No clear intent",
    confidence:Math.min(42,Math.max(8,confidence*.28)),
    reason:activity==="lost"
      ?"The contact is no longer visible, so current intent cannot be inferred."
      :"Current visible behavior does not support a specific intent hypothesis."
  };
}
