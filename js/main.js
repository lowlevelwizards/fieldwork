import { Camera } from "./camera.js";
import { ContinuousGameState } from "./continuous-game-state.js";
import { InputController, CombatInputController } from "./input.js";
import { Renderer } from "./renderer.js";
import { getItemDefinition } from "../data/items.js";
import { findEntity } from "./world-entities.js";
import { validateItemLocations } from "./item-locations.js";
import { renderItemThumbnail } from "./presentation/item-renderer.js";
import { SANDBOX_FIXTURES, SANDBOX_FIXTURE_IDS, getSandboxFixture } from "./combat-sandbox.js";

const BUILD_ID="2.2";
const $=s=>document.querySelector(s),titleScreen=$("#title-screen"),gameScreen=$("#game-screen"),beginButton=$("#begin-button"),canvas=$("#game-canvas"),inventoryOverlay=$("#inventory-overlay"),inspectOverlay=$("#inspect-overlay"),inventoryList=$("#inventory-list"),reportOverlay=$("#report-overlay"),operationsOverlay=$("#operations-overlay"),aiRuntimeSelect=$("#ai-runtime-select"),aiRuntimeDescription=$("#ai-runtime-description"),sandboxFixtureSelect=$("#sandbox-fixture-select"),sandboxFixtureDescription=$("#sandbox-fixture-description");
const declaredBuild=document.querySelector('meta[name="fieldwork-build"]')?.content??"missing";
document.documentElement.dataset.build=BUILD_ID;
$("#title-build-id").textContent=BUILD_ID;
$("#debug-build").textContent=declaredBuild===BUILD_ID?BUILD_ID:`HTML ${declaredBuild} / JS ${BUILD_ID}`;
if(declaredBuild!==BUILD_ID){console.error("Fieldwork build mismatch",{html:declaredBuild,javascript:BUILD_ID});setTimeout(()=>alert(`Fieldwork cache mismatch detected.\nHTML: ${declaredBuild}\nJavaScript: ${BUILD_ID}\nReload the page once.`),50);}
console.info(`Fieldwork ${BUILD_ID} loaded`,{href:location.href,time:new Date().toISOString()});

const AI_RUNTIME_STORAGE_KEY="fieldwork.aiRuntime";
const requestedRuntime=new URLSearchParams(location.search).get("ai");
function readStoredAIRuntime(){try{return localStorage.getItem(AI_RUNTIME_STORAGE_KEY);}catch{return null;}}
function writeStoredAIRuntime(value){try{localStorage.setItem(AI_RUNTIME_STORAGE_KEY,value);}catch{}}
const storedRuntime=readStoredAIRuntime();
const initialRuntime=requestedRuntime==="v2"||requestedRuntime==="legacy"?requestedRuntime:storedRuntime==="v2"?"v2":"legacy";
aiRuntimeSelect.value=initialRuntime;
function selectedAIRuntime(){return aiRuntimeSelect.value==="v2"?"v2":"legacy";}
function updateAIRuntimeDescription(){
  aiRuntimeDescription.textContent=selectedAIRuntime()==="v2"
    ?"Adaptive causal AI: operators react to personal hostile evidence, teams coordinate a bounded protective breakaway, and casualty care still continues through adaptive evacuation and safe return."
    :"Preserved 1.2H research prototype with the existing combat and medical AI.";
}
updateAIRuntimeDescription();

const SANDBOX_FIXTURE_STORAGE_KEY="fieldwork.sandboxFixture";
const requestedFixture=new URLSearchParams(location.search).get("fixture");
function readStoredSandboxFixture(){try{return localStorage.getItem(SANDBOX_FIXTURE_STORAGE_KEY);}catch{return null;}}
function writeStoredSandboxFixture(value){try{localStorage.setItem(SANDBOX_FIXTURE_STORAGE_KEY,value);}catch{}}
const storedFixture=readStoredSandboxFixture();
const initialFixture=SANDBOX_FIXTURES[requestedFixture]?requestedFixture:SANDBOX_FIXTURES[storedFixture]?storedFixture:SANDBOX_FIXTURE_IDS.OPEN_CONTACT;
sandboxFixtureSelect.value=initialFixture;
function selectedSandboxFixture(){return getSandboxFixture(sandboxFixtureSelect.value).id;}
function updateSandboxFixtureDescription(){
  const fixture=getSandboxFixture(selectedSandboxFixture());
  sandboxFixtureDescription.textContent=`${fixture.question} ${fixture.purpose}`;
}
updateSandboxFixtureDescription();

