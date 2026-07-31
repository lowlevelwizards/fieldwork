const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const TREATMENT_DURATION={
  bandage:2.5,
  pressure_dressing:4.2,
  tourniquet:3.1,
  painkillers:1.6
};

const DEFAULT_LOADOUTS={
  commune:{
    default:{bandage:2,pressure_dressing:1,tourniquet:0,painkillers:1},
    "Field Medic":{bandage:5,pressure_dressing:3,tourniquet:2,painkillers:2},
    "Shelter Worker":{bandage:3,pressure_dressing:1,tourniquet:0,painkillers:1}
  },
  northline:{
    default:{bandage:2,pressure_dressing:2,tourniquet:1,painkillers:1},
    Engineer:{bandage:2,pressure_dressing:2,tourniquet:1,painkillers:1},
    Security:{bandage:2,pressure_dressing:1,tourniquet:1,painkillers:1}
  },
  freelancers:{
    default:{bandage:1,pressure_dressing:1,tourniquet:1,painkillers:1},
    Recovery:{bandage:2,pressure_dressing:1,tourniquet:1,painkillers:1},
    Scout:{bandage:1,pressure_dressing:1,tourniquet:1,painkillers:1}
  }
};

function cloneLoadout(source){return Object.fromEntries(Object.entries(source).map(([key,value])=>[key,value]));}

export class MedicalSystem{
  constructor(game){
    this.game=game;
    this.playerAction=null;
    this.reservations=new Map();
  }

  ensureInventory(actor){
    if(actor.medicalInventory)return actor.medicalInventory;
    const faction=DEFAULT_LOADOUTS[actor.factionId]??DEFAULT_LOADOUTS.commune;
    const loadout=faction[actor.role]??faction.default;
    actor.medicalInventory=cloneLoadout(loadout);
    return actor.medicalInventory;
  }

  getCount(actor,itemType){
    return this.ensureInventory(actor)[itemType]??0;
  }

  consume(actor,itemType){
    const inventory=this.ensureInventory(actor);
    if((inventory[itemType]??0)<=0)return false;
    inventory[itemType]--;
    return true;
  }

  getSupplySummary(actor){
    const inventory=this.ensureInventory(actor);
    return Object.values(inventory).reduce((sum,value)=>sum+value,0);
  }

  hasSupply(actor,type){return this.getCount(actor,type)>0;}

  dangerLevel(actor){
    const suppression=(actor.suppression??0)/100;
    const activeTarget=this.game.aiCombat?.getTarget?.(actor);
    const targetDistance=activeTarget?distance(actor,activeTarget):Infinity;
    const proximity=targetDistance<260?.65:targetDistance<450?.35:0;
    return clamp(suppression+proximity,0,1);
  }

  findPatient(actor){
    const allies=this.game.actors.filter(candidate=>
      candidate.id!==actor.id &&
      candidate.factionId===actor.factionId &&
      candidate.operationId &&
      !candidate.medical?.dead &&
      this.game.wounds.getTreatmentNeed(candidate)
    );
    let best=null;
    for(const candidate of allies){
      const d=distance(actor,candidate);
      if(d>300)continue;
      const need=this.game.wounds.getTreatmentNeed(candidate);
      if(!need||!this.hasSupply(actor,need.type))continue;
      const reserved=this.reservations.get(candidate.id);
      if(reserved&&reserved!==actor.id)continue;
      const conditionScore={critical:130,unconscious:150,serious:85,wounded:45}[candidate.medical?.condition]??20;
      const roleBonus=actor.role==="Field Medic"?40:actor.role==="Medic"?40:0;
      const score=conditionScore+need.priority+roleBonus-d*.16;
      if(!best||score>best.score)best={patient:candidate,need,score,d};
    }
    return best;
  }

  chooseAction(actor){
    if(actor.medical?.dead||actor.medical?.unconscious)return null;
    const selfNeed=this.game.wounds.getTreatmentNeed(actor);
    const danger=this.dangerLevel(actor);
    const buddy=this.findPatient(actor);
    const isMedic=/medic/i.test(actor.role??"");

    if(buddy&&(isMedic||buddy.patient.medical.condition==="critical"||buddy.patient.medical.unconscious)){
      if(danger<.74||buddy.patient.medical.condition==="critical")return {patient:buddy.patient,need:buddy.need,self:false};
    }
    if(selfNeed&&this.hasSupply(actor,selfNeed.type)){
      if(danger<.58||["critical","serious"].includes(actor.medical.condition))return {patient:actor,need:selfNeed,self:true};
    }
    if(buddy&&danger<.42)return {patient:buddy.patient,need:buddy.need,self:false};
    return null;
  }

  startTreatment(actor,patient,need){
    if(!actor||!patient||!need||!this.hasSupply(actor,need.type))return false;
    if(patient.id!==actor.id)this.reservations.set(patient.id,actor.id);
    actor.medicalAction={
      patientId:patient.id,
      itemType:need.type,
      progress:0,
      duration:TREATMENT_DURATION[need.type]??3,
      startedAt:performance.now()/1000
    };
    actor.operationPausedByEncounter=true;
    actor.vx=0;actor.vy=0;
    actor.workPose="medical";
    actor.workProp="medical_bag";
    actor.currentAction=patient.id===actor.id?"Treating self":`Treating ${patient.name}`;
    actor.currentTask=actor.currentAction;
    return true;
  }

