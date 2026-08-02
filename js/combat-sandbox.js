import { projectOutsideObstacles } from "./actor-motion.js?v=20j-observable-activity-intent-hypotheses-20260802";

const FACTION_NAMES={northline:"Northline",commune:"Commune",freelancers:"Freelancers"};
const KITS={
 northline:["northline_standard_light","northline_standard_mid","northline_standard_dark"],
 commune:["commune_rust_green","commune_brown_denim","commune_green_brown"],
 freelancers:["freelancer_gray_black","freelancer_brown_gray","freelancer_black_brown"]
};
const DEFAULT_ROLES={
 northline:["Security","Engineer","Rifleman"],
 commune:["Scout","Field Medic","Rifleman"],
 freelancers:["Recovery","Scout","Security"]
};
const NAMES={
 northline:["Iris Vale","Evan Holt","Cal Rusk","Mara Dene","Oren Pike","Sia North"],
 commune:["Mina Sol","Jo Fen","Tavi Reed","Nessa Row","Ari Moss","Pax Linden"],
 freelancers:["Rook Hale","Vera Pike","Dax Mercer","Ivo Gray","Caro Flint","Sable Knox"]
};

export const SANDBOX_FIXTURE_IDS={
 OPEN_CONTACT:"open_contact",
 OBSERVATION:"observation",
 COVER_POSITION:"cover_position",
 CASUALTY_RECOVERY:"casualty_recovery"
};