const camera=new Camera();let game=new ContinuousGameState({scenario:"operations",aiRuntime:selectedAIRuntime(),sandboxFixture:selectedSandboxFixture()});const renderer=new Renderer(canvas,camera),input=new InputController({joystickBase:$("#joystick-base"),joystickKnob:$("#joystick-knob")});
const sandboxButton=$("#sandbox-button"),liveSandboxButton=$("#live-sandbox-button"),aimButton=$("#aim-button"),fireButton=$("#fire-button"),ammoCount=$("#ammo-count"),aimMode=$("#aim-mode"),reloadFill=$("#reload-progress-fill"),combatControls=$("#combat-controls"),interactButton=$("#interact-button"),searchStatus=$("#search-status"),searchLabel=$("#search-label"),searchFill=$("#search-progress-fill");
let started=false,inventoryOpen=false,operationsOpen=false,worldTextOpen=false,dialogueOpen=false,lastTime=performance.now(),fpsAccumulator=0,fpsFrames=0,fpsValue=0,objectiveTimer=null,simulationPaused=false,simulationSpeed=1,lastLiveDashboardAt=-Infinity;
function resizeAndCenter(reason="viewport"){
  renderer.resize();
  camera.lockTo(game.operator);
  console.info("Viewport synchronized",{build:BUILD_ID,reason,operator:{x:game.operator.x,y:game.operator.y},camera:{x:camera.x,y:camera.y,width:camera.width,height:camera.height}});
}
function startGame(scenario="operations"){
  if(started)return;
  const aiRuntime=scenario==="live"?"v2":selectedAIRuntime();
  writeStoredAIRuntime(aiRuntime);
  game=new ContinuousGameState({scenario,aiRuntime,sandboxFixture:selectedSandboxFixture()});
  titleScreen.classList.remove("screen--active");
  gameScreen.classList.add("screen--active");
  started=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>resizeAndCenter("game start")));
  lastTime=performance.now();
  const objective=$("#objective-card");
  if(scenario==="live"){
    const fixture=game.sandboxFixture;
    objective.querySelector(".objective-kicker").textContent="FIELDWORK 2.2 LIVING CONSEQUENCES";
    objective.querySelector("strong").textContent=fixture.label;
    objective.querySelector("span:last-child").textContent=fixture.question;
    $("#live-sandbox-panel").hidden=false;
    $("#operations-button")?.setAttribute("hidden","");
  }else if(scenario==="sandbox"){
    const fixture=game.sandboxFixture;
    objective.querySelector(".objective-kicker").textContent=`BEHAVIOR LAB ${fixture.index}`;
    objective.querySelector("strong").textContent=fixture.label;
    objective.querySelector("span:last-child").textContent=game.aiRuntimeMode==="v2"
      ?fixture.id===SANDBOX_FIXTURE_IDS.OPEN_CONTACT
        ?`${fixture.question} A physical near-miss creates personal threat evidence, immediate operator initiative, an urgent report, bounded protective fire, staged movement, and a contact-broken outcome.`
        :fixture.id===SANDBOX_FIXTURE_IDS.OBSERVATION
          ?`${fixture.question} The complete V2 encounter proceeds from observation and warning through staged silent withdrawal, observed departure, de-escalation, and outcome memory without combat.`
          :fixture.id===SANDBOX_FIXTURE_IDS.CASUALTY_RECOVERY
            ?`${fixture.question} The V2 team continues from recovery and stabilization through adaptive route selection, physical carrier handoff, staged casualty transport, transfer, and safe return.`
            :`${fixture.question} This fixture remains staged until its next V2 action is explicitly introduced.`
      :`${fixture.question} Legacy 1.2H is running inside this controlled fixture for comparison.`;
    $("#operations-button")?.setAttribute("hidden","");
  }
  objectiveTimer=setTimeout(()=>objective.classList.add("objective-card--collapsed"),5200);
}
function modalOpen(){return inventoryOpen||operationsOpen||worldTextOpen||dialogueOpen||!reportOverlay.hidden;}
function triggerContextAction(){
 if(modalOpen())return false;
 const action=game.interaction.activeAction;
 if(action&&!action.disabled)return game.interaction.trigger();
 const medicalAction=game.medical?.getPlayerAction?.();
 if(medicalAction&&!medicalAction.disabled)return game.medical.startPlayerTreatment();
 if(game.operator.carriedItemInstanceId)return game.interaction.dropCarriedItem();
 return false;
}
function updateInteractionUI(){
 const stack=$("#message-stack");
 stack.replaceChildren(...game.messages.map(m=>{
  const n=document.createElement("div");
  n.className="message-toast";
  n.textContent=m.text;
  n.style.opacity=String(Math.min(1,m.time/.25));
  return n;
 }));
 $("#pack-usage-compact").textContent=`${game.inventory.getUsedPips()}/8`;

 const action=game.interaction.activeAction;
 const medicalAction=game.medical?.getPlayerAction?.();
 const held=game.getHeldItem();
 const searching=Boolean(game.interaction.searchingEntityId);
 const treating=Boolean(game.medical?.playerAction);
 if(searching){
  const entity=findEntity(game.entities,game.interaction.searchingEntityId);
  searchStatus.hidden=false;
  searchLabel.textContent=`Searching ${entity?.name??"container"}…`;
  searchFill.style.width=`${Math.round((entity?.searchProgress??0)*100)}%`;
 }else if(treating){
  searchStatus.hidden=false;
  const treatment=game.medical.playerAction;
  const patient=treatment?.patientId===game.operator.id?game.operator:game.actors.find(actor=>actor.id===treatment?.patientId);
  searchLabel.textContent=`${treatment?.label??"Treating"} — ${patient?.name??"self"}`;
  searchFill.style.width=`${Math.round((game.medical.playerAction?.progress??0)*100)}%`;
 }else{
  searchStatus.hidden=true;
  searchFill.style.width="0%";
 }

 if(action&&!action.disabled&&!searching&&!treating){
  interactButton.hidden=false;
  interactButton.textContent=action.label.toUpperCase();
 }else if(medicalAction&&!medicalAction.disabled&&!searching&&!treating){
  interactButton.hidden=false;
  interactButton.textContent=medicalAction.label.toUpperCase();
 }else if(held&&!searching&&!treating){
  interactButton.hidden=false;
  interactButton.textContent=`DROP ${held.name}`.toUpperCase();
 }else{
  interactButton.hidden=true;
 }
}
function buildInventory(){const used=game.inventory.getUsedPips();$("#pack-usage").textContent=`${used} / ${game.backpack.capacityPips} pips`;const pips=$("#capacity-pips");pips.replaceChildren();for(let i=0;i<game.backpack.capacityPips;i++){const p=document.createElement("span");p.className=i<used?"capacity-pip capacity-pip--used":"capacity-pip";pips.append(p);}inventoryList.replaceChildren();const items=game.inventory.getItems();if(!items.length){const e=document.createElement("p");e.className="inventory-empty";e.textContent="The pack is empty.";inventoryList.append(e);return;}for(const item of items){const def=getItemDefinition(item.definitionId),row=document.createElement("article");row.className="inventory-row";const summary=document.createElement("div");summary.className="item-summary";const icon=document.createElement("canvas");icon.className="item-icon";const copy=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("span");name.textContent=def.name;meta.textContent=`${def.category} · ${def.sizePips} ${def.sizePips===1?"pip":"pips"}${item.condition==="wet"?" · WET":""}`;copy.append(name,meta);summary.append(icon,copy);row.append(summary);renderItemThumbnail(icon,item.definitionId,item.condition);const actions=document.createElement("div");actions.className="item-actions";for(const [label,handler] of [["Inspect",()=>inspectItem(item)],["Hold",()=>{if(game.inventory.hold(item.id))closeInventory();}],["Drop",()=>{game.inventory.drop(item.id);buildInventory();}]]){const b=document.createElement("button");b.textContent=label;b.addEventListener("click",handler);actions.append(b);}row.append(actions);inventoryList.append(row);}}
function openInventory(){if(!started||game.interaction.searchingEntityId)return;inventoryOpen=true;game.operator.lockedByInteraction=true;inventoryOverlay.hidden=false;buildInventory();}function closeInventory(){inventoryOpen=false;inventoryOverlay.hidden=true;if(!modalOpen())game.operator.lockedByInteraction=false;}
function buildOperations(){const list=$("#operations-list"),commune=game.operations.summary().filter(o=>o.playerEligible);list.replaceChildren(...commune.map(o=>{const card=document.createElement("article");card.className=`operation-card operation-card--${o.factionId}${o.claimed?" operation-card--claimed":""}`;const head=document.createElement("header"),copy=document.createElement("div"),faction=document.createElement("span"),title=document.createElement("h3"),status=document.createElement("span"),summary=document.createElement("p"),task=document.createElement("p");faction.className="eyebrow";faction.textContent="COMMUNE · YOUR FACTION";title.textContent=o.title;status.className="operation-status";status.textContent=o.status;summary.textContent=o.summary;task.textContent=`Current work: ${o.current}`;copy.append(faction,title);head.append(copy,status);card.append(head,summary,task);const button=document.createElement("button");button.type="button";button.textContent=o.claimed?"Task Taken Up":"Take Up Commune Task";button.disabled=o.claimed||o.status==="completed";button.dataset.operationId=o.id;card.append(button);return card;}));if(!commune.length){const empty=document.createElement("p");empty.className="inventory-empty";empty.textContent="No Commune operations are available right now.";list.append(empty);}}
function openOperations(){if(!started)return;operationsOpen=true;game.operator.lockedByInteraction=true;operationsOverlay.hidden=false;buildOperations();}function closeOperations(){operationsOpen=false;operationsOverlay.hidden=true;if(!modalOpen())game.operator.lockedByInteraction=false;}
function inspectItem(item){const def=getItemDefinition(item.definitionId);$("#inspect-category").textContent=def.category;$("#inspect-name").textContent=def.name;$("#inspect-size").textContent=`Condition: ${item.condition==="wet"?"Wet":"Dry"}`;$("#inspect-description").textContent=item.condition==="wet"&&item.definitionId==="bandage"?"The outer wrapping is soaked. It is no longer suitable as a clean dressing.":def.description;$("#inspect-location").textContent=item.locationType==="backpack"?"Currently in Mara's field pack.":item.locationType==="hands"?"Currently in Mara's hands.":"Currently in the world.";inspectOverlay.hidden=false;}
function openWorldText(request){if(!request)return;worldTextOpen=true;game.operator.lockedByInteraction=true;const{entity,mode}=request;$("#inspect-category").textContent=mode==="read"?"FIELD DOCUMENT":"OBSERVATION";$("#inspect-name").textContent=entity.name;$("#inspect-size").textContent=mode==="read"?"Read in place":"Field observation";$("#inspect-description").textContent=entity.text;$("#inspect-location").textContent=game.excursion.state==="outbound"||game.excursion.culvertInspected?"Along the north maintenance route.":"At the Old Maintenance Pull-Off.";inspectOverlay.hidden=false;game.worldTextRequest=null;}
function closeInspect(){inspectOverlay.hidden=true;worldTextOpen=false;if(!modalOpen())game.operator.lockedByInteraction=false;}
function openDialogue(request){if(!request)return;dialogueOpen=true;game.operator.lockedByInteraction=true;$("#dialogue-role").textContent=request.actor.role;$("#dialogue-name").textContent=request.actor.name;$("#dialogue-text").textContent=request.text;$("#dialogue-overlay").hidden=false;game.dialogueRequest=null;}function closeDialogue(){dialogueOpen=false;$("#dialogue-overlay").hidden=true;if(!modalOpen())game.operator.lockedByInteraction=false;}
function openReport(report){if(!report)return;$("#report-title").textContent=report.title;const lines=$("#report-lines");lines.replaceChildren(...report.lines.map(text=>{const p=document.createElement("p");p.textContent=text;return p;}));reportOverlay.hidden=false;game.operator.lockedByInteraction=true;game.excursion.reportRequest=null;}function closeReport(){reportOverlay.hidden=true;if(!modalOpen())game.operator.lockedByInteraction=false;}
function updateObjective(){const strong=$("#objective-card strong"),copy=$("#objective-card span:last-child"),selected=game.operations.selectedOperation;if(game.scenarioMode==="live"){
 const summary=game.livingSandbox?.summary?.();
 const active=summary?.operations?.filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status))??[];
 strong.textContent=`${active.length} active operation${active.length===1?"":"s"} · ${summary?.needs?.filter(need=>need.status==="open").length??0} open needs`;
 copy.textContent="Operation says why. Agenda says what. Procedure says who. Operators choose how. The scheduler alone makes it physical.";
 return;
}if(game.scenarioMode==="sandbox"){const fixture=game.sandboxFixture;strong.textContent=fixture.label;copy.textContent=game.aiRuntimeMode==="v2"
  ?fixture.id===SANDBOX_FIXTURE_IDS.OPEN_CONTACT
    ?`${fixture.question} Personal threat evidence now drives immediate initiative, urgent reporting, bounded protective fire, and staged movement to safety.`
    :fixture.id===SANDBOX_FIXTURE_IDS.OBSERVATION
      ?`${fixture.question} Observation, warning, silent withdrawal, and de-escalation are active.`
      :fixture.id===SANDBOX_FIXTURE_IDS.CASUALTY_RECOVERY
        ?`${fixture.question} Recovery, stabilization, physical carrier handoff, adaptive evacuation, and safe return are active.`
        :`${fixture.question} This fixture has no authored V2 behavior yet.`
  :`${fixture.question} Legacy behavior is running without random patrols or reinforcements.`;return;}if(game.incident.state!=="resolved"){if(game.incident.bandageUsed&&game.incident.waterUsed){strong.textContent="Ada is stabilized";copy.textContent="Assist her to shelter and restore the field radio.";}return;}if(selected&&selected.status!=="completed"){strong.textContent=selected.title;copy.textContent=`Current task: ${selected.tasks.find(t=>["in_progress","blocked"].includes(t.status))?.label??"Respond to conditions"}.`;}else if(game.excursion.state==="available"){strong.textContent="Follow the north trail";copy.textContent="Leave the pull-off on foot and follow the marked trail east toward the culvert.";}else if(game.excursion.state==="outbound"){strong.textContent="Continue to the north culvert";copy.textContent="Stay on the trail. Other field teams are already working ahead.";}else if(game.excursion.state==="at_destination"){strong.textContent="Work is overlapping at the culvert";copy.textContent="Hold rope and rig the debris, mark the hazard, or assist another team.";}else if(game.excursion.state==="returning"){strong.textContent="Return to the pull-off";copy.textContent="Bring recovered cargo into the RETURN marker.";}else{strong.textContent="Safe return";copy.textContent="The field report records what every team accomplished.";}}
