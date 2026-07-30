import { getItemDefinition } from "../data/items.js";

const ITEM_SIZES = { radio_battery:[28,18], bandage:[22,14], compass:[18,18], water_bottle:[18,28], rope_bundle:[26,18], service_case:[68,34] };
function makeItem(id,definitionId,x,y,locationType,ownerId=null,visibility="visible") { const def=getItemDefinition(definitionId); const [width,height]=ITEM_SIZES[definitionId]; return { id,type:"item",name:def.name,definitionId,x,y,width,height,groundY:y+height,interactionRadius:82,collision:false,state:locationType,locationType,locationOwnerId:ownerId,visibility,revealed:visibility==="visible",priority:42,condition:"dry" }; }
function makeContainer({id,containerType,name,x,y,width,height,searchDuration=1.4,itemInstanceIds=[],state="closed",collision=true,priority=26,anchors=[]}) { return {id,type:"container",containerType,name,x,y,width,height,groundY:y+height,interactionRadius:94,collision,state,animation:state==="open"?1:0,searchProgress:0,searchDuration,searched:false,priority,itemInstanceIds,anchors}; }
function makeProp({id,propType,name,x,y,width,height,interaction=null,text="",collision=false,priority=8,revealed=true}) { return {id,type:"prop",propType,name,x,y,width,height,groundY:y+height,interactionRadius:96,collision,interaction,text,priority,revealed}; }

export const siteLayouts=[{id:"A",battery:"locker_01",compass:"crate_01",bandage2:"duffel_01"},{id:"B",battery:"crate_01",compass:"locker_01",bandage2:"tote_01"},{id:"C",battery:"truck_box_01",compass:"crate_01",bandage2:"locker_01"}];

