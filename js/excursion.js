import { findEntity } from "./world-entities.js";
import { findPlace, pointInBounds } from "./places.js";

export class ExcursionController {
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
    this.rainDelay = 0;
  }

  get available() { return this.game.incident.state === "resolved" && this.state === "available"; }

  start() {
    if (!this.available) return false;
    this.state = "outbound";
    this.departureTime = this.game.clockMinutes;
    this.game.pushMessage("North Culvert field task started", 3);
    this.game.emitEvent("excursionStarted");
    return true;
  }

  inspectCulvert() {
    if (!["outbound", "at_destination"].includes(this.state)) return false;
    this.culvertInspected = true;
    this.state = "at_destination";
    this.arrivalTime ??= this.game.clockMinutes;
    const place = findPlace(this.game.places, this.destinationId);
    if (place) { place.discovered = true; place.visited = true; place.state = "changed"; }
    this.game.worldTextRequest = { entity: { name: "North Culvert", text: "Water is backing up behind the branch fall. The lower crossing is passable, but the current is rising. The obstruction could be pulled clear with rope." }, mode: "examine" };
    this.game.emitEvent("culvertInspected");
    this.rainDelay = 2.5;
    return true;
  }

  clearObstruction() {
    const rope = this.game.getHeldItem();
    if (!this.culvertInspected || rope?.definitionId !== "rope_bundle" || this.obstructionState === "cleared") return false;
    this.obstructionState = "cleared";
    this.decisions.push("Cleared obstruction with rope");
    const debris = findEntity(this.game.entities, "culvert_debris_01");
    if (debris) { debris.collision = false; debris.cleared = true; debris.name = "Cleared Branch Fall"; }
    const water = findEntity(this.game.entities, "culvert_water_01");
    if (water) water.depth = "shallow";
    this.game.pushMessage("Debris pulled clear", 3);
    this.game.emitEvent("debrisCleared", debris);
    return true;
  }

  markHazard() {
    if (!this.culvertInspected || this.obstructionState !== "unknown") return false;
    this.obstructionState = "marked";
    this.decisions.push("Marked obstruction for a full crew");
    const marker = findEntity(this.game.entities, "hazard_marker_01");
    if (marker) marker.revealed = true;
    this.game.pushMessage("Hazard marked for follow-up", 3);
    return true;
  }

  triggerReturn() {
    if (!this.culvertInspected || this.state === "returning" || this.state === "completed") return;
    this.state = "returning";
    this.routeChanged = true;
    this.game.weather = "Rain";
    const branch = findEntity(this.game.entities, "return_branch_01");
    if (branch) { branch.revealed = true; branch.collision = true; }
    const water = findEntity(this.game.entities, "culvert_water_01");
    if (water && this.obstructionState !== "cleared") water.depth = "rising";
    this.game.pushMessage("Rain moves in over the trail", 3);
    this.game.emitEvent("rainStarted");
  }

  completeReturn() {
    if (this.state !== "returning") return false;
    const op = this.game.operator;
    const ext = this.game.map.extraction;
    if (Math.hypot(op.x - ext.x, op.y - ext.y) > ext.radius + 30) return false;
    const held = this.game.getHeldItem();
    if (held?.definitionId === "service_case") {
      held.locationType = "stored"; held.locationOwnerId = "recovery_area_01"; held.x = 390; held.y = 1030; held.groundY = 1070;
      op.carriedItemInstanceId = null;
      this.recoveryItemReturned = true;
    }
    this.itemsReturnedWet = this.game.inventory.getItems().filter((item) => item.condition === "wet").map((item) => item.name);
    this.returnTime = this.game.clockMinutes;
    this.state = "completed";
    this.reportRequest = this.buildReport();
    this.game.pushMessage("Safe return recorded", 3);
    this.game.emitEvent("returnZoneEntered");
    return true;
  }

  buildReport() {
    const elapsed = Math.max(0, Math.round((this.returnTime ?? this.game.clockMinutes) - (this.departureTime ?? this.game.clockMinutes)));
    return {
      title: "North Culvert",
      lines: [
        "Ada stabilized",
        "Communications restored",
        `Obstruction: ${this.obstructionState === "cleared" ? "Cleared" : this.obstructionState === "marked" ? "Marked" : "Left in place"}`,
        `Service cable: ${this.recoveryItemReturned ? "Recovered" : "Not returned"}`,
        `Wet supplies: ${this.itemsReturnedWet.length}`,
        `Elapsed field time: ${Math.floor(elapsed / 60)}h ${elapsed % 60}m`
      ]
    };
  }

  update(delta) {
    if (this.state === "outbound") {
      const destination = findPlace(this.game.places, this.destinationId);
      if (destination && pointInBounds(this.game.operator.x, this.game.operator.y, destination.bounds)) {
        destination.discovered = true; destination.visited = true;
      }
    }
    if (this.rainDelay > 0) {
      this.rainDelay -= delta;
      if (this.rainDelay <= 0) this.triggerReturn();
    }
    this.completeReturn();
  }
}
