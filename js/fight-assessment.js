import { isAlive, isCombatCapable, isTreating } from "./actor-state.js?v=12g-combat-posture-fight-assessment-20260801";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function conditionWeight(actor){
  const condition=actor.medical?.condition??"healthy";
  if(actor.medical?.dead||actor.medical?.unconscious||condition==="critical")return 0;
  if(condition==="serious")return .48;
  if(condition==="wounded")return .82;
  return 1;
}

function actorStrength(actor){
  if(!isAlive(actor))return 0;
  let value=conditionWeight(actor);
  if(value<=0)return 0;
  const suppression=clamp((actor.suppression??0)/100,0,1);
  value*=1-suppression*.62;
  const magazine=actor.ammoInMagazine??actor.magazineSize??20;
  if(actor.reloading)value*=.68;
  else if(magazine<=0)value*=.42;
  else if(magazine<=3)value*=.78;
  if(isTreating(actor)||actor.rescueDrag)value*=.32;
  if(actor.coverState==="hard")value*=1.12;
  else if(actor.coverState==="soft")value*=1.06;
  if(actor.fireTeamRole==="base_of_fire"&&actor.coverAtAssignedNode)value*=1.05;
  return Math.max(0,value);
}

function severeWeight(event){
  return event.severity==="catastrophic"?1.45:event.severity==="severe"?1:event.severity==="moderate"?.45:.18;
}

export class FightAssessmentSystem{
  constructor(game){this.game=game;}

  teamStrength(actors){
    return actors.reduce((sum,actor)=>sum+actorStrength(actor),0);
  }

  recentWoundPressure(actors,seconds=14){
    const ids=new Set(actors.map(actor=>actor.id));
    const now=performance.now()/1000;
    return (this.game.wounds?.recent??[])
      .filter(event=>ids.has(event.targetId)&&now-event.time<=seconds)
      .reduce((sum,event)=>sum+severeWeight(event),0);
  }

  ammoConfidence(actors){
    const capable=actors.filter(isCombatCapable);
    if(!capable.length)return 0;
    return capable.reduce((sum,actor)=>{
      const magazine=Math.max(1,actor.magazineSize??20);
      return sum+clamp((actor.ammoInMagazine??0)/magazine,0,1);
    },0)/capable.length;
  }

  coverReadiness(actors){
    const capable=actors.filter(isCombatCapable);
    if(!capable.length)return 0;
    const ready=capable.filter(actor=>["hard","soft"].includes(actor.coverState)||actor.coverAtAssignedNode).length;
    return ready/capable.length;
  }

  classify(metrics){
    const {ratio,ownStrength,ownRecent,enemyRecent,coverReadiness}=metrics;
    if(ownStrength<.72||ratio<.42||ownRecent>=2.35&&ownRecent>enemyRecent+1.1)return "collapsing";
    if(ratio<.78||ownRecent>enemyRecent+1.15||ratio<.95&&coverReadiness<.28)return "disadvantaged";
    if(ratio>1.62&&ownStrength>1.4||ratio>1.35&&enemyRecent>ownRecent+1.25)return "overmatch";
    return "contested";
  }

  recommendedPlan(state,factionId,currentPlan,ratio){
    if(state==="collapsing")return "withdraw";
    if(state==="disadvantaged")return ratio<.62?"withdraw":"hold";
    if(state!=="overmatch")return currentPlan??"hold";
    if(factionId==="northline")return "push";
    if(factionId==="commune")return (Math.floor(ratio*10)%2===0)?"flank_left":"flank_right";
    return ratio>2.1?"push":"flank_right";
  }

  assess(group,enemy,context){
    const now=performance.now()/1000;
    const ownStrength=this.teamStrength(group.actors);
    const enemyStrength=this.teamStrength(enemy.actors);
    const ratio=(ownStrength+.28)/(enemyStrength+.28);
    const ownRecent=this.recentWoundPressure(group.actors);
    const enemyRecent=this.recentWoundPressure(enemy.actors);
    const coverReadiness=this.coverReadiness(group.actors);
    const ammoConfidence=this.ammoConfidence(group.actors);
    const metrics={ownStrength,enemyStrength,ratio,ownRecent,enemyRecent,coverReadiness,ammoConfidence};
    const candidate=this.classify(metrics);

    context.fightState ??="contested";
    context.fightStateSince ??=now;
    context.fightStateLockedUntil ??=0;
    context.fightCandidate ??=candidate;
    context.fightCandidateSince ??=now;

    if(candidate!==context.fightCandidate){
      context.fightCandidate=candidate;
      context.fightCandidateSince=now;
    }

    const urgent=candidate==="collapsing";
    const current=context.fightState;
    const locked=now<(context.fightStateLockedUntil??0);
    const candidateHeld=now-(context.fightCandidateSince??now)>(candidate==="overmatch"?3.2:2.2);
    const decisive=urgent||
      candidate==="disadvantaged"&&ratio<.58||
      candidate==="overmatch"&&ratio>2.05;

    if(candidate!==current&&candidateHeld&&(!locked||decisive)){
      context.fightState=candidate;
      context.fightStateSince=now;
      context.fightStateLockedUntil=now+(urgent?9:candidate==="overmatch"?10:7);
      context.lastFrontAssignAt=-999;
    }

    const state=context.fightState;
    const recommendedPlan=this.recommendedPlan(state,group.factionId,context.currentPlan,ratio);
    const aggression=state==="overmatch"
      ?clamp(.68+(ratio-1)*.18,.68,1)
      :state==="contested"?.48
      :state==="disadvantaged"?.22:.08;

    const assessment={
      state,
      candidate,
      ownStrength,
      enemyStrength,
      ratio,
      ownRecent,
      enemyRecent,
      coverReadiness,
      ammoConfidence,
      aggression,
      recommendedPlan,
      rapidLosses:ownRecent>=1.4&&ownRecent>enemyRecent+.6,
      assessedAt:now
    };
    context.fightAssessment=assessment;
    return assessment;
  }
}
