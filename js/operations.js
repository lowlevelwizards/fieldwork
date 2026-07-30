import { findEntity } from "./world-entities.js?v=072-faction-confrontation-20260730";

const FACTIONS={northline:"Northline",commune:"Commune",freelancers:"Freelancers"};
const PLAYER_FACTION="commune";

const node=(x,y,label,pose="work",duration=4.2,face=null,prop=null)=>({x,y,label,pose,duration,face,prop});

const TEAM_DEFS=[
 {id:"northline_maintenance_01",factionId:"northline",operationId:"restore_north_culvert",members:[
  {id:"nl_engineer_01",name:"Iris Vale",role:"Engineer",kitId:"northline_standard_light",x:2700,y:1035,speed:62,route:[
   node(3180,1015,"Traveling to culvert","walk"),node(3500,830,"Inspecting drainage","kneel",6,"right","toolbox"),
   node(3820,850,"Waiting for rope","inspect",5,"down"),node(3500,830,"Checking water flow","kneel",6,"right","toolbox")
  ]},
  {id:"nl_carrier_01",name:"Cal Rusk",role:"Carrier",kitId:"northline_standard_mid",x:2650,y:1090,speed:58,route:[
   node(3100,1070,"Carrying tools","carry",4.5,null,"tool_crate"),node(3440,900,"Staging equipment","set_down",5,"right","tool_crate"),
   node(3740,900,"Supporting engineer","brace",5,"right","rope"),node(3440,900,"Sorting tools","sort",5,"down","toolbox")
  ]},
  {id:"nl_security_01",name:"Evan Holt",role:"Security",kitId:"northline_standard_dark",x:2600,y:980,speed:66,route:[
   node(3040,930,"Watching the route","scan",5),node(3450,710,"Observing approach","scan",6),
   node(3600,760,"Holding overwatch","scan",6),node(3360,720,"Checking the roadside","inspect",4.5)
  ]}
 ]},
 {id:"commune_courier_01",factionId:"commune",operationId:"deliver_medical_supplies",members:[
  {id:"commune_courier_01a",name:"Mina Sol",role:"Courier",kitId:"commune_rust_green",x:4180,y:1320,speed:55,route:[
   node(3700,1230,"Carrying medical supplies","carry",4.5,null,"medical_crate"),node(3150,1130,"Seeking a dry route","scan",5),
   node(2500,1180,"Delivering supplies","set_down",6,"left","medical_crate"),node(2850,1160,"Returning for another load","walk")
  ]},
  {id:"commune_medic_01",name:"Jo Fen",role:"Field Medic",kitId:"commune_brown_denim",x:4240,y:1380,speed:60,route:[
   node(3740,1280,"Escorting courier","walk"),node(3200,1170,"Checking the route","inspect",5,"left"),
   node(2540,1220,"Checking shelter stock","kneel",6,"up","medical_bag"),node(2900,1210,"Following up with courier","inspect",5)
  ]},
  {id:"commune_shelter_01",name:"Rin Hale",role:"Shelter Worker",kitId:"commune_green_brown",x:2460,y:1160,speed:48,route:[
   node(2380,1160,"Preparing the shelter","sort",6,"right","blanket"),node(2510,1215,"Sorting dry supplies","sort",6,"down","supply_stack"),
   node(2420,1120,"Checking the approach","scan",5)
  ]}
 ]},
 {id:"freelancer_recovery_01",factionId:"freelancers",operationId:"recover_field_radio",members:[
  {id:"freelancer_scout_01",name:"Sable",role:"Scout",kitId:"freelancer_black_gray",x:4350,y:520,speed:72,route:[
   node(4020,610,"Scouting culvert edge","binoculars",6,"left"),node(3860,730,"Searching for radio","kneel",6,"down"),
   node(3300,600,"Watching other teams","binoculars",6,"left"),node(3820,700,"Rechecking the site","inspect",5,"down")
  ]},
  {id:"freelancer_recovery_01a",name:"Pike",role:"Recovery",kitId:"freelancer_brown_black",x:4410,y:575,speed:65,route:[
   node(4100,660,"Following scout","walk"),node(3980,760,"Recovering field radio","kneel",7,"down","radio"),
   node(3350,650,"Staging equipment","carry",5,null,"salvage"),node(3920,760,"Inspecting salvage","sort",6,"down","salvage")
  ]}
 ]}
];

