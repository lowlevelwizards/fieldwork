import { GameState } from "./game.js";
import { ContinuousExcursionController } from "./continuous-excursion.js";
import { FactionEncounterSystem } from "./faction-encounters.js";
import { PerceptionSystem } from "./perception.js";
import { CombatSystem } from "./combat.js";
import { AICombatSystem } from "./ai-combat.js";
import { WoundSystem } from "./wound-system.js";
import { MedicalSystem } from "./medical-system.js";
import { CombatSandboxDirector, sandboxMap, getSandboxFixture, SANDBOX_FIXTURE_IDS } from "./combat-sandbox.js";
import { TacticalFrontSystem } from "./tactical-front.js";
import { TeamResponseSystem } from "./team-response.js";
import { CoverStateSystem } from "./cover-state.js";
import { ActorIntentSystem } from "./actor-intent.js";
import { CoverNetworkSystem } from "./cover-network.js";
import { TeamCombatContextSystem } from "./team-combat-context.js";
import { FireTeamControllerSystem } from "./fire-team-controller.js";
import { FightAssessmentSystem } from "./fight-assessment.js";
import { CombatPostureSystem } from "./combat-posture.js";
import { AIV2Runtime, AI_RUNTIME_MODES } from "./ai-v2/runtime/ai-runtime.js";

