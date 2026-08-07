const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const WITHDRAW_RESPONSES=new Set(["withdraw","withdraw_silently","break_contact_under_fire"]);

export const CONTACT_ROUTE_DECISIONS=Object.freeze({
  CONTINUE:"continue",
  PASS:"pass",
  YIELD:"yield",
  SHADOW:"shadow",
  CONTEST:"contest",
  ENGAGE:"engage",
  WITHDRAW:"withdraw"
});

function pairKey(teamAId,teamBId){return[teamAId,teamBId].sort().join("::");}
function activeActors(game,teamId){return(game?.actors??[]).filter(actor=>actor.teamId===teamId&&!actor.medical?.dead&&!actor.medical?.unconscious);}
function center(actors){if(!actors.length)return null;return{x:actors.reduce((sum,a)=>sum+a.x,0)/actors.length,y:actors.reduce((sum,a)=>sum+a.y,0)/actors.length};}
function routeProgress(actors){
  const values=actors.map(actor=>Number(actor.aiV2RouteIntent?.strategicProgress)).filter(Number.isFinite);
  if(!values.length)return 0;
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}
function operationStatus(game,actors){
  const actor=actors.find(item=>item.operationId);
  if(!actor)return null;
  return game?.livingSandbox?.getOperation?.(actor.operationId)?.status??null;
}
function priorityFor(game,teamId,response){
  const actors=activeActors(game,teamId),ledger=response?.ledger??{};
  const returning=["returning","interrupted"].includes(operationStatus(game,actors));
  return clamp(
    Number(ledger.missionValue??.6)*.38+
    Number(ledger.timePressure??.35)*.24+
    Number(ledger.teamPreservation??.7)*.18+
    Number(ledger.mobilityOrientation??.5)*.08+
    (returning?.12:0)
  );
}
function metricsFor(game,teamIds,separation){
  const teams={};
  for(const teamId of teamIds){
    const actors=activeActors(game,teamId);
    teams[teamId]={center:center(actors),progress:routeProgress(actors)};
  }
  return{teams,separation:Number(separation)||0};
}
function metricsChanged(anchor,current){
  if(!anchor)return true;
  if(Math.abs((current.separation??0)-(anchor.separation??0))>=70)return true;
  for(const [teamId,item] of Object.entries(current.teams??{})){
    const before=anchor.teams?.[teamId];
    if(!before||!item.center||!before.center)return true;
    if(distance(item.center,before.center)>=58)return true;
    if(Math.abs((item.progress??0)-(before.progress??0))>=.03)return true;
  }
  return false;
}
function clonePoint(point){return point?{x:Number(point.x)||0,y:Number(point.y)||0}:null;}
function cloneDirective(directive){return directive?{...directive,contactCenter:clonePoint(directive.contactCenter),conflictPoint:clonePoint(directive.conflictPoint),routeDirection:clonePoint(directive.routeDirection)}:null;}
function cloneDecision(decision){
  if(!decision)return null;
  return{
    ...decision,
    teamIds:[...decision.teamIds],
    priorities:{...decision.priorities},
    geometry:{...decision.geometry,conflictPoint:clonePoint(decision.geometry?.conflictPoint)},
    directives:Object.fromEntries(Object.entries(decision.directives??{}).map(([teamId,directive])=>[teamId,cloneDirective(directive)])),
    responseIds:{...decision.responseIds}
  };
}
function inverseSpatial(spatial){
  if(!spatial)return null;
  return{
    ...spatial,
    observerTeamId:spatial.subjectTeamId,
    subjectTeamId:spatial.observerTeamId,
    ownCenter:spatial.otherCenter?{...spatial.otherCenter}:null,
    otherCenter:spatial.ownCenter?{...spatial.ownCenter}:null,
    ownRadius:spatial.otherRadius,
    otherRadius:spatial.ownRadius,
    ownRouteDirection:spatial.otherRouteDirection?{...spatial.otherRouteDirection}:{x:0,y:0},
    otherRouteDirection:spatial.ownRouteDirection?{...spatial.ownRouteDirection}:{x:0,y:0},
    routeDistanceToConflict:spatial.otherRouteDistanceToConflict,
    otherRouteDistanceToConflict:spatial.routeDistanceToConflict
  };
}

export class ContactRouteDecisionState{
  constructor({decisionLog=null,minimumHold=3.2,stalemateAfter=8}={}){
    this.decisionLog=decisionLog;
    this.minimumHold=Math.max(.5,Number(minimumHold)||3.2);
    this.stalemateAfter=Math.max(3,Number(stalemateAfter)||8);
    this.byPair=new Map();
  }