const MEMBER_LOOKUP=new Map(TEAM_DEFS.flatMap(team=>team.members.map(member=>[member.id,member])));

function makeOperation(id,factionId,title,summary,tasks){return{id,factionId,title,summary,status:"available",claimedBy:null,playerEligible:factionId===PLAYER_FACTION,tasks:tasks.map((t,i)=>({id:`${id}_${i}`,label:t,status:i?"available":"in_progress"})),outcome:null};}
function actorFrom(def,team){return{...def,type:"actor",teamId:team.id,factionId:team.factionId,operationId:team.operationId,width:44,height:70,groundY:def.y+34,radius:18,vx:0,vy:0,moveSpeed:def.speed,facing:"right",walkingPhase:0,backpackLoadRatio:.45,carriedItemInstanceId:null,routeIndex:0,waitTime:0,workPhase:0,motionState:"walking",currentTask:def.route[0].label,currentAction:"Walking",workPose:"walk",workProp:null,interactionRadius:84,priority:18,relationship:"Unknown",greeting:[`${FACTIONS[team.factionId]}. We're working here.`,"Keep the route clear and we'll do the same."],seated:false};}
function face(dx,dy,current){if(Math.hypot(dx,dy)<.1)return current;if(Math.abs(dx)>Math.abs(dy))return dx<0?"left":"right";return dy<0?"up":"down";}

