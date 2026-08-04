import { OBJECTIVE_INITIATIVE_FIXTURE_ID } from "./behavior-lab-2.0r.js";

export function applyBehaviorLab2VOverlay(fixture){
  if(!fixture||fixture.id!==OBJECTIVE_INITIATIVE_FIXTURE_ID)return fixture;
  return Object.freeze({
    ...fixture,
    question:"Can a warned operation refuse to yield, trigger one bounded warning shot, break contact under protective fire, and return the sandbox to useful work?",
    purpose:"Extend mission conflict into controlled escalation: mission-relative refusal, ignored-warning evidence, one offset warning round, physical hostile evidence, protective breakaway, defensive hold, armed deferral, and later retry without wounds or open-ended combat.",
    objectives:(fixture.objectives??[]).map(objective=>objective.id!=="central_field_relay"?objective:{
      ...objective,
      sandboxNeed:{
        ...objective.sandboxNeed,
        worksiteBoundary:{
          ...objective.sandboxNeed?.worksiteBoundary,
          complianceDuration:2.1,
          enforcement:{
            enabled:true,
            responseId:"demonstrative_fire",
            offsetDistance:92,
            maximumRounds:1
          }
        }
      }
    }),
    livingSandbox:{
      ...fixture.livingSandbox,
      postCompletionHold:8,
      blockedRetryDelay:30,
      factions:(fixture.livingSandbox?.factions??[]).map(faction=>({
        ...faction,
        contactResolve:faction.id==="commune"?.96:faction.id==="northline"?.74:.58
      }))
    }
  });
}