function updateCompass(){
 const chip=$("#compass-chip"),heading=$("#compass-heading");
 if(!chip||!heading)return;
 const has=game.inventory.getItems().some(i=>i.definitionId==="compass")||game.getHeldItem()?.definitionId==="compass";
 chip.hidden=!has;
 if(has){
  const labels={up:"NORTH",right:"EAST",down:"SOUTH",left:"WEST"};
  heading.textContent=labels[game.operator.facing];
 }
}
function updateDebug(delta){fpsAccumulator+=delta;fpsFrames++;if(fpsAccumulator>=.5){fpsValue=Math.round(fpsFrames/fpsAccumulator);fpsAccumulator=0;fpsFrames=0;}$("#debug-build").textContent=declaredBuild===BUILD_ID?BUILD_ID:`HTML ${declaredBuild} / JS ${BUILD_ID}`;$("#debug-fps").textContent=fpsValue;$("#debug-position").textContent=`${Math.round(game.operator.x)}, ${Math.round(game.operator.y)}`;
$("#debug-camera").textContent=`${Math.round(camera.x)}, ${Math.round(camera.y)}`;
$("#debug-viewport").textContent=`${Math.round(camera.width)}×${Math.round(camera.height)} · ${Math.round(camera.zoom*100)}%`;
const operatorScreen=camera.worldToScreen(game.operator.x,game.operator.y);
const screenX=operatorScreen.x,screenY=operatorScreen.y;
$("#debug-screen-position").textContent=`${Math.round(screenX)}, ${Math.round(screenY)}`;
$("#debug-operator-visible").textContent=camera.contains(game.operator,0)?"yes":"NO";
$("#debug-render").textContent=renderer.lastOperatorRenderError?"ERROR":"OK";$("#debug-facing").textContent=game.operator.facing;$("#debug-target").textContent=game.interaction.getTarget()?.id??"—";$("#debug-incident").textContent=game.incident.state;$("#debug-excursion").textContent=game.excursion.state;$("#debug-operations").textContent=game.operations.started?`${game.operations.operations.filter(o=>o.status==="completed").length}/3 complete · ${game.perception?.identifiedContactCount??0} contact(s) · ${game.encounters?.activeCount??0} encounter(s)`:"inactive";$("#debug-obstruction").textContent=game.excursion.obstructionState;$("#debug-water").textContent=game.isInWater()?`${game.waterExposure.toFixed(1)}s`:findEntity(game.entities,"culvert_water_01")?.depth??"dry";$("#debug-weather").textContent=`${game.weather} · light ${Math.round((game.getLightLevel?.()??1)*100)}%`;$("#debug-collision").textContent=game.getCollisionReason?.()??"clear";const r=game.lastCollisionRecovery;$("#debug-recovery").textContent=r?`${r.context}: ${Math.round(r.to.x)},${Math.round(r.to.y)}`:"none";const combatActors=game.actors.filter(actor=>actor.operationId&&!actor.medical?.dead);
const suppressors=combatActors.filter(actor=>actor.fireTeamRole==="base_of_fire").length;
const reversals=combatActors.reduce((sum,actor)=>sum+(actor.intentReversals??0),0);
const stalled=combatActors.filter(actor=>actor.combatStalled).length;
const withdrawing=combatActors.filter(actor=>actor.combatPosture==="withdraw"||actor.combatPosture==="regroup").length;
const assessments=[...new Set(combatActors.map(actor=>actor.fightAssessmentState).filter(Boolean))].join("/")||"quiet";
$("#debug-ai-runtime").textContent=game.aiRuntimeLabel??game.aiRuntimeMode;
$("#debug-fixture").textContent=game.scenarioMode==="sandbox"?`${game.sandboxFixture?.index??"—"} ${game.sandboxFixture?.shortLabel??game.sandboxFixture?.label??"—"}`:"—";
if(game.aiRuntimeMode==="v2"){
 const summary=game.aiV2?.getDebugSummary?.()??"V2 unavailable";
 const details=game.aiV2?.getDebugDetails?.()??{};
 $("#debug-ai").textContent=summary;
 $("#debug-v2-assignment").textContent=details.assignment??"—";
 $("#debug-v2-personal").textContent=details.personalKnowledge??"none";
 $("#debug-v2-activity").textContent=details.activity??"none";
 $("#debug-v2-communication").textContent=details.communication??"none";
 $("#debug-v2-team").textContent=details.teamKnowledge??"none";
 $("#debug-v2-encounter").textContent=details.encounter??"none";
 $("#debug-v2-response").textContent=details.response??"none";
 $("#debug-v2-procedure").textContent=details.procedure??"none";
 $("#debug-v2-position").textContent=details.position??"none";
 $("#debug-v2-outcome").textContent=details.outcome??"none";
}else{
 $("#debug-ai").textContent=`${game.aiCombat?.activeShooters??0} active · ${suppressors} suppressor(s) · ${withdrawing} regrouping · ${stalled} stalled · ${reversals} reversal(s) · ${assessments}`;
 $("#debug-v2-assignment").textContent="—";
 $("#debug-v2-personal").textContent="—";
 $("#debug-v2-activity").textContent="—";
 $("#debug-v2-communication").textContent="—";
 $("#debug-v2-team").textContent="—";
 $("#debug-v2-encounter").textContent="—";
 $("#debug-v2-response").textContent="—";
 $("#debug-v2-procedure").textContent="—";
 $("#debug-v2-position").textContent="—";
 $("#debug-v2-outcome").textContent="—";
}
const errors=validateItemLocations(game);$("#debug-audit").textContent=errors.length?`${errors.length} issue(s)`:"OK";}
function updateCombatUI(){
 const combat=game.combat;
 const available=combat.weaponAvailable;
 combatControls.hidden=!available;
 if(!available){
  combat.toggleAim(false);
  return;
 }
 ammoCount.textContent=combat.reloading?"RELOAD":`${combat.ammoInMagazine}/${combat.magazineSize}`;
 aimMode.textContent=combat.aiming?"AIM":"LOW";
 aimButton.classList.toggle("aim-button--active",combat.aiming);
 aimButton.setAttribute("aria-pressed",String(combat.aiming));
 fireButton.classList.toggle("fire-button--aiming",combat.aiming);
 fireButton.classList.toggle("fire-button--reloading",combat.reloading);
 fireButton.disabled=combat.reloading;
 reloadFill.style.width=`${Math.round(Math.max(0,combat.reloadProgress)*100)}%`;
}

