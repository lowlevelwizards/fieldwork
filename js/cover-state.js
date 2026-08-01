import { isAlive, isCombatCapable } from "./actor-state.js?v=12b-contact-cover-triage-20260731";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function pointSegmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const lengthSq=dx*dx+dy*dy;
  if(lengthSq<=.0001)return Math.hypot(point.x-a.x,point.y-a.y);
  const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSq,0,1);
  return Math.hypot(point.x-(a.x+dx*t),point.y-(a.y+dy*t));
}

export class CoverStateSystem{
  constructor(game){this.game=game;}

  nearestThreat(actor){
    if(actor.tacticalEnemyCenter)return actor.tacticalEnemyCenter;
    if(actor.lastKnownEnemyPosition)return actor.lastKnownEnemyPosition;
    let best=null;
    for(const candidate of this.game.actors){
      if(candidate.factionId===actor.factionId||!isCombatCapable(candidate))continue;
      const distance=Math.hypot(candidate.x-actor.x,candidate.y-actor.y);
      if(!best||distance<best.distance)best={x:candidate.x,y:candidate.y,distance};
    }
    return best;
  }

  evaluate(actor){
    if(!actor||!isAlive(actor)){
      return {state:"none",quality:0,obstacle:null};
    }
    const threat=this.nearestThreat(actor);
    let best={state:"exposed",quality:0,obstacle:null};

    if(threat){
      const actorPoint={x:actor.x,y:actor.y};
      for(const obstacle of this.game.map.obstacles??[]){
        const distanceToActor=Math.hypot(obstacle.x-actor.x,obstacle.y-actor.y);
        const maximum=(obstacle.radius??28)+(actor.radius??18)+38;
        if(distanceToActor>maximum)continue;
        const lineDistance=pointSegmentDistance(obstacle,threat,actorPoint);
        const blocksLine=lineDistance<(obstacle.radius??28)*.92;
        if(!blocksLine)continue;
        const state=obstacle.type==="rock"?"hard":"soft";
        const base=state==="hard"?.9:.58;
        const closeness=1-distanceToActor/Math.max(1,maximum);
        const quality=clamp(base+closeness*.1,0,1);
        if(quality>best.quality)best={state,quality,obstacle};
      }
    }

    // Brush provides concealment even when it is not hard ballistic cover.
    if(best.state==="exposed"){
      for(const brush of this.game.map.brush??[]){
        if(Math.hypot(brush.x-actor.x,brush.y-actor.y)<(brush.radius??80)*.72){
          best={state:"concealment",quality:.36,obstacle:brush};
          break;
        }
      }
    }
    return best;
  }

  updateActor(actor){
    const cover=this.evaluate(actor);
    actor.coverState=cover.state;
    actor.coverQuality=cover.quality;
    actor.coverObstacle=cover.obstacle??null;
    return cover;
  }

  update(){
    this.updateActor(this.game.operator);
    for(const actor of this.game.actors)this.updateActor(actor);
  }

  teamReadiness(actors){
    const active=actors.filter(isCombatCapable);
    if(!active.length)return 0;
    const ready=active.filter(actor=>
      actor.coverState==="hard"||
      actor.coverState==="soft"||
      (actor.tacticalSlot&&Math.hypot(actor.x-actor.tacticalSlot.x,actor.y-actor.tacticalSlot.y)<82)
    ).length;
    return ready/active.length;
  }
}
