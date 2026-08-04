const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class DestinationClaimService{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update(now=0){
    for(const [actorId,claim] of this.byActor)if(claim.expiresAt<=now)this.byActor.delete(actorId);
  }

  claim({actorId,point,purpose="responsibility_reposition",now=0,duration=2.5,radius=72}={}){
    if(!actorId||!point)return{ok:false,reason:"invalid_claim"};
    if(this.isClaimedNear(point,{excludingActorId:actorId,radius,now}))return{ok:false,reason:"destination_already_claimed"};
    const claim={actorId,point:{x:point.x,y:point.y},purpose,claimedAt:now,expiresAt:now+duration,radius};
    this.byActor.set(actorId,claim);
    this.decisionLog?.record?.({type:"destination_claimed",time:now,actorId,data:{...claim,point:{...claim.point}}});
    return{ok:true,claim:{...claim,point:{...claim.point}}};
  }

  renew(actorId,{now=0,duration=2.5}={}){
    const claim=this.byActor.get(actorId);if(!claim)return false;
    claim.expiresAt=now+duration;return true;
  }

  release(actorId,{now=0,reason="released"}={}){
    const claim=this.byActor.get(actorId);if(!claim)return false;
    this.byActor.delete(actorId);
    this.decisionLog?.record?.({type:"destination_released",time:now,actorId,data:{reason,point:{...claim.point},purpose:claim.purpose}});
    return true;
  }

  get(actorId,now=Infinity){
    const claim=this.byActor.get(actorId);if(!claim||claim.expiresAt<=now)return null;
    return{...claim,point:{...claim.point}};
  }

  isClaimedNear(point,{excludingActorId=null,radius=72,now=0}={}){
    this.update(now);
    for(const claim of this.byActor.values()){
      if(claim.actorId===excludingActorId)continue;
      if(distance(point,claim.point)<Math.max(radius,claim.radius??0))return true;
    }
    return false;
  }

  summary(now=0){
    this.update(now);
    return[...this.byActor.values()].map(claim=>({...claim,point:{...claim.point}}));
  }
}
