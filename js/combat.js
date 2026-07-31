import { canBeTargeted, isAlive } from "./actor-state.js?v=11e-combat-authority-team-response-20260731";
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const shortestAngle=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const pointDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const WEAPON={
 magazineSize:20,
 reloadDuration:2.35,
 fireInterval:.115,
 baseSpread:1.7*Math.PI/180,
 movementSpread:5.2*Math.PI/180,
 turnSpread:7.5*Math.PI/180,
 recoilPerShot:1.25*Math.PI/180,
 maximumSpread:14*Math.PI/180,
 settleRate:8.5,
 recoilRecovery:4.8,
 range:1150
};

function segmentCircleHit(origin,end,circle){
 const dx=end.x-origin.x,dy=end.y-origin.y;
 const fx=origin.x-circle.x,fy=origin.y-circle.y;
 const a=dx*dx+dy*dy;
 const b=2*(fx*dx+fy*dy);
 const c=fx*fx+fy*fy-circle.radius*circle.radius;
 const discriminant=b*b-4*a*c;
 if(discriminant<0)return null;
 const root=Math.sqrt(discriminant);
 const t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);
 const t=[t1,t2].filter(value=>value>=0&&value<=1).sort((x,y)=>x-y)[0];
 return Number.isFinite(t)?{t,x:origin.x+dx*t,y:origin.y+dy*t}:null;
}

