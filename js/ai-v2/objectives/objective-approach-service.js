import { isActorPositionClear } from "../../actor-motion.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function cloneSelection(selection){
  return selection?{
    ...selection,
    objectivePoint:{...selection.objectivePoint},
    vector:{...selection.vector},
    rolePoints:Object.fromEntries(Object.entries(selection.rolePoints).map(([key,value])=>[key,{...value}])),
    responsibilityZones:selection.responsibilityZones?Object.fromEntries(Object.entries(selection.responsibilityZones).map(([key,value])=>[key,{...value,center:{...value.center}}])):null,
    utility:selection.utility?{...selection.utility}:null
  }:null;
}


function nearbyCoverUtility(game,point,maximumDistance=180){
  let best=0;
  for(const obstacle of game?.map?.obstacles??[]){
    const radius=Math.max(18,Number(obstacle.radius)||36);
    const edge=Math.max(0,distance(point,obstacle)-radius);
    best=Math.max(best,clamp(1-edge/Math.max(1,maximumDistance)));
  }
  return best;
}

function center(actors=[]){
  if(!actors.length)return{x:0,y:0};
  return{x:actors.reduce((sum,actor)=>sum+actor.x,0)/actors.length,y:actors.reduce((sum,actor)=>sum+actor.y,0)/actors.length};
}

export class ObjectiveApproachService{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byTeam=new Map();
  }

  getOrSelect({game,teamId,objective,teamActors=[],plan={},now=0}={}){
    if(!teamId||!objective)return null;
    const existing=this.byTeam.get(teamId);
    if(existing?.objectiveId===objective.id)return cloneSelection(existing);
    const stagingDistance=Math.max(120,Number(plan.stagingDistance)||250);
    const interactionDistance=Math.max(48,Math.min(objective.interactionRadius??78,Number(plan.interactionDistance)||68));
    const roleSpacing=Math.max(60,Number(plan.roleSpacing)||105);
    const teamCenter=center(teamActors);
    const directions=[
      {id:"north",x:0,y:-1},{id:"east",x:1,y:0},{id:"south",x:0,y:1},{id:"west",x:-1,y:0},
      ...[1,3,5,7,9,11,13,15].map(index=>{const angle=index*Math.PI/8;return{id:`radial_${index}`,x:Math.cos(angle),y:Math.sin(angle)};})
    ];
    const candidates=[];

    for(const direction of directions){
      const perpendicular={x:-direction.y,y:direction.x};
      const stage={x:objective.x+direction.x*stagingDistance,y:objective.y+direction.y*stagingDistance};
      const rolePoints={
        approach_lead:{x:stage.x,y:stage.y},
        objective_specialist:{x:objective.x+direction.x*interactionDistance,y:objective.y+direction.y*interactionDistance},
        local_security:{x:stage.x+perpendicular.x*roleSpacing*.85,y:stage.y+perpendicular.y*roleSpacing*.85}
      };
      if(!isActorPositionClear(game,rolePoints.objective_specialist.x,rolePoints.objective_specialist.y,18))continue;
      if(!isActorPositionClear(game,rolePoints.local_security.x,rolePoints.local_security.y,18))continue;
      const travel=distance(teamCenter,stage);
      const spread=distance(rolePoints.approach_lead,rolePoints.local_security);
      const travelUtility=clamp(1-travel/Math.max(1,plan.maximumTravel??1400));
      const spacingUtility=clamp(spread/Math.max(1,roleSpacing*1.2));
      const directness=clamp(1-distance(teamCenter,rolePoints.objective_specialist)/Math.max(1,plan.maximumTravel??1400));
      const specialistCover=nearbyCoverUtility(game,rolePoints.objective_specialist,210);
      const securityCover=nearbyCoverUtility(game,rolePoints.local_security,240);
      const fallbackPoint={x:stage.x+direction.x*110,y:stage.y+direction.y*110};
      const fallbackClear=isActorPositionClear(game,fallbackPoint.x,fallbackPoint.y,18)?1:0;
      candidates.push({
        id:`${objective.id}:${direction.id}`,
        objectiveId:objective.id,
        directionId:direction.id,
        objectivePoint:{x:objective.x,y:objective.y},
        vector:{x:direction.x,y:direction.y},
        rolePoints,
        responsibilityZones:{
          objectiveAccess:{center:{...rolePoints.objective_specialist},radius:Math.max(32,interactionDistance*.55)},
          securityCoverage:{center:{...rolePoints.local_security},radius:Math.max(90,roleSpacing)},
          supportRange:{center:{...stage},radius:Math.max(120,roleSpacing*1.45)},
          fallbackAccess:{center:fallbackPoint,radius:70}
        },
        utility:{travel:travelUtility,directness,spacing:spacingUtility,specialistCover,securityCover,fallback:fallbackClear},
        score:travelUtility*.31+directness*.24+spacingUtility*.08+specialistCover*.14+securityCover*.17+fallbackClear*.06
      });
    }

    candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const selected=candidates[0]??null;
    if(!selected)return null;
    const record={...cloneSelection(selected),teamId,selectedAt:now,candidateCount:candidates.length};
    this.byTeam.set(teamId,record);
    this.decisionLog?.record?.({
      type:"objective_approach_selected",time:now,teamId,
      data:{objectiveId:objective.id,approachId:record.id,directionId:record.directionId,score:record.score,candidateCount:record.candidateCount,rolePoints:record.rolePoints}
    });
    return cloneSelection(record);
  }

  get(teamId){return cloneSelection(this.byTeam.get(teamId)??null);}
  clear(teamId){this.byTeam.delete(teamId);}
  summary(){return[...this.byTeam.values()].map(cloneSelection);}
}
