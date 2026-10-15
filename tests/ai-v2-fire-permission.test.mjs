import test from "node:test";
import assert from "node:assert/strict";
import { ContactFireAction } from "../js/ai-v2/actions/contact-fire-action.js";
import { ThreatKnowledgeStore } from "../js/ai-v2/knowledge/threat-knowledge.js";

function actor(id,{teamId,factionId,x=0,y=0}={}){
  return{
    id,teamId,factionId,x,y,radius:18,
    medical:{condition:"healthy",dead:false,unconscious:false}
  };
}

function contact({subjectTeamId,relationship="unknown",activity="stationary",intent="uncertain"}={}){
  return{
    subjectTeamId,
    relationship,
    confidence:90,
    currentlyVisible:true,
    track:{currentActivity:activity,intentHypothesis:{id:intent}}
  };
}

test("a deliberate warning shot can trigger threat reaction without independently authorizing lethal return fire",()=>{
  const source=actor("source",{teamId:"team_a",factionId:"northline",x:0,y:0});
  const warned=actor("warned",{teamId:"team_b",factionId:"commune",x:180,y:0});
  const threats=new ThreatKnowledgeStore();
  threats.observeEvent({
    event:{
      id:"warning_1",
      targetActorId:warned.id,
      sourceActorId:source.id,
      sourceTeamId:source.teamId,
      sourceFactionId:source.factionId,
      subjectId:`threat_source_${source.id}`,
      sourcePoint:{x:source.x,y:source.y},
      impactPoint:{x:warned.x,y:warned.y+90},
      kind:"warning_shot_near_miss",
      confidence:96,
      immediateDuration:3.2
    },
    game:{actors:[source,warned]},
    now:1
  });
  const action=new ContactFireAction({actorId:warned.id,directive:{subjectTeamId:source.teamId,targetPoint:{x:source.x,y:source.y}}});
  const services={
    personalKnowledge:{getContacts:()=>[contact({subjectTeamId:source.teamId,activity:"firing",intent:"hostile"})]},
    threatKnowledge:threats
  };
  assert.equal(action.canStart({game:{actors:[source,warned]},services,now:1.2}),false);
  const learned=threats.getBestThreat(warned.id);
  assert.equal(learned.sourceActorId,source.id);
  assert.equal(learned.sourceTeamId,source.teamId);
  assert.equal(learned.eventKind,"warning_shot_near_miss");
});

test("ambiguous observed firing does not become lethal authorization without grounded hostile evidence",()=>{
  const observer=actor("observer",{teamId:"team_b",factionId:"commune",x:180,y:0});
  const contactActor=actor("contact",{teamId:"team_a",factionId:"northline",x:0,y:0});
  const action=new ContactFireAction({actorId:observer.id,directive:{subjectTeamId:contactActor.teamId,targetPoint:{x:contactActor.x,y:contactActor.y}}});
  const services={
    personalKnowledge:{getContacts:()=>[contact({subjectTeamId:contactActor.teamId,activity:"firing",intent:"hostile"})]},
    threatKnowledge:{getThreats:()=>[]}
  };
  assert.equal(action.canStart({game:{actors:[observer,contactActor]},services,now:8}),false);
});

test("actual hostile incoming fire from the target team still authorizes bounded contact fire",()=>{
  const source=actor("source",{teamId:"team_a",factionId:"northline",x:0,y:0});
  const target=actor("target",{teamId:"team_b",factionId:"commune",x:180,y:0});
  const threats=new ThreatKnowledgeStore();
  threats.observeEvent({
    event:{
      id:"hostile_1",
      targetActorId:target.id,
      sourceActorId:source.id,
      sourceTeamId:source.teamId,
      sourceFactionId:source.factionId,
      subjectId:`threat_source_${source.id}`,
      sourcePoint:{x:source.x,y:source.y},
      impactPoint:{x:target.x,y:target.y},
      kind:"hostile_contact_fire",
      confidence:100,
      immediateDuration:3.2
    },
    game:{actors:[source,target]},
    now:1
  });
  const action=new ContactFireAction({actorId:target.id,directive:{subjectTeamId:source.teamId,targetPoint:{x:source.x,y:source.y}}});
  const services={
    personalKnowledge:{getContacts:()=>[contact({subjectTeamId:source.teamId})]},
    threatKnowledge:threats
  };
  assert.equal(action.canStart({game:{actors:[source,target]},services,now:1.2}),true);
});
