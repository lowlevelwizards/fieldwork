import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class CollectSupplyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"CollectSupply",actorId,purpose:directive?.reason??"Collect a finite cargo package",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:74,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,packagePoint:directive?.packagePoint?{...directive.packagePoint}:null};
    this.claimed=false;this.elapsed=0;this.initialDistance=Math.max(1,directive?.initialDistance??1);
  }
  canStart({game}={}){const actor=game?.actors?.find(item=>item.id===this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive.operationId&&this.directive.packageId);}
  canContinue({game,services}={}){
    const actor=game?.actors?.find(item=>item.id===this.actorId);const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.phase?.id==="collect_supplies");
  }
  start(now,{game}={}){
    super.start(now,{game});const actor=game.actors.find(item=>item.id===this.actorId);
    const item=game.livingSandbox?.claimCargo?.({operationId:this.directive.operationId,actorId:this.actorId,packageId:this.directive.packageId,now});
    this.claimed=Boolean(item);if(item)this.directive.packagePoint={x:item.x,y:item.y};
    if(actor){actor.currentAction=this.claimed?`Moving to ${this.directive.packageLabel??"cargo package"}`:"Cargo package unavailable";actor.aiV2CargoTask={status:this.claimed?"approaching":"blocked",packageId:this.directive.packageId,operationId:this.directive.operationId};}
  }
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(item=>item.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.claimed)return{status:"failed",reason:"cargo_claim_rejected"};
    const result=services.locomotion.moveToward(actor,this.directive.packagePoint,delta,{game,speedMultiplier:.68,arrivalRadius:22,task:`Recovering ${this.directive.packageLabel??"cargo"}`,pose:"walk"});
    if(result.failed){game.livingSandbox?.releaseCargoClaim?.({operationId:this.directive.operationId,actorId:actor.id,packageId:this.directive.packageId,now,reason:result.reason});return{status:"failed",reason:result.reason};}
    if(!result.arrived){this.progress=Math.max(0,Math.min(.75,.75*(1-(result.distance??this.initialDistance)/this.initialDistance)));return null;}
    services.locomotion.stop(actor);services.attention.turnToward(actor,this.directive.packagePoint,delta,{pose:"work",turnRate:4});this.elapsed+=delta;this.progress=.75+Math.min(.24,this.elapsed/.75*.24);actor.currentAction=`Securing ${this.directive.packageLabel??"cargo package"}`;
    if(this.elapsed<.75)return null;
    const item=game.livingSandbox?.pickupCargo?.({operationId:this.directive.operationId,actorId:actor.id,packageId:this.directive.packageId,now});
    if(!item)return{status:"failed",reason:"cargo_pickup_failed"};
    actor.aiV2Cargo??=[];actor.aiV2Cargo.push({...item});actor.backpackLoadRatio=Math.min(1,.3+actor.aiV2Cargo.reduce((sum,cargo)=>sum+(cargo.units??1)*.16,0));
    const status=game.livingSandbox.cargoStatus(this.directive.operationId);
    const objectiveState=status.atSite+status.dropped===0?this.directive.desiredState:(this.directive.workingState??"being_collected");
    services.objectives.setExternalProgress({objectiveId:this.directive.objectiveId,progress:status.total?Math.min(1,(status.carried+status.returned)/status.total):1,state:objectiveState,desiredState:status.atSite+status.dropped===0?this.directive.desiredState:null,teamId:actor.teamId,now,reason:"finite_cargo_collected"});
    if(status.atSite+status.dropped===0)services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"cargo_secured",now,data:{securedUnits:status.carried+status.returned,leftUnits:0,objectiveId:this.directive.objectiveId}});
    actor.currentAction=`Carrying ${actor.aiV2Cargo.reduce((sum,cargo)=>sum+(cargo.units??1),0)} supply units`;
    return{status:"completed",reason:"cargo_package_secured",data:{packageId:item.id,units:item.units}};
  }
  onInterrupted({game}={}){game?.livingSandbox?.releaseCargoClaim?.({operationId:this.directive.operationId,actorId:this.actorId,packageId:this.directive.packageId,reason:"interrupted"});}
  onCancelled({game}={}){this.onInterrupted({game});}
}
