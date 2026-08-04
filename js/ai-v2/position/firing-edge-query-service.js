const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
function pointSegmentDistance(point,start,end){const dx=end.x-start.x,dy=end.y-start.y;const length=dx*dx+dy*dy;if(length<.001)return distance(point,start);const t=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/length));return distance(point,{x:start.x+dx*t,y:start.y+dy*t});}
export class FiringEdgeQueryService{
  getCandidates({slot,threatPoint,actorRadius=18,edgeClearance=12}={}){
    if(!slot?.obstacle||!threatPoint)return[];
    const obstacle=slot.obstacle;const vx=threatPoint.x-obstacle.x,vy=threatPoint.y-obstacle.y;const length=Math.hypot(vx,vy)||1;const px=-vy/length,py=vx/length;const radius=Math.max(18,obstacle.radius??36)+actorRadius+edgeClearance;
    return[-1,1].map((side,index)=>({id:`${slot.id}:edge:${index}`,side:side<0?"left":"right",point:{x:obstacle.x+px*radius*side,y:obstacle.y+py*radius*side},returnPoint:{...slot.point},score:0}));
  }
  evaluate({game,actor,slot,threatPoint,friendlies=[]}={}){
    const candidates=this.getCandidates({slot,threatPoint});
    for(const edge of candidates){
      const ownObstacle=slot.obstacle;const ownBlock=pointSegmentDistance(ownObstacle,edge.point,threatPoint)<Math.max(8,(ownObstacle.radius??36)*.72);
      const friendlyBlock=friendlies.some(other=>other.id!==actor?.id&&pointSegmentDistance(other,edge.point,threatPoint)<22&&distance(edge.point,other)<distance(edge.point,threatPoint));
      const travel=distance(actor??slot.point,edge.point);edge.viable=!ownBlock&&!friendlyBlock;edge.blockReason=ownBlock?"own_cover_blocks_lane":friendlyBlock?"friendly_blocks_lane":null;edge.score=(edge.viable?1:0)-travel/1000;
    }
    return{best:candidates.filter(item=>item.viable).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))[0]??null,candidates};
  }
}
