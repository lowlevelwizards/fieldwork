const rosterMember=(id,name,role,kitId,capabilities)=>({id,name,role,kitId,capabilities});

const northlineRoster=[
  rosterMember("northline_mara","Mara Velez","Route Lead","northline_rifle",{navigation:.88,scouting:.72,observation:.74,security:.72,technicalWork:.38,medical:.28,carrying:.58}),
  rosterMember("northline_owen","Owen Pike","Field Technician","northline_rifle",{navigation:.56,scouting:.42,observation:.55,security:.62,technicalWork:.94,medical:.22,carrying:.66}),
  rosterMember("northline_sable","Sable Hart","Security Operator","northline_rifle",{navigation:.62,scouting:.58,observation:.88,security:.94,technicalWork:.22,medical:.24,carrying:.62}),
  rosterMember("northline_iman","Iman Cross","Field Medic","northline_support",{navigation:.54,scouting:.46,observation:.68,security:.52,technicalWork:.32,medical:.95,carrying:.56}),
  rosterMember("northline_jules","Jules Mercer","Recon Operator","northline_rifle",{navigation:.82,scouting:.94,observation:.91,security:.64,technicalWork:.26,medical:.18,carrying:.48}),
  rosterMember("northline_teo","Teo Ward","Technical Operator","northline_support",{navigation:.52,scouting:.38,observation:.58,security:.56,technicalWork:.86,medical:.34,carrying:.72}),
  rosterMember("northline_ada","Ada Finch","Field Operator","northline_rifle",{navigation:.66,scouting:.62,observation:.66,security:.71,technicalWork:.46,medical:.42,carrying:.64}),
  rosterMember("northline_rowan","Rowan Beck","Heavy Carrier","northline_support",{navigation:.48,scouting:.35,observation:.52,security:.76,technicalWork:.44,medical:.18,carrying:.96}),
  rosterMember("northline_niko","Niko Vale","Reserve Operator","northline_rifle",{navigation:.6,scouting:.55,observation:.63,security:.67,technicalWork:.52,medical:.3,carrying:.61})
];

const communeRoster=[
  rosterMember("commune_lena","Lena Moss","Route Scout","commune_rifle",{navigation:.86,scouting:.92,observation:.82,security:.58,technicalWork:.3,medical:.34,carrying:.52}),
  rosterMember("commune_avi","Avi Reed","Utility Worker","commune_rifle",{navigation:.58,scouting:.44,observation:.58,security:.55,technicalWork:.89,medical:.38,carrying:.7}),
  rosterMember("commune_nia","Nia Sol","Community Guard","commune_rifle",{navigation:.61,scouting:.56,observation:.82,security:.88,technicalWork:.28,medical:.31,carrying:.65}),
  rosterMember("commune_pavel","Pavel Dune","Field Medic","commune_support",{navigation:.55,scouting:.48,observation:.7,security:.48,technicalWork:.34,medical:.96,carrying:.56}),
  rosterMember("commune_rook","Rook Alder","Surveyor","commune_rifle",{navigation:.84,scouting:.86,observation:.94,security:.52,technicalWork:.46,medical:.22,carrying:.46}),
  rosterMember("commune_yara","Yara Bell","Supply Handler","commune_support",{navigation:.56,scouting:.42,observation:.59,security:.57,technicalWork:.48,medical:.32,carrying:.95}),
  rosterMember("commune_emil","Emil North","Repair Worker","commune_rifle",{navigation:.52,scouting:.4,observation:.54,security:.6,technicalWork:.82,medical:.28,carrying:.74}),
  rosterMember("commune_sora","Sora Penn","Field Operator","commune_rifle",{navigation:.68,scouting:.65,observation:.72,security:.68,technicalWork:.44,medical:.45,carrying:.62}),
  rosterMember("commune_cal","Cal Wren","Reserve Operator","commune_rifle",{navigation:.63,scouting:.58,observation:.64,security:.65,technicalWork:.5,medical:.36,carrying:.63})
];

