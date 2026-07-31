const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

const REGION_LABELS={head:"Head",torso:"Torso",arms:"Arms",legs:"Legs"};
const SEVERITY={
  minor:{bleeding:.22,shock:8,pain:10},
  moderate:{bleeding:.65,shock:18,pain:25},
  severe:{bleeding:1.45,shock:34,pain:48},
  catastrophic:{bleeding:2.8,shock:58,pain:78}
};

function weightedSeverity(distance=400,region="torso"){
  const close=clamp(1-distance/1050,0,1);
  const roll=Math.random();
  let severity=roll<.16+close*.12?"severe":roll<.62?"moderate":"minor";
  if(region==="head"&&Math.random()<.48)severity=severity==="minor"?"moderate":"catastrophic";
  if(region==="torso"&&severity==="severe"&&Math.random()<.22)severity="catastrophic";
  return severity;
}

function hitRegion(target,impact){
  const height=target.height??70;
  const top=target.y-height*.48;
  const ratio=clamp((impact.y-top)/height,0,1);
  if(ratio<.20)return "head";
  if(ratio<.58)return Math.random()<.22?"arms":"torso";
  return "legs";
}

export class WoundSystem{
  constructor(game){this.game=game;this.recent=[];this.ensure(game.operator);}

  ensure(target){
    target.medical ??={
      blood:100,shock:0,pain:0,bleedingRate:0,
      condition:"healthy",wounds:[],unconscious:false,dead:false,
      lastHitAt:-999,criticalSeconds:0,painMedicationSeconds:0,tourniquetRegions:[]
    };
    return target.medical;
  }

  applyGunshot(target,impact,{source=null,distance=400,severity=null}={}){
    if(!target)return null;
    const medical=this.ensure(target);
    if(medical.dead)return null;
    const region=hitRegion(target,impact);
    const woundSeverity=severity??weightedSeverity(distance,region);
    const profile=SEVERITY[woundSeverity];
    const wound={
      id:`wound_${Date.now()}_${Math.floor(Math.random()*9999)}`,
      type:"gunshot",region,severity:woundSeverity,
      bleedingRate:profile.bleeding,controlled:false,
      createdAt:performance.now()/1000,sourceId:source?.id??null
    };
    medical.wounds.push(wound);
    medical.bleedingRate+=profile.bleeding;
    medical.shock=clamp(medical.shock+profile.shock,0,100);
    medical.pain=clamp(medical.pain+profile.pain,0,100);
    medical.lastHitAt=performance.now()/1000;
    target.lastWoundRegion=region;
    target.lastWoundSeverity=woundSeverity;
    target.woundPulse=1;
    this.recent.push({targetId:target.id,region,severity:woundSeverity,time:medical.lastHitAt});
    this.recent=this.recent.slice(-20);
    this.#derive(target,true);
    const name=target.id===this.game.operator.id?"Mara":target.name;
    this.game.pushMessage(`${name}: ${woundSeverity} ${REGION_LABELS[region].toLowerCase()} wound`,2.2);
    return wound;
  }

  getMovementMultiplier(target){
    const medical=this.ensure(target);
    if(medical.dead||medical.unconscious)return 0;
    const legSeverity=medical.wounds.filter(w=>w.region==="legs"&&!w.controlled)
      .reduce((max,w)=>Math.max(max,["minor","moderate","severe","catastrophic"].indexOf(w.severity)), -1);
    const conditionPenalty=medical.condition==="critical"?.46:medical.condition==="serious"?.72:medical.condition==="wounded"?.9:1;
    const legPenalty=legSeverity>=3?.34:legSeverity===2?.55:legSeverity===1?.78:legSeverity===0?.92:1;
    return Math.min(conditionPenalty,legPenalty);
  }

  getAimPenalty(target){
    const medical=this.ensure(target);
    const armCount=medical.wounds.filter(w=>w.region==="arms").length;
    return (medical.pain/100)*4.5*Math.PI/180+armCount*1.25*Math.PI/180;
  }

  canAct(target){const m=this.ensure(target);return !m.dead&&!m.unconscious;}

  update(delta){
    this.#updateTarget(this.game.operator,delta);
    for(const actor of this.game.actors){
      if(actor.operationId||actor.medical)this.#updateTarget(actor,delta);
    }
  }

