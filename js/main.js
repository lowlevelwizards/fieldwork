import { Camera } from "./camera.js";
import { GameState } from "./game.js";
import { InputController } from "./input.js";
import { Renderer } from "./renderer.js";
import { getItemDefinition } from "../data/items.js";
import { findEntity } from "./world-entities.js";
import { validateItemLocations } from "./item-locations.js";
import { renderItemThumbnail } from "./presentation/item-renderer.js";

const $ = (selector) => document.querySelector(selector);
const titleScreen = $("#title-screen"), gameScreen = $("#game-screen"), beginButton = $("#begin-button"), canvas = $("#game-canvas");
const actionPanel = $("#action-panel"), actionName = $("#action-name"), actionButton = $("#action-button"), actionProgress = $("#action-progress-fill");
const inventoryOverlay = $("#inventory-overlay"), inspectOverlay = $("#inspect-overlay"), inventoryList = $("#inventory-list");
const camera = new Camera(), game = new GameState(), renderer = new Renderer(canvas, camera);
const input = new InputController({ joystickZone: $("#joystick-zone"), joystickBase: $("#joystick-base"), joystickKnob: $("#joystick-knob") });
let started = false, inventoryOpen = false, worldTextOpen = false, lastTime = performance.now(), fpsAccumulator = 0, fpsFrames = 0, fpsValue = 0, objectiveTimer = null;

function resize() { renderer.resize(); camera.snapTo(game.operator); }
function startGame() { titleScreen.classList.remove("screen--active"); gameScreen.classList.add("screen--active"); started = true; resize(); lastTime = performance.now(); objectiveTimer = setTimeout(() => $("#objective-card").classList.add("objective-card--collapsed"), 5200); }
function triggerContextAction() { if (inventoryOpen || worldTextOpen) return; if (game.operator.carriedItemInstanceId) game.interaction.dropCarriedItem(); else game.interaction.trigger(); }

function updateInteractionUI() {
  const target = game.interaction.getTarget(), searching = Boolean(game.interaction.searchingEntityId), carryingId = game.operator.carriedItemInstanceId, action = game.interaction.activeAction;
  if (carryingId) {
    const item = findEntity(game.entities, carryingId); actionPanel.hidden = false; actionName.textContent = item?.name ?? "Carried Item"; actionButton.textContent = "Drop"; actionButton.disabled = false;
  } else if (target && action) {
    actionPanel.hidden = false; actionName.textContent = target.name; actionButton.textContent = action.label; actionButton.disabled = Boolean(action.disabled);
  } else actionPanel.hidden = true;
  actionPanel.classList.toggle("action-panel--searching", searching);
  if (searching) { const entity = findEntity(game.entities, game.interaction.searchingEntityId); actionProgress.style.width = `${Math.round((entity?.searchProgress || 0) * 100)}%`; }
  else actionProgress.style.width = "0%";

  const stack = $("#message-stack"); stack.replaceChildren(...game.messages.map((message) => { const node = document.createElement("div"); node.className = "message-toast"; node.textContent = message.text; node.style.opacity = String(Math.min(1, message.time / 0.25)); return node; }));
  const used = game.inventory.getUsedPips(); $("#pack-usage-compact").textContent = `${used}/8`;
}

function buildInventory() {
  const used = game.inventory.getUsedPips(); $("#pack-usage").textContent = `${used} / ${game.backpack.capacityPips} pips`;
  const pips = $("#capacity-pips"); pips.replaceChildren();
  for (let i = 0; i < game.backpack.capacityPips; i += 1) { const pip = document.createElement("span"); pip.className = i < used ? "capacity-pip capacity-pip--used" : "capacity-pip"; pips.append(pip); }
  inventoryList.replaceChildren();
  const items = game.inventory.getItems();
  if (!items.length) { const empty = document.createElement("p"); empty.className = "inventory-empty"; empty.textContent = "The pack is empty."; inventoryList.append(empty); return; }
  for (const item of items) {
    const def = getItemDefinition(item.definitionId), row = document.createElement("article"); row.className = "inventory-row";
    const summary = document.createElement("div"); summary.className = "item-summary";
    const icon = document.createElement("canvas"); icon.className = "item-icon"; icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = def.name;
    const meta = document.createElement("span"); meta.textContent = `${def.category} · ${def.sizePips} ${def.sizePips === 1 ? "pip" : "pips"}`;
    copy.append(name, meta); summary.append(icon, copy); row.append(summary); renderItemThumbnail(icon, item.definitionId);
    const actions = document.createElement("div"); actions.className = "item-actions";
    for (const [label, handler] of [["Inspect", () => inspectItem(item)], ["Hold", () => { if (game.inventory.hold(item.id)) closeInventory(); }], ["Drop", () => { game.inventory.drop(item.id); buildInventory(); }]]) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener("click", handler); actions.append(button);
    }
    row.append(actions); inventoryList.append(row);
  }
}