export const SANDBOX_FIXTURES={
 [SANDBOX_FIXTURE_IDS.OPEN_CONTACT]:{
  id:SANDBOX_FIXTURE_IDS.OPEN_CONTACT,
  index:"01",
  label:"Open Contact",
  shortLabel:"Open contact",
  zoneId:"open_contact",
  question:"What happens when two small teams recognize one another with no useful cover nearby?",
  purpose:"Isolate recognition, reaction delay, opportunity fire, and the first movement toward safety.",
  operatorSpawn:{x:570,y:1760},
  teams:[
   {
    factionId:"northline",mission:"Establish visible control of the lane",task:"Hold the north marker and identify approaching personnel",facing:"down",
    actors:[{x:420,y:430,role:"Security"},{x:570,y:405,role:"Rifleman"},{x:720,y:430,role:"Engineer"}]
   },
   {
    factionId:"commune",mission:"Move through the lane without unnecessary losses",task:"Cross north while preserving the team",facing:"up",
    actors:[{x:420,y:1320,role:"Scout"},{x:570,y:1345,role:"Field Medic"},{x:720,y:1320,role:"Rifleman"}]
   }
  ]
 },
 [SANDBOX_FIXTURE_IDS.OBSERVATION]:{
  id:SANDBOX_FIXTURE_IDS.OBSERVATION,
  index:"02",
  label:"Observation & Concealment",
  shortLabel:"Observation",
  zoneId:"observation",
  question:"What can each team personally observe, and what remains uncertain behind concealment?",
  purpose:"Isolate facing, sight, concealment, personal knowledge, and eventual communication.",
  operatorSpawn:{x:1580,y:1760},
  teams:[
   {
    factionId:"northline",mission:"Inspect reports of movement near the brush line",task:"Observe the southern approach without overextending",facing:"down",
    aiV2Mission:{
     id:"northline_observation_security",
     title:"Secure the southern approach",
     objective:"Maintain awareness of the southern approach and identify uncontrolled armed movement before it reaches the team.",
     immediateTask:"Determine whether a reported group occupies the monitored approach.",
     successCondition:"The approach remains observed and relevant armed movement is recognized.",
     abortCondition:"The team can no longer maintain observation of the approach.",
     concernArea:{type:"circle",label:"southern monitored approach",x:1390,y:1290,radius:520,falloff:260},
     missionSensitivity:.92,
     minimumRelevantConfidence:8,
     incompatibleConfidence:18,
     staleAfter:18,
     forgetAfter:38,
     interference:{
      kind:"uncontrolled_armed_presence",
      label:"May compromise approach security",
      reason:"An unknown armed group is inside the approach Northline is responsible for monitoring."
     },
     decisionContext:{
      missionValue:.9,
      teamPreservation:.7,
      informationNeed:.85,
      positionSecurity:.75,
      concealmentValue:.2,
      detectionRisk:.35,
      timePressure:.3,
      resourceConservation:.7,
      exitOptions:.7,
      enemyDisruption:.5,
      securityOrientation:.95,
      stealthOrientation:.25,
      mobilityOrientation:.3,
      positionLabel:"the established observation line",
      exitLabel:"the rear approach"
     },
     responsePolicy:{minimumHold:6,reassessEvery:3,switchMargin:.08},
     responseBias:{heighten_watch:.1,continue_observation:.03,warn:.01}
    },
    actors:[
     {x:1550,y:450,role:"Security",aiV2Assignment:{
      mission:"Inspect reports of movement near the brush line",
      task:"Determine whether anyone is present on the southern approach",
      procedure:"Observation Watch",
      phase:"Observe",
      role:"Observer",
      action:"observe_sector",
      reason:"Assigned to watch the southern brush approach before the team commits",
      sector:{label:"Southern security movement",x:1550,y:1340,targetFactionId:"commune",maximumRange:1180,fieldOfViewDegrees:72},
      report:{method:"local_voice",range:380,minimumConfidence:35,reason:"Share a credible contact with nearby team members"}
     }},
     {x:1660,y:405,role:"Rifleman"},
     {x:1820,y:450,role:"Engineer"}
    ]
   },
   {
    factionId:"commune",mission:"Watch the patrol while remaining concealed",task:"Learn the patrol's direction and report it",facing:"up",
    aiV2Mission:{
     id:"commune_concealed_watch",
     title:"Maintain concealed observation",
     objective:"Observe the northern patrol while preserving concealment and the option to withdraw unseen.",
     immediateTask:"Determine whether the reported group can compromise the concealed watch.",
     successCondition:"Useful patrol information is retained without exposing the team.",
     abortCondition:"The concealed position is compromised or a safe withdrawal is no longer available.",
     concernArea:{type:"circle",label:"northern patrol observation area",x:1660,y:405,radius:520,falloff:260},
     missionSensitivity:.88,
     minimumRelevantConfidence:8,
     incompatibleConfidence:18,
     staleAfter:18,
     forgetAfter:38,
     interference:{
      kind:"concealment_compromise",
      label:"May compromise concealed observation",
      reason:"An unknown armed group occupies the patrol area under observation and may discover the concealed watch."
     },
     decisionContext:{
      missionValue:.72,
      teamPreservation:.9,
      informationNeed:.8,
      positionSecurity:.68,
      concealmentValue:.95,
      detectionRisk:.85,
      timePressure:.2,
      resourceConservation:.8,
      exitOptions:.85,
      enemyDisruption:.18,
      securityOrientation:.35,
      stealthOrientation:.95,
      mobilityOrientation:.8,
      positionLabel:"the concealed brush position",
      exitLabel:"the covered southern withdrawal route"
     },
     responsePolicy:{minimumHold:6,reassessEvery:3,switchMargin:.08},
     responseBias:{maintain_concealment:.03,continue_observation:.03}
    },
    actors:[
     {x:1450,y:1280,role:"Scout",aiV2Assignment:{
      mission:"Watch the patrol while remaining concealed",
      task:"Determine the patrol's position and direction without revealing the team",
      procedure:"Observation Watch",
      phase:"Observe",
      role:"Observer",
      action:"observe_sector",
      reason:"Assigned to watch the northern patrol approach from concealment",
      sector:{label:"Northern security movement",x:1660,y:405,targetFactionId:"northline",maximumRange:1180,fieldOfViewDegrees:72},
      report:{method:"local_voice",range:380,minimumConfidence:35,reason:"Share a credible contact with nearby team members"}
     }},
     {x:1550,y:1340,role:"Rifleman"},
     {x:1710,y:1300,role:"Field Medic"}
    ]
   }
  ]
 },
 [SANDBOX_FIXTURE_IDS.COVER_POSITION]:{
  id:SANDBOX_FIXTURE_IDS.COVER_POSITION,
  index:"03",
  label:"Cover & Position",
  shortLabel:"Cover position",
  zoneId:"cover_position",
  question:"Can a team choose, occupy, and remain in useful positions without crowding or pacing?",
  purpose:"Isolate directional cover, finite slots, firing utility, reservations, and position persistence.",
  operatorSpawn:{x:2700,y:1760},
  teams:[
   {
    factionId:"northline",mission:"Hold the northern position",task:"Use the cover line to deny the lane",facing:"down",
    actors:[{x:2450,y:565,role:"Security"},{x:2700,y:540,role:"Rifleman"},{x:2950,y:575,role:"Engineer"}]
   },
   {
    factionId:"commune",mission:"Find a safe route through the defended position",task:"Observe, displace, or bypass the defenders",facing:"up",
    actors:[{x:2450,y:1335,role:"Scout"},{x:2700,y:1360,role:"Field Medic"},{x:2950,y:1335,role:"Rifleman"}]
   }
  ]
 },
 [SANDBOX_FIXTURE_IDS.CASUALTY_RECOVERY]:{
  id:SANDBOX_FIXTURE_IDS.CASUALTY_RECOVERY,
  index:"04",
  label:"Casualty Recovery",
  shortLabel:"Casualty recovery",
  zoneId:"casualty_recovery",
  question:"How does a team preserve a critical person while pressure threatens the mission?",
  purpose:"Isolate casualty recognition, responder assignment, security, dragging, treatment, and withdrawal.",
  operatorSpawn:{x:3800,y:1760},
  teams:[
   {
    factionId:"northline",mission:"Maintain pressure on the southern lane",task:"Observe and deny movement through the casualty bay",facing:"down",
    actors:[{x:3550,y:430,role:"Security"},{x:3750,y:405,role:"Rifleman"},{x:3950,y:440,role:"Engineer"}]
   },
   {
    factionId:"commune",mission:"Recover the casualty and preserve the team",task:"Secure access, move the patient, stabilize, and withdraw",facing:"up",
    actors:[
     {x:3540,y:1325,role:"Security"},
     {x:3810,y:1360,role:"Field Medic"},
     {x:3740,y:965,role:"Rifleman",medicalPreset:"critical"}
    ]
   }
  ]
 }
};

