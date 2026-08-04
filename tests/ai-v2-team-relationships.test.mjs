import test from "node:test";
import assert from "node:assert/strict";
import { TeamRelationshipService } from "../js/ai-v2/relationships/team-relationship-service.js";
import { CommunicationExecutor } from "../js/ai-v2/communication/communication-executor.js";
import { FireExecutor } from "../js/ai-v2/execution/fire-executor.js";

function actor(id,teamId,factionId,x,y){
  return{id,teamId,factionId,x,y,radius:18,lookAngle:0,facing:"right",medical:{dead:false,unconscious:false},aiV2Suppression:0};
}
function gameWith(actors){
  const relationships=new TeamRelationshipService();
  return{actors,map:{obstacles:[]},combat:{effects:[],decals:[]},aiV2ThreatEvents:[],aiV2:{elapsed:0,relationships}};
}

test("directed warnings target one subject team and never include same-faction teams",()=>{
  const speaker=actor("speaker","commune_a","commune",0,0);
  const sameFaction=actor("friendly_other_team","commune_b","commune",180,8);
  const northline=actor("northline","northline_a","northline",220,0);
  const game=gameWith([speaker,sameFaction,northline]);
  const communication=new CommunicationExecutor();

  const friendlyWarning=communication.beginDirectedWarning({game,speaker,targetPoint:{x:200,y:0},targetTeamId:sameFaction.teamId,message:"Keep clear"});
  assert.equal(friendlyWarning,null,"a separate team in the same faction is a protected friendly, not a warning recipient");

  const warning=communication.beginDirectedWarning({game,speaker,targetPoint:{x:220,y:0},targetTeamId:northline.teamId,message:"Keep clear"});
  assert.ok(warning);
  assert.deepEqual(warning.recipientIds,[northline.id]);
  assert.equal(warning.recipientIds.includes(sameFaction.id),false);
});

test("same-faction and cooperating teams block fire and cannot be suppressed or wounded",()=>{
  const shooter=actor("shooter","commune_a","commune",0,0);
  const sameFaction=actor("friendly_other_team","commune_b","commune",120,0);
  const target=actor("target","northline_a","northline",300,0);
  const game=gameWith([shooter,sameFaction,target]);
  const fire=new FireExecutor();
  fire.ensureWeapon(shooter);
  const before=shooter.ammoInMagazine;
  const blocked=fire.fireProtectiveShot({game,actor:shooter,targetPoint:{x:340,y:0},shotIndex:0,spread:0,allowInjury:true,emitThreatEvent:true});
  assert.equal(blocked.fired,false);
  assert.equal(blocked.reason,"friendly_in_line");
  assert.equal(blocked.blockedByActorId,sameFaction.id);
  assert.equal(shooter.ammoInMagazine,before);
  assert.equal(sameFaction.aiV2Suppression,0);
  assert.equal(game.aiV2ThreatEvents.length,0);

  sameFaction.x=120;sameFaction.y=70;
  game.aiV2.relationships.establishContract({teamAId:shooter.teamId,teamBId:target.teamId,type:"shared_security",now:0,duration:20});
  const cooperativeBlock=fire.fireProtectiveShot({game,actor:shooter,targetPoint:{x:340,y:0},shotIndex:0,spread:0,allowInjury:true});
  assert.equal(cooperativeBlock.fired,false);
  assert.equal(cooperativeBlock.reason,"friendly_in_line");
  assert.equal(cooperativeBlock.blockedByActorId,target.id);
});

import { CrossTeamAidAction } from "../js/ai-v2/actions/cross-team-aid-action.js";
import { CasualtyCareExecutor } from "../js/ai-v2/execution/casualty-care-executor.js";
import { WoundSystem } from "../js/wound-system.js";

test("a casualty-aid contract permits one real treatment without merging team ownership",()=>{
  const provider=actor("provider","northline_team","northline",0,0);
  provider.name="Northline Medic";provider.aiV2MedicalSupplies={bandage:1,pressure_dressing:1};
  const patient=actor("patient","commune_team","commune",24,0);
  patient.name="Commune Casualty";
  delete provider.medical;delete patient.medical;
  const game=gameWith([provider,patient]);
  delete provider.medical;delete patient.medical;
  game.operator=provider;game.bloodDecals=[];game.pushMessage=()=>{};
  game.wounds=new WoundSystem(game);
  game.wounds.applyGunshot(patient,{x:patient.x,y:patient.y},{severity:"moderate",region:"torso",createdAt:0,woundId:"cross_team_test_wound",silent:true});
  game.aiV2.relationships.establishContract({teamAId:provider.teamId,teamBId:patient.teamId,type:"casualty_aid",now:0,duration:20});
  const casualtyCare=new CasualtyCareExecutor();
  const recorded=[];
  const services={
    relationships:game.aiV2.relationships,casualtyCare,
    locomotion:{moveToward:()=>({arrived:true}),stop:()=>{}},attention:{turnToward:()=>{}},
    decisionLog:{record:entry=>recorded.push(entry)}
  };
  const action=new CrossTeamAidAction({actorId:provider.id,directive:{patientId:patient.id,subjectTeamId:patient.teamId,contractId:"aid_contract"}});
  assert.equal(action.canStart({game,services}),true);
  action.start(0,{game,services});
  let result=null;
  for(let i=0;i<20&&!result;i++)result=action.update(.1,{game,services,now:(i+1)*.1});
  assert.equal(result?.status,"completed");
  assert.equal(game.wounds.getTreatmentNeed(patient),null);
  assert.equal(provider.teamId,"northline_team");
  assert.equal(patient.teamId,"commune_team");
  assert.equal(recorded.some(entry=>entry.type==="cross_team_casualty_stabilized"),true);
});
