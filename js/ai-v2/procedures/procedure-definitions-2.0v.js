function role({id,label,responsibility,selectionReason,fulfillment,preference=()=>0}){
  return Object.freeze({id,label,responsibility,selectionReason,fulfillment:Object.freeze({...fulfillment}),preference,eligible:()=>true});
}
function phase(id,label,reason){return Object.freeze({id,label,reason});}
function transition(event,{from,to,reason,complete=false}){return Object.freeze({event,from,to,reason,complete});}

const DEMONSTRATIVE_BOUNDARY_FIRE=Object.freeze({
  id:"demonstrative_boundary_fire",
  label:"Demonstrative Boundary Fire",
  responseId:"demonstrative_fire",
  description:"Assign one operator to fire a single deliberately offset warning round while two teammates preserve observation and alternate security.",
  establishDuration:.45,
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","One operator must own the single warning round while two others preserve the information picture."),
    phase("fire_warning_shot","Fire Warning Shot","Boundary Security fires one deliberately offset round and no more."),
    phase("hold_after_shot","Hold After Shot","The team stops firing and watches for withdrawal, hostile action, or renewed compliance."),
    phase("reassess","Reassess","A blocked firing lane or changed encounter requires another team decision without repeating the shot.")
  ]),
  activePhaseId:"fire_warning_shot",
  transitions:Object.freeze([
    transition("warning_shot_fired",{from:"fire_warning_shot",to:"hold_after_shot",reason:"The single offset round was fired; the team must stop and observe the result.",complete:true}),
    transition("warning_shot_failed",{from:"fire_warning_shot",to:"reassess",reason:"The safe warning-shot lane was unavailable, so the team must reassess rather than force the shot."})
  ]),
  permissions:Object.freeze({observe:true,report:true,relocate:false,warn:false,fire:true}),
  reassessmentTriggers:Object.freeze(["warning_shot_fired","warning_shot_failed","contact_withdrawing","hostile_action_observed","team_member_incapable","mission_changed"]),
  roles:Object.freeze([
    role({
      id:"boundary_security",
      label:"Boundary Security",
      responsibility:"Fire exactly one deliberately offset round beside the continuing contact, then hold fire and remain at the worksite.",
      selectionReason:"Prefer the security or rifle operator rather than the technical specialist.",
      fulfillment:{need:"demonstrative_fire",offsetDistance:92,maximumRounds:1},
      preference:actor=>{
        const name=String(actor.role??"").toLowerCase();
        return name.includes("scout")?130:name.includes("security")?110:name.includes("rifle")?90:name.includes("engineer")?-35:10;
      }
    }),
    role({
      id:"contact_observer",
      label:"Contact Observer",
      responsibility:"Maintain attention on the warned group and report whether it withdraws or escalates.",
      selectionReason:"Prefer the strongest available observer after Boundary Security is assigned.",
      fulfillment:{need:"observe_contact",label:"Warned contact sector",maximumRange:1100,fieldOfViewDegrees:78},
      preference:actor=>Number(actor.aiV2Capabilities?.observation??0)*100
    }),
    role({
      id:"alternate_security",
      label:"Alternate Security",
      responsibility:"Preserve awareness of the alternate approach while the warning shot is delivered.",
      selectionReason:"Assign the remaining capable operator to prevent total fixation on the challenged group.",
      fulfillment:{need:"observe_alternate_approach",label:"Alternate worksite approach",angularOffsetDegrees:58,distance:480,maximumRange:880,fieldOfViewDegrees:72},
      preference:actor=>String(actor.role??"").toLowerCase().includes("engineer")?25:5
    })
  ])
});

export const AI_V2_2_0V_PROCEDURES=Object.freeze({
  demonstrative_fire:DEMONSTRATIVE_BOUNDARY_FIRE
});
