import { isAlive, isCombatCapable, isTreating } from "./actor-state.js?v=12e-fire-teams-suppression-authority-20260801";

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function roleScore(actor){
  let score=0;
  if(actor.tacticalRole==="base_of_fire")score+=120;
  if(actor.tacticalRole==="leader")score+=42;
  if(/security|rifleman|engineer/i.test(actor.role??""))score+=26;
  if(actor.coverState==="hard")score+=38;
  else if(actor.coverState==="soft")score+=22;
  score+=(actor.ammoInMagazine??0)*1.3;
  score-=(actor.suppression??0)*.55;
  if(isTreating(actor))score-=300;
  return score;
}

export class FireTeamControllerSystem{
  constructor(game){
    this.game=game;
  }

  teamActors(teamId){
    return this.game.actors.filter(actor=>(actor.teamId??actor.factionId)===teamId&&isAlive(actor));
  }

  enemySuppression(context){
    const enemies=this.game.teamCombatContexts?.teamActors?.(context.primaryThreatTeamId)??[];
    const capable=enemies.filter(isCombatCapable);
    if(!capable.length)return 0;
    return capable.reduce((sum,actor)=>sum+(actor.suppression??0),0)/capable.length;
  }

  validSuppressors(context,actors){
    const valid=new Set(actors.map(actor=>actor.id));
    return (context.suppressorIds??[]).filter(id=>valid.has(id));
  }

  assignRoles(context,actors,now){
    const medics=actors.filter(actor=>/medic|shelter worker/i.test(actor.role??""));
    const line=actors.filter(actor=>!medics.includes(actor));
    const desiredSuppressors=line.length>=5?2:line.length>=2?1:0;
    let suppressorIds=this.validSuppressors(context,line);

    if(suppressorIds.length<desiredSuppressors||now>(context.fireRoleLockedUntil??0)){
      suppressorIds=line
        .slice()
        .sort((a,b)=>roleScore(b)-roleScore(a))
        .slice(0,desiredSuppressors)
        .map(actor=>actor.id);
      context.suppressorIds=suppressorIds;
      context.fireRoleLockedUntil=now+12;
    }

    const maneuver=line.filter(actor=>!suppressorIds.includes(actor.id));
    const currentBound=maneuver.find(actor=>actor.id===context.boundActorId&&isCombatCapable(actor));
    const boundExpired=now>(context.boundUntil??0);
    const boundArrived=currentBound&&currentBound.assignedCoverNode&&
      distance(currentBound,currentBound.assignedCoverNode.protectedPosition)<58&&
      now-(context.boundStartedAt??now)>2.2;

    if(!currentBound||boundExpired||boundArrived){
      const ordered=maneuver.slice().sort((a,b)=>{
        const aLast=a.lastBoundAt??-999,bLast=b.lastBoundAt??-999;
        return aLast-bLast;
      });
      const next=ordered[0]??null;
      context.boundActorId=next?.id??null;
      context.boundStartedAt=now;
      context.boundUntil=now+7;
      if(next)next.lastBoundAt=now;
    }

    for(const actor of actors){
      if(medics.includes(actor))actor.fireTeamRole="medic";
      else if(suppressorIds.includes(actor.id))actor.fireTeamRole="base_of_fire";
      else if(actor.id===context.boundActorId)actor.fireTeamRole="maneuver";
      else actor.fireTeamRole="security";
    }
  }

  updateContext(context,now){
    if(!context?.primaryThreatTeamId||context.alertState!=="engaged"){
      for(const actor of this.teamActors(context?.teamId)){
        actor.fireTeamRole=null;
        actor.suppressionAssignment=null;
        actor.boundAuthorized=false;
        actor.holdForCoveringFire=false;
      }
      return;
    }
    const actors=this.teamActors(context.teamId).filter(actor=>isCombatCapable(actor)&&!isTreating(actor));
    if(!actors.length)return;

    this.assignRoles(context,actors,now);
    const plan=context.currentPlan??"hold";
    const coordinatedMove=["push","flank_left","flank_right","support"].includes(plan);
    const enemySuppression=this.enemySuppression(context);
    const recentCoveringFire=now-(context.lastSuppressiveShotAt??-999)<2.8;
    context.suppressionRequired=coordinatedMove;
    context.suppressionActive=recentCoveringFire||enemySuppression>=26;
    context.suppressionTarget={...(context.primaryThreatPosition??{})};
    context.enemySuppression=enemySuppression;

    for(const actor of actors){
      const isSuppressor=actor.fireTeamRole==="base_of_fire";
      actor.suppressionAssignment=isSuppressor?{
        teamId:context.teamId,
        enemyTeamId:context.primaryThreatTeamId,
        position:{...context.suppressionTarget},
        until:now+3.5
      }:null;
      actor.boundAuthorized=actor.fireTeamRole==="maneuver"&&(!coordinatedMove||context.suppressionActive);
      actor.holdForCoveringFire=coordinatedMove&&actor.fireTeamRole!=="base_of_fire"&&!actor.boundAuthorized;
    }
  }

  update(){
    const now=performance.now()/1000;
    for(const context of this.game.teamCombatContexts?.contexts?.values?.()??[]){
      this.updateContext(context,now);
    }
  }

  noteShot(actor,{suppressive=false}={}){
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    if(!context)return;
    const now=performance.now()/1000;
    if(suppressive||actor.fireTeamRole==="base_of_fire"){
      context.lastSuppressiveShotAt=now;
      context.suppressionActive=true;
      context.suppressiveShots=(context.suppressiveShots??0)+1;
    }
  }
}