export function getSandboxFixture(id){
 return SANDBOX_FIXTURES[id]??SANDBOX_FIXTURES[SANDBOX_FIXTURE_IDS.OPEN_CONTACT];
}

export const sandboxMap={
 sandboxLayout:{
  name:"Fieldwork Behavior Lab",
  subtitle:"One question at a time",
  controlWalk:{x:70,y:1570,width:4260,height:320},
  zones:[
   {id:"open_contact",index:"01",name:"OPEN CONTACT",x:100,y:170,width:940,height:1320},
   {id:"observation",index:"02",name:"OBSERVATION",x:1100,y:170,width:940,height:1320},
   {id:"cover_position",index:"03",name:"COVER & POSITION",x:2100,y:170,width:1160,height:1320},
   {id:"casualty_recovery",index:"04",name:"CASUALTY RECOVERY",x:3320,y:170,width:980,height:1320}
  ],
  northLine:{y:360,label:"NORTH / PRESSURE"},
  southLine:{y:1410,label:"SOUTH / RESPONSE"}
 },
 spawn:{x:570,y:1760},
 extraction:{x:180,y:1760,radius:72},
 road:[{x:0,y:825},{x:4400,y:825},{x:4400,y:1065},{x:0,y:1065}],
 shed:{x:5000,y:5000,width:1,height:1,wallThickness:1,doorGap:{side:"bottom",start:0,width:1}},
 site:{
  name:"Fieldwork Behavior Lab",
  workArea:{x:80,y:1550,width:4240,height:350},
  truck:{x:0,y:0,width:0,height:0},
  breakArea:{x:0,y:0,width:0,height:0},
  trailhead:{x:100,y:1760}
 },
 places:{
  pull_off:{id:"pull_off",name:"Behavior Lab",bounds:{x:0,y:0,width:4400,height:2000}},
  north_culvert:{id:"north_culvert",name:"Behavior Lab",bounds:{x:0,y:0,width:4400,height:2000},arrival:{x:2200,y:1000,radius:260}}
 },
 trail:[{x:100,y:1760},{x:4300,y:1760}],
 culvert:{x:5000,y:5000,width:1,height:1,water:{x:5000,y:5000,width:1,height:1},crossing:{x:5000,y:5000,width:1,height:1}},
 obstacles:[
  // Observation bay: irregular concealment with incomplete sight lines.
  {type:"tree",x:1260,y:650,radius:58},{type:"tree",x:1460,y:770,radius:66},
  {type:"tree",x:1710,y:705,radius:62},{type:"tree",x:1910,y:820,radius:58},
  {type:"tree",x:1840,y:1180,radius:45},
  // 2.0J activity fixture: block each security responsibility from its start while leaving the opposing observer's sight line open.
  {type:"tree",x:1815,y:575,radius:48},{type:"tree",x:1355,y:1180,radius:48},
  // Cover bay: three deliberately separated positions on each side.
  {type:"rock",x:2450,y:700,radius:54},{type:"rock",x:2700,y:690,radius:64},{type:"rock",x:2950,y:710,radius:54},
  {type:"rock",x:2450,y:1190,radius:54},{type:"rock",x:2700,y:1200,radius:64},{type:"rock",x:2950,y:1185,radius:54},
  // Casualty bay: exposed patient with two plausible recovery positions.
  {type:"rock",x:3480,y:1120,radius:58},{type:"rock",x:4010,y:1160,radius:60},
  {type:"tree",x:3420,y:690,radius:64},{type:"tree",x:4100,y:735,radius:62}
 ],
 brush:[
  {x:1260,y:735,radius:135},{x:1450,y:850,radius:150},{x:1660,y:800,radius:165},{x:1880,y:900,radius:145},
  {x:2290,y:930,radius:90},{x:3120,y:950,radius:90},
  {x:3440,y:1240,radius:105},{x:4050,y:1270,radius:110}
 ]
};

