import { RepositionForResponsibilityAction } from "../actions/reposition-for-responsibility-action.js";
import { describePositionFailure } from "../position/position-query-service.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function summarizeEvaluation(evaluation){
  if(!evaluation)return null;
  return{
    suitable:evaluation.suitable,
    position:{...evaluation.position},
    visibility:evaluation.visibility,
    coverage:evaluation.coverage,
    cohesionDistance:evaluation.cohesionDistance,
    nearestFriendly:evaluation.nearestFriendly,
    blockerId:evaluation.blockerId,
    reasons:[...evaluation.reasons],
    primaryReason:evaluation.primaryReason
  };
}

export class RolePositionRuntime{
  constructor({scheduler,positionQueries,destinationClaims,brain=null,decisionLog=null}={}){
    this.scheduler=scheduler;
    this.positionQueries=positionQueries;
    this.destinationClaims=destinationClaims;
    this.decisionLog=decisionLog;
    this.brain=brain;
    this.byActor=new Map();
  }

  update({game,teamProcedures,now=0,context={}}={}){
    this.destinationClaims?.update?.(now);
    const eligible=new Set();

    for(const actor of game?.actors??[]){
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const policy=role?.fulfillment?.positionPolicy??null;
      if(!role||!policy?.mayReposition||!role.permissions?.relocate){
        this.#release(actor,{now,reason:"role_has_no_reposition_authority"});
        continue;
      }
      const observe=this.scheduler.getAction(actor.id,"ObserveSector");
      if(!observe?.assignment?.sector){
        this.#release(actor,{now,reason:"responsibility_has_no_position_requirement"});
        continue;
      }
      eligible.add(actor.id);
      const existing=this.byActor.get(actor.id)??null;
      const moving=this.scheduler.getAction(actor.id,"RepositionForResponsibility");
      if(moving){
        this.byActor.set(actor.id,{
          ...existing,
          actorId:actor.id,
          status:"moving",
          roleId:role.roleId,
          roleLabel:role.label,
          procedureId:role.procedureId,
          destination:{...moving.directive.destination},
          failureReason:moving.directive.failureReason,
          lastUpdatedAt:now
        });
        continue;
      }

      const sectorSignature=`${observe.assignment.sector.x.toFixed(1)}:${observe.assignment.sector.y.toFixed(1)}:${observe.assignment.sector.label??"sector"}`;
      const identityChanged=!existing||existing.roleId!==role.roleId||existing.procedureId!==role.procedureId||existing.sectorSignature!==sectorSignature;
      const needsPostMoveValidation=existing?.status==="moving";
      if(!identityChanged&&!needsPostMoveValidation&&now<(existing.nextEvaluationAt??0))continue;

      const teamActors=game.actors.filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
      const evaluation=this.positionQueries.evaluateResponsibilityPosition({
        game,actor,sector:observe.assignment.sector,teamActors,policy
      });

      if(evaluation.suitable){
        const newlyAccepted=identityChanged||existing?.status!=="satisfied"||distance(existing?.acceptedPosition,actor)>18;
        const record={
          actorId:actor.id,
          status:"satisfied",
          roleId:role.roleId,
          roleLabel:role.label,
          procedureId:role.procedureId,
          sectorSignature,
          acceptedPosition:{x:actor.x,y:actor.y},
          evaluation:summarizeEvaluation(evaluation),
          acceptedAt:newlyAccepted?now:(existing?.acceptedAt??now),
          lastUpdatedAt:now,
          nextEvaluationAt:now+(policy.reassessEvery??1.5),
          destination:null,
          failureReason:null
        };
        this.byActor.set(actor.id,record);
        actor.aiV2PositionRequirement={...record,acceptedPosition:{...record.acceptedPosition},evaluation:{...record.evaluation,reasons:[...record.evaluation.reasons]}};
        actor.aiV2Reposition=null;
        if(newlyAccepted)this.#record("responsibility_position_accepted",actor,now,{roleId:role.roleId,procedureId:role.procedureId,evaluation:summarizeEvaluation(evaluation)});
        continue;
      }

      const failureReason=describePositionFailure(evaluation);
      const search=this.positionQueries.findBestResponsibilityPosition({
        game,actor,sector:observe.assignment.sector,teamActors,policy,claims:this.destinationClaims,now
      });
      if(!search.best){
        const record={
          actorId:actor.id,status:"blocked",roleId:role.roleId,roleLabel:role.label,procedureId:role.procedureId,
          sectorSignature,evaluation:summarizeEvaluation(evaluation),failureReason,destination:null,
          lastUpdatedAt:now,nextEvaluationAt:now+(policy.retryAfter??1.2)
        };
        this.byActor.set(actor.id,record);
        actor.aiV2PositionRequirement={...record,evaluation:{...record.evaluation,reasons:[...record.evaluation.reasons]}};
        if(existing?.status!=="blocked"||existing?.evaluation?.primaryReason!==evaluation.primaryReason)this.#record("responsibility_position_blocked",actor,now,{roleId:role.roleId,procedureId:role.procedureId,reason:failureReason,evaluation:summarizeEvaluation(evaluation)});
        continue;
      }

      const destination=search.best.point;
      const claim=this.destinationClaims.claim({
        actorId:actor.id,point:destination,purpose:`${role.roleId}_reposition`,now,
        duration:2.5,radius:policy.claimSpacing??72
      });
      if(!claim.ok){
        this.byActor.set(actor.id,{actorId:actor.id,status:"waiting_for_destination",roleId:role.roleId,roleLabel:role.label,procedureId:role.procedureId,sectorSignature,evaluation:summarizeEvaluation(evaluation),failureReason,destination:null,lastUpdatedAt:now,nextEvaluationAt:now+.5});
        continue;
      }

      const directive={
        roleId:role.roleId,
        roleLabel:role.label,
        procedureId:role.procedureId,
        procedureLabel:role.procedureLabel,
        phaseId:role.phase?.id??null,
        phaseLabel:role.phase?.label??null,
        reason:`${role.label} must reposition because ${failureReason}`,
        failureReason,
        destination:{...destination},
        sector:{...observe.assignment.sector},
        policy:{...policy},
        initialDistance:distance(actor,destination),
        positionEvaluation:summarizeEvaluation(evaluation),
        provenance:{
          owner:"role_position_runtime",
          source:"position_requirement",
          teamId:actor.teamId,
          procedureId:role.procedureId,
          phaseId:role.phase?.id??null,
          roleId:role.roleId,
          roleLabel:role.label
        }
      };
      const action=new RepositionForResponsibilityAction({actorId:actor.id,directive});
      const record={
        actorId:actor.id,status:"proposed",roleId:role.roleId,roleLabel:role.label,procedureId:role.procedureId,
        sectorSignature,evaluation:summarizeEvaluation(evaluation),failureReason,destination:{...destination},
        proposedAt:now,lastUpdatedAt:now,nextEvaluationAt:now+.45,actionId:action.id
      };
      this.byActor.set(actor.id,record);
      actor.aiV2PositionRequirement={...record,destination:{...record.destination},evaluation:{...record.evaluation,reasons:[...record.evaluation.reasons]}};
      this.brain?.submit?.({
        actorId:actor.id,action,
        score:Math.max(.45,Math.min(1,Number(search.best.score)||.6)),urgency:.46,
        authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,
        authorityLabel:"Mission responsibility position",
        reason:directive.reason,source:"role_position_runtime",
        operationId:actor.operationId??null,procedureId:role.procedureId,roleId:role.roleId,
        desiredEffect:"occupy_a_position_that_fulfills_responsibility",
        onGranted:result=>{
          const activeRecord={...record,status:"moving",startedAt:now,nextEvaluationAt:Infinity,actionId:result.action?.id??action.id};
          this.byActor.set(actor.id,activeRecord);
          actor.aiV2PositionRequirement={...activeRecord,destination:{...activeRecord.destination},evaluation:{...activeRecord.evaluation,reasons:[...activeRecord.evaluation.reasons]}};
          this.#record("responsibility_reposition_started",actor,now,{actionId:activeRecord.actionId,roleId:role.roleId,procedureId:role.procedureId,reason:failureReason,from:{x:actor.x,y:actor.y},destination:{...destination},candidateScore:search.best.score});
        },
        onRejected:reason=>{
          this.destinationClaims.release(actor.id,{now,reason:`movement_action_rejected:${reason}`});
          this.byActor.set(actor.id,{...record,status:"blocked",nextEvaluationAt:now+.5});
        }
      });
    }

    for(const [actorId] of [...this.byActor]){
      if(eligible.has(actorId))continue;
      const actor=game?.actors?.find(candidate=>candidate.id===actorId);
      if(actor)this.#release(actor,{now,reason:"procedural_position_requirement_ended"});
      else this.byActor.delete(actorId);
    }
  }

  get(actorId){
    const item=this.byActor.get(actorId);if(!item)return null;
    return{
      ...item,
      acceptedPosition:item.acceptedPosition?{...item.acceptedPosition}:null,
      destination:item.destination?{...item.destination}:null,
      evaluation:item.evaluation?{...item.evaluation,reasons:[...(item.evaluation.reasons??[])]}:null
    };
  }

  summary(){return[...this.byActor.keys()].map(actorId=>this.get(actorId));}

  #release(actor,{now,reason}){
    const action=this.scheduler.getAction(actor.id,"RepositionForResponsibility");
    if(action)this.brain?.requestCancel?.(actor.id,action,{reason});
    this.destinationClaims?.release?.(actor.id,{now,reason});
    if(this.byActor.has(actor.id))this.#record("responsibility_position_released",actor,now,{reason});
    this.byActor.delete(actor.id);
    actor.aiV2PositionRequirement=null;
    actor.aiV2Reposition=null;
  }

  #record(type,actor,now,data={}){
    this.decisionLog?.record?.({type,time:now,actorId:actor.id,teamId:actor.teamId,data});
  }
}
