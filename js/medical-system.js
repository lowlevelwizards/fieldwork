import { createIntent, INTENT_PRIORITY } from "./actor-intent.js?v=12h-reactive-fire-momentum-medical-recovery-20260801";
import { canTreatSelf, canDrag, isCombatCapable } from "./actor-state.js?v=12h-reactive-fire-momentum-medical-recovery-20260801";
import { moveActorToward, trailActorToward, stopActor, isImmobileCasualty } from "./actor-motion.js?v=12h-reactive-fire-momentum-medical-recovery-20260801";
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const TREATMENT_DURATION={
  bandage:2.5,
  pressure_dressing:4.2,
  tourniquet:3.1,
  painkillers:1.6,
  iv_fluids:6.2
};

const DEFAULT_LOADOUTS={
  commune:{
    default:{bandage:2,pressure_dressing:1,tourniquet:0,painkillers:1,iv_fluids:0},
    "Field Medic":{bandage:5,pressure_dressing:3,tourniquet:2,painkillers:2,iv_fluids:2},
    "Shelter Worker":{bandage:3,pressure_dressing:1,tourniquet:0,painkillers:1,iv_fluids:1}
  },
  northline:{
    default:{bandage:2,pressure_dressing:2,tourniquet:1,painkillers:1,iv_fluids:0},
    Engineer:{bandage:2,pressure_dressing:2,tourniquet:1,painkillers:1,iv_fluids:1},
    Security:{bandage:2,pressure_dressing:1,tourniquet:1,painkillers:1,iv_fluids:0}
  },
  freelancers:{
    default:{bandage:1,pressure_dressing:1,tourniquet:1,painkillers:1,iv_fluids:0},
    Recovery:{bandage:2,pressure_dressing:1,tourniquet:1,painkillers:1,iv_fluids:1},
    Scout:{bandage:1,pressure_dressing:1,tourniquet:1,painkillers:1,iv_fluids:0}
  }
};

function cloneLoadout(source){return Object.fromEntries(Object.entries(source).map(([key,value])=>[key,value]));}

