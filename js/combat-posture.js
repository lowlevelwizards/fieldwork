import { createIntent, INTENT_PRIORITY } from "./actor-intent.js?v=12h-reactive-fire-momentum-medical-recovery-20260801";
import { isAlive, isCombatCapable, canBeTargeted, isTreating } from "./actor-state.js?v=12h-reactive-fire-momentum-medical-recovery-20260801";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const shortestAngle=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

export const COMBAT_POSTURE={
  NONE:"none",
  ENGAGE:"engage",
  SEEK_FIRE_POSITION:"seek_fire_position",
  SEEK_COVER:"seek_cover",
  BOUND:"bound",
  HOLD_PROTECTED:"hold_protected",
  REGROUP:"regroup",
  WITHDRAW:"withdraw",
  RESCUE:"rescue",
  TREAT:"treat",
  INCAPACITATED:"incapacitated"
};

const POSTURE_PRIORITY={
  none:0,
  engage:45,
  seek_fire_position:55,
  bound:58,
  hold_protected:60,
  regroup:72,
  seek_cover:82,
  withdraw:90,
  rescue:95,
  treat:96,
  incapacitated:100
};

export class CombatPostureSystem{
  constructor(game){this.game=game;}

  knownTarget(actor){
    const current=[this.game.operator,...this.game.actors]
      .find(candidate=>candidate.id===actor.combatTargetId&&canBeTargeted(candidate));
    if(current)return current;
    const enemies=this.game.teamCombatContexts?.primaryThreatActors?.(actor)??[];
    return enemies
      .filter(canBeTargeted)
      .sort((a,b)=>distance(actor,a)-distance(actor,b))[0]??null;
  }

  threatPosition(actor,target=null){
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    return target??context?.primaryThreatPosition??actor.lastKnownEnemyPosition??actor.tacticalEnemyCenter??null;
  }

  isProtected(actor){
    const node=actor.assignedCoverNode??actor.tacticalCoverNode;
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    const threat=context?.primaryThreatPosition??actor.tacticalEnemyCenter;
    const assignedProtection=Boolean(node&&threat&&actor.coverAtAssignedNode&&
      this.game.coverNetwork?.assignmentValid?.(actor,node,threat)&&
      this.game.coverNetwork?.blocksThreat?.(node,threat,actor));
    return assignedProtection||(["hard","soft"].includes(actor.coverState)&&(
      actor.coverAtAssignedNode||!node||distance(actor,node.protectedPosition)<82
    ));
  }

  clearShot(actor,target){
    if(!target)return false;
    const node=actor.assignedCoverNode??actor.tacticalCoverNode;
    const atEdge=Boolean(node)&&(node.firePositions??[]).some(item=>distance(actor,item.position)<35);
    const result=this.game.coverNetwork?.shotViability?.(actor,target,{
      ignoreObstacle:atEdge?node.obstacle:null
    });
    return !result||result.status==="clear";
  }

