export class InvariantMonitor{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.current=[];
    this.signature="";
  }

  inspect(snapshot,{now=0,procedures=[]}={}){
    const violations=[];
    const ids=new Set();
    for(const actor of snapshot.actors){
      if(ids.has(actor.id))violations.push({code:"duplicate_actor_id",actorId:actor.id});
      ids.add(actor.id);
      if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y))violations.push({code:"invalid_actor_position",actorId:actor.id});
    }
    for(const procedure of procedures){
      const assigned=new Set();
      if(!procedure?.procedureId||!procedure?.phase?.id)violations.push({code:"invalid_team_procedure",teamId:procedure?.teamId??null});
      for(const role of procedure?.roles??[]){
        if(!role.actorId)continue;
        if(assigned.has(role.actorId))violations.push({code:"duplicate_procedure_role_actor",teamId:procedure.teamId,actorId:role.actorId});
        assigned.add(role.actorId);
        if(!ids.has(role.actorId))violations.push({code:"unknown_procedure_role_actor",teamId:procedure.teamId,actorId:role.actorId});
      }
    }
    const nextSignature=JSON.stringify(violations);
    if(nextSignature!==this.signature){
      this.signature=nextSignature;
      this.current=violations;
      this.decisionLog?.record?.({
        type:violations.length?"invariant_violation":"invariants_clear",
        time:now,
        data:{violations}
      });
    }
    return violations;
  }
}
