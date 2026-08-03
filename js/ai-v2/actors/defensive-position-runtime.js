import { MoveToPositionSlotAction } from "../actions/move-to-position-slot-action.js";
import { HoldPositionAction } from "../actions/hold-position-action.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function cloneSlot(slot){
  return slot?{
    ...slot,
    point:{...slot.point},
    obstacle:slot.obstacle?{...slot.obstacle}:null,
    threatPoint:slot.threatPoint?{...slot.threatPoint}:null,
    utility:slot.utility?{...slot.utility}:null
  }:null;
}

function capable(actor){return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&actor.medical?.condition!=="critical");}

export class DefensivePositionRuntime{
  constructor({scheduler,directionalCover,positionSlots,decisionLog=null}={}){
    this.scheduler=scheduler;
    this.directionalCover=directionalCover;
    this.positionSlots=positionSlots;
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,teamProcedures,teamMissions,teamEncounters,now=0,context={}}={}){
    this.positionSlots?.update?.(now);
    const eligible=new Set();

    for(const procedure of teamProcedures?.summary?.()??[]){
      if(procedure.procedureId!=="defensive_position"||procedure.phase?.id==="establish_responsibilities")continue;
      const mission=teamMissions?.get?.(procedure.teamId)??null;
      const encounter=teamEncounters?.getBestTeamHypothesis?.(procedure.teamId)??null;
      const threatPoint=encounter?.approximatePosition??null;
      const policy=mission?.defensivePlan??null;
      if(!threatPoint||!policy)continue;
      const teamActors=(game?.actors??[]).filter(actor=>actor.teamId===procedure.teamId&&capable(actor));

      for(const role of procedure.roles??[]){
        const actor=teamActors.find(candidate=>candidate.id===role.actorId)??null;
        if(!actor||role.fulfillment?.need!=="directional_defensive_position")continue;
        eligible.add(actor.id);
        const existing=this.byActor.get(actor.id)??null;
        const claim=this.positionSlots.getForActor(actor.id,now);
        const retainedSlot=existing?.slot??null;
        const validity=retainedSlot&&claim?.slotId===retainedSlot.id
          ?this.directionalCover.isSlotValid({game,slot:retainedSlot,threatPoint,policy})
          :{valid:false,reason:"no_retained_slot"};

        if(retainedSlot&&claim&&validity.valid){
          this.positionSlots.renewActor(actor.id,{now,duration:claim.status==="occupied"?30:8});
          const moving=this.scheduler.getAction(actor.id,"MoveToPositionSlot");
          const holding=this.scheduler.getAction(actor.id,"HoldPosition");
          if(moving){
            this.byActor.set(actor.id,{...existing,status:"moving",lastUpdatedAt:now,protection:validity.protection});
            continue;
          }
          if(claim.status==="occupied"||distance(actor,retainedSlot.point)<=(policy.arrivalRadius??10)+3){
            this.positionSlots.occupy(actor.id,{now,duration:30});
            if(!holding)this.#startHold({actor,role,procedure,mission,slot:retainedSlot,now,context});
            this.byActor.set(actor.id,{...existing,status:"holding",lastUpdatedAt:now,protection:validity.protection,committedAt:existing?.committedAt??now});
            continue;
          }
        }

        if(existing)this.#release(actor,{now,context,reason:validity.reason??"defensive_slot_invalidated",preserveEligibility:true});
        const search=this.directionalCover.findBestSlot({
          game,actor,roleId:role.roleId,threatPoint,teamActors,policy,claims:this.positionSlots,now
        });
        if(!search.best){
          this.byActor.set(actor.id,{actorId:actor.id,teamId:actor.teamId,roleId:role.roleId,roleLabel:role.label,procedureId:procedure.procedureId,status:"blocked",reason:"no_directional_cover_slot",lastUpdatedAt:now,slot:null});
          actor.aiV2DefensivePosition={status:"blocked",roleId:role.roleId,roleLabel:role.label,reason:"No distinct directional cover slot satisfies the responsibility."};
          this.#record("defensive_position_blocked",actor,now,{roleId:role.roleId,procedureId:procedure.procedureId});
          continue;
        }
        const slot=cloneSlot(search.best);
        const claimed=this.positionSlots.claim({actorId:actor.id,slot,now,duration:8,purpose:`${role.roleId}_defensive_position`});
        if(!claimed.ok)continue;
        this.#startMove({actor,role,procedure,mission,slot,now,context});
        const record={
          actorId:actor.id,
          teamId:actor.teamId,
          roleId:role.roleId,
          roleLabel:role.label,
          procedureId:procedure.procedureId,
          status:"moving",
          selectedAt:now,
          committedAt:null,
          lastUpdatedAt:now,
          score:slot.score,
          slot
        };
        this.byActor.set(actor.id,record);
        this.#record("defensive_position_selected",actor,now,{roleId:role.roleId,procedureId:procedure.procedureId,slotId:slot.id,sourceObjectId:slot.sourceObjectId,score:slot.score,protection:slot.utility?.protection});
      }
    }

    for(const [actorId] of [...this.byActor]){
      if(eligible.has(actorId))continue;
      const actor=(game?.actors??[]).find(candidate=>candidate.id===actorId);
      if(actor)this.#release(actor,{now,context,reason:"defensive_procedure_ended"});
      else{
        this.positionSlots.releaseActor(actorId,{now,reason:"actor_missing"});
        this.byActor.delete(actorId);
      }
    }
  }

  get(actorId){
    const record=this.byActor.get(actorId);
    return record?{...record,slot:cloneSlot(record.slot)}:null;
  }

  summary(){return[...this.byActor.keys()].map(actorId=>this.get(actorId));}

  #startMove({actor,role,procedure,mission,slot,now,context}){
    const directive={
      task:mission?.immediateTask??null,
      roleId:role.roleId,
      roleLabel:role.label,
      procedureId:procedure.procedureId,
      procedureLabel:procedure.label,
      phaseId:procedure.phase?.id??null,
      phaseLabel:procedure.phase?.label??null,
      reason:`${role.label}: ${role.responsibility}`,
      slot:cloneSlot(slot),
      initialDistance:distance(actor,slot.point),
      policy:{speedMultiplier:mission?.defensivePlan?.speedMultiplier??.62,arrivalRadius:mission?.defensivePlan?.arrivalRadius??10},
      provenance:{owner:"defensive_position_runtime",source:"directional_cover_slot",teamId:actor.teamId,procedureId:procedure.procedureId,phaseId:procedure.phase?.id??null,roleId:role.roleId,roleLabel:role.label}
    };
    const action=new MoveToPositionSlotAction({actorId:actor.id,directive});
    const result=this.scheduler.start(action,{now,context});
    if(!result.ok)this.positionSlots.releaseActor(actor.id,{now,reason:"defensive_move_rejected"});
  }

  #startHold({actor,role,procedure,mission,slot,now,context}){
    const directive={
      task:mission?.immediateTask??null,
      roleId:role.roleId,
      roleLabel:role.label,
      procedureId:procedure.procedureId,
      procedureLabel:procedure.label,
      phaseId:procedure.phase?.id??null,
      phaseLabel:procedure.phase?.label??null,
      reason:`${role.label}: remain committed while the directional cover slot remains valid.`,
      slot:cloneSlot(slot),
      provenance:{owner:"defensive_position_runtime",source:"position_commitment",teamId:actor.teamId,procedureId:procedure.procedureId,phaseId:procedure.phase?.id??null,roleId:role.roleId,roleLabel:role.label}
    };
    const action=new HoldPositionAction({actorId:actor.id,directive});
    this.scheduler.start(action,{now,context});
  }

  #release(actor,{now,context,reason,preserveEligibility=false}){
    for(const type of ["MoveToPositionSlot","HoldPosition"]){
      const action=this.scheduler.getAction(actor.id,type);
      if(action)this.scheduler.cancelAction(actor.id,action,{now,reason,context});
    }
    this.positionSlots.releaseActor(actor.id,{now,reason});
    this.byActor.delete(actor.id);
    actor.aiV2DefensivePosition=null;
    if(!preserveEligibility)this.#record("defensive_position_released",actor,now,{reason});
  }

  #record(type,actor,now,data={}){
    this.decisionLog?.record?.({type,time:now,actorId:actor.id,teamId:actor.teamId,data});
  }
}
