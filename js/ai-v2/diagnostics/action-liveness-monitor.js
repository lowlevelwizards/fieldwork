const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const point=value=>value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))?{x:Number(value.x),y:Number(value.y)}:null;
const locomotionAction=action=>Boolean(action?.channels?.includes?.("locomotion"));
const immediateSurvival=action=>Number(action?.metadata?.actorBrainPlan?.authorityTier??0)>=600;

const THREAT_SENSITIVE_TRAVEL=new Set([
  "FollowOperationRoute",
  "MoveToObjectivePosition",
  "RepositionForResponsibility",
  "CollectSupply",
  "AssistObjectiveWork"
]);

function actionGoal(action){
  const directive=action?.directive??action?.metadata?.directive??null;
  return point(
    directive?.destination??
    directive?.goal??
    directive?.waypoint??
    directive?.approachPoint??
    directive?.recoveryPoint??
    directive?.intent?.goal??
    directive?.intent?.destination??
    directive?.intent?.region?.center??
    null
  );
}

function acceptanceRadius(action){
  const directive=action?.directive??action?.metadata?.directive??null;
  return Math.max(10,Number(
    directive?.acceptanceRadius??
    directive?.arrivalRadius??
    directive?.policy?.arrivalRadius??
    24
  )||24);
}

function actionKind(action){
  const directive=action?.directive??action?.metadata?.directive??null;
  return directive?.kind??directive?.intent?.kind??action?.type??"unknown";
}

function cellKey(position,size=44){return`${Math.round((position?.x??0)/size)}:${Math.round((position?.y??0)/size)}`;}
function cloneSignal(signal){return signal?{...signal,goal:point(signal.goal),signals:{...(signal.signals??{})}}:null;}

export class ActionLivenessMonitor{
  constructor({decisionLog=null,stallSeconds=2.25,reversalWindow=3.4,destinationCooldown=3.2}={}){
    this.decisionLog=decisionLog;
    this.stallSeconds=Math.max(1,Number(stallSeconds)||2.25);
    this.reversalWindow=Math.max(1.5,Number(reversalWindow)||3.4);
    this.destinationCooldown=Math.max(1,Number(destinationCooldown)||3.2);
    this.byAction=new Map();
    this.byActor=new Map();
    this.invalidDestinations=new Map();
  }

  canStart(action,context={},now=context?.now??0){
    if(!locomotionAction(action)||immediateSurvival(action))return{ok:true};
    const goal=actionGoal(action);if(!goal)return{ok:true};
    this.#pruneInvalidDestinations(action.actorId,now);
    const blocked=(this.invalidDestinations.get(action.actorId)??[]).find(entry=>
      entry.expiresAt>now&&
      distance(entry.point,goal)<=entry.radius&&
      (entry.actionType===action.type||entry.kind===actionKind(action))
    );
    if(!blocked)return{ok:true};
    return{
      ok:false,
      reason:"recently_invalidated_destination",
      invalidationReason:blocked.reason,
      retryAfter:Math.max(0,blocked.expiresAt-now),
      point:{...blocked.point}
    };
  }

  start(action,{game=null,now=0}={}){
    const actor=game?.actors?.find?.(candidate=>candidate.id===action.actorId)??null;
    if(!actor)return null;
    const goal=actionGoal(action);
    const remaining=goal?distance(actor,goal):null;
    const record={
      actionId:action.id,actorId:action.actorId,actionType:action.type,kind:actionKind(action),
      startedAt:now,lastSampleAt:now,lastProgressAt:now,lastPosition:{x:actor.x,y:actor.y},
      startPosition:{x:actor.x,y:actor.y},goal:point(goal),lastGoalDistance:remaining,minGoalDistance:remaining,
      obstacleJamSeconds:0,reversalTimes:[],recentCells:[{key:cellKey(actor),at:now,x:actor.x,y:actor.y}],
      loopHits:0,lastVelocity:null,status:"healthy",reason:null,signals:{},updatedAt:now
    };
    this.byAction.set(action.id,record);
    this.#project(actor,record);
    return cloneSignal(record);
  }

