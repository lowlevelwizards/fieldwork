import { projectOutsideObstacles } from "./actor-motion.js?v=12e-fire-teams-suppression-authority-20260801";
import { getDoctrine } from "./faction-doctrine.js?v=12e-fire-teams-suppression-authority-20260801";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function normalize(x,y){
  const length=Math.max(1,Math.hypot(x,y));
  return {x:x/length,y:y/length};
}

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
  }

  cleanup(){
    const now=performance.now()/1000;
    for(const [key,value] of this.reservations){
      if(value.until<now)this.reservations.delete(key);
    }
  }

  obstacleType(obstacle){
    return obstacle.type==='rock'?'hard':obstacle.type==='tree'?'soft':'soft';
  }

  nodeForObstacle(obstacle,index,threat,actor){
    const away=normalize(obstacle.x-threat.x,obstacle.y-threat.y);
    const lateral={x:-away.y,y:away.x};
    const radius=obstacle.radius??28;
    const clearance=radius+(actor.radius??18)+10;
    const protectedPosition=projectOutsideObstacles(
      this.game,
      obstacle.x+away.x*clearance,
      obstacle.y+away.y*clearance,
      actor.radius??18,8
    );
    const edgeOffset=Math.max(24,radius*.68);
    const edgeDepth=Math.max(7,radius*.16);
    const leftFirePosition=projectOutsideObstacles(
      this.game,
      protectedPosition.x+lateral.x*edgeOffset-away.x*edgeDepth,
      protectedPosition.y+lateral.y*edgeOffset-away.y*edgeDepth,
      actor.radius??18,6
    );
    const rightFirePosition=projectOutsideObstacles(
      this.game,
      protectedPosition.x-lateral.x*edgeOffset-away.x*edgeDepth,
      protectedPosition.y-lateral.y*edgeOffset-away.y*edgeDepth,
      actor.radius??18,6
    );
    const sector=Math.round(Math.atan2(away.y,away.x)/(Math.PI/4));
    return {
      id:`cover:${index}:${sector}`,
      obstacle,index,
      coverType:this.obstacleType(obstacle),
      protectedPosition,
      leftFirePosition,
      rightFirePosition,
      threatPosition:{x:threat.x,y:threat.y},
      protectedDirection:{x:-away.x,y:-away.y},
      quality:this.obstacleType(obstacle)==='hard'?.94:.67,
      capacity:this.obstacleType(obstacle)==='hard'?2:1
    };
  }

  blocksThreat(node,threat,position=node.protectedPosition){
    const obstacle=node.obstacle;
    return pointSegmentDistance(obstacle,threat,position)<(obstacle.radius??28)*.92;
  }

  openGroundCost(from,to,threat){
    const length=distance(from,to);
    if(length<1)return 0;
    let protectedSamples=0;
    const samples=Math.max(2,Math.ceil(length/80));
    for(let i=1;i<samples;i++){
      const t=i/samples;
      const point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
      const covered=(this.game.map.obstacles??[]).some(obstacle=>{
        const near=distance(point,obstacle)<(obstacle.radius??28)+34;
        return near&&pointSegmentDistance(obstacle,threat,point)<(obstacle.radius??28)*.9;
      });
      if(covered)protectedSamples++;
    }
    return length*(1-protectedSamples/Math.max(1,samples-1));
  }

  candidates(actor,threat,{anchor=null,maxDistance=620,secondaryThreats=[]}={}){
    if(!actor||!threat)return [];
    this.cleanup();
    const doctrine=getDoctrine(actor.factionId);
    const reference=anchor??actor;
    return (this.game.map.obstacles??[])
      .map((obstacle,index)=>this.nodeForObstacle(obstacle,index,threat,actor))
      .filter(node=>distance(actor,node.protectedPosition)<=maxDistance)
      .filter(node=>this.blocksThreat(node,threat))
      .map(node=>{
        const travel=distance(actor,node.protectedPosition);
        const anchorDistance=distance(reference,node.protectedPosition);
        const openCost=this.openGroundCost(actor,node.protectedPosition,threat);
        const secondaryExposure=secondaryThreats.reduce((sum,item)=>{
          const secondary=item.position??item;
          return sum+(this.blocksThreat(node,secondary)?0:38);
        },0);
        const reserved=this.reservations.get(node.id);
        const occupancyPenalty=reserved&&reserved.actorId!==actor.id?420:0;
        const hardBonus=node.coverType==='hard'?85:42;
        const concealmentBonus=actor.factionId==='commune'||actor.factionId==='freelancers'?18:0;
        const score=
          hardBonus*doctrine.coverPriority+
          concealmentBonus-
          travel*.18-
          anchorDistance*.08-
          openCost*.12-
          secondaryExposure-
          occupancyPenalty;
        return {...node,travel,openCost,score};
      })
      .sort((a,b)=>b.score-a.score);
  }

  reserve(actor,node,seconds=14){
    if(!actor||!node)return null;
    this.cleanup();
    this.reservations.set(node.id,{actorId:actor.id,until:performance.now()/1000+seconds});
    actor.assignedCoverNode=node;
    return node;
  }

  bestCover(actor,threat,options={}){
    const chosen=this.candidates(actor,threat,options)[0]??null;
    return chosen?this.reserve(actor,chosen,options.reserveSeconds??14):null;
  }

  routeWaypoint(actor,finalNode,threat,{secondaryThreats=[]}={}){
    if(!finalNode)return null;
    const final=finalNode.protectedPosition;
    const total=distance(actor,final);
    if(total<300)return final;

    const options=this.candidates(actor,threat,{
      anchor:final,maxDistance:330,secondaryThreats
    }).filter(node=>node.id!==finalNode.id)
      .filter(node=>distance(node.protectedPosition,final)<total-90)
      .filter(node=>distance(actor,node.protectedPosition)>80);
    const intermediate=options[0];
    if(!intermediate||intermediate.score<-30)return final;
    actor.coverRouteFinalNode=finalNode;
    actor.coverRouteIntermediateNode=intermediate;
    return intermediate.protectedPosition;
  }

  nearestFirePosition(actor,node,target){
    if(!node)return null;
    const positions=[node.leftFirePosition,node.rightFirePosition]
      .map(position=>({
        position,
        blocked:this.shotBlocked(position,target),
        travel:distance(actor,position)
      }))
      .sort((a,b)=>Boolean(a.blocked)-Boolean(b.blocked)||a.travel-b.travel);
    return positions[0]?.position??null;
  }

  shotViability(origin,target){
    if(!origin||!target)return {status:'invalid',obstacle:null};
    const blocked=this.shotBlocked(origin,target);
    return blocked
      ?{status:'blocked',obstacle:blocked.obstacle,distance:blocked.distance}
      :{status:'clear',obstacle:null,distance:distance(origin,target)};
  }

  suppressionPoint(origin,target){
    const blocked=this.shotBlocked(origin,target);
    if(!blocked)return {x:target.x,y:target.y};
    const obstacle=blocked.obstacle;
    const dx=target.x-obstacle.x,dy=target.y-obstacle.y;
    const length=Math.max(1,Math.hypot(dx,dy));
    const offset=(obstacle.radius??28)*.58;
    return {x:obstacle.x+dx/length*offset,y:obstacle.y+dy/length*offset};
  }

  shotBlocked(origin,target){
    let nearest=null;
    const total=distance(origin,target);
    for(const obstacle of this.game.map.obstacles??[]){
      const lineDistance=pointSegmentDistance(obstacle,origin,target);
      if(lineDistance>(obstacle.radius??28)*.82)continue;
      const along=distance(origin,obstacle);
      if(along<30||along>=total-18)continue;
      if(!nearest||along<nearest.distance)nearest={obstacle,distance:along};
    }
    return nearest;
  }
}
