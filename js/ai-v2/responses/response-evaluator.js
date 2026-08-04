import { buildTeamDecisionLedger } from "../decisions/team-decision-ledger.js";
import { TEAM_RESPONSE_OPTIONS } from "./response-options.js";
import { AI_V2_2_0P_RESPONSE_OPTIONS } from "./response-options-2.0p.js";
import { AI_V2_2_0Q_RESPONSE_OPTIONS } from "./response-options-2.0q.js";
import { AI_V2_2_0V_RESPONSE_OPTIONS } from "./response-options-2.0v.js";
import { AI_V2_2_4_RESPONSE_OPTIONS } from "./response-options-2.4.js";

const ALL_RESPONSE_OPTIONS=Object.freeze([
  ...AI_V2_2_4_RESPONSE_OPTIONS,
  ...AI_V2_2_0V_RESPONSE_OPTIONS,
  ...AI_V2_2_0Q_RESPONSE_OPTIONS,
  ...AI_V2_2_0P_RESPONSE_OPTIONS,
  ...TEAM_RESPONSE_OPTIONS
]);

export function evaluateTeamResponses({mission,encounter,outcome=null}={}){
  const ledger=buildTeamDecisionLedger({mission,encounter,outcome});
  if(!ledger)return null;
  const candidates=ALL_RESPONSE_OPTIONS
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
