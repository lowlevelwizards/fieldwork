const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const pointDistance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function cloneMapObject(value){return value?JSON.parse(JSON.stringify(value)):value;}
function copyPoint(point){return point?{x:finite(point.x),y:finite(point.y)}:null;}
function stableUnit(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%10000)/10000;
}

function normalizedNode(spec={}){
  return{
    id:String(spec.id),label:spec.label??spec.id,kind:spec.kind??"junction",
    x:finite(spec.x),y:finite(spec.y),objectiveId:spec.objectiveId??null,siteId:spec.siteId??null,
    tags:[...(spec.tags??[])],public:Boolean(spec.public)
  };
}
function normalizedRoute(spec={},nodes){
  const from=nodes.get(spec.from),to=nodes.get(spec.to);
  const geometric=from&&to?pointDistance(from,to):1;
  return{
    id:String(spec.id),label:spec.label??spec.id,from:spec.from,to:spec.to,
    terrain:spec.terrain??"road",distance:Math.max(1,finite(spec.distance,geometric)),
    baseCost:Math.max(.1,finite(spec.baseCost,1)),state:spec.state??"open",
    surveyObjectiveId:spec.surveyObjectiveId??null,hazard:clamp(spec.hazard??.12),
    public:Boolean(spec.public),tags:[...(spec.tags??[])]
  };
}
function normalizedPosition(spec,{active=false,ownerFactionId=null}={}){
  return{
    id:String(spec.id),label:spec.label??spec.id,kind:spec.kind??"base",
    factionId:spec.factionId??ownerFactionId??null,ownerFactionId:ownerFactionId??spec.factionId??null,
    nodeId:spec.nodeId,x:finite(spec.x),y:finite(spec.y),facing:spec.facing??"down",
    active:Boolean(active||spec.active),status:active||spec.active?"operational":"vacant",
    communicationRange:Math.max(0,finite(spec.communicationRange,spec.kind==="base"?1450:920)),
    medicalCapacity:Math.max(0,finite(spec.medicalCapacity,spec.kind==="base"?4:1)),
    storageCapacity:Math.max(0,finite(spec.storageCapacity,spec.kind==="base"?18:6)),
    deploymentCapacity:Math.max(1,Math.round(finite(spec.deploymentCapacity,spec.kind==="base"?3:1))),
    storage:{medical:0,technical:0,food:0,fuel:0,...(spec.storage??{})},
    requirements:{...(spec.requirements??{})},dependencies:{objectiveIds:[...(spec.dependencies?.objectiveIds??[])],routeIds:[...(spec.dependencies?.routeIds??[])]},
    establishedAt:spec.establishedAt??null,lastUsedAt:spec.lastUsedAt??null
  };
}
function knowledgeRecord(value,{confidence=.75,source="initial",now=0}={}){
  return{value,confidence:clamp(confidence),source,lastUpdatedAt:now};
}
function normalizedKnowledge(factionId,config={}){
  return{
    factionId,
    knownNodes:new Set(config.nodeIds??[]),
    objectives:new Map((config.objectiveIds??[]).map(id=>[id,knowledgeRecord("known",{confidence:.72,source:"initial_briefing"})])),
    routes:new Map((config.routeIds??[]).map(id=>[id,knowledgeRecord("known",{confidence:.68,source:"initial_briefing"})])),
    posture:config.posture??"stabilize_network",postureSince:0,postureReason:"Initial field posture",
    lastCommunicationAt:0,lastKnowledgeRevisionAt:0,revision:0
  };
}

const TERRAIN_COST=Object.freeze({road:.88,track:1,trail:1.08,brush:1.22,marsh:1.42,crossing:1.18});
const ROUTE_STATE_COST=Object.freeze({open:1,verified:.84,degraded:1.16,unknown:1.34,blocked:9});
const POSTURE_MODIFIERS=Object.freeze({
  stabilize_network:{restore_infrastructure:.18,survey_route:.05,recover_supplies:-.03,establish_forward_position:.06},
  prioritize_recovery:{recover_supplies:.16,restore_infrastructure:-.03,survey_route:-.04,establish_forward_position:-.12},
  expand_operating_reach:{survey_route:.12,establish_forward_position:.22,restore_infrastructure:.05,recover_supplies:-.02},
  preserve_personnel:{survey_route:-.05,establish_forward_position:-.1,restore_infrastructure:-.03,recover_supplies:.03},
  exploit_opportunity:{recover_supplies:.13,survey_route:.06,restore_infrastructure:-.02,establish_forward_position:.02}
});