const freelancerRoster=[
  rosterMember("freelancer_kite","Kite Rios","Pathfinder","freelancer_rifle",{navigation:.94,scouting:.9,observation:.82,security:.66,technicalWork:.34,medical:.2,carrying:.58}),
  rosterMember("freelancer_mica","Mica Shaw","Tech Raider","freelancer_rifle",{navigation:.68,scouting:.56,observation:.66,security:.72,technicalWork:.86,medical:.18,carrying:.71}),
  rosterMember("freelancer_voss","Voss Gray","Security Contractor","freelancer_rifle",{navigation:.62,scouting:.6,observation:.86,security:.95,technicalWork:.22,medical:.16,carrying:.68}),
  rosterMember("freelancer_ren","Ren Crow","Combat Medic","freelancer_support",{navigation:.6,scouting:.54,observation:.72,security:.64,technicalWork:.28,medical:.9,carrying:.6}),
  rosterMember("freelancer_izzy","Izzy Pike","Scout","freelancer_rifle",{navigation:.88,scouting:.95,observation:.93,security:.57,technicalWork:.2,medical:.24,carrying:.48}),
  rosterMember("freelancer_dex","Dex Orra","Load Carrier","freelancer_support",{navigation:.57,scouting:.46,observation:.6,security:.7,technicalWork:.46,medical:.18,carrying:.98}),
  rosterMember("freelancer_sam","Sam Quill","Fixer","freelancer_rifle",{navigation:.61,scouting:.48,observation:.62,security:.64,technicalWork:.8,medical:.28,carrying:.69}),
  rosterMember("freelancer_noa","Noa Flint","Field Operator","freelancer_rifle",{navigation:.7,scouting:.68,observation:.72,security:.74,technicalWork:.4,medical:.32,carrying:.64}),
  rosterMember("freelancer_tamsin","Tamsin Ro","Reserve Operator","freelancer_rifle",{navigation:.65,scouting:.61,observation:.68,security:.69,technicalWork:.48,medical:.3,carrying:.66})
];

const objective=(id,name,x,y,{family,kind,propType,state,desiredState,interestKey,value,urgency,workDuration,resourceType=null,resourceAmount=0})=>({
  id,name,x,y,propType,objectiveKind:kind,width:propType==="shelf"?86:propType==="marker"?42:68,height:propType==="shelf"?92:propType==="marker"?78:92,
  interactionRadius:84,securityRadius:310,state,progress:0,
  requirements:{
    inspectDuration:family==="survey"?.8:1.15,
    workDuration,
    inspectionState:family==="infrastructure"?"serviceable":family==="supply"?"accessible":"surveyable",
    workingState:family==="infrastructure"?"being_serviced":family==="supply"?"being_collected":"being_surveyed",
    desiredState,
    workVerb:family==="infrastructure"?"servicing":family==="supply"?"collecting":"surveying",
    completedVerb:family==="infrastructure"?"operational":family==="supply"?"depleted":"verified"
  },
  sandboxNeed:{
    id:`need_${id}`,kind,label:family==="infrastructure"?`Service ${name}`:family==="supply"?`Recover supplies from ${name}`:`Survey ${name}`,
    family,interestKey,strategicValue:value,scoreValue:Math.round(value*100),desiredState,urgency,resourceType,resourceAmount,
    capabilityNeeds:family==="infrastructure"
      ?{technicalWork:.9,navigation:.48,security:.52}
      :family==="supply"
        ?{carrying:.9,navigation:.52,security:.58}
        :{scouting:.88,observation:.82,navigation:.72,security:.4}
  }
});

export const LIVE_SANDBOX_FIXTURE_ID="live_sandbox";

