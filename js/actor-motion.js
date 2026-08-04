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
    // Follow the edge of the obstacle in simulation time. A pure sideways
    // step can remain inside a large circle forever, so combine tangent
    // motion with a small outward component and prefer the clear candidate
    // that still makes progress toward the destination.
    actor.obstacleSteerRemaining=Math.max(0,(actor.obstacleSteerRemaining??0)-Math.max(0,delta));
    const blocking=(game.map?.obstacles??[])
      .filter(obstacle=>{
        const minimum=(actor.radius??18)+(obstacle.radius??0)+4;
        return (nextX-obstacle.x)**2+(nextY-obstacle.y)**2<minimum**2;
      })
      .sort((left,right)=>Math.hypot(actor.x-left.x,actor.y-left.y)-Math.hypot(actor.x-right.x,actor.y-right.y))[0]??null;
    if(blocking){
      let rx=actor.x-blocking.x,ry=actor.y-blocking.y;
      const radialLength=Math.hypot(rx,ry);
      if(radialLength<=.001){rx=-nx;ry=-ny;}else{rx/=radialLength;ry/=radialLength;}
      const candidates=[-1,1].map(sign=>{
        const tx=-ry*sign,ty=rx*sign;
        const candidate={
          sign,
          x:actor.x+tx*step+rx*step*.42,
          y:actor.y+ty*step+ry*step*.42
        };
        candidate.clear=isActorPositionClear(game,candidate.x,candidate.y,actor.radius??18);
        candidate.remaining=Math.hypot(safeTarget.x-candidate.x,safeTarget.y-candidate.y);
        return candidate;
      });
      const preferred=actor.obstacleSteerSign&&actor.obstacleSteerRemaining>0
        ?candidates.find(candidate=>candidate.sign===actor.obstacleSteerSign&&candidate.clear)
        :null;
      const selected=preferred??candidates.filter(candidate=>candidate.clear).sort((a,b)=>a.remaining-b.remaining)[0]??null;
      if(selected){
        actor.obstacleSteerSign=selected.sign;
        actor.obstacleSteerRemaining=Math.max(actor.obstacleSteerRemaining,.8);
        nextX=selected.x;nextY=selected.y;
        actor.vx=(nextX-actor.x)/Math.max(delta,.001);
        actor.vy=(nextY-actor.y)/Math.max(delta,.001);
      }else{
        const projected=projectOutsideObstacles(game,actor.x,actor.y,actor.radius??18,7);
        if(Math.hypot(projected.x-actor.x,projected.y-actor.y)>.01){
          nextX=projected.x;nextY=projected.y;
        }else{
          stopActor(actor);
          actor.obstacleSteerRemaining=.2;
          return false;
        }
      }
    }
  }else{
    actor.obstacleSteerSign=null;
    actor.obstacleSteerRemaining=0;
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
