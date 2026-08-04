import { projectOutsideObstacles } from "./actor-motion.js";
import { getDoctrine } from "./faction-doctrine.js";
import { isAlive } from "./actor-state.js";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const normalize=(x,y)=>{const length=Math.max(1,Math.hypot(x,y));return{x:x/length,y:y/length};};

function pointSegmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const lengthSq=dx*dx+dy*dy;
  if(lengthSq<=.0001)return distance(point,a);
  const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSq,0,1);
  return Math.hypot(point.x-(a.x+dx*t),point.y-(a.y+dy*t));
}

export class CoverNetworkSystem{
  constructor(game){
    this.game=game;
    this.reservations=new Map();
    this.routeReservations=new Map();
  }

  now(){return performance.now()/1000;}

  cleanup(){
    const now=this.now();
    const living=new Set(this.game.actors.filter(isAlive).map(actor=>actor.id));
    for(const [key,value] of this.reservations){
      if(value.until<now||!living.has(value.actorId))this.reservations.delete(key);
    }
    for(const [key,value] of this.routeReservations){
      if(value.until<now||!living.has(value.actorId))this.routeReservations.delete(key);
    }
  }

  update(){
    this.cleanup();
    for(const actor of this.game.actors){
      if(!isAlive(actor))continue;
      actor.coverCrowding=this.friendlyDensity(actor,actor.assignedCoverNode?.protectedPosition??actor,108);
      const assignment=actor.assignedCoverNode;
      if(!assignment?.slotId)continue;
      const reservation=this.reservations.get(assignment.slotId);
      if(!reservation||reservation.actorId!==actor.id){
        actor.assignedCoverNode=null;
        actor.coverLeaseUntil=0;
        actor.coverReassignmentReason="cover reservation expired";
      }
    }
  }

  obstacleType(obstacle){return obstacle.type==="rock"?"hard":"soft";}

  nodeForObstacle(obstacle,index,threat,actor){
    const away=normalize(obstacle.x-threat.x,obstacle.y-threat.y);
    const lateral={x:-away.y,y:away.x};
    const radius=obstacle.radius??28;
    const actorRadius=actor.radius??18;
    const sector=Math.round(Math.atan2(away.y,away.x)/(Math.PI/4));
    const clearance=radius+actorRadius+11;
    const base=projectOutsideObstacles(
      this.game,obstacle.x+away.x*clearance,obstacle.y+away.y*clearance,actorRadius,8
    );
    const hard=this.obstacleType(obstacle)==="hard";
    const protectedOffset=Math.min(25,Math.max(15,radius*.34));
    const protectedSlots=(hard?[
      {id:`cover:${index}:${sector}:protected_left`,side:"left",x:base.x+lateral.x*protectedOffset,y:base.y+lateral.y*protectedOffset},
      {id:`cover:${index}:${sector}:protected_right`,side:"right",x:base.x-lateral.x*protectedOffset,y:base.y-lateral.y*protectedOffset}
    ]:[
      {id:`cover:${index}:${sector}:protected`,side:"center",x:base.x,y:base.y}
    ]).map(slot=>{
      const position=projectOutsideObstacles(this.game,slot.x,slot.y,actorRadius,8);
      return {...slot,type:"protected",position,x:position.x,y:position.y};
    });

    const sideDistance=radius+actorRadius+10;
    const shallowDepth=Math.max(actorRadius+7,radius*.28);
    const wideDistance=sideDistance+Math.max(12,radius*.28);
    const firePositions=[
      {side:"left",width:"shallow",x:obstacle.x+away.x*shallowDepth+lateral.x*sideDistance,y:obstacle.y+away.y*shallowDepth+lateral.y*sideDistance},
      {side:"left",width:"wide",x:obstacle.x+away.x*(shallowDepth*.65)+lateral.x*wideDistance,y:obstacle.y+away.y*(shallowDepth*.65)+lateral.y*wideDistance},
      {side:"right",width:"shallow",x:obstacle.x+away.x*shallowDepth-lateral.x*sideDistance,y:obstacle.y+away.y*shallowDepth-lateral.y*sideDistance},
      {side:"right",width:"wide",x:obstacle.x+away.x*(shallowDepth*.65)-lateral.x*wideDistance,y:obstacle.y+away.y*(shallowDepth*.65)-lateral.y*wideDistance}
    ].map(item=>{
      const position=projectOutsideObstacles(this.game,item.x,item.y,actorRadius,5);
      return {...item,position,x:position.x,y:position.y};
    });
    const center={
      x:protectedSlots.reduce((sum,slot)=>sum+slot.x,0)/protectedSlots.length,
      y:protectedSlots.reduce((sum,slot)=>sum+slot.y,0)/protectedSlots.length
    };
    return {
      id:`cover:${index}:${sector}`,
      nodeId:`cover:${index}:${sector}`,
      obstacle,index,sector,
      coverType:this.obstacleType(obstacle),
      protectedPosition:center,
      protectedSlots,
      firePositions,
      leftFirePosition:firePositions.find(item=>item.side==="left")?.position??center,
      rightFirePosition:firePositions.find(item=>item.side==="right")?.position??center,
      threatPosition:{x:threat.x,y:threat.y},
      protectedDirection:{x:-away.x,y:-away.y},
      quality:hard?.94:.67,
      capacity:protectedSlots.length
    };
  }