function updateMedicalUI(){
 const status=$("#medical-status"),condition=$("#medical-condition"),detail=$("#medical-detail");
 const summary=game.wounds?.getSummary?.(game.operator);
 if(!status||!summary)return;
 status.hidden=summary.condition==="healthy";
 condition.textContent=summary.condition.toUpperCase();
 detail.textContent=`Blood ${summary.blood}% · Shock ${summary.shock}% · Pain ${summary.pain}%${summary.bleeding>.05?` · Bleeding ${summary.bleeding.toFixed(1)}`:""}`;
}

function worldAimAngleFromPointer(clientX,clientY){
 const rect=canvas.getBoundingClientRect();
 const pointer= camera.screenToWorld(clientX-rect.left,clientY-rect.top);
 return Math.atan2(pointer.y-game.operator.y,pointer.x-game.operator.x);
}

function tryWorldInteraction(screenX,screenY){
 const target=game.interaction.getTarget();
 if(!target||!game.interaction.activeAction||game.interaction.activeAction.disabled)return false;
 const screen=camera.worldToScreen(target.x+(target.width??0)/2,target.y+(target.height??0)/2);
 const cx=screen.x;
 const cy=screen.y;
 const radius=Math.max(58,(target.radius??0)+42,Math.max(target.width??0,target.height??0)*.65);
 if(Math.hypot(screenX-cx,screenY-cy)>radius)return false;
 return Boolean(triggerContextAction());
}