export class OperationalGeographyState{
  constructor({config={},factions=[],decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.enabled=Boolean(config.enabled!==false&&config.nodes?.length);
    this.seed=Math.round(finite(config.seed,2301));
    this.overdueAfter=Math.max(8,finite(config.overdueAfter,38));
    this.nodes=new Map((config.nodes??[]).map(spec=>{const node=normalizedNode(spec);return[node.id,node];}));
    this.routes=new Map((config.routes??[]).map(spec=>{const route=normalizedRoute(spec,this.nodes);return[route.id,route];}));
    this.objectiveNodeIds=new Map();
    for(const node of this.nodes.values())if(node.objectiveId)this.objectiveNodeIds.set(node.objectiveId,node.id);
    this.bases=new Map();
    this.positions=new Map();
    for(const baseSpec of config.bases??[]){
      const node=this.nodes.get(baseSpec.nodeId);const base=normalizedPosition({...baseSpec,x:baseSpec.x??node?.x,y:baseSpec.y??node?.y},{active:true,ownerFactionId:baseSpec.factionId});
      this.bases.set(base.factionId,base);this.positions.set(base.id,base);
    }
    this.forwardSiteSpecs=new Map();
    for(const siteSpec of config.forwardSites??[]){
      const node=this.nodes.get(siteSpec.nodeId);const site=normalizedPosition({...siteSpec,x:siteSpec.x??node?.x,y:siteSpec.y??node?.y},{active:false});
      this.forwardSiteSpecs.set(site.id,site);this.positions.set(site.id,site);
    }
    this.objectiveEffects=new Map(Object.entries(config.objectiveEffects??{}).map(([id,effect])=>[id,cloneMapObject(effect)]));
    this.initialKnowledge=cloneMapObject(config.initialKnowledge??{});
    this.knowledge=new Map(factions.map(faction=>[faction.id,normalizedKnowledge(faction.id,this.initialKnowledge[faction.id]??{})]));
    this.worldObjectives=new Map();
    this.objectiveBeneficiaries=new Map();
    this.history=[];
    this.revision=0;
    for(const faction of factions){
      const base=this.bases.get(faction.id);
      if(base){this.knowledge.get(faction.id)?.knownNodes.add(base.nodeId);}
    }
    for(const route of this.routes.values())if(route.public)for(const record of this.knowledge.values())record.routes.set(route.id,knowledgeRecord(route.state,{confidence:.62,source:"public_map"}));
    for(const node of this.nodes.values())if(node.public)for(const record of this.knowledge.values())record.knownNodes.add(node.id);
  }

  syncWorld({objectives=[],now=0}={}){
    if(!this.enabled)return;
    for(const objective of objectives??[]){
      if(!objective?.id)continue;
      this.worldObjectives.set(objective.id,{id:objective.id,label:objective.name??objective.label??objective.id,state:objective.state??"unknown",x:finite(objective.x),y:finite(objective.y),family:objective.sandboxNeed?.family??null,kind:objective.sandboxNeed?.kind??objective.objectiveKind??null,lastChangedAt:objective.lastChangedAt??now});
    }
    for(const [factionId,record] of this.knowledge){
      const coverage=this.coverageSources(factionId);
      for(const objective of objectives??[]){
        const nodeId=this.objectiveNodeIds.get(objective.id);const node=nodeId?this.nodes.get(nodeId):null;
        const already=record.objectives.has(objective.id);
        const covered=coverage.some(source=>pointDistance(source,node??objective)<=source.range);
        if(covered||already&&this.#connectedKnowledgeRefresh(factionId,nodeId)){
          this.observeObjective(factionId,objective,{now,source:covered?"communications_coverage":"connected_network",confidence:covered ? .9 : .74});
        }
      }
    }
  }

  observeObjective(factionId,objective,{now=0,source="field_report",confidence=.85}={}){
    const record=this.knowledge.get(factionId);if(!record||!objective?.id)return false;
    const previous=record.objectives.get(objective.id);
    const value={state:objective.state??"unknown",label:objective.name??objective.label??objective.id,x:finite(objective.x),y:finite(objective.y),lastChangedAt:objective.lastChangedAt??now};
    const changed=!previous||previous.value?.state!==value.state||previous.value?.lastChangedAt!==value.lastChangedAt;
    record.objectives.set(objective.id,knowledgeRecord(value,{confidence,source,now}));
    const nodeId=this.objectiveNodeIds.get(objective.id);if(nodeId)record.knownNodes.add(nodeId);
    if(changed){record.revision+=1;record.lastKnowledgeRevisionAt=now;this.#record("faction_objective_knowledge_updated",now,{factionId,objectiveId:objective.id,state:value.state,source,confidence});}
    return changed;
  }

  knowsObjective(factionId,objectiveId){return Boolean(this.knowledge.get(factionId)?.objectives.has(objectiveId));}
  getKnownObjective(factionId,objectiveId){const value=this.knowledge.get(factionId)?.objectives.get(objectiveId);return value?cloneMapObject(value):null;}

  getNode(nodeId){const node=this.nodes.get(nodeId);return node?{...node,tags:[...node.tags]}:null;}
  getNodeForObjective(objectiveId){return this.getNode(this.objectiveNodeIds.get(objectiveId));}
  getPosition(positionId){const position=this.positions.get(positionId);return position?cloneMapObject(position):null;}
  getBase(factionId){const base=this.bases.get(factionId);return base?cloneMapObject(base):null;}
  activePositions(factionId=null){return[...this.positions.values()].filter(position=>position.active&&(!factionId||position.ownerFactionId===factionId)).map(cloneMapObject);}

  coverageSources(factionId){
    const sources=[];
    for(const position of this.positions.values())if(position.active&&position.ownerFactionId===factionId)sources.push({id:position.id,kind:position.kind,x:position.x,y:position.y,range:position.communicationRange});
    for(const [objectiveId,beneficiaries] of this.objectiveBeneficiaries){
      if(!beneficiaries.has(factionId))continue;
      const effect=this.objectiveEffects.get(objectiveId);if(effect?.type!=="communications")continue;
      const node=this.nodes.get(this.objectiveNodeIds.get(objectiveId));if(node)sources.push({id:objectiveId,kind:"relay",x:node.x,y:node.y,range:finite(effect.range,1550)});
    }
    return sources;
  }

  isPointCovered(factionId,point){return this.coverageSources(factionId).some(source=>pointDistance(source,point)<=source.range);}

  updatePostures({factions=[],needs=[],now=0}={}){
    for(const faction of factions){
      const record=this.knowledge.get(faction.id);if(!record||now-record.postureSince<18)continue;
      const unavailable=(faction.roster??[]).filter(member=>["recovering","dead"].includes(member.status)).length;
      const knownOpen=(needs??[]).filter(need=>need.status==="open"&&record.objectives.has(need.objectiveId));
      const canExpand=this.forwardSiteCandidates(faction.id,{resources:faction.resources}).length>0;
      let posture="exploit_opportunity",reason="No immediate network emergency; exploit the strongest known opportunity.";
      if(unavailable>=4){posture="preserve_personnel";reason="Roster losses and recovery load require lower-risk operations.";}
      else if((faction.resources?.fuel??0)<=1||(faction.resources?.medical??0)<=1){posture="prioritize_recovery";reason="Low strategic stores make supply recovery the immediate campaign priority.";}
      else if(canExpand&&this.activePositions(faction.id).length<=1){posture="expand_operating_reach";reason="The faction has enough resources and a viable connected forward site.";}
      else if(knownOpen.some(need=>need.kind==="restore_infrastructure"&&need.urgency>.62)){posture="stabilize_network";reason="Known infrastructure degradation threatens the operating network.";}
      if(record.posture!==posture){record.posture=posture;record.postureSince=now;record.postureReason=reason;this.#record("faction_posture_changed",now,{factionId:faction.id,posture,reason});}
      else record.postureSince=now;
    }
  }

  postureModifier(factionId,operationKind){const posture=this.knowledge.get(factionId)?.posture??"exploit_opportunity";return finite(POSTURE_MODIFIERS[posture]?.[operationKind],0);}
  posture(factionId){const record=this.knowledge.get(factionId);return record?{id:record.posture,since:record.postureSince,reason:record.postureReason}:null;}

  canAttemptObjective(factionId,objectiveId,{resources={}}={}){
    if(!this.enabled)return true;
    if(!this.knowsObjective(factionId,objectiveId))return false;
    const site=this.forwardSiteSpecs.get(objectiveId);
    if(!site)return true;
    if(site.active)return false;
    for(const objectiveDependency of site.dependencies.objectiveIds){if(this.worldObjectives.get(objectiveDependency)?.state!=="operational")return false;}
    for(const routeId of site.dependencies.routeIds){if(!this.isRouteVerified(factionId,routeId))return false;}
    for(const [key,amount] of Object.entries(site.requirements??{}))if((resources[key]??0)<amount)return false;
    return true;
  }

  forwardSiteCandidates(factionId,{resources={}}={}){
    return[...this.forwardSiteSpecs.values()].filter(site=>this.canAttemptObjective(factionId,site.id,{resources})).map(cloneMapObject);
  }

  dependencyValue(objectiveId){
    const effect=this.objectiveEffects.get(objectiveId);if(!effect)return 0;
    const routeIds=effect.routeIds??[];
    const gatedSites=[...this.forwardSiteSpecs.values()].filter(site=>site.dependencies.routeIds.some(routeId=>routeIds.includes(routeId))).length;
    return clamp((effect.reveals?.length??0)*.035+routeIds.length*.08+(effect.supportsSiteIds?.length??0)*.08+gatedSites*.12+(effect.type==="communications"?.1:0),0,.34);
  }

  chooseLaunchPlan(factionId,targetObjectiveId){
    if(!this.enabled){const base=this.bases.get(factionId);return base?{origin:cloneMapObject(base),route:null}:null;}
    const targetNodeId=this.objectiveNodeIds.get(targetObjectiveId)??this.forwardSiteSpecs.get(targetObjectiveId)?.nodeId;
    if(!targetNodeId)return null;
    const origins=this.activePositions(factionId);
    const candidates=[];
    for(const origin of origins){
      const route=this.findRoute({factionId,fromNodeId:origin.nodeId,toNodeId:targetNodeId});
      if(route)candidates.push({origin,route,score:route.cost-(origin.kind==="base"?0:.08*route.distance)});
    }
    candidates.sort((a,b)=>a.score-b.score||a.origin.id.localeCompare(b.origin.id));
    return candidates[0]??null;
  }

  findRoute({factionId,fromNodeId,toNodeId}={}){
    if(!this.nodes.has(fromNodeId)||!this.nodes.has(toNodeId))return null;
    if(fromNodeId===toNodeId)return{nodeIds:[fromNodeId],routeIds:[],waypoints:[copyPoint(this.nodes.get(fromNodeId))],distance:0,cost:0,verifiedRatio:1,unknownRouteIds:[]};
    const knowledge=this.knowledge.get(factionId);
    const distanceByNode=new Map([[fromNodeId,0]]),previous=new Map(),queue=new Set(this.nodes.keys());
    while(queue.size){
      let current=null,best=Infinity;
      for(const nodeId of queue){const value=distanceByNode.get(nodeId)??Infinity;if(value<best){best=value;current=nodeId;}}
      if(!current||best===Infinity)break;
      queue.delete(current);if(current===toNodeId)break;
      for(const route of this.routes.values()){
        const next=route.from===current?route.to:route.to===current?route.from:null;if(!next||!queue.has(next))continue;
        const known=knowledge?.routes.get(route.id);const state=known?.value?.state??known?.value??(route.public?route.state:"unknown");
        if(state==="blocked")continue;
        const terrainCost=TERRAIN_COST[route.terrain]??1;
        const stateCost=ROUTE_STATE_COST[state]??ROUTE_STATE_COST.unknown;
        const uncertainty=known?1:1.18;
        const cost=best+route.distance*route.baseCost*terrainCost*stateCost*uncertainty;
        if(cost<(distanceByNode.get(next)??Infinity)){distanceByNode.set(next,cost);previous.set(next,{nodeId:current,routeId:route.id,state});}
      }
    }
    if(!previous.has(toNodeId))return null;
    const nodeIds=[toNodeId],routeIds=[],states=[];let cursor=toNodeId;
    while(cursor!==fromNodeId){const step=previous.get(cursor);if(!step)return null;routeIds.unshift(step.routeId);states.unshift(step.state);cursor=step.nodeId;nodeIds.unshift(cursor);}
    const waypoints=nodeIds.map(id=>{const node=this.nodes.get(id);return{id:node.id,label:node.label,kind:node.kind,x:node.x,y:node.y};});
    const routeDistance=routeIds.reduce((sum,id)=>sum+(this.routes.get(id)?.distance??0),0);
    const verified=states.filter(state=>state==="verified"||state==="open").length;
    return{nodeIds,routeIds,waypoints,distance:routeDistance,cost:distanceByNode.get(toNodeId),verifiedRatio:routeIds.length?verified/routeIds.length:1,unknownRouteIds:routeIds.filter((id,index)=>states[index]==="unknown")};
  }


  surveyPointsForRoutes(routeIds,{objectiveId=null,fromNodeId=null}={}){
    const points=[];
    for(const routeId of routeIds??[]){
      const route=this.routes.get(routeId);if(!route)continue;
      const from=this.nodes.get(route.from),to=this.nodes.get(route.to);if(!from||!to)continue;
      const fractions=[.18,.43,.68,.9];
      const canonical=fractions.map(fraction=>({
        id:`${objectiveId??route.surveyObjectiveId??route.id}_${route.id}_${Math.round(fraction*100)}`,
        routeId:route.id,label:`${route.label} · ${Math.round(fraction*100)}%`,
        x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction,status:"pending",recordedByActorId:null,recordedAt:null
      }));
      if(fromNodeId===route.to)canonical.reverse();
      points.push(...canonical);
    }
    return points.slice(0,8).map((point,index)=>({...point,index}));
  }

  chooseSurveyLaunchPlan(factionId,routeIds=[]){
    const origins=this.activePositions(factionId);const candidates=[];
    for(const surveyRouteId of routeIds){
      const surveyed=this.routes.get(surveyRouteId);if(!surveyed)continue;
      for(const endpoint of [surveyed.from,surveyed.to])for(const origin of origins){
        const route=this.findRoute({factionId,fromNodeId:origin.nodeId,toNodeId:endpoint});
        if(!route)continue;
        candidates.push({origin,route,surveyRouteId,surveyFromNodeId:endpoint,surveyToNodeId:endpoint===surveyed.from?surveyed.to:surveyed.from,score:route.cost-(origin.kind==="base"?0:.08*route.distance)});
      }
    }
    candidates.sort((a,b)=>a.score-b.score||a.origin.id.localeCompare(b.origin.id)||a.surveyRouteId.localeCompare(b.surveyRouteId));
    return candidates[0]??null;
  }

  isRouteVerified(factionId,routeId){const known=this.knowledge.get(factionId)?.routes.get(routeId);return known?.value?.state==="verified"||known?.value==="verified";}

  recordRouteKnowledge(factionId,routeId,{state="verified",confidence=.92,source="route_survey",now=0}={}){
    const record=this.knowledge.get(factionId),route=this.routes.get(routeId);if(!record||!route)return false;
    record.routes.set(routeId,knowledgeRecord({state,label:route.label},{confidence,source,now}));
    record.knownNodes.add(route.from);record.knownNodes.add(route.to);record.revision+=1;record.lastKnowledgeRevisionAt=now;
    this.#record("faction_route_knowledge_updated",now,{factionId,routeId,state,source,confidence});
    for(const nodeId of [route.from,route.to]){const objectiveId=this.nodes.get(nodeId)?.objectiveId;if(objectiveId){const world=this.worldObjectives.get(objectiveId);if(world)this.observeObjective(factionId,world,{now,source:"route_survey_adjacent",confidence:.78});}}
    return true;
  }

  applyOperationOutcome({operation,objective=null,now=0}={}){
    if(!operation)return;
    const factionId=operation.factionId;
    if(objective)this.observeObjective(factionId,objective,{now,source:"returning_team_report",confidence:1});
    const effect=this.objectiveEffects.get(operation.objectiveId);
    if(operation.kind==="survey_route"){
      const routeIds=effect?.routeIds??operation.routeSurveyIds??[];
      for(const routeId of routeIds)this.recordRouteKnowledge(factionId,routeId,{now,state:"verified",source:"completed_route_survey"});
    }
    if(effect?.type==="communications"&&objective?.state==="operational"){
      if(!this.objectiveBeneficiaries.has(operation.objectiveId))this.objectiveBeneficiaries.set(operation.objectiveId,new Set());
      this.objectiveBeneficiaries.get(operation.objectiveId).add(factionId);
      const node=this.nodes.get(this.objectiveNodeIds.get(operation.objectiveId));
      for(const objectiveRecord of this.worldObjectives.values())if(node&&pointDistance(node,objectiveRecord)<=finite(effect.range,1550))this.observeObjective(factionId,objectiveRecord,{now,source:"restored_relay_network",confidence:.9});
      this.#record("faction_communications_extended",now,{factionId,objectiveId:operation.objectiveId,range:finite(effect.range,1550)});
    }
    if(operation.kind==="establish_forward_position"&&operation.result==="completed")this.establishForwardPosition(operation.objectiveId,factionId,{now});
    for(const routeId of effect?.routeIds??[])if(operation.kind!=="survey_route")this.recordRouteKnowledge(factionId,routeId,{now,state:"open",confidence:.78,source:"objective_operation"});
  }

  establishForwardPosition(siteId,factionId,{now=0}={}){
    const position=this.positions.get(siteId);if(!position||position.active)return false;
    position.active=true;position.status="operational";position.ownerFactionId=factionId;position.factionId=factionId;position.establishedAt=now;
    position.storage={...position.storage};
    const record=this.knowledge.get(factionId);record?.knownNodes.add(position.nodeId);
    for(const route of this.routes.values())if(route.from===position.nodeId||route.to===position.nodeId)record?.routes.set(route.id,knowledgeRecord({state:route.state,label:route.label},{confidence:.86,source:"forward_position_established",now}));
    this.#record("forward_position_established",now,{factionId,positionId:siteId,nodeId:position.nodeId,kind:position.kind});
    return true;
  }

  updateOperationCommunication(operation,actors,{now=0}={}){
    if(!operation||!actors?.length)return null;
    const covered=actors.some(actor=>this.isPointCovered(operation.factionId,actor));
    const prior=operation.contactStatus??"in_contact";
    const outSince=operation.outOfContactSince??now;
    const next=covered?"in_contact":now-outSince>=this.overdueAfter?"overdue":"out_of_contact";
    if(next!==prior){
      operation.contactStatus=next;
      if(next==="out_of_contact"&&!operation.outOfContactSince)operation.outOfContactSince=now;
      if(next==="overdue"){operation.overdueAt=operation.overdueAt??now;}
      if(next==="in_contact"){operation.lastCommunicationAt=now;operation.outOfContactSince=null;operation.overdueAt=null;}
      const event=next==="out_of_contact"?"operation_went_out_of_contact":next==="overdue"?"operation_became_overdue":"operation_contact_restored";
      this.#record(event,now,{operationId:operation.id,factionId:operation.factionId,objectiveId:operation.objectiveId,outOfContactDuration:next==="in_contact"?0:Math.max(0,now-(operation.outOfContactSince??now))});
    }else if(covered)operation.lastCommunicationAt=now;
    return next;
  }

  recordPositionReturn(positionId,{factionId,resourceType=null,amount=0,now=0}={}){
    const position=this.positions.get(positionId);if(!position||!position.active||position.ownerFactionId!==factionId)return false;
    position.lastUsedAt=now;
    if(resourceType&&amount>0){
      const current=Object.values(position.storage??{}).reduce((sum,value)=>sum+Math.max(0,finite(value)),0);
      const accepted=Math.max(0,Math.min(amount,position.storageCapacity-current));
      position.storage[resourceType]=(position.storage[resourceType]??0)+accepted;
      this.#record("resources_delivered_to_position",now,{factionId,positionId,resourceType,amount:accepted,overflow:Math.max(0,amount-accepted)});
    }else this.#record("operation_returned_to_position",now,{factionId,positionId});
    return true;
  }

  summary(){
    return{
      enabled:this.enabled,revision:this.revision,
      nodes:[...this.nodes.values()].map(node=>({...node,tags:[...node.tags]})),
      routes:[...this.routes.values()].map(route=>({...route,tags:[...route.tags]})),
      positions:[...this.positions.values()].map(cloneMapObject),
      knowledge:[...this.knowledge.values()].map(record=>({
        factionId:record.factionId,posture:record.posture,postureSince:record.postureSince,postureReason:record.postureReason,revision:record.revision,
        knownNodeIds:[...record.knownNodes],knownObjectives:[...record.objectives].map(([objectiveId,value])=>({objectiveId,...cloneMapObject(value)})),knownRoutes:[...record.routes].map(([routeId,value])=>({routeId,...cloneMapObject(value)}))
      })),
      history:this.history.map(entry=>cloneMapObject(entry))
    };
  }

  exportState(){
    return{
      version:1,revision:this.revision,
      routes:[...this.routes.values()].map(route=>({...route})),
      positions:[...this.positions.values()].map(cloneMapObject),
      objectiveBeneficiaries:[...this.objectiveBeneficiaries].map(([id,set])=>[id,[...set]]),
      knowledge:this.summary().knowledge,
      history:this.history.map(cloneMapObject)
    };
  }

  importState(snapshot={}){
    if(!snapshot||snapshot.version!==1)return false;
    for(const route of snapshot.routes??[])if(this.routes.has(route.id))Object.assign(this.routes.get(route.id),cloneMapObject(route));
    for(const position of snapshot.positions??[])if(this.positions.has(position.id))Object.assign(this.positions.get(position.id),cloneMapObject(position));
    this.objectiveBeneficiaries=new Map((snapshot.objectiveBeneficiaries??[]).map(([id,values])=>[id,new Set(values)]));
    for(const saved of snapshot.knowledge??[]){
      const record=this.knowledge.get(saved.factionId);if(!record)continue;
      record.posture=saved.posture??record.posture;record.postureSince=finite(saved.postureSince);record.postureReason=saved.postureReason??record.postureReason;record.revision=finite(saved.revision);
      record.knownNodes=new Set(saved.knownNodeIds??[]);
      record.objectives=new Map((saved.knownObjectives??[]).map(item=>[item.objectiveId,{value:cloneMapObject(item.value),confidence:item.confidence,source:item.source,lastUpdatedAt:item.lastUpdatedAt}]));
      record.routes=new Map((saved.knownRoutes??[]).map(item=>[item.routeId,{value:cloneMapObject(item.value),confidence:item.confidence,source:item.source,lastUpdatedAt:item.lastUpdatedAt}]));
    }
    this.history=(snapshot.history??[]).map(cloneMapObject);this.revision=finite(snapshot.revision);return true;
  }

  #connectedKnowledgeRefresh(factionId,nodeId){
    if(!nodeId)return false;const record=this.knowledge.get(factionId);if(!record?.knownNodes.has(nodeId))return false;
    return[...this.routes.values()].some(route=>(route.from===nodeId||route.to===nodeId)&&record.routes.has(route.id));
  }

  #record(type,time,data={}){
    const entry={type,time,data:{...data}};this.history.push(entry);if(this.history.length>280)this.history.splice(0,this.history.length-280);
    this.revision+=1;this.decisionLog?.record?.({type,time,data:{...data}});
  }
}
