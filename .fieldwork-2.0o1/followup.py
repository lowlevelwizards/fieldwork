from pathlib import Path

ROOT = Path.cwd()


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {relative_path}, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "js/ai-v2/actions/approach-evacuation-casualty-action.js",
    '''    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="transport_leg");
''',
    '''    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&["transport_leg","reassess_casualty","transfer_casualty"].includes(role?.phase?.id));
'''
)

replace_once(
    "js/ai-v2/actors/actor-action-evaluator.js",
    '''    if(role.fulfillment?.need==="transport_casualty"){
      if(!evacuation?.casualtyId)return[];
      if(procedure.phase?.id==="transport_leg"&&evacuation.destination&&procedure.permissions?.drag&&procedure.permissions?.relocate){
''',
    '''    if(role.fulfillment?.need==="transport_casualty"){
      if(!evacuation?.casualtyId)return[];
      const accessRange=evacuation.interactionRange??82;
      const accessPhase=["reassess_casualty","transfer_casualty"].includes(procedure.phase?.id);
      if(accessPhase&&(evacuation.distanceToCasualty??Infinity)>accessRange&&evacuation.approachDestination&&procedure.permissions?.relocate){
        return[{type:"ApproachEvacuationCasualty",score:1.03,reason:`${role.label} must physically reach the casualty before close reassessment or transfer.`,directive:{...common,reason:`${role.label}: establish physical patient access before ${procedure.phase?.label??"continuing evacuation"}`,casualtyId:evacuation.casualtyId,routeId:evacuation.routeId,routeLabel:evacuation.routeLabel,legIndex:evacuation.legIndex,destination:{...evacuation.approachDestination},interactionRange:accessRange,initialDistance:evacuation.initialApproachDistance,policy:{speedMultiplier:evacuation.approachSpeedMultiplier??.8,arrivalRadius:10,claimSpacing:48}}}];
      }
      if(procedure.phase?.id==="transport_leg"&&evacuation.destination&&procedure.permissions?.drag&&procedure.permissions?.relocate){
'''
)

replace_once(
    "js/ai-v2/actors/actor-action-evaluator.js",
    '''        return[{type:"ReassessEvacuationCasualty",score:1,reason:`${role.label} must confirm that the casualty remains stable before another movement leg begins.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:evacuation.casualtyId,legIndex:evacuation.legIndex,reportRange:evacuation.reportRange,duration:evacuation.reassessmentDuration}}];
''',
    '''        return[{type:"ReassessEvacuationCasualty",score:1,reason:`${role.label} must confirm that the casualty remains stable before another movement leg begins.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:evacuation.casualtyId,legIndex:evacuation.legIndex,interactionRange:evacuation.interactionRange,reportRange:evacuation.reportRange,duration:evacuation.reassessmentDuration}}];
'''
)

replace_once(
    "js/ai-v2/actions/reassess-evacuation-casualty-action.js",
    '''    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&!services?.casualtyCare?.getController?.(casualty.id));
''',
    '''    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    const interactionRange=this.directive.interactionRange??82;
    const patientDistance=actor&&casualty?Math.hypot(casualty.x-actor.x,casualty.y-actor.y):Infinity;
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&patientDistance<=interactionRange&&!services?.casualtyCare?.getController?.(casualty.id));
'''
)

replace_once(
    "js/ai-v2/actions/reassess-evacuation-casualty-action.js",
    '''    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="reassess_casualty");
''',
    '''    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    const interactionRange=this.directive.interactionRange??82;
    const patientDistance=actor&&casualty?Math.hypot(casualty.x-actor.x,casualty.y-actor.y):Infinity;
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&patientDistance<=interactionRange&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="reassess_casualty");
'''
)

replace_once(
    "tests/ai-v2-adaptive-evacuation.test.mjs",
    '''  assert.ok(entriesOf(game,"action_completed","ApproachEvacuationCasualty").some(entry=>entry.actorId===firstCarrier.id||entry.actorId===secondCarrier.id),"a carrier who is not already beside the patient should physically approach before transport");
''',
    '''  assert.ok(entriesOf(game,"action_started","ApproachEvacuationCasualty").some(entry=>entry.actorId===firstCarrier.id||entry.actorId===secondCarrier.id),"a carrier who is not already beside the patient should physically approach before transport");
'''
)

print("Applied follow-up physical access guards")