export class MedicalSystem{
  constructor(game){
    this.game=game;
    this.playerAction=null;
    this.playerDraggingId=null;
    this.playerSelectedPatientId=null;
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

  dangerLevel(actor,position=actor){
    const suppression=(actor.suppression??0)/100;
    let nearest=Infinity;
    let hostileCount=0;
    for(const enemy of this.game.actors){
      if(enemy.factionId===actor.factionId||enemy.medical?.dead||enemy.medical?.unconscious)continue;
      const d=distance(position,enemy);
      nearest=Math.min(nearest,d);
      if(d<520)hostileCount++;
    }
    const proximity=nearest<220?.8:nearest<360?.55:nearest<520?.28:0;
    const recentFire=(performance.now()/1000-(actor.lastIncomingFireAt??-999))<4?.35:0;
    return clamp(suppression+proximity+Math.min(.25,hostileCount*.06)+recentFire,0,1);
  }

  treatmentWindow(actor,patient=actor){
    const now=performance.now()/1000;
    const actorFireAge=now-(actor.lastIncomingFireAt??-999);
    const patientFireAge=now-(patient.lastIncomingFireAt??-999);
    const actorProtected=["hard","soft"].includes(actor.coverState);
    const patientProtected=["hard","soft"].includes(patient.coverState);
    const coverBonus=actor.coverState==="hard"?28:actor.coverState==="soft"?19:actor.coverState==="concealment"?5:0;
    const patientCover=patient.coverState==="hard"?22:patient.coverState==="soft"?14:0;
    const lullBonus=Math.min(actorFireAge,patientFireAge)>7?24:Math.min(actorFireAge,patientFireAge)>4?9:0;
    const lowSuppression=(actor.suppression??0)<22?12:0;
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    const engaged=context?.alertState==="engaged";
    const rearPosition=actor.combatPosture==="regroup"||actor.combatPosture==="hold_protected";
    const safeCover=actorProtected&&(patient===actor||patientProtected||distance(actor,patient)<55);
    const safe=!engaged
      ?Math.min(actorFireAge,patientFireAge)>3&&(actor.suppression??0)<48
      :safeCover&&Math.min(actorFireAge,patientFireAge)>3.5&&(actor.suppression??0)<38;
    return {
      score:coverBonus+patientCover+lullBonus+lowSuppression+(rearPosition?10:0)+(engaged?0:14),
      safe,
      actorProtected,
      patientProtected,
      engaged
    };
  }

  canTreatHere(actor,patient,need,{allowEmergency=true}={}){
    const window=this.treatmentWindow(actor,patient);
    if(window.safe)return true;
    if(need?.type==="iv_fluids")return false;
    if(!allowEmergency)return false;
    const condition=patient.medical?.condition;
    const immediate=["critical","unconscious"].includes(condition)&&
      (patient.medical?.bleedingRate??0)>1.15&&
      this.dangerLevel(actor,patient)<.55;
    return immediate;
  }

  casualtyNeedsRelocation(patient){
    if(!patient||patient.medical?.dead)return false;
    const urgent=["critical","unconscious"].includes(patient.medical?.condition);
    return urgent&&!["hard","soft"].includes(patient.coverState);
  }

  findPatient(actor){
    const candidates=this.game.actors.filter(candidate=>
      candidate.id!==actor.id &&
      candidate.factionId===actor.factionId &&
      candidate.operationId &&
      !candidate.medical?.dead &&
      this.game.wounds.getTreatmentNeed(candidate)
    );

    // Commune crews regard Mara as an allied casualty and use their own
    // supplies to stabilize her when she goes down.
    if(actor.factionId==="commune"){
      const operator=this.game.operator;
      const operatorNeed=this.game.wounds.getTreatmentNeed(operator);
      if(operatorNeed&&!operator.medical?.dead)candidates.push(operator);
    }

    let best=null;
    for(const candidate of candidates){
      const d=distance(actor,candidate);
      if(d>420)continue;
      const need=this.game.wounds.getTreatmentNeed(candidate);
      if(!need||!this.hasSupply(actor,need.type))continue;
      const reserved=this.reservations.get(candidate.id);
      if(reserved&&reserved!==actor.id)continue;
      const conditionScore={critical:145,unconscious:175,serious:90,wounded:45}[candidate.medical?.condition]??20;
      const playerBonus=candidate.id===this.game.operator.id?35:0;
      const roleBonus=/medic|shelter worker/i.test(actor.role??"")?45:0;
      const score=conditionScore+need.priority+roleBonus+playerBonus-d*.12;
      if(!best||score>best.score)best={patient:candidate,need,score,d};
    }
    return best;
  }

  chooseAction(actor){
    if(actor.medical?.dead||actor.medical?.unconscious||actor.actionLock)return null;
    if(Math.hypot(actor.vx??0,actor.vy??0)>7)return null;

    const selfNeed=this.game.wounds.getTreatmentNeed(actor);
    const buddy=this.findPatient(actor);
    const danger=this.dangerLevel(actor);
    const isMedic=/medic|shelter worker/i.test(actor.role??"");
    const team=this.game.actors.filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
    const capable=team.filter(isCombatCapable);
    const lastCapable=capable.length<=1;
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    const currentlyEngaged=context?.alertState==="engaged";
    const plan=actor.tacticalPlan??"hold";

    let best=null;
    const consider=(choice,score)=>{
      if(!choice||score<54)return;
      if(!best||score>best.score)best={...choice,score};
    };

    if(selfNeed&&canTreatSelf(actor)&&this.hasSupply(actor,selfNeed.type)){
      const condition=actor.medical?.condition;
      const window=this.treatmentWindow(actor,actor);
      actor.needsMedicalCover=!window.safe&&["wounded","serious"].includes(condition);
      if(window.safe||this.canTreatHere(actor,actor,selfNeed)){
        const urgency={wounded:38,serious:76}[condition]??14;
        const combatCost=currentlyEngaged&&!window.safe?42:0;
        const score=urgency+window.score+(isMedic?4:0)-danger*54-combatCost;
        consider({patient:actor,need:selfNeed,self:true},score);
      }
    }else actor.needsMedicalCover=false;

    if(buddy){
      const patient=buddy.patient;
      const condition=patient.medical?.condition;
      const patientDanger=this.dangerLevel(actor,patient);
      const window=this.treatmentWindow(actor,patient);
      const urgent=["critical","unconscious"].includes(condition);
      const shouldRescue=urgent&&this.casualtyNeedsRelocation(patient)&&canDrag(actor);
      if(shouldRescue){
        const rescueScore=220+(isMedic?16:0)-buddy.d*.06-patientDanger*20-(lastCapable?38:0);
        consider({patient,need:buddy.need,self:false,rescue:true},rescueScore);
      }
      if(!shouldRescue&&(window.safe||this.canTreatHere(actor,patient,buddy.need))){
        const urgency={wounded:34,serious:74,critical:100,unconscious:106}[condition]??22;
        const roleBonus=isMedic?26:patient.id===this.game.operator.id?14:0;
        const combatCost=lastCapable?58:currentlyEngaged&&!window.safe?42:0;
        const planCost=["withdraw","push"].includes(plan)?18:0;
        const distanceCost=Math.min(30,buddy.d*.075);
        const preventiveBonus=["wounded","serious"].includes(condition)&&window.safe?24:0;
        const score=urgency+roleBonus+window.score+preventiveBonus-patientDanger*58-combatCost-planCost-distanceCost;
        consider({patient,need:buddy.need,self:false},score);
      }
    }

    return best?{patient:best.patient,need:best.need,self:best.self,rescue:best.rescue??false}:null;
  }

  startTreatment(actor,patient,need){
    if(!actor||!patient||!need||!this.hasSupply(actor,need.type))return false;
    if(!this.canTreatHere(actor,patient,need)){
      actor.needsMedicalCover=true;
      actor.currentTask=patient===actor?"Seeking cover before self aid":`Moving ${patient.name} to safety before treatment`;
      return false;
    }
    if(patient.id!==actor.id)this.reservations.set(patient.id,actor.id);
    actor.medicalAction={
      patientId:patient.id,
      itemType:need.type,
      phase:patient.id===actor.id?"prepare":"approach",
      phaseProgress:0,
      progress:0,
      duration:TREATMENT_DURATION[need.type]??3,
      startedAt:performance.now()/1000
    };
    actor.operationPausedByEncounter=true;
    this.game.actorIntents?.cancel?.(actor);
    actor.actionLock=null;
    actor.workPose=patient.id===actor.id?"kneel":"walk";
    actor.workProp=null;
    actor.workMedicalItem=null;
    actor.currentAction=patient.id===actor.id?"Preparing self aid":`Responding to ${patient.name}`;
    actor.currentTask=actor.currentAction;
    return true;
  }

  cancelTreatment(actor,reason=null){
    const action=actor.medicalAction;
    if(!action)return;
    if(action.patientId!==actor.id)this.reservations.delete(action.patientId);
    actor.medicalAction=null;
    actor.workProp=null;
    actor.workMedicalItem=null;
    actor.actionLock=null;
    this.game.actorIntents?.cancel?.(actor);
    if(["medical","kneel"].includes(actor.workPose))actor.workPose=null;
    if(reason)actor.currentTask=reason;
  }

  beginRescueDrag(actor,patient){
    if(!actor||!patient||patient.medical?.dead||!canDrag(actor))return false;
    const context=this.game.teamCombatContexts?.forActor?.(actor);
    const threat=context?.primaryThreatPosition??actor.tacticalEnemyCenter??this.game.aiCombat?.getTarget?.(actor)??patient;
    const coverNode=this.game.coverNetwork?.bestCasualtyCover?.(actor,patient,threat,{context,reserveSeconds:36})??null;
    const cover=coverNode?.protectedPosition??actor.tacticalRallyPoint??this.game.encounters?.findCover?.(actor,threat);
    if(!cover)return false;
    this.reservations.set(patient.id,actor.id);
    actor.rescueDrag={
      patientId:patient.id,
      destination:{x:cover.x,y:cover.y},
      coverNode,
      phase:"attach"
    };
    patient.beingDragged=true;
    patient.operationPausedByEncounter=true;
    patient.moveTarget=null;
    actor.operationPausedByEncounter=true;
    this.game.actorIntents?.cancel?.(actor);
    actor.draggingCasualtyId=patient.id;
    actor.actionLock={owner:"rescue_drag",allowsMovement:true,allowsCombat:false};
    actor.workPose="walk";
    actor.currentTask=`Extracting ${patient.id===this.game.operator.id?"Mara":patient.name} to cover`;
    return true;
  }

  stopRescueDrag(actor){
    const rescue=actor.rescueDrag;
    if(!rescue)return;
    const patient=rescue.patientId===this.game.operator.id
      ?this.game.operator
      :this.game.actors.find(candidate=>candidate.id===rescue.patientId);
    if(patient){
      patient.beingDragged=false;
      patient.dragHeadAnchor=null;
      if(patient.id===this.game.operator.id)patient.lockedByInteraction=false;
    }
    this.reservations.delete(rescue.patientId);
    actor.rescueDrag=null;
    actor.draggingCasualtyId=null;
    actor.actionLock=null;
    actor.workPose=null;
    actor.currentTask="Casualty moved to cover";
    if(rescue.coverNode){
      actor.assignedCoverNode=rescue.coverNode;
      if(patient)patient.casualtyCoverPosition={...rescue.coverNode.protectedPosition};
    }
  }

  updateRescueDrag(actor,delta){
    const rescue=actor.rescueDrag;
    if(!rescue)return false;
    const patient=rescue.patientId===this.game.operator.id
      ?this.game.operator
      :this.game.actors.find(candidate=>candidate.id===rescue.patientId);
    if(!patient||patient.medical?.dead){
      this.stopRescueDrag(actor);
      return false;
    }

    const patientDistance=distance(actor,patient);
    if(rescue.phase==="attach"&&patientDistance>42){
      moveActorToward(actor,patient,delta,{
        game:this.game,speedMultiplier:1.65,arrivalRadius:38,
        task:`Running to ${patient.id===this.game.operator.id?"Mara":patient.name}`,pose:"walk"
      });
      actor.locomotionMode="run";
      return true;
    }
    rescue.phase="tow";
    patient.beingDragged=true;
    if(patient.id===this.game.operator.id)patient.lockedByInteraction=true;

    const arrived=moveActorToward(actor,rescue.destination,delta,{
      game:this.game,speedMultiplier:1.25,arrivalRadius:22,
      task:"Dragging casualty to cover",pose:"walk"
    });
    actor.locomotionMode="run";

    const travelAngle=Math.atan2(actor.vy||rescue.destination.y-actor.y,actor.vx||rescue.destination.x-actor.x);
    const trailerAngle=travelAngle+Math.PI;
    const bodyCenter={
      x:actor.x+Math.cos(trailerAngle)*54,
      y:actor.y+Math.sin(trailerAngle)*54+5
    };
    trailActorToward(patient,bodyCenter,delta,{
      maximumSpeed:Math.max(170,(actor.moveSpeed??80)*1.8),
      arrivalRadius:2,pose:"dragged"
    });
    const angleDiff=Math.atan2(
      Math.sin(trailerAngle-(patient.collapseAngle??trailerAngle)),
      Math.cos(trailerAngle-(patient.collapseAngle??trailerAngle))
    );
    patient.collapseAngle=(patient.collapseAngle??trailerAngle)+angleDiff*(1-Math.exp(-delta*12));

    if(arrived){
      this.stopRescueDrag(actor);
      actor.medicalDecisionCooldown=.15;
      return false;
    }
    return true;
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
    const stillCasualty=patient.medical?.unconscious||patient.medical?.condition==="critical";
    const exposed=this.dangerLevel(actor)>.38;
    if(result.ok&&patient.id!==actor.id&&stillCasualty&&exposed){
      this.beginRescueDrag(actor,patient);
    }
  }

  updateActor(actor,delta){
    this.ensureInventory(actor);
    if(actor.medical?.dead||actor.medical?.unconscious){
      this.cancelTreatment(actor);
      this.stopRescueDrag(actor);
      return;
    }

    if(actor.rescueDrag){
      this.updateRescueDrag(actor,delta);
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
      const window=this.treatmentWindow(actor,patient);
      const emergency=["critical","unconscious"].includes(patient.medical?.condition)&&(patient.medical?.bleedingRate??0)>1.15;
      if((danger>.82||!window.safe)&&!emergency){
        this.cancelTreatment(actor,"Treatment interrupted — move to cover");
        actor.needsMedicalCover=true;
        actor.suppression=clamp((actor.suppression??0)+8,0,100);
        return;
      }

      if(action.phase==="approach"){
        const d=distance(actor,patient);
        if(d>48){
          const urgent=["critical","unconscious"].includes(patient.medical?.condition);
          this.game.actorIntents?.submit?.(actor,createIntent("medical","medical_approach",INTENT_PRIORITY.TREAT,{
            key:`medical:approach:${patient.id}`,
            targetId:patient.id,
            destination:{x:patient.x,y:patient.y},
            refreshDestination:true,
            speedMultiplier:urgent?1.35:.9,
            arrivalRadius:48,
            commitSeconds:4.5,
            interruptMargin:11,
            task:`${urgent?"Running":"Moving"} to ${patient.id===this.game.operator.id?"Mara":patient.name}`,
            pose:"walk"
          }));
          actor.locomotionMode=urgent?"run":"jog";
          actor.workProp=null;
          actor.workMedicalItem=null;
          return;
        }
        action.phase="prepare";
        action.phaseProgress=0;
      }

      if(action.phase==="prepare"){
        this.game.actorIntents?.cancel?.(actor);
        actor.actionLock={owner:"medical",phase:"prepare",allowsMovement:false,allowsCombat:false};
        actor.vx=0;actor.vy=0;
        actor.locomotionMode="idle";
        actor.workPose="kneel";
        actor.workProp=null;
        actor.workMedicalItem=null;
        actor.currentTask=`Preparing ${action.itemType.replaceAll("_"," ")}`;
        action.phaseProgress+=delta/.48;
        if(action.phaseProgress>=1){
          action.phase="treat";
          action.phaseProgress=0;
        }
        return;
      }

      this.game.actorIntents?.cancel?.(actor);
      actor.actionLock={owner:"medical",phase:"treat",allowsMovement:false,allowsCombat:false};
      actor.vx=0;actor.vy=0;
      actor.moveTarget=null;
      actor.locomotionMode="idle";
      actor.workPose="medical";
      actor.workProp="medical_bag";
      actor.workMedicalItem=action.itemType;
      actor.currentTask=patient.id===actor.id?"Treating self":`Treating ${patient.name}`;
      action.progress=clamp(action.progress+delta/action.duration,0,1);
      if(action.progress>=1)this.completeTreatment(actor);
      return;
    }

    actor.medicalDecisionCooldown=Math.max(0,(actor.medicalDecisionCooldown??0)-delta);
    if(actor.medicalDecisionCooldown>0)return;
    actor.medicalDecisionCooldown=2.4+Math.random()*2.2;
    const choice=this.chooseAction(actor);
    if(choice){
      if(choice.rescue)this.beginRescueDrag(actor,choice.patient);
      else this.startTreatment(actor,choice.patient,choice.need);
    }
  }

  getPlayerSupply(type){
    const held=this.game.getHeldItem?.();
    if(held?.definitionId===type&&held.condition!=="wet")return held;
    return this.game.inventory.getItems().find(item=>item.definitionId===type&&item.condition!=="wet")??null;
  }

  getPlayerSupplyCount(type){
    const held=this.game.getHeldItem?.();
    const heldCount=held?.definitionId===type&&held.condition!=="wet"?1:0;
    return heldCount+this.game.inventory.getItems().filter(item=>item.definitionId===type&&item.condition!=="wet").length;
  }

  consumePlayerSupply(itemId){
    const item=this.game.entities.find(entity=>entity.id===itemId);
    if(!item)return false;
    if(this.game.operator.carriedItemInstanceId===itemId){
      this.game.operator.carriedItemInstanceId=null;
    }
    const index=this.game.backpack.itemInstanceIds.indexOf(itemId);
    if(index>=0)this.game.backpack.itemInstanceIds.splice(index,1);
    const entityIndex=this.game.entities.findIndex(entity=>entity.id===itemId);
    if(entityIndex>=0)this.game.entities.splice(entityIndex,1);
    return true;
  }

  getNearbyPatient(){
    const operator=this.game.operator;
    let best=null;
    for(const actor of this.game.actors){
      if(actor.medical?.dead&&distance(operator,actor)>105)continue;
      const d=distance(operator,actor);
      if(d>108)continue;
      const assessment=this.game.wounds.getAssessment(actor);
      if(!assessment.active.length&&!assessment.dead&&!assessment.conscious)continue;
      const score=(assessment.dead?15:assessment.condition==="unconscious"?120:assessment.condition==="critical"?105:assessment.condition==="serious"?70:35)-d*.15;
      if(!best||score>best.score)best={actor,assessment,d,score};
    }
    return best;
  }

  getTreatmentActionFor(patient){
    if(!patient||patient.medical?.dead)return null;
    const need=this.game.wounds.getTreatmentNeed(patient);
    if(!need)return null;
    const item=this.getPlayerSupply(need.type);
    if(!item)return {
      label:`NEEDS ${need.type.replaceAll("_"," ").toUpperCase()}`,
      disabled:true,
      patientId:patient.id,
      type:need.type
    };
    const count=this.getPlayerSupplyCount(need.type);
    return {
      label:`${need.label} · ${count}`,
      type:need.type,itemId:item.id,patientId:patient.id,
      patientName:patient.id===this.game.operator.id?"SELF":patient.name
    };
  }

  getPlayerAction(){
    if(this.playerDraggingId)return {label:"DROP CASUALTY",type:"drop_casualty"};
    if(this.playerAction)return {label:"Treating…",disabled:true};

    const operator=this.game.operator;
    const nearby=this.getNearbyPatient();
    if(!canDrag(operator)&&nearby){
      return {label:`ASSESS ${nearby.actor.name}`.toUpperCase(),type:"assess",patientId:nearby.actor.id};
    }
    if(nearby){
      const treatment=this.getTreatmentActionFor(nearby.actor);
      if(treatment&&!treatment.disabled)return treatment;
      if(nearby.assessment.dead||nearby.assessment.condition==="unconscious"||nearby.assessment.condition==="critical"){
        return {label:`DRAG ${nearby.actor.name}`.toUpperCase(),type:"drag",patientId:nearby.actor.id};
      }
      return {label:`ASSESS ${nearby.actor.name}`.toUpperCase(),type:"assess",patientId:nearby.actor.id};
    }

    const playerMedical=this.game.operator.medical;
    if(playerMedical?.dead||playerMedical?.unconscious||playerMedical?.condition==="critical")return null;
    return this.getTreatmentActionFor(this.game.operator);
  }

  startPlayerTreatment(action=this.getPlayerAction()){
    if(!action||action.disabled)return false;
    if(action.type==="drag")return this.startDrag(action.patientId);
    if(action.type==="drop_casualty")return this.stopDrag();
    if(action.type==="assess"){
      const patient=this.game.actors.find(actor=>actor.id===action.patientId);
      if(patient)this.game.assessmentRequest={actor:patient,text:this.formatAssessment(patient)};
      return Boolean(patient);
    }

    const patient=action.patientId===this.game.operator.id
      ?this.game.operator
      :this.game.actors.find(actor=>actor.id===action.patientId);
    if(!patient)return false;
    this.game.combat.toggleAim(false);
    this.playerAction={
      patientId:patient.id,
      itemType:action.type,
      itemId:action.itemId,
      label:action.label,
      progress:0,
      duration:TREATMENT_DURATION[action.type]??3
    };
    this.game.operator.lockedByInteraction=true;
    this.game.operator.actionLock={owner:"medical",phase:"treat",allowsMovement:false,allowsCombat:false};
    this.game.operator.workPose="medical";
    this.game.operator.searchPose=1;
    this.game.pushMessage(`${action.label} — ${patient.id===this.game.operator.id?"self":patient.name}`,1.4);
    return true;
  }

  formatAssessment(patient){
    const assessment=this.game.wounds.getAssessment(patient);
    if(assessment.dead)return `${patient.name}: Dead. No treatment possible.`;
    const wounds=assessment.active.map(w=>`${w.severity} ${w.region} bleeding`).join("; ")||"No uncontrolled bleeding";
    const need=assessment.need?assessment.need.type.replaceAll("_"," "):"observation";
    return `${patient.name}: ${assessment.condition.toUpperCase()}. ${wounds}. Blood ${assessment.blood}%. Shock ${assessment.shock}%. Needs ${need}.`;
  }

  startDrag(patientId){
    if(!canDrag(this.game.operator)||this.playerDraggingId||this.game.operator.carriedItemInstanceId)return false;
    const patient=this.game.actors.find(actor=>actor.id===patientId);
    if(!patient)return false;
    const assessment=this.game.wounds.getAssessment(patient);
    if(!assessment.dead&&!["critical","unconscious"].includes(assessment.condition))return false;
    this.playerDraggingId=patient.id;
    patient.beingDragged=true;
    patient.operationPausedByEncounter=true;
    patient.vx=0;patient.vy=0;patient.moveTarget=null;
    this.game.combat.toggleAim(false);
    this.game.pushMessage(`Dragging ${patient.name}`,1.5);
    return true;
  }

  stopDrag(){
    const patient=this.game.actors.find(actor=>actor.id===this.playerDraggingId);
    if(patient)patient.beingDragged=false;
    this.playerDraggingId=null;
    this.game.pushMessage("Casualty released",1.2);
    return true;
  }

  updateDrag(delta){
    if(!this.playerDraggingId)return;
    if(!canDrag(this.game.operator)){this.stopDrag();return;}
    const patient=this.game.actors.find(actor=>actor.id===this.playerDraggingId);
    if(!patient){this.playerDraggingId=null;return;}
    const operator=this.game.operator;
    const speed=Math.hypot(operator.vx??0,operator.vy??0);
    const movementAngle=speed>3?Math.atan2(operator.vy,operator.vx):(operator.lookAngle??0);
    const trailerAngle=movementAngle+Math.PI;
    const headAnchor={
      x:operator.x+Math.cos(trailerAngle)*30,
      y:operator.y+Math.sin(trailerAngle)*30+6
    };
    const bodyCenter={
      x:headAnchor.x+Math.cos(trailerAngle)*24,
      y:headAnchor.y+Math.sin(trailerAngle)*24
    };

    // The shoulders remain physically clamped to Mara; the rest of the body
    // rotates and trails behind like a short towed load.
    const separation=Math.hypot(patient.x-bodyCenter.x,patient.y-bodyCenter.y);
    const towSpeed=Math.max(150,operator.moveSpeed*1.3,separation*8);
    trailActorToward(patient,bodyCenter,delta,{maximumSpeed:towSpeed,arrivalRadius:2,pose:"dragged"});
    const angleDiff=Math.atan2(Math.sin(trailerAngle-(patient.collapseAngle??trailerAngle)),Math.cos(trailerAngle-(patient.collapseAngle??trailerAngle)));
    patient.collapseAngle=(patient.collapseAngle??trailerAngle)+angleDiff*(1-Math.exp(-delta*12));
    patient.dragHeadAnchor=headAnchor;
    patient.beingDragged=true;
    patient.operationPausedByEncounter=true;
    patient.vx=0;patient.vy=0;
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

    this.consumePlayerSupply(action.itemId);
    const patient=action.patientId===this.game.operator.id
      ?this.game.operator
      :this.game.actors.find(actor=>actor.id===action.patientId);
    const result=patient
      ?this.game.wounds.applyTreatment(patient,action.itemType,{source:this.game.operator})
      :{ok:false,reason:"Patient unavailable"};
    if(result.ok){
      this.game.pushMessage(`${result.label} — ${patient.id===this.game.operator.id?"self":patient.name}`,1.8);
      if(patient.id==="worker_ada")this.game.incident?.onMedicalTreatment?.(action.itemType,result);
    }
    this.playerAction=null;
    this.game.operator.lockedByInteraction=false;
    this.game.operator.workPose=null;
    this.game.operator.searchPose=0;
  }

  update(delta){
    this.updateDrag(delta);
    this.updatePlayer(delta);
    for(const actor of this.game.actors){
      if(actor.operationId&&actor.factionId)this.updateActor(actor,delta);
    }
  }
}
