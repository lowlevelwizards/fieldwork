function stableSide(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return(hash>>>0)%2===0?1:-1;
}

function commonDirective(context){
  const {role,procedure,mission}=context;
  const provenance={
    owner:"role_action_runtime",source:"procedure_role",teamId:procedure.teamId,missionId:procedure.missionId,
    responseId:procedure.responseId,procedureId:procedure.procedureId,procedureLabel:procedure.label,
    phaseId:procedure.phase?.id??null,phaseLabel:procedure.phase?.label??null,roleId:role.roleId,roleLabel:role.label
  };
  return{
    task:mission?.immediateTask??null,roleId:role.roleId,roleLabel:role.label,responsibility:role.responsibility,
    procedureId:procedure.procedureId,procedureLabel:procedure.label,phaseId:procedure.phase?.id??null,
    phaseLabel:procedure.phase?.label??null,provenance
  };
}

export function extendDemonstrativeFireContext(context,{actor,role}={}){
  if(role?.fulfillment?.need!=="demonstrative_fire"||!context?.contactPosition)return context;
  const contact=context.contactPosition;
  const dx=contact.x-actor.x,dy=contact.y-actor.y;
  const length=Math.max(1,Math.hypot(dx,dy));
  const side=stableSide(actor.id);
  const offset=role.fulfillment.offsetDistance??92;
  return{
    ...context,
    demonstrativeFire:{
      targetPoint:{x:contact.x+(-dy/length)*offset*side,y:contact.y+(dx/length)*offset*side},
      contactPoint:{...contact},
      maximumRounds:1
    }
  };
}

export function evaluateDemonstrativeFireActions(context){
  const {role,procedure,demonstrativeFire}=context??{};
  if(role?.fulfillment?.need!=="demonstrative_fire"||!procedure)return[];
  const common=commonDirective(context);
  if(procedure.phase?.id==="fire_warning_shot"&&procedure.permissions?.fire&&demonstrativeFire?.targetPoint){
    return[{
      type:"DemonstrativeFire",score:1,
      reason:`${role.label} owns the single deliberately offset warning round and must stop after firing it.`,
      directive:{...common,reason:`${role.label}: ${role.responsibility}`,targetPoint:{...demonstrativeFire.targetPoint},contactPoint:{...demonstrativeFire.contactPoint},maximumRounds:1}
    }];
  }
  if(procedure.phase?.id==="hold_after_shot"&&demonstrativeFire?.contactPoint){
    return[{
      type:"HoldReady",score:.96,
      reason:`${role.label} has fired the one authorized round and now holds fire while observing the result.`,
      directive:{...common,reason:`${role.label}: warning shot complete; hold fire`,label:"Warned contact direction",focus:{...demonstrativeFire.contactPoint}}
    }];
  }
  return[];
}
