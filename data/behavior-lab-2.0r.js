export const OBJECTIVE_INITIATIVE_FIXTURE_ID="objective_initiative";

export const OBJECTIVE_INITIATIVE_FIXTURE=Object.freeze({
  id:OBJECTIVE_INITIATIVE_FIXTURE_ID,
  index:"05",
  label:"Objective Initiative",
  shortLabel:"Objective initiative",
  zoneId:OBJECTIVE_INITIATIVE_FIXTURE_ID,
  question:"Can a team begin, organize, and complete useful work without an authored actor assignment or emergency stimulus?",
  purpose:"Isolate objective state, baseline mission initiative, world-dependent approach selection, physical work, and stable completion.",
  operatorSpawn:{x:4880,y:1760},
  objectives:[{
    id:"central_field_relay",
    objectiveKind:"restore_relay",
    name:"Disabled Field Relay",
    x:4880,
    y:800,
    width:66,
    height:90,
    interactionRadius:82,
    securityRadius:300,
    collision:true,
    state:"offline",
    progress:0,
    requirements:{inspectDuration:1.2,workDuration:4,operatorCapability:"technicalWork"}
  }],
  teams:[{
    factionId:"northline",
    mission:"Restore the disabled field relay and establish a stable worksite",
    task:"Approach, inspect, restore, and secure the central relay",
    facing:"up",
    aiV2Mission:{
      id:"northline_restore_field_relay",
      problemKind:"baseline_objective",
      title:"Restore the central field relay",
      objective:"Return the disabled relay to operation while preserving a coherent local-security posture.",
      immediateTask:"Organize an approach and restore the central field relay.",
      successCondition:"The relay is operational and all capable operators maintain a coherent worksite posture.",
      abortCondition:"No capable technical specialist or usable approach remains.",
      concernArea:{type:"circle",label:"central relay worksite",x:4880,y:800,radius:500,falloff:220},
      objectivePlan:{
        id:"central_relay_restoration",
        objectiveId:"central_field_relay",
        desiredState:"operational",
        securityFocusDistance:330,
        approachPolicy:{
          maximumTravel:1200,
          stagingDistance:250,
          interactionDistance:68,
          roleSpacing:108,
          speedMultiplier:.72,
          arrivalRadius:11,
          claimSpacing:72
        }
      },
      decisionContext:{
        missionValue:.96,
        teamPreservation:.82,
        informationNeed:.52,
        positionSecurity:.62,
        concealmentValue:.18,
        detectionRisk:.12,
        timePressure:.48,
        resourceConservation:.88,
        exitOptions:.72,
        enemyDisruption:.08,
        securityOrientation:.76,
        stealthOrientation:.24,
        mobilityOrientation:.72,
        careOrientation:.5,
        positionLabel:"the relay worksite",
        exitLabel:"the southern access lane"
      },
      responsePolicy:{minimumHold:3,reassessEvery:1.2,switchMargin:.08},
      responseBias:{}
    },
    actors:[
      {x:4620,y:1320,role:"Scout",aiV2Capabilities:{navigation:.96,scouting:.9,technicalWork:.12,security:.62,observation:.72}},
      {x:4880,y:1360,role:"Engineer",aiV2Capabilities:{navigation:.52,scouting:.3,technicalWork:.98,security:.48,observation:.5}},
      {x:5140,y:1320,role:"Security",aiV2Capabilities:{navigation:.66,scouting:.52,technicalWork:.08,security:.96,observation:.9}}
    ]
  }]
});