  inspect(action,{game=null,services=null,now=0}={}){
    const actor=game?.actors?.find?.(candidate=>candidate.id===action.actorId)??null;
    if(!actor)return{invalid:true,reason:"actor_missing",signals:{actorMissing:true}};
    let record=this.byAction.get(action.id);
    if(!record)record=this.start(action,{game,now})??null;
    if(!record)return{invalid:false,reason:null,signals:{}};

    const dt=Math.max(0,now-record.lastSampleAt);
    const goal=actionGoal(action)??record.goal;
    const remaining=goal?distance(actor,goal):null;
    const moved=distance(actor,record.lastPosition);
    const dx=actor.x-record.lastPosition.x,dy=actor.y-record.lastPosition.y;
    const velocity=dt>.001&&moved>.35?{x:dx/dt,y:dy/dt}:null;
    const grace=Math.max(.65,Number(action?.metadata?.livenessGraceSeconds??0)||0);
    const age=Math.max(0,now-(action.startedAt??record.startedAt??now));
    const radius=acceptanceRadius(action);
    const remainingMeaningful=remaining===null||remaining>radius+16;
    const goalProgress=remaining!==null&&record.lastGoalDistance!==null?record.lastGoalDistance-remaining:0;
    const lateralProgress=moved>=9&&(remaining===null||goalProgress>=-3);
    const meaningfulProgress=goalProgress>=3.5||lateralProgress;

    if(meaningfulProgress)record.lastProgressAt=now;
    if(remaining!==null){
      record.minGoalDistance=record.minGoalDistance===null?remaining:Math.min(record.minGoalDistance,remaining);
      record.lastGoalDistance=remaining;
      record.goal={...goal};
    }

    if(record.lastVelocity&&velocity){
      const priorMagnitude=Math.hypot(record.lastVelocity.x,record.lastVelocity.y);
      const magnitude=Math.hypot(velocity.x,velocity.y);
      const cosine=priorMagnitude&&magnitude?(record.lastVelocity.x*velocity.x+record.lastVelocity.y*velocity.y)/(priorMagnitude*magnitude):1;
      if(cosine<-.58&&moved>2.5)record.reversalTimes.push(now);
    }
    record.reversalTimes=record.reversalTimes.filter(time=>now-time<=this.reversalWindow);
    if(velocity)record.lastVelocity=velocity;

    const currentCell=cellKey(actor);
    const priorVisit=record.recentCells.find(entry=>entry.key===currentCell&&now-entry.at>.85);
    if(priorVisit&&record.reversalTimes.length>=2&&distance(actor,priorVisit)<34){
      record.loopHits+=1;
      record.recentCells=record.recentCells.filter(entry=>entry.key!==currentCell);
    }
    record.recentCells.push({key:currentCell,at:now,x:actor.x,y:actor.y});
    record.recentCells=record.recentCells.filter(entry=>now-entry.at<=4.5).slice(-18);

    const obstacleSteering=Number(actor.obstacleSteerRemaining??0)>0;
    if(obstacleSteering&&moved<3.5&&remainingMeaningful)record.obstacleJamSeconds+=dt;
    else record.obstacleJamSeconds=Math.max(0,record.obstacleJamSeconds-dt*.65);

    const truthMetric=services?.behavioralTruth?.actorMetrics?.get?.(actor.id)??null;
    const truthPacing=Boolean(truthMetric&&Number(truthMetric.directionReversals??0)>=3&&record.reversalTimes.length>=2);
    const stalledFor=Math.max(0,now-record.lastProgressAt);
    const regression=remaining!==null&&record.minGoalDistance!==null?Math.max(0,remaining-record.minGoalDistance):0;
    const threatInvalidation=this.#threatInvalidation(action,actor,goal,services);
    const sourceInvalidation=this.#sourceInvalidation(action,actor,services);

    const signals={
      age,moved,remaining,goalProgress,stalledFor,regression,
      recentReversals:record.reversalTimes.length,loopHits:record.loopHits,
      obstacleJamSeconds:record.obstacleJamSeconds,truthPacing,
      destinationDanger:Boolean(threatInvalidation),sourceInvalid:Boolean(sourceInvalidation)
    };

    let reason=null;
    if(sourceInvalidation)reason=sourceInvalidation;
    else if(age>=grace&&threatInvalidation)reason=threatInvalidation;
    else if(age>=grace&&record.obstacleJamSeconds>=1.35)reason="obstacle_jam";
    else if(age>=grace&&record.loopHits>=2)reason="local_route_loop";
    else if(age>=grace&&record.reversalTimes.length>=3&&(truthPacing||stalledFor>.8||regression>24))reason="repeated_direction_reversal";
    else if(age>=grace&&regression>=96)reason="moving_away_from_goal";
    else if(age>=grace&&locomotionAction(action)&&remainingMeaningful&&stalledFor>=this.stallSeconds)reason="no_meaningful_progress";

    record.status=reason?"invalid":stalledFor>this.stallSeconds*.55||record.reversalTimes.length>=2?"warning":"healthy";
    record.reason=reason;
    record.signals=signals;
    record.lastSampleAt=now;
    record.lastPosition={x:actor.x,y:actor.y};
    record.updatedAt=now;
    this.byAction.set(action.id,record);
    this.#project(actor,record);

    if(reason){
      this.#rememberInvalidDestination(action,goal,{now,reason});
      this.#record("action_liveness_invalidated",action,now,{reason,signals,goal});
      return{invalid:true,reason,signals,goal:point(goal)};
    }
    return{invalid:false,reason:null,status:record.status,signals,goal:point(goal)};
  }

