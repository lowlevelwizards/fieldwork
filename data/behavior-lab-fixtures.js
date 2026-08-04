// Authored Behavior Lab content. The runtime consumes these facts but does not invent them.
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
     boundary:{
      id:"south_approach_identification_boundary",
      label:"Southern identification boundary",
      area:{type:"circle",label:"southern monitored boundary",x:1500,y:1230,radius:610,falloff:180},
      policy:"Unidentified armed personnel inside the monitored approach should be challenged before escalation.",
      condition:"A credible mission-relevant armed presence has changed position inside the monitored boundary.",
      warningType:"stop_and_identify",
      warningMessage:"Stop where you are and identify yourselves.",
      minimumConfidence:28,
      requireActivityUpdate:true,
      allowedActivities:["approaching","repositioning","observing","lost"],
      voiceRange:1120,
      coneDegrees:88,
      warningDuration:1.45,
      awaitDuration:12
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
     responsePolicy:{minimumHold:6,reassessEvery:2.2,switchMargin:.06},
     responseBias:{heighten_watch:.1,continue_observation:.03,warn:.18}
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
     withdrawalPlan:{
      id:"southern_brush_exit",
      label:"covered southern withdrawal route",
      exitPoint:{x:1960,y:1450},
      roleOffsets:{
       withdrawal_lead:{x:0,y:0},
       protected_mover:{x:-95,y:0},
       rear_watch:{x:-190,y:0}
      },
      speedMultiplier:.62,
      arrivalRadius:12,
      claimSpacing:68
     },
     responsePolicy:{minimumHold:6,reassessEvery:2.4,switchMargin:.06},
     responseBias:{maintain_concealment:.03,continue_observation:.03,withdraw_silently:.18}
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
  purpose:"Isolate casualty recognition, stabilization, adaptive evacuation, capability loss, role reassignment, and safe return.",
  operatorSpawn:{x:3800,y:1760},
  teams:[
   {
    factionId:"northline",mission:"Maintain pressure on the southern lane",task:"Observe and deny movement through the casualty bay",facing:"down",
    actors:[{x:3550,y:430,role:"Security"},{x:3750,y:405,role:"Rifleman"},{x:3950,y:440,role:"Engineer"}]
   },
   {
    factionId:"commune",mission:"Maintain observation of the southern lane and return together",task:"Preserve awareness, recover the exposed teammate, and adapt the mission so everyone can get back",facing:"up",
    aiV2Mission:{
     id:"commune_casualty_recovery",
     problemKind:"friendly_casualty",
     title:"Preserve the team and return together",
     objective:"Maintain useful awareness while recognizing that a critical teammate creates a higher-priority obligation to recover, stabilize, and evacuate them.",
     immediateTask:"Recover and stabilize the exposed casualty without abandoning the team's awareness.",
     successCondition:"The casualty is stabilized, evacuated alive, and transferred for continued care while the surviving team returns together.",
     abortCondition:"The casualty dies or no capable team member and no viable extraction affordance remain.",
     concernArea:{type:"circle",label:"casualty recovery bay",x:3740,y:1035,radius:520,falloff:180},
     problemSensitivity:1,
     staleAfter:24,
     forgetAfter:46,
     recoveryPlan:{
      id:"west_rock_recovery",
      label:"protected recovery point",
      recoveryPoint:{x:3515,y:1195},
      securitySector:{label:"Northern casualty approach",x:3760,y:520,maximumRange:900,fieldOfViewDegrees:82},
      interactionRange:82,
      observationRange:640,
      reportRange:520,
      approachSpeedMultiplier:.8,
      dragSpeedMultiplier:.46,
      arrivalRadius:13,
      claimSpacing:62,
      stabilizationDuration:3.4
     },
     evacuationPlan:{
      id:"south_edge_safe_return",
      label:"protected southern extraction",
      routeOptions:[
       {
        id:"west_brush_route",
        label:"west brush route",
        protection:.88,
        cohesion:.9,
        waypoints:[
         {id:"west_intermediate",label:"covered intermediate position",kind:"intermediate",x:3610,y:1335,staminaCost:.58},
         {id:"west_extraction",label:"southern extraction edge",kind:"extraction",x:3375,y:1420,staminaCost:.34}
        ]
       },
       {
        id:"east_open_route",
        label:"east open route",
        protection:.42,
        cohesion:.72,
        waypoints:[
         {id:"east_intermediate",label:"eastern intermediate position",kind:"intermediate",x:3950,y:1335,staminaCost:.48},
         {id:"east_extraction",label:"eastern extraction edge",kind:"extraction",x:4230,y:1420,staminaCost:.38}
        ]
       }
      ],
      rearSecuritySector:{label:"Northern evacuation approach",x:3760,y:600,maximumRange:980,fieldOfViewDegrees:92},
      interactionRange:82,
      reportRange:560,
      routeSecuritySpeedMultiplier:.8,
      transportSpeedMultiplier:.42,
      arrivalRadius:14,
      claimSpacing:68,
      routeAssessmentDuration:.8,
      reassessmentDuration:1.25,
      transferDuration:1.6,
      minimumTransportStamina:.2,
      originalMissionStatus:"observation_suspended_for_casualty_evacuation"
     },
     decisionContext:{
      missionValue:.96,
      teamPreservation:.94,
      informationNeed:.45,
      positionSecurity:.58,
      concealmentValue:.3,
      detectionRisk:.25,
      timePressure:.96,
      resourceConservation:.35,
      exitOptions:.72,
      enemyDisruption:.08,
      securityOrientation:.72,
      stealthOrientation:.4,
      mobilityOrientation:.68,
      careOrientation:1,
      positionLabel:"the exposed casualty bay",
      exitLabel:"the protected recovery point"
     },
     responsePolicy:{minimumHold:1.2,reassessEvery:.8,switchMargin:.02},
     responseBias:{recover_casualty:.28,evacuate_casualty:.32}
    },
    actors:[
     {x:3540,y:1325,role:"Security",aiV2Capabilities:{routeAssessment:.96,rearSecurity:.95,patientTransport:.58,transportStamina:.82},aiV2CasualtyAssignment:{observe:true,maximumRange:640,fieldOfViewDegrees:170,report:{method:"local_voice",range:520,minimumConfidence:52,reason:"Report the exposed teammate so the team can organize recovery"}}},
     {x:3810,y:1360,role:"Field Medic",aiV2Capabilities:{medicalCare:1,patientTransport:.92,transportStamina:.68,rearSecurity:.45},aiV2MedicalSupplies:{pressure_dressing:1,bandage:1,iv_fluids:1}},
     {x:3740,y:965,role:"Rifleman",medicalPreset:"critical",aiV2Capabilities:{patientTransport:0,transportStamina:0}},
     {x:4020,y:1360,role:"Scout",aiV2Capabilities:{routeAssessment:.72,rearSecurity:.8,patientTransport:.82,transportStamina:1}}
    ]
   }
  ]
 }
};

export function getSandboxFixture(id){
 return SANDBOX_FIXTURES[id]??SANDBOX_FIXTURES[SANDBOX_FIXTURE_IDS.OPEN_CONTACT];
}

export const BEHAVIOR_LAB_ACTOR_CATALOG=Object.freeze({
  factionNames:FACTION_NAMES,
  kits:KITS,
  defaultRoles:DEFAULT_ROLES,
  names:NAMES
});
