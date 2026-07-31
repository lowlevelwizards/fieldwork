const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function isImmobileCasualty(actor){
  return Boolean(
    actor?.condition==="dead" ||
    actor?.medical?.dead ||
    actor?.medical?.unconscious ||
    actor?.condition==="incapacitated" ||
    actor?.medicalState==="unconscious" ||
    actor?.medicalState==="dead"
  );
}

export function stopActor(actor,pose=null){
  if(!actor)return;
  actor.vx=0;actor.vy=0;
  actor.moveTarget=null;
  if(pose)actor.workPose=pose;
  actor.groundY=actor.y+(actor.radius??18);
}

export function moveActorToward(actor,target,delta,{
  speedMultiplier=1,
  arrivalRadius=8,
  task="Moving",
  pose="walk"
}={}){
  if(!actor||!target||isImmobileCasualty(actor)){
    stopActor(actor,actor?.medical?.dead?"dead":actor?.medical?.unconscious?"downed":null);
    return true;
  }

  const dx=target.x-actor.x,dy=target.y-actor.y;
  const distance=Math.hypot(dx,dy);
  actor.moveTarget={x:target.x,y:target.y};
  actor.currentTask=task;
  actor.currentAction=task;

  if(distance<=arrivalRadius){
    actor.x=target.x;actor.y=target.y;
    stopActor(actor);
    return true;
  }

  const speed=Math.max(8,(actor.moveSpeed??60)*speedMultiplier);
  const step=Math.min(distance,speed*delta);
  const nx=dx/distance,ny=dy/distance;
  actor.vx=nx*speed;actor.vy=ny*speed;
  actor.x+=nx*step;actor.y+=ny*step;
  actor.walkingPhase=(actor.walkingPhase??0)+delta*8;
  actor.motionState="walking";
  actor.workPose=pose;
  actor.facing=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
  actor.groundY=actor.y+(actor.radius??18);
  return false;
}

export function trailActorToward(actor,target,delta,{
  maximumSpeed=150,
  arrivalRadius=4,
  pose="dragged"
}={}){
  if(!actor||!target)return true;
  const dx=target.x-actor.x,dy=target.y-actor.y,distance=Math.hypot(dx,dy);
  actor.vx=0;actor.vy=0;
  actor.workPose=pose;
  actor.motionState=pose;
  if(distance<=arrivalRadius){
    actor.x=target.x;actor.y=target.y;actor.groundY=actor.y+(actor.radius??18);return true;
  }
  const step=Math.min(distance,maximumSpeed*delta);
  actor.x+=dx/distance*step;
  actor.y+=dy/distance*step;
  actor.groundY=actor.y+(actor.radius??18);
  return false;
}