  choose(actor,target,context){
    if(!isAlive(actor)||!isCombatCapable(actor))return COMBAT_POSTURE.INCAPACITATED;
    if(actor.rescueDrag)return COMBAT_POSTURE.RESCUE;
    if(actor.medicalAction||isTreating(actor))return COMBAT_POSTURE.TREAT;
    if(!context||!["contact","engaged"].includes(context.alertState))return COMBAT_POSTURE.NONE;

    const assessment=context.fightAssessment?.state??"contested";
    const protectedNow=this.isProtected(actor);
    const exposed=!protectedNow;
    const condition=actor.medical?.condition??"healthy";
    const wounded=["wounded","serious"].includes(condition);
    const serious=condition==="serious";
    const clear=this.clearShot(actor,target);
    const now=performance.now()/1000;
    const recentFire=now-(actor.lastIncomingFireAt??-999)<6;
    const role=actor.fireTeamRole??actor.tacticalRole??"security";
    const targetDistance=target?distance(actor,target):Infinity;
    const targetExposed=Boolean(target)&&!["hard","soft"].includes(target.coverState);
    const targetMoving=Boolean(target)&&Math.hypot(target.vx??0,target.vy??0)>28;
    const reactiveThreat=Boolean(target&&clear&&(
      targetDistance<470||recentFire||targetExposed||targetMoving||context.alertState==="contact"
    ));

    if(reactiveThreat&&(actor.suppression??0)<72&&!actor.reloading){
      actor.reactiveFireUntil=Math.max(actor.reactiveFireUntil??0,now+(exposed?1.25:2.2));
      return COMBAT_POSTURE.ENGAGE;
    }
    if(now<(actor.mustSeekCoverAfterShotUntil??0)&&exposed)return COMBAT_POSTURE.SEEK_COVER;

    if(assessment==="collapsing"){
      if(role==="base_of_fire"&&protectedNow&&(actor.ammoInMagazine??0)>0&&(actor.suppression??0)<72){
        return target&&clear?COMBAT_POSTURE.ENGAGE:COMBAT_POSTURE.HOLD_PROTECTED;
      }
      return COMBAT_POSTURE.WITHDRAW;
    }

    if(assessment==="disadvantaged"){
      if((serious||actor.reloading)&&exposed)return COMBAT_POSTURE.REGROUP;
      if(exposed&&recentFire)return COMBAT_POSTURE.SEEK_COVER;
      if(role==="base_of_fire")return target&&clear?COMBAT_POSTURE.ENGAGE:COMBAT_POSTURE.HOLD_PROTECTED;
      if(wounded)return COMBAT_POSTURE.HOLD_PROTECTED;
      return target&&clear?COMBAT_POSTURE.ENGAGE:COMBAT_POSTURE.HOLD_PROTECTED;
    }

    if(exposed&&(recentFire||actor.reloading||wounded))return COMBAT_POSTURE.SEEK_COVER;
    if(actor.reloading&&!protectedNow)return COMBAT_POSTURE.SEEK_COVER;
    if(performance.now()/1000<(actor.forceFirePositionUntil??0))return COMBAT_POSTURE.SEEK_FIRE_POSITION;
    if(target&&clear)return COMBAT_POSTURE.ENGAGE;

    if(context.fightAssessment?.state==="overmatch"){
      if(role==="maneuver"&&actor.boundAuthorized)return COMBAT_POSTURE.BOUND;
      if(role==="base_of_fire")return COMBAT_POSTURE.SEEK_FIRE_POSITION;
      if(role==="security"&&!protectedNow)return COMBAT_POSTURE.SEEK_FIRE_POSITION;
    }

    const node=actor.assignedCoverNode??actor.tacticalCoverNode;
    if(node){
      const point=target??context.primaryThreatPosition;
      if((target||role==="base_of_fire")&&point&&this.game.coverNetwork?.nearestFirePosition?.(actor,node,point))return COMBAT_POSTURE.SEEK_FIRE_POSITION;
      return COMBAT_POSTURE.HOLD_PROTECTED;
    }
    return COMBAT_POSTURE.SEEK_FIRE_POSITION;
  }

  setPosture(actor,next,reason){
    const now=performance.now()/1000;
    const current=actor.combatPosture??COMBAT_POSTURE.NONE;
    const currentPriority=POSTURE_PRIORITY[current]??0;
    const nextPriority=POSTURE_PRIORITY[next]??0;
    const locked=now<(actor.combatPostureLockedUntil??0);
    const reactiveOverride=next===COMBAT_POSTURE.ENGAGE&&now<(actor.reactiveFireUntil??0);
    const emergency=nextPriority>=POSTURE_PRIORITY.SEEK_COVER||next===COMBAT_POSTURE.TREAT||next===COMBAT_POSTURE.RESCUE||reactiveOverride;
    if(next!==current&&locked&&!emergency&&nextPriority<currentPriority+12)return current;
    if(next!==current){
      actor.combatPosture=next;
      actor.combatPostureSince=now;
      actor.combatPostureReason=reason;
      actor.combatPostureLockedUntil=now+(emergency?1.5:next===COMBAT_POSTURE.ENGAGE?1.4:2.4);
      actor.lastTacticalProgressAt=now;
    }
    return actor.combatPosture;
  }

