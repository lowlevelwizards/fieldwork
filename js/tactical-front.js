import { projectOutsideObstacles } from "./actor-motion.js?v=11d-engagement-fronts-action-locks-20260731";
import { isAlive, isCombatCapable, canReceiveOrders } from "./actor-state.js?v=11d-engagement-fronts-action-locks-20260731";

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function center(actors){
  const active=actors.filter(isAlive);
  const count=Math.max(1,active.length);
  return {
    x:active.reduce((sum,actor)=>sum+actor.x,0)/count,
    y:active.reduce((sum,actor)=>sum+actor.y,0)/count
  };
}

function normalize(x,y){
  const length=Math.max(1,Math.hypot(x,y));
  return {x:x/length,y:y/length};
}

function planDistance(plan){
  if(plan==="push")return 390;
  if(plan==="withdraw")return 690;
  if(plan==="rescue")return 610;
  return 510;
}

export class TacticalFrontSystem{
  constructor(game){
    this.game=game;
    this.fronts=new Map();
    this.slotReservations=new Map();
  }

  cleanup(){
    const now=performance.now()/1000;
    for(const [key,value] of this.slotReservations){
      if(value.until<now)this.slotReservations.delete(key);
    }
  }

  build(team,enemy,plan,encounterId){
    const ownActors=team.actors.filter(isAlive);
    const enemyActors=enemy.actors.filter(isAlive);
    if(!ownActors.length||!enemyActors.length)return null;

    const ownCenter=center(ownActors);
    const enemyCenter=center(enemyActors);
    const forward=normalize(enemyCenter.x-ownCenter.x,enemyCenter.y-ownCenter.y);
    const lateral={x:-forward.y,y:forward.x};
    const preferred=planDistance(plan);
    const lineCenter={
      x:enemyCenter.x-forward.x*preferred,
      y:enemyCenter.y-forward.y*preferred
    };
    const rear={
      x:lineCenter.x-forward.x*220,
      y:lineCenter.y-forward.y*220
    };
    const front={
      id:`${encounterId}:${team.id}`,
      teamId:team.id,
      enemyTeamId:enemy.id,
      plan,
      ownCenter,enemyCenter,forward,lateral,lineCenter,rear,
      preferredDistance:preferred,
      updatedAt:performance.now()/1000
    };
    this.fronts.set(front.id,front);
    return front;
  }

  slotFor(front,actor,index,count){
    const medic=/medic|shelter worker/i.test(actor.role??"");
    const role=medic?"medic":actor.tacticalRole??(index===0?"leader":index===1?"base_of_fire":"maneuver");
    const centered=index-(count-1)/2;
    const spacing=82;
    let along=centered*spacing;
    let depth=0;

    if(role==="medic")depth=-190;
    else if(role==="leader")depth=-35;
    else if(role==="base_of_fire")depth=-18;
    else if(front.plan==="flank_left"){
      along-=210;
      depth=55;
    }else if(front.plan==="flank_right"){
      along+=210;
      depth=55;
    }else if(front.plan==="withdraw"){
      depth=-180;
    }else if(front.plan==="rescue"){
      depth=-125;
    }else if(front.plan==="push"){
      depth=35;
    }

    const raw={
      x:front.lineCenter.x+front.lateral.x*along+front.forward.x*depth,
      y:front.lineCenter.y+front.lateral.y*along+front.forward.y*depth
    };
    return projectOutsideObstacles(this.game,raw.x,raw.y,actor.radius??18,10);
  }

  assign(encounter,team,enemy,plan){
    this.cleanup();
    const front=this.build(team,enemy,plan,encounter.id);
    if(!front)return null;
    const actors=team.actors.filter(canReceiveOrders);
    const now=performance.now()/1000;

    actors.forEach((actor,index)=>{
      const slot=this.slotFor(front,actor,index,actors.length);
      const key=`${front.id}:${index}`;
      this.slotReservations.set(key,{actorId:actor.id,until:now+14});
      actor.tacticalFrontId=front.id;
      actor.tacticalSlot={...slot};
      actor.tacticalRallyPoint={...front.rear};
      actor.tacticalLineCenter={...front.lineCenter};
      actor.tacticalForward={...front.forward};
      actor.tacticalLateral={...front.lateral};
      actor.tacticalPreferredDistance=front.preferredDistance;
      actor.tacticalSlotUntil=now+14;
    });
    return front;
  }

  getFront(actor){
    return actor?.tacticalFrontId?this.fronts.get(actor.tacticalFrontId)??null:null;
  }

  nearestEnemyDistance(actor){
    let best=Infinity;
    for(const candidate of this.game.actors){
      if(candidate.factionId===actor.factionId||!isCombatCapable(candidate))continue;
      best=Math.min(best,Math.hypot(candidate.x-actor.x,candidate.y-actor.y));
    }
    return best;
  }

  protectDestination(actor,target){
    if(!actor||!target)return target;
    let x=target.x,y=target.y;
    const deliberateClose=actor.tacticalPlan==="push"&&(actor.suppression??0)<28;
    const minimum=deliberateClose?155:235;
    for(const enemy of this.game.actors){
      if(enemy.factionId===actor.factionId||!isCombatCapable(enemy))continue;
      const dx=x-enemy.x,dy=y-enemy.y,d=Math.hypot(dx,dy);
      if(d<minimum){
        const angle=d>.001?Math.atan2(dy,dx):Math.atan2(actor.y-enemy.y,actor.x-enemy.x);
        x=enemy.x+Math.cos(angle)*minimum;
        y=enemy.y+Math.sin(angle)*minimum;
      }
    }
    return projectOutsideObstacles(this.game,x,y,actor.radius??18,8);
  }
}