export function createWorldEntities(map,layoutIndex=0){
 const layout=siteLayouts[layoutIndex%siteLayouts.length],s=map.shed,doorX=s.x+s.doorGap.start,doorY=s.y+s.height-s.wallThickness;
 const containers=[
  makeContainer({id:"crate_01",containerType:"crate",name:"Supply Crate",x:s.x+62,y:s.y+116,width:78,height:52,searchDuration:1.25,anchors:[{x:12,y:43},{x:42,y:44},{x:66,y:42}]}),
  makeContainer({id:"locker_01",containerType:"locker",name:"Metal Locker",x:s.x+260,y:s.y+54,width:60,height:122,searchDuration:1.85,anchors:[{x:12,y:89},{x:35,y:92}]}),
  makeContainer({id:"tote_01",containerType:"tote",name:"Storage Tote",x:1270,y:530,width:70,height:42,searchDuration:.95,anchors:[{x:15,y:34},{x:49,y:35}]}),
  makeContainer({id:"duffel_01",containerType:"duffel",name:"Duffel Bag",x:1215,y:1185,width:72,height:36,searchDuration:.8,collision:false,anchors:[{x:18,y:27},{x:50,y:27}]}),
  makeContainer({id:"truck_box_01",containerType:"truck_box",name:"Truck Storage",x:888,y:695,width:92,height:48,searchDuration:1.45,anchors:[{x:16,y:38},{x:50,y:38}]}),
  makeContainer({id:"workbench_drawer_01",containerType:"drawer",name:"Workbench Drawer",x:1290,y:438,width:94,height:38,searchDuration:1.2,anchors:[{x:20,y:31},{x:61,y:31}]})
 ];
 const placement=new Map(),add=(cid,iid,did,v="hidden")=>{if(!placement.has(cid))placement.set(cid,[]);placement.get(cid).push({itemId:iid,definitionId:did,visibility:v});};
 add(layout.battery,"battery_001","radio_battery");add(layout.compass,"compass_001","compass");add("tote_01","bandage_001","bandage");add("duffel_01","water_001","water_bottle");add("workbench_drawer_01","rope_001","rope_bundle");add(layout.bandage2,"bandage_002","bandage");
 const items=[];for(const c of containers){const assigned=placement.get(c.id)??[];c.itemInstanceIds=assigned.map(e=>e.itemId);assigned.forEach((e,i)=>{const a=c.anchors[i]??{x:18+i*24,y:c.height-8};items.push(makeItem(e.itemId,e.definitionId,c.x+a.x,c.y+a.y,"container",c.id,e.visibility));});}
 items.push(makeItem("water_visible_01","water_bottle",1388,448,"world"));
 items.push(makeItem("service_case_01","service_case",3990,760,"world"));
 return [
  {id:"shed_door_01",type:"door",name:"Shed Door",x:doorX,y:doorY,width:s.doorGap.width,height:s.wallThickness,groundY:doorY+s.wallThickness,interactionRadius:92,collision:true,state:"closed",animation:0,priority:34},
  ...containers,...items,
  makeProp({id:"trail_sign_01",propType:"sign",name:"North Route Board",x:2220,y:1000,width:92,height:88,interaction:"read",collision:true,priority:24,text:"NORTH CULVERT\n\nDrainage obstruction reported. Suggested: rope, water, compass, basic medical supply."}),
  makeProp({id:"radio_cradle_01",propType:"radio",name:"Empty Radio Cradle",x:1410,y:430,width:58,height:34,interaction:"examine",text:"A clean rectangle marks where a field radio once sat. The battery lead is still connected."}),
  makeProp({id:"truck_01",propType:"truck",name:"Maintenance Truck",x:720,y:650,width:340,height:158,interaction:"examine",collision:true,text:"The cab is empty. The rear storage box is still latched."}),
  makeProp({id:"picnic_01",propType:"picnic",name:"Break Table",x:1120,y:1110,width:300,height:120,interaction:"examine",collision:true,text:"A ring from a metal cup stains the tabletop."}),
  makeProp({id:"shelf_01",propType:"shelf",name:"Open Shelf",x:1360,y:392,width:130,height:72,interaction:"examine",collision:true,text:"Most of the shelf has been cleared. One bottle was left behind."}),
  makeProp({id:"culvert_marker_01",propType:"sign",name:"North Culvert Marker",x:3650,y:690,width:74,height:76,interaction:"examine",collision:true,text:"Marker 7N. The waterline is well above the painted service mark."}),
  makeProp({id:"culvert_inspect_01",propType:"culvert",name:"Blocked Culvert",x:3890,y:900,width:170,height:120,interaction:"inspect_culvert",collision:true,priority:36,text:"Branches and silt choke the grate."}),
  makeProp({id:"culvert_debris_01",propType:"debris",name:"Branch Fall",x:3720,y:930,width:180,height:62,interaction:"debris",collision:true,priority:32,text:"The debris could be pulled clear with rope."}),
  {id:"culvert_water_01",type:"hazard",hazardType:"water",name:"Flooded Crossing",x:map.culvert.water.x,y:map.culvert.water.y,width:map.culvert.water.width,height:map.culvert.water.height,groundY:map.culvert.water.y+map.culvert.water.height,interactionRadius:0,collision:false,depth:"shallow",revealed:true},
  makeProp({id:"hazard_marker_01",propType:"marker",name:"Hazard Marker",x:3690,y:840,width:38,height:54,collision:false,revealed:false}),
  makeProp({id:"return_branch_01",propType:"debris",name:"Fresh Fallen Branch",x:3100,y:1045,width:210,height:58,interaction:"examine",collision:false,revealed:false,text:"Fresh break. The rain brought it down after you passed."}),
  makeProp({id:"recovery_area_01",propType:"recovery",name:"Recovered Supplies Area",x:350,y:1000,width:190,height:90,interaction:"examine",collision:false,text:"A dry patch beside the return zone is reserved for recovered cargo."})
 ];
}
export function findEntity(entities,id){return entities.find(e=>e.id===id)??null;}
export function getAvailableAction(entity,game){
 if(!entity||entity.revealed===false)return null;
 if(entity.type==="actor"){if(entity.id==="worker_ada"){const held=game.getHeldItem();if(!entity.assessed)return{id:"assess",label:"Assess"};if(held?.definitionId==="bandage"&&!game.incident.bandageUsed)return{id:"use_bandage",label:"Bandage"};if(held?.definitionId==="water_bottle"&&!game.incident.waterUsed)return{id:"give_water",label:"Give Water"};if(game.incident.bandageUsed&&!game.incident.workerSheltered&&!game.assistedActorId)return{id:"assist",label:"Assist"};if(game.assistedActorId===entity.id)return{id:"release_assist",label:"Let Go"};return{id:"talk",label:"Talk"};}return{id:"talk",label:"Talk"};}
 if(entity.type==="door"){if(entity.state==="closed")return{id:"open",label:"Open"};if(entity.state==="open")return{id:"close",label:"Close"};}
 if(entity.type==="container"){if(entity.state==="closed")return{id:"open_container",label:"Open"};if(entity.state==="open"&&!entity.searched)return{id:"search",label:"Search",hold:true};if(entity.state==="open"&&entity.searched)return{id:"close_container",label:"Close"};}
 if(entity.id==="trail_sign_01"&&game.excursion.available)return{id:"review_route",label:"Review Route"};
 if(entity.id==="culvert_inspect_01"&&["outbound","at_destination"].includes(game.excursion.state))return{id:"inspect_culvert",label:"Inspect Culvert"};
 if(entity.id==="culvert_debris_01"&&game.excursion.culvertInspected){const held=game.getHeldItem();if(held?.definitionId==="rope_bundle"&&game.excursion.obstructionState!=="cleared")return{id:"clear_debris",label:"Rig Rope"};if(game.excursion.obstructionState==="unknown")return{id:"mark_hazard",label:"Mark Hazard"};}
 if(entity.id==="radio_cradle_01"){const held=game.getHeldItem();if(!game.incident.radioRestored&&held?.definitionId==="radio_battery")return{id:"install_battery",label:"Install Battery"};}
 if(entity.type==="prop"&&entity.interaction)return{id:entity.interaction,label:entity.interaction==="read"?"Read":"Examine"};
 if(entity.type==="item"&&entity.locationType==="world"&&entity.revealed){const def=getItemDefinition(entity.definitionId);if(def.backpackEligible===false&&!game.operator.carriedItemInstanceId)return{id:"take",label:"Lift"};const used=game.inventory?.getUsedPips?.()??0;if(def.backpackEligible!==false&&used+def.sizePips<=game.backpack.capacityPips)return{id:"pack",label:"Pack"};if(!game.operator.carriedItemInstanceId)return{id:"take",label:"Take"};return{id:"occupied",label:"Hands Occupied",disabled:true};}
 return null;
}
