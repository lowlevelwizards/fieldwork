import { Camera } from "./camera.js?v=12e-fire-teams-suppression-authority-20260801";
import { ContinuousGameState } from "./continuous-game-state.js?v=12e-fire-teams-suppression-authority-20260801";
import { InputController, CombatInputController } from "./input.js?v=12e-fire-teams-suppression-authority-20260801";
import { Renderer } from "./renderer.js?v=12e-fire-teams-suppression-authority-20260801";
import { getItemDefinition } from "../data/items.js?v=12e-fire-teams-suppression-authority-20260801";
import { findEntity } from "./world-entities.js?v=12e-fire-teams-suppression-authority-20260801";
import { validateItemLocations } from "./item-locations.js?v=12e-fire-teams-suppression-authority-20260801";
import { renderItemThumbnail } from "./presentation/item-renderer.js?v=12e-fire-teams-suppression-authority-20260801";

const BUILD_ID="1.2E";
const $=s=>document.querySelector(s),titleScreen=$("#title-screen"),gameScreen=$("#game-screen"),beginButton=$("#begin-button"),canvas=$("#game-canvas"),inventoryOverlay=$("#inventory-overlay"),inspectOverlay=$("#inspect-overlay"),inventoryList=$("#inventory-list"),reportOverlay=$("#report-overlay"),operationsOverlay=$("#operations-overlay");
const declaredBuild=document.querySelector('meta[name="fieldwork-build"]')?.content??"missing";
document.documentElement.dataset.build=BUILD_ID;
$("#title-build-id").textContent=BUILD_ID;
$("#debug-build").textContent=declaredBuild===BUILD_ID?BUILD_ID:`HTML ${declaredBuild} / JS ${BUILD_ID}`;
if(declaredBuild!==BUILD_ID){console.error("Fieldwork build mismatch",{html:declaredBuild,javascript:BUILD_ID});setTimeout(()=>alert(`Fieldwork cache mismatch detected.\nHTML: ${declaredBuild}\nJavaScript: ${BUILD_ID}\nReload the page once.`),50);}
console.info(`Fieldwork ${BUILD_ID} loaded`,{href:location.href,time:new Date().toISOString()});

