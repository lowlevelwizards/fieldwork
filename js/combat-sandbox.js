import { createIntent, INTENT_PRIORITY } from "./actor-intent.js?v=12c-intent-commitment-stable-movement-20260731";
import { stopActor, isImmobileCasualty, projectOutsideObstacles } from "./actor-motion.js?v=12c-intent-commitment-stable-movement-20260731";

const FACTION_NAMES={northline:"Northline",commune:"Commune",freelancers:"Freelancers"};
const KITS={
 northline:["northline_standard_light","northline_standard_mid","northline_standard_dark"],
 commune:["commune_rust_green","commune_brown_denim","commune_green_brown"],
 freelancers:["freelancer_gray_black","freelancer_brown_gray","freelancer_black_brown"]
};
const ROLES={
 northline:["Security","Engineer","Rifleman"],
 commune:["Scout","Field Medic","Rifleman"],
 freelancers:["Recovery","Scout","Security"]
};
const NAMES={
 northline:["Iris Vale","Evan Holt","Cal Rusk","Mara Dene","Oren Pike","Sia North"],
 commune:["Mina Sol","Jo Fen","Tavi Reed","Nessa Row","Ari Moss","Pax Linden"],
 freelancers:["Rook Hale","Vera Pike","Dax Mercer","Ivo Gray","Caro Flint","Sable Knox"]
};

export const sandboxMap={
 spawn:{x:520,y:980},
 extraction:{x:170,y:980,radius:90},
 road:[{x:0,y:760},{x:4400,y:760},{x:4400,y:1010},{x:0,y:1010}],
 shed:{x:1730,y:250,width:390,height:270,wallThickness:26,doorGap:{side:"bottom",start:150,width:86}},
 site:{
  name:"Combat Test Range",
  workArea:{x:1550,y:180,width:760,height:430},
  truck:{x:2780,y:1280,width:350,height:150},
  breakArea:{x:640,y:1240,width:360,height:190},
  trailhead:{x:450,y:960}
 },
 places:{
  pull_off:{id:"pull_off",name:"Test Range",bounds:{x:0,y:0,width:4400,height:2000}},
  north_culvert:{id:"north_culvert",name:"Range Pond",bounds:{x:3000,y:840,width:900,height:760},arrival:{x:3380,y:1160,radius:260}}
 },
 trail:[
  {x:360,y:1060},{x:850,y:1200},{x:1320,y:1080},{x:1840,y:1180},
  {x:2360,y:980},{x:2800,y:1110},{x:3280,y:930},{x:3920,y:1030}
 ],
 culvert:{
  x:3120,y:900,width:650,height:600,
  water:{x:3060,y:1020,width:720,height:430},
  crossing:{x:3240,y:1120,width:420,height:150}
 },
 obstacles:[
  {type:"tree",x:620,y:340,radius:70},{type:"tree",x:930,y:500,radius:58},
  {type:"tree",x:1320,y:270,radius:64},{type:"tree",x:2480,y:360,radius:66},
  {type:"tree",x:2860,y:520,radius:58},{type:"tree",x:4040,y:390,radius:72},
  {type:"tree",x:570,y:1530,radius:66},{type:"tree",x:1130,y:1660,radius:61},
  {type:"tree",x:2240,y:1560,radius:68},{type:"tree",x:2740,y:1700,radius:60},
  {type:"tree",x:3990,y:1570,radius:70},
  {type:"rock",x:1480,y:650,radius:44},{type:"rock",x:2410,y:720,radius:48},
  {type:"rock",x:2840,y:1220,radius:46},{type:"rock",x:3840,y:820,radius:42},
  {type:"rock",x:1740,y:1440,radius:50},{type:"rock",x:3380,y:1650,radius:48}
 ],
 brush:[
  {x:720,y:420,radius:155},{x:1180,y:390,radius:125},{x:2620,y:440,radius:140},
  {x:3970,y:510,radius:150},{x:730,y:1590,radius:150},{x:2050,y:1660,radius:145},
  {x:2920,y:1540,radius:135},{x:4100,y:1510,radius:155},{x:2450,y:1050,radius:115}
 ]
};

const ENTRY={
 northline:[{x:1020,y:50},{x:2210,y:50},{x:3400,y:50}],
 commune:[{x:70,y:520},{x:70,y:980},{x:70,y:1450}],
 freelancers:[{x:1100,y:1940},{x:2350,y:1940},{x:3650,y:1940}]
};
const PATROLS=[
 {x:1300,y:720},{x:1900,y:1180},{x:2500,y:700},{x:2950,y:1340},
 {x:3550,y:760},{x:900,y:1320},{x:2100,y:880},{x:3700,y:1270}
];

