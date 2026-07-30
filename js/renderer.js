import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";
import { drawOperator } from "./presentation/operator-renderer.js";
import { drawWorldEntity } from "./presentation/world-entity-renderer.js";
import { findEntity } from "./world-entities.js";

export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.camera = camera;
    this.dpr = 1;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.camera.resize(rect.width, rect.height);
  }

  render(game) {
    const ctx = this.context;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

    this.#drawGround(ctx, game);
    this.#drawRoad(ctx, game.map.road);
    this.#drawBrush(ctx, game.map.brush);
    this.#drawExtraction(ctx, game.map.extraction);
    this.#drawSiteGround(ctx, game.map.site);
    this.#drawShed(ctx, game.map.shed);
    this.#drawWildlife(ctx, game);
    this.#drawDepthSortedActors(ctx, game);
    this.#drawMapBorder(ctx);

    ctx.restore();
  }


  #drawWildlife(ctx, game) {
    ctx.save();
    for (const bird of game.wildlife) {
      ctx.globalAlpha = game.weather === "Fog" ? 0.22 : 0.45;
      ctx.fillStyle = "#d7d0a6";
      ctx.beginPath();
      ctx.ellipse(bird.x, bird.y, 3.4, 1.8, Math.sin(bird.phase) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  #drawDepthSortedActors(ctx, game) {
    const targetedId = game.interaction.targetId;
    const entries = game.map.obstacles.map((obstacle) => ({
      y: obstacle.y + obstacle.radius * 0.5,
      draw: () => obstacle.type === "tree" ? this.#drawTree(ctx, obstacle) : this.#drawRock(ctx, obstacle)
    }));

    for (const entity of game.entities) {
      if (entity.type === "item" && (entity.locationType !== "world" || !entity.revealed)) continue;
      entries.push({
        y: entity.groundY,
        draw: () => drawWorldEntity(ctx, entity, { targeted: entity.id === targetedId })
      });
    }

    for (const actor of game.actors) {
      const renderActor = actor.seated ? { ...actor, y: actor.y + 10, vx: 0, vy: 0 } : actor;
      entries.push({ y: actor.groundY, draw: () => drawOperator(ctx, renderActor, null) });
    }

    game.operator.backpackLoadRatio = game.inventory.getUsedPips() / game.backpack.capacityPips;
    const carriedItem = game.operator.carriedItemInstanceId
      ? findEntity(game.entities, game.operator.carriedItemInstanceId)
      : null;
    entries.push({ y: game.operator.y + game.operator.radius, draw: () => drawOperator(ctx, game.operator, carriedItem) });
    entries.sort((a, b) => a.y - b.y);
    for (const entry of entries) entry.draw();
  }

  #drawGround(ctx, game) {
    ctx.fillStyle = game.weather === "Fog" ? "#7d8878" : game.weather === "Cloudy" ? "#6f7b68" : "#758467";
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.fillStyle = "rgba(49, 62, 48, 0.09)";
    for (let y = 30; y < MAP_HEIGHT; y += 70) {
      for (let x = 20 + ((y / 70) % 2) * 24; x < MAP_WIDTH; x += 86) {
        ctx.beginPath();
        ctx.ellipse(x, y, 3, 8, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  #drawRoad(ctx, road) {
    const xs = road.map((point) => point.x);
    const ys = road.map((point) => point.y);
    ctx.fillStyle = "#8b8068";
    ctx.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys) - Math.min(...ys));
    ctx.strokeStyle = "rgba(46, 42, 34, 0.22)";
    ctx.lineWidth = 6;
    ctx.setLineDash([24, 34]);
    ctx.beginPath();
    ctx.moveTo(0, 800);
    ctx.lineTo(MAP_WIDTH, 800);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  #drawBrush(ctx, brush) {
    for (const patch of brush) {
      ctx.fillStyle = "rgba(47, 77, 50, 0.38)";
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = patch.radius * (0.45 + (i % 3) * 0.16);
        ctx.beginPath();
        ctx.arc(patch.x + Math.cos(angle) * radius * 0.55, patch.y + Math.sin(angle) * radius * 0.45, 32 + (i % 4) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  #drawExtraction(ctx, extraction) {
    ctx.save();
    ctx.translate(extraction.x, extraction.y);
    ctx.fillStyle = "rgba(222, 158, 75, 0.13)";
    ctx.strokeStyle = "rgba(235, 176, 96, 0.68)";
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, extraction.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(31, 40, 34, 0.9)";
    ctx.fillRect(-44, -18, 88, 36);
    ctx.fillStyle = "#e4d5b8";
    ctx.font = "700 16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RETURN", 0, 0);
    ctx.restore();
  }


  #drawSiteGround(ctx, site) {
    ctx.fillStyle = "rgba(119, 105, 77, 0.2)";
    ctx.beginPath(); ctx.roundRect(660, 340, 1420, 1000, 80); ctx.fill();
    ctx.fillStyle = "rgba(86, 79, 62, 0.18)";
    ctx.beginPath(); ctx.roundRect(site.workArea.x - 40, site.workArea.y - 30, site.workArea.width + 80, site.workArea.height + 90, 28); ctx.fill();
    ctx.strokeStyle = "rgba(48, 57, 48, 0.25)"; ctx.lineWidth = 7; ctx.setLineDash([18, 18]);
    ctx.beginPath(); ctx.moveTo(site.trailhead.x + 45, site.trailhead.y + 90); ctx.quadraticCurveTo(780, 520, 930, 650); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(38, 46, 39, 0.72)"; ctx.font = "700 18px system-ui"; ctx.textAlign = "left";
    ctx.fillText("OLD MAINTENANCE PULL-OFF", 1140, 350);
  }

  #drawShed(ctx, shed) {
    ctx.fillStyle = "rgba(26, 31, 27, 0.24)";
    ctx.fillRect(shed.x + 16, shed.y + 18, shed.width, shed.height);
    ctx.fillStyle = "#5e6255";
    ctx.fillRect(shed.x, shed.y, shed.width, shed.height);
    ctx.fillStyle = "#373d35";
    const t = shed.wallThickness;
    ctx.fillRect(shed.x, shed.y, shed.width, t);
    ctx.fillRect(shed.x, shed.y, t, shed.height);
    ctx.fillRect(shed.x + shed.width - t, shed.y, t, shed.height);
    ctx.fillRect(shed.x, shed.y + shed.height - t, shed.doorGap.start, t);
    ctx.fillRect(shed.x + shed.doorGap.start + shed.doorGap.width, shed.y + shed.height - t, shed.width - shed.doorGap.start - shed.doorGap.width, t);
    ctx.fillStyle = "#817459";
    ctx.fillRect(shed.x + 52, shed.y + 62, shed.width - 104, shed.height - 118);
    ctx.fillStyle = "#30362f";
    ctx.font = "700 24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("UTILITY SHED", shed.x + shed.width / 2, shed.y + 42);
  }

  #drawTree(ctx, tree) {
    ctx.fillStyle = "rgba(20, 28, 22, 0.24)";
    ctx.beginPath();
    ctx.ellipse(tree.x + 12, tree.y + 15, tree.radius * 0.95, tree.radius * 0.65, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#384b38";
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#52644b";
    ctx.beginPath();
    ctx.arc(tree.x - tree.radius * 0.2, tree.y - tree.radius * 0.22, tree.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  #drawRock(ctx, rock) {
    ctx.fillStyle = "rgba(24, 29, 25, 0.24)";
    ctx.beginPath();
    ctx.ellipse(rock.x + 8, rock.y + 10, rock.radius, rock.radius * 0.7, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#686b61";
    ctx.beginPath();
    ctx.ellipse(rock.x, rock.y, rock.radius, rock.radius * 0.75, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  #drawMapBorder(ctx) {
    ctx.strokeStyle = "rgba(20, 27, 23, 0.5)";
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  }
}