const combatInput=new CombatInputController({
 touchSurface:gameScreen,
 aimButton,
 fireButton,
 canvas,
 combat:game.combat,
 getCombat:()=>game.combat,
 movementInput:input,
 getAimAngle:worldAimAngleFromPointer,
 tryWorldInteraction,
 isBlocked:modalOpen,
 isStarted:()=>started,
 canUseCombat:()=>game.combat.weaponAvailable&&game.wounds.canAct(game.operator)
});



function liveElement(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
function readableEvent(entry,summary){
 const data=entry.data??{};
 const faction=summary.factions.find(item=>item.id===data.factionId)?.label??data.factionId??null;
 const operation=summary.operations.find(item=>item.id===data.operationId);
 const actor=game.actors.find(item=>item.id===data.actorId);
 const subject=actor?.name??operation?.objectiveLabel??data.rosterId??data.packageId??data.pointId??"";
 const labels={
  faction_contested_operation_proposed:"Rival operation committed",
  live_ballistic_wound:"Operator wounded by live fire",
  cargo_package_dropped:"Cargo dropped in the field",
  cargo_package_picked_up:"Cargo package secured",
  operation_cargo_reconciled:"Returned cargo reconciled",
  survey_point_recorded:"Route intelligence recorded",
  roster_member_returned:"Operator returned",
  roster_member_died:"Operator killed — permanently lost",
  roster_member_leveled:"Operator advanced a level",
  faction_operation_interrupted:"Operation interrupted",
  faction_operation_deferred:"Operation deferred",
  faction_operation_completed:"Operation completed",
  live_world_objective_changed:"World condition changed",
  world_need_reopened:"World need reopened"
 };
 const label=labels[entry.type]??entry.type.replaceAll("_"," ");
 return`${label}${faction?` · ${faction}`:""}${subject?` · ${subject}`:""}`;
}
function operationDetail(operation){
 const procedure=operation.teamId?game.aiV2?.teamProcedures?.get?.(operation.teamId):null;
 const cargo=game.livingSandbox?.cargoStatus?.(operation.id);
 const survey=game.livingSandbox?.surveyStatus?.(operation.id);
 const parts=[operation.status,procedure?.phase?.label??game.aiV2?.teamAgenda?.get?.(operation.teamId)?.selected?.label??"assembling"];
 if(operation.contested)parts.push("challenger");
 if(operation.contestedByOperationId)parts.push("contested worksite");
 if(cargo?.total)parts.push(`${cargo.carried+ cargo.returned}/${cargo.total} units secured${cargo.dropped?` · ${cargo.dropped} dropped`:""}`);
 if(survey?.total)parts.push(`${survey.completed}/${survey.total} points recorded`);
 if(operation.casualtyCount)parts.push(`${operation.casualtyCount} casualty${operation.casualtyCount===1?"":"ies"}`);
 if(operation.deathCount)parts.push(`${operation.deathCount} dead`);
 return parts.filter(Boolean).join(" · ");
}
function updateLiveDashboard(force=false){
 if(game.scenarioMode!=="live")return;
 if(!force&&game.clockMinutes-lastLiveDashboardAt<.02)return;
 lastLiveDashboardAt=game.clockMinutes;
 const summary=game.livingSandbox?.summary?.();if(!summary)return;
 const factions=$("#live-factions");factions.replaceChildren(...summary.factions.map(faction=>{
  const card=liveElement("article","live-faction");
  const resources=Object.entries(faction.resources??{}).map(([key,value])=>`${key.slice(0,3)} ${Math.round(value*10)/10}`).join(" · ");
  const veterans=faction.roster.filter(member=>member.level>1).length;
  card.append(
   liveElement("strong",null,faction.label),
   liveElement("b",null,String(faction.score)),
   liveElement("small",null,`${faction.available} ready · ${faction.deployed} out · ${faction.recovering} recovering`),
   liveElement("small",faction.dead?"live-danger":"",`${faction.wounded} wounded · ${faction.dead} dead · ${veterans} veteran${veterans===1?"":"s"}`),
   liveElement("small","live-resources",resources)
  );
  return card;
 }));
 const operations=$("#live-operations");
 const active=summary.operations.filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status));
 operations.replaceChildren(...active.slice(-8).map(operation=>{
  const row=liveElement("article",`live-operation live-operation--${operation.kind.replaceAll("_","-")}${operation.contested?" live-operation--contested":""}`);
  row.append(
   liveElement("strong",null,`${operation.factionLabel} · ${operation.label}`),
   liveElement("small",null,operationDetail(operation)),
   liveElement("small","live-operation-meta",`fit ${Math.round(operation.capabilityFit*100)} · value ${Math.round(operation.strategicValue*100)} · attempt ${operation.attemptNumber}`)
  );
  return row;
 }));
 if(!active.length)operations.append(liveElement("div","live-event","No active operations; factions are evaluating open needs."));
 const candidates=$("#live-candidates");
 candidates.replaceChildren(...(summary.candidates??[]).slice(0,5).map(candidate=>{
  const terms=candidate.scoreBreakdown??{};
  const row=liveElement("article","live-operation live-candidate");
  row.append(
   liveElement("strong",null,`${candidate.factionLabel} → ${candidate.objectiveLabel}`),
   liveElement("small",null,`${candidate.kind.replaceAll("_"," ")} · score ${Math.round(candidate.score*100)} · interest +${Math.round((terms.interest??0)*100)} · priority +${Math.round((terms.priority??0)*100)} · fit +${Math.round((terms.capabilityFit??0)*100)} · scarcity ${Math.round((terms.rosterScarcity??0)*100)}`)
  );
  return row;
 }));
 if(!(summary.candidates??[]).length)candidates.append(liveElement("div","live-event","No dispatch candidate currently has an available roster, resources, and open need."));
 const roster=$("#live-roster");
 const notable=summary.factions.flatMap(faction=>faction.roster.map(member=>({...member,factionLabel:faction.label})))
  .filter(member=>member.level>1||member.healthStatus!=="healthy"||member.status==="recovering"||member.operationCount>=3)
  .sort((left,right)=>(right.level-left.level)||(right.experience-left.experience)||left.name.localeCompare(right.name)).slice(0,8);
 roster.replaceChildren(...notable.map(member=>{
  const row=liveElement("article",`live-roster-row${member.healthStatus==="dead"?" live-roster-row--dead":member.healthStatus==="wounded"?" live-roster-row--wounded":""}`);
  row.append(
   liveElement("strong",null,`${member.name} · L${member.level}`),
   liveElement("small",null,`${member.factionLabel} · ${member.role} · ${member.status} · ${member.operationCount} ops · ${member.successfulReturns} returns`),
   liveElement("small","live-roster-history",`${member.experience} XP${member.wounds?.length?` · ${member.wounds.length} persistent wound${member.wounds.length===1?"":"s"}`:""}`)
  );
  return row;
 }));
 if(!notable.length)roster.append(liveElement("div","live-event","The first generation of operators is still building campaign history."));
 const authority=$("#live-authority");
 const traces=game.aiV2?.actionArbiter?.summary?.()??[];
 const visible=traces.filter(trace=>trace.active.length||trace.granted.length).slice(-6);
 authority.replaceChildren(...visible.map(trace=>{
  const actor=game.actors.find(candidate=>candidate.id===trace.actorId);
  const role=game.aiV2?.teamProcedures?.getActorRole?.(trace.actorId);
  const agenda=actor?game.aiV2?.teamAgenda?.get?.(actor.teamId):null;
  const operation=actor?.operationId?summary.operations.find(candidate=>candidate.id===actor.operationId):null;
  const action=trace.active.map(item=>item.actionType).join(" + ")||trace.granted[0]?.actionType||"waiting";
  const rejected=trace.rejected[0];
  const row=liveElement("article","live-authority-row");
  row.append(
   liveElement("strong",null,`${actor?.name??trace.actorId}${actor?.persistentLevel?` · L${actor.persistentLevel}`:""}`),
   liveElement("small",null,`${operation?.label??"Operation"} → ${agenda?.selected?.label??"Mission"} → ${role?.roleLabel??"Field Operator"} → ${action}`),
   rejected?liveElement("small","live-rejected",`rejected ${rejected.actionType}: ${rejected.resultReason}`):document.createTextNode("")
  );
  return row;
 }));
 const events=$("#live-events");
 const interesting=new Set(["faction_contested_operation_proposed","live_ballistic_wound","cargo_package_dropped","cargo_package_picked_up","operation_cargo_reconciled","survey_point_recorded","roster_member_returned","roster_member_died","roster_member_leveled","faction_operation_interrupted","faction_operation_deferred","faction_operation_completed","live_world_objective_changed","world_need_reopened"]);
 const feed=summary.history.filter(entry=>interesting.has(entry.type)).slice(-9).reverse();
 events.replaceChildren(...feed.map(entry=>liveElement("div",`live-event live-event--${entry.type}`,readableEvent(entry,summary))));
 if(!feed.length)events.append(liveElement("div","live-event","The live campaign is beginning to write its first field history."));
}
function restartLive(){
 game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
 simulationPaused=false;simulationSpeed=1;
 document.querySelectorAll(".live-speed").forEach(button=>button.classList.toggle("live-speed--active",button.dataset.speed==="1"));
 $("#live-pause").textContent="PAUSE";
 requestAnimationFrame(()=>resizeAndCenter("live sandbox restart"));
 updateLiveDashboard(true);
}