  cancelTreatment(actor,reason=null){
    const action=actor.medicalAction;
    if(!action)return;
    if(action.patientId!==actor.id)this.reservations.delete(action.patientId);
    actor.medicalAction=null;
    actor.workProp=null;
    if(reason)actor.currentTask=reason;
  }

  completeTreatment(actor){
    const action=actor.medicalAction;
    if(!action)return;
    const patient=action.patientId===this.game.operator.id
      ?this.game.operator
      :this.game.actors.find(candidate=>candidate.id===action.patientId);
    if(!patient||!this.consume(actor,action.itemType)){
      this.cancelTreatment(actor,"Medical supply unavailable");
      return;
    }
    const result=this.game.wounds.applyTreatment(patient,action.itemType,{source:actor});
    const patientName=patient.id===this.game.operator.id?"Mara":patient.name;
    if(result.ok)this.game.pushMessage(`${actor.name}: ${result.label} for ${patientName}`,2.1);
    this.cancelTreatment(actor);
    actor.workPose="kneel";
    actor.currentTask=result.ok?"Treatment complete":"Treatment failed";
  }

  updateActor(actor,delta){
    this.ensureInventory(actor);
    if(actor.medical?.dead||actor.medical?.unconscious){
      this.cancelTreatment(actor);
      return;
    }

    if(actor.medicalAction){
      const action=actor.medicalAction;
      const patient=action.patientId===this.game.operator.id
        ?this.game.operator
        :this.game.actors.find(candidate=>candidate.id===action.patientId);
      if(!patient||patient.medical?.dead){
        this.cancelTreatment(actor,"Casualty lost");
        return;
      }

      const danger=this.dangerLevel(actor);
      if(danger>.88&&patient.medical?.condition!=="critical"){
        this.cancelTreatment(actor,"Treatment interrupted by fire");
        actor.suppression=clamp((actor.suppression??0)+8,0,100);
        return;
      }

      const d=distance(actor,patient);
      if(patient.id!==actor.id&&d>52){
        const angle=Math.atan2(patient.y-actor.y,patient.x-actor.x);
        actor.x+=Math.cos(angle)*actor.moveSpeed*.3*delta;
        actor.y+=Math.sin(angle)*actor.moveSpeed*.3*delta;
        actor.groundY=actor.y+actor.radius;
        actor.currentTask=`Moving to ${patient.name}`;
        actor.workPose="walk";
        return;
      }

      actor.vx=0;actor.vy=0;
      actor.workPose="medical";
      actor.workProp="medical_bag";
      action.progress=clamp(action.progress+delta/action.duration,0,1);
      if(action.progress>=1)this.completeTreatment(actor);
      return;
    }

    actor.medicalDecisionCooldown=Math.max(0,(actor.medicalDecisionCooldown??0)-delta);
    if(actor.medicalDecisionCooldown>0)return;
    actor.medicalDecisionCooldown=.7+Math.random()*.7;
    const choice=this.chooseAction(actor);
    if(choice)this.startTreatment(actor,choice.patient,choice.need);
  }

  getPlayerSupply(type){
    return this.game.inventory.getItems().find(item=>item.definitionId===type&&item.condition!=="wet")??null;
  }

  getPlayerAction(){
    if(this.playerAction)return {label:"Treating…",disabled:true};
    const need=this.game.wounds.getTreatmentNeed(this.game.operator);
    if(!need)return null;
    const item=this.getPlayerSupply(need.type);
    if(!item)return null;
    return {label:need.label,type:need.type,itemId:item.id};
  }

  startPlayerTreatment(){
    const action=this.getPlayerAction();
    if(!action||action.disabled)return false;
    this.game.combat.toggleAim(false);
    this.playerAction={
      itemType:action.type,
      itemId:action.itemId,
      progress:0,
      duration:TREATMENT_DURATION[action.type]??3
    };
    this.game.operator.lockedByInteraction=true;
    this.game.operator.workPose="medical";
    this.game.operator.searchPose=1;
    this.game.pushMessage(action.label,1.2);
    return true;
  }

  updatePlayer(delta){
    if(!this.playerAction)return;
    const action=this.playerAction;
    if((this.game.combat.suppression??0)>82){
      this.game.pushMessage("Treatment interrupted",1.3);
      this.playerAction=null;
      this.game.operator.lockedByInteraction=false;
      this.game.operator.workPose=null;
      this.game.operator.searchPose=0;
      return;
    }
    action.progress=clamp(action.progress+delta/action.duration,0,1);
    if(action.progress<1)return;

    const item=this.game.entities.find(entity=>entity.id===action.itemId);
    const index=this.game.backpack.itemInstanceIds.indexOf(action.itemId);
    if(index>=0)this.game.backpack.itemInstanceIds.splice(index,1);
    const entityIndex=this.game.entities.findIndex(entity=>entity.id===action.itemId);
    if(entityIndex>=0)this.game.entities.splice(entityIndex,1);
    const result=this.game.wounds.applyTreatment(this.game.operator,action.itemType,{source:this.game.operator});
    if(result.ok)this.game.pushMessage(result.label,1.8);
    this.playerAction=null;
    this.game.operator.lockedByInteraction=false;
    this.game.operator.workPose=null;
    this.game.operator.searchPose=0;
  }

  update(delta){
    this.updatePlayer(delta);
    for(const actor of this.game.actors){
      if(actor.operationId&&actor.factionId)this.updateActor(actor,delta);
    }
  }
}
