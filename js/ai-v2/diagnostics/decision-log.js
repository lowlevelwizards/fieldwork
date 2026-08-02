export class DecisionLog{
  constructor({limit=300}={}){
    this.limit=Math.max(20,limit);
    this.entries=[];
  }

  record(entry){
    this.entries.push(Object.freeze({
      type:entry.type??"event",
      time:Number.isFinite(entry.time)?entry.time:0,
      actorId:entry.actorId??null,
      teamId:entry.teamId??null,
      actionId:entry.actionId??null,
      actionType:entry.actionType??null,
      data:Object.freeze({...entry.data})
    }));
    if(this.entries.length>this.limit)this.entries.splice(0,this.entries.length-this.limit);
  }

  recent(count=12){
    return this.entries.slice(-Math.max(0,count));
  }

  count(type=null){
    return type?this.entries.filter(entry=>entry.type===type).length:this.entries.length;
  }
}
