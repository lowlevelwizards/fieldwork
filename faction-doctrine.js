export const FACTION_DOCTRINES={
  northline:{
    id:"northline",
    relationshipBaseline:-90,
    preferredRange:520,
    minimumRange:330,
    contactDistance:820,
    coverPriority:.9,
    concealmentPreference:.35,
    pushThreshold:.66,
    withdrawThreshold:.28,
    rescuePriority:.58,
    supportPriority:.9,
    aggression:.72,
    missionWeights:{hold:1,suppress:.95,push:.72,flank:.5,withdraw:.35,rescue:.62,evade:.1}
  },
  commune:{
    id:"commune",
    relationshipBaseline:-100,
    preferredRange:610,
    minimumRange:390,
    contactDistance:900,
    coverPriority:.98,
    concealmentPreference:.95,
    pushThreshold:.84,
    withdrawThreshold:.5,
    rescuePriority:.96,
    supportPriority:.82,
    aggression:.52,
    missionWeights:{hold:.55,suppress:.72,push:.28,flank:1,withdraw:.85,rescue:1,evade:.92,ambush:1}
  },
  freelancers:{
    id:"freelancers",
    relationshipBaseline:-78,
    preferredRange:570,
    minimumRange:360,
    contactDistance:860,
    coverPriority:.88,
    concealmentPreference:.9,
    pushThreshold:.78,
    withdrawThreshold:.56,
    rescuePriority:.48,
    supportPriority:.48,
    aggression:.6,
    missionWeights:{hold:.38,suppress:.55,push:.5,flank:.92,withdraw:1,rescue:.45,evade:.82,ambush:.95}
  }
};

export function getDoctrine(factionId){
  return FACTION_DOCTRINES[factionId]??FACTION_DOCTRINES.freelancers;
}

export function relationshipBetween(a,b){
  if(a===b)return 100;
  return Math.min(getDoctrine(a).relationshipBaseline,getDoctrine(b).relationshipBaseline);
}

export function areBelligerents(a,b){
  return Boolean(a&&b&&a!==b&&FACTION_DOCTRINES[a]&&FACTION_DOCTRINES[b]);
}
