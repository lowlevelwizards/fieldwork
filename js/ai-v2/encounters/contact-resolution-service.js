const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function activeActors(game,teamId){return (game?.actors??[]).filter(actor=>actor.teamId===teamId&&!actor.medical?.dead&&!actor.medical?.unconscious);}
function center(actors){if(!actors.length)return null;return{x:actors.reduce((s,a)=>s+a.x,0)/actors.length,y:actors.reduce((s,a)=>s+a.y,0)/actors.length};}
function radius(actors,c){return actors.reduce((m,a)=>Math.max(m,distance(a,c)+(a.radius??18)),0);}
function operationFor(game,actors){const id=actors.find(a=>a.operationId)?.operationId;return id?game?.livingSandbox?.getOperation?.(id)??null:null;}
function heading(actors){const moving=actors.filter(a=>Math.hypot(a.vx??0,a.vy??0)>.02);if(!moving.length)return{x:0,y:0};const x=moving.reduce((s,a)=>s+(a.vx??0),0),y=moving.reduce((s,a)=>s+(a.vy??0),0),l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}

export class ContactResolutionService{
  constructor({decisionLog=null}={}){this.decisionLog=decisionLog;this.byPair=new Map();}
  assess({game,observerTeamId,subjectTeamId,relationship="unknown",now=0}={}){
    if(!observerTeamId||!subjectTeamId||observerTeamId===subjectTeamId)return null;
    const ownActors=activeActors(game,observerTeamId),otherActors=activeActors(game,subjectTeamId);
    const ownCenter=center(ownActors),otherCenter=center(otherActors);if(!ownCenter||!otherCenter)return null;
    const ownRadius=radius(ownActors,ownCenter),otherRadius=radius(otherActors,otherCenter);
    const separation=Math.max(0,distance(ownCenter,otherCenter)-ownRadius-otherRadius);
    const ownOperation=operationFor(game,ownActors),otherOperation=operationFor(game,otherActors);
    const objectiveConflict=Boolean(ownOperation?.objectiveId&&ownOperation.objectiveId===otherOperation?.objectiveId);
    const operationConflict=Boolean(ownOperation?.id&&otherOperation?.id&&(ownOperation.contestedByOperationId===otherOperation.id||otherOperation.contestedByOperationId===ownOperation.id));
    const ownHeading=heading(ownActors),otherHeading=heading(otherActors);
    const toOther={x:otherCenter.x-ownCenter.x,y:otherCenter.y-ownCenter.y};const len=Math.hypot(toOther.x,toOther.y)||1;
    const closing=clamp(((ownHeading.x-otherHeading.x)*(toOther.x/len)+(ownHeading.y-otherHeading.y)*(toOther.y/len)+1)/2);
    const routeConflict=separation<420&&closing>.58;
    const hostile=relationship==="hostile"||operationConflict;
    const protectedFriendly=["own_team","same_faction","cooperating"].includes(relationship);
    const materiallyRelevant=!protectedFriendly&&(separation<300||routeConflict||objectiveConflict||hostile&&separation<760);
    const kind=hostile?"engage":objectiveConflict?"contest":materiallyRelevant?"avoid":"observe";
    const key=[observerTeamId,subjectTeamId].sort().join("::");
    const prior=this.byPair.get(key);const record={key,observerTeamId,subjectTeamId,relationship:hostile?"hostile":relationship,separation,ownCenter,otherCenter,ownRadius,otherRadius,routeConflict,objectiveConflict,operationConflict,mutualAwareness:true,materiallyRelevant,kind,minimumSeparation:Math.max(170,ownRadius+otherRadius+90),assessedAt:now};
    this.byPair.set(key,record);
    if(materiallyRelevant&&(!prior||prior.kind!==kind))this.decisionLog?.record?.({type:"team_contact_resolution_required",time:now,teamId:observerTeamId,data:{subjectTeamId,relationship,kind,separation:Math.round(separation),routeConflict,objectiveConflict}});
    return{...record,ownCenter:{...ownCenter},otherCenter:{...otherCenter}};
  }
  get(teamAId,teamBId){const item=this.byPair.get([teamAId,teamBId].sort().join("::"));return item?{...item,ownCenter:{...item.ownCenter},otherCenter:{...item.otherCenter}}:null;}
  summary(){return[...this.byPair.values()].map(item=>({...item,ownCenter:{...item.ownCenter},otherCenter:{...item.otherCenter}}));}
}