  update({game,teamResponses,teamEncounters,now=0}={}){
    const groups=new Map();
    for(const response of teamResponses?.summary?.()??[]){
      const encounter=teamEncounters?.getBestTeamHypothesis?.(response.teamId)??null;
      const subjectTeamId=encounter?.subjectTeamId??encounter?.contactResolution?.subjectTeamId??null;
      const spatial=encounter?.contactResolution??null;
      if(!subjectTeamId||!spatial?.materiallyRelevant)continue;
      const key=pairKey(response.teamId,subjectTeamId);
      if(!groups.has(key))groups.set(key,{key,teamIds:key.split("::"),sides:new Map()});
      groups.get(key).sides.set(response.teamId,{teamId:response.teamId,subjectTeamId,response,encounter,spatial});
    }

    const activePairs=new Set();
    const directiveByTeam=new Map();
    for(const group of groups.values()){
      activePairs.add(group.key);
      const prior=this.byPair.get(group.key)??null;
      const decision=this.#resolve(group,{game,now,prior});
      this.byPair.set(group.key,decision);
      for(const [teamId,directive] of Object.entries(decision.directives)){
        if(!group.sides.has(teamId)&&decision.mode!==CONTACT_ROUTE_DECISIONS.YIELD&&decision.mode!==CONTACT_ROUTE_DECISIONS.PASS)continue;
        const current=directiveByTeam.get(teamId);
        const weight=(directive.routeSuspended?2:1)+(decision.routeConflictSeverity??0);
        if(!current||weight>current.weight)directiveByTeam.set(teamId,{weight,directive:{...directive,pairKey:decision.key,pairMode:decision.mode,selectedAt:decision.selectedAt,stalemate:decision.stalemate,recoveryFrom:decision.recoveryFrom??null}});
      }
    }

    for(const [key,decision] of [...this.byPair]){
      if(activePairs.has(key))continue;
      this.byPair.delete(key);
      this.decisionLog?.record?.({type:"contact_route_decision_resolved",time:now,data:{pairKey:key,mode:decision.mode,reason:"contact_no_longer_materially_relevant"}});
    }

    for(const actor of game?.actors??[]){
      const next=directiveByTeam.get(actor.teamId)?.directive??null;
      actor.aiV2ContactRouteDecision=next?cloneDirective(next):null;
      actor.operationPausedByEncounter=Boolean(next?.routeSuspended);
    }
  }

  #resolve(group,{game,now,prior}){
    const teamIds=group.teamIds;
    const sideA=group.sides.get(teamIds[0])??null,sideB=group.sides.get(teamIds[1])??null;
    const spatialA=sideA?.spatial??(sideB?.spatial?inverseSpatial(sideB.spatial):null);
    const spatialB=sideB?.spatial??(sideA?.spatial?inverseSpatial(sideA.spatial):null);
    const spatials=[spatialA,spatialB].filter(Boolean);
    const separation=Math.min(...spatials.map(item=>Number(item.separation)||Infinity));
    const routeConflict=spatials.some(item=>item.routeConflict);
    const objectiveConflict=spatials.some(item=>item.objectiveConflict);
    const routeConflictSeverity=Math.max(0,...spatials.map(item=>Number(item.routeConflictSeverity)||0));
    const parallelMovement=spatials.some(item=>item.parallelMovement);
    const minimumSeparation=Math.max(170,...spatials.map(item=>Number(item.minimumSeparation)||0));
    const responseIds={
      [teamIds[0]]:sideA?.response?.selected?.id??null,
      [teamIds[1]]:sideB?.response?.selected?.id??null
    };
    const priorities={
      [teamIds[0]]:priorityFor(game,teamIds[0],sideA?.response),
      [teamIds[1]]:priorityFor(game,teamIds[1],sideB?.response)
    };
    const hostile=spatials.some(item=>item.relationship==="hostile")||[sideA,sideB].some(side=>side?.encounter?.physicalHostileEvidence);
    const immediateHostile=[sideA,sideB].some(side=>side?.encounter?.physicalHostileEvidence);
    const obstruction=routeConflict||objectiveConflict||separation<minimumSeparation*1.08;
    const withdrawalRequested=Object.values(responseIds).some(id=>WITHDRAW_RESPONSES.has(id));
    const engagementRequested=Object.values(responseIds).includes("engage_contact");
    const contestRequested=Object.values(responseIds).includes("contest_access");

