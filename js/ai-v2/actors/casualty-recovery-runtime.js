import { ApproachCasualtyAction } from "../actions/approach-casualty-action.js";
import { AssessCasualtyAction } from "../actions/assess-casualty-action.js";
import { DragCasualtyAction } from "../actions/drag-casualty-action.js";
import { TreatAssignedCasualtyAction } from "../actions/treat-assigned-casualty-action.js";
import { CasualtyRecoveryPositionService } from "../position/casualty-recovery-position-service.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const point=value=>value?{x:Number(value.x)||0,y:Number(value.y)||0}:null;

function visibleUrgency(casualty){
  const condition=casualty?.medical?.condition;
  if(casualty?.medical?.unconscious||condition==="critical")return 1;
  if(condition==="serious")return .72;
  if(condition==="wounded")return .48;
  return .3;
}

function candidateRecord(candidate){
  return candidate?{
    type:candidate.type,score:candidate.score,urgency:candidate.urgency,reason:candidate.reason,
    destination:point(candidate.directive?.destination??candidate.directive?.recoveryPosition),
    treatmentType:candidate.directive?.treatmentType??null
  }:null;
}

function bestKnowledgeRecord(casualtyKnowledge,actor,casualty){
  if(!casualtyKnowledge||!actor||!casualty)return null;
  const records=[
    ...(casualtyKnowledge.getPersonalCasualties?.(actor.id)??[]),
    ...(casualtyKnowledge.getReceivedCasualties?.(actor.id)??[]),
    ...(casualtyKnowledge.getTeamCasualties?.(actor.teamId)??[])
  ].filter(record=>record.subjectId===casualty.id);
  return records.sort((a,b)=>(b.assessmentRevision??0)-(a.assessmentRevision??0)||(b.assessment?.assessedAt??b.reportedAt??0)-(a.assessment?.assessedAt??a.reportedAt??0))[0]??null;
}

function assessmentFresh(record,casualty,now){
  const assessment=record?.assessment;if(!assessment)return false;
  const age=now-Number(assessment.assessedAt??record.reportedAt??0);
  if(age>12)return false;
  if(record?.approximatePosition&&distance(record.approximatePosition,casualty)>120)return false;
  const visible=casualty?.medical?.unconscious?"unconscious":casualty?.medical?.condition??null;
  if(visible&&assessment.condition&&visible!==assessment.condition&&!["critical","unconscious"].includes(visible)&&!["critical","unconscious"].includes(assessment.condition))return false;
  return true;
}

function treatmentUrgency(assessment){
  if(!assessment)return 0;
  const condition=assessment.condition;
  const conditionValue=assessment.dead?0:condition==="critical"?1:condition==="unconscious"?.9:condition==="serious"?.66:.38;
  const bleeding=clamp(Number(assessment.bleeding??0)*4);
  return clamp(conditionValue*.52+bleeding*.34+(assessment.immediateDanger?.18:0));
}

export class CasualtyRecoveryRuntime{
  constructor({brain=null,decisionLog=null,positionService=null}={}){
    this.brain=brain;this.decisionLog=decisionLog;
    this.positionService=positionService??new CasualtyRecoveryPositionService();
    this.byActor=new Map();
  }

  beginFrame(game){this.byActor.clear();for(const actor of game?.actors??[])actor.aiV2CasualtyRecovery=null;}

