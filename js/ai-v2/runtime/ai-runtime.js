import { ActionScheduler } from "../actions/action-scheduler.js?v=20a-causal-architecture-foundation-20260802";
import { DecisionLog } from "../diagnostics/decision-log.js?v=20a-causal-architecture-foundation-20260802";
import { InvariantMonitor } from "../diagnostics/invariant-monitor.js?v=20a-causal-architecture-foundation-20260802";
import { captureWorldSnapshot } from "./world-snapshot.js?v=20a-causal-architecture-foundation-20260802";

export const AI_RUNTIME_MODES=Object.freeze({
  LEGACY:"legacy",
  V2:"v2"
});

export class AIV2Runtime{
  constructor(game){
    this.game=game;
    this.elapsed=0;
    this.snapshotAccumulator=0;
    this.snapshotInterval=.25;
    this.decisionLog=new DecisionLog({limit:300});
    this.invariants=new InvariantMonitor({decisionLog:this.decisionLog});
    this.scheduler=new ActionScheduler({decisionLog:this.decisionLog});
    this.snapshot=captureWorldSnapshot(game,{elapsed:0});
    this.invariants.inspect(this.snapshot,{now:0});
    this.decisionLog.record({
      type:"runtime_started",
      time:0,
      data:{mode:"v2",stage:"foundation_observer",scenario:game.scenarioMode}
    });
  }

  update(delta){
    this.elapsed+=delta;
    this.snapshotAccumulator+=delta;
    this.scheduler.update(delta,{now:this.elapsed,context:{game:this.game,snapshot:this.snapshot}});

    if(this.snapshotAccumulator<this.snapshotInterval)return;
    this.snapshotAccumulator%=this.snapshotInterval;
    this.snapshot=captureWorldSnapshot(this.game,{elapsed:this.elapsed});
    this.invariants.inspect(this.snapshot,{now:this.elapsed});

    for(const actor of this.game.actors){
      const primary=this.scheduler.getPrimaryAction(actor.id);
      actor.aiV2Debug={
        primaryAction:primary?.type??"UNASSIGNED",
        actionId:primary?.id??null,
        runtimeStage:"foundation_observer"
      };
    }
  }

  getDebugSummary(){
    const scheduler=this.scheduler.summary();
    const controlledActors=this.snapshot.actors.filter(actor=>actor.operationId).length;
    return `V2 observer · ${controlledActors} actor(s) seen · ${scheduler.activeActions} action(s) · ${this.invariants.current.length} invariant issue(s)`;
  }
}