    let mode=CONTACT_ROUTE_DECISIONS.CONTINUE;
    if(withdrawalRequested)mode=CONTACT_ROUTE_DECISIONS.WITHDRAW;
    else if(engagementRequested&&obstruction)mode=CONTACT_ROUTE_DECISIONS.ENGAGE;
    else if((contestRequested||objectiveConflict)&&obstruction)mode=CONTACT_ROUTE_DECISIONS.CONTEST;
    else if(routeConflict||separation<minimumSeparation){
      const difference=Math.abs(prioritized(priorities,teamIds[0])-prioritized(priorities,teamIds[1]));
      mode=difference>.18?CONTACT_ROUTE_DECISIONS.YIELD:CONTACT_ROUTE_DECISIONS.PASS;
    }else if(parallelMovement&&separation<560&&!hostile)mode=CONTACT_ROUTE_DECISIONS.SHADOW;

    const emergencySwitch=immediateHostile&&obstruction;
    if(prior&&!emergencySwitch&&now-prior.selectedAt<this.minimumHold&&prior.mode!==CONTACT_ROUTE_DECISIONS.CONTINUE&&obstruction){
      mode=prior.mode;
    }

    let selectedAt=prior&&prior.mode===mode?prior.selectedAt:now;
    let anchor=prior&&prior.mode===mode?prior.anchor:null;
    let lastMeaningfulChangeAt=prior&&prior.mode===mode?prior.lastMeaningfulChangeAt:now;
    const currentMetrics=metricsFor(game,teamIds,separation);
    if(!anchor||metricsChanged(anchor,currentMetrics)){
      anchor=currentMetrics;lastMeaningfulChangeAt=now;
    }
    let stalemate=now-lastMeaningfulChangeAt>=this.stalemateAfter;
    let recoveryFrom=null;
    if(stalemate){
      recoveryFrom=`${mode}_stalemate`;
      if(mode===CONTACT_ROUTE_DECISIONS.ENGAGE||mode===CONTACT_ROUTE_DECISIONS.YIELD)mode=CONTACT_ROUTE_DECISIONS.WITHDRAW;
      else if(mode===CONTACT_ROUTE_DECISIONS.CONTEST||mode===CONTACT_ROUTE_DECISIONS.PASS)mode=CONTACT_ROUTE_DECISIONS.YIELD;
      if(prior?.mode!==mode){selectedAt=now;anchor=currentMetrics;lastMeaningfulChangeAt=now;}
      this.decisionLog?.record?.({type:"contact_route_stalemate",time:now,data:{pairKey:group.key,from:prior?.mode??null,to:mode,separation:Math.round(separation)}});
    }

