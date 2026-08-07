import { projectOutsideObstacles } from "../../actor-motion.js";
import { navigationAngles, navigationDistanceFactors, navigationMode, navigationWeights, continuityScale, NAVIGATION_MODES } from "./tactical-navigation-policy.js";
import { corridorMetrics, directionalProtection, pathClearance, predictedFriendlyCongestion } from "./tactical-navigation-geometry.js";

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const norm=(x,y)=>{const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};};
const point=value=>value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))?{x:Number(value.x),y:Number(value.y)}:null;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const radians=degrees=>degrees*Math.PI/180;
const cellKey=(value,size=54)=>`${Math.round((value?.x??0)/size)}:${Math.round((value?.y??0)/size)}`;

function fieldGoal(actor,intent){
  const region=intent?.region;
  if(!actor||!region?.center)return point(intent?.goal??intent?.destination);
  const center=region.center;
  const dx=actor.x-center.x,dy=actor.y-center.y,d=Math.hypot(dx,dy);
  const inner=Math.max(0,Number(region.innerRadius)||0);
  const outer=Math.max(inner+1,Number(region.outerRadius)||Number(intent.acceptanceRadius)||1);
  const preferred=clamp(Number(region.preferredRadius)||0,inner,outer);
  if(region.type==="annulus"){
    if(d>=inner&&d<=outer)return{x:actor.x,y:actor.y};
    const angle=d>1?Math.atan2(dy,dx):Number(region.angularBias)||0;
    const targetRadius=d<inner?Math.max(inner,preferred):Math.min(outer,preferred||outer);
    return{x:center.x+Math.cos(angle)*targetRadius,y:center.y+Math.sin(angle)*targetRadius};
  }
  if(d<=outer)return{x:actor.x,y:actor.y};
  if(preferred>0){
    const angle=d>1?Math.atan2(dy,dx):Number(region.angularBias)||0;
    return{x:center.x+Math.cos(angle)*preferred,y:center.y+Math.sin(angle)*preferred};
  }
  return{...center};
}