function frame(now){const realDelta=Math.min((now-lastTime)/1000,.033);const delta=simulationPaused?0:realDelta*simulationSpeed;lastTime=now;if(started){try{game.routeReviewRequest=false;game.update(delta,inventoryOpen||operationsOpen?{x:0,y:0}:input.getMoveVector());camera.update(game,realDelta);updateInteractionUI();if(game.worldTextRequest&&!worldTextOpen)openWorldText(game.worldTextRequest);if(game.dialogueRequest&&!dialogueOpen)openDialogue(game.dialogueRequest);if(game.assessmentRequest&&!dialogueOpen){openDialogue({actor:game.assessmentRequest.actor,text:game.assessmentRequest.text});game.assessmentRequest=null;}if(game.excursion.reportRequest&&reportOverlay.hidden)openReport(game.excursion.reportRequest);$("#world-time").textContent=game.getTimeLabel();$("#world-phase").textContent=`${game.getDayPhase()} · ${game.weather}${game.isNight?.()?` · ${game.moonPhaseName}`:""}`;$("#weather-icon").textContent=game.isNight?.()?"☾":game.weather==="Rain"||game.weather==="Heavy Rain"?"☂":game.weather==="Cloudy"?"☁":game.weather==="Fog"?"≋":"☀";updateObjective();updateCompass();updateCombatUI();updateMedicalUI();updateLiveDashboard();if(!$("#debug-panel").hidden)updateDebug(realDelta);}catch(error){console.error("Fieldwork simulation frame failed",error);}try{renderer.render(game);}catch(error){console.error("Fieldwork render frame failed",error);}}requestAnimationFrame(frame);}
function recoverPosition(source){const before={x:game.operator.x,y:game.operator.y};game.resetPosition();camera.snapTo(game.operator);console.info("Fieldwork position recovery",{build:BUILD_ID,source,before,after:{x:game.operator.x,y:game.operator.y}});}


