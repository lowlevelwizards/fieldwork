import { OBJECTIVE_INITIATIVE_FIXTURE_ID } from "./behavior-lab-2.0r.js";

export function applyBehaviorLab2UOverlay(fixture){
  if(!fixture||fixture.id!==OBJECTIVE_INITIATIVE_FIXTURE_ID)return fixture;
  return Object.freeze({
    ...fixture,
    question:"Can one faction's operation interrupt another through a natural warning, withdrawal, and strategic retry without violence?",
    purpose:"Turn concurrent contact into mission conflict: ambient activity reporting, a temporary worksite boundary, directed warning, silent withdrawal, deferred operation state, and later retry after the blocking operation clears.",
    objectives:(fixture.objectives??[]).map(objective=>{
      if(objective.id==="central_field_relay")return{
        ...objective,
        sandboxNeed:{
          ...objective.sandboxNeed,
          worksiteBoundary:{
            id:"central_relay_active_worksite",
            label:"Central relay active worksite",
            radius:570,
            falloff:180,
            policy:"Unknown armed personnel approaching active technical work should be warned clear before escalation.",
            condition:"A credible approaching contact has entered the active relay worksite.",
            warningType:"keep_clear",
            warningMessage:"Keep clear of the active relay worksite.",
            minimumConfidence:22,
            requireActivityUpdate:true,
            allowedActivities:["approaching","repositioning","observing"],
            voiceRange:980,
            coneDegrees:105,
            warningDuration:1.1,
            awaitDuration:10
          }
        }
      };
      if(objective.id==="east_field_relay")return{
        ...objective,
        requirements:{...(objective.requirements??{}),workDuration:8.5}
      };
      return objective;
    }),
    livingSandbox:{
      ...fixture.livingSandbox,
      postCompletionHold:9,
      interruptedReturnHold:1.1,
      blockedRetryDelay:32
    }
  });
}
