function role({id,label,responsibility,selectionReason,preference=()=>0}){
  return Object.freeze({
    id,label,responsibility,selectionReason,
    fulfillment:Object.freeze({need:"directional_defensive_position"}),
    preference,
    eligible:()=>true
  });
}
function phase(id,label,reason){return Object.freeze({id,label,reason});}
function transition(event,{from,to,reason,complete=false,guard=null,apply=null}){
  return Object.freeze({event,from,to,reason,complete,guard,apply});
}

const DEFENSIVE_POSITION=Object.freeze({
  id:"defensive_position",
  label:"Establish Defensive Position",
  responseId:"hold_defensively",
  description:"Translate one evidence-grounded threat direction into distinct finite cover slots, occupy them, and remain committed while the protection remains valid.",
  establishDuration:.5,
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","The defensive response requires an anchor, a supporting watch, and a separate mobile reserve."),
    phase("occupy_positions","Occupy Positions","Each responsibility claims and occupies a distinct directional cover slot."),
    phase("defensive_hold","Defensive Hold","All responsibilities are settled in valid cover and remain committed without pacing or slot theft."),
    phase("reassess","Reassess","A lost slot, changed threat direction, or incapable operator requires the position plan to be reconsidered.")
  ]),
  activePhaseId:"occupy_positions",
  transitions:Object.freeze([
    transition("defensive_slot_occupied",{
      from:"occupy_positions",
      to:record=>{
        const occupied=new Set(record.defensive?.occupiedRoleIds??[]);
        const required=record.roles.filter(item=>item.actorId).length;
        return occupied.size>=required?"defensive_hold":"occupy_positions";
      },
      reason:"A responsibility occupied its finite directional cover slot; the team holds once every assigned responsibility is settled.",
      apply:(record,{data,now})=>{
        const occupied=new Set(record.defensive?.occupiedRoleIds??[]);
        if(data.roleId)occupied.add(data.roleId);
        record.defensive={
          ...(record.defensive??{}),
          occupiedRoleIds:[...occupied],
          lastOccupiedAt:now,
          lastSlotId:data.slotId??null
        };
      }
    }),
    transition("position_slot_invalidated",{
      from:"*",
      to:"reassess",
      reason:"A committed slot no longer protects against the known threat direction."
    }),
    transition("team_member_incapable",{
      from:"*",
      to:"reassess",
      reason:"A defensive responsibility became unfilled and must be reassigned."
    })
  ]),
  permissions:Object.freeze({observe:true,report:true,relocate:true,warn:false,fire:false}),
  reassessmentTriggers:Object.freeze([
    "defensive_slot_occupied",
    "position_slot_invalidated",
    "team_member_incapable",
    "mission_changed",
    "hostile_pressure_ended"
  ]),
  roles:Object.freeze([
    role({
      id:"security_anchor",
      label:"Security Anchor",
      responsibility:"Occupy the strongest available directional cover slot and maintain the primary threat-facing responsibility.",
      selectionReason:"Prefer the security operator for the team's primary defended position.",
      preference:actor=>String(actor.role??"").toLowerCase().includes("security")?120:String(actor.role??"").toLowerCase().includes("rifle")?70:10
    }),
    role({
      id:"supporting_watch",
      label:"Supporting Watch",
      responsibility:"Occupy a separate cover source that supports the anchor without sharing its finite slot.",
      selectionReason:"Prefer the rifle operator for a distinct supporting threat-facing position.",
      preference:actor=>String(actor.role??"").toLowerCase().includes("rifle")?115:String(actor.role??"").toLowerCase().includes("security")?65:15
    }),
    role({
      id:"mobile_reserve",
      label:"Mobile Reserve",
      responsibility:"Occupy protected ground offset from the forward responsibilities and remain available without crowding them.",
      selectionReason:"Preserve the engineer or support operator as a protected reserve after the forward positions are filled.",
      preference:actor=>String(actor.role??"").toLowerCase().includes("engineer")?110:String(actor.role??"").toLowerCase().includes("medic")?100:20
    })
  ])
});

export const AI_V2_2_0Q_PROCEDURES=Object.freeze({
  hold_defensively:DEFENSIVE_POSITION
});
