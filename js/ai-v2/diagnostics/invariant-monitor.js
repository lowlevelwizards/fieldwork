export class InvariantMonitor{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.current=[];
    this.signature="";
  }

  inspect(snapshot,{now=0,procedures=[],roleActions=[],scheduler=null}={}){
    const violations=[];
    const ids=new Set();
    for(const actor of snapshot.actors){
      if(ids.has(actor.id))violations.push({code:"duplicate_actor_id",actorId:actor.id});
      ids.add(actor.id);
      if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y))violations.push({code:"invalid_actor_position",actorId:actor.id});
    }

    const roleActionByActor=new Map();
    for(const assignment of roleActions){
      if(roleActionByActor.has(assignment.actorId))violations.push({code:"duplicate_role_action_assignment",actorId:assignment.actorId});
      roleActionByActor.set(assignment.actorId,assignment);
      if(!ids.has(assignment.actorId))violations.push({code:"unknown_role_action_actor",actorId:assignment.actorId});
      if(scheduler&&!scheduler.hasAction(assignment.actorId,assignment.actionType)){
        violations.push({code:"role_action_not_scheduled",actorId:assignment.actorId,actionType:assignment.actionType});
      }
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
          const fulfillment=roleActionByActor.get(role.actorId);
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
