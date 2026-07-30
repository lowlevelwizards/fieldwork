const DEG=Math.PI/180;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const facingAngle=facing=>facing==="right"?0:facing==="down"?Math.PI/2:facing==="left"?Math.PI:-Math.PI/2;
const observerAngle=observer=>Number.isFinite(observer.lookAngle)?observer.lookAngle:facingAngle(observer.facing);
const normalizeAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));

function movementSpeed(actor){return Math.hypot(actor.vx??0,actor.vy??0);}
function motionTier(actor){
 const speed=movementSpeed(actor);
 const base=Math.max(1,actor.moveSpeed??150);
 const ratio=speed/base;
 if(ratio<.08)return "stationary";
 if(ratio<.55)return "walking";
 if(ratio<.9)return "jogging";
 return "running";
}

export class PerceptionSystem{
 constructor(game){
  this.game=game;
  this.detections=new Map();
  this.teamKnowledge=new Map();
  this.relayQueue=[];
  this.identifiedContactCount=0;
 }
 getObserverProfile(observer){
  const tier=motionTier(observer);
  const movementAngle={stationary:12,walking:0,jogging:-18,running:-36}[tier];
  const movementRange={stationary:1.08,walking:1,jogging:.86,running:.68}[tier];
  const weatherAngle=this.game.weather==="Heavy Rain"?-25:this.game.weather==="Rain"?-16:this.game.weather==="Cloudy"?-7:0;
  const weatherRange=this.game.weather==="Heavy Rain"?.55:this.game.weather==="Rain"?.7:this.game.weather==="Cloudy"?.88:1;
  const light=clamp(this.game.getLightLevel?.()??1,.06,1);
  const lightAngle=(light-1)*30;
  const lightRange=.32+.68*Math.sqrt(light);
  const baseAngle=observer.id===this.game.operator.id?120:112;
  const baseRange=observer.id===this.game.operator.id?720:650;
  return{
   tier,
   angle:clamp(baseAngle+movementAngle+weatherAngle+lightAngle,48,132),
   range:clamp(baseRange*movementRange*weatherRange*lightRange,170,760),
   light
  };
 }
 isInsideCone(observer,target,profile=this.getObserverProfile(observer)){
  const dx=target.x-observer.x,dy=target.y-observer.y;
  const d=Math.hypot(dx,dy);
  if(d>profile.range)return false;
  if(d<70)return true;
  const angle=Math.atan2(dy,dx);
  return Math.abs(normalizeAngle(angle-observerAngle(observer)))<=profile.angle*.5*DEG;
 }
 getDetection(observerId,targetId){
  return this.detections.get(`${observerId}>${targetId}`)??null;
 }
 getTeamContact(teamId,targetTeamId){
  return this.teamKnowledge.get(teamId)?.get(targetTeamId)??null;
 }
 teamHasContact(teamId,targetTeamId,minimum="suspected"){
  const contact=this.getTeamContact(teamId,targetTeamId);
  if(!contact)return false;
  const ranks={suspected:1,located:2,identified:3};
  return (ranks[contact.level]??0)>=(ranks[minimum]??1)&&contact.certainty>0;
 }
 update(delta){
  for(const actor of this.game.actors){
   if(!actor.factionId||!actor.operationId)continue;
   let targetAngle=actor.lookAngle;
   if(Math.hypot(actor.vx??0,actor.vy??0)>.1)targetAngle=Math.atan2(actor.vy,actor.vx);
   else if(actor.encounterId){
    const contact=this.getActorContactState(actor);
    if(contact?.lastPosition)targetAngle=Math.atan2(contact.lastPosition.y-actor.y,contact.lastPosition.x-actor.x);
   }else if(actor.workPose==="scan"){
    targetAngle=(actor.lookAngle??facingAngle(actor.facing))+Math.sin((actor.workPhase??0)*.7)*.012;
   }
   if(!Number.isFinite(actor.lookAngle))actor.lookAngle=facingAngle(actor.facing);
   if(Number.isFinite(targetAngle)){
    const diff=Math.atan2(Math.sin(targetAngle-actor.lookAngle),Math.cos(targetAngle-actor.lookAngle));
    actor.lookAngle+=diff*(1-Math.exp(-delta*6));
   }
  }

  const observers=[this.game.operator,...this.game.actors.filter(actor=>actor.factionId&&actor.operationId)];
  const targets=[this.game.operator,...this.game.actors.filter(actor=>actor.factionId&&actor.operationId)];
  const seenKeys=new Set();

  for(const observer of observers){
   const profile=this.getObserverProfile(observer);
   for(const target of targets){
    if(observer===target)continue;
    if(observer.factionId&&target.factionId&&observer.factionId===target.factionId)continue;
    if(observer.id===this.game.operator.id&&target.factionId==="commune")continue;
    if(target.id===this.game.operator.id&&observer.factionId==="commune")continue;

    const key=`${observer.id}>${target.id}`;
    seenKeys.add(key);
    let record=this.detections.get(key);
    if(!record){
     record={observerId:observer.id,targetId:target.id,progress:0,level:"unaware",lastSeen:null,lastPosition:null};
     this.detections.set(key,record);
    }

    const d=distance(observer,target);
    const visible=this.isInsideCone(observer,target,profile);
    if(visible){
     const closeness=clamp(1-d/profile.range,0,1);
     const targetTier=motionTier(target);
     const targetMovement={stationary:.55,walking:1,jogging:1.45,running:1.9}[targetTier];
     const observerFocus={stationary:1.35,walking:1,jogging:.72,running:.48}[profile.tier];
     const closeBoost=d<95?5:d<180?2.4:1;
     const gain=(5+26*closeness*closeness)*targetMovement*observerFocus*closeBoost;
     record.progress=clamp(record.progress+gain*delta,0,100);
     record.lastSeen=this.game.clockMinutes;
     record.lastPosition={x:target.x,y:target.y};
    }else{
     record.progress=clamp(record.progress-(record.level==="identified"?2.5:6)*delta,0,100);
    }

    const oldLevel=record.level;
    record.level=record.progress>=100?"identified":record.progress>=55?"located":record.progress>=18?"suspected":"unaware";
    if(record.level!==oldLevel&&record.level!=="unaware"){
     this.onDetectionLevel(observer,target,record);
    }
   }
  }

  for(const [key,record] of this.detections){
   if(!seenKeys.has(key))record.progress=clamp(record.progress-8*delta,0,100);
  }

  this.updateRelays(delta);
  this.decayKnowledge(delta);
  this.identifiedContactCount=[...this.teamKnowledge.values()].reduce((sum,map)=>sum+[...map.values()].filter(c=>c.level==="identified").length,0);
 }
 onDetectionLevel(observer,target,record){
  const observerTeam=observer.teamId??(observer.id===this.game.operator.id?"player":observer.factionId);
  const targetTeam=target.teamId??(target.id===this.game.operator.id?"player":target.factionId);
  this.writeKnowledge(observerTeam,targetTeam,record.level,record.progress,record.lastPosition,observer.id);

  if(observer.id!==this.game.operator.id){
   const teammates=this.game.actors.filter(actor=>actor.teamId===observer.teamId&&actor.id!==observer.id);
   for(const teammate of teammates){
    const spacing=distance(observer,teammate);
    const base=.45+spacing/230;
    const weather=this.game.weather==="Heavy Rain"?1.8:this.game.weather==="Rain"?1.35:1;
    const light=(this.game.getLightLevel?.()??1)<.3?1.35:1;
    this.queueRelay({
     fromTeam:observerTeam,toTeam:observerTeam,targetTeam,
     level:record.level,certainty:record.progress,
     position:record.lastPosition,sourceId:observer.id,
     delay:base*weather*light
    });
   }

   const sameFactionTeams=new Set(
    this.game.actors
     .filter(actor=>actor.factionId===observer.factionId&&actor.teamId!==observer.teamId)
     .map(actor=>actor.teamId)
   );
   for(const teamId of sameFactionTeams){
    this.queueRelay({
     fromTeam:observerTeam,toTeam:teamId,targetTeam,
     level:record.level,certainty:record.progress*.85,
     position:record.lastPosition,sourceId:observer.id,
     delay:2.4+(this.game.weather==="Rain"?1.2:0)+(this.game.getLightLevel?.()<.3?1:0)
    });
   }
  }
 }
 queueRelay(relay){
  const duplicate=this.relayQueue.some(item=>item.toTeam===relay.toTeam&&item.targetTeam===relay.targetTeam&&item.level===relay.level);
  if(!duplicate)this.relayQueue.push({...relay,remaining:relay.delay});
 }
 updateRelays(delta){
  for(const relay of this.relayQueue)relay.remaining-=delta;
  const ready=this.relayQueue.filter(relay=>relay.remaining<=0);
  this.relayQueue=this.relayQueue.filter(relay=>relay.remaining>0);
  for(const relay of ready)this.writeKnowledge(relay.toTeam,relay.targetTeam,relay.level,relay.certainty,relay.position,relay.sourceId);
 }
 writeKnowledge(teamId,targetTeamId,level,certainty,position,sourceId){
  if(!this.teamKnowledge.has(teamId))this.teamKnowledge.set(teamId,new Map());
  const map=this.teamKnowledge.get(teamId);
  const existing=map.get(targetTeamId);
  const rank={suspected:1,located:2,identified:3};
  if(!existing||(rank[level]??0)>=(rank[existing.level]??0)||certainty>existing.certainty){
   map.set(targetTeamId,{
    level,certainty,lastPosition:position?{...position}:existing?.lastPosition??null,
    sourceId,lastUpdate:this.game.clockMinutes
   });
  }
 }
 decayKnowledge(delta){
  for(const map of this.teamKnowledge.values())for(const [targetTeam,contact] of map){
   contact.certainty=clamp(contact.certainty-(contact.level==="identified"?.7:1.7)*delta,0,100);
   if(contact.certainty<=0)map.delete(targetTeam);
   else if(contact.certainty<18)contact.level="suspected";
   else if(contact.certainty<55&&contact.level==="identified")contact.level="located";
  }
 }
 getPlayerCone(){
  const profile=this.getObserverProfile(this.game.operator);
  return{
   x:this.game.operator.x,y:this.game.operator.y,
   lookAngle:observerAngle(this.game.operator),
   angle:profile.angle,range:profile.range,tier:profile.tier
  };
 }

 getRelayPresentation(actorId){
  const outgoing=this.relayQueue.filter(relay=>relay.sourceId===actorId);
  if(!outgoing.length)return null;
  const relay=outgoing.sort((a,b)=>a.remaining-b.remaining)[0];
  const progress=clamp(1-relay.remaining/Math.max(.01,relay.total??relay.delay),0,1);
  return {progress,dots:progress<.34?1:progress<.67?2:3};
 }

 getKnowledgePresentation(actor){
  const teamId=actor.teamId??actor.factionId;
  const map=this.teamKnowledge.get(teamId);
  if(!map?.size)return null;
  const contact=[...map.values()].sort((a,b)=>b.certainty-a.certainty)[0];
  return contact?{level:contact.level,certainty:contact.certainty}:null;
 }
 getActorContactState(actor){
  const teamId=actor.teamId??actor.factionId;
  const contacts=this.teamKnowledge.get(teamId);
  if(!contacts?.size)return null;
  return [...contacts.entries()]
   .map(([targetTeamId,contact])=>({targetTeamId,...contact}))
   .sort((a,b)=>b.certainty-a.certainty)[0]??null;
 }
}
