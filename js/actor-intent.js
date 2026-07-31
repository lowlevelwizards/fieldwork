import { moveActorToward, stopActor } from "./actor-motion.js?v=12a-unified-ai-authority-doctrine-20260731";

export const INTENT_PRIORITY={
  PATROL:20,
  INVESTIGATE:38,
  REPOSITION:58,
  SUPPORT:66,
  RETURN_FIRE:72,
  TREAT:76,
  RESCUE:82,
  ESCAPE_FIRE:90,
  INCAPACITATED:100
};

export function createIntent(owner,type,priority,options={}){
  return {owner,type,priority,...options};
}

export function chooseIntent(intents){
  return intents
    .filter(Boolean)
    .sort((a,b)=>(b.priority??0)-(a.priority??0))[0]??null;
}

export function executeMovementIntent(game,actor,intent,delta){
  actor.selectedIntent=intent;
  if(!intent)return false;
  if(intent.type==="hold"||!intent.destination){
    stopActor(actor,intent.pose??null);
    if(intent.task)actor.currentTask=intent.task;
    return false;
  }
  return moveActorToward(actor,intent.destination,delta,{
    game,
    speedMultiplier:intent.speedMultiplier??.75,
    arrivalRadius:intent.arrivalRadius??38,
    task:intent.task??intent.type,
    pose:intent.pose??"walk"
  });
}