  blocksThreat(node,threat,position=node?.protectedPosition){
    if(!node?.obstacle||!threat||!position)return false;
    return pointSegmentDistance(node.obstacle,threat,position)<(node.obstacle.radius??28)*.92;
  }

  friendlyDensity(actor,position,radius=112){
    if(!actor||!position)return 0;
    return this.game.actors.filter(other=>
      other.id!==actor.id&&other.factionId===actor.factionId&&isAlive(other)&&distance(other,position)<radius
    ).length;
  }

  occupancy(node){
    this.cleanup();
    if(!node)return 0;
    let count=0;
    for(const reservation of this.reservations.values()){
      if(reservation.obstacleIndex===node.index)count++;
    }
    return count;
  }

  availableSlots(actor,node){
    this.cleanup();
    const ownsObstacle=[...this.reservations.values()].some(reservation=>
      reservation.actorId===actor.id&&reservation.obstacleIndex===node.index
    );
    if(this.occupancy(node)>=node.capacity&&!ownsObstacle)return [];
    return (node?.protectedSlots??[]).filter(slot=>{
      const reservation=this.reservations.get(slot.id);
      return !reservation||reservation.actorId===actor.id;
    });
  }

  isOvercrowded(actor,assignment){
    if(!assignment)return false;
    const occupancy=this.occupancy(assignment);
    if(occupancy>assignment.capacity)return true;
    const localDensity=this.friendlyDensity(actor,assignment.protectedPosition,104);
    const protectedRole=["base_of_fire","leader"].includes(assignment.role??actor.fireTeamRole??actor.tacticalRole);
    return !protectedRole&&localDensity>assignment.capacity+2;
  }

  actorAssignment(actor){
    const assignment=actor?.assignedCoverNode;
    const reservation=assignment?.slotId?this.reservations.get(assignment.slotId):null;
    return reservation?.actorId===actor.id?assignment:null;
  }

  releaseActor(actor,{clearAssignment=true}={}){
    if(!actor)return;
    const releasedSlot=actor.assignedCoverNode?.slotId??null;
    for(const [key,value] of this.reservations)if(value.actorId===actor.id)this.reservations.delete(key);
    for(const [key,value] of this.routeReservations)if(value.actorId===actor.id)this.routeReservations.delete(key);
    if(clearAssignment){
      actor.assignedCoverNode=null;
      actor.coverLeaseUntil=0;
      actor.returnToCoverUntil=0;
      if(releasedSlot&&actor.tacticalCoverNode?.slotId===releasedSlot){
        actor.tacticalCoverNode=null;
        actor.tacticalSlotCoverType=null;
      }
    }
  }

  assignmentValid(actor,assignment,threat){
    if(!actor||!assignment?.slotId)return false;
    const reservation=this.reservations.get(assignment.slotId);
    if(!reservation||reservation.actorId!==actor.id)return false;
    if(threat&&!this.blocksThreat(assignment,threat,assignment.protectedPosition))return false;
    return !this.isOvercrowded(actor,assignment);
  }

