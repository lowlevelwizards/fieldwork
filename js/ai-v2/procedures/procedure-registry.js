import {
  getProcedureDefinitionForResponse as getBaseProcedureDefinitionForResponse,
  getProcedurePhase,
  getProcedureTransition,
  TEAM_PROCEDURE_DEFINITIONS
} from "./procedure-definitions.js";
import { AI_V2_2_0P_PROCEDURES } from "./procedure-definitions-2.0p.js";
import { AI_V2_2_0Q_PROCEDURES } from "./procedure-definitions-2.0q.js";
import { AI_V2_2_0R_PROCEDURES } from "./procedure-definitions-2.0r.js";

export function getProcedureDefinitionForResponse(responseId){
  return AI_V2_2_0R_PROCEDURES[responseId]??AI_V2_2_0Q_PROCEDURES[responseId]??AI_V2_2_0P_PROCEDURES[responseId]??getBaseProcedureDefinitionForResponse(responseId);
}

export { getProcedurePhase, getProcedureTransition };

export const ALL_TEAM_PROCEDURE_DEFINITIONS=Object.freeze({
  ...TEAM_PROCEDURE_DEFINITIONS,
  ...AI_V2_2_0P_PROCEDURES,
  ...AI_V2_2_0Q_PROCEDURES,
  ...AI_V2_2_0R_PROCEDURES
});
