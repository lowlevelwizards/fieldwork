import { GameState } from "./game.js?v=077-presentation-isolation-20260730";
import { ContinuousExcursionController } from "./continuous-excursion.js?v=077-presentation-isolation-20260730";

export class ContinuousGameState extends GameState {
  constructor() {
    super();
    this.excursion = new ContinuousExcursionController(this);
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
        const detail = actor.currentTask ? `${actor.currentTask}.` : "Working the route.";
        this.dialogueRequest = {
          actor,
          text: `${detail} ${faction} teams are adjusting to what the other crews leave behind.`
        };
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