  openGroundCost(from,to,threat){
    const length=distance(from,to);
    if(length<1)return 0;
    const samples=Math.max(2,Math.ceil(length/80));
    let protectedSamples=0;
    for(let i=1;i<samples;i++){
      const t=i/samples;
      const point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
      const covered=(this.game.map.obstacles??[]).some(obstacle=>
        distance(point,obstacle)<(obstacle.radius??28)+34&&
        pointSegmentDistance(obstacle,threat,point)<(obstacle.radius??28)*.9
      );
      if(covered)protectedSamples++;
    }
    return length*(1-protectedSamples/Math.max(1,samples-1));
  }

  shotBlocked(origin,target,{ignoreObstacle=null}={}){
    let nearest=null;
    const total=distance(origin,target);
    for(const obstacle of this.game.map.obstacles??[]){
      if(ignoreObstacle&&obstacle===ignoreObstacle)continue;
      if(pointSegmentDistance(obstacle,origin,target)>(obstacle.radius??28)*.82)continue;
      const along=distance(origin,obstacle);
      if(along<30||along>=total-18)continue;
      if(!nearest||along<nearest.distance)nearest={obstacle,distance:along};
    }
    return nearest;
  }

  clearFirePositions(node,target){
    return (node?.firePositions??[]).filter(item=>
      !this.shotBlocked(item.position,target,{ignoreObstacle:node.obstacle})
    );
  }

  candidates(actor,threat,{
    anchor=null,maxDistance=620,secondaryThreats=[],role=null,element=null,
    excludeObstacleIndexes=[],minimumSpacing=68,requireFireLane=false
  }={}){
    if(!actor||!threat)return [];
    this.cleanup();
    const doctrine=getDoctrine(actor.factionId);
    const reference=anchor??actor;
    const excluded=new Set(excludeObstacleIndexes);
    const friendlies=this.game.actors.filter(other=>other.factionId===actor.factionId&&isAlive(other));
    return (this.game.map.obstacles??[])
      .map((obstacle,index)=>this.nodeForObstacle(obstacle,index,threat,actor))
      .filter(node=>!excluded.has(node.index)&&distance(actor,node.protectedPosition)<=maxDistance&&this.blocksThreat(node,threat))
      .map(node=>{
        const available=this.availableSlots(actor,node);
        if(!available.length)return null;
        const clearEdges=this.clearFirePositions(node,threat);
        if(requireFireLane&&!clearEdges.length)return null;
        const slot=available.slice().sort((a,b)=>distance(reference,a.position)-distance(reference,b.position))[0];
        const travel=distance(actor,slot.position);
        const anchorDistance=distance(reference,slot.position);
        const openCost=this.openGroundCost(actor,slot.position,threat);
        const secondaryExposure=secondaryThreats.reduce((sum,item)=>sum+(this.blocksThreat(node,item.position??item,slot.position)?0:42),0);
        const occupancy=this.occupancy(node);
        const localDensity=this.friendlyDensity(actor,slot.position,118);
        const sameNode=friendlies.filter(other=>other.id!==actor.id&&other.assignedCoverNode?.index===node.index);
        const sameElement=element?sameNode.filter(other=>other.fireTeamElement===element).length:0;
        const otherElement=element?sameNode.filter(other=>other.fireTeamElement&&other.fireTeamElement!==element).length:0;
        const closest=friendlies.filter(other=>other.id!==actor.id).reduce((best,other)=>Math.min(best,distance(other,slot.position)),Infinity);
        const spacingPenalty=closest<minimumSpacing?(minimumSpacing-closest)*6:0;
        const routeReservation=this.routeReservations.get(node.nodeId);
        const routePenalty=routeReservation&&routeReservation.actorId!==actor.id?180:0;
        const teamMates=friendlies.filter(other=>other.id!==actor.id);
        const teamCenter=teamMates.length?{
          x:teamMates.reduce((sum,item)=>sum+item.x,0)/teamMates.length,
          y:teamMates.reduce((sum,item)=>sum+item.y,0)/teamMates.length
        }:actor;
        const cohesionDistance=distance(slot.position,teamCenter);
        const cohesionLimit=element==="maneuver"?440:element==="medical"?360:340;
        const cohesionPenalty=cohesionDistance>cohesionLimit?(cohesionDistance-cohesionLimit)*.7:0;
        const fireBonus=clearEdges.length?(role==="base_of_fire"?82:28):(role==="base_of_fire"?-260:-55);
        const crowdPenalty=occupancy*145+localDensity*92+sameElement*135+otherElement*210;
        const score=(node.coverType==="hard"?88:44)*doctrine.coverPriority+
          (actor.factionId==="commune"||actor.factionId==="freelancers"?18:0)+fireBonus-
          travel*.18-anchorDistance*.08-openCost*.12-secondaryExposure-crowdPenalty-spacingPenalty-routePenalty-cohesionPenalty-
          (role==="medic"&&distance(slot.position,threat)<420?120:0);
        return {...node,availableSlot:slot,clearEdges,travel,openCost,score,localDensity,occupancy};
      })
      .filter(Boolean)
      .sort((a,b)=>b.score-a.score);
  }