export class OperationSystem{
 constructor(game){this.game=game;this.playerFaction=PLAYER_FACTION;this.started=false;this.elapsed=0;this.rainStarted=false;this.weatherPhase="initial";this.weatherMessagePhase=null;this.selectedOperationId=null;this.teams=[];this.worldState={northlineStaged:false,communeDelivered:false,freelancerRecovered:false};this.operations=[
  makeOperation("restore_north_culvert","northline","Restore North Culvert","Inspect, clear, and reopen the drainage route.",["Travel to culvert","Inspect blockage","Acquire rope","Clear obstruction","Confirm flow","Return"]),
  makeOperation("deliver_medical_supplies","commune","Deliver Medical Supplies","Move a vulnerable crate to the roadside shelter.",["Retrieve crate","Travel safely","Keep supplies dry","Deliver","Check shelter","Return"]),
  makeOperation("recover_field_radio","freelancers","Recover Field Radio","Locate and extract a valuable abandoned radio.",["Locate radio","Assess condition","Recover battery","Carry to exit","Depart"])
 ];}
 start(){if(this.started)return;this.started=true;this.elapsed=0;this.teams=TEAM_DEFS.map(t=>({...t,state:"traveling",memberIds:t.members.map(m=>m.id)}));for(const team of TEAM_DEFS){const op=this.getOperation(team.operationId);op.status="active";for(const def of team.members)this.game.actors.push(actorFrom(def,team));}this.game.pushMessage("Field teams are already working along the route",3.2);this.game.emitEvent("livingOperationsStarted");}
 getOperation(id){return this.operations.find(o=>o.id===id);}
 claim(id){const op=this.getOperation(id);if(!op||!op.playerEligible||!["available","active","blocked"].includes(op.status))return false;this.selectedOperationId=id;op.claimedBy="player";this.game.pushMessage(`Joined Commune operation: ${op.title}`,2.8);return true;}
 get selectedOperation(){return this.getOperation(this.selectedOperationId);}
 completeTask(op,index){if(!op||op.tasks[index]?.status==="completed")return;op.tasks[index].status="completed";if(op.tasks[index+1])op.tasks[index+1].status="in_progress";}
 updateActor(actor,delta){
  const def=MEMBER_LOOKUP.get(actor.id);if(!def)return;
  if(actor.operationPausedByEncounter){
   actor.vx=0;actor.vy=0;actor.groundY=actor.y+actor.radius;
   return;
  }
  const point=def.route[Math.min(actor.routeIndex,def.route.length-1)];if(!point)return;

  actor.currentTask=point.label;
  actor.workPhase+=delta;

  if(actor.motionState==="working"){
   // A working actor is authoritative at the work node. No hidden route motion.
   actor.x=point.x;actor.y=point.y;actor.vx=0;actor.vy=0;
   actor.workPose=point.pose;actor.workProp=point.prop;
   actor.currentAction=point.pose==="scan"||point.pose==="binoculars"?"Observing":point.pose==="kneel"?"Working low":point.pose==="carry"?"Carrying":point.pose==="set_down"?"Unloading":point.pose==="sort"?"Sorting":"Working";
   if(point.face)actor.facing=point.face;
   if(point.pose==="scan"||point.pose==="binoculars"){const cycle=Math.floor(actor.waitTime/1.4)%4;actor.facing=["left","up","right","down"][cycle];}
   actor.waitTime+=delta;
   if(actor.waitTime>=(point.duration??4.2)){
    actor.routeIndex=(actor.routeIndex+1)%def.route.length;
    actor.waitTime=0;actor.workPhase=0;actor.motionState="walking";
    actor.workPose="walk";actor.workProp=null;
   }
  }else{
   const dx=point.x-actor.x,dy=point.y-actor.y,d=Math.hypot(dx,dy);
   if(d<=6){
    actor.x=point.x;actor.y=point.y;actor.vx=0;actor.vy=0;
    actor.motionState="working";actor.waitTime=0;actor.workPhase=0;
    actor.workPose=point.pose;actor.workProp=point.prop;
   }else{
    const weatherFactor=this.game.getWeatherSpeedMultiplier?.()??(this.rainStarted?.92:1);
    const speed=actor.moveSpeed*weatherFactor;
    actor.vx=dx/d*speed;actor.vy=dy/d*speed;
    actor.x+=actor.vx*delta;actor.y+=actor.vy*delta;
    actor.walkingPhase+=delta*8;actor.facing=face(dx,dy,actor.facing);
    actor.currentAction="Walking";actor.workPose=point.pose==="carry"?"carry":"walk";
    actor.workProp=point.pose==="carry"?point.prop:null;
   }
  }
  actor.groundY=actor.y+actor.radius;
 }
 updateNorthline(){const op=this.getOperation("restore_north_culvert");const eng=this.game.actors.find(a=>a.id==="nl_engineer_01"),carrier=this.game.actors.find(a=>a.id==="nl_carrier_01");if(!eng)return;if(eng.routeIndex>=1)this.completeTask(op,0);if(eng.routeIndex>=2){this.completeTask(op,1);this.worldState.northlineStaged=true;const debris=findEntity(this.game.entities,"culvert_debris_01");if(debris?.cleared){this.completeTask(op,2);this.completeTask(op,3);this.completeTask(op,4);op.status="completed";op.outcome="Drainage restored";eng.currentTask="Confirming water flow";eng.workPose="kneel";carrier.workPose="sort";}else{const rope=findEntity(this.game.entities,"rope_001");const unavailable=rope&&(rope.locationType==="hands"||rope.locationType==="backpack");op.status=unavailable?"blocked":"active";op.tasks[2].status=unavailable?"blocked":"in_progress";if(unavailable)eng.currentTask="Waiting for the rope carried by Mara";}}}
 updateCommune(){const op=this.getOperation("deliver_medical_supplies"),courier=this.game.actors.find(a=>a.id==="commune_courier_01a");if(!courier)return;if(courier.routeIndex>=1)this.completeTask(op,0);
  const routeFlooded=this.rainStarted&&this.game.excursion.obstructionState!=="cleared";
  if(routeFlooded&&courier.routeIndex===1){op.status="blocked";op.tasks[1].status="blocked";courier.currentTask="Waiting for the flooded route to open";courier.workPose="scan";return;}
  if(op.status==="blocked"){op.status="active";op.tasks[1].status="in_progress";}
  if(courier.routeIndex>=2){this.completeTask(op,1);this.completeTask(op,2);}
  if(courier.routeIndex>=2&&courier.waitTime>2.6){this.completeTask(op,3);this.completeTask(op,4);op.status="completed";op.outcome=this.rainStarted?"Supplies arrived damp but usable":"Supplies delivered dry";this.worldState.communeDelivered=true;}
 }
 updateFreelancers(){const op=this.getOperation("recover_field_radio"),rec=this.game.actors.find(a=>a.id==="freelancer_recovery_01a");if(!rec)return;
  const northlineInspected=this.getOperation("restore_north_culvert").tasks[1].status==="completed";
  if(!northlineInspected&&rec.routeIndex>=1){op.status="blocked";op.tasks[0].status="blocked";rec.currentTask="Waiting for Northline to finish inspecting the site";rec.workPose="scan";return;}
  if(op.status==="blocked"){op.status="active";op.tasks[0].status="in_progress";}
  if(rec.routeIndex>=1){this.completeTask(op,0);this.completeTask(op,1);}
  if(rec.routeIndex>=2){this.completeTask(op,2);this.completeTask(op,3);op.status="completed";op.outcome="Field radio recovered";this.worldState.freelancerRecovered=true;}
 }
 update(delta){
  if(!this.started){if(this.game.excursion.state==="outbound")this.start();return;}
  this.elapsed+=delta;
  for(const actor of this.game.actors)if(actor.operationId)this.updateActor(actor,delta);

  const water=findEntity(this.game.entities,"culvert_water_01");
  if(this.elapsed<32){
   this.weatherPhase="initial";
  }else if(this.elapsed<45){
   this.weatherPhase="clouding";this.game.weather="Cloudy";
   if(this.weatherMessagePhase!=="clouding"){this.weatherMessagePhase="clouding";this.game.pushMessage("Clouds are moving in.",2.8);}
  }else if(this.elapsed<92){
   this.weatherPhase="rain";this.rainStarted=true;this.game.weather="Rain";
   if(this.weatherMessagePhase!=="rain"){
    this.weatherMessagePhase="rain";
    if(water&&this.game.excursion.obstructionState!=="cleared"){water.depth="rising";water.x-=70;water.y-=35;water.width+=140;water.height+=70;}
    this.game.pushMessage("Rain begins. Low ground is flooding.",3.4);this.game.emitEvent("operationRainStarted");
   }
  }else if(this.elapsed<122){
   this.weatherPhase="heavy_rain";this.rainStarted=true;this.game.weather="Heavy Rain";
   if(this.weatherMessagePhase!=="heavy_rain"){this.weatherMessagePhase="heavy_rain";this.game.pushMessage("The rain intensifies.",2.8);}
  }else if(this.elapsed<146){
   this.weatherPhase="easing";this.game.weather="Rain";
   if(this.weatherMessagePhase!=="easing"){this.weatherMessagePhase="easing";this.game.pushMessage("The rain is easing.",2.8);}
  }else{
   this.weatherPhase="cloudy_after";this.rainStarted=false;this.game.weather="Cloudy";
   if(this.weatherMessagePhase!=="cloudy_after"){this.weatherMessagePhase="cloudy_after";this.game.pushMessage("The rain has stopped.",2.8);}
   if(water&&this.game.excursion.obstructionState==="cleared"){
    water.depth="draining";
    water.width=Math.max(this.game.map.culvert.water.width,water.width-delta*18);
    water.height=Math.max(this.game.map.culvert.water.height,water.height-delta*10);
   }
  }

  this.updateNorthline();this.updateCommune();this.updateFreelancers();
 }
 summary(){return this.operations.map(o=>({id:o.id,title:o.title,faction:FACTIONS[o.factionId],factionId:o.factionId,status:o.status,current:o.tasks.find(t=>["in_progress","blocked"].includes(t.status))?.label??o.outcome??"Complete",claimed:o.claimedBy==="player",playerEligible:o.playerEligible,summary:o.summary}));}
 reportLines(){return this.operations.map(o=>`${FACTIONS[o.factionId]} — ${o.title}: ${o.outcome??(o.status==="blocked"?"Blocked":"Unresolved")}`);}
}