export class ContinuousGameState extends GameState {
  constructor({scenario="operations",aiRuntime=AI_RUNTIME_MODES.LEGACY,sandboxFixture=SANDBOX_FIXTURE_IDS.OPEN_CONTACT}={}) {
    super();
    this.scenarioMode=scenario;
    this.aiRuntimeMode=aiRuntime===AI_RUNTIME_MODES.V2?AI_RUNTIME_MODES.V2:AI_RUNTIME_MODES.LEGACY;
    this.aiRuntimeLabel=this.aiRuntimeMode===AI_RUNTIME_MODES.V2?"AI V2 — Consolidated Causal Runtime":"Legacy 1.2H";
    if(scenario==="sandbox"){
      const fixture=getSandboxFixture(sandboxFixture);
      this.map=sandboxMap;
      this.sandboxFixtureId=fixture.id;
      this.sandboxFixture=fixture;
      const sandboxSupplies=this.entities
        .filter(entity=>entity.type==="item"&&entity.definitionId==="bandage")
        .slice(0,2)
        .map((entity,index)=>({
          ...entity,
          id:`behavior_lab_bandage_${index+1}`,
          x:4140+index*36,
          y:1705,
          groundY:1725,
          locationType:"world",
          locationOwnerId:null,
          visibility:"visible",
          revealed:true,
          state:"world"
        }));
      this.entities=sandboxSupplies;
      this.actors=[];
      this.wildlife=[];
      this.operator.x=fixture.operatorSpawn.x;this.operator.y=fixture.operatorSpawn.y;
      this.clockMinutes=13*60+20;this.weather="Clear";
      this.incident.state="resolved";this.incident.bandageUsed=true;this.incident.workerSheltered=true;this.incident.waterUsed=true;this.incident.radioRestored=true;
      this.operations=new CombatSandboxDirector(this,{fixtureId:fixture.id});
      this.objectiveText=`Behavior Lab ${fixture.index} · ${fixture.label}`;
    }
    this.excursion = new ContinuousExcursionController(this);
    if(scenario==="sandbox"){
      this.excursion.state="completed";
      this.excursion.trailEntered=true;
    }
    this.operator.lookAngle = 0;
    this.operator.targetLookAngle = 0;
    this.combat = new CombatSystem(this);
    this.wounds = new WoundSystem(this);
    const ada=this.scenarioMode==="operations"?this.actors.find(actor=>actor.id==="worker_ada"):null;
    if(ada){
      ada.factionId="commune";
      ada.role="Shelter Worker";
      this.wounds.seedWound(ada,{region:"legs",severity:"moderate",controlled:false,label:"ada_initial_leg_wound"});
      ada.currentTask="Injured beside the truck";
    }
    this.medical = new MedicalSystem(this);
    this.aiCombat = new AICombatSystem(this);
    this.perception = new PerceptionSystem(this);
    this.tacticalFronts = new TacticalFrontSystem(this);
    this.actorIntents = new ActorIntentSystem(this);
    this.coverNetwork = new CoverNetworkSystem(this);
    this.coverStates = new CoverStateSystem(this);
    this.fightAssessments = new FightAssessmentSystem(this);
    this.teamCombatContexts = new TeamCombatContextSystem(this);
    this.fireTeams = new FireTeamControllerSystem(this);
    this.combatPostures = new CombatPostureSystem(this);
    this.teamResponses = new TeamResponseSystem(this);
    this.encounters = new FactionEncounterSystem(this);
    this.aiV2 = this.aiRuntimeMode===AI_RUNTIME_MODES.V2?new AIV2Runtime(this):null;
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
    const originalSpeed=this.operator.moveSpeed;
    const previousVx=this.operator.vx??0;
    const previousVy=this.operator.vy??0;
    const inputLength=Math.min(1,Math.hypot(move?.x??0,move?.y??0));
    const walkThreshold=.56;
    const pace=inputLength<=walkThreshold
      ? (inputLength/walkThreshold)*.52
      : .52+((inputLength-walkThreshold)/(1-walkThreshold))*.48;

    if(inputLength>0.08&&!this.combat.lookInputActive&&!this.combat.aiming){
      const movementAngle=Math.atan2(move.y,move.x);
      if(this.combat.weaponAvailable){
        this.combat.setAimAngle(movementAngle);
      }else{
        // Carrying disables weapon aim, not body orientation.
        this.operator.targetLookAngle=movementAngle;
        this.operator.perceptionLookAngle=movementAngle;
      }
    }
    if(this.combat.weaponAvailable){
      this.operator.targetLookAngle=this.combat.aimAngle;
      this.operator.perceptionLookAngle=this.combat.aimAngle;
    }

    const current=this.operator.lookAngle??this.operator.targetLookAngle??0;
    const target=this.operator.targetLookAngle??current;
    const difference=Math.atan2(Math.sin(target-current),Math.cos(target-current));
    this.operator.lookAngle=current+difference*(1-Math.exp(-delta*18));

    const normalizedMove=inputLength>.001
      ? {x:(move?.x??0)/inputLength,y:(move?.y??0)/inputLength}
      : {x:0,y:0};

    const moveAngle=inputLength>.001?Math.atan2(normalizedMove.y,normalizedMove.x):this.operator.lookAngle;
    const signedRelative=Math.atan2(Math.sin(moveAngle-this.operator.lookAngle),Math.cos(moveAngle-this.operator.lookAngle));
    const relative=Math.abs(signedRelative);
    const directionalMultiplier=relative<Math.PI/4?1:relative<Math.PI*3/4?.74:.58;

    const playerMedical=this.operator.medical;
    const casualtyCap=playerMedical?.dead||playerMedical?.unconscious?0:playerMedical?.condition==="critical"?.16:1;
    const draggingCap=this.medical?.playerDraggingId?.38:1;
    const aimCap=Math.min(this.combat.movementSpeedCap??1,draggingCap,casualtyCap);
    this.operator.moveSpeed=originalSpeed
      *this.getEnvironmentSpeedMultiplier()
      *this.wounds.getMovementMultiplier(this.operator)
      *Math.min(pace||0,aimCap)
      *directionalMultiplier;
    this.operator.motionPace=pace;
    this.operator.aimMovementCap=aimCap;
    this.operator.directionalMovementMultiplier=directionalMultiplier;
    this.operator.motionRelativeAngle=signedRelative;
    this.operator.locomotionMode=inputLength<.05
      ?"idle"
      :relative<Math.PI/4
        ?(pace>.68&&!this.combat.aiming?"run":"forward")
        :relative<Math.PI*3/4
          ?"strafe"
          :"backpedal";
    this.operator.aimingPosture=this.combat.aiming;
    this.operator.torsoLeanTarget=this.combat.aiming
      ? .11
      :this.operator.locomotionMode==="run"
        ?.16
        :this.operator.locomotionMode==="forward"
          ?.055
          :0;

    try {
      if(this.aiRuntimeMode===AI_RUNTIME_MODES.LEGACY)this.actorIntents.beginFrame();
      super.update(delta, normalizedMove);

      const a=this.operator.lookAngle;
      const ax=Math.cos(a),ay=Math.sin(a);
      this.operator.facing=Math.abs(ax)>Math.abs(ay)
        ?(ax>=0?"right":"left")
        :(ay>=0?"down":"up");

      const speed=Math.hypot(this.operator.vx??0,this.operator.vy??0);
      const previousSpeed=Math.hypot(previousVx,previousVy);
      const acceleration=(speed-previousSpeed)/Math.max(delta,.001);
      this.operator.motionAcceleration=Math.max(-1,Math.min(1,acceleration/520));
      this.operator.motionSpeedRatio=Math.max(0,Math.min(1,speed/Math.max(1,originalSpeed)));
      const targetLean=(this.operator.torsoLeanTarget??0)
        -(this.operator.motionAcceleration??0)*.035;
      this.operator.torsoLean=(this.operator.torsoLean??0)
        +(targetLean-(this.operator.torsoLean??0))*(1-Math.exp(-delta*10));
      const cadence=this.operator.locomotionMode==="run"?5.2
        :this.operator.locomotionMode==="strafe"?2.2
        :this.operator.locomotionMode==="backpedal"?1.6
        :2.7;
      if(speed>4)this.operator.walkingPhase+=delta*cadence*this.operator.motionSpeedRatio;

      this.wounds.update(delta);
      if(this.operator.medical?.condition==="critical"){
        this.operator.workPose="crawl";
        this.combat.toggleAim(false);
      }else if(this.operator.medical?.unconscious||this.operator.medical?.dead){
        this.operator.workPose=this.operator.medical.dead?"dead":"downed";
        this.combat.toggleAim(false);
      }
      this.combat.update(delta, move);
      if(this.aiRuntimeMode===AI_RUNTIME_MODES.LEGACY){
        this.perception.update(delta);
        this.encounters.update(delta);
        this.teamCombatContexts.update(delta);
        this.coverNetwork.update(delta);
        this.coverStates.update(delta);
        this.fireTeams.update(delta);
        this.combatPostures.update(delta);
        this.teamResponses.update(delta);
        // Medical commitment is evaluated before combat so an accepted
        // treatment action cannot be followed by a same-frame combat move.
        this.medical.update(delta);
        this.aiCombat.update(delta);
        this.actorIntents.resolveAll(delta);
      }else{
        // AI V2 advances observation, communication, mission interpretation, warning, staged withdrawal,
        // role-driven actions, and procedure-authorized responsibility repositioning. Player-facing drag and
        // treatment mechanics remain available, while
        // legacy NPC tactical authorities are deliberately not advanced.
        this.medical.updateDrag(delta);
        this.medical.updatePlayer(delta);
        this.aiV2.update(delta);
      }
    } finally {
      this.operator.moveSpeed=originalSpeed;
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
