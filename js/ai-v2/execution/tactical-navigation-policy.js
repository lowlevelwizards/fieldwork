const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export const NAVIGATION_MODES=Object.freeze({NORMAL:"normal",CONSTRAINED:"constrained",RECOVERY:"recovery"});

const BASE=Object.freeze({
  progress:1,
  clearance:.92,
  corridor:.3,
  cover:.18,
  threat:.34,
  spacing:.28,
  continuity:.22,
  failure:.72,
  regression:.42
});

const INTENT_WEIGHTS=Object.freeze({
  operation_route_corridor:{progress:1.15,clearance:1,corridor:.52,cover:.14,threat:.3,spacing:.3,continuity:.24,failure:.78,regression:.5},
  seek_cover:{progress:.82,clearance:1.05,corridor:.08,cover:.82,threat:.72,spacing:.22,continuity:.18,failure:.84,regression:.18},
  withdraw:{progress:1,clearance:1,corridor:.18,cover:.42,threat:.86,spacing:.18,continuity:.16,failure:.82,regression:.06},
  approach_casualty:{progress:1.12,clearance:1.05,corridor:.12,cover:.22,threat:.32,spacing:.42,continuity:.22,failure:.84,regression:.34},
  clear_congestion:{progress:.55,clearance:1.05,corridor:.05,cover:.08,threat:.18,spacing:.92,continuity:.16,failure:.78,regression:.14}
});

function intentClass(kind=""){
  const value=String(kind).toLowerCase();
  if(value.includes("route")||value.includes("corridor"))return"operation_route_corridor";
  if(value.includes("cover")||value.includes("protected"))return"seek_cover";
  if(value.includes("withdraw")||value.includes("retreat")||value.includes("disengage")||value.includes("return_to_safety"))return"withdraw";
  if(value.includes("casualty")||value.includes("patient")||value.includes("recovery"))return"approach_casualty";
  if(value.includes("spacing")||value.includes("congestion")||value.includes("deconflict"))return"clear_congestion";
  return"default";
}

export function navigationWeights(intent={},actor=null){
  const kind=intentClass(intent.kind??intent.type??"");
  const base=kind==="default"?BASE:{...BASE,...INTENT_WEIGHTS[kind]};
  const pressure=clamp(actor?.aiV2TacticalPicture?.contactPressure??0);
  const suppression=String(actor?.aiV2TacticalPicture?.suppressionState??"steady");
  const suppressionBoost=suppression==="breaking"?.45:suppression==="pinned"?.3:suppression==="pressured"?.16:0;
  return{
    ...base,
    kind,
    contactFactor:clamp(pressure+suppressionBoost),
    threatApproachAllowed:Boolean(intent.allowThreatApproach||intent.closeDistance)
  };
}

export function navigationMode(actor,{nearObstacle=false,localCongestion=0}={}){
  const liveness=actor?.aiV2ActionLiveness??null;
  const signals=liveness?.signals??{};
  const degraded=liveness?.status==="warning"||liveness?.status==="invalid"||Number(signals.recentReversals??0)>=2||Number(signals.stalledFor??0)>.9||Number(signals.obstacleJamSeconds??0)>.45;
  if(degraded)return NAVIGATION_MODES.RECOVERY;
  if(nearObstacle||Number(localCongestion)>.22)return NAVIGATION_MODES.CONSTRAINED;
  return NAVIGATION_MODES.NORMAL;
}

export function navigationAngles(mode,{allowRetreat=false}={}){
  if(mode===NAVIGATION_MODES.RECOVERY)return allowRetreat
    ?[0,-20,20,-40,40,-65,65,-90,90,-120,120,180]
    :[0,-20,20,-40,40,-65,65,-90,90,-115,115];
  if(mode===NAVIGATION_MODES.CONSTRAINED)return[0,-15,15,-30,30,-50,50,-70,70,-90,90];
  return[0,-15,15,-30,30,-50,50];
}

export function navigationDistanceFactors(mode){
  if(mode===NAVIGATION_MODES.RECOVERY)return[.62,.95,1.35];
  if(mode===NAVIGATION_MODES.CONSTRAINED)return[.66,1,1.2];
  return[.78,1];
}

export function continuityScale(actor){
  const liveness=actor?.aiV2ActionLiveness??null;
  if(liveness?.status==="invalid")return 0;
  if(liveness?.status==="warning")return .22;
  return 1;
}