function actorFrom(faction,teamId,index,spawn,wave){
 const id=`sandbox_${faction}_${wave}_${index}`;
 const names=NAMES[faction],role=ROLES[faction][index%ROLES[faction].length];
 const offset={x:(index-1)*42,y:index%2?28:-18};
 return {
  id,name:names[(wave*3+index)%names.length],role,
  type:"actor",teamId,factionId:faction,operationId:"combat_sandbox",
  kitId:KITS[faction][index%KITS[faction].length],
  x:spawn.x+offset.x,y:spawn.y+offset.y,width:44,height:70,groundY:spawn.y+offset.y+34,
  radius:18,vx:0,vy:0,moveSpeed:112+(index%3)*8,facing:faction==="northline"?"down":faction==="freelancers"?"up":"right",
  walkingPhase:0,backpackLoadRatio:.45,carriedItemInstanceId:null,
  routeIndex:0,waitTime:0,workPhase:0,motionState:"walking",
  currentTask:"Entering the combat test range",currentAction:"Walking",workPose:"walk",workProp:null,
  interactionRadius:84,priority:18,relationship:"Unknown",
  greeting:[`${FACTION_NAMES[faction]} patrol.`,"We're watching the range."],
  seated:false,sandboxPatrol:true,patrolTarget:null,
  squadMission:faction==="northline"?"secure_route":faction==="commune"?"infiltrate_and_ambush":"raid_and_extract",
  alertState:"unaware"
 };
}

export class CombatSandboxDirector{
 constructor(game){
  this.game=game;
  this.started=true;
  this.elapsed=0;
  this.selectedOperationId=null;
  this.operations=[];
  this.teams=[];
  this.wave=0;
  this.maxActiveTeams={northline:3,commune:3,freelancers:3};
  this.reserve={northline:8,commune:8,freelancers:8};
  this.spawnCooldown={northline:0,commune:4,freelancers:8};
  this.initialized=false;
 }
 getOperation(){return null;}
 claim(){return false;}
 get selectedOperation(){return null;}
 start(){
  if(this.initialized)return;
  this.initialized=true;
  for(const faction of ["northline","commune","freelancers"]){
    this.spawnTeam(faction);
    this.spawnTeam(faction);
  }
  this.game.pushMessage("Combat Sandbox active — patrols are entering from three borders",3.5);
 }
 activeTeams(faction){
  return this.teams.filter(team=>team.factionId===faction&&team.memberIds.some(id=>{
    const actor=this.game.actors.find(candidate=>candidate.id===id);
    return actor&&!actor.medical?.dead;
  }));
 }
 spawnTeam(faction){
  if((this.reserve[faction]??0)<=0)return false;
  const entries=ENTRY[faction],spawn=entries[this.wave%entries.length];
  const teamId=`sandbox_team_${faction}_${this.wave++}`;
  const size=2+Math.floor(Math.random()*3);
  const members=[];
  for(let i=0;i<size;i++){
    const actor=actorFrom(faction,teamId,i,spawn,this.wave);
    actor.patrolTarget=PATROLS[(this.wave+i*2)%PATROLS.length];
    actor.x=projectOutsideObstacles(this.game,actor.x,actor.y,actor.radius).x;
    actor.y=projectOutsideObstacles(this.game,actor.x,actor.y,actor.radius).y;
    this.game.actors.push(actor);members.push(actor.id);
  }
  this.teams.push({id:teamId,factionId:faction,memberIds:members});
  this.reserve[faction]--;
  return true;
 }
 updatePatrol(actor,delta){
  if(isImmobileCasualty(actor)||actor.beingDragged||actor.operationPausedByEncounter||actor.medicalAction||actor.actionLock||(actor.tacticalSlotUntil??0)>performance.now()/1000||(actor.tacticalPlanUntil??0)>performance.now()/1000)return;
  if(!actor.patrolTarget||Math.hypot(actor.x-actor.patrolTarget.x,actor.y-actor.patrolTarget.y)<70){
    const base=PATROLS[Math.floor(Math.random()*PATROLS.length)];
    actor.patrolTarget=projectOutsideObstacles(this.game,base.x+(Math.random()-.5)*170,base.y+(Math.random()-.5)*170,actor.radius);
  }
  this.game.actorIntents?.submit?.(actor,createIntent("mission","patrol",INTENT_PRIORITY.PATROL,{
    key:`mission:patrol:${actor.teamId}`,
    destination:actor.patrolTarget,
    speedMultiplier:.58,
    arrivalRadius:55,
    commitSeconds:2.8,
    task:"Patrolling the test range",
    pose:"walk"
  }));
 }
 update(delta){
  this.start();this.elapsed+=delta;
  for(const actor of this.game.actors)if(actor.sandboxPatrol)this.updatePatrol(actor,delta);
  for(const faction of ["northline","commune","freelancers"]){
    this.spawnCooldown[faction]=Math.max(0,this.spawnCooldown[faction]-delta);
    const active=this.activeTeams(faction).length;
    if(active<this.maxActiveTeams[faction]&&this.reserve[faction]>0&&this.spawnCooldown[faction]<=0){
      this.spawnTeam(faction);
      this.spawnCooldown[faction]=28+Math.random()*22;
      this.game.pushMessage(`${FACTION_NAMES[faction]} reinforcements entering the range`,2.3);
    }
  }
 }
}