function actorFromSpec(faction,teamId,index,spec,fixture){
 const id=`sandbox_${fixture.id}_${faction}_${index}`;
 const roles=DEFAULT_ROLES[faction];
 return {
  id,
  name:NAMES[faction][index%NAMES[faction].length],
  role:spec.role??roles[index%roles.length],
  type:"actor",
  teamId,
  factionId:faction,
  operationId:`behavior_lab_${fixture.id}`,
  kitId:KITS[faction][index%KITS[faction].length],
  x:spec.x,
  y:spec.y,
  width:44,
  height:70,
  groundY:spec.y+34,
  radius:18,
  vx:0,
  vy:0,
  moveSpeed:112+(index%3)*8,
  facing:spec.facing??"down",
  walkingPhase:0,
  backpackLoadRatio:.35,
  carriedItemInstanceId:null,
  routeIndex:0,
  waitTime:0,
  workPhase:0,
  motionState:"idle",
  currentTask:spec.task??"Holding the assigned test position",
  currentAction:"Waiting",
  workPose:null,
  workProp:null,
  interactionRadius:84,
  priority:18,
  relationship:"Unknown",
  greeting:[`${FACTION_NAMES[faction]} test team.`,fixture.question],
  seated:false,
  sandboxFixtureId:fixture.id,
  sandboxStatic:true,
  medicalPreset:spec.medicalPreset??null,
  squadMission:spec.mission??"hold_fixture",
  aiV2Assignment:spec.aiV2Assignment?{
   ...spec.aiV2Assignment,
   sector:{...spec.aiV2Assignment.sector},
   report:spec.aiV2Assignment.report?{...spec.aiV2Assignment.report}:null
  }:null,
  alertState:"unaware"
 };
}

