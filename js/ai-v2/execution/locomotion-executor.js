import { TacticalSteeringService } from "./tactical-steering-service.js";
import { moveActorToward, stopActor } from "../../actor-motion.js";

export class LocomotionExecutor{
  constructor({steering=null}={}){this.steering=steering??new TacticalSteeringService();}

  moveWithIntent(actor,intent,delta,options={}){
    const target=this.steering.steer(actor,intent,{game:options.game,now:options.now??0});
    if(!target)return{arrived:false,failed:true,reason:"missing_spatial_intent"};
    if(this.steering.regionSatisfied(actor,intent)){this.stop(actor,{pose:options.pose});return{arrived:true,failed:false,distance:0,regionSatisfied:true};}
    const result=this.moveToward(actor,target,delta,{...options,arrivalRadius:Math.min(options.arrivalRadius??12,12)});
    const reference=intent?.region?.center??intent?.goal??intent?.destination;
    return{...result,arrived:this.steering.regionSatisfied(actor,intent),distance:reference?Math.hypot(reference.x-actor.x,reference.y-actor.y):0};
  }

  moveToward(actor,target,delta,{game,speedMultiplier=.58,arrivalRadius=10,task="Repositioning",pose="walk"}={}){
    if(!actor||!target)return{arrived:false,failed:true,reason:"missing_actor_or_target"};
    const arrived=moveActorToward(actor,target,delta,{game,speedMultiplier,arrivalRadius,task,pose});
    return{arrived,failed:false,distance:Math.hypot(target.x-actor.x,target.y-actor.y)};
  }

  stop(actor,{pose=null}={}){stopActor(actor,pose);}
}
