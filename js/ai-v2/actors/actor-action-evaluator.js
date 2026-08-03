export class ActorActionEvaluator{
  evaluate(context){
    const {actor,role,procedure,mission,sector,focus,warning,movement,recovery,evacuation,label}=context??{};
    if(!role||!procedure)return[];
    const provenance={
      owner:"role_action_runtime",
      source:"procedure_role",
      teamId:procedure.teamId,
      missionId:procedure.missionId,
      responseId:procedure.responseId,
      procedureId:procedure.procedureId,
      procedureLabel:procedure.label,
      phaseId:procedure.phase?.id??null,
      phaseLabel:procedure.phase?.label??null,
      roleId:role.roleId,
      roleLabel:role.label
    };
    const common={
      task:mission?.immediateTask??null,
      roleId:role.roleId,
      roleLabel:role.label,
      responsibility:role.responsibility,
      procedureId:procedure.procedureId,
      procedureLabel:procedure.label,
      phaseId:procedure.phase?.id??null,
      phaseLabel:procedure.phase?.label??null,
      provenance
    };

    if(role.fulfillment?.need==="transport_casualty"){
      if(!evacuation?.casualtyId)return[];
      if(procedure.phase?.id==="transport_leg"&&evacuation.destination&&procedure.permissions?.drag&&procedure.permissions?.relocate){
        return[{type:"EvacuateCasualty",score:1,reason:`${role.label} must satisfy the current transport condition by moving the casualty along the secured route leg.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:evacuation.casualtyId,routeId:evacuation.routeId,routeLabel:evacuation.routeLabel,legIndex:evacuation.legIndex,waypointId:evacuation.waypoint?.id,waypointLabel:evacuation.waypoint?.label,destination:{...evacuation.destination},initialDistance:evacuation.initialDistance,staminaCost:evacuation.staminaCost,minimumTransportStamina:evacuation.minimumTransportStamina,finalLeg:evacuation.finalLeg,policy:{...evacuation.transportPolicy}}}];
      }
      if(procedure.phase?.id==="reassess_casualty"&&procedure.permissions?.care){
        return[{type:"ReassessEvacuationCasualty",score:1,reason:`${role.label} must confirm that the casualty remains stable before another movement leg begins.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:evacuation.casualtyId,legIndex:evacuation.legIndex,reportRange:evacuation.reportRange,duration:evacuation.reassessmentDuration}}];
      }
      if(procedure.phase?.id==="transfer_casualty"&&procedure.permissions?.transfer){
        return[{type:"TransferCasualty",score:1,reason:`${role.label} must complete the handoff that turns field stabilization into safe return.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:evacuation.casualtyId,routeId:evacuation.routeId,routeLabel:evacuation.routeLabel,duration:evacuation.transferDuration}}];
      }
      if(focus){
        return[{type:"HoldReady",score:.9,reason:`${role.label} remains with the casualty while Route Security establishes the next movement condition.`,directive:{...common,reason:`${role.label}: preserve patient access and await a secured route leg`,label,focus:{...focus}}}];
      }
      return[];
    }

    if(role.fulfillment?.need==="secure_evacuation_route"){
      if(procedure.phase?.id==="select_route"){
        return[{type:"SelectEvacuationRoute",score:1,reason:`${role.label} must compare current world affordances before the team commits to an extraction route.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,duration:evacuation?.routeAssessmentDuration??.8}}];
      }
      if(procedure.phase?.id==="secure_route_leg"&&evacuation?.destination&&procedure.permissions?.relocate){
        return[{type:"AdvanceRouteSecurity",score:1,reason:`${role.label} must occupy and validate the next route waypoint before the casualty moves.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,routeId:evacuation.routeId,routeLabel:evacuation.routeLabel,legIndex:evacuation.legIndex,waypointId:evacuation.waypoint?.id,waypointLabel:evacuation.waypoint?.label,destination:{...evacuation.destination},initialDistance:evacuation.initialDistance,policy:{...evacuation.routePolicy}}}];
      }
      if(focus){
        return[{type:"HoldReady",score:.94,reason:`${role.label} holds the currently secured waypoint while the carrier moves or reassesses the casualty.`,directive:{...common,reason:`${role.label}: hold the secured route point`,label,focus:{...focus}}}];
      }
      return[];
    }

    if(role.fulfillment?.need==="rear_security_evacuation"&&sector&&procedure.permissions?.observe){
      return[{type:"ObserveSector",score:.99,reason:`${role.label} preserves independent rear awareness while route and carrier responsibilities change.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,sector:{...sector}}}];
    }

    if(role.fulfillment?.need==="recover_casualty"){
      if(!recovery?.casualtyId)return[];
      if(procedure.phase?.id==="reach_casualty"&&procedure.permissions?.relocate){
        return[{type:"ApproachCasualty",score:1,reason:`${role.label} must reach the known casualty before assessment or treatment can occur.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:recovery.casualtyId,destination:{...recovery.approachDestination},interactionRange:recovery.interactionRange,initialDistance:recovery.initialApproachDistance,policy:{speedMultiplier:recovery.approachSpeedMultiplier,arrivalRadius:recovery.arrivalRadius}}}];
      }
      if(procedure.phase?.id==="assess_condition"&&procedure.permissions?.care){
        return[{type:"AssessCasualty",score:1,reason:`${role.label} must establish the casualty's mobility and treatment need before moving them.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:recovery.casualtyId,interactionRange:recovery.interactionRange,reportRange:recovery.reportRange,duration:1.8}}];
      }
      if(procedure.phase?.id==="move_to_recovery"&&procedure.permissions?.drag&&procedure.permissions?.relocate){
        return[{type:"DragCasualty",score:1,reason:`${role.label} must move the assessed casualty to protected ground.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:recovery.casualtyId,destination:{...recovery.recoveryPoint},interactionRange:recovery.interactionRange,initialDistance:recovery.initialDragDistance,policy:{speedMultiplier:recovery.dragSpeedMultiplier,arrivalRadius:recovery.arrivalRadius,claimSpacing:recovery.claimSpacing}}}];
      }
      if(procedure.phase?.id==="stabilize"&&procedure.permissions?.care){
        return[{type:"StabilizeCasualty",score:1,reason:`${role.label} must apply the treatment identified by the assessment and stop immediate deterioration.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,casualtyId:recovery.casualtyId,interactionRange:recovery.interactionRange,reportRange:recovery.reportRange,duration:recovery.stabilizationDuration}}];
      }
      if(procedure.phase?.id==="recovery_complete"&&focus){
        return[{type:"HoldReady",score:.9,reason:`${role.label} remains beside the stabilized casualty while the recovery outcome is recorded.`,directive:{...common,reason:`${role.label}: recovery complete`,label,focus:{...focus}}}];
      }
      return[];
    }
    if(role.fulfillment?.need==="observe_recovery_approach"&&sector&&procedure.permissions?.observe){
      return[{type:"ObserveSector",score:.99,reason:`${role.label} preserves independent awareness while the aid provider performs recovery.`,directive:{...common,reason:`${role.label}: ${role.responsibility}`,sector:{...sector}}}];
    }

    if(role.fulfillment?.need==="issue_warning"){
      if(procedure.phase?.id==="issue_warning"&&procedure.permissions?.warn&&warning?.targetPoint){
        return[{
          type:"IssueWarning",
          score:1,
          reason:`${role.label} must make the mission boundary explicit before the encounter can escalate.`,
          directive:{
            ...common,
            reason:`${role.label}: ${role.responsibility}`,
            subjectId:warning.subjectId,
            targetPoint:{...warning.targetPoint},
            warningType:warning.warningType,
            message:warning.message,
            boundary:warning.boundary?{...warning.boundary,area:warning.boundary.area?{...warning.boundary.area}:null,allowedActivities:[...(warning.boundary.allowedActivities??[])]}:null
          }
        }];
      }
      if(procedure.phase?.id==="await_response"&&focus){
        return[{
          type:"HoldReady",
          score:.98,
          reason:`${role.label} must remain available while the team waits for an observable response to the warning.`,
          directive:{...common,reason:`${role.label}: awaiting response after the warning`,label,focus:{...focus}}
        }];
      }
      return[];
    }

    if(role.fulfillment?.need==="staged_withdrawal"){
      if(procedure.phase?.id===role.fulfillment.stageId&&movement?.destination&&procedure.permissions?.relocate){
        return[{
          type:"WithdrawToRoute",
          score:1,
          reason:`${role.label} is the active mover in the team's staged silent withdrawal.`,
          directive:{
            ...common,
            reason:`${role.label}: ${role.responsibility}`,
            routeId:movement.routeId,
            routeLabel:movement.routeLabel,
            destination:{...movement.destination},
            policy:{...movement.policy},
            initialDistance:movement.initialDistance
          }
        }];
      }
      if(focus){
        return[{
          type:"HoldReady",
          score:.92,
          reason:`${role.label} waits in sequence while another operator completes the current withdrawal stage.`,
          directive:{...common,reason:`${role.label}: preserve spacing and await the next withdrawal stage`,label,focus:{...focus}}
        }];
      }
      return[];
    }

    if(role.fulfillment?.need==="rear_watch_then_withdraw"){
      if(procedure.phase?.id===role.fulfillment.stageId&&movement?.destination&&procedure.permissions?.relocate){
        return[{
          type:"WithdrawToRoute",
          score:1,
          reason:`${role.label} leaves last after the other operators reach the withdrawal route.`,
          directive:{
            ...common,
            reason:`${role.label}: ${role.responsibility}`,
            routeId:movement.routeId,
            routeLabel:movement.routeLabel,
            destination:{...movement.destination},
            policy:{...movement.policy},
            initialDistance:movement.initialDistance
          }
        }];
      }
      if(sector&&procedure.permissions?.observe){
        return[{
          type:"ObserveSector",
          score:.99,
          reason:`${role.label} preserves contact awareness while the other operators withdraw.`,
          directive:{...common,reason:`${role.label}: ${role.responsibility}`,sector:{...sector}}
        }];
      }
      if(focus){
        return[{
          type:"HoldReady",
          score:.9,
          reason:`${role.label} has completed the rear disengagement and holds at the withdrawal route.`,
          directive:{...common,reason:`${role.label}: withdrawal complete`,label,focus:{...focus}}
        }];
      }
      return[];
    }

    if(role.fulfillment?.need==="observe_contact"&&sector&&procedure.permissions?.observe){
      return[{
        type:"ObserveSector",
        score:1,
        reason:`${role.label} requires continued awareness of the reported contact sector.`,
        directive:{...common,reason:`${role.label}: ${role.responsibility}`,sector:{...sector}}
      }];
    }
    if(role.fulfillment?.need==="observe_alternate_approach"&&sector&&procedure.permissions?.observe){
      return[{
        type:"ObserveSector",
        score:.96,
        reason:`${role.label} requires coverage of an approach not already watched by the primary observer.`,
        directive:{...common,reason:`${role.label}: ${role.responsibility}`,sector:{...sector}}
      }];
    }
    if(role.fulfillment?.need==="hold_rear_ready"&&focus){
      return[{
        type:"HoldReady",
        score:.92,
        reason:`${role.label} must remain uncommitted and available while preserving the team's rear option.`,
        directive:{...common,reason:`${role.label}: ${role.responsibility}`,label,focus:{...focus}}
      }];
    }
    return[];
  }
}
