export class ActorActionEvaluator{
  evaluate(context){
    const {actor,role,procedure,mission,sector,focus,warning,movement,label}=context??{};
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