  #updateTarget(target,delta){
    const medical=this.ensure(target);
    if(medical.dead)return;
    const activeBleeding=medical.wounds.reduce((sum,w)=>sum+(w.controlled?0:w.bleedingRate),0);
    medical.bleedingRate=activeBleeding;
    medical.blood=clamp(medical.blood-activeBleeding*delta,0,100);
    const bleedingShock=activeBleeding*.55+(100-medical.blood)*.012;
    medical.shock=clamp(medical.shock+bleedingShock*delta-(activeBleeding<=.05?2.4:0)*delta,0,100);
    medical.painMedicationSeconds=Math.max(0,(medical.painMedicationSeconds??0)-delta);
    const painDecay=medical.painMedicationSeconds>0?1.35:.45;
    medical.pain=clamp(medical.pain-painDecay*delta,0,100);
    target.woundPulse=Math.max(0,(target.woundPulse??0)-delta*1.8);
    this.#derive(target,false,delta);
  }

  #derive(target,immediate=false,delta=0){
    const m=this.ensure(target);
    const hasCatastrophic=m.wounds.some(w=>w.severity==="catastrophic"&&!w.controlled);
    const hasSevere=m.wounds.some(w=>w.severity==="severe"&&!w.controlled);
    const hasWound=m.wounds.length>0;
    let next="healthy";
    if(m.blood<=0)next="dead";
    else if(m.blood<20||m.shock>=92)next="unconscious";
    else if(m.blood<45||m.shock>=68||hasCatastrophic)next="critical";
    else if(m.blood<72||m.shock>=42||hasSevere)next="serious";
    else if(hasWound)next="wounded";

    if(next==="critical")m.criticalSeconds=(m.criticalSeconds??0)+delta;
    else m.criticalSeconds=0;
    if(m.criticalSeconds>45&&m.bleedingRate>1.2)next="unconscious";

    const previous=m.condition;
    m.condition=next;
    m.unconscious=next==="unconscious";
    m.dead=next==="dead";
    if(m.dead){
      target.condition="dead";target.vx=0;target.vy=0;target.workPose="dead";target.medicalPose="dead";
    }else if(m.unconscious){
      target.condition="incapacitated";target.vx=0;target.vy=0;target.workPose="downed";target.medicalPose="unconscious";
    }else if(next==="critical"){
      target.medicalPose="critical";
      if(target.operationId)target.workPose="crawl";
    }else{
      target.medicalPose=null;
      if(target.operationId&&target.condition==="incapacitated")target.condition="active";
    }

    if(previous!==next&&!immediate){
      const label=target.id===this.game.operator.id?"Mara":target.name;
      if(next==="critical")this.game.pushMessage(`${label} is critical`,2.3);
      else if(next==="unconscious")this.game.pushMessage(`${label} is unconscious`,2.5);
      else if(next==="dead")this.game.pushMessage(`${label} has died`,2.8);
    }
  }

  getTreatmentNeed(target){
    const medical=this.ensure(target);
    const active=medical.wounds.filter(w=>!w.controlled);
    if(!active.length){
      if(medical.pain>=48)return {type:"painkillers",label:"Take Painkillers",priority:20};
      return null;
    }

    const severityRank={minor:1,moderate:2,severe:3,catastrophic:4};
    const worst=[...active].sort((a,b)=>severityRank[b.severity]-severityRank[a.severity])[0];
    if(worst.severity==="catastrophic"&&["arms","legs"].includes(worst.region)){
      return {type:"tourniquet",label:`Tourniquet ${REGION_LABELS[worst.region]}`,priority:100,woundId:worst.id};
    }
    if(["severe","catastrophic"].includes(worst.severity)){
      return {type:"pressure_dressing",label:`Pressure Dressing: ${REGION_LABELS[worst.region]}`,priority:80,woundId:worst.id};
    }
    return {type:"bandage",label:`Bandage ${REGION_LABELS[worst.region]}`,priority:60,woundId:worst.id};
  }

  applyTreatment(target,treatmentType,{source=null}={}){
    const medical=this.ensure(target);
    if(medical.dead)return {ok:false,reason:"Too late"};
    if(treatmentType==="painkillers"){
      if(medical.pain<12)return {ok:false,reason:"Pain is already controlled"};
      medical.pain=clamp(medical.pain-38,0,100);
      medical.shock=clamp(medical.shock-5,0,100);
      medical.painMedicationSeconds=Math.max(medical.painMedicationSeconds??0,45);
      this.#derive(target,true);
      return {ok:true,label:"Pain controlled"};
    }

    const need=this.getTreatmentNeed(target);
    if(!need||need.type!==treatmentType)return {ok:false,reason:"That supply does not match the current wound"};
    const wound=medical.wounds.find(w=>w.id===need.woundId&&!w.controlled);
    if(!wound)return {ok:false,reason:"No suitable wound"};

    wound.controlled=true;
    wound.treatment=treatmentType;
    wound.treatedBy=source?.id??target.id;
    wound.treatedAt=performance.now()/1000;
    if(treatmentType==="tourniquet"){
      wound.tourniquet=true;
      medical.tourniquetRegions ??= [];
      if(!medical.tourniquetRegions.includes(wound.region))medical.tourniquetRegions.push(wound.region);
      medical.pain=clamp(medical.pain+8,0,100);
    }else if(treatmentType==="pressure_dressing"){
      medical.shock=clamp(medical.shock-9,0,100);
    }else{
      medical.shock=clamp(medical.shock-4,0,100);
    }
    medical.bleedingRate=medical.wounds.reduce((sum,w)=>sum+(w.controlled?0:w.bleedingRate),0);
    this.#derive(target,true);
    return {ok:true,label:`${REGION_LABELS[wound.region]} bleeding controlled`,wound};
  }

  getActiveBleedingWounds(target){
    return this.ensure(target).wounds.filter(w=>!w.controlled&&w.bleedingRate>0);
  }

  getSummary(target){
    const m=this.ensure(target);
    return {condition:m.condition,blood:Math.round(m.blood),shock:Math.round(m.shock),pain:Math.round(m.pain),bleeding:m.bleedingRate,wounds:m.wounds.length,need:this.getTreatmentNeed(target)};
  }
}
