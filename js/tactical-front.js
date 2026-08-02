import { getDoctrine } from "./faction-doctrine.js";
import { projectOutsideObstacles } from "./actor-motion.js";
import { isAlive, isCombatCapable, canReceiveOrders } from "./actor-state.js";

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

  coverNear(raw,front,actor,allocation={}){
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    const secondaryThreats=context?.secondaryThreats??actor.tacticalSecondaryThreats??[];
    const role=allocation.role??actor.fireTeamRole??actor.tacticalRole;
    const element=allocation.element??actor.fireTeamElement??(
      role==="base_of_fire"?"support":
      role==="maneuver"?"maneuver":
      role==="medic"?"medical":"security"
    );
    const existing=actor.assignedCoverNode;
    const preserve=existing&&
      actor.tacticalFrontId===front.id&&
      actor.tacticalSlotPlan===front.plan&&
      this.game.coverNetwork?.assignmentValid?.(actor,existing,front.enemyCenter)&&
      !this.game.coverNetwork?.isOvercrowded?.(actor,existing);
    const node=preserve?existing:this.game.coverNetwork?.bestCover?.(actor,front.enemyCenter,{
      anchor:raw,
      maxDistance:role==="medic"?580:640,
      secondaryThreats,
      reserveSeconds:32,
      role,element,
      excludeObstacleIndexes:allocation.excludeObstacleIndexes??[],
      minimumSpacing:role==="medic"?90:74,
      requireFireLane:role==="base_of_fire"
    });
    if(!node)return {...raw,coverType:null,coverNode:null};
    return {
      x:node.protectedPosition.x,
      y:node.protectedPosition.y,
      coverType:node.coverType,
      coverNode:node
    };
  }

  slotFor(front,actor,index,count,allocation={}){
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
    const covered=this.coverNear(raw,front,actor,allocation);
    const projected=projectOutsideObstacles(this.game,covered.x,covered.y,actor.radius??18,10);
    return {
      ...projected,
      coverType:covered.coverType??null,
      coverNode:covered.coverNode??null
    };
  }

  assign(encounter,team,enemy,plan){
    this.cleanup();
    const front=this.build(team,enemy,plan,encounter.id);
    if(!front)return null;
    const actors=team.actors.filter(canReceiveOrders);
    const now=performance.now()/1000;

    const actorIndex=new Map(actors.map((actor,index)=>[actor.id,index]));
    for(const actor of actors){
      actor.tacticalRole ??=/medic|shelter worker/i.test(actor.role??"")
        ?"medic"
        :actorIndex.get(actor.id)===0
          ?"leader"
          :actorIndex.get(actor.id)===1
            ?"base_of_fire"
            :"maneuver";
    }

    const roleOf=actor=>actor.fireTeamRole??actor.tacticalRole??"security";
    const orderWeight={base_of_fire:0,leader:1,maneuver:2,security:3,medic:4};
    const allocationOrder=actors.slice().sort((a,b)=>
      (orderWeight[roleOf(a)]??3)-(orderWeight[roleOf(b)]??3)
    );
    const elementObstacles={
      support:new Set(),
      maneuver:new Set(),
      security:new Set(),
      medical:new Set()
    };

    for(const actor of allocationOrder){
      const role=roleOf(actor);
      const element=role==="base_of_fire"||role==="leader"
        ?"support"
        :role==="maneuver"
          ?"maneuver"
          :role==="medic"
            ?"medical"
            :"security";
      const excluded=new Set();
      if(element==="maneuver"){
        for(const index of elementObstacles.support)excluded.add(index);
      }else if(element==="medical"){
        for(const key of ["support","maneuver"])for(const index of elementObstacles[key])excluded.add(index);
      }else if(element==="security"){
        for(const index of elementObstacles.maneuver)excluded.add(index);
      }

      const index=actorIndex.get(actor.id)??0;
      const slot=this.slotFor(front,actor,index,actors.length,{
        role,element,excludeObstacleIndexes:[...excluded]
      });
      const key=`${front.id}:${actor.id}`;
      this.slotReservations.set(key,{actorId:actor.id,until:now+32});
      actor.fireTeamElement=element;
      actor.tacticalFrontId=front.id;
      actor.tacticalSlotPlan=plan;
      actor.tacticalSlot={x:slot.x,y:slot.y};
      actor.tacticalSlotCoverType=slot.coverType??null;
      actor.tacticalCoverNode=slot.coverNode??null;
      if(slot.coverNode){
        actor.assignedCoverNode=slot.coverNode;
        elementObstacles[element].add(slot.coverNode.index);
      }
      actor.tacticalRallyPoint={...front.rear};
      actor.tacticalLineCenter={...front.lineCenter};
      actor.tacticalForward={...front.forward};
      actor.tacticalLateral={...front.lateral};
      actor.tacticalPreferredDistance=front.preferredDistance;
      actor.tacticalSlotUntil=now+32;
    }
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
