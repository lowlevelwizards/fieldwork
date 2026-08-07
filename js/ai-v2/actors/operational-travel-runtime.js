import { FollowOperationRouteAction } from "../actions/follow-operation-route-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";
import { ContactRoutePlanService } from "../position/contact-route-plan-service.js";
import { OperationalRouteProgressService } from "../position/operational-route-progress-service.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function median(values){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

function destinationForActor(routeIntent,teamActors,index){
  const lookahead=routeIntent.lookaheadPoint;
  const segment=routeIntent.currentSegment??routeIntent.corridorSegment;
  if(!lookahead||!segment)return lookahead?{...lookahead}:null;
  const dx=segment.to.x-segment.from.x,dy=segment.to.y-segment.from.y,length=Math.hypot(dx,dy)||1;
  const px=-dy/length,py=dx/length;
  const lane=clamp((index-(teamActors.length-1)/2)*18,-42,42);
  return{x:lookahead.x+px*lane,y:lookahead.y+py*lane};
}

function cloneRouteIntent(intent){
  return intent?{
    ...intent,
    projectedPoint:intent.projectedPoint?{...intent.projectedPoint}:null,
    lookaheadPoint:intent.lookaheadPoint?{...intent.lookaheadPoint}:null,
    terminalPoint:intent.terminalPoint?{...intent.terminalPoint}:null,
    currentSegment:intent.currentSegment?{...intent.currentSegment,from:{...intent.currentSegment.from},to:{...intent.currentSegment.to}}:null,
    corridorSegment:intent.corridorSegment?{...intent.corridorSegment,from:{...intent.corridorSegment.from},to:{...intent.corridorSegment.to}}:null,
    consumedWaypointIds:[...(intent.consumedWaypointIds??[])]
  }:null;
}
function cloneOverlay(overlay){return overlay?{...overlay,destination:overlay.destination?{...overlay.destination}:null,baseDestination:overlay.baseDestination?{...overlay.baseDestination}:null}:null;}

export class OperationalTravelRuntime{
  constructor({scheduler,brain=null,arbiter=null,decisionLog=null,routeProgress=null,contactRoutePlans=null}={}){
    this.scheduler=scheduler;this.brain=brain??arbiter;this.decisionLog=decisionLog;this.byActor=new Map();
    this.routeProgress=routeProgress??new OperationalRouteProgressService({decisionLog});
    this.contactRoutePlans=contactRoutePlans??new ContactRoutePlanService();
  }

  update({game,teamAgenda,teamProcedures,now=0,context={}}={}){
    if(game?.scenarioMode!=="live"||!game?.livingSandbox?.geography?.enabled){this.byActor.clear();this.routeProgress.prune([]);return;}
    const live=new Set();
    const byTeam=new Map();
    for(const actor of game.actors??[]){
      if(!actor.teamId)continue;
      if(!byTeam.has(actor.teamId))byTeam.set(actor.teamId,[]);
      byTeam.get(actor.teamId).push(actor);
    }
    for(const teamActors of byTeam.values())teamActors.sort((a,b)=>String(a.id).localeCompare(String(b.id)));

    const candidates=[];
    for(const actor of game.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious||!actor.operationId)continue;
      const status=game.livingSandbox.operationRouteStatus(actor.operationId,actor.id);
      if(!status||status.complete)continue;
      const routeIntent=this.routeProgress.evaluate({game,actor,operationId:actor.operationId,mode:status.mode,now,syncLegacy:true});
      const refreshed=game.livingSandbox.operationRouteStatus(actor.operationId,actor.id);
      if(!routeIntent||routeIntent.complete||refreshed?.complete)continue;
      live.add(actor.id);
      const contactDecision=actor.aiV2ContactRouteDecision??null;
      if(contactDecision?.routeSuspended){
        this.byActor.set(actor.id,{
          actorId:actor.id,operationId:actor.operationId,mode:status.mode,strategicProgress:routeIntent.strategicProgress,rawProgress:routeIntent.rawProgress,
          segmentIndex:routeIntent.segmentIndex,segmentProgress:routeIntent.segmentProgress,lateralDeviation:routeIntent.lateralDeviation,
          lookaheadProgress:routeIntent.lookaheadProgress,lookaheadPoint:routeIntent.lookaheadPoint?{...routeIntent.lookaheadPoint}:null,
          destination:null,routeSuspended:true,contactRouteDecision:{...contactDecision},reason:`Operation route suspended by ${contactDecision.routeMode} contact decision.`,lastEvaluatedAt:now
        });
        continue;
      }
      candidates.push({actor,status:refreshed??status,routeIntent,contactDecision});
    }

    const progressByTeamMode=new Map();
    for(const item of candidates){
      const key=`${item.actor.teamId}:${item.routeIntent.mode}`;
      if(!progressByTeamMode.has(key))progressByTeamMode.set(key,[]);
      progressByTeamMode.get(key).push(item.routeIntent.strategicProgress);
    }
    const medians=new Map([...progressByTeamMode].map(([key,values])=>[key,median(values)]));

