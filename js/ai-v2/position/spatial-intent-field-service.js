const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const point=value=>value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))?{x:Number(value.x),y:Number(value.y)}:null;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function stableFraction(value){
  let hash=2166136261;
  for(const character of String(value??"intent")){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%10000)/10000;
}

function defaultsFor(assignment,concern){
  const responsibility=assignment?.responsibility??"general_support";
  const kind=concern?.kind??assignment?.concernKind??"mission_progress";
  if(responsibility==="objective_specialist"||responsibility==="mission_progress")return{type:"circle",innerRadius:0,outerRadius:82,preferredRadius:38,acceptanceRadius:82,preferredSeparationMin:54,preferredSeparationMax:180};
  if(responsibility==="carrier_or_aid_provider")return{type:"circle",innerRadius:0,outerRadius:58,preferredRadius:34,acceptanceRadius:58,preferredSeparationMin:42,preferredSeparationMax:150};
  if(kind==="safe_return"||responsibility==="route_security")return{type:"annulus",innerRadius:45,outerRadius:145,preferredRadius:92,acceptanceRadius:26,preferredSeparationMin:58,preferredSeparationMax:220};
  if(kind==="friendly_casualty"||responsibility==="casualty_security")return{type:"annulus",innerRadius:90,outerRadius:230,preferredRadius:150,acceptanceRadius:26,preferredSeparationMin:72,preferredSeparationMax:260};
  if(kind==="hostile_contact"||kind==="uncertain_contact"||responsibility.includes("security"))return{type:"annulus",innerRadius:145,outerRadius:390,preferredRadius:245,acceptanceRadius:30,preferredSeparationMin:78,preferredSeparationMax:300};
  return{type:"circle",innerRadius:0,outerRadius:120,preferredRadius:60,acceptanceRadius:42,preferredSeparationMin:58,preferredSeparationMax:220};
}

function radialAnchor(center,radius,angle){return{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};}

/**
 * Converts a concurrent concern staffing assignment into a durable actor-sized
 * spatial intent. The result describes an acceptable field, not one mandatory
 * coordinate. Exact points remain reserved for hard physical affordances.
 */
export class SpatialIntentFieldService{
  constructor({decisionLog=null}={}){this.decisionLog=decisionLog;}

  build({actor,assignment,concern,game=null,now=0}={}){
    if(!actor||!assignment||!concern)return null;
    const center=point(concern.point)??point(assignment.point)??this.#fallbackCenter(actor,assignment,concern,game);
    if(!center)return null;
    const defaults=defaultsFor(assignment,concern);
    const angle=stableFraction(`${assignment.id}:${actor.id}`)*Math.PI*2;
    const preferredRadius=Math.max(defaults.innerRadius,Math.min(defaults.outerRadius,defaults.preferredRadius));
    const goal=defaults.type==="annulus"||preferredRadius>0?radialAnchor(center,preferredRadius,angle):{...center};
    const focus=this.#focusFor(actor,center,concern,assignment);
    const intent={
      id:`intent_field:${assignment.id}`,
      kind:`concern_${concern.kind}`,
      concernId:concern.id,
      assignmentId:assignment.id,
      responsibility:assignment.responsibility,
      desiredEffect:concern.desiredEffect??assignment.desiredEffect??null,
      region:{type:defaults.type,center:{...center},innerRadius:defaults.innerRadius,outerRadius:defaults.outerRadius,preferredRadius,angularBias:angle,angularFreedom:Math.PI*.72},
      goal,
      focus,
      acceptanceRadius:defaults.acceptanceRadius,
      preferredSeparationMin:defaults.preferredSeparationMin,
      preferredSeparationMax:defaults.preferredSeparationMax,
      separationWeight:assignment.responsibility?.includes("security")?1.6:1.35,
      cohesion:true,
      threatPoint:concern.kind==="hostile_contact"?{...center}:actor.aiV2TacticalPicture?.threatPoint?{...actor.aiV2TacticalPicture.threatPoint}:null,
      dangerRadius:concern.kind==="hostile_contact"?Math.max(260,defaults.innerRadius+100):340,
      threatRepulsionWeight:concern.kind==="hostile_contact"?1.85:1.4,
      lookAhead:assignment.responsibility?.includes("security")?84:72,
      allowRetreat:concern.kind==="safe_return",
      label:this.#label(assignment,concern),
      reason:`${assignment.actorName??actor.name??actor.id} fulfills ${assignment.responsibility.replaceAll("_"," ")} for ${concern.label??concern.kind} within an actor-sized intent field.`,
      utilityScore:clamp((Number(concern.importance)||0)*.62+(Number(concern.urgency)||0)*.38,0,1.4),
      createdAt:assignment.assignedAt??now,
      updatedAt:now
    };
    return intent;
  }

  isSatisfied(actor,intent){
    const region=intent?.region;if(!actor||!region?.center)return false;
    const d=distance(actor,region.center);
    if(region.type==="annulus")return d>=Math.max(0,Number(region.innerRadius)||0)&&d<=Math.max(Number(region.innerRadius)||0,Number(region.outerRadius)||0);
    return d<=Math.max(1,Number(region.outerRadius??intent.acceptanceRadius)||1);
  }

  #fallbackCenter(actor,assignment,concern,game){
    const subject=(game?.actors??[]).find(candidate=>candidate.id===concern.subjectId);
    if(subject)return{x:subject.x,y:subject.y};
    const objective=game?.objectives?.find?.(candidate=>candidate.id===concern.subjectId);
    if(objective)return{x:objective.x,y:objective.y};
    const mission=game?.operations?.teams?.find?.(team=>team.id===actor.teamId)?.mission;
    return point(mission?.concernArea)??point(actor.aiV2Route?.waypoint)??{x:actor.x,y:actor.y};
  }

  #focusFor(actor,center,concern,assignment){
    if(concern.kind==="mission_progress"&&assignment.responsibility==="local_security")return{x:center.x,y:center.y};
    if(concern.kind==="safe_return")return actor.aiV2TacticalPicture?.threatPoint?{...actor.aiV2TacticalPicture.threatPoint}:{x:center.x,y:center.y};
    return{x:center.x,y:center.y};
  }

  #label(assignment,concern){
    const responsibility=String(assignment.responsibility??"support").replaceAll("_"," ");
    return`${responsibility[0]?.toUpperCase()??""}${responsibility.slice(1)} — ${concern.label??concern.kind}`;
  }
}