  evaluateAndSubmit({game,actor,role=null,procedure=null,mission=null,obligation=null,casualtyKnowledge=null,tacticalPictures=null,directionalCover=null,actorObligations=null,teamProcedures=null,now=0}={}){
    if(!actor||!obligation||obligation.concernKind!=="friendly_casualty"||obligation.responsibility!=="carrier_or_aid_provider")return null;
    const casualty=(game?.actors??[]).find(candidate=>candidate.id===obligation.subjectId)??null;
    if(!casualty||casualty.medical?.dead||actor.medical?.dead||actor.medical?.unconscious||actor.medical?.condition==="critical")return this.#project(actor,{obligation,casualty,selected:null,candidates:[],status:"unavailable",now});

    const plan=mission?.recoveryPlan??{};
    const interactionRange=Math.max(58,Number(plan.interactionRange)||92);
    const reportRange=Math.max(220,Number(plan.reportRange)||520);
    const separation=distance(actor,casualty);
    const picture=tacticalPictures?.get?.(actor.id)??null;
    const position=this.positionService.assess({game,actor,casualty,mission,tacticalPicture:picture,directionalCover,now});
    const knowledge=bestKnowledgeRecord(casualtyKnowledge,actor,casualty);
    const fresh=assessmentFresh(knowledge,casualty,now);
    const assessment=fresh?knowledge.assessment:null;
    const urgencyVisible=visibleUrgency(casualty);
    this.#bridgeProcedureFacts({teamProcedures,procedure,actor,casualty,separation,interactionRange,fresh,assessment,position,now});
    const provenance={
      owner:"casualty_recovery_runtime",source:"desired_effect_casualty_recovery",teamId:actor.teamId,
      concernId:obligation.concernId??null,obligationId:obligation.id,responsibility:obligation.responsibility,
      procedureId:procedure?.procedureId??null,roleId:role?.roleId??null
    };
    const common={
      obligationId:obligation.id,concernId:obligation.concernId??null,casualtyId:casualty.id,
      interactionRange,reportRange,desiredEffect:obligation.desiredEffect??"recover_friendly_casualty",provenance
    };
    const candidates=[];

    if(separation>interactionRange){
      const directive={
        ...common,
        reason:`Reach ${casualty.name??"the casualty"} because the durable recovery obligation still lacks physical patient access.`,
        policy:{speedMultiplier:plan.approachSpeedMultiplier??.8,arrivalRadius:10},
        initialDistance:separation
      };
      candidates.push({
        type:"ApproachCasualty",score:1.22+urgencyVisible*.18,urgency:clamp(.86+urgencyVisible*.2,0,1.18),
        reason:directive.reason,directive,action:new ApproachCasualtyAction({actorId:actor.id,directive})
      });
    }else{
      const severeExposure=Boolean(position?.betterGroundAvailable&&position.currentExposure>=.38);
      if(!fresh){
        const directive={...common,duration:Math.max(1.15,1.8-urgencyVisible*.35),reason:`Assess ${casualty.name??"the casualty"} because the recovery obligation lacks a fresh physical condition assessment.`};
        candidates.push({
          type:"AssessCasualty",score:1.06+urgencyVisible*.18,urgency:clamp(.78+urgencyVisible*.2,0,1.12),
          reason:directive.reason,directive,action:new AssessCasualtyAction({actorId:actor.id,directive})
        });
        if(severeExposure){
          const recovery=position.bestRecoveryPosition;
          const dragDirective={
            ...common,destination:point(recovery.point),recoveryPosition:point(recovery.point),
            initialDistance:recovery.dragDistance,reason:`Move ${casualty.name??"the casualty"} before assessment because current exposure is unacceptable and ${recovery.label} offers materially safer access.`,
            policy:{speedMultiplier:plan.dragSpeedMultiplier??.46,arrivalRadius:plan.arrivalRadius??13,claimSpacing:plan.claimSpacing??62},
            recoveryReason:position.reason
          };
          candidates.push({
            type:"DragCasualty",score:1.16+position.currentExposure*.35+recovery.protectionGain*.22,urgency:clamp(.9+position.currentExposure*.22,0,1.2),
            reason:dragDirective.reason,directive:dragDirective,action:new DragCasualtyAction({actorId:actor.id,directive:dragDirective})
          });
        }
      }else{
        const need=assessment?.treatmentNeed??null;
        const hasSupply=Boolean(need&&Number(actor.aiV2MedicalSupplies?.[need.type]??0)>0);
        const urgency=treatmentUrgency(assessment);
        const recovery=position?.bestRecoveryPosition??null;
        const assisted=assessment?.mobility==="requires_assisted_movement"||casualty.medical?.unconscious||["critical","unconscious"].includes(assessment?.condition);

        if(need&&hasSupply){
          const treatmentScore=1.02+urgency*.54+(position?.treatmentWindowScore??.5)*.14-(position?.currentExposure??0)*.18;
          const directive={
            ...common,treatmentType:need.type,duration:Math.max(1.6,2.8-urgency*.72),
            reason:`Treat ${casualty.name??"the casualty"} now because ${need.type.replaceAll("_"," ")} is still required and the current treatment window is ${position?.treatmentWindow??"acceptable"}.`
          };
          candidates.push({
            type:"TreatAssignedCasualty",score:treatmentScore,urgency:clamp(.88+urgency*.28,0,1.22),
            reason:directive.reason,directive,action:new TreatAssignedCasualtyAction({actorId:actor.id,directive})
          });
        }

        if(position?.betterGroundAvailable&&recovery&&assisted){
          const protectionGain=Math.max(0,recovery.protectionGain??0);
          const dragScore=.84+(position.currentExposure??0)*.58+protectionGain*.42-urgency*.14+(hasSupply?0:.08);
          const directive={
            ...common,destination:point(recovery.point),recoveryPosition:point(recovery.point),
            initialDistance:recovery.dragDistance,reason:`Move ${casualty.name??"the casualty"} to ${recovery.label} because it materially improves the recovery position before further care.`,
            policy:{speedMultiplier:plan.dragSpeedMultiplier??.46,arrivalRadius:plan.arrivalRadius??13,claimSpacing:plan.claimSpacing??62},
            recoveryReason:position.reason
          };
          candidates.push({
            type:"DragCasualty",score:dragScore,urgency:clamp(.78+(position.currentExposure??0)*.38,0,1.2),
            reason:directive.reason,directive,action:new DragCasualtyAction({actorId:actor.id,directive})
          });
        }

        if(!need&&position?.betterGroundAvailable&&recovery&&assisted){
          const directive={
            ...common,destination:point(recovery.point),recoveryPosition:point(recovery.point),initialDistance:recovery.dragDistance,
            reason:`The casualty has no immediate treatment need, but ${recovery.label} provides materially safer recovery ground.`,
            policy:{speedMultiplier:plan.dragSpeedMultiplier??.46,arrivalRadius:plan.arrivalRadius??13,claimSpacing:plan.claimSpacing??62},recoveryReason:position.reason
          };
          candidates.push({
            type:"DragCasualty",score:.72+(position.currentExposure??0)*.48+(recovery.protectionGain??0)*.32,urgency:clamp(.55+(position.currentExposure??0)*.34),
            reason:directive.reason,directive,action:new DragCasualtyAction({actorId:actor.id,directive})
          });
        }

        if(need&&!hasSupply&&!candidates.length){
          actorObligations?.markBlocked?.(obligation.id,{now,reason:`missing_${need.type}`});
        }
      }
    }

    candidates.sort((a,b)=>b.score-a.score||b.urgency-a.urgency||a.type.localeCompare(b.type));
    const selected=candidates[0]??null;
    const record=this.#project(actor,{obligation,casualty,selected,candidates,position,assessment,fresh,status:selected?"proposed":"stable",now});
    if(!selected)return record;

    this.brain?.submit?.({
      actorId:actor.id,action:selected.action,score:selected.score,urgency:selected.urgency,
      authorityTier:obligation.authorityTier,authorityLabel:"Desired-effect casualty recovery",
      reason:selected.reason,source:"casualty_recovery_runtime",
      concernId:obligation.concernId??null,obligationId:obligation.id,desiredEffect:obligation.desiredEffect??"recover_friendly_casualty",
      operationId:actor.operationId??null,missionId:obligation.missionId??actor.squadMission??null,roleId:obligation.responsibility
    });
    this.#record("casualty_recovery_method_proposed",actor,now,{obligationId:obligation.id,casualtyId:casualty.id,method:selected.type,score:selected.score,urgency:selected.urgency,treatmentWindow:position?.treatmentWindow??null});
    return record;
  }

