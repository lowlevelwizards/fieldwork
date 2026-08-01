import { isAlive, isCombatCapable, canReceiveOrders } from "./actor-state.js?v=12c-intent-commitment-stable-movement-20260731";

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function groupCenter(actors){
  const active=actors.filter(isAlive);
  const count=Math.max(1,active.length);
  return {
    x:active.reduce((sum,actor)=>sum+actor.x,0)/count,
    y:active.reduce((sum,actor)=>sum+actor.y,0)/count
  };
}

export class TeamResponseSystem{
  constructor(game){
    this.game=game;
    this.events=[];
    this.assignments=new Map();
  }

  teamActors(teamId){
    return this.game.actors.filter(actor=>actor.teamId===teamId&&isAlive(actor));
  }

  emitUnderFire(victim,aggressor,position){
    if(!victim?.teamId||!aggressor?.teamId||victim.factionId===aggressor.factionId)return;
    const now=performance.now()/1000;
    const existing=this.events.find(event=>
      event.victimTeamId===victim.teamId&&
      event.aggressorTeamId===aggressor.teamId&&
      now-event.time<4
    );
    if(existing){
      existing.intensity=Math.min(10,existing.intensity+1);
      existing.position={...position};
      existing.time=now;
      return;
    }
    this.events.push({
      id:`support_${victim.teamId}_${aggressor.teamId}_${Math.floor(now*10)}`,
      victimTeamId:victim.teamId,
      aggressorTeamId:aggressor.teamId,
      factionId:victim.factionId,
      position:{...position},
      time:now,
      intensity:1
    });
  }

  chooseSupport(event){
    const now=performance.now()/1000;
    const victimActors=this.teamActors(event.victimTeamId);
    if(!victimActors.length)return;
    const victimCenter=groupCenter(victimActors);
    const candidates=new Map();

    for(const actor of this.game.actors){
      if(actor.factionId!==event.factionId||actor.teamId===event.victimTeamId||!isCombatCapable(actor))continue;
      if(!candidates.has(actor.teamId))candidates.set(actor.teamId,[]);
      candidates.get(actor.teamId).push(actor);
    }

    let best=null;
    for(const [teamId,actors] of candidates){
      const existing=this.assignments.get(teamId);
      if(existing&&existing.until>now)continue;
      const center=groupCenter(actors);
      const d=distance(center,victimCenter);
      if(d>980)continue;
      const casualties=actors.filter(actor=>!isCombatCapable(actor)).length;
      const suppression=actors.reduce((sum,actor)=>sum+(actor.suppression??0),0)/Math.max(1,actors.length);
      const score=1000-d-casualties*130-suppression*4;
      if(!best||score>best.score)best={teamId,actors,center,score,d};
    }
    if(!best)return;

    const aggressors=this.teamActors(event.aggressorTeamId);
    const enemyCenter=aggressors.length?groupCenter(aggressors):event.position;
    const dx=enemyCenter.x-victimCenter.x,dy=enemyCenter.y-victimCenter.y;
    const length=Math.max(1,Math.hypot(dx,dy));
    const lateral={x:-dy/length,y:dx/length};
    const side=(best.center.x-victimCenter.x)*lateral.x+(best.center.y-victimCenter.y)*lateral.y>=0?1:-1;
    const plan=best.d<430?"support":side>0?"flank_right":"flank_left";
    const destination=plan==="support"
      ?{x:victimCenter.x-dx/length*120,y:victimCenter.y-dy/length*120}
      :{x:victimCenter.x+lateral.x*side*300-dx/length*60,y:victimCenter.y+lateral.y*side*300-dy/length*60};

    const assignment={
      teamId:best.teamId,
      victimTeamId:event.victimTeamId,
      aggressorTeamId:event.aggressorTeamId,
      plan,destination,
      until:now+18
    };
    this.assignments.set(best.teamId,assignment);
    for(const actor of best.actors.filter(canReceiveOrders)){
      actor.supportAssignment=assignment;
      actor.tacticalPlan=plan;
      actor.tacticalPlanUntil=assignment.until;
      actor.currentTask=plan==="support"?"Moving to support nearby team":"Moving to flank attackers";
    }
  }

  update(){
    const now=performance.now()/1000;
    this.events=this.events.filter(event=>now-event.time<10);
    for(const [teamId,assignment] of this.assignments){
      if(assignment.until<=now){
        this.assignments.delete(teamId);
        for(const actor of this.teamActors(teamId))actor.supportAssignment=null;
      }
    }
    for(const event of this.events)this.chooseSupport(event);
  }
}
