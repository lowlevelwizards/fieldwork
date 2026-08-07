const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class CasualtyCareExecutor{
  constructor(){this.patientClaims=new Map();}

  claimPatient({patientId,actorId}={}){if(!patientId||!actorId)return{ok:false,reason:"missing_patient_or_actor"};const existing=this.patientClaims.get(patientId);if(existing&&existing!==actorId)return{ok:false,reason:"patient_already_controlled",actorId:existing};this.patientClaims.set(patientId,actorId);return{ok:true};}
  releasePatient(patientId,actorId){if(this.patientClaims.get(patientId)===actorId)this.patientClaims.delete(patientId);}
  getController(patientId){return this.patientClaims.get(patientId)??null;}
  assess(game,patient){return game?.wounds?.getAssessment?.(patient)??null;}

  dragToward({game,responder,patient,destination,delta,locomotion,speedMultiplier=.44,arrivalRadius=14,maximumAttachmentDistance=96,now=0}={}){
    if(!responder||!patient||!destination||!locomotion)return{failed:true,reason:"missing_drag_context",arrived:false};
    const attachmentDistance=Math.hypot(patient.x-responder.x,patient.y-responder.y);
    if(attachmentDistance>maximumAttachmentDistance)return{failed:true,reason:"patient_out_of_reach",arrived:false,distance:Math.hypot(destination.x-responder.x,destination.y-responder.y),attachmentDistance};
    const intent={
      kind:"casualty_drag",goal:{x:destination.x,y:destination.y},
      region:{type:"circle",center:{x:destination.x,y:destination.y},innerRadius:0,outerRadius:arrivalRadius,preferredRadius:0},
      acceptanceRadius:arrivalRadius,preferredSeparationMin:68,preferredSeparationMax:240,separationWeight:1.55,cohesion:true,
      threatPoint:responder.aiV2TacticalPicture?.threatPoint?{...responder.aiV2TacticalPicture.threatPoint}:null,dangerRadius:380,threatRepulsionWeight:1.8,
      lookAhead:76,allowRetreat:true
    };
    const movement=locomotion.moveWithIntent
      ?locomotion.moveWithIntent(responder,intent,delta,{game,now,speedMultiplier,arrivalRadius,task:`Recovering ${patient.name}`,pose:"walk"})
      :locomotion.moveToward(responder,destination,delta,{game,speedMultiplier,arrivalRadius,task:`Recovering ${patient.name}`,pose:"walk"});
    const speed=Math.hypot(responder.vx??0,responder.vy??0);const angle=speed>2?Math.atan2(responder.vy,responder.vx):(responder.lookAngle??Math.atan2(destination.y-responder.y,destination.x-responder.x));const trailerAngle=angle+Math.PI;
    const target={x:responder.x+Math.cos(trailerAngle)*48,y:responder.y+Math.sin(trailerAngle)*48+5};const blend=1-Math.exp(-Math.max(0,delta)*15);
    patient.x+=(target.x-patient.x)*blend;patient.y+=(target.y-patient.y)*blend;patient.groundY=patient.y+34;patient.vx=0;patient.vy=0;patient.moveTarget=null;patient.beingDragged=true;patient.operationPausedByEncounter=true;patient.workPose="dragged";patient.medicalPose="dragged";patient.dragHeadAnchor={x:responder.x+Math.cos(trailerAngle)*28,y:responder.y+Math.sin(trailerAngle)*28+5};patient.collapseAngle=trailerAngle;
    return movement;
  }

  releaseDrag({patient}={}){if(!patient)return;patient.beingDragged=false;patient.dragHeadAnchor=null;patient.vx=0;patient.vy=0;patient.workPose=patient.medical?.unconscious?"downed":patient.medical?.condition==="critical"?"crawl":null;patient.medicalPose=patient.medical?.unconscious?"unconscious":patient.medical?.condition??null;}

  stabilize({game,provider,patient}={}){
    if(!game?.wounds||!provider||!patient)return{ok:false,reason:"missing_care_context"};const need=game.wounds.getTreatmentNeed(patient);if(!need)return{ok:false,reason:"no_current_treatment_need"};provider.aiV2MedicalSupplies??={};const available=Number(provider.aiV2MedicalSupplies[need.type]??0);if(available<=0)return{ok:false,reason:`missing_${need.type}`};const result=game.wounds.applyTreatment(patient,need.type,{source:provider});if(!result.ok)return result;provider.aiV2MedicalSupplies[need.type]=clamp(available-1,0,99);return{...result,treatmentType:need.type,remaining:provider.aiV2MedicalSupplies[need.type]};
  }

  summary(){return[...this.patientClaims.entries()].map(([patientId,actorId])=>({patientId,actorId}));}
}