// Prevent Safari gesture zoom from stealing rapid combat taps.
document.addEventListener("dblclick",event=>event.preventDefault(),{passive:false});
document.addEventListener("gesturestart",event=>event.preventDefault(),{passive:false});
document.addEventListener("gesturechange",event=>event.preventDefault(),{passive:false});
document.addEventListener("gestureend",event=>event.preventDefault(),{passive:false});
aiRuntimeSelect.addEventListener("change",()=>{
  writeStoredAIRuntime(selectedAIRuntime());
  updateAIRuntimeDescription();
});
sandboxFixtureSelect.addEventListener("change",()=>{
  writeStoredSandboxFixture(selectedSandboxFixture());
  updateSandboxFixtureDescription();
});
beginButton.addEventListener("click",()=>startGame("operations"));sandboxButton.addEventListener("click",()=>startGame("sandbox"));liveSandboxButton.addEventListener("click",()=>startGame("live"));
$("#live-pause")?.addEventListener("click",()=>{simulationPaused=!simulationPaused;$("#live-pause").textContent=simulationPaused?"RESUME":"PAUSE";});
document.querySelectorAll(".live-speed").forEach(button=>button.addEventListener("click",()=>{simulationSpeed=Number(button.dataset.speed)||1;simulationPaused=false;$("#live-pause").textContent="PAUSE";document.querySelectorAll(".live-speed").forEach(candidate=>candidate.classList.toggle("live-speed--active",candidate===button));}));
$("#live-restart")?.addEventListener("click",restartLive);
$("#live-panel-toggle")?.addEventListener("click",()=>{$("#live-sandbox-panel").classList.toggle("live-sandbox-panel--collapsed");});
$("#backpack-button").addEventListener("click",event=>{event.preventDefault();event.stopPropagation();inventoryOpen?closeInventory():openInventory();});
$("#inventory-close").addEventListener("click",closeInventory);
$("#operations-close").addEventListener("click",closeOperations);
$("#inspect-close").addEventListener("click",closeInspect);
$("#dialogue-close").addEventListener("click",closeDialogue);
$("#report-close").addEventListener("click",closeReport);
interactButton.addEventListener("pointerdown",event=>{event.preventDefault();event.stopPropagation();triggerContextAction();},{passive:false});
window.addEventListener("keydown",event=>{const key=event.key.toLowerCase();if(key==="e"&&started){event.preventDefault();triggerContextAction();}if(key==="b"&&started){event.preventDefault();inventoryOpen?closeInventory():openInventory();}if(key==="o"&&started){event.preventDefault();operationsOpen?closeOperations():openOperations();}if(key==="escape"){if(dialogueOpen)closeDialogue();else if(operationsOpen)closeOperations();else if(!reportOverlay.hidden)closeReport();else if(!inspectOverlay.hidden)closeInspect();else if(inventoryOpen)closeInventory();}});
$("#reset-position-button").addEventListener("click",()=>recoverPosition("debug reset button"));$("#debug-button").addEventListener("click",()=>{const active=$("#debug-button").getAttribute("aria-pressed")==="true";$("#debug-button").setAttribute("aria-pressed",String(!active));$("#debug-panel").hidden=active;$("#reset-position-button").hidden=active;});$("#objective-card").addEventListener("click",()=>{$("#objective-card").classList.toggle("objective-card--collapsed");if(objectiveTimer)clearTimeout(objectiveTimer);});window.addEventListener("resize",()=>{if(started)resizeAndCenter("window resize");});window.visualViewport?.addEventListener("resize",()=>{if(started)resizeAndCenter("visual viewport resize");});window.addEventListener("orientationchange",()=>{if(started)setTimeout(()=>resizeAndCenter("orientation change"),120);});requestAnimationFrame(frame);