export const LIVE_SANDBOX_FIXTURE=Object.freeze({
  id:LIVE_SANDBOX_FIXTURE_ID,
  index:"LIVE",
  label:"Authority-Constrained Live Sandbox",
  question:"What stories emerge when factions value a shared world, persistent rosters constrain deployment, teams own one governing mission, and operators improvise within explicit responsibilities?",
  purpose:"A broad running toy: three factions, twelve changing objectives, persistent operators, transparent operation scoring, concurrent missions, local autonomy, encounters, return, recovery, experience, score, and continuous world turnover.",
  operatorSpawn:{x:3800,y:2100},
  teams:[],
  objectives:[
    objective("central_field_relay","Central Field Relay",3680,1980,{family:"infrastructure",kind:"restore_infrastructure",propType:"field_relay",state:"offline",desiredState:"operational",interestKey:"communications",value:.95,urgency:.9,workDuration:9}),
    objective("north_generator","North Ridge Generator",2450,720,{family:"infrastructure",kind:"restore_infrastructure",propType:"radio",state:"damaged",desiredState:"operational",interestKey:"power",value:.8,urgency:.68,workDuration:8}),
    objective("river_pump","Riverside Water Pump",5300,1060,{family:"infrastructure",kind:"restore_infrastructure",propType:"field_relay",state:"degraded",desiredState:"operational",interestKey:"water",value:.92,urgency:.84,workDuration:10}),
    objective("south_repeater","South Route Repeater",4100,3480,{family:"infrastructure",kind:"restore_infrastructure",propType:"radio",state:"offline",desiredState:"operational",interestKey:"communications",value:.72,urgency:.58,workDuration:7}),
    objective("clinic_cache","Abandoned Clinic Cache",1670,1280,{family:"supply",kind:"recover_supplies",propType:"shelf",state:"stocked",desiredState:"depleted",interestKey:"medical",value:.9,urgency:.76,workDuration:7,resourceType:"medical",resourceAmount:4}),
    objective("depot_parts","Rail Depot Parts Store",6000,2050,{family:"supply",kind:"recover_supplies",propType:"shelf",state:"stocked",desiredState:"depleted",interestKey:"technical",value:.86,urgency:.7,workDuration:8,resourceType:"technical",resourceAmount:5}),
    objective("orchard_food","Orchard Food Shed",2550,3060,{family:"supply",kind:"recover_supplies",propType:"shelf",state:"low",desiredState:"depleted",interestKey:"food",value:.64,urgency:.54,workDuration:6,resourceType:"food",resourceAmount:3}),
    objective("quarry_fuel","Quarry Fuel Drums",6500,3300,{family:"supply",kind:"recover_supplies",propType:"shelf",state:"stocked",desiredState:"depleted",interestKey:"fuel",value:.78,urgency:.62,workDuration:7.5,resourceType:"fuel",resourceAmount:4}),
    objective("east_crossing","East Flooded Crossing",6750,920,{family:"survey",kind:"survey_route",propType:"marker",state:"unknown",desiredState:"verified",interestKey:"routeIntel",value:.82,urgency:.74,workDuration:6}),
    objective("ridge_trail","Northwest Ridge Trail",1120,650,{family:"survey",kind:"survey_route",propType:"marker",state:"stale",desiredState:"verified",interestKey:"routeIntel",value:.7,urgency:.6,workDuration:5.5}),
    objective("marsh_route","Marsh Service Route",920,3120,{family:"survey",kind:"survey_route",propType:"marker",state:"unknown",desiredState:"verified",interestKey:"hazardIntel",value:.84,urgency:.72,workDuration:6.5}),
    objective("quarry_road","Quarry Access Road",5480,3620,{family:"survey",kind:"survey_route",propType:"marker",state:"partial",desiredState:"verified",interestKey:"routeIntel",value:.66,urgency:.52,workDuration:5})
  ],
  livingSandbox:{
    liveMode:true,
    seed:2101,
    dispatchDelay:.8,
    minimumDispatchGap:1.15,
    postCompletionHold:3.5,
    interruptedReturnHold:1.2,
    blockedRetryDelay:24,
    recoveryDuration:18,
    woundedRecoveryMultiplier:3,
    teamSize:3,
    maxActiveOperations:5,
    contention:{enabled:true,minimumPrimaryAge:1.35,chance:.9,maximumStandoffDuration:180},
    turnover:{enabled:true,minimumInterval:42,maximumInterval:68},
    factions:[
      {id:"northline",label:"Northline",entryPoint:{x:3750,y:260,facing:"down"},contactResolve:.72,riskTolerance:.58,
       resources:{medical:2,technical:4,food:2,fuel:4},
       priorities:{restore_infrastructure:.96,recover_supplies:.58,survey_route:.78},
       interests:{communications:.96,power:.92,water:.72,medical:.62,technical:.9,food:.38,fuel:.86,routeIntel:.82,hazardIntel:.68},roster:northlineRoster},
      {id:"commune",label:"Commune",entryPoint:{x:420,y:2200,facing:"right"},contactResolve:.82,riskTolerance:.42,
       resources:{medical:4,technical:2,food:5,fuel:2},
       priorities:{restore_infrastructure:.78,recover_supplies:.93,survey_route:.65},
       interests:{communications:.7,power:.66,water:.98,medical:.96,technical:.68,food:.92,fuel:.52,routeIntel:.62,hazardIntel:.78},roster:communeRoster},
      {id:"freelancers",label:"Freelancers",entryPoint:{x:7150,y:2200,facing:"left"},contactResolve:.58,riskTolerance:.78,
       resources:{medical:1,technical:3,food:2,fuel:5},
       priorities:{restore_infrastructure:.52,recover_supplies:.98,survey_route:.88},
       interests:{communications:.48,power:.72,water:.52,medical:.78,technical:.98,food:.64,fuel:.94,routeIntel:.9,hazardIntel:.82},roster:freelancerRoster}
    ]
  }
});