function openInventory() { if (!started || game.interaction.searchingEntityId) return; inventoryOpen = true; game.operator.lockedByInteraction = true; inventoryOverlay.hidden = false; buildInventory(); }
function closeInventory() { inventoryOpen = false; inventoryOverlay.hidden = true; game.operator.lockedByInteraction = false; }
function inspectItem(item) {
  const def = getItemDefinition(item.definitionId); $("#inspect-category").textContent = def.category; $("#inspect-name").textContent = def.name;
  $("#inspect-size").textContent = `Size: ${def.sizePips} ${def.sizePips === 1 ? "pip" : "pips"}`; $("#inspect-description").textContent = def.description;
  $("#inspect-location").textContent = item.locationType === "backpack" ? "Currently in Mara's field pack." : item.locationType === "hands" ? "Currently in Mara's hands." : "Currently in the world.";
  inspectOverlay.hidden = false;
}

function openWorldText(request) {
  if (!request) return;
  worldTextOpen = true;
  game.operator.lockedByInteraction = true;
  const { entity, mode } = request;
  $("#inspect-category").textContent = mode === "read" ? "FIELD DOCUMENT" : "OBSERVATION";
  $("#inspect-name").textContent = entity.name;
  $("#inspect-size").textContent = mode === "read" ? "Read in place" : "Fixed world object";
  $("#inspect-description").textContent = entity.text;
  $("#inspect-location").textContent = "At the Old Maintenance Pull-Off.";
  inspectOverlay.hidden = false;
  game.worldTextRequest = null;
}

function closeInspect() {
  inspectOverlay.hidden = true;
  worldTextOpen = false;
  if (!inventoryOpen) game.operator.lockedByInteraction = false;
}

function updateDebug(delta) {
  fpsAccumulator += delta; fpsFrames += 1; if (fpsAccumulator >= 0.5) { fpsValue = Math.round(fpsFrames / fpsAccumulator); fpsAccumulator = 0; fpsFrames = 0; }
  $("#debug-fps").textContent = fpsValue; $("#debug-position").textContent = `${Math.round(game.operator.x)}, ${Math.round(game.operator.y)}`; $("#debug-facing").textContent = game.operator.facing;
  $("#debug-target").textContent = game.interaction.getTarget()?.id ?? "—"; $("#debug-carry").textContent = game.operator.carriedItemInstanceId ?? "—"; $("#debug-pack").textContent = `${game.inventory.getUsedPips()} / 8`;
  $("#debug-world-items").textContent = game.entities.filter((e) => e.type === "item" && e.locationType === "world").length;
  $("#debug-door").textContent = findEntity(game.entities, "shed_door_01")?.state ?? "—"; $("#debug-crate").textContent = game.entities.filter((e) => e.type === "container" && e.searched).length + "/" + game.entities.filter((e) => e.type === "container").length;
  $("#debug-layout").textContent = game.siteLayoutId; $("#debug-hidden").textContent = game.entities.filter((e) => e.type === "item" && !e.revealed && e.locationType !== "backpack" && e.locationType !== "hands").length;
  const errors = validateItemLocations(game); $("#debug-audit").textContent = errors.length ? `${errors.length} issue(s)` : "OK";
}

function frame(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.033); lastTime = now;
  if (started) { game.update(delta, inventoryOpen ? { x: 0, y: 0 } : input.getMoveVector()); camera.update(game.operator, delta); renderer.render(game); updateInteractionUI(); if (game.worldTextRequest && !worldTextOpen) openWorldText(game.worldTextRequest);
    if (game.objectiveSecured) { $("#objective-card strong").textContent = "Radio battery secured"; $("#objective-card span:last-child").textContent = "Choose what else deserves space before returning."; } if (!$("#debug-panel").hidden) updateDebug(delta); }
  requestAnimationFrame(frame);
}

beginButton.addEventListener("click", startGame); actionButton.addEventListener("click", triggerContextAction); $("#backpack-button").addEventListener("click", () => inventoryOpen ? closeInventory() : openInventory());
$("#inventory-close").addEventListener("click", closeInventory); inventoryOverlay.addEventListener("click", (event) => { if (event.target === inventoryOverlay) closeInventory(); });
$("#inspect-close").addEventListener("click", closeInspect); inspectOverlay.addEventListener("click", (event) => { if (event.target === inspectOverlay) closeInspect(); });
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "e" && started) { event.preventDefault(); triggerContextAction(); }
  if (key === "b" && started) { event.preventDefault(); inventoryOpen ? closeInventory() : openInventory(); }
  if (key === "escape") { if (!inspectOverlay.hidden) closeInspect(); else if (inventoryOpen) closeInventory(); }
});
$("#reset-position-button").addEventListener("click", () => { game.resetPosition(); camera.snapTo(game.operator); });
$("#debug-button").addEventListener("click", () => { const active = $("#debug-button").getAttribute("aria-pressed") === "true"; $("#debug-button").setAttribute("aria-pressed", String(!active)); $("#debug-panel").hidden = active; $("#reset-position-button").hidden = active; });
$("#objective-card").addEventListener("click", () => { $("#objective-card").classList.toggle("objective-card--collapsed"); if (objectiveTimer) clearTimeout(objectiveTimer); });
window.addEventListener("resize", () => { if (started) resize(); }); window.addEventListener("orientationchange", () => setTimeout(() => { if (started) resize(); }, 150));
requestAnimationFrame(frame);
