import { evaluateVisualObservation } from "./visual-observation.js";

export function evaluateCasualtyObservation(game,observer,casualty,{maximumRange=620,fieldOfViewDegrees=170}={}){
  if(!observer||!casualty||observer.teamId!==casualty.teamId)return{visible:false,confidenceRate:0};
  if(!["critical","unconscious","serious"].includes(casualty.medical?.condition))return{visible:false,confidenceRate:0};
  const evidence=evaluateVisualObservation(game,observer,casualty,{maximumRange,fieldOfViewDegrees});
  return{...evidence,confidenceRate:evidence.visible?Math.max(18,evidence.confidenceRate??0):0};
}