    const geometrySource=prior&&prior.mode===mode&&prior.geometry?prior.geometry:this.#geometry({teamIds,spatialA,spatialB,minimumSeparation});
    const directives=this.#directives({teamIds,mode,priorities,spatialA,spatialB,geometry:geometrySource,hostile});
    const decision={
      key:group.key,teamIds:[...teamIds],mode,routeConflict,objectiveConflict,routeConflictSeverity,
      separation,minimumSeparation,parallelMovement,hostile,priorities,responseIds,directives,
      geometry:geometrySource,selectedAt,updatedAt:now,lastMeaningfulChangeAt,anchor,stalemate,recoveryFrom,
      reason:this.#reason(mode,{routeConflict,objectiveConflict,hostile,stalemate})
    };
    if(!prior||prior.mode!==decision.mode)this.decisionLog?.record?.({type:"contact_route_decision_selected",time:now,data:{pairKey:group.key,mode:decision.mode,routeConflict,objectiveConflict,routeConflictSeverity:Number(routeConflictSeverity.toFixed(2)),priorities}});
    return decision;
  }

  #geometry({teamIds,spatialA,spatialB,minimumSeparation}){
    const conflictPoint=spatialA?.conflictPoint??spatialB?.conflictPoint??spatialA?.otherCenter??spatialB?.otherCenter??null;
    return{
      conflictPoint:clonePoint(conflictPoint),
      clearance:Math.max(250,minimumSeparation+90),
      sideByTeam:{[teamIds[0]]:-1,[teamIds[1]]:1}
    };
  }

  #directives({teamIds,mode,priorities,spatialA,spatialB,geometry,hostile}){
    const spatialByTeam={[teamIds[0]]:spatialA,[teamIds[1]]:spatialB};
    const higher=priorities[teamIds[0]]>=priorities[teamIds[1]]?teamIds[0]:teamIds[1];
    const lower=higher===teamIds[0]?teamIds[1]:teamIds[0];
    const result={};
    for(const teamId of teamIds){
      const spatial=spatialByTeam[teamId];
      let routeMode=mode,routeSuspended=false,desiredEffect="preserve_route_with_awareness";
      if(mode===CONTACT_ROUTE_DECISIONS.PASS){routeMode="circumvent";desiredEffect="preserve_route_with_separation";}
      else if(mode===CONTACT_ROUTE_DECISIONS.YIELD){routeMode=teamId===lower?"yield":"continue";desiredEffect=teamId===lower?"yield_route_access_temporarily":"continue_through_priority_access";}
      else if(mode===CONTACT_ROUTE_DECISIONS.SHADOW){routeMode="shadow";desiredEffect="maintain_parallel_separation";}
      else if(mode===CONTACT_ROUTE_DECISIONS.CONTEST){routeMode="contest";routeSuspended=true;desiredEffect="deny_unopposed_access";}
      else if(mode===CONTACT_ROUTE_DECISIONS.ENGAGE){routeMode="engage";routeSuspended=true;desiredEffect="resolve_hostile_route_obstruction";}
      else if(mode===CONTACT_ROUTE_DECISIONS.WITHDRAW){routeMode="withdraw";routeSuspended=true;desiredEffect="increase_separation_and_recover_route_choice";}
      result[teamId]={
        teamId,subjectTeamId:teamId===teamIds[0]?teamIds[1]:teamIds[0],routeMode,routeSuspended,desiredEffect,
        side:geometry.sideByTeam[teamId],priority:priorities[teamId],priorityTeamId:higher,
        contactCenter:clonePoint(spatial?.otherCenter),conflictPoint:clonePoint(geometry.conflictPoint),routeDirection:clonePoint(spatial?.ownRouteDirection)??{x:0,y:0},
        clearance:geometry.clearance,minimumSeparation:Number(spatial?.minimumSeparation)||geometry.clearance-90,
        hostile:Boolean(hostile),routeConflict:Boolean(spatial?.routeConflict),routeConflictSeverity:Number(spatial?.routeConflictSeverity)||0
      };
    }
    return result;
  }

  #reason(mode,{routeConflict,objectiveConflict,hostile,stalemate}){
    if(stalemate)return`The prior contact-route method stopped changing access geometry; recover movement rather than repeating the same local response.`;
    if(mode===CONTACT_ROUTE_DECISIONS.ENGAGE)return`Hostile contact materially obstructs useful movement, so the operation route is deliberately suspended while the obstruction is resolved.`;
    if(mode===CONTACT_ROUTE_DECISIONS.CONTEST)return`Both teams require incompatible local access, so normal route travel yields to an explicit access contest.`;
    if(mode===CONTACT_ROUTE_DECISIONS.PASS)return`The intended corridors conflict; both teams receive stable opposite passing sides while preserving their original strategic routes.`;
    if(mode===CONTACT_ROUTE_DECISIONS.YIELD)return`The intended corridors conflict and one operation has materially higher route priority; the lower-priority team yields temporarily.`;
    if(mode===CONTACT_ROUTE_DECISIONS.SHADOW)return`The teams are moving broadly parallel; maintain bounded offset rather than repeatedly stopping to reassess.`;
    if(mode===CONTACT_ROUTE_DECISIONS.WITHDRAW)return`Current contact cannot be resolved productively in place; create separation before reconsidering the operation route.`;
    return routeConflict||objectiveConflict||hostile?`Contact remains relevant, but it no longer requires suspension or deformation of useful route progress.`:`The contact does not obstruct the useful route ahead.`;
  }

  get(pair){return cloneDecision(this.byPair.get(pair)??null);}
  getForTeam(teamId){
    const matches=[...this.byPair.values()].filter(decision=>decision.directives?.[teamId]);
    matches.sort((a,b)=>Number(b.directives[teamId].routeSuspended)-Number(a.directives[teamId].routeSuspended)||(b.routeConflictSeverity??0)-(a.routeConflictSeverity??0));
    const decision=matches[0];
    return decision?{...cloneDirective(decision.directives[teamId]),pairKey:decision.key,pairMode:decision.mode,selectedAt:decision.selectedAt,stalemate:decision.stalemate,recoveryFrom:decision.recoveryFrom??null}:null;
  }
  summary(){return[...this.byPair.values()].map(cloneDecision);}
}

function prioritized(priorities,teamId){return Number(priorities?.[teamId])||0;}
