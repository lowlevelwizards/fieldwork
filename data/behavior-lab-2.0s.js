import { OBJECTIVE_INITIATIVE_FIXTURE_ID } from "./behavior-lab-2.0r.js";

const northlineRoster=[
  {id:"northline_roster_scout",name:"Iris Vale",role:"Scout",kitId:"northline_standard_light",capabilities:{navigation:.96,scouting:.92,technicalWork:.18,security:.62,observation:.8}},
  {id:"northline_roster_engineer",name:"Cal Rusk",role:"Engineer",kitId:"northline_standard_mid",capabilities:{navigation:.55,scouting:.34,technicalWork:.98,security:.48,observation:.52}},
  {id:"northline_roster_security",name:"Evan Holt",role:"Security",kitId:"northline_standard_dark",capabilities:{navigation:.66,scouting:.48,technicalWork:.1,security:.97,observation:.92}}
];

const communeRoster=[
  {id:"commune_roster_pathfinder",name:"Mina Sol",role:"Pathfinder",kitId:"commune_rust_green",capabilities:{navigation:.91,scouting:.82,technicalWork:.28,security:.55,observation:.72}},
  {id:"commune_roster_technician",name:"Jo Fen",role:"Field Technician",kitId:"commune_brown_denim",capabilities:{navigation:.58,scouting:.4,technicalWork:.91,security:.44,observation:.58,casualtyCare:.82}},
  {id:"commune_roster_security",name:"Rin Hale",role:"Route Security",kitId:"commune_green_brown",capabilities:{navigation:.67,scouting:.54,technicalWork:.2,security:.84,observation:.88,casualtyCare:.58}}
];

const freelancerRoster=[
  {id:"freelancer_roster_scout",name:"Sable",role:"Scout",kitId:"freelancer_black_gray",capabilities:{navigation:.94,scouting:.95,technicalWork:.24,security:.58,observation:.91}},
  {id:"freelancer_roster_technician",name:"Pike",role:"Recovery Technician",kitId:"freelancer_brown_black",capabilities:{navigation:.64,scouting:.56,technicalWork:.86,security:.62,observation:.66}},
  {id:"freelancer_roster_security",name:"Morrow",role:"Overwatch",kitId:"freelancer_black_gray",capabilities:{navigation:.71,scouting:.72,technicalWork:.12,security:.91,observation:.94}}
];

export function applyBehaviorLab2SOverlay(fixture){
  if(!fixture||fixture.id!==OBJECTIVE_INITIATIVE_FIXTURE_ID)return fixture;
  return Object.freeze({
    ...fixture,
    question:"Can persistent world needs cause factions to propose operations, dispatch teams, complete work, and continue the simulation?",
    purpose:"Extend objective initiative into a strategic-to-tactical loop: world needs, faction priorities, reusable rosters, operation generation, AI V2 mission execution, abstract return, recovery, and a second operation without fixture-authored teams.",
    objectives:[
      {
        id:"central_field_relay",
        objectiveKind:"restore_relay",
        name:"Central Field Relay",
        x:4880,
        y:800,
        width:66,
        height:90,
        interactionRadius:82,
        securityRadius:300,
        collision:true,
        state:"offline",
        progress:0,
        requirements:{inspectDuration:1.2,workDuration:4,operatorCapability:"technicalWork"},
        sandboxNeed:{
          id:"restore_central_field_relay",
          kind:"restore_infrastructure",
          label:"Restore Central Field Relay",
          desiredState:"operational",
          urgency:.92,
          capabilityNeeds:{technicalWork:.9,navigation:.55,security:.5}
        }
      },
      {
        id:"east_field_relay",
        objectiveKind:"restore_relay",
        name:"East Route Relay",
        x:5140,
        y:1160,
        width:66,
        height:90,
        interactionRadius:82,
        securityRadius:280,
        collision:true,
        state:"offline",
        progress:0,
        requirements:{inspectDuration:1.1,workDuration:3.8,operatorCapability:"technicalWork"},
        sandboxNeed:{
          id:"restore_east_route_relay",
          kind:"restore_infrastructure",
          label:"Restore East Route Relay",
          desiredState:"operational",
          urgency:.66,
          capabilityNeeds:{technicalWork:.82,navigation:.5,security:.55}
        }
      }
    ],
    teams:[],
    livingSandbox:{
      dispatchDelay:1.2,
      minimumDispatchGap:1.8,
      postCompletionHold:14,
      recoveryDuration:28,
      teamSize:3,
      maxActiveOperations:1,
      factions:[
        {
          id:"northline",
          label:"Northline",
          priorities:{restore_infrastructure:.98},
          entryPoint:{x:4620,y:1320,facing:"up"},
          roster:northlineRoster
        },
        {
          id:"commune",
          label:"Commune",
          priorities:{restore_infrastructure:.78},
          entryPoint:{x:4880,y:1360,facing:"up"},
          roster:communeRoster
        },
        {
          id:"freelancers",
          label:"Freelancers",
          priorities:{restore_infrastructure:.58},
          entryPoint:{x:5140,y:1320,facing:"up"},
          roster:freelancerRoster
        }
      ]
    }
  });
}
