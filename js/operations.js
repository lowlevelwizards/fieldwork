import { findEntity } from "./world-entities.js";

const FACTIONS={northline:"Northline",commune:"Commune",freelancers:"Freelancers"};
const PLAYER_FACTION="commune";

const TEAM_DEFS=[
 {id:"northline_maintenance_01",factionId:"northline",operationId:"restore_north_culvert",members:[
  {id:"nl_engineer_01",name:"Iris Vale",role:"Engineer",kitId:"northline_engineer",x:2700,y:1035,speed:62,route:[[3180,1015,"Traveling to culvert"],[3500,830,"Inspecting drainage"],[3820,850,"Waiting for rope"],[3500,830,"Checking water flow"]]},
  {id:"nl_carrier_01",name:"Cal Rusk",role:"Carrier",kitId:"northline_carrier",x:2650,y:1090,speed:58,route:[[3100,1070,"Carrying tools"],[3440,900,"Staging equipment"],[3740,900,"Supporting engineer"],[3440,900,"Sorting tools"]]},
  {id:"nl_security_01",name:"Evan Holt",role:"Security",kitId:"northline_security",x:2600,y:980,speed:66,route:[[3040,930,"Watching the route"],[3450,710,"Observing approach"],[3600,760,"Holding overwatch"],[3360,720,"Checking the roadside"]]}
 ]},
 {id:"commune_courier_01",factionId:"commune",operationId:"deliver_medical_supplies",members:[
  {id:"commune_courier_01a",name:"Mina Sol",role:"Courier",kitId:"commune_courier",x:4180,y:1320,speed:55,route:[[3700,1230,"Carrying medical supplies"],[3150,1130,"Seeking a dry route"],[2500,1180,"Delivering supplies"],[2850,1160,"Returning for another load"]]},
  {id:"commune_medic_01",name:"Jo Fen",role:"Field Medic",kitId:"commune_medic",x:4240,y:1380,speed:60,route:[[3740,1280,"Escorting courier"],[3200,1170,"Checking the route"],[2540,1220,"Checking shelter stock"],[2900,1210,"Following up with courier"]]},
  {id:"commune_shelter_01",name:"Rin Hale",role:"Shelter Worker",kitId:"commune_courier",x:2460,y:1160,speed:48,route:[[2380,1160,"Preparing the shelter"],[2510,1215,"Sorting dry supplies"],[2420,1120,"Checking the approach"]]}
 ]},
 {id:"freelancer_recovery_01",factionId:"freelancers",operationId:"recover_field_radio",members:[
  {id:"freelancer_scout_01",name:"Sable",role:"Scout",kitId:"freelancer_scout",x:4350,y:520,speed:72,route:[[4020,610,"Scouting culvert edge"],[3860,730,"Searching for radio"],[3300,600,"Watching other teams"],[3820,700,"Rechecking the site"]]},
  {id:"freelancer_recovery_01a",name:"Pike",role:"Recovery",kitId:"freelancer_recovery",x:4410,y:575,speed:65,route:[[4100,660,"Following scout"],[3980,760,"Recovering field radio"],[3350,650,"Staging equipment"],[3920,760,"Inspecting salvage"]]}
 ]}
];

function makeOperation(id,factionId,title,summary,tasks){return{id,factionId,title,summary,status:"available",claimedBy:null,playerEligible:factionId===PLAYER_FACTION,tasks:tasks.map((t,i)=>({id:`${id}_${i}`,label:t,status:i?"available":"in_progress"})),outcome:null};}
function actorFrom(def,team){return{...def,type:"actor",teamId:team.id,factionId:team.factionId,operationId:team.operationId,width:44,height:70,groundY:def.y+34,radius:18,vx:0,vy:0,moveSpeed:def.speed,facing:"right",walkingPhase:0,backpackLoadRatio:.45,carriedItemInstanceId:null,routeIndex:0,waitTime:0,currentTask:def.route[0][2],currentAction:"Walking",interactionRadius:78,priority:18,relationship:"Unknown",greeting:[`${FACTIONS[team.factionId]}. We're working here.`,"Keep the route clear and we'll do the same."],seated:false};}
function face(dx,dy,current){if(Math.hypot(dx,dy)<.1)return current;if(Math.abs(dx)>Math.abs(dy))return dx<0?"left":"right";return dy<0?"up":"down";}

