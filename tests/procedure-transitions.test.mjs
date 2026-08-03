import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getProcedureDefinitionForResponse,
  getProcedureTransition
} from "../js/ai-v2/procedures/procedure-definitions.js";

test("procedure definitions own event transitions",async()=>{
  const recovery=getProcedureDefinitionForResponse("recover_casualty");
  assert.equal(getProcedureTransition(recovery,"casualty_reached","reach_casualty")?.to,"assess_condition");
  assert.equal(getProcedureTransition(recovery,"casualty_reached","stabilize"),null);
  assert.equal(getProcedureTransition(recovery,"casualty_recovery_failed","move_to_recovery")?.to,"reassess");

  const withdrawal=getProcedureDefinitionForResponse("withdraw_silently");
  assert.equal(getProcedureTransition(withdrawal,"withdrawal_stage_completed","lead_withdrawal",{roleId:"withdrawal_lead"})?.to,"protected_movement");
  assert.equal(getProcedureTransition(withdrawal,"withdrawal_stage_completed","lead_withdrawal",{roleId:"rear_watch"}),null);


  const evacuation=getProcedureDefinitionForResponse("evacuate_casualty");
  assert.equal(getProcedureTransition(evacuation,"evacuation_route_selected","select_route")?.to,"secure_route_leg");
  const intermediate=getProcedureTransition(evacuation,"casualty_transport_leg_completed","transport_leg",{finalLeg:false});
  assert.equal(typeof intermediate?.to,"function");
  assert.equal(intermediate.to({evacuation:{}},{data:{finalLeg:false}}),"reassess_casualty");
  assert.equal(intermediate.to({evacuation:{}},{data:{finalLeg:true}}),"transfer_casualty");

  const stateSource=await readFile(new URL("../js/ai-v2/procedures/team-procedure-state.js",import.meta.url),"utf8");
  for(const procedureId of ["casualty_recovery","casualty_evacuation","challenge_unknown_contact","break_contact_quietly","monitor_departure"]){
    assert.equal(stateSource.includes(`record.procedureId===\"${procedureId}\"`),false,`${procedureId} should not be hardcoded in TeamProcedureState`);
  }
});
