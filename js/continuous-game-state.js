import { GameState } from "./game.js?v=077-presentation-isolation-20260730";
import { ContinuousExcursionController } from "./continuous-excursion.js?v=077-presentation-isolation-20260730";

export class ContinuousGameState extends GameState {
  constructor() {
    super();
    this.excursion = new ContinuousExcursionController(this);
    this.encounters = new FactionEncounterSystem(this);
    const phases = [
      { name: "New Moon", illumination: 0.0 },
      { name: "Crescent Moon", illumination: 0.25 },
      { name: "Quarter Moon", illumination: 0.5 },
      { name: "Gibbous Moon", illumination: 0.75 },
      { name: "Full Moon", illumination: 1.0 }
    ];
    this.moonPhase = phases[this.siteLayoutIndex % phases.length];
    this.moonPhaseName = this.moonPhase.name;
  }

  getHour() {
    return (this.clockMinutes / 60) % 24;
  }

  isNight() {
    const hour = this.getHour();
    return hour < 6 || hour >= 20;
  }

  getLightLevel() {
    const hour = this.getHour();
    let daylight;
    if (hour < 5) daylight = 0.08;
    else if (hour < 7) daylight = 0.08 + ((hour - 5) / 2) * 0.67;
    else if (hour < 18) daylight = 1;
    else if (hour < 20) daylight = 1 - ((hour - 18) / 2) * 0.88;
    else daylight = 0.08;
    if (this.isNight()) daylight += this.moonPhase.illumination * 0.20;
    const weather = this.weather === "Heavy Rain" ? 0.72 : this.weather === "Rain" ? 0.82 : this.weather === "Cloudy" ? 0.91 : this.weather === "Fog" ? 0.86 : 1;
    return Math.max(0.06, Math.min(1, daylight * weather));
  }

  getWeatherSpeedMultiplier() {
    if (this.weather === "Heavy Rain") return 0.84;
    if (this.weather === "Rain") return 0.92;
    if (this.weather === "Cloudy" || this.weather === "Fog") return 0.98;
    return 1;
  }

  getEnvironmentSpeedMultiplier() {
    const light = this.getLightLevel();
    const darkness = light >= 0.72 ? 1 : light >= 0.42 ? 0.94 : light >= 0.22 ? 0.88 : 0.82;
    return Math.max(0.70, this.getWeatherSpeedMultiplier() * darkness);
  }

  update(delta, move) {
    const originalSpeed = this.operator.moveSpeed;
    this.operator.moveSpeed = originalSpeed * this.getEnvironmentSpeedMultiplier();
    try {
      super.update(delta, move);
      this.encounters.update(delta);
    } finally {
      this.operator.moveSpeed = originalSpeed;
    }
  }

  // Automatic relocation is intentionally disabled for the continuous map.
  // Manual Debug reset remains available through GameState.resetPosition().
  ensureOperatorSafe() {
    return false;
  }

  openDialogue(actor) {
    if (actor.id !== "worker_ada") {
      if (actor.operationId) {
        actor.relationship = "Met";
        const faction = actor.factionId === "northline" ? "Northline" : actor.factionId === "commune" ? "Commune" : "Freelancer";
        const encounter = this.encounters?.getActorEncounter(actor.id);
        const detail = actor.currentTask ? `${actor.currentTask}.` : "Working the route.";
        const tension = encounter
          ? ` We are ${encounter.state} because of ${encounter.reason}.`
          : ` ${faction} teams are watching how the other crews use the route.`;
        this.dialogueRequest = { actor, text: `${detail}${tension}` };
        return;
      }
      super.openDialogue(actor);
      return;
    }

    actor.relationship = "Met";
    let text;
    if (!actor.assessed) text = "Please—my leg. I slipped beside the truck.";
    else if (!this.incident.bandageUsed) text = "The bleeding needs a clean bandage.";
    else if (!this.incident.waterUsed) text = "The bleeding is controlled. Some water would help.";
    else if (!this.incident.workerSheltered) text = "Thank you. I am recovering, but I still need help getting to the break table.";
    else if (!this.incident.radioRestored) text = "I am all right here. Restore the radio so dispatch knows where we are.";
    else if (this.incident.state === "resolved") text = "Dispatch got through. I can rest now—thank you.";
    else text = "The radio is working. Help should be on the way.";

    this.dialogueRequest = { actor, text };
  }
}
