import { isActorPositionClear } from "../../actor-motion.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function cloneSelection(selection){
  return selection?{
    ...selection,
    objectivePoint:{...selection.objectivePoint},
    vector:{...selection.vector},
    rolePoints:Object.fromEntries(Object.entries(selection.rolePoints).map(([key,value])=>[key,{...value}]))
  }:null;
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
      {id:"north",x:0,y:-1},{id:"east",x:1,y:0},{id:"south",x:0,y:1},{id:"west",x:-1,y:0}
    ];
    const candidates=[];

    for(const direction of directions){
      const perpendicular={x:-direction.y,y:direction.x};
      const stage={x:objective.x+direction.x*stagingDistance,y:objective.y+direction.y*stagingDistance};
      const rolePoints={
        approach_lead:{x:stage.x-perpendicular.x*roleSpacing*.55,y:stage.y-perpendicular.y*roleSpacing*.55},
        objective_specialist:{x:objective.x+direction.x*interactionDistance,y:objective.y+direction.y*interactionDistance},
        local_security:{x:stage.x+perpendicular.x*roleSpacing*.7,y:stage.y+perpendicular.y*roleSpacing*.7}
      };
      const clear=Object.values(rolePoints).every(point=>isActorPositionClear(game,point.x,point.y,18));
      if(!clear)continue;
      const travel=distance(teamCenter,stage);
      const spread=distance(rolePoints.approach_lead,rolePoints.local_security);
      const travelUtility=clamp(1-travel/Math.max(1,plan.maximumTravel??1400));
      const spacingUtility=clamp(spread/Math.max(1,roleSpacing*1.2));
      candidates.push({
        id:`${objective.id}:${direction.id}`,
        objectiveId:objective.id,
        directionId:direction.id,
        objectivePoint:{x:objective.x,y:objective.y},
        vector:{x:direction.x,y:direction.y},
        rolePoints,
        score:travelUtility*.78+spacingUtility*.22
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
