import { getDoctrine } from "./faction-doctrine.js?v=12b-contact-cover-triage-20260731";
import { projectOutsideObstacles } from "./actor-motion.js?v=12b-contact-cover-triage-20260731";
import { isAlive, isCombatCapable, canReceiveOrders } from "./actor-state.js?v=12b-contact-cover-triage-20260731";

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

    const id=`${encounterId}:${team.id}`;
    const existing=this.fronts.get(id);
    if(existing){
      existing.plan=plan;
      existing.updatedAt=performance.now()/1000;
      const shift=plan==="push"?70:plan==="withdraw"?-150:0;
      existing.lineCenter={
        x:existing.anchorLineCenter.x+existing.forward.x*shift,
        y:existing.anchorLineCenter.y+existing.forward.y*shift
      };
      existing.rear={
        x:existing.lineCenter.x-existing.forward.x*230,
        y:existing.lineCenter.y-existing.forward.y*230
      };
      return existing;
    }

    const ownCenter=center(ownActors);
    const enemyCenter=center(enemyActors);
    const forward=normalize(enemyCenter.x-ownCenter.x,enemyCenter.y-ownCenter.y);
    const lateral={x:-forward.y,y:forward.x};
    const midpoint={x:(ownCenter.x+enemyCenter.x)/2,y:(ownCenter.y+enemyCenter.y)/2};
    const initialDistance=Math.max(360,Math.hypot(enemyCenter.x-ownCenter.x,enemyCenter.y-ownCenter.y));
    const preferred=Math.min(560,Math.max(430,initialDistance*.48));
    const anchorLineCenter={
      x:midpoint.x-forward.x*(preferred*.5),
      y:midpoint.y-forward.y*(preferred*.5)
    };
    const front={
      id,teamId:team.id,enemyTeamId:enemy.id,plan,
      ownCenter,enemyCenter,forward,lateral,midpoint,
      anchorLineCenter:{...anchorLineCenter},
      lineCenter:{...anchorLineCenter},
      rear:{
        x:anchorLineCenter.x-forward.x*230,
        y:anchorLineCenter.y-forward.y*230
      },
      preferredDistance:preferred,
      updatedAt:performance.now()/1000
    };
    this.fronts.set(id,front);
    return front;
  }

  coverNear(raw,front,actor){
    const doctrine=getDoctrine(actor.factionId);
    const candidates=(this.game.map.obstacles??[])
      .filter(obstacle=>Math.hypot(obstacle.x-raw.x,obstacle.y-raw.y)<260)
      .map(obstacle=>{
        const awayX=obstacle.x-front.enemyCenter.x;
        const awayY=obstacle.y-front.enemyCenter.y;
        const length=Math.max(1,Math.hypot(awayX,awayY));
        const clearance=(obstacle.radius??28)+(actor.radius??18)+10;
        const point={
          x:obstacle.x+awayX/length*clearance,
          y:obstacle.y+awayY/length*clearance
        };
        const distanceToSlot=Math.hypot(point.x-raw.x,point.y-raw.y);
        const hard=obstacle.type==="rock"?48:obstacle.type==="tree"?24:12;
        return {point,score:hard*doctrine.coverPriority-distanceToSlot*.2};
      })
      .sort((a,b)=>b.score-a.score);
    const chosen=candidates[0]?.score>0?candidates[0]:null;
    return chosen?{...chosen.point,coverType:chosen.point===raw?null:(chosen.score>35?"hard":"soft")}:{...raw,coverType:null};
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
    const covered=this.coverNear(raw,front,actor);
    return projectOutsideObstacles(this.game,covered.x,covered.y,actor.radius??18,10);
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
      actor.tacticalSlot={x:slot.x,y:slot.y};
      actor.tacticalSlotCoverType=slot.coverType??null;
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
    return projectOutsideObstacles(this.game,target.x,target.y,actor.radius??18,8);
  }
}
