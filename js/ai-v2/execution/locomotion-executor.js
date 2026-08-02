import { moveActorToward, stopActor } from "../../actor-motion.js?v=20l-silent-withdrawal-deescalation-20260802";

export class LocomotionExecutor{
  moveToward(actor,target,delta,{game,speedMultiplier=.58,arrivalRadius=10,task="Repositioning",pose="walk"}={}){
    if(!actor||!target)return{arrived:false,failed:true,reason:"missing_actor_or_target"};
    const arrived=moveActorToward(actor,target,delta,{game,speedMultiplier,arrivalRadius,task,pose});
    return{arrived,failed:false,distance:Math.hypot(target.x-actor.x,target.y-actor.y)};
  }

  stop(actor,{pose=null}={}){stopActor(actor,pose);}
}
