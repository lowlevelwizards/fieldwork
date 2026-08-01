export function projectOutsideObstacles(game,x,y,radius=18,clearance=6){
  if(!game?.map?.obstacles)return {x,y};
  let px=x,py=y;
  for(let pass=0;pass<4;pass++){
    let moved=false;
    for(const obstacle of game.map.obstacles){
      const dx=px-obstacle.x,dy=py-obstacle.y;
      const minimum=radius+(obstacle.radius??0)+clearance;
      const distance=Math.hypot(dx,dy);
      if(distance<minimum){
        const angle=distance>.001?Math.atan2(dy,dx):Math.random()*Math.PI*2;
        px=obstacle.x+Math.cos(angle)*minimum;
        py=obstacle.y+Math.sin(angle)*minimum;
        moved=true;
      }
    }
    if(!moved)break;
  }
  return {x:px,y:py};
}

export function isActorPositionClear(game,x,y,radius=18){
  if(!game?.map?.obstacles)return true;
  return !game.map.obstacles.some(obstacle=>{
    const minimum=radius+(obstacle.radius??0)+4;
    return (x-obstacle.x)**2+(y-obstacle.y)**2<minimum**2;
  });
}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function medicalSpeedCap(actor){
  const medical=actor?.medical;
  if(!medical)return 1;
  if(medical.dead||medical.unconscious)return 0;
  if(medical.condition==="critical")return .16;
  if(medical.condition==="serious")return .72;
  if(medical.condition==="wounded")return .88;
  return 1;
}

function actionAllowsMovement(actor){
  return !actor?.actionLock||actor.actionLock.allowsMovement!==false;
}

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
  pose="walk",
  game=null
}={}){
  if(!actor||!target||isImmobileCasualty(actor)||!actionAllowsMovement(actor)){
    stopActor(actor,actor?.medical?.dead?"dead":actor?.medical?.unconscious?"downed":null);
    return true;
  }

  const safeTarget=game?projectOutsideObstacles(game,target.x,target.y,actor.radius??18):target;
  const dx=safeTarget.x-actor.x,dy=safeTarget.y-actor.y;
  const distance=Math.hypot(dx,dy);
  actor.moveTarget={x:safeTarget.x,y:safeTarget.y};
  actor.currentTask=task;
  actor.currentAction=task;

  if(distance<=arrivalRadius){
    stopActor(actor);
    actor.motionState="idle";
    return true;
  }

  const cap=medicalSpeedCap(actor);
  if(cap<=0){stopActor(actor,actor?.medical?.dead?"dead":"downed");return true;}
  const draggingCap=actor.rescueDrag||actor.draggingCasualtyId?.58:1;
  const speed=Math.max(4,(actor.moveSpeed??60)*speedMultiplier*cap*draggingCap);
  const step=Math.min(distance,speed*delta);
  const nx=dx/distance,ny=dy/distance;
  actor.vx=nx*speed;actor.vy=ny*speed;
  let nextX=actor.x+nx*step,nextY=actor.y+ny*step;
  if(game&&!isActorPositionClear(game,nextX,nextY,actor.radius??18)){
    // Keep the same steering side briefly so obstacle avoidance cannot
    // alternate left/right every frame and create visible jitter.
    const now=performance.now()/1000;
    if(!actor.obstacleSteerSign||now>(actor.obstacleSteerUntil??0)){
      const left={x:actor.x-ny*step,y:actor.y+nx*step};
      const right={x:actor.x+ny*step,y:actor.y-nx*step};
      const leftClear=isActorPositionClear(game,left.x,left.y,actor.radius??18);
      const rightClear=isActorPositionClear(game,right.x,right.y,actor.radius??18);
      actor.obstacleSteerSign=leftClear&&!rightClear?-1:rightClear&&!leftClear?1:(actor.id?.length??0)%2?-1:1;
      actor.obstacleSteerUntil=now+1.1;
    }
    const sign=actor.obstacleSteerSign;
    const side={x:actor.x+ny*step*sign,y:actor.y-nx*step*sign};
    if(isActorPositionClear(game,side.x,side.y,actor.radius??18)){
      nextX=side.x;nextY=side.y;
      actor.vx=(nextX-actor.x)/Math.max(delta,.001);
      actor.vy=(nextY-actor.y)/Math.max(delta,.001);
    }else{
      stopActor(actor);
      actor.obstacleSteerUntil=now+.35;
      return false;
    }
  }else{
    actor.obstacleSteerSign=null;
  }
  actor.x=nextX;actor.y=nextY;
  actor.walkingPhase=(actor.walkingPhase??0)+delta*(medicalSpeedCap(actor)<.3?2.1:8);
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