export class CombatSystem{
 constructor(game){
  this.game=game;
  this.aiming=false;
  this.aimAngle=game.operator.lookAngle??0;
  this.weaponAngle=this.aimAngle+.62;
  this.aimReadiness=0;
  this.spread=WEAPON.baseSpread;
  this.recoilSpread=0;
  this.turnPenalty=0;
  this.previousAimAngle=this.aimAngle;
  this.fireHeld=false;
  this.fireCooldown=0;
  this.ammoInMagazine=WEAPON.magazineSize;
  this.magazineSize=WEAPON.magazineSize;
  this.reloading=false;
  this.reloadProgress=0;
  this.reloadDuration=WEAPON.reloadDuration;
  this.effects=[];
  this.decals=[];
  this.shotCount=0;
  this.lastShotAt=-999;
  this.lastHit=null;
  this.lookInputActive=false;
  this.suppression=0;
  this.suppressionDirection=null;
 }
 get weaponAvailable(){
  const operator=this.game.operator;
  const medical=operator.medical;
  return !operator.carriedItemInstanceId &&
    !medical?.dead &&
    !medical?.unconscious &&
    medical?.condition!=="critical" &&
    !operator.beingDragged &&
    !this.game.medical?.playerDraggingId &&
    !this.game.medical?.playerAction &&
    operator.actionLock?.allowsCombat!==false;
 }
 setAimAngle(angle){
  if(Number.isFinite(angle)&&this.weaponAvailable)this.aimAngle=angle;
 }
 toggleAim(force=null){
  const operator=this.game.operator;
  if(!this.weaponAvailable||!this.game.wounds?.canAct?.(operator)){
   this.aiming=false;
   this.fireHeld=false;
   return false;
  }
  if(this.reloading&&force!==false)return false;
  this.aiming=force===null?!this.aiming:Boolean(force);
  this.#updateBodyTarget();
  return true;
 }
 #updateBodyTarget(){
  const operator=this.game.operator;
  if(!this.weaponAvailable)return;
  operator.targetLookAngle=this.aimAngle;
  operator.perceptionLookAngle=this.aimAngle;
 }
 setFireHeld(held){
  this.fireHeld=Boolean(held);
 }
 get movementSpeedCap(){
  return this.aiming ? 0.42 : 1;
 }
 get movementRatio(){
  const operator=this.game.operator;
  return clamp(Math.hypot(operator.vx??0,operator.vy??0)/Math.max(1,operator.moveSpeed??150),0,1);
 }
 get weatherMinimum(){
  const weather=this.game.weather;
  const light=this.game.getLightLevel?.()??1;
  const weatherPenalty=weather==="Heavy Rain"?2.3:weather==="Rain"?1.3:weather==="Cloudy"?.55:0;
  const darknessPenalty=(1-light)*2.4;
  return (weatherPenalty+darknessPenalty)*Math.PI/180;
 }
 get currentSpread(){
  const suppressionSpread=(this.suppression/100)*7*Math.PI/180;
  const woundSpread=this.game.wounds?.getAimPenalty?.(this.game.operator)??0;
  return clamp(this.spread+this.recoilSpread+this.turnPenalty+suppressionSpread+woundSpread,WEAPON.baseSpread,WEAPON.maximumSpread);
 }
 addSuppression(amount,direction=null){
  this.suppression=clamp(this.suppression+Math.max(0,amount),0,100);
  if(Number.isFinite(direction))this.suppressionDirection=direction;
 }
 get aimingLineVisible(){
  return this.aiming&&!this.reloading&&this.aimReadiness>.18;
 }
 get pointingLeft(){
  return Math.cos(this.weaponAngle)<0;
 }
 get pointsBehindOperator(){
  return Math.sin(this.weaponAngle)<-0.18;
 }
 get aimTrace(){
  const origin=this.muzzle;
  const end={x:origin.x+Math.cos(this.aimAngle)*WEAPON.range,y:origin.y+Math.sin(this.aimAngle)*WEAPON.range};
  return this.resolveShot(origin,end);
 }
 getAimTargetKind(actor){
  if(!actor)return "clear";
  if(actor.factionId==="commune"||actor.id==="worker_ada")return "friendly";
  const encounter=this.game.encounters?.getActorEncounter?.(actor.id);
  if(encounter?.state==="threatening")return "hostile";
  return "contact";
 }
 get muzzle(){
  const operator=this.game.operator;
  const length=54;
  return{x:operator.x+Math.cos(this.weaponAngle)*length,y:operator.y+Math.sin(this.weaponAngle)*length};
 }
 get reticleDistance(){
  return 300;
 }
 get reticle(){
  const operator=this.game.operator;
  const distance=this.reticleDistance;
  return{x:operator.x+Math.cos(this.weaponAngle)*distance,y:operator.y+Math.sin(this.weaponAngle)*distance};
 }
 update(delta,move){
  const operator=this.game.operator;
  if(!this.weaponAvailable){
   this.aiming=false;
   this.fireHeld=false;
   this.lookInputActive=false;
   this.aimReadiness+=(0-this.aimReadiness)*(1-Math.exp(-delta*7));
   operator.targetLookAngle=operator.lookAngle??0;
   operator.perceptionLookAngle=operator.lookAngle??0;
  }
  for(const actor of this.game.actors){
   if(actor.factionId&&actor.operationId&&actor.ammoInMagazine===undefined){
    actor.ammoInMagazine=20;
    actor.magazineSize=20;
    actor.reloading=false;
   }
  }

  const angularDelta=Math.abs(shortestAngle(this.previousAimAngle,this.aimAngle));
  const turnSpeed=angularDelta/Math.max(.001,delta);
  this.previousAimAngle=this.aimAngle;
  const turnTarget=clamp(turnSpeed/7.5,0,1)*WEAPON.turnSpread;
  this.turnPenalty+=(turnTarget-this.turnPenalty)*(1-Math.exp(-delta*12));

  const targetReadiness=this.aiming&&!this.reloading?1:0;
  const readinessRate=targetReadiness>this.aimReadiness?6.2:7.4;
  this.aimReadiness+=(targetReadiness-this.aimReadiness)*(1-Math.exp(-delta*readinessRate));

  const bodyAngle=operator.lookAngle??this.aimAngle;
  const sideSign=Math.cos(bodyAngle)<0?-1:1;
  // Low ready stays at chest height: only the muzzle tips down.
  const lowCarryAngle=bodyAngle+sideSign*.34;
  const desiredWeaponAngle=this.aiming?this.aimAngle:lowCarryAngle;
  const weaponFollowRate=this.aiming?16.5:9.2;
  this.weaponAngle+=shortestAngle(this.weaponAngle,desiredWeaponAngle)*(1-Math.exp(-delta*weaponFollowRate));

  this.#updateBodyTarget();

  const movementTarget=this.movementRatio*WEAPON.movementSpread;
  const lowReadyPenalty=this.aiming?0:3.4*Math.PI/180;
  const targetSpread=WEAPON.baseSpread+lowReadyPenalty+movementTarget+this.weatherMinimum;
  const settleRate=WEAPON.settleRate*(this.game.weather==="Heavy Rain"?.65:this.game.weather==="Rain"?.78:1);
  this.spread+=(targetSpread-this.spread)*(1-Math.exp(-delta*settleRate));
  this.recoilSpread=Math.max(0,this.recoilSpread-WEAPON.recoilRecovery*delta*Math.PI/180);
  this.fireCooldown=Math.max(0,this.fireCooldown-delta);
  this.suppression=Math.max(0,this.suppression-delta*9.5);
  if(this.suppression<=.5)this.suppressionDirection=null;

  if(this.reloading){
   this.reloadProgress=clamp(this.reloadProgress+delta/this.reloadDuration,0,1);
   if(this.reloadProgress>=1){
    this.reloading=false;
    this.reloadProgress=0;
    this.ammoInMagazine=this.magazineSize;
    this.game.pushMessage("Reload complete",1.35);
   }
  }else if(this.fireHeld&&(!this.aiming||this.aimReadiness>.72)){
   this.tryFire();
  }

  for(const effect of this.effects)effect.life-=delta;
  this.effects=this.effects.filter(effect=>effect.life>0);
  for(const decal of this.decals)decal.life-=delta;
  this.decals=this.decals.filter(decal=>decal.life>0).slice(-80);
 }
 tryFire(){
  if(!this.weaponAvailable||!this.game.wounds?.canAct?.(this.game.operator)||this.reloading||this.fireCooldown>0)return false;
  if(this.ammoInMagazine<=0){
   this.startReload();
   return false;
  }

  this.ammoInMagazine--;
  this.fireCooldown=WEAPON.fireInterval;
  this.shotCount++;
  this.lastShotAt=this.game.clockMinutes;

  const deviation=(Math.random()+Math.random()-1)*this.currentSpread;
  const shotAngle=this.weaponAngle+deviation;
  const muzzle=this.muzzle;
  const intended={
   x:muzzle.x+Math.cos(shotAngle)*WEAPON.range,
   y:muzzle.y+Math.sin(shotAngle)*WEAPON.range
  };
  const result=this.resolveShot(muzzle,intended);
  const end=result.point;
  this.game.aiCombat?.onPlayerShot?.(muzzle,end,result);

  this.effects.push({type:"muzzle",x:muzzle.x,y:muzzle.y,angle:shotAngle,life:.085,maxLife:.085});
  this.effects.push({type:"tracer",x1:muzzle.x,y1:muzzle.y,x2:end.x,y2:end.y,life:.13,maxLife:.13});
  if(result.actor){
   this.effects.push({type:"hit",x:end.x,y:end.y,life:.16,maxLife:.16});
   this.lastHit=result.actor.id;
  }else{
   this.decals.push({type:"impact",x:end.x,y:end.y,angle:Math.random()*Math.PI,life:46,maxLife:46});
   this.lastHit=null;
  }

  this.recoilSpread=clamp(this.recoilSpread+WEAPON.recoilPerShot,0,WEAPON.maximumSpread);
  this.turnPenalty=clamp(this.turnPenalty+.35*Math.PI/180,0,WEAPON.turnSpread);

  if(this.ammoInMagazine<=0)this.startReload(.18);
  return true;
 }
 startReload(delay=0){
  if(this.reloading)return;
  this.fireHeld=false;
  this.reloading=true;
  this.reloadProgress=-delay/this.reloadDuration;
  this.aimReadiness=Math.min(this.aimReadiness,.4);
  this.game.pushMessage("Reloading",1.15);
 }
 resolveShot(origin,end){
  let nearest={t:1,point:{...end},actor:null,obstacle:null};

  for(const actor of this.game.actors){
   if(actor.condition==="dead")continue;
   const hit=segmentCircleHit(origin,end,{x:actor.x,y:actor.y,radius:actor.radius??18});
   if(hit&&hit.t<nearest.t)nearest={t:hit.t,point:{x:hit.x,y:hit.y},actor,obstacle:null};
  }

  for(const obstacle of this.game.map.obstacles??[]){
   const radius=(obstacle.radius??25)*.8;
   const hit=segmentCircleHit(origin,end,{x:obstacle.x,y:obstacle.y,radius});
   if(hit&&hit.t<nearest.t)nearest={t:hit.t,point:{x:hit.x,y:hit.y},actor:null,obstacle};
  }

  nearest.point.x=clamp(nearest.point.x,8,4392);
  nearest.point.y=clamp(nearest.point.y,8,1992);
  return nearest;
 }
}
