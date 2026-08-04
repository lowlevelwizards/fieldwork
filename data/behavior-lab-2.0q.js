export function applyBehaviorLab2QOverlay(fixture){
  if(!fixture||fixture.id!=="cover_position")return fixture;
  return{
    ...fixture,
    purpose:"Isolate hostile-direction evidence, finite directional cover slots, distinct reservations, stable occupation, and position commitment without pacing.",
    hostileStimulus:{
      id:"cover_position_near_miss",
      delay:1.1,
      kind:"near_miss",
      sourceFactionId:"commune",
      sourceRole:"Rifleman",
      targetFactionId:"northline",
      targetRole:"Security",
      confidence:96,
      immediateDuration:3.4,
      impactOffset:{x:30,y:8}
    },
    teams:fixture.teams.map(team=>team.factionId!=="northline"?team:{
      ...team,
      mission:"Hold the northern position and preserve control of the lane",
      task:"Recognize hostile pressure, occupy distinct protective positions, and remain committed without crowding",
      aiV2Mission:{
        id:"northline_directional_defense",
        title:"Hold the northern cover line",
        objective:"Maintain useful control of the lane by turning known hostile pressure into a stable distributed defensive position.",
        immediateTask:"Occupy distinct directional cover slots and hold them while they remain valid.",
        successCondition:"Every capable responsibility occupies a separate protective slot and the team reaches a stable defensive hold.",
        abortCondition:"No sufficient directional cover remains or the team can no longer fill the required responsibilities.",
        concernArea:{type:"circle",label:"southern threat approach",x:2700,y:1320,radius:920,falloff:260},
        missionSensitivity:1,
        minimumRelevantConfidence:8,
        incompatibleConfidence:12,
        staleAfter:18,
        forgetAfter:36,
        interference:{
          kind:"incoming_fire",
          label:"Hostile pressure against the northern position",
          reason:"A physically perceived incoming round threatens the defended lane and requires a protective posture."
        },
        defensivePlan:{
          id:"northern_rock_line",
          label:"the northern rock line",
          maximumCoverDistance:520,
          maximumTravel:520,
          maximumCohesionDistance:560,
          minimumProtection:.72,
          speedMultiplier:.64,
          arrivalRadius:10,
          coverGap:9,
          minimumCommitmentDuration:8,
          switchMargin:.18
        },
        decisionContext:{
          missionValue:.96,
          teamPreservation:.88,
          informationNeed:.38,
          positionSecurity:.92,
          concealmentValue:.18,
          detectionRisk:.96,
          timePressure:.78,
          resourceConservation:.9,
          exitOptions:.18,
          enemyDisruption:.42,
          securityOrientation:.98,
          stealthOrientation:.18,
          mobilityOrientation:.42,
          careOrientation:.4,
          positionLabel:"the northern cover line",
          exitLabel:"the open rear approach"
        },
        responsePolicy:{minimumHold:8,reassessEvery:1.2,switchMargin:.14},
        responseBias:{hold_defensively:.35,withdraw:-.18,reroute:-.12}
      }
    })
  };
}