const camera=new Camera();let game=new ContinuousGameState({scenario:"operations"});const renderer=new Renderer(canvas,camera),input=new InputController({joystickBase:$("#joystick-base"),joystickKnob:$("#joystick-knob")});
const sandboxButton=$("#sandbox-button"),aimButton=$("#aim-button"),fireButton=$("#fire-button"),ammoCount=$("#ammo-count"),aimMode=$("#aim-mode"),reloadFill=$("#reload-progress-fill"),combatControls=$("#combat-controls"),interactButton=$("#interact-button"),searchStatus=$("#search-status"),searchLabel=$("#search-label"),searchFill=$("#search-progress-fill");
let started=false,inventoryOpen=false,operationsOpen=false,worldTextOpen=false,dialogueOpen=false,lastTime=performance.now(),fpsAccumulator=0,fpsFrames=0,fpsValue=0,objectiveTimer=null;
function resizeAndCenter(reason="viewport"){
  renderer.resize();
  camera.lockTo(game.operator);
  console.info("Viewport synchronized",{build:BUILD_ID,reason,operator:{x:game.operator.x,y:game.operator.y},camera:{x:camera.x,y:camera.y,width:camera.width,height:camera.height}});
}
function startGame(scenario="operations"){
  if(started)return;
  game=new ContinuousGameState({scenario});
  titleScreen.classList.remove("screen--active");
  gameScreen.classList.add("screen--active");
  started=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>resizeAndCenter("game start")));
  lastTime=performance.now();
  const objective=$("#objective-card");
  if(scenario==="sandbox"){
    objective.querySelector(".objective-kicker").textContent="COMBAT SANDBOX";
    objective.querySelector("strong").textContent="Three-way tactical test";
    objective.querySelector("span:last-child").textContent="Northline enters from the north, Freelancers from the south, and Commune from the west. Reinforcements replace lost teams.";
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
function updateObjective(){const strong=$("#objective-card strong"),copy=$("#objective-card span:last-child"),selected=game.operations.selectedOperation;if(game.incident.state!=="resolved"){if(game.incident.bandageUsed&&game.incident.waterUsed){strong.textContent="Ada is stabilized";copy.textContent="Assist her to shelter and restore the field radio.";}return;}if(selected&&selected.status!=="completed"){strong.textContent=selected.title;copy.textContent=`Current task: ${selected.tasks.find(t=>["in_progress","blocked"].includes(t.status))?.label??"Respond to conditions"}.`;}else if(game.excursion.state==="available"){strong.textContent="Follow the north trail";copy.textContent="Leave the pull-off on foot and follow the marked trail east toward the culvert.";}else if(game.excursion.state==="outbound"){strong.textContent="Continue to the north culvert";copy.textContent="Stay on the trail. Other field teams are already working ahead.";}else if(game.excursion.state==="at_destination"){strong.textContent="Work is overlapping at the culvert";copy.textContent="Hold rope and rig the debris, mark the hazard, or assist another team.";}else if(game.excursion.state==="returning"){strong.textContent="Return to the pull-off";copy.textContent="Bring recovered cargo into the RETURN marker.";}else{strong.textContent="Safe return";copy.textContent="The field report records what every team accomplished.";}}
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
$("#debug-ai").textContent=`${game.aiCombat?.activeShooters??0} active · ${suppressors} suppressor(s) · ${reversals} reversal(s)`;
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


function frame(now){const delta=Math.min((now-lastTime)/1000,.033);lastTime=now;if(started){try{game.routeReviewRequest=false;game.update(delta,inventoryOpen||operationsOpen?{x:0,y:0}:input.getMoveVector());camera.update(game,delta);updateInteractionUI();if(game.worldTextRequest&&!worldTextOpen)openWorldText(game.worldTextRequest);if(game.dialogueRequest&&!dialogueOpen)openDialogue(game.dialogueRequest);if(game.assessmentRequest&&!dialogueOpen){openDialogue({actor:game.assessmentRequest.actor,text:game.assessmentRequest.text});game.assessmentRequest=null;}if(game.excursion.reportRequest&&reportOverlay.hidden)openReport(game.excursion.reportRequest);$("#world-time").textContent=game.getTimeLabel();$("#world-phase").textContent=`${game.getDayPhase()} · ${game.weather}${game.isNight?.()?` · ${game.moonPhaseName}`:""}`;$("#weather-icon").textContent=game.isNight?.()?"☾":game.weather==="Rain"||game.weather==="Heavy Rain"?"☂":game.weather==="Cloudy"?"☁":game.weather==="Fog"?"≋":"☀";updateObjective();updateCompass();updateCombatUI();updateMedicalUI();if(!$("#debug-panel").hidden)updateDebug(delta);}catch(error){console.error("Fieldwork simulation frame failed",error);}try{renderer.render(game);}catch(error){console.error("Fieldwork render frame failed",error);}}requestAnimationFrame(frame);}
function recoverPosition(source){const before={x:game.operator.x,y:game.operator.y};game.resetPosition();camera.snapTo(game.operator);console.info("Fieldwork position recovery",{build:BUILD_ID,source,before,after:{x:game.operator.x,y:game.operator.y}});}


// Prevent Safari gesture zoom from stealing rapid combat taps.
document.addEventListener("dblclick",event=>event.preventDefault(),{passive:false});
document.addEventListener("gesturestart",event=>event.preventDefault(),{passive:false});
document.addEventListener("gesturechange",event=>event.preventDefault(),{passive:false});
document.addEventListener("gestureend",event=>event.preventDefault(),{passive:false});
beginButton.addEventListener("click",()=>startGame("operations"));sandboxButton.addEventListener("click",()=>startGame("sandbox"));
$("#backpack-button").addEventListener("click",event=>{event.preventDefault();event.stopPropagation();inventoryOpen?closeInventory():openInventory();});
$("#inventory-close").addEventListener("click",closeInventory);
$("#operations-close").addEventListener("click",closeOperations);
$("#inspect-close").addEventListener("click",closeInspect);
$("#dialogue-close").addEventListener("click",closeDialogue);
$("#report-close").addEventListener("click",closeReport);
interactButton.addEventListener("pointerdown",event=>{event.preventDefault();event.stopPropagation();triggerContextAction();},{passive:false});
window.addEventListener("keydown",event=>{const key=event.key.toLowerCase();if(key==="e"&&started){event.preventDefault();triggerContextAction();}if(key==="b"&&started){event.preventDefault();inventoryOpen?closeInventory():openInventory();}if(key==="o"&&started){event.preventDefault();operationsOpen?closeOperations():openOperations();}if(key==="escape"){if(dialogueOpen)closeDialogue();else if(operationsOpen)closeOperations();else if(!reportOverlay.hidden)closeReport();else if(!inspectOverlay.hidden)closeInspect();else if(inventoryOpen)closeInventory();}});
$("#reset-position-button").addEventListener("click",()=>recoverPosition("debug reset button"));$("#debug-button").addEventListener("click",()=>{const active=$("#debug-button").getAttribute("aria-pressed")==="true";$("#debug-button").setAttribute("aria-pressed",String(!active));$("#debug-panel").hidden=active;$("#reset-position-button").hidden=active;});$("#objective-card").addEventListener("click",()=>{$("#objective-card").classList.toggle("objective-card--collapsed");if(objectiveTimer)clearTimeout(objectiveTimer);});window.addEventListener("resize",()=>{if(started)resizeAndCenter("window resize");});window.visualViewport?.addEventListener("resize",()=>{if(started)resizeAndCenter("visual viewport resize");});window.addEventListener("orientationchange",()=>{if(started)setTimeout(()=>resizeAndCenter("orientation change"),120);});requestAnimationFrame(frame);