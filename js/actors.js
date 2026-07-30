function resolveFacing(move, currentFacing) {
  if (Math.hypot(move.x, move.y) < 0.08) return currentFacing;
  if (Math.abs(move.x) > Math.abs(move.y)) return move.x < 0 ? "left" : "right";
  return move.y < 0 ? "up" : "down";
}

const WORKER_ROUTES = {
  worker_ada: [
    { type: "walk", x: 860, y: 720, label: "Arriving from truck" },
    { type: "wait", duration: 2.2, label: "Checking clipboard" },
    { type: "walk", x: 1180, y: 540, label: "Walking to work area" },
    { type: "wait", duration: 2.8, label: "Inspecting workbench" },
    { type: "walk", x: 1210, y: 1140, label: "Taking a break" },
    { type: "sit", duration: 4.5, label: "Sitting at break table" },
    { type: "walk", x: 1020, y: 780, label: "Returning to truck" },
    { type: "wait", duration: 2.4, label: "Checking truck storage" }
  ],
  worker_tomas: [
    { type: "walk", x: 555, y: 520, label: "Checking route sign" },
    { type: "wait", duration: 3.2, label: "Reading route notice" },
    { type: "walk", x: 1060, y: 500, label: "Walking the pull-off" },
    { type: "wait", duration: 2.4, label: "Looking over the site" },
    { type: "walk", x: 1270, y: 720, label: "Checking the shed" },
    { type: "wait", duration: 2.8, label: "Waiting by the shed" },
    { type: "walk", x: 760, y: 690, label: "Returning to the truck" },
    { type: "wait", duration: 3.0, label: "Taking notes" }
  ]
};

export function createActors() {
  return [
    {
      id: "worker_ada", type: "actor", name: "Ada Mercer", role: "Maintenance Worker",
      x: 820, y: 720, width: 44, height: 70, groundY: 754, radius: 18,
      vx: 0, vy: 0, moveSpeed: 74, facing: "right", walkingPhase: 0,
      kitId: "maintenance_worker_orange", backpackLoadRatio: 0, carriedItemInstanceId: null,
      taskIndex: 0, taskTime: 0, currentTask: "Arriving from truck", seated: false,
      relationship: "Unknown", interactionRadius: 82, priority: 30,
      greeting: ["Morning.", "Battery should be around here somewhere.", "Road crew left in a hurry."]
    },
    {
      id: "worker_tomas", type: "actor", name: "Tomas Reed", role: "Route Worker",
      x: 610, y: 500, width: 44, height: 70, groundY: 534, radius: 18,
      vx: 0, vy: 0, moveSpeed: 66, facing: "left", walkingPhase: 0,
      kitId: "maintenance_worker_yellow", backpackLoadRatio: 0, carriedItemInstanceId: null,
      taskIndex: 0, taskTime: 0, currentTask: "Checking route sign", seated: false,
      relationship: "Unknown", interactionRadius: 82, priority: 29,
      greeting: ["Didn't expect company.", "Lower route is still closed.", "Watch your footing near the truck."]
    }
  ];
}

function advance(actor, route) {
  actor.taskIndex = (actor.taskIndex + 1) % route.length;
  actor.taskTime = 0;
  actor.seated = false;
}

export function updateActors(game, delta) {
  const player = game.operator;
  for (const actor of game.actors) {
    const route = WORKER_ROUTES[actor.id];
    const task = route[actor.taskIndex];
    actor.currentTask = task.label;
    actor.taskTime += delta;
    actor.vx = 0;
    actor.vy = 0;

    if (task.type === "walk") {
      const dx = task.x - actor.x;
      const dy = task.y - actor.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 5) advance(actor, route);
      else {
        const speed = Math.min(actor.moveSpeed, distance / Math.max(delta, 0.001));
        actor.vx = dx / distance * speed;
        actor.vy = dy / distance * speed;
        actor.x += actor.vx * delta;
        actor.y += actor.vy * delta;
        actor.facing = resolveFacing({ x: actor.vx, y: actor.vy }, actor.facing);
        actor.walkingPhase += delta * 8;
      }
    } else if (task.type === "sit") {
      actor.seated = true;
      if (actor.taskTime >= task.duration) advance(actor, route);
    } else if (actor.taskTime >= task.duration) advance(actor, route);

    const nearby = Math.hypot(player.x - actor.x, player.y - actor.y) < 105;
    if (nearby && task.type !== "walk" && !actor.seated) {
      actor.facing = resolveFacing({ x: player.x - actor.x, y: player.y - actor.y }, actor.facing);
    }
    actor.groundY = actor.y + actor.radius;
  }
}
