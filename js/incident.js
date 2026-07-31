import { findEntity } from "./world-entities.js?v=10c3-bespoke-casualty-poses-rescue-20260731";

const ADA_SEAT = { x: 1265, y: 1238 };

export class IncidentController {
  constructor(game) {
    this.game = game;
    this.id = "truck_accident_01";
    this.state = "active";
    this.elapsed = 0;
    this.radioRestored = false;
    this.workerSheltered = false;
    this.bandageUsed = false;
    this.waterUsed = false;
  }

  get worker() {
    return this.game.actors.find(actor => actor.id === "worker_ada");
  }

  update(delta) {
    if (this.state === "resolved") return;
    this.elapsed += delta;
    const worker = this.worker;
    if (!worker) return;

    if(worker.medical?.dead||worker.medical?.unconscious)return;

    // The shared medical AI or player treatment may control Ada's seeded wound
    // without passing through the old incident action. Keep both systems in sync.
    const seededWound=worker.medical?.wounds?.find(wound=>wound.seededLabel==="ada_initial_leg_wound");
    if(seededWound?.controlled&&!this.bandageUsed){
      this.bandageUsed=true;
      worker.condition="injured";
      worker.severity="stable";
      worker.currentTask="Bleeding controlled; help her to the break table";
      this.state="stabilized";
    }

    // Shelter progression is authored: only completing the assist-to-bench
    // action unlocks water. Proximity alone must never skip that step.
    if (!this.bandageUsed && this.elapsed > 150 && worker.condition === "bleeding") {
      worker.severity = "weak";
      worker.currentTask = "Growing weaker";
    }

    if (this.game.assistedActorId === worker.id) {
      const offset = this.game.operator.facing === "left" ? 30 : this.game.operator.facing === "right" ? -30 : 30;
      worker.x = this.game.operator.x + offset;
      worker.y = this.game.operator.y + 6;
      worker.facing = this.game.operator.facing;
      worker.groundY = worker.y + worker.radius;
      worker.currentTask = "Walking with assistance";
      worker.seated = false;
      worker.vx = this.game.operator.vx * .75;
      worker.vy = this.game.operator.vy * .75;

      const inFrontApproach =
        worker.x >= 1040 && worker.x <= 1510 &&
        worker.y >= 1170 && worker.y <= 1395;
      const nearSeat = Math.hypot(worker.x - ADA_SEAT.x, worker.y - ADA_SEAT.y) < 225;
      if (inFrontApproach || nearSeat) {
        this.game.assistedActorId = null;
        worker.x = ADA_SEAT.x;
        worker.y = ADA_SEAT.y;
        worker.groundY = worker.y + worker.radius;
        worker.seated = true;
        worker.condition = "recovering";
        worker.mobility = "resting";
        worker.currentTask = "Safe at the break table; needs water";
        this.workerSheltered = true;
        this.game.pushMessage("Ada is safe. Give her water to stabilize her.", 3.5);
      }
    }

    if (this.bandageUsed && this.waterUsed && !this.workerSheltered && this.game.assistedActorId !== worker.id) {
      worker.condition = "recovering";
      worker.severity = "stable";
      worker.mobility = "limited";
      worker.currentTask = "Recovering; ready to move with help";
      worker.seated = true;
    }

    if (this.bandageUsed && this.workerSheltered && this.waterUsed && this.radioRestored) {
      this.state = "resolved";
      this.game.pushMessage("Help is on the way", 3.5);
    } else if (this.bandageUsed && this.waterUsed) {
      this.state = "recovering";
    } else if (this.bandageUsed) {
      this.state = "stabilized";
    }
  }

  consumeSupply(definitionId) {
    const held=this.game.getHeldItem?.();
    if(held?.definitionId===definitionId){
      this.game.operator.carriedItemInstanceId=null;
      held.locationType="consumed";
      held.locationOwnerId=null;
      held.revealed=false;
      held.state="consumed";
      return true;
    }

    const item=this.game.inventory.getItems().find(candidate=>candidate.definitionId===definitionId&&candidate.condition!=="wet");
    if(!item)return false;
    const index=this.game.backpack.itemInstanceIds.indexOf(item.id);
    if(index>=0)this.game.backpack.itemInstanceIds.splice(index,1);
    item.locationType="consumed";
    item.locationOwnerId=null;
    item.revealed=false;
    item.state="consumed";
    return true;
  }

  onMedicalTreatment(type,result) {
    const worker=this.worker;
    if(!worker||!result?.ok)return;
    if(type==="bandage"||type==="pressure_dressing"){
      this.bandageUsed=true;
      worker.condition="injured";
      worker.severity="stable";
      worker.needs=worker.needs.filter(need=>need!=="bandage");
      worker.currentTask="Bleeding controlled; help her to the break table";
      this.state="stabilized";
      this.game.pushMessage("Ada is bandaged. Help her to the break table.",3.5);
    }
  }

  getNextStep() {
    if(!this.bandageUsed)return "Bandage Ada";
    if(!this.workerSheltered)return "Help Ada to the break table";
    if(!this.waterUsed)return "Give Ada water";
    if(!this.radioRestored)return "Restore the field radio";
    return "Ada is stable; help is on the way";
  }

  applyBandage() {
    const worker = this.worker;
    if (!worker || !this.consumeSupply("bandage")) return false;
    this.bandageUsed = true;
    this.game.wounds?.applyTreatment?.(worker,"bandage",{source:this.game.operator});
    worker.condition = "injured";
    worker.severity = "stable";
    worker.needs = worker.needs.filter(need => need !== "bandage");
    worker.currentTask = "Bleeding controlled; help her to the break table";
    this.game.pushMessage("Ada is bandaged. Help her to the break table.", 3.5);
    return true;
  }

  giveWater() {
    const worker = this.worker;
    if (!worker || !this.consumeSupply("water_bottle")) return false;
    this.waterUsed = true;
    worker.needs = worker.needs.filter(need => need !== "water");
    if (this.bandageUsed && this.workerSheltered) {
      worker.condition = "recovering";
      worker.severity = "stable";
      worker.mobility = "resting";
      worker.currentTask = "Stable and recovering at the break table";
      this.state = "recovering";
      this.game.pushMessage("Ada is stable and resting.", 3.4);
    } else if(this.bandageUsed) {
      worker.currentTask = "Bandaged, but should be moved somewhere safe first";
      this.game.pushMessage("Move Ada to the break table before giving water.", 3);
      this.waterUsed=false;
      return false;
    } else {
      worker.currentTask = "Still bleeding; needs a clean bandage";
      this.game.pushMessage("Ada drinks slowly, but still needs a bandage", 3);
    }
    return true;
  }

  installBattery() {
    if (!this.consumeSupply("radio_battery")) return false;
    this.radioRestored = true;
    const cradle = findEntity(this.game.entities, "radio_cradle_01");
    if (cradle) {
      cradle.radioPowered = true;
      cradle.name = "Working Field Radio";
      cradle.text = "The repeater hums with a steady green status light. A dispatcher confirms that help is on the way.";
    }
    this.game.pushMessage("Communications restored", 3);
    this.game.emitEvent("radioOn", cradle);
    return true;
  }

  beginAssist() {
    const worker = this.worker;
    if (!worker || !this.bandageUsed || this.workerSheltered) return false;
    this.game.assistedActorId = worker.id;
    worker.seated = false;
    worker.mobility = "assisted";
    this.game.pushMessage("Guide Ada to the front side of the break table", 3);
    return true;
  }
}
