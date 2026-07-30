import { findEntity } from "./world-entities.js?v=081-perception-presentation-20260730";
import { findPlace, pointInBounds } from "./places.js?v=081-perception-presentation-20260730";

export class ContinuousExcursionController {
  constructor(game) {
    this.game = game;
    this.state = "available";
    this.destinationId = "north_culvert";
    this.departureTime = null;
    this.arrivalTime = null;
    this.returnTime = null;
    this.routeChanged = false;
    this.culvertInspected = false;
    this.obstructionState = "unknown";
    this.recoveryItemReturned = false;
    this.itemsReturnedWet = [];
    this.decisions = [];
    this.reportRequest = null;
    this.trailEntered = false;
  }

  get available() {
    return this.game.incident.state === "resolved" && this.state === "available";
  }

  startNaturally() {
    if (!this.available) return false;
    this.state = "outbound";
    this.departureTime = this.game.clockMinutes;
    this.trailEntered = true;
    this.game.pushMessage("You leave the pull-off and follow the north trail.", 3);
    this.game.emitEvent("excursionStartedNaturally");
    return true;
  }

  // Kept for compatibility with any remaining callers. It never moves the player.
  start() {
    return this.startNaturally();
  }

  inspectCulvert() {
    if (!["outbound", "at_destination"].includes(this.state)) {
      if (this.game.incident.state !== "resolved") {
        this.game.pushMessage("Finish stabilizing the pull-off first.");
        return false;
      }
      this.startNaturally();
    }
    this.culvertInspected = true;
    this.state = "at_destination";
    this.arrivalTime ??= this.game.clockMinutes;
    const place = findPlace(this.game.places, this.destinationId);
    if (place) {
      place.discovered = true;
      place.visited = true;
      place.state = "changed";
    }
    this.game.worldTextRequest = {
      entity: {
        name: "North Culvert",
        text: "Water is backing up behind the branch fall. Northline is inspecting the grate. The obstruction can be pulled clear while holding rope; otherwise it can be marked for follow-up."
      },
      mode: "examine"
    };
    this.game.emitEvent("culvertInspected");
    return true;
  }

  clearObstruction() {
    const rope = this.game.getHeldItem();
    if (!this.culvertInspected && rope?.definitionId === "rope_bundle") {
      this.inspectCulvert();
      this.game.worldTextRequest = null;
    }
    if (!this.culvertInspected) {
      this.game.pushMessage("Inspect the culvert first");
      return false;
    }
    if (rope?.definitionId !== "rope_bundle") {
      this.game.pushMessage("Hold the rope bundle to rig the debris");
      return false;
    }
    if (this.obstructionState === "cleared") return false;
    this.obstructionState = "cleared";
    this.decisions.push("Cleared obstruction with rope");
    const debris = findEntity(this.game.entities, "culvert_debris_01");
    if (debris) {
      debris.collision = false;
      debris.cleared = true;
      debris.name = "Cleared Branch Fall";
    }
    const water = findEntity(this.game.entities, "culvert_water_01");
    if (water) {
      water.depth = "draining";
      water.width = Math.max(100, water.width - 80);
      water.height = Math.max(70, water.height - 45);
    }
    this.state = "returning";
    this.routeChanged = true;
    this.game.pushMessage("Debris pulled clear. Follow the same trail back.", 3);
    this.game.emitEvent("debrisCleared", debris);
    return true;
  }

  markHazard() {
    if (!this.culvertInspected || this.obstructionState !== "unknown") return false;
    this.obstructionState = "marked";
    this.decisions.push("Marked obstruction for a full crew");
    const marker = findEntity(this.game.entities, "hazard_marker_01");
    if (marker) marker.revealed = true;
    this.state = "returning";
    this.routeChanged = true;
    this.game.pushMessage("Hazard marked. Follow the trail back to the pull-off.", 3);
    return true;
  }


  depositServiceCase() {
    const held = this.game.getHeldItem();
    if (held?.definitionId !== "service_case") {
      this.game.pushMessage("Hold the sealed case to deposit it");
      return false;
    }
    held.locationType = "stored";
    held.locationOwnerId = "recovery_area_01";
    held.state = "stored";
    held.revealed = true;
    held.x = 405;
    held.y = 1024;
    held.groundY = held.y + held.height;
    this.game.operator.carriedItemInstanceId = null;
    this.recoveryItemReturned = true;
    this.decisions.push("Returned sealed service case");
    this.game.pushMessage("Sealed service case deposited", 2.8);
    this.game.emitEvent("serviceCaseDeposited", held);
    return true;
  }

  completeReturn() {
    if (!["returning", "at_destination"].includes(this.state)) return false;
    const op = this.game.operator;
    const ext = this.game.map.extraction;
    if (Math.hypot(op.x - ext.x, op.y - ext.y) > ext.radius + 110) return false;
    const held = this.game.getHeldItem();
    if (held?.definitionId === "service_case") {
      held.locationType = "stored";
      held.locationOwnerId = "recovery_area_01";
      held.x = 390;
      held.y = 1030;
      held.groundY = 1070;
      op.carriedItemInstanceId = null;
      this.recoveryItemReturned = true;
      this.game.pushMessage("Recovered service case deposited", 2.6);
    }
    this.itemsReturnedWet = this.game.inventory.getItems()
      .filter(item => item.condition === "wet")
      .map(item => item.name);
    this.returnTime = this.game.clockMinutes;
    this.state = "completed";
    this.reportRequest = this.buildReport();
    this.game.pushMessage("Safe return recorded", 3);
    this.game.emitEvent("returnZoneEntered");
    return true;
  }

  buildReport() {
    const elapsed = Math.max(
      0,
      Math.round((this.returnTime ?? this.game.clockMinutes) - (this.departureTime ?? this.game.clockMinutes))
    );
    return {
      title: "North Culvert Living Operations",
      lines: [
        "Ada stabilized and recovering",
        "Communications restored",
        `Obstruction: ${this.obstructionState === "cleared" ? "Cleared" : this.obstructionState === "marked" ? "Marked" : "Left in place"}`,
        `Service case: ${this.recoveryItemReturned ? "Recovered" : "Not returned"}`,
        `Wet supplies: ${this.itemsReturnedWet.length}`,
        ...(this.game.operations?.reportLines?.() ?? []),
        `Elapsed field time: ${Math.floor(elapsed / 60)}h ${elapsed % 60}m`
      ]
    };
  }

  update() {
    // The field ecosystem begins as soon as the initial incident is resolved,
    // independent of whether the player has reached the trail yet.
    if (this.game.incident.state === "resolved" && !this.game.operations?.started) {
      this.game.operations?.start();
    }

    if (this.available) {
      const trailhead = this.game.map.site.trailhead;
      const distance = Math.hypot(
        this.game.operator.x - trailhead.x,
        this.game.operator.y - trailhead.y
      );
      if (distance < 360 || this.game.operator.x > 2250) this.startNaturally();
    }

    if (this.state === "outbound") {
      const destination = findPlace(this.game.places, this.destinationId);
      if (destination && pointInBounds(this.game.operator.x, this.game.operator.y, destination.bounds)) {
        destination.discovered = true;
        destination.visited = true;
      }
    }

    if (this.culvertInspected && this.state === "at_destination" && this.game.operations?.rainStarted) {
      this.routeChanged = true;
    }

    this.completeReturn();
  }
}