    for(const {actor,status,routeIntent,contactDecision} of candidates){
      const actors=(byTeam.get(actor.teamId)??[]).filter(candidate=>!candidate.medical?.dead&&!candidate.medical?.unconscious);
      const index=Math.max(0,actors.findIndex(candidate=>candidate.id===actor.id));
      const baseDestination=destinationForActor(routeIntent,actors,index);
      if(!baseDestination)continue;
      const overlay=this.contactRoutePlans.apply({actor,baseDestination,routeIntent,decision:contactDecision});
      const destination=overlay.destination??baseDestination;
      const operation=game.livingSandbox.getOperation(actor.operationId);
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const teamMedian=medians.get(`${actor.teamId}:${routeIntent.mode}`)??routeIntent.strategicProgress;
      const lag=Math.max(0,teamMedian-routeIntent.strategicProgress),lead=Math.max(0,routeIntent.strategicProgress-teamMedian);
      const utilityScore=3+Math.min(.06,lag*.12)-Math.min(.035,lead*.07);
      const normalReason=status.mode==="return"
        ?`${role?.roleLabel??role?.label??"Operator"} continues making useful progress through the operation's return corridor toward ${operation?.originPositionId??"base"}.`
        :`${role?.roleLabel??role?.label??"Operator"} advances through the faction-selected campaign corridor; authored route nodes are guidance rather than mandatory checkpoints.`;
      const reason=overlay.active?`${normalReason} ${overlay.reason}`:normalReason;
      const directive={
        operationId:actor.operationId,operationLabel:operation?.label??actor.currentTask,mode:status.mode,
        routeIntent:cloneRouteIntent(routeIntent),destination,acceptanceRadius:overlay.active?84:70,initialDistance:distance(actor,destination),utilityScore,reason,
        contactRouteOverlay:cloneOverlay(overlay),
        legacyIndex:status.index,legacyTotal:status.total,legacyWaypoint:status.waypoint?{...status.waypoint}:null,
        teamMedianProgress:teamMedian,progressWindow:{behind:Math.max(0,teamMedian-.08),ahead:Math.min(1,teamMedian+.10)},
        provenance:{owner:"operational_travel_runtime",source:overlay.active?"contact_route_overlay":"campaign_route_intent",teamId:actor.teamId,operationId:actor.operationId,
          missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null,
          routeMode:status.mode,routeProgress:routeIntent.strategicProgress,routeSegmentIndex:routeIntent.segmentIndex,contactPairKey:overlay.pairKey??null,contactRouteMode:overlay.mode??null}
      };
      const action=new FollowOperationRouteAction({actorId:actor.id,directive});
      const staffedConcern=context?.services?.concernStaffing?.findForActor?.(actor.id,{concernKind:status.mode==="return"?"safe_return":"mission_progress"})??null;
      const obligation=staffedConcern?context?.services?.actorObligations?.findForActor?.(actor.id,{sourceAssignmentId:staffedConcern.id})??null:null;
      this.brain?.submit?.({
        actorId:actor.id,action,score:utilityScore,urgency:overlay.active?.62:status.mode==="return"?.58:.44,
        authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,authorityLabel:overlay.active?"Contact-adjusted operation route":"Operation route intent",
        reason,source:"operational_travel_runtime",operationId:actor.operationId,missionId:agenda?.missionId??null,
        governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null,
        concernId:staffedConcern?.concernId??null,obligationId:obligation?.id??null,desiredEffect:overlay.active?overlay.desiredEffect:(staffedConcern?.desiredEffect??(status.mode==="return"?"return_toward_origin":"advance_toward_field_mission"))
      });
      this.byActor.set(actor.id,{
        actorId:actor.id,operationId:actor.operationId,roleId:role?.roleId??null,procedureId:role?.procedureId??null,mode:status.mode,
        strategicProgress:routeIntent.strategicProgress,rawProgress:routeIntent.rawProgress,segmentIndex:routeIntent.segmentIndex,segmentProgress:routeIntent.segmentProgress,
        lateralDeviation:routeIntent.lateralDeviation,lookaheadProgress:routeIntent.lookaheadProgress,lookaheadPoint:{...routeIntent.lookaheadPoint},destination:{...destination},
        routeSuspended:false,contactRouteDecision:contactDecision?{...contactDecision}:null,contactRouteOverlay:cloneOverlay(overlay),
        legacyIndex:status.index,legacyTotal:status.total,teamMedianProgress:teamMedian,reason,lastEvaluatedAt:now
      });
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
    this.routeProgress.prune(live);
  }

  get(actorId){
    const item=this.byActor.get(actorId);
    return item?{...item,destination:item.destination?{...item.destination}:null,lookaheadPoint:item.lookaheadPoint?{...item.lookaheadPoint}:null,contactRouteOverlay:cloneOverlay(item.contactRouteOverlay)}:null;
  }
  summary(){return[...this.byActor.values()].map(item=>({...item,destination:item.destination?{...item.destination}:null,lookaheadPoint:item.lookaheadPoint?{...item.lookaheadPoint}:null,contactRouteOverlay:cloneOverlay(item.contactRouteOverlay)}));}
}