  orient(actor,target,context,delta){
    if(actor.medicalAction||actor.rescueDrag||!isAlive(actor))return;
    const threat=this.threatPosition(actor,target);
    if(!threat)return;
    const desired=angleTo(actor,threat);
    actor.combatAimAngle=(actor.combatAimAngle??desired)+shortestAngle(actor.combatAimAngle??desired,desired)*(1-Math.exp(-delta*5.5));
    actor.lookAngle=actor.combatAimAngle;
    const x=Math.cos(actor.combatAimAngle),y=Math.sin(actor.combatAimAngle);
    actor.facing=Math.abs(x)>Math.abs(y)?(x>=0?"right":"left"):(y>=0?"down":"up");
  }

  rearCover(actor,threat,context,{casualty=false}={}){
    const network=this.game.coverNetwork;
    if(!network||!threat)return null;
    if(casualty)return network.bestCasualtyCover?.(actor,actor,threat,{context})??null;
    return network.bestRearCover?.(actor,threat,{
      anchor:actor.tacticalRallyPoint??context?.rallyPosition,
      context,
      reserveSeconds:28
    })??null;
  }

  ensureFirePosition(actor,target,context){
    const network=this.game.coverNetwork;
    if(!network)return null;
    let node=actor.assignedCoverNode??actor.tacticalCoverNode;
    const point=target??context?.primaryThreatPosition;
    if(node&&point&&network.assignmentValid(actor,node,point)){
      let edge=actor.coverCycleEdge;
      const edgeValid=edge&&nowSafe(actor.coverCycleEdgeLeaseUntil)&&
        !network.shotBlocked(edge,point,{ignoreObstacle:node.obstacle});
      if(!edgeValid){
        edge=network.nearestFirePosition(actor,node,point);
        actor.coverCycleEdge=edge?{x:edge.x,y:edge.y}:null;
        actor.coverCycleEdgeLeaseUntil=performance.now()/1000+5.5;
      }
      if(edge)return {node,edge};
    }

    if(node&&!network.hasUsableFireLane(node,point)){
      network.releaseActor(actor);
      actor.coverReassignmentReason="no usable firing lane";
      node=null;
    }
    if(!node&&point){
      node=network.bestCover(actor,point,{
        anchor:actor.tacticalSlot??actor,
        maxDistance:700,
        secondaryThreats:context?.secondaryThreats??[],
        reserveSeconds:26,
        role:actor.fireTeamRole??actor.tacticalRole,
        element:actor.fireTeamElement,
        minimumSpacing:78,
        requireFireLane:true
      });
      if(node){
        const edge=network.nearestFirePosition(actor,node,point);
        if(edge){
          actor.coverCycleEdge={x:edge.x,y:edge.y};
          actor.coverCycleEdgeLeaseUntil=performance.now()/1000+5.5;
          return {node,edge};
        }
      }
    }
    return null;
  }