const obstacles=[];
for(const [x,y,r] of [
  [1050,1050,78],[1320,980,62],[1850,700,68],[2080,970,74],[2920,1150,66],[3300,780,82],[4510,740,72],[4870,920,64],[5650,720,76],[6200,1100,86],[6880,1450,70],
  [900,2450,82],[1350,2700,70],[1900,2350,64],[2200,3500,76],[3100,3000,74],[3450,3650,68],[4700,3100,82],[5050,2500,70],[5800,2850,76],[6400,2700,68],[7000,3500,82],
  [2900,2050,54],[3250,1900,58],[4380,2050,62],[4750,1900,56],[3650,2700,58],[4100,2700,62]
])obstacles.push({type:r>70?"tree":"rock",x,y,radius:r});

const brush=[];
for(const [x,y,r] of [[1200,1150,170],[2000,850,150],[3050,1050,160],[4700,950,150],[5900,950,180],[6700,1600,150],[1050,2750,170],[1900,2500,150],[2900,3200,180],[4550,3200,165],[5700,3000,180],[6800,3250,160],[3450,2150,125],[4300,2200,130]])brush.push({x,y,radius:r});

export const liveSandboxMap=Object.freeze({
  worldBounds:{width:7600,height:4200},
  spawn:{x:3800,y:2100},
  extraction:{x:3800,y:2100,radius:80},
  road:[{x:0,y:1900},{x:7600,y:1900},{x:7600,y:2260},{x:0,y:2260}],
  shed:{x:9000,y:9000,width:1,height:1,wallThickness:1,doorGap:{side:"bottom",start:0,width:1}},
  site:{name:"Live Sandbox",workArea:{x:0,y:0,width:7600,height:4200},truck:{x:0,y:0,width:0,height:0},breakArea:{x:0,y:0,width:0,height:0},trailhead:{x:3800,y:2100}},
  places:{pull_off:{id:"pull_off",name:"Live Sandbox",bounds:{x:0,y:0,width:7600,height:4200}},north_culvert:{id:"north_culvert",name:"Live Sandbox",bounds:{x:0,y:0,width:7600,height:4200},arrival:{x:3800,y:2100,radius:260}}},
  trail:[{x:400,y:2200},{x:7200,y:2200}],
  culvert:{x:9000,y:9000,width:1,height:1,water:{x:9000,y:9000,width:1,height:1},crossing:{x:9000,y:9000,width:1,height:1}},
  obstacles,
  brush
});