export class OperationSystem{
 constructor(game){this.game=game;this.playerFaction=PLAYER_FACTION;this.started=false;this.elapsed=0;this.rainStarted=false;this.selectedOperationId=null;this.teams=[];this.operations=[
  makeOperation("restore_north_culvert","northline","Restore North Culvert","Inspect, clear, and reopen the drainage route.",["Travel to culvert","Inspect blockage","Acquire rope","Clear obstruction","Confirm flow","Return"]),
  makeOperation("deliver_medical_supplies","commune","Deliver Medical Supplies","Move a vulnerable crate to the roadside shelter.",["Retrieve crate","Travel safely","Keep supplies dry","Deliver","Check shelter","Return"]),
  makeOperation("recover_field_radio","freelancers","Recover Field Radio","Locate and extract a valuable abandoned radio.",["Locate radio","Assess condition","Recover battery","Carry to exit","Depart"])
 ];}
 start(){if(this.started)return;this.started=true;this.elapsed=0;this.teams=TEAM_DEFS.map(t=>({...t,state:"traveling",memberIds:t.members.map(m=>m.id)}));for(const team of TEAM_DEFS){const op=this.getOperation(team.operationId);op.status="active";for(const def of team.members)this.game.actors.push(actorFrom(def,team));}this.game.pushMessage("Field teams are already working along the route",3.2);this.game.emitEvent("livingOperationsStarted");}
 getOperation(id){return this.operations.find(o=>o.id===id);}
 claim(id){const op=this.getOperation(id);if(!op||!op.playerEligible||!["available","active","blocked"].includes(op.status))return false;this.selectedOperationId=id;op.claimedBy="player";this.game.pushMessage(`Joined Commune operation: ${op.title}`,2.8);return true;}
 get selectedOperation(){return this.getOperation(this.selectedOperationId);}
 completeTask(op,index){if(!op||op.tasks[index]?.status==="completed")return;op.tasks[index].status="completed";if(op.tasks[index+1])op.tasks[index+1].status="in_progress";}
 updateActor(actor,delta){const def=TEAM_DEFS.flatMap(t=>t.members).find(m=>m.id===actor.id);if(!def)return;const point=def.route[Math.min(actor.routeIndex,def.route.length-1)];if(!point)return;const [tx,ty,label]=point;actor.currentTask=label;const dx=tx-actor.x,dy=ty-actor.y,d=Math.hypot(dx,dy);actor.vx=0;actor.vy=0;
  if(d>6){const speed=actor.moveSpeed*(this.rainStarted?.82:1);actor.vx=dx/d*speed;actor.vy=dy/d*speed;actor.x+=actor.vx*delta;actor.y+=actor.vy*delta;actor.walkingPhase+=delta*8;actor.facing=face(dx,dy,actor.facing);actor.currentAction="Walking";}
  else{actor.currentAction=label.includes("Waiting")?"Waiting":label.includes("Inspect")||label.includes("Checking")||label.includes("Sorting")?"Inspecting":label.includes("Recover")?"Recovering":"Working";actor.waitTime+=delta;if(actor.waitTime>4.2){actor.routeIndex=(actor.routeIndex+1)%def.route.length;actor.waitTime=0;}}
  actor.groundY=actor.y+actor.radius;
 }
 updateNorthline(){const op=this.getOperation("restore_north_culvert");const eng=this.game.actors.find(a=>a.id==="nl_engineer_01");if(!eng)return;if(eng.routeIndex>=1)this.completeTask(op,0);if(eng.routeIndex>=2){this.completeTask(op,1);const debris=findEntity(this.game.entities,"culvert_debris_01");if(debris?.cleared){this.completeTask(op,2);this.completeTask(op,3);this.completeTask(op,4);op.status="completed";op.outcome="Drainage restored";eng.currentTask="Confirming water flow";}
   else{const rope=findEntity(this.game.entities,"rope_001");const unavailable=rope&&(rope.locationType==="hands"||rope.locationType==="backpack");op.status=unavailable?"blocked":"active";op.tasks[2].status=unavailable?"blocked":"in_progress";if(unavailable)eng.currentTask="Blocked: rope carried by player";}}
 }
 updateCommune(){const op=this.getOperation("deliver_medical_supplies"),courier=this.game.actors.find(a=>a.id==="commune_courier_01a");if(!courier)return;if(courier.routeIndex>=1)this.completeTask(op,0);if(courier.routeIndex>=2){this.completeTask(op,1);this.completeTask(op,2);}if(courier.routeIndex>=2&&courier.waitTime>2.6){this.completeTask(op,3);this.completeTask(op,4);op.status="completed";op.outcome=this.rainStarted?"Supplies arrived damp but usable":"Supplies delivered dry";}}
 updateFreelancers(){const op=this.getOperation("recover_field_radio"),rec=this.game.actors.find(a=>a.id==="freelancer_recovery_01a");if(!rec)return;if(rec.routeIndex>=1){this.completeTask(op,0);this.completeTask(op,1);}if(rec.routeIndex>=2){this.completeTask(op,2);this.completeTask(op,3);op.status="completed";op.outcome="Field radio recovered";}}
 update(delta){if(!this.started){if(this.game.excursion.state==="outbound")this.start();return;}this.elapsed+=delta;for(const actor of this.game.actors)if(actor.operationId)this.updateActor(actor,delta);if(!this.rainStarted&&this.elapsed>42){this.rainStarted=true;this.game.weather="Rain";const water=findEntity(this.game.entities,"culvert_water_01");if(water&&this.game.excursion.obstructionState!=="cleared"){water.depth="rising";water.x-=70;water.y-=35;water.width+=140;water.height+=70;}this.game.pushMessage("Rain begins. Low ground is flooding.",3.4);this.game.emitEvent("operationRainStarted");}
  this.updateNorthline();this.updateCommune();this.updateFreelancers();}
 summary(){return this.operations.map(o=>({id:o.id,title:o.title,faction:FACTIONS[o.factionId],factionId:o.factionId,status:o.status,current:o.tasks.find(t=>["in_progress","blocked"].includes(t.status))?.label??o.outcome??"Complete",claimed:o.claimedBy==="player",playerEligible:o.playerEligible,summary:o.summary}));}
 reportLines(){return this.operations.map(o=>`${FACTIONS[o.factionId]} — ${o.title}: ${o.outcome??(o.status==="blocked"?"Blocked":"Unresolved")}`);}
}