  makeAssignment(node,slot,seconds,role,element){
    const preferred=slot.side;
    const firePositions=(node.firePositions??[]).slice().sort((a,b)=>
      (preferred&&a.side===preferred?-1:0)-(preferred&&b.side===preferred?-1:0)
    );
    return {...node,
      protectedPosition:{...slot.position},assignedSlot:slot,slotId:slot.id,role,element,
      firePositions,
      leftFirePosition:firePositions.find(item=>item.side==="left")?.position??node.leftFirePosition,
      rightFirePosition:firePositions.find(item=>item.side==="right")?.position??node.rightFirePosition,
      reservedUntil:this.now()+seconds
    };
  }

  reserve(actor,node,seconds=18,{role=null,element=null}={}){
    const current=this.actorAssignment(actor);
    if(current?.nodeId===node.nodeId){
      const reservation=this.reservations.get(current.slotId);
      reservation.until=this.now()+seconds;
      current.reservedUntil=reservation.until;
      actor.coverLeaseUntil=Math.max(actor.coverLeaseUntil??0,this.now()+Math.min(seconds,14));
      return current;
    }
    const available=this.availableSlots(actor,node);
    const slot=(node.availableSlot&&available.find(item=>item.id===node.availableSlot.id))??available[0];
    if(!slot)return null;
    this.releaseActor(actor,{clearAssignment:false});
    this.reservations.set(slot.id,{
      actorId:actor.id,nodeId:node.nodeId,obstacleIndex:node.index,
      reservedAt:this.now(),until:this.now()+seconds
    });
    const assignment=this.makeAssignment(node,slot,seconds,role,element);
    actor.assignedCoverNode=assignment;
    actor.coverLeaseUntil=this.now()+Math.min(seconds,14);
    actor.coverReassignmentReason=null;
    return assignment;
  }

  bestCover(actor,threat,options={}){
    const chosen=this.candidates(actor,threat,options)[0]??null;
    return chosen?this.reserve(actor,chosen,options.reserveSeconds??18,{
      role:options.role??actor.fireTeamRole??actor.tacticalRole,
      element:options.element??actor.fireTeamElement
    }):null;
  }

  bestRearCover(actor,threat,{anchor=null,context=null,reserveSeconds=28}={}){
    if(!actor||!threat)return null;
    const currentDistance=distance(actor,threat);
    const currentIndex=actor.assignedCoverNode?.index;
    const candidates=this.candidates(actor,threat,{
      anchor:anchor??actor.tacticalRallyPoint??actor,
      maxDistance:820,
      secondaryThreats:context?.secondaryThreats??[],
      excludeObstacleIndexes:Number.isFinite(currentIndex)?[currentIndex]:[],
      minimumSpacing:82,
      role:actor.fireTeamRole??actor.tacticalRole,
      element:actor.fireTeamElement
    }).filter(node=>distance(node.protectedPosition,threat)>currentDistance+70)
      .sort((a,b)=>{
        const aRear=distance(a.protectedPosition,threat)-currentDistance;
        const bRear=distance(b.protectedPosition,threat)-currentDistance;
        return (bRear+b.score*.35)-(aRear+a.score*.35);
      });
    const chosen=candidates[0]??null;
    return chosen?this.reserve(actor,chosen,reserveSeconds,{
      role:actor.fireTeamRole??actor.tacticalRole,
      element:actor.fireTeamElement
    }):null;
  }

