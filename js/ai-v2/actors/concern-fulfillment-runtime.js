import { MoveWithinIntentFieldAction } from "../actions/move-within-intent-field-action.js";
import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export class ConcernFulfillmentRuntime{
  constructor({brain,spatialIntentFields,decisionLog=null}={}){this.brain=brain;this.spatialIntentFields=spatialIntentFields;this.decisionLog=decisionLog;this.byActor=new Map();}

  update({game,teamConcerns,concernStaffing,actorObligations=null,teamProcedures,now=0}={}){
    this.byActor.clear();
    const directEnabled=game?.scenarioMode==="live"&&Boolean(game?.livingSandbox?.liveMode);
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious||actor.medical?.condition==="critical")continue;
      const assignments=concernStaffing?.getActorAssignments?.(actor.id)??[];
      const entries=[];
      for(const assignment of assignments){
        const concern=teamConcerns?.get?.(actor.teamId,assignment.concernId);if(!concern||concern.status!=="active")continue;
        const intent=this.spatialIntentFields?.build?.({actor,assignment,concern,game,now});if(!intent)continue;
        const obligation=actorObligations?.findForActor?.(actor.id,{sourceAssignmentId:assignment.id})??null;
        const satisfied=this.spatialIntentFields.isSatisfied(actor,intent);
        const proceduralRole=teamProcedures?.getActorRole?.(actor.id)??null;
        const activeProcedure=teamProcedures?.get?.(actor.teamId)??null;
        const proceduralInteraction=Boolean(proceduralRole&&activeProcedure?.subjectId&&activeProcedure.subjectId===concern.subjectId);
        const score=clamp((Number(concern.importance)||0)*.65+(Number(concern.urgency)||0)*.35+(assignment.required?.12:0),0,1.35);
        const urgency=clamp((Number(concern.urgency)||0)+(assignment.required?.08:0));
        const desiredEffectOwnedElsewhere=Boolean(directEnabled&&concern.kind==="friendly_casualty"&&assignment.responsibility==="carrier_or_aid_provider");
        const record={assignmentId:assignment.id,obligationId:obligation?.id??null,concernId:concern.id,responsibility:assignment.responsibility,satisfied,intent,proceduralInteraction:Boolean(proceduralInteraction),desiredEffectOwnedElsewhere};
        entries.push(record);

        // 3.2E: carrier/aid-provider execution is no longer a generic concern
        // fulfillment special case. The durable obligation is fulfilled by the
        // casualty-recovery method selector in RoleActionRuntime's live path.
        if(desiredEffectOwnedElsewhere)continue;

        const directSecondarySecurity=["hostile_contact","uncertain_contact","friendly_casualty"].includes(concern.kind)&&String(assignment.responsibility).includes("security");
        if(!directEnabled||!directSecondarySecurity||proceduralInteraction)continue;

        if(!satisfied){
          const directive={assignmentId:assignment.id,concernId:concern.id,responsibility:assignment.responsibility,intent,reason:intent.reason,utilityScore:score,provenance:{owner:"concern_fulfillment_runtime",source:"concurrent_concern_staffing",teamId:actor.teamId,concernId:concern.id,assignmentId:assignment.id,responsibility:assignment.responsibility}};
          const action=new MoveWithinIntentFieldAction({actorId:actor.id,directive});
          this.brain?.submit?.({actorId:actor.id,action,score:Math.max(score,obligation?.priority??0),urgency:Math.max(urgency,obligation?.urgency??0),authorityTier:obligation?.authorityTier??ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN,authorityLabel:obligation?.authorityTier>=ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE?"Persistent actor obligation":"Staffed concurrent concern",reason:directive.reason,source:"concern_fulfillment_runtime",concernId:concern.id,obligationId:obligation?.id??null,desiredEffect:concern.desiredEffect,operationId:actor.operationId??null,missionId:concern.missionId??actor.squadMission??null,roleId:assignment.responsibility,onRejected:reason=>{if(obligation?.id)actorObligations?.markBlocked?.(obligation.id,{now,reason});}});
          continue;
        }
        if(!intent.focus)continue;
        const directive={focus:{...intent.focus},label:intent.label,task:concern.label,roleLabel:String(assignment.responsibility).replaceAll("_"," "),reason:`Maintain a valid ${String(assignment.responsibility).replaceAll("_"," ")} position while ${concern.label??concern.kind} remains active.`,provenance:{owner:"concern_fulfillment_runtime",source:"staffed_concern_hold",teamId:actor.teamId,concernId:concern.id,assignmentId:assignment.id,responsibility:assignment.responsibility}};
        const action=new HoldReadyAction({actorId:actor.id,directive});
        this.brain?.submit?.({actorId:actor.id,action,score:Math.max(.28,score-.12,obligation?.priority??0),urgency:Math.max(.18,urgency-.15,obligation?.urgency??0),authorityTier:obligation?.authorityTier??ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN,authorityLabel:obligation?.authorityTier>=ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE?"Persistent actor obligation":"Staffed concurrent concern",reason:directive.reason,source:"concern_fulfillment_runtime",concernId:concern.id,obligationId:obligation?.id??null,desiredEffect:concern.desiredEffect,operationId:actor.operationId??null,missionId:concern.missionId??actor.squadMission??null,roleId:assignment.responsibility,onRejected:reason=>{if(obligation?.id)actorObligations?.markBlocked?.(obligation.id,{now,reason});}});
      }
      if(entries.length)this.byActor.set(actor.id,entries);
    }
  }

  get(actorId){return(this.byActor.get(actorId)??[]).map(item=>({...item,intent:{...item.intent,goal:item.intent.goal?{...item.intent.goal}:null,focus:item.intent.focus?{...item.intent.focus}:null,region:item.intent.region?{...item.intent.region,center:{...item.intent.region.center}}:null}}));}
  summary(){return[...this.byActor.entries()].flatMap(([actorId,entries])=>entries.map(item=>({actorId,assignmentId:item.assignmentId,obligationId:item.obligationId??null,concernId:item.concernId,responsibility:item.responsibility,satisfied:item.satisfied,proceduralInteraction:item.proceduralInteraction,desiredEffectOwnedElsewhere:item.desiredEffectOwnedElsewhere,intentId:item.intent.id,regionType:item.intent.region?.type??null})));
  }
}
