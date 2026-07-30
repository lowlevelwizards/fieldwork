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
}
