export class PositionSlotClaimService{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.bySlot=new Map();
    this.byActor=new Map();
  }

  update(now=0){
    for(const [slotId,claim] of [...this.bySlot]){
      if(claim.expiresAt>now)continue;
      this.bySlot.delete(slotId);
      if(this.byActor.get(claim.actorId)?.slotId===slotId)this.byActor.delete(claim.actorId);
    }
  }

  claim({actorId,slot,now=0,duration=8,purpose="defensive_position"}={}){
    if(!actorId||!slot?.id||!slot?.point)return{ok:false,reason:"invalid_slot_claim"};
    this.update(now);
    const occupied=this.bySlot.get(slot.id);
    if(occupied&&occupied.actorId!==actorId)return{ok:false,reason:"slot_already_claimed",claim:this.#clone(occupied)};
    const previous=this.byActor.get(actorId);
    if(previous&&previous.slotId!==slot.id)this.releaseActor(actorId,{now,reason:"actor_changed_slot"});
    const claim={
      slotId:slot.id,
      actorId,
      point:{...slot.point},
      sourceObjectId:slot.sourceObjectId??null,
      purpose,
      status:occupied?.status??"reserved",
      claimedAt:occupied?.claimedAt??now,
      occupiedAt:occupied?.occupiedAt??null,
      renewedAt:now,
      expiresAt:now+duration
    };
    this.bySlot.set(slot.id,claim);
    this.byActor.set(actorId,claim);
    if(!occupied)this.#record("position_slot_reserved",claim,now);
    return{ok:true,claim:this.#clone(claim)};
  }

  occupy(actorId,{now=0,duration=30}={}){
    const claim=this.byActor.get(actorId);
    if(!claim)return false;
    const changed=claim.status!=="occupied";
    claim.status="occupied";
    claim.occupiedAt=claim.occupiedAt??now;
    claim.renewedAt=now;
    claim.expiresAt=now+duration;
    this.bySlot.set(claim.slotId,claim);
    if(changed)this.#record("position_slot_occupied",claim,now);
    return true;
  }

  renewActor(actorId,{now=0,duration=8}={}){
    const claim=this.byActor.get(actorId);
    if(!claim)return false;
    claim.renewedAt=now;
    claim.expiresAt=now+duration;
    return true;
  }

  releaseActor(actorId,{now=0,reason="released"}={}){
    const claim=this.byActor.get(actorId);
    if(!claim)return false;
    this.byActor.delete(actorId);
    if(this.bySlot.get(claim.slotId)?.actorId===actorId)this.bySlot.delete(claim.slotId);
    this.#record("position_slot_released",claim,now,{reason});
    return true;
  }

  getForActor(actorId,now=Infinity){
    this.update(now);
    return this.#clone(this.byActor.get(actorId)??null);
  }

  getForSlot(slotId,now=Infinity){
    this.update(now);
    return this.#clone(this.bySlot.get(slotId)??null);
  }

  isClaimed(slotId,{excludingActorId=null,now=0}={}){
    this.update(now);
    const claim=this.bySlot.get(slotId);
    return Boolean(claim&&claim.actorId!==excludingActorId);
  }

  summary(now=0){
    this.update(now);
    return[...this.bySlot.values()].map(claim=>this.#clone(claim));
  }

  #clone(claim){return claim?{...claim,point:{...claim.point}}:null;}
  #record(type,claim,now,data={}){
    this.decisionLog?.record?.({
      type,time:now,actorId:claim.actorId,
      data:{slotId:claim.slotId,sourceObjectId:claim.sourceObjectId,status:claim.status,point:{...claim.point},...data}
    });
  }
}
