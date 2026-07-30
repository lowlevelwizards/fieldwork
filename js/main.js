import { Camera } from "./camera.js";
import { GameState } from "./game.js";
import { InputController } from "./input.js";
import { Renderer } from "./renderer.js";

const titleScreen = document.querySelector("#title-screen");
const gameScreen = document.querySelector("#game-screen");
const beginButton = document.querySelector("#begin-button");
const resetPositionButton = document.querySelector("#reset-position-button");
const debugButton = document.querySelector("#debug-button");
const debugPanel = document.querySelector("#debug-panel");
const objectiveCard = document.querySelector("#objective-card");
const actionPanel = document.querySelector("#action-panel");
const actionName = document.querySelector("#action-name");
const actionButton = document.querySelector("#action-button");
const actionProgress = document.querySelector("#action-progress-fill");
const messageToast = document.querySelector("#message-toast");
const canvas = document.querySelector("#game-canvas");

const camera = new Camera();
const game = new GameState();
const renderer = new Renderer(canvas, camera);
const input = new InputController({
  joystickZone: document.querySelector("#joystick-zone"),
  joystickBase: document.querySelector("#joystick-base"),
  joystickKnob: document.querySelector("#joystick-knob")
});

let started = false;
let lastTime = performance.now();
let fpsAccumulator = 0;
let fpsFrames = 0;
let fpsValue = 0;
let objectiveTimer = null;

function resize() {
  renderer.resize();
  camera.snapTo(game.operator);
}

function startGame() {
  titleScreen.classList.remove("screen--active");
  gameScreen.classList.add("screen--active");
  started = true;
  resize();
  lastTime = performance.now();
  objectiveTimer = window.setTimeout(() => objectiveCard.classList.add("objective-card--collapsed"), 5200);
}

function triggerContextAction() {
  if (game.operator.carriedItemInstanceId) game.interaction.dropCarriedItem();
  else game.interaction.trigger();
}

function updateInteractionUI() {
  const target = game.interaction.getTarget();
  const searching = Boolean(game.interaction.searchingEntityId);
  const carrying = Boolean(game.operator.carriedItemInstanceId);
  const action = game.interaction.activeAction;

  if (carrying) {
    actionPanel.hidden = false;
    actionName.textContent = "Radio Battery";
    actionButton.textContent = "Drop";
    actionButton.disabled = false;
  } else if (target && action) {
    actionPanel.hidden = false;
    actionName.textContent = target.name;
    actionButton.textContent = action.label;
    actionButton.disabled = Boolean(action.disabled);
  } else {
    actionPanel.hidden = true;
  }

  actionPanel.classList.toggle("action-panel--searching", searching);
  if (searching) {
    const entity = game.entities.find((item) => item.id === game.interaction.searchingEntityId);
    actionProgress.style.width = `${Math.round((entity?.searchProgress || 0) * 100)}%`;
  } else {
    actionProgress.style.width = "0%";
  }

  if (game.message) {
    messageToast.textContent = game.message;
    messageToast.hidden = false;
  } else {
    messageToast.hidden = true;
  }
}

function updateDebug(delta) {
  fpsAccumulator += delta;
  fpsFrames += 1;
  if (fpsAccumulator >= 0.5) {
    fpsValue = Math.round(fpsFrames / fpsAccumulator);
    fpsAccumulator = 0;
    fpsFrames = 0;
  }
  document.querySelector("#debug-fps").textContent = fpsValue;
  document.querySelector("#debug-position").textContent = `${Math.round(game.operator.x)}, ${Math.round(game.operator.y)}`;
  document.querySelector("#debug-speed").textContent = Math.round(Math.hypot(game.operator.vx, game.operator.vy));
  document.querySelector("#debug-facing").textContent = game.operator.facing;
  document.querySelector("#debug-target").textContent = game.interaction.getTarget()?.id ?? "—";
  document.querySelector("#debug-carry").textContent = game.operator.carriedItemInstanceId ?? "—";
  document.querySelector("#debug-orientation").textContent = matchMedia("(orientation: portrait)").matches ? "Portrait" : "Landscape";
}

function frame(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (started) {
    game.update(delta, input.getMoveVector());
    camera.update(game.operator, delta);
    renderer.render(game);
    updateInteractionUI();
    if (!debugPanel.hidden) updateDebug(delta);
  }
  requestAnimationFrame(frame);
}

beginButton.addEventListener("click", startGame);
actionButton.addEventListener("click", triggerContextAction);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "e" && started) {
    event.preventDefault();
    triggerContextAction();
  }
});

resetPositionButton.addEventListener("click", () => {
  game.resetPosition();
  camera.snapTo(game.operator);
});

debugButton.addEventListener("click", () => {
  const active = debugButton.getAttribute("aria-pressed") === "true";
  debugButton.setAttribute("aria-pressed", String(!active));
  debugPanel.hidden = active;
  resetPositionButton.hidden = active;
});

objectiveCard.addEventListener("click", () => {
  objectiveCard.classList.toggle("objective-card--collapsed");
  if (objectiveTimer) window.clearTimeout(objectiveTimer);
});

window.addEventListener("resize", () => {
  if (started) resize();
});

window.addEventListener("orientationchange", () => {
  window.setTimeout(() => {
    if (started) resize();
  }, 150);
});

requestAnimationFrame(frame);
