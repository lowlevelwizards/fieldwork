const normalizeAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

function cardinalFacing(angle){
  const x=Math.cos(angle),y=Math.sin(angle);
  return Math.abs(x)>Math.abs(y)?(x>=0?"right":"left"):(y>=0?"down":"up");
}

export class AttentionExecutor{
  turnToward(actor,target,delta,{turnRate=5.2,pose="scan"}={}){
    if(!actor||!target)return {settled:false,error:Math.PI};
    const desired=Math.atan2(target.y-actor.y,target.x-actor.x);
    const current=Number.isFinite(actor.lookAngle)?actor.lookAngle:desired;
    const error=normalizeAngle(desired-current);
    const blend=1-Math.exp(-Math.max(0,delta)*turnRate);
    const next=current+error*blend;
    actor.lookAngle=next;
    actor.targetLookAngle=desired;
    actor.perceptionLookAngle=next;
    actor.facing=cardinalFacing(next);
    actor.workPose=pose;
    actor.motionState="idle";
    return {settled:Math.abs(error)<.06,error:Math.abs(error),desiredAngle:desired,currentAngle:next};
  }
}