export class CombatSandboxDirector{
 constructor(game,{fixtureId=SANDBOX_FIXTURE_IDS.OPEN_CONTACT}={}){
  this.game=game;
  this.started=true;
  this.elapsed=0;
  this.selectedOperationId=null;
  this.operations=[];
  this.teams=[];
  this.initialized=false;
  this.fixture=getSandboxFixture(fixtureId);
 }
 getOperation(){return null;}
 claim(){return false;}
 get selectedOperation(){return null;}
 summary(){return[];}
 start(){
  if(this.initialized)return;
  this.initialized=true;
  this.game.sandboxFixture=this.fixture;
  for(const [teamIndex,teamSpec] of this.fixture.teams.entries()){
   const teamId=`sandbox_team_${this.fixture.id}_${teamSpec.factionId}_${teamIndex}`;
   const members=[];
   for(const [actorIndex,spec] of teamSpec.actors.entries()){
    const actor=actorFromSpec(teamSpec.factionId,teamId,actorIndex,{
     ...spec,
     facing:spec.facing??teamSpec.facing,
     task:teamSpec.task,
     mission:teamSpec.mission
    },this.fixture);
    const clear=projectOutsideObstacles(this.game,actor.x,actor.y,actor.radius);
    actor.x=clear.x;actor.y=clear.y;actor.groundY=actor.y+34;
    this.game.actors.push(actor);
    members.push(actor.id);
    if(actor.medicalPreset==="critical")this.#seedCriticalCasualty(actor);
   }
   this.teams.push({
    id:teamId,
    factionId:teamSpec.factionId,
    memberIds:members,
    mission:teamSpec.mission,
    task:teamSpec.task,
    fixtureId:this.fixture.id,
    aiV2Mission:teamSpec.aiV2Mission?{
     ...teamSpec.aiV2Mission,
     concernArea:teamSpec.aiV2Mission.concernArea?{...teamSpec.aiV2Mission.concernArea}:null,
     interference:teamSpec.aiV2Mission.interference?{...teamSpec.aiV2Mission.interference}:null,
     decisionContext:teamSpec.aiV2Mission.decisionContext?{...teamSpec.aiV2Mission.decisionContext}:null,
     responsePolicy:teamSpec.aiV2Mission.responsePolicy?{...teamSpec.aiV2Mission.responsePolicy}:null,
     responseBias:teamSpec.aiV2Mission.responseBias?{...teamSpec.aiV2Mission.responseBias}:null
    }:null
   });
  }
  this.game.pushMessage(`${this.fixture.index} ${this.fixture.label} — ${this.fixture.question}`,4.8);
 }
 #seedCriticalCasualty(actor){
  const medical=this.game.wounds.ensure(actor);
  medical.blood=42;
  medical.shock=54;
  this.game.wounds.seedWound(actor,{region:"torso",severity:"catastrophic",controlled:false,label:`${this.fixture.id}_seeded_casualty`});
  actor.currentTask="Critical casualty awaiting recovery";
  actor.currentAction="Incapacitated";
 }
 update(delta){
  this.start();
  this.elapsed+=delta;
  // Intentional fixture rule: the director never invents patrol movement,
  // reinforcements, or random destinations. Legacy or V2 systems must make
  // every subsequent behavioral decision explicitly.
 }
}
