import { projectOutsideObstacles } from "../../actor-motion.js";

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const norm=(x,y)=>{const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};};

/**
 * Produces a short-lived steering target from a durable spatial intent.
 * The service never owns authority: actions describe the intent and this
 * service continuously adapts the next physical step to the live world.
 */
export class TacticalSteeringService{
  steer(actor,intent,{game,now=0}={}){
    const goal=intent?.goal??intent?.destination;
    if(!actor||!goal)return goal??null;
    let gx=goal.x-actor.x,gy=goal.y-actor.y;
    const goalDistance=Math.hypot(gx,gy);
    const g=norm(gx,gy);
    let sx=g.x*(intent.goalWeight??1),sy=g.y*(intent.goalWeight??1);

    const friendlies=(game?.actors??[]).filter(other=>other.id!==actor.id&&other.teamId===actor.teamId&&!other.medical?.dead);
    const preferredMin=intent.preferredSeparationMin??58;
    const preferredMax=intent.preferredSeparationMax??190;
    for(const other of friendlies){
      const dx=actor.x-other.x,dy=actor.y-other.y,d=Math.hypot(dx,dy)||1;
      if(d<preferredMin){const force=(preferredMin-d)/preferredMin*(intent.separationWeight??1.35);sx+=dx/d*force;sy+=dy/d*force;}
      else if(intent.cohesion!==false&&d>preferredMax){const force=Math.min(.34,(d-preferredMax)/Math.max(preferredMax,1)*.18);sx-=dx/d*force;sy-=dy/d*force;}
    }

    const threat=intent.threatPoint??actor.aiV2TacticalPicture?.threatPoint??null;
    if(threat){
      const dx=actor.x-threat.x,dy=actor.y-threat.y,d=Math.hypot(dx,dy)||1;
      const dangerRadius=intent.dangerRadius??300;
      if(d<dangerRadius){const force=(1-d/dangerRadius)*(intent.threatRepulsionWeight??1.65);sx+=dx/d*force;sy+=dy/d*force;}
    }

    // Prefer lateral deformation over a complete reversal unless survival pressure is high.
    let heading=norm(sx,sy);
    const forwardDot=heading.x*g.x+heading.y*g.y;
    if(forwardDot<.18&&!intent.allowRetreat){
      heading=norm(heading.x+g.x*(.18-forwardDot+1),heading.y+g.y*(.18-forwardDot+1));
    }
    const lookAhead=Math.max(34,Math.min(intent.lookAhead??96,goalDistance||96));
    let target={x:actor.x+heading.x*lookAhead,y:actor.y+heading.y*lookAhead};
    target=projectOutsideObstacles(game,target.x,target.y,actor.radius??18,7);
    actor.aiV2Steering={
      kind:intent.kind??"spatial_intent",goal:{x:goal.x,y:goal.y},target:{...target},
      goalDistance,pressure:clamp(Math.hypot(sx-g.x,sy-g.y)/2),updatedAt:now
    };
    return target;
  }

  regionSatisfied(actor,intent){
    const goal=intent?.goal??intent?.destination;if(!actor||!goal)return false;
    const distance=Math.hypot(goal.x-actor.x,goal.y-actor.y);
    if(distance<=(intent.acceptanceRadius??intent.arrivalRadius??24))return true;
    if(intent.corridor){
      const {from,to,width=120}=intent.corridor;
      const vx=to.x-from.x,vy=to.y-from.y,l2=vx*vx+vy*vy||1;
      const t=clamp(((actor.x-from.x)*vx+(actor.y-from.y)*vy)/l2);
      const px=from.x+vx*t,py=from.y+vy*t;
      const cross=Math.hypot(actor.x-px,actor.y-py);
      const progress=((actor.x-from.x)*vx+(actor.y-from.y)*vy)/l2;
      if(cross<=width&&progress>=(intent.minimumProgress??.88))return true;
    }
    return false;
  }
}
