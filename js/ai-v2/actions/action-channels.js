export const ACTION_CHANNELS=Object.freeze({
  LOCOMOTION:"locomotion",
  WEAPON:"weapon",
  HANDS:"hands",
  ATTENTION:"attention",
  STANCE:"stance",
  COMMUNICATION:"communication"
});

const CHANNEL_SET=new Set(Object.values(ACTION_CHANNELS));

export function normalizeActionChannels(channels=[]){
  const normalized=[];
  for(const channel of channels){
    if(!CHANNEL_SET.has(channel))throw new Error(`Unknown AI V2 action channel: ${channel}`);
    if(!normalized.includes(channel))normalized.push(channel);
  }
  return Object.freeze(normalized);
}
