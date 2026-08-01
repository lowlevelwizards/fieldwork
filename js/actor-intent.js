import { moveActorToward, stopActor } from "./actor-motion.js?v=12e-fire-teams-suppression-authority-20260801";

export const INTENT_PRIORITY={
  PATROL:20,
  INVESTIGATE:38,
  REPOSITION:58,
  SUPPORT:66,
  RETURN_FIRE:72,
  TREAT:76,
  RESCUE:82,
  ESCAPE_FIRE:90,
  INCAPACITATED:100
};

const DEFAULT_COMMITMENT={
  patrol:2.4,
  investigate:3.2,
  take_contact_position:3.4,
  reposition:3.2,
  support:5.5,
  open_distance:3.8,
  cover:3.6,
  seek_cover:4.6,
  bound_to_cover:5.2,
  shift_cover_edge:2.4,
  return_to_cover:2.2,
  reload_cover:3.8,
  withdraw:7,
  medical_approach:4.5,
  hold:1.2
};

export function createIntent(owner,type,priority,options={}){
  return {
    owner,type,priority,
    key:options.key??`${owner}:${type}:${options.targetId??""}`,
    commitSeconds:options.commitSeconds??DEFAULT_COMMITMENT[type]??2.5,
    interruptMargin:options.interruptMargin??12,
    ...options
  };
}

export function chooseIntent(intents){
  return intents
    .filter(Boolean)
    .sort((a,b)=>(b.priority??0)-(a.priority??0))[0]??null;
}

function cloneIntent(intent){
  return {
    ...intent,
    destination:intent.destination?{x:intent.destination.x,y:intent.destination.y}:null
  };
}

export function executeMovementIntent(game,actor,intent,delta){
  actor.selectedIntent=intent;
  if(!intent)return false;
  if(intent.type==="hold"||!intent.destination){
    stopActor(actor,intent.pose??null);
    if(intent.task)actor.currentTask=intent.task;
    return true;
  }
  return moveActorToward(actor,intent.destination,delta,{
    game,
    speedMultiplier:intent.speedMultiplier??.75,
    arrivalRadius:intent.arrivalRadius??38,
    task:intent.task??intent.type,
    pose:intent.pose??"walk"
  });
}

export class ActorIntentSystem{
  constructor(game){
    this.game=game;
    this.proposals=new Map();
    this.frame=0;
  }

  beginFrame(){
    this.frame++;
    this.proposals.clear();
  }

  submit(actor,intent){
    if(!actor||!intent)return;
    if(!this.proposals.has(actor.id))this.proposals.set(actor.id,[]);
    this.proposals.get(actor.id).push(intent);
  }

  cancel(actor){
    if(!actor)return;
    actor.committedIntent=null;
    actor.selectedIntent=null;
    this.proposals.delete(actor.id);
  }

  select(actor){
    const now=performance.now()/1000;
    const proposed=chooseIntent(this.proposals.get(actor.id)??[]);
    const committed=actor.committedIntent;
    const committedValid=committed&&
      now<(committed.expiresAt??Infinity)&&
      now<(committed.commitUntil??0);

    if(committedValid){
      if(!proposed)return committed;
      const same=proposed.key===committed.key;
      if(same){
        // Preserve the accepted destination unless the intent explicitly
        // follows a moving target, such as a casualty.
        if(proposed.refreshDestination&&proposed.destination){
          committed.destination={x:proposed.destination.x,y:proposed.destination.y};
        }
        return committed;
      }
      const required=(committed.priority??0)+(committed.interruptMargin??12);
      if((proposed.priority??0)<required)return committed;
    }

    if(!proposed)return null;

    if(now<(actor.intentStabilizeUntil??0)&&(proposed.priority??0)<INTENT_PRIORITY.ESCAPE_FIRE){
      return createIntent('brain','hold',(proposed.priority??0)+1,{
        key:`stabilize:${actor.id}`,commitSeconds:.45,task:'Holding position',pose:'brace',syntheticHold:true
      });
    }

    if(proposed.key===actor.lastCompletedIntentKey&&now-(actor.lastCompletedIntentAt??-999)<.85&&
      (proposed.priority??0)<INTENT_PRIORITY.ESCAPE_FIRE){
      actor.intentStabilizeUntil=Math.max(actor.intentStabilizeUntil??0,now+.72);
      return createIntent('brain','hold',(proposed.priority??0)+1,{
        key:`stabilize:${proposed.key}`,commitSeconds:.55,task:'Holding position',pose:'brace',syntheticHold:true
      });
    }

    if(proposed.destination&&Math.hypot(actor.vx??0,actor.vy??0)>12&&
      now-(actor.lastIntentSwitchAt??-999)<1.15&&
      (proposed.priority??0)<INTENT_PRIORITY.ESCAPE_FIRE){
      const speed=Math.max(1,Math.hypot(actor.vx??0,actor.vy??0));
      const dx=proposed.destination.x-actor.x,dy=proposed.destination.y-actor.y;
      const length=Math.max(1,Math.hypot(dx,dy));
      const dot=(actor.vx/speed)*(dx/length)+(actor.vy/speed)*(dy/length);
      if(dot<-.62){
        actor.intentReversals=(actor.intentReversals??0)+1;
        actor.intentStabilizeUntil=Math.max(actor.intentStabilizeUntil??0,now+.75);
        return createIntent('brain','hold',(proposed.priority??0)+1,{
          key:`stabilize:reversal:${actor.id}`,commitSeconds:.65,task:'Stabilizing movement',pose:'brace',syntheticHold:true
        });
      }
    }

    const accepted=cloneIntent(proposed);
    accepted.acceptedAt=now;
    actor.lastIntentSwitchAt=now;
    accepted.commitUntil=now+(accepted.commitSeconds??2.5);
    accepted.expiresAt=now+(accepted.timeoutSeconds??Math.max(accepted.commitSeconds??2.5,8));
    actor.committedIntent=accepted;
    return accepted;
  }

  resolveActor(actor,delta){
    if(!actor||actor.rescueDrag||actor.beingDragged){
      this.cancel(actor);
      return;
    }
    if(actor.actionLock?.allowsMovement===false){
      this.cancel(actor);
      stopActor(actor);
      return;
    }
    const intent=this.select(actor);
    if(!intent){
      actor.selectedIntent=null;
      actor.movementOwner=null;
      const combatControlled=actor.operationPausedByEncounter||
        (actor.teamCombatContext&&actor.teamCombatContext.alertState!=='unaware');
      if(combatControlled)stopActor(actor);
      return;
    }
    actor.movementOwner=intent.owner;
    const arrived=executeMovementIntent(this.game,actor,intent,delta);
    if(arrived){
      if(!intent.syntheticHold){
        actor.lastCompletedIntentKey=intent.key;
        actor.lastCompletedIntentAt=performance.now()/1000;
      }
      actor.committedIntent=null;
      actor.selectedIntent=null;
      actor.movementOwner=null;
    }
  }

  resolveAll(delta){
    for(const actor of this.game.actors)this.resolveActor(actor,delta);
  }
}