  finish(action,{game=null,now=0,outcome="ended",reason=null}={}){
    const record=this.byAction.get(action?.id);if(!record)return false;
    if(locomotionAction(action)&&["failed","continuation_failed"].includes(outcome))this.#rememberInvalidDestination(action,record.goal,{now,reason:reason??outcome,duration:2.1});
    this.byAction.delete(action.id);
    const actor=game?.actors?.find?.(candidate=>candidate.id===action.actorId)??null;
    if(actor&&this.byActor.get(actor.id)?.actionId===action.id){
      const projection={...this.byActor.get(actor.id),status:outcome,reason:reason??record.reason??outcome,updatedAt:now};
      this.byActor.set(actor.id,projection);actor.aiV2ActionLiveness=cloneSignal(projection);
    }
    return true;
  }

  get(actorId){return cloneSignal(this.byActor.get(actorId)??null);}
  summary(){return[...this.byActor.values()].map(cloneSignal);}

  #sourceInvalidation(action,actor,services){
    const plan=action?.metadata?.actorBrainPlan??{};
    if(plan.obligationId){
      const obligation=services?.actorObligations?.getById?.(plan.obligationId)??null;
      if(obligation&&["resolved","abandoned"].includes(obligation.status))return"obligation_no_longer_active";
    }
    if(plan.concernId&&actor?.teamId){
      const concern=services?.teamConcerns?.get?.(actor.teamId,plan.concernId)??null;
      if(concern&&concern.status!=="active")return"concern_no_longer_active";
    }
    return null;
  }

  #threatInvalidation(action,actor,goal,services){
    if(!goal||!THREAT_SENSITIVE_TRAVEL.has(action.type)||immediateSurvival(action))return null;
    const picture=services?.tacticalPictures?.get?.(actor.id)??actor.aiV2TacticalPicture??null;
    const threat=point(picture?.threatPoint);if(!threat)return null;
    const pressure=Number(picture?.contactPressure??actor.aiV2TacticalPicture?.contactPressure??0)||0;
    if(pressure<.42)return null;
    const actorThreatDistance=distance(actor,threat);
    const goalThreatDistance=distance(goal,threat);
    if(goalThreatDistance<260&&goalThreatDistance+90<actorThreatDistance)return"destination_became_tactically_dangerous";
    return null;
  }

  #rememberInvalidDestination(action,goal,{now=0,reason="invalid_destination",duration=this.destinationCooldown}={}){
    if(!goal||!locomotionAction(action))return;
    const entries=this.invalidDestinations.get(action.actorId)??[];
    const filtered=entries.filter(entry=>entry.expiresAt>now&&distance(entry.point,goal)>42);
    filtered.push({
      point:{...goal},radius:84,actionType:action.type,kind:actionKind(action),reason,
      invalidatedAt:now,expiresAt:now+Math.max(1,Number(duration)||this.destinationCooldown)
    });
    this.invalidDestinations.set(action.actorId,filtered.slice(-8));
  }

  #pruneInvalidDestinations(actorId,now){
    const entries=(this.invalidDestinations.get(actorId)??[]).filter(entry=>entry.expiresAt>now);
    if(entries.length)this.invalidDestinations.set(actorId,entries);else this.invalidDestinations.delete(actorId);
  }

  #project(actor,record){
    const projection={
      actorId:record.actorId,actionId:record.actionId,actionType:record.actionType,kind:record.kind,
      status:record.status,reason:record.reason,goal:point(record.goal),signals:{...(record.signals??{})},
      startedAt:record.startedAt,updatedAt:record.updatedAt
    };
    this.byActor.set(actor.id,projection);
    actor.aiV2ActionLiveness=cloneSignal(projection);
  }

  #record(type,action,time,data){
    this.decisionLog?.record?.({type,time,actorId:action?.actorId??null,actionId:action?.id??null,actionType:action?.type??null,data});
  }
}
