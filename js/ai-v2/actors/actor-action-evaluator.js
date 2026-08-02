export class ActorActionEvaluator{
  evaluate(context){
    const {role,procedure,mission,sector,focus,warning,label}=context??{};
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
