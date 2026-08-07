const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
function normalized(vector){const l=Math.hypot(vector?.x??0,vector?.y??0)||1;return{x:(vector?.x??0)/l,y:(vector?.y??0)/l};}

export class ContactRoutePlanService{
  apply({actor,baseDestination,routeIntent,decision}={}){
    if(!actor||!baseDestination)return{destination:baseDestination?{...baseDestination}:null,active:false,mode:"none",reason:"no route destination"};
    if(!decision||decision.routeSuspended||["continue","engage","contest","withdraw"].includes(decision.routeMode)){
      return{destination:{...baseDestination},active:false,mode:decision?.routeMode??"none",reason:decision?.routeSuspended?"route suspended by contact decision":"original route remains useful"};
    }
    const routeDirection=normalized(
      Math.hypot(decision.routeDirection?.x??0,decision.routeDirection?.y??0)>.01
        ?decision.routeDirection
        :routeIntent?.currentSegment
          ?{x:routeIntent.currentSegment.to.x-routeIntent.currentSegment.from.x,y:routeIntent.currentSegment.to.y-routeIntent.currentSegment.from.y}
          :{x:baseDestination.x-actor.x,y:baseDestination.y-actor.y}
    );
    const perpendicular={x:-routeDirection.y,y:routeDirection.x};
    const side=decision.side>=0?1:-1;
    const clearance=Math.max(220,Number(decision.clearance)||300);
    const conflict=decision.conflictPoint??decision.contactCenter??baseDestination;
    let destination={...baseDestination},reason="original route remains useful";

    if(decision.routeMode==="circumvent"){
      const lateral=clearance+46;
      destination={
        x:conflict.x+perpendicular.x*side*lateral+routeDirection.x*150,
        y:conflict.y+perpendicular.y*side*lateral+routeDirection.y*150
      };
      reason=`Stable ${side<0?"left":"right"}-side bypass around the contact region overlays the original operation corridor.`;
    }else if(decision.routeMode==="yield"){
      if(decision.yieldPoint){
        destination={...decision.yieldPoint};
      }else{
        const retreat=Math.max(120,Math.min(210,clearance*.48));
        destination={
          x:actor.x-routeDirection.x*retreat+perpendicular.x*side*Math.min(120,clearance*.28),
          y:actor.y-routeDirection.y*retreat+perpendicular.y*side*Math.min(120,clearance*.28)
        };
      }
      reason=`Temporary fixed yield pocket gives the priority team room to clear the route conflict before this operation resumes.`;
    }else if(decision.routeMode==="shadow"){
      const offset=Math.max(170,Math.min(270,clearance*.72));
      destination={x:baseDestination.x+perpendicular.x*side*offset,y:baseDestination.y+perpendicular.y*side*offset};
      reason=`Parallel route offset preserves movement while maintaining separation from the nearby team.`;
    }

    const detourDistance=distance(actor,destination);
    return{
      active:true,mode:decision.routeMode,destination,baseDestination:{...baseDestination},pairKey:decision.pairKey??null,subjectTeamId:decision.subjectTeamId??null,
      side,clearance,detourDistance,reason,desiredEffect:decision.desiredEffect??"preserve_route_with_separation",
      strategicRegressionAllowed:decision.routeMode==="yield"||decision.routeMode==="circumvent"
    };
  }
}
