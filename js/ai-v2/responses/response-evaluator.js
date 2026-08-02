import { buildTeamDecisionLedger } from "../decisions/team-decision-ledger.js";
import { TEAM_RESPONSE_OPTIONS } from "./response-options.js";

export function evaluateTeamResponses({mission,encounter}={}){
  const ledger=buildTeamDecisionLedger({mission,encounter});
  if(!ledger)return null;
  const candidates=TEAM_RESPONSE_OPTIONS
    .map(option=>option.evaluate({ledger,mission,encounter}))
    .filter(Boolean)
    .sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
  const selected=candidates[0]??null;
  return{
    teamId:mission.teamId,
    missionId:mission.id,
    subjectId:encounter.subjectId,
    encounterState:encounter.state,
    reportId:encounter.reportId,
    ledger,
    candidates,
    selected
  };
}