  submit(actor,posture,target,context){
    const now=performance.now()/1000;
    const threat=this.threatPosition(actor,target);
    const network=this.game.coverNetwork;
    if(posture===COMBAT_POSTURE.SEEK_COVER){
      let node=actor.assignedCoverNode;
      const failedIndex=node&&!this.isProtected(actor)&&actor.coverAtAssignedNode?node.index:null;
      if(failedIndex!==null){
        network?.releaseActor?.(actor);
        actor.avoidCoverIndex=failedIndex;
        actor.avoidCoverUntil=now+6;
        node=null;
      }
      if(!node||!network?.assignmentValid?.(actor,node,threat)){
        node=network?.bestCover?.(actor,threat,{
          anchor:actor.tacticalSlot??actor,maxDistance:720,
          secondaryThreats:context?.secondaryThreats??[],reserveSeconds:24,
          role:actor.fireTeamRole??actor.tacticalRole,element:actor.fireTeamElement,
          excludeObstacleIndexes:now<(actor.avoidCoverUntil??0)&&Number.isFinite(actor.avoidCoverIndex)?[actor.avoidCoverIndex]:[],
          minimumSpacing:78
        });
      }
      const urgent=now-(actor.lastIncomingFireAt??-999)<6;
      if(node){
        actor.assignedCoverNode=node;
        const waypoint=network.routeWaypoint?.(actor,node,threat,{secondaryThreats:context?.secondaryThreats??[]})??node.protectedPosition;
        this.game.actorIntents?.submit?.(actor,createIntent("posture","seek_cover",INTENT_PRIORITY.ESCAPE_FIRE-1,{
          key:`posture:seek_cover:${node.slotId}`,
          destination:waypoint,speedMultiplier:urgent?1.28:1.02,arrivalRadius:48,
          commitSeconds:5.4,interruptMargin:8,
          task:urgent?"Sprinting out of exposed fire":"Moving to protected cover"
        }));
      }else if(threat){
        const angle=angleTo(threat,actor);
        const raw={x:actor.x+Math.cos(angle)*240,y:actor.y+Math.sin(angle)*240};
        const fallback=this.game.tacticalFronts?.protectDestination?.(actor,raw)??raw;
        this.game.actorIntents?.submit?.(actor,createIntent("posture","seek_cover",INTENT_PRIORITY.ESCAPE_FIRE-1,{
          key:`posture:escape_open:${Math.round(fallback.x/60)}:${Math.round(fallback.y/60)}`,
          destination:fallback,speedMultiplier:1.3,arrivalRadius:44,
          commitSeconds:5.2,interruptMargin:8,
          task:"Escaping exposed ground toward the rear"
        }));
      }
      return;
    }

    if(posture===COMBAT_POSTURE.WITHDRAW||posture===COMBAT_POSTURE.REGROUP){
      const node=this.rearCover(actor,threat,context);
      let destination=node?.protectedPosition??null;
      const rally=actor.tacticalRallyPoint??context?.rallyPosition;
      if(!destination&&rally&&distance(actor,rally)>95)destination=rally;
      if(!destination&&threat){
        const angle=angleTo(threat,actor);
        const raw={x:actor.x+Math.cos(angle)*300,y:actor.y+Math.sin(angle)*300};
        destination=this.game.tacticalFronts?.protectDestination?.(actor,raw)??raw;
      }
      if(destination){
        if(node)actor.assignedCoverNode=node;
        this.game.actorIntents?.submit?.(actor,createIntent("posture",posture===COMBAT_POSTURE.WITHDRAW?"withdraw":"regroup",
          posture===COMBAT_POSTURE.WITHDRAW?INTENT_PRIORITY.ESCAPE_FIRE:INTENT_PRIORITY.RESCUE-4,{
            key:`posture:${posture}:${node?.slotId??actor.tacticalFrontId??actor.id}`,
            destination,speedMultiplier:posture===COMBAT_POSTURE.WITHDRAW?1.22:1.02,
            arrivalRadius:50,commitSeconds:posture===COMBAT_POSTURE.WITHDRAW?7.5:6,
            task:posture===COMBAT_POSTURE.WITHDRAW?"Breaking contact toward rear cover":"Regrouping in a protected position"
          }));
      }
      return;
    }

    if(posture===COMBAT_POSTURE.HOLD_PROTECTED){
      this.game.actorIntents?.submit?.(actor,createIntent("posture","hold",INTENT_PRIORITY.RETURN_FIRE+2,{
        key:`posture:hold:${actor.assignedCoverNode?.slotId??actor.id}`,
        commitSeconds:2.2,task:"Holding protected and reassessing",pose:"brace"
      }));
      return;
    }

    if(posture===COMBAT_POSTURE.SEEK_FIRE_POSITION){
      const firing=this.ensureFirePosition(actor,target,context);
      if(firing){
        const atEdge=distance(actor,firing.edge)<23;
        if(!atEdge){
          actor.coverCyclePhase="move_to_edge";
          this.game.actorIntents?.submit?.(actor,createIntent("posture","shift_cover_edge",INTENT_PRIORITY.RETURN_FIRE+1,{
            key:`posture:fire_edge:${firing.node.slotId}:${Math.round(firing.edge.x)}:${Math.round(firing.edge.y)}`,
            destination:firing.edge,speedMultiplier:.5,arrivalRadius:20,
            commitSeconds:3.2,task:"Moving to a clear firing edge"
          }));
        }else{
          actor.coverCyclePhase="fire_window";
          actor.coverFireWindowUntil=Math.max(actor.coverFireWindowUntil??0,now+3.8);
          this.game.actorIntents?.submit?.(actor,createIntent("posture","hold",INTENT_PRIORITY.RETURN_FIRE,{
            key:`posture:settle_edge:${firing.node.slotId}`,
            commitSeconds:.65,task:"Settling at firing edge",pose:"brace"
          }));
        }
      }
      return;
    }

    if(posture===COMBAT_POSTURE.BOUND){
      const node=actor.tacticalCoverNode??actor.assignedCoverNode;
      const destination=node?.protectedPosition??actor.tacticalSlot;
      if(destination){
        this.game.actorIntents?.submit?.(actor,createIntent("posture","bound_to_cover",INTENT_PRIORITY.SUPPORT+1,{
          key:`posture:bound:${node?.slotId??actor.tacticalFrontId}`,
          destination,speedMultiplier:1.08,arrivalRadius:50,commitSeconds:5.8,
          task:"Bounding to the next covered firing position"
        }));
      }
    }
  }