  get(actorId){const record=this.byActor.get(actorId);return record?JSON.parse(JSON.stringify(record)):null;}
  summary(){return[...this.byActor.values()].map(record=>JSON.parse(JSON.stringify(record)));}

  #project(actor,{obligation,casualty,selected,candidates=[],position=null,assessment=null,fresh=false,status="idle",now=0}){
    const record={
      actorId:actor.id,obligationId:obligation?.id??null,casualtyId:casualty?.id??obligation?.subjectId??null,status,
      desiredEffect:obligation?.desiredEffect??"recover_friendly_casualty",
      selected:candidateRecord(selected),candidates:candidates.map(candidateRecord),
      assessmentFresh:Boolean(fresh),assessment:assessment?{...assessment,treatmentNeed:assessment.treatmentNeed?{...assessment.treatmentNeed}:null}:null,
      position:position?{
        treatmentWindow:position.treatmentWindow,treatmentWindowScore:position.treatmentWindowScore,
        currentProtection:position.currentProtection,currentExposure:position.currentExposure,betterGroundAvailable:position.betterGroundAvailable,
        bestRecoveryPosition:position.bestRecoveryPosition?{...position.bestRecoveryPosition,point:point(position.bestRecoveryPosition.point)}:null
      }:null,
      updatedAt:now
    };
    this.byActor.set(actor.id,record);actor.aiV2CasualtyRecovery=JSON.parse(JSON.stringify(record));return record;
  }

  #bridgeProcedureFacts({teamProcedures,procedure,actor,casualty,separation,interactionRange,fresh,assessment,position,now}){
    if(!teamProcedures?.notifyEvent||!procedure?.procedureId)return;
    const phase=procedure.phase?.id??null;
    if(phase==="reach_casualty"&&separation<=interactionRange){
      teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_reached",now,data:{actorId:actor.id,casualtyId:casualty.id,desiredEffectDriven:true}});
      return;
    }
    if(phase==="assess_condition"&&fresh){
      teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_assessed",now,data:{actorId:actor.id,casualtyId:casualty.id,condition:assessment?.condition??null,treatmentNeed:assessment?.treatmentNeed?.type??null,mobility:assessment?.mobility??null,desiredEffectDriven:true}});
      return;
    }
    const acceptableGround=Boolean(position&&!position.betterGroundAvailable&&(position.currentExposure<.3||position.treatmentWindowScore>=.44));
    if(phase==="move_to_recovery"&&acceptableGround){
      teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_moved_to_recovery",now,data:{actorId:actor.id,casualtyId:casualty.id,destination:{x:casualty.x,y:casualty.y},reason:"current_ground_already_satisfies_recovery_effect",desiredEffectDriven:true}});
      return;
    }
    if(phase==="stabilize"&&fresh&&!assessment?.treatmentNeed){
      teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_stabilized",now,data:{actorId:actor.id,casualtyId:casualty.id,condition:assessment?.condition??null,bleeding:assessment?.bleeding??null,desiredEffectDriven:true}});
    }
  }

  #record(type,actor,time,data){this.decisionLog?.record?.({type,time,actorId:actor.id,teamId:actor.teamId,data});}
}