  bestCasualtyCover(actor,patient,threat,{context=null,reserveSeconds=34}={}){
    if(!actor||!patient||!threat)return null;
    const patientDistance=distance(patient,threat);
    const suppressorObstacles=new Set(
      (context?.suppressorIds??[])
        .map(id=>this.game.actors.find(candidate=>candidate.id===id)?.assignedCoverNode?.index)
        .filter(Number.isFinite)
    );
    const away=normalize(patient.x-threat.x,patient.y-threat.y);
    const anchor=actor.tacticalRallyPoint??{
      x:patient.x+away.x*220,
      y:patient.y+away.y*220
    };
    const candidates=this.candidates(actor,threat,{
      anchor,maxDistance:760,
      secondaryThreats:context?.secondaryThreats??[],
      excludeObstacleIndexes:[...suppressorObstacles],
      minimumSpacing:96,
      role:"medic",element:"medical"
    }).filter(node=>
      distance(node.protectedPosition,threat)>patientDistance+55&&
      node.localDensity<3
    );
    const chosen=candidates[0]??null;
    return chosen?this.reserve(actor,chosen,reserveSeconds,{role:"medic",element:"medical"}):null;
  }

  hasUsableFireLane(node,target){
    return Boolean(node&&target&&this.clearFirePositions(node,target).length);
  }

  routeWaypoint(actor,finalNode,threat,{secondaryThreats=[]}={}){
    if(!finalNode)return null;
    const final=finalNode.protectedPosition;
    const total=distance(actor,final);
    if(total<300)return final;
    const intermediate=this.candidates(actor,threat,{
      anchor:final,maxDistance:340,secondaryThreats,excludeObstacleIndexes:[finalNode.index],minimumSpacing:72
    }).filter(node=>distance(node.protectedPosition,final)<total-90&&distance(actor,node.protectedPosition)>90)
      .filter(node=>node.occupancy===0&&node.localDensity<2)[0];
    if(!intermediate||intermediate.score<-30)return final;
    const reservation=this.routeReservations.get(intermediate.nodeId);
    if(reservation&&reservation.actorId!==actor.id)return final;
    this.routeReservations.set(intermediate.nodeId,{actorId:actor.id,until:this.now()+5.5});
    actor.coverRouteFinalNode=finalNode;
    actor.coverRouteIntermediateNode=intermediate;
    return intermediate.availableSlot?.position??intermediate.protectedPosition;
  }

  nearestFirePosition(actor,node,target){
    if(!node||!target)return null;
    return this.clearFirePositions(node,target)
      .slice().sort((a,b)=>distance(actor,a.position)-distance(actor,b.position))[0]?.position??null;
  }

  shotViability(origin,target,{ignoreObstacle=null}={}){
    if(!origin||!target)return {status:"invalid",obstacle:null};
    const blocked=this.shotBlocked(origin,target,{ignoreObstacle});
    return blocked?{status:"blocked",obstacle:blocked.obstacle,distance:blocked.distance}:{status:"clear",obstacle:null,distance:distance(origin,target)};
  }

  suppressionPoint(origin,target){
    const blocked=this.shotBlocked(origin,target);
    if(!blocked)return {x:target.x,y:target.y};
    const dx=target.x-blocked.obstacle.x,dy=target.y-blocked.obstacle.y;
    const length=Math.max(1,Math.hypot(dx,dy));
    const offset=(blocked.obstacle.radius??28)*.58;
    return {x:blocked.obstacle.x+dx/length*offset,y:blocked.obstacle.y+dy/length*offset};
  }
}
