export function isAlive(actor){
  return Boolean(actor)&&!actor.medical?.dead&&actor.condition!=="dead"&&actor.medicalState!=="dead";
}
export function isConscious(actor){
  return isAlive(actor)&&!actor.medical?.unconscious&&actor.condition!=="incapacitated"&&actor.medicalState!=="unconscious";
}
export function isCritical(actor){
  return isAlive(actor)&&actor.medical?.condition==="critical";
}
export function isTreating(actor){
  return Boolean(actor?.medicalAction||actor?.workPose==="medical");
}
export function isCombatCapable(actor){
  return isConscious(actor)&&!isCritical(actor)&&!actor.beingDragged;
}
export function isActiveThreat(actor){
  return isCombatCapable(actor)&&!isTreating(actor)&&actor.surrendered!==true;
}
export function canBePerceived(actor){
  return isAlive(actor)&&!actor.beingDragged;
}
export function canBeTargeted(actor,{allowCritical=false,allowTreating=false}={}){
  if(!isAlive(actor)||!isConscious(actor))return false;
  if(!allowCritical&&isCritical(actor))return false;
  if(!allowTreating&&isTreating(actor))return false;
  return true;
}
export function canReceiveOrders(actor){
  return isConscious(actor)&&!actor.beingDragged;
}
