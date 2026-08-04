export class InvariantMonitor{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.current=[];
    this.signature="";
  }

  inspect(snapshot,{now=0,procedures=[],roleActions=[],operationalTravel=[],rolePositions=[],defensivePositions=[],destinationClaims=[],positionSlots=[],patientClaims=[],scheduler=null}={}){
    const violations=[];
    const ids=new Set();
    for(const actor of snapshot.actors){
      if(ids.has(actor.id))violations.push({code:"duplicate_actor_id",actorId:actor.id});
      ids.add(actor.id);
      if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y))violations.push({code:"invalid_actor_position",actorId:actor.id});
    }

    const travelByActor=new Map((operationalTravel??[]).map(item=>[item.actorId,item]));
    const roleActionByActor=new Map();
    for(const assignment of roleActions){
      if(roleActionByActor.has(assignment.actorId))violations.push({code:"duplicate_role_action_assignment",actorId:assignment.actorId});
      roleActionByActor.set(assignment.actorId,assignment);
      if(!ids.has(assignment.actorId))violations.push({code:"unknown_role_action_actor",actorId:assignment.actorId});
      if(scheduler&&!scheduler.hasAction(assignment.actorId,assignment.actionType)&&!scheduler.hasAction(assignment.actorId,"FollowOperationRoute")){
        violations.push({code:"role_action_not_scheduled",actorId:assignment.actorId,actionType:assignment.actionType});
      }
    }

    const positionByActor=new Map();
    for(const position of rolePositions){
      if(positionByActor.has(position.actorId))violations.push({code:"duplicate_role_position_state",actorId:position.actorId});
      positionByActor.set(position.actorId,position);
      if(!ids.has(position.actorId))violations.push({code:"unknown_role_position_actor",actorId:position.actorId});
      if(position.status==="moving"&&scheduler&&!scheduler.hasAction(position.actorId,"RepositionForResponsibility")){
        violations.push({code:"moving_position_without_action",actorId:position.actorId});
      }
      if(position.status==="satisfied"&&position.evaluation&&!position.evaluation.suitable){
        violations.push({code:"accepted_unsuitable_position",actorId:position.actorId});
      }
    }

    const defensiveByActor=new Map();
    const defensiveSlots=new Set();
    for(const position of defensivePositions){
      if(defensiveByActor.has(position.actorId))violations.push({code:"duplicate_defensive_position_state",actorId:position.actorId});
      defensiveByActor.set(position.actorId,position);
      if(!ids.has(position.actorId))violations.push({code:"unknown_defensive_position_actor",actorId:position.actorId});
      if(position.slot?.id){
        if(defensiveSlots.has(position.slot.id))violations.push({code:"duplicate_defensive_slot_assignment",slotId:position.slot.id});
        defensiveSlots.add(position.slot.id);
      }
      if(position.status==="moving"&&scheduler&&!scheduler.hasAction(position.actorId,"MoveToPositionSlot")){
        violations.push({code:"moving_defensive_position_without_action",actorId:position.actorId});
      }
      if(position.status==="holding"&&scheduler&&!scheduler.hasAction(position.actorId,"HoldPosition")){
        violations.push({code:"held_defensive_position_without_action",actorId:position.actorId});
      }
    }

    const claimActors=new Set();
    for(const claim of destinationClaims){
      if(claimActors.has(claim.actorId))violations.push({code:"duplicate_destination_claim",actorId:claim.actorId});
      claimActors.add(claim.actorId);
      if(!ids.has(claim.actorId))violations.push({code:"unknown_destination_claim_actor",actorId:claim.actorId});
      if(scheduler&&!scheduler.hasAction(claim.actorId,"RepositionForResponsibility")&&!scheduler.hasAction(claim.actorId,"WithdrawToRoute")&&!scheduler.hasAction(claim.actorId,"ApproachCasualty")&&!scheduler.hasAction(claim.actorId,"DragCasualty")&&!scheduler.hasAction(claim.actorId,"AdvanceRouteSecurity")&&!scheduler.hasAction(claim.actorId,"EvacuateCasualty")&&!scheduler.hasAction(claim.actorId,"MoveToObjectivePosition")){
        violations.push({code:"destination_claim_without_movement_action",actorId:claim.actorId});
      }
    }

    const slotIds=new Set();
    const slotActors=new Set();
    for(const claim of positionSlots){
      if(slotIds.has(claim.slotId))violations.push({code:"duplicate_position_slot_claim",slotId:claim.slotId});
      if(slotActors.has(claim.actorId))violations.push({code:"actor_claimed_multiple_position_slots",actorId:claim.actorId});
      slotIds.add(claim.slotId);
      slotActors.add(claim.actorId);
      if(!ids.has(claim.actorId))violations.push({code:"unknown_position_slot_actor",actorId:claim.actorId});
      if(scheduler&&claim.status==="reserved"&&!scheduler.hasAction(claim.actorId,"MoveToPositionSlot"))violations.push({code:"reserved_slot_without_movement_action",actorId:claim.actorId,slotId:claim.slotId});
      if(scheduler&&claim.status==="occupied"&&!scheduler.hasAction(claim.actorId,"HoldPosition"))violations.push({code:"occupied_slot_without_hold_action",actorId:claim.actorId,slotId:claim.slotId});
    }

    const claimedPatients=new Set();
    for(const claim of patientClaims){
      if(claimedPatients.has(claim.patientId))violations.push({code:"duplicate_patient_claim",patientId:claim.patientId});
      claimedPatients.add(claim.patientId);
      if(!ids.has(claim.patientId)||!ids.has(claim.actorId))violations.push({code:"unknown_patient_claim_actor",patientId:claim.patientId,actorId:claim.actorId});
      if(scheduler&&!scheduler.hasAction(claim.actorId,"DragCasualty")&&!scheduler.hasAction(claim.actorId,"StabilizeCasualty")&&!scheduler.hasAction(claim.actorId,"EvacuateCasualty")&&!scheduler.hasAction(claim.actorId,"ReassessEvacuationCasualty")&&!scheduler.hasAction(claim.actorId,"TransferCasualty"))violations.push({code:"patient_claim_without_care_action",patientId:claim.patientId,actorId:claim.actorId});
    }

    for(const procedure of procedures){
      const assigned=new Set();
      if(!procedure?.procedureId||!procedure?.phase?.id)violations.push({code:"invalid_team_procedure",teamId:procedure?.teamId??null});
      for(const role of procedure?.roles??[]){
        if(!role.actorId)continue;
        if(assigned.has(role.actorId))violations.push({code:"duplicate_procedure_role_actor",teamId:procedure.teamId,actorId:role.actorId});
        assigned.add(role.actorId);
        if(!ids.has(role.actorId))violations.push({code:"unknown_procedure_role_actor",teamId:procedure.teamId,actorId:role.actorId});
        if(procedure.phase.id!=="establish_responsibilities"){
          const fulfillment=travelByActor.get(role.actorId)??roleActionByActor.get(role.actorId)??defensiveByActor.get(role.actorId);
          if(!fulfillment)violations.push({code:"procedure_role_without_actor_action",teamId:procedure.teamId,actorId:role.actorId,roleId:role.roleId});
          else if(fulfillment.roleId!==role.roleId||fulfillment.procedureId!==procedure.procedureId){
            violations.push({code:"role_action_provenance_mismatch",teamId:procedure.teamId,actorId:role.actorId,roleId:role.roleId});
          }
        }
      }
    }

    const nextSignature=JSON.stringify(violations);
    if(nextSignature!==this.signature){
      this.signature=nextSignature;
      this.current=violations;
      this.decisionLog?.record?.({type:violations.length?"invariant_violation":"invariants_clear",time:now,data:{violations}});
    }
    return violations;
  }
}