function angleDifference(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function rotate(vector,angle){const c=Math.cos(angle),s=Math.sin(angle);return{x:vector.x*c-vector.y*s,y:vector.x*s+vector.y*c};}
function cloneCandidate(candidate){return candidate?{angleDegrees:candidate.angleDegrees,distance:candidate.distance,score:candidate.score,target:{...candidate.target},factors:{...candidate.factors},clear:candidate.clear,blockingObstacleId:candidate.blockingObstacleId??null,nearestObstacleId:candidate.nearestObstacleId??null}:null;}
function candidateHeading(baseHeading,angleDegrees){return baseHeading+radians(angleDegrees);}

/**
 * Converts a durable spatial intent into a short-horizon tactical navigation
 * choice. It owns no authority and chooses no tactical goal; it only evaluates
 * physically plausible nearby ways to pursue the action that already won.
 */
export class TacticalSteeringService{
  constructor({commitSeconds=.62,failureMemorySeconds=5.5,visitMemorySeconds=4.2}={}){
    this.commitSeconds=Math.max(.25,Number(commitSeconds)||.62);
    this.failureMemorySeconds=Math.max(2,Number(failureMemorySeconds)||5.5);
    this.visitMemorySeconds=Math.max(2,Number(visitMemorySeconds)||4.2);
    this.byActor=new Map();
  }

  steer(actor,intent,{game,now=0}={}){
    const goal=fieldGoal(actor,intent);
    if(!actor||!goal)return goal??null;
    const goalDistance=distance(actor,goal);
    if(goalDistance<=.01){
      const target={x:actor.x,y:actor.y};
      actor.aiV2Steering={kind:intent?.kind??"spatial_intent",goal:{...goal},target:{...target},goalDistance:0,pressure:0,navigationMode:NAVIGATION_MODES.NORMAL,candidateCount:0,selected:null,alternatives:[],recentFailures:0,updatedAt:now};
      return target;
    }

    const state=this.#state(actor,goal,intent,now);
    this.#observeProgress(actor,state,now);
    const direct=norm(goal.x-actor.x,goal.y-actor.y);
    const baseHeading=Math.atan2(direct.y,direct.x);
    const nearProbe={x:actor.x+direct.x*Math.min(86,goalDistance),y:actor.y+direct.y*Math.min(86,goalDistance)};
    const directClearance=pathClearance(game,actor,nearProbe,{actorRadius:actor.radius??18,clearance:7});
    const teammates=(game?.actors??[]).filter(other=>other.id!==actor.id&&other.teamId===actor.teamId&&!other.medical?.dead);
    const nearbyFriendlies=teammates.filter(other=>distance(actor,other)<96);
    const localCongestion=clamp(nearbyFriendlies.reduce((sum,other)=>sum+clamp((96-distance(actor,other))/96),0)/Math.max(1,teammates.length));
    const mode=navigationMode(actor,{nearObstacle:directClearance.minimumClearance<34||!directClearance.clear,localCongestion});
    const weights=navigationWeights(intent,actor);
    const allowRetreat=Boolean(intent.allowRetreat||mode===NAVIGATION_MODES.RECOVERY);
    const baseLookAhead=Math.max(42,Math.min(intent.lookAhead??104,goalDistance));
    const maxLookAhead=mode===NAVIGATION_MODES.RECOVERY?184:mode===NAVIGATION_MODES.CONSTRAINED?148:124;
    const angles=navigationAngles(mode,{allowRetreat});
    const factors=navigationDistanceFactors(mode);
    const threat=point(intent.threatPoint??actor.aiV2TacticalPicture?.threatPoint??null);
    const currentProtection=directionalProtection(game,actor,threat);
    const preferredMin=Math.max(34,Number(intent.preferredSeparationMin)||58);
    const candidates=[];

    for(const angleDegrees of angles)for(const factor of factors){
      const heading=rotate(direct,radians(angleDegrees));
      const step=Math.max(34,Math.min(maxLookAhead,baseLookAhead*factor,goalDistance+44));
      const target={x:actor.x+heading.x*step,y:actor.y+heading.y*step};
      const clearance=pathClearance(game,actor,target,{actorRadius:actor.radius??18,clearance:7});
      const afterDistance=distance(target,goal);
      const progress=clamp((goalDistance-afterDistance)/Math.max(34,step),-1,1);
      const corridor=corridorMetrics(target,intent.corridor);
      const protection=directionalProtection(game,target,threat);
      const midpoint={x:(actor.x+target.x)/2,y:(actor.y+target.y)/2};
      const midpointProtection=directionalProtection(game,midpoint,threat);
      const congestion=predictedFriendlyCongestion(actor,target,game,{preferredMin});
      const clearanceScore=clearance.clear?clamp((clearance.minimumClearance+18)/100):0;
      const threatBefore=threat?distance(actor,threat):0;
      const threatAfter=threat?distance(target,threat):0;
      const threatApproach=threat?clamp((threatBefore-threatAfter)/Math.max(80,step),-1,1):0;
      const protectionGain=clamp((protection-currentProtection)*1.25,-1,1);
      const exposure=threat?clamp(1-(protection*.62+midpointProtection*.38)):0;
      const withdraw=weights.kind==="withdraw";
      const threatValue=threat
        ?withdraw?clamp((threatAfter-threatBefore)/Math.max(80,step),-1,1)*.65+protection*.35
          :weights.threatApproachAllowed?protection*.5-exposure*.16
          :protection*.42+protectionGain*.3-threatApproach*.36-exposure*.24
        :0;
      const continuity=this.#continuity(candidateHeading(baseHeading,angleDegrees),target,state,now);
      const failure=this.#failurePenalty(target,clearance,angleDegrees,state,now);
      const revisit=this.#visitPenalty(target,state,now);
      const regression=Math.max(0,-progress);
      const score=(
        progress*weights.progress+
        clearanceScore*weights.clearance+
        corridor.alignment*weights.corridor+
        protection*weights.cover*weights.contactFactor+
        threatValue*weights.threat*weights.contactFactor+
        (1-clamp(congestion.penalty))*weights.spacing+
        continuity*weights.continuity*continuityScale(actor)-
        failure*weights.failure-
        revisit*weights.failure*.32-
        regression*weights.regression
      );
      candidates.push({
        angleDegrees,distance:step,target,headingAngle:candidateHeading(baseHeading,angleDegrees),score,
        clear:clearance.clear,blockingObstacleId:clearance.blockingObstacleId,nearestObstacleId:clearance.nearestObstacleId,
        nearestObstacle:clearance.nearestObstacle,
        factors:{progress,clearance:clearanceScore,corridor:corridor.alignment,cover:protection,threat:threatValue,spacing:1-clamp(congestion.penalty),continuity,failure,revisit,regression}
      });
    }

    const viable=candidates.filter(candidate=>candidate.clear).sort((a,b)=>b.score-a.score||Math.abs(a.angleDegrees)-Math.abs(b.angleDegrees)||b.distance-a.distance||a.angleDegrees-b.angleDegrees);
    let selected=viable[0]??null;
    if(!selected){
      const projected=projectOutsideObstacles(game,nearProbe.x,nearProbe.y,actor.radius??18,8);
      selected={angleDegrees:0,distance:distance(actor,projected),target:projected,headingAngle:baseHeading,score:-2,clear:true,nearestObstacle:null,nearestObstacleId:null,factors:{progress:0,clearance:0,corridor:0,cover:0,threat:0,spacing:0,continuity:0,failure:0,revisit:0,regression:0}};
    }

    this.#commit(actor,state,selected,intent,goal,now);
    const alternatives=viable.slice(0,4).filter(candidate=>candidate!==selected).slice(0,3).map(cloneCandidate);
    actor.aiV2Steering={
      kind:intent.kind??"spatial_intent",goal:{...goal},target:{...selected.target},goalDistance,
      pressure:clamp((1-selected.factors.clearance)*.55+selected.factors.failure*.3+selected.factors.revisit*.15),
      region:intent?.region?{...intent.region,center:{...intent.region.center}}:null,
      navigationMode:mode,candidateCount:candidates.length,
      selected:cloneCandidate(selected),alternatives,
      recentFailures:state.failures.filter(item=>item.expiresAt>now).length,
      recentVisits:state.visits.filter(item=>now-item.at<=this.visitMemorySeconds).length,
      livenessStatus:actor.aiV2ActionLiveness?.status??"healthy",updatedAt:now
    };
    return selected.target;
  }

  regionSatisfied(actor,intent){
    if(!actor||!intent)return false;
    const region=intent.region;
    if(region?.center){
      const d=Math.hypot(region.center.x-actor.x,region.center.y-actor.y);
      const inner=Math.max(0,Number(region.innerRadius)||0);
      const outer=Math.max(inner,Number(region.outerRadius)||Number(intent.acceptanceRadius)||0);
      if(region.type==="annulus"&&d>=inner&&d<=outer)return true;
      if(region.type==="circle"&&d<=outer)return true;
    }
    const goal=intent.goal??intent.destination;if(!goal)return false;
    const d=Math.hypot(goal.x-actor.x,goal.y-actor.y);
    if(d<=(intent.acceptanceRadius??intent.arrivalRadius??24))return true;
    if(intent.corridor){
      const {from,to,width=120}=intent.corridor;
      const vx=to.x-from.x,vy=to.y-from.y,l2=vx*vx+vy*vy||1;
      const t=clamp(((actor.x-from.x)*vx+(actor.y-from.y)*vy)/l2);
      const px=from.x+vx*t,py=from.y+vy*t;
      const cross=Math.hypot(actor.x-px,actor.y-py);
      const progress=((actor.x-from.x)*vx+(actor.y-from.y)*vy)/l2;
      if(cross<=width&&progress>=(intent.minimumProgress??.88))return true;
    }
    return false;
  }

  #state(actor,goal,intent,now){
    let state=this.byActor.get(actor.id);
    const kind=intent?.kind??"spatial_intent";
    if(!state){
      state={actorId:actor.id,kind,goal:{...goal},selected:null,failures:[],visits:[],lastPosition:{x:actor.x,y:actor.y},lastVisitPosition:{x:actor.x,y:actor.y},lastObservedAt:now};
      this.byActor.set(actor.id,state);
    }
    const materialGoalChange=state.kind!==kind||distance(state.goal,goal)>92;
    if(materialGoalChange)state.selected=null;
    state.kind=kind;state.goal={...goal};
    state.failures=state.failures.filter(item=>item.expiresAt>now);
    state.visits=state.visits.filter(item=>now-item.at<=this.visitMemorySeconds);
    return state;
  }

  #observeProgress(actor,state,now){
    if(distance(actor,state.lastVisitPosition)>=28){state.visits.push({key:cellKey(actor),x:actor.x,y:actor.y,at:now});state.lastVisitPosition={x:actor.x,y:actor.y};}
    const selected=state.selected;
    if(selected&&now-selected.at>=.62&&!selected.failureRecorded){
      const fromAnchor=distance(actor,selected.anchor);
      const targetRemaining=distance(actor,selected.target);
      const liveness=actor.aiV2ActionLiveness;
      const degraded=liveness?.status==="warning"||Number(liveness?.signals?.obstacleJamSeconds??0)>.45||Number(liveness?.signals?.recentReversals??0)>=2;
      if((fromAnchor<7&&targetRemaining>22)||degraded&&fromAnchor<13){
        state.failures.push({x:selected.target.x,y:selected.target.y,angleDegrees:selected.angleDegrees,nearestObstacleId:selected.nearestObstacleId??null,expiresAt:now+this.failureMemorySeconds,reason:degraded?"liveness_degraded":"local_no_progress"});
        selected.failureRecorded=true;
      }
    }
    state.lastPosition={x:actor.x,y:actor.y};state.lastObservedAt=now;
  }

  #continuity(headingAngle,target,state,now){
    const selected=state.selected;if(!selected)return 0;
    const angle=Math.abs(angleDifference(headingAngle,selected.headingAngle));
    const headingSimilarity=clamp(1-angle/(Math.PI*.75));
    const targetSimilarity=clamp(1-distance(target,selected.target)/150);
    const withinCommit=now<selected.commitUntil?1:.35;
    return(headingSimilarity*.72+targetSimilarity*.28)*withinCommit;
  }

  #failurePenalty(target,clearance,angleDegrees,state,now){
    let penalty=0;
    for(const failure of state.failures){
      if(failure.expiresAt<=now)continue;
      const d=distance(target,failure);
      if(d<110)penalty+=clamp((110-d)/110)*.82;
      if(failure.nearestObstacleId&&clearance.nearestObstacleId===failure.nearestObstacleId&&Math.sign(failure.angleDegrees||0)===Math.sign(angleDegrees||0))penalty+=.42;
    }
    return clamp(penalty,0,1.5);
  }

  #visitPenalty(target,state,now){
    const key=cellKey(target);
    const recent=state.visits.filter(item=>item.key===key&&now-item.at<=this.visitMemorySeconds);
    return clamp(recent.length*.34,0,1);
  }

  #commit(actor,state,selected,intent,goal,now){
    const degraded=actor.aiV2ActionLiveness?.status==="warning"||actor.aiV2ActionLiveness?.status==="invalid";
    const prior=state.selected;
    const sameHeading=prior&&Math.abs(angleDifference(prior.headingAngle,selected.headingAngle))<radians(18);
    const sameTarget=prior&&distance(prior.target,selected.target)<62;
    if(prior&&sameHeading&&sameTarget&&!degraded){
      prior.target={...selected.target};prior.headingAngle=selected.headingAngle;prior.angleDegrees=selected.angleDegrees;prior.nearestObstacleId=selected.nearestObstacleId??null;
      prior.commitUntil=Math.max(prior.commitUntil,now+this.commitSeconds*.35);
      return;
    }
    state.selected={
      target:{...selected.target},headingAngle:selected.headingAngle,angleDegrees:selected.angleDegrees,
      nearestObstacleId:selected.nearestObstacleId??null,anchor:{x:actor.x,y:actor.y},at:now,
      commitUntil:now+(degraded?this.commitSeconds*.18:this.commitSeconds),failureRecorded:false,
      intentKind:intent?.kind??"spatial_intent",goal:{...goal}
    };
  }
}