  updateLiveness(actor,posture,context){
    const now=performance.now()/1000;
    const previous=actor.tacticalWatchPosition??{x:actor.x,y:actor.y};
    const moved=distance(actor,previous)>18;
    const ammo=actor.ammoInMagazine??0;
    const fired=ammo<(actor.tacticalWatchAmmo??ammo);
    const active=actor.medicalAction||actor.rescueDrag||actor.reloading;
    const aimingWindow=now-(actor.lastClearShotAt??-999)<1.1&&
      [COMBAT_POSTURE.ENGAGE,COMBAT_POSTURE.SEEK_FIRE_POSITION].includes(posture);
    const postureChanged=posture!==actor.tacticalWatchPosture;
    if(moved||fired||active||postureChanged||aimingWindow){
      actor.lastTacticalProgressAt=now;
      actor.combatStalled=false;
      actor.tacticalWatchPosition={x:actor.x,y:actor.y};
      actor.tacticalWatchAmmo=ammo;
      actor.tacticalWatchPosture=posture;
      return;
    }
    actor.lastTacticalProgressAt ??=now;
    const legitimate=[COMBAT_POSTURE.TREAT,COMBAT_POSTURE.RESCUE,COMBAT_POSTURE.INCAPACITATED].includes(posture);
    if(context?.alertState==="engaged"&&!legitimate&&now-actor.lastTacticalProgressAt>3.2){
      actor.combatStalled=true;
      actor.combatStallCount=(actor.combatStallCount??0)+1;
      actor.combatPostureLockedUntil=0;
      actor.combatStallReason=actor.lastFireBlockReason??"no tactical progress";
      // Preserve a valid target and edge. The old watchdog discarded the
      // exact context needed to complete a nearly-valid firing sequence.
      const threat=context.primaryThreatPosition;
      const node=actor.assignedCoverNode;
      if(posture===COMBAT_POSTURE.ENGAGE){
        actor.forceFirePositionUntil=now+2.2;
        actor.reactiveFireUntil=Math.max(actor.reactiveFireUntil??0,now+1.4);
      }
      if(posture===COMBAT_POSTURE.SEEK_COVER&&!this.isProtected(actor)&&node){
        actor.avoidCoverIndex=node.index;
        actor.avoidCoverUntil=now+6;
        this.game.coverNetwork?.releaseActor?.(actor);
      }else if(node&&threat&&!this.game.coverNetwork?.hasUsableFireLane?.(node,threat)&&posture!==COMBAT_POSTURE.HOLD_PROTECTED){
        this.game.coverNetwork?.releaseActor?.(actor);
      }
      actor.lastTacticalProgressAt=now;
    }
  }

  updateActor(actor,delta){
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    const target=this.knownTarget(actor);
    this.orient(actor,target,context,delta);
    const selected=this.choose(actor,target,context);
    const reason=context?.fightAssessment?.state??context?.alertState??"no contact";
    const posture=this.setPosture(actor,selected,reason);
    actor.fightAssessmentState=context?.fightAssessment?.state??null;
    this.submit(actor,posture,target,context);
    this.updateLiveness(actor,posture,context);
  }

  update(delta){
    for(const actor of this.game.actors){
      if(!actor.operationId||!actor.factionId)continue;
      this.updateActor(actor,delta);
    }
  }
}

function nowSafe(until){return performance.now()/1000<(until??0);}
