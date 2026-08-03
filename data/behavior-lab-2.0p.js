export function applyBehaviorLab2POverlay(fixture){
  if(!fixture||fixture.id!=="open_contact")return fixture;
  return{
    ...fixture,
    purpose:"Isolate physical hostile evidence, immediate actor initiative, urgent reporting, bounded protective fire, and staged movement to safety.",
    hostileStimulus:{
      id:"open_contact_near_miss",
      delay:1.1,
      kind:"near_miss",
      sourceFactionId:"northline",
      sourceRole:"Rifleman",
      targetFactionId:"commune",
      targetRole:"Scout",
      confidence:96,
      immediateDuration:3.4,
      impactOffset:{x:34,y:12}
    },
    teams:fixture.teams.map(team=>team.factionId!=="commune"?team:{
      ...team,
      mission:"Cross the exposed lane and preserve the team if the route becomes hostile",
      task:"Recognize immediate danger, report it, and break contact without becoming fixed in the open",
      aiV2Mission:{
        id:"commune_open_contact_breakaway",
        title:"Preserve the crossing team",
        objective:"Cross the lane without unnecessary losses and disengage coherently if credible hostile fire makes the open position unsustainable.",
        immediateTask:"Recognize whether the lane has become immediately hostile and preserve the team.",
        successCondition:"All capable operators reach the southern break-contact route and hostile pressure is no longer immediate.",
        abortCondition:"No viable withdrawal route or capable mover remains.",
        concernArea:{type:"circle",label:"northern hostile lane",x:570,y:430,radius:760,falloff:240},
        missionSensitivity:1,
        minimumRelevantConfidence:8,
        incompatibleConfidence:12,
        staleAfter:15,
        forgetAfter:32,
        interference:{
          kind:"incoming_fire",
          label:"Immediate hostile fire in the crossing lane",
          reason:"A physically perceived incoming round makes the exposed crossing incompatible with preserving the team."
        },
        withdrawalPlan:{
          id:"southern_break_contact_route",
          label:"southern break-contact route",
          exitPoint:{x:570,y:1510},
          roleOffsets:{
            withdrawal_lead:{x:-145,y:0},
            protected_mover:{x:0,y:0},
            rear_watch:{x:145,y:0}
          },
          speedMultiplier:.78,
          arrivalRadius:13,
          claimSpacing:72
        },
        decisionContext:{
          missionValue:.72,
          teamPreservation:.98,
          informationNeed:.38,
          positionSecurity:.12,
          concealmentValue:.08,
          detectionRisk:.95,
          timePressure:.92,
          resourceConservation:.58,
          exitOptions:.95,
          enemyDisruption:.28,
          securityOrientation:.62,
          stealthOrientation:.44,
          mobilityOrientation:.96,
          careOrientation:.7,
          positionLabel:"the exposed crossing lane",
          exitLabel:"the southern break-contact route"
        },
        responsePolicy:{minimumHold:.8,reassessEvery:.55,switchMargin:.01},
        responseBias:{break_contact_under_fire:.35,withdraw:.08}
      }
    })
  };
}
