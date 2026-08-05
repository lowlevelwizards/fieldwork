import { ContinuousGameState } from "../js/continuous-game-state.js";

const scenarios=[
  {fixture:"open_contact",seconds:20,focus:"immediate hostile reaction and break-contact movement"},
  {fixture:"cover_position",seconds:30,focus:"cover stability, overlap, and pacing"},
  {fixture:"casualty_recovery",seconds:30,focus:"casualty attendance and concurrent security"},
  {fixture:"objective_initiative",seconds:30,focus:"live mission/contact concurrency"}
];

function simulate(fixture,seconds,delta=.05){
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:fixture});
  for(let step=0;step<Math.ceil(seconds/delta);step+=1)game.update(delta,{x:0,y:0});
  return game;
}

function compact(report,scenario){
  return{
    fixture:scenario.fixture,
    focus:scenario.focus,
    duration:report.duration,
    samples:report.samples,
    signals:report.signals,
    maximumReversals:Math.max(0,...report.actors.map(actor=>actor.directionReversals)),
    maximumOverlapSeconds:Math.max(0,...report.actors.map(actor=>actor.overlapSeconds)),
    maximumThreatenedStationarySeconds:Math.max(0,...report.actors.map(actor=>actor.threatenedStationarySeconds)),
    maximumUnreactedCloseSeconds:Math.max(0,...report.teamPairs.map(pair=>pair.unreactedCloseSeconds)),
    maximumStaticCloseSeconds:Math.max(0,...report.teamPairs.map(pair=>pair.staticCloseSeconds)),
    maximumUnattendedCasualtySeconds:Math.max(0,...report.casualties.map(casualty=>casualty.unattendedSeconds)),
    concernTransitions:report.concernTimeline.length
  };
}

const detailed=process.argv.includes("--json");
const reports=[];
for(const scenario of scenarios){
  const game=simulate(scenario.fixture,scenario.seconds);
  const report=game.aiV2.behavioralTruth.report({scenarioId:scenario.fixture});
  reports.push(detailed?report:compact(report,scenario));
}

if(detailed)console.log(JSON.stringify(reports,null,2));
else{
  console.log("Fieldwork AI behavioral truth baseline\n");
  console.table(reports.map(report=>({
    fixture:report.fixture,
    seconds:report.duration,
    reversals:report.maximumReversals,
    overlap_s:report.maximumOverlapSeconds,
    threatened_static_s:report.maximumThreatenedStationarySeconds,
    unreacted_close_s:report.maximumUnreactedCloseSeconds,
    static_contact_s:report.maximumStaticCloseSeconds,
    unattended_casualty_s:report.maximumUnattendedCasualtySeconds,
    concern_changes:report.concernTransitions
  })));
  for(const report of reports){
    const signals=Object.entries(report.signals).filter(([,items])=>items.length).map(([key,items])=>`${key}: ${items.join(", ")}`);
    console.log(`\n${report.fixture} — ${report.focus}`);
    console.log(signals.length?signals.join("\n"):"No threshold signals in this run.");
  }
  console.log("\nRun `npm run behavior:report -- --json` for complete trajectories, pair metrics, casualty timing, and concern timelines.");
}
