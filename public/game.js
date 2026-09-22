// Tiny physics toy: a tower of boxes pre-stacked on a swaying platform.
// Drag them around. No score, no win state — just a fiddle activity.
// Above the rig, a small solar system turns in the night sky.
const startStacker = () => {
  const canvas = document.getElementById("stacker");
  if (!canvas || typeof Matter === "undefined") return;

  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let W = 0, H = 0;
  function fit() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(280, Math.round(rect.width));
    H = Math.max(220, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();

  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0012 } });
  const world = engine.world;

  // Side walls keep boxes in play; a floor catches anything that punches
  // through the water at speed before buoyancy can lift it.
  const wallT = 80;
  const leftWall   = Bodies.rectangle(-wallT / 2,    H / 2, wallT, H * 4, { isStatic: true });
  const rightWall  = Bodies.rectangle(W + wallT / 2, H / 2, wallT, H * 4, { isStatic: true });
  const bottomWall = Bodies.rectangle(W / 2, H + wallT / 2 - 2, W * 4, wallT, {
    isStatic: true,
    friction: 0.05,
  });
  Composite.add(world, [leftWall, rightWall, bottomWall]);

  // Platform — kinematic. Slow gentle sway and a tiny tilt; the boxes
  // are slippery enough to slide off without big shake.
  const platformW = Math.min(150, Math.max(120, W * 0.34));
  const platformH = 12;
  const platformY = H - 140;
  const platformBaseX = W / 2;
  const swayAmp = 9;
  const tiltAmp = 0.045;
  const platform = Bodies.rectangle(platformBaseX, platformY, platformW, platformH, {
    isStatic: true,
    friction: 0.22,
    frictionStatic: 0.3,
  });
  Composite.add(world, platform);

  // Water surface — anything below this gets wet. Pulled well up so
  // there's a proper expanse of water below the platform.
  const waterY = H - 90;

  // Pillar under the platform (decorative) — goes from the platform
  // down through the water to the bottom of the canvas.
  const pillarW = 22;
  const pillarH = H - platformY - platformH / 2;

  // ── Boxes (stacked on the platform, Linux at the bottom) ──
  // Array order is stack order: index 0 is delivered first and ends up
  // lowest, the last entry lands on top.
  const items = [
    { label: "Linux",        icon: "⬡",  color: "#ff7a92" }, // bottom
    { label: "Cloud Native", icon: "☁",  color: "#5b9dff" },
    { label: "Agentic AI",   icon: "✦",  color: "#b48cff" },
    { label: "Security",     icon: "✓",  color: "#82f4a3" },
    { label: "Open Source",  icon: "$",  color: "#ffb454" },
    { label: "DevEx",        icon: "▤",  color: "#7ee0d1" }, // top
  ];

  const boxW = Math.min(120, Math.max(106, platformW * 0.78));
  const boxH = 22;

  // Boxes are created at the moment they're released by the helicopter;
  // up to then we just draw a faux box dangling under the heli.
  function makeBox(item, i, x, y) {
    const body = Bodies.rectangle(x, y, boxW, boxH, {
      restitution: 0.15,
      friction: 0.22,
      frictionStatic: 0.28,
      frictionAir: 0.006,
      density: 0.0038,
      chamfer: { radius: 4 },
    });
    body.gameData = { ...item, w: boxW, h: boxH };
    body.spawnIndex = i;
    body.delivered = true;
    return body;
  }

  const boxes = [];

  // ── Helicopter ────────────────────────────────────────────────────
  // Drops the boxes onto the platform one at a time, then leaves.
  const heli = {
    state: "idle",   // idle | approach | hover | depart | gone
    x: -200, y: 50,
    carrying: null,  // index of box currently dangling on the rope
    nextIndex: 0,    // next box to deliver
    dir: 1,          // 1 = enters from left, -1 = enters from right
    stateT: 0,
    bobT: 0,
  };
  // The top of the sky belongs to the solar system; the helicopter cruises
  // just under it, but never so low it can't clear a full stack.
  const skyBand = Math.round(Math.min(190, W * 0.45));
  const heliCruiseY = Math.max(
    48,
    Math.min(skyBand + 30, platformY - items.length * boxH - 70),
  );
  const ropeLen = 28;

  function startNextDelivery() {
    if (heli.nextIndex >= items.length) { heli.state = "gone"; return; }
    const i = heli.nextIndex;
    heli.carrying = i;
    heli.dir = i % 2 === 0 ? 1 : -1;
    heli.x = heli.dir > 0 ? -120 : W + 120;
    heli.y = heliCruiseY;
    heli.state = "approach";
    heli.stateT = 0;
  }

  // Where the helicopter descends to so the dangling box rests just
  // above the current stack top (platform top, minus i box heights).
  // box.y = heli.y + ropeLen + boxH/2 → solve so box bottom ≈ stackTop - clear.
  function computeDropY(i) {
    if (i === null || i === undefined) return heliCruiseY;
    const platformTop = platformY - platformH / 2;
    const stackTop = platformTop - i * boxH;
    const clear = 3;
    return stackTop - clear - boxH - ropeLen;
  }

  function updateHeli(dt) {
    heli.bobT += dt;
    heli.stateT += dt;
    const targetX = platformBaseX;

    if (heli.state === "idle") {
      if (heli.stateT > 0.5) startNextDelivery();
    } else if (heli.state === "approach") {
      const dur = 1.3;
      const t = Math.min(1, heli.stateT / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const startX = heli.dir > 0 ? -120 : W + 120;
      heli.x = startX + (targetX - startX) * eased;
      heli.y = heliCruiseY + Math.sin(heli.bobT * 7) * 0.6;
      if (t >= 1) { heli.state = "lower"; heli.stateT = 0; }
    } else if (heli.state === "lower") {
      // Gently descend so the dangling box settles just above the stack.
      const target = computeDropY(heli.carrying);
      const dur = 1.0;
      const t = Math.min(1, heli.stateT / dur);
      const eased = t * t * (3 - 2 * t); // smoothstep
      heli.y = heliCruiseY + (target - heliCruiseY) * eased;
      heli.x = targetX + Math.sin(heli.bobT * 2.5) * 0.4;
      if (t >= 1) { heli.state = "hold"; heli.stateT = 0; }
    } else if (heli.state === "hold") {
      const dur = 0.25;
      heli.y = computeDropY(heli.carrying) + Math.sin(heli.bobT * 4) * 0.3;
      heli.x = targetX;
      if (heli.stateT > dur) {
        // Release: spawn a freshly-created dynamic body right here, so
        // there's no kinematic→dynamic toggle that could snap position.
        const i = heli.carrying;
        const item = items[i];
        const x = heli.x;
        const y = heli.y + ropeLen + boxH / 2;
        const b = makeBox(item, i, x, y);
        boxes.push(b);
        Composite.add(world, b);
        heli.releasedFromIndex = i;
        heli.carrying = null;
        heli.nextIndex++;
        heli.state = "raise";
        heli.stateT = 0;
      }
    } else if (heli.state === "raise") {
      const dur = 0.8;
      const t = Math.min(1, heli.stateT / dur);
      const eased = 1 - Math.pow(1 - t, 2);
      const startY = computeDropY(heli.releasedFromIndex);
      heli.y = startY + (heliCruiseY - startY) * eased;
      heli.x = targetX;
      if (t >= 1) { heli.state = "depart"; heli.stateT = 0; }
    } else if (heli.state === "depart") {
      const dur = 1.2;
      const t = Math.min(1, heli.stateT / dur);
      const eased = t * t;
      const endX = heli.dir > 0 ? W + 140 : -140;
      heli.x = targetX + (endX - targetX) * eased;
      heli.y = heliCruiseY + Math.sin(heli.bobT * 7) * 0.6;
      if (t >= 1) { heli.state = "idle"; heli.stateT = 0; }
    }

  }

  // Mouse / touch drag. Canvas backing store is W*dpr×H*dpr but the physics
  // world is W×H, so down-scale Matter's mouse mapping by 1/dpr.
  const mouse = Mouse.create(canvas);
  Mouse.setScale(mouse, { x: 1 / dpr, y: 1 / dpr });
  // Matter binds a non-passive 'wheel' handler that always calls
  // preventDefault, which blocks page scrolling whenever the cursor is
  // over the canvas. Unbind it so the page stays scrollable.
  canvas.removeEventListener("wheel", mouse.mousewheel);
  const mc = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, damping: 0.12, render: { visible: false } },
  });
  Composite.add(world, mc);

  // Only swallow touchmove when actively dragging a box.
  canvas.addEventListener(
    "touchmove",
    (e) => { if (mc.body) e.preventDefault(); },
    { passive: false }
  );

  // Slow, gentle platform motion. Boxes are slippery enough that even
  // this tiny tilt walks them off the edges.
  Events.on(engine, "beforeUpdate", () => {
    const t = engine.timing.timestamp / 1000;
    Body.setPosition(platform, {
      x: platformBaseX + Math.sin(t * 0.35) * swayAmp,
      y: platformY,
    });
    Body.setAngle(platform, Math.sin(t * 0.28) * tiltAmp);
  });

  // Water physics — boxes that hit water float and drift, never respawn.
  const gMag = engine.gravity.y * engine.gravity.scale;
  Events.on(engine, "afterUpdate", () => {
    const t = engine.timing.timestamp / 1000;
    boxes.forEach((b) => {
      const surface = waterY;
      const depth = b.position.y + boxH / 2 - surface; // how much is below surface
      if (depth > 0) {
        const submerged = Math.min(1, depth / boxH);
        // Buoyancy slightly over-corrects gravity so the box bobs up.
        const fy = -gMag * b.mass * (1 + submerged * 0.4);
        Body.applyForce(b, b.position, { x: 0, y: fy });
        // Drag (water is much more viscous than air).
        Body.setVelocity(b, {
          x: b.velocity.x * 0.93,
          y: b.velocity.y * 0.88,
        });
        Body.setAngularVelocity(b, b.angularVelocity * 0.86);
        // Gentle current that varies per box so they drift apart.
        const drift = 0.0000018 * Math.sin(t * 0.35 + b.spawnIndex * 1.2);
        Body.applyForce(b, b.position, { x: drift * b.mass, y: 0 });

        // First contact with the surface throws a splash. Boxes sliding
        // off the platform is the designed ending, so it deserves a beat.
        if (!b.wasWet) {
          b.wasWet = true;
          spawnSplash(b.position.x, surface, Math.min(1.4, Math.abs(b.velocity.y) / 2.6));
          // Air dragged under on impact escapes over the next second or so.
          b.bubbleUntil = t + 1.5;
        }
      } else if (b.position.y + boxH / 2 < surface - 6) {
        b.wasWet = false; // dragged back out — let it splash again on return
      }
    });
  });

  // ── Ambience: splash droplets, ripple rings, bubbles ──────────────
  // Every array is hard-capped. This redraws 60 times a second on a
  // canvas barely 420px wide, so the budget buys a few good particles
  // rather than a cloud of cheap ones.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MAX_SPLASH = 70, MAX_RIPPLES = 9, MAX_BUBBLES = 44;
  const splashes = [];
  const ripples = [];
  const bubbles = [];

  function spawnSplash(x, y, power) {
    const n = Math.min(15, Math.round(5 + power * 9));
    for (let i = 0; i < n && splashes.length < MAX_SPLASH; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
      const sp = 20 + Math.random() * 44 * (0.5 + power);
      splashes.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        ttl: 0.45 + Math.random() * 0.5,
        life: 0,
        r: 0.7 + Math.random() * 1.2,
      });
    }
    if (ripples.length < MAX_RIPPLES) ripples.push({ x, r: 3, ttl: 1.6, life: 0 });
  }

  function updateAmbience(t, dt) {
    for (let i = splashes.length - 1; i >= 0; i--) {
      const d = splashes[i];
      d.life += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 150 * dt; // droplets arc back down
      if (d.life > d.ttl || d.y > waterY + 3) splashes.splice(i, 1);
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.life += dt;
      r.r += 25 * dt;
      if (r.life > r.ttl) ripples.splice(i, 1);
    }
    // Bubbles come from air entrained on impact, and from anything held
    // properly under the surface. Buoyancy means a floating box is never
    // fully submerged, so the impact window is what you normally see.
    boxes.forEach((b) => {
      const entrained = b.bubbleUntil !== undefined && t < b.bubbleUntil;
      const held = b.position.y - boxH / 2 > waterY;
      if (!entrained && !held) return;
      if (bubbles.length >= MAX_BUBBLES || Math.random() > dt * 7) return;
      bubbles.push({
        x: b.position.x + (Math.random() - 0.5) * boxW * 0.7,
        y: Math.max(waterY + 1, b.position.y - boxH / 2),
        r: 0.6 + Math.random() * 1.2,
        vy: -10 - Math.random() * 13,
        wob: Math.random() * Math.PI * 2,
      });
    });
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y += b.vy * dt;
      b.wob += dt * 3.4;
      if (b.y < waterY - 1) {
        // Popping at the surface leaves a tiny ring behind.
        if (ripples.length < MAX_RIPPLES && Math.random() < 0.3) {
          ripples.push({ x: b.x, r: 1, ttl: 0.85, life: 0 });
        }
        bubbles.splice(i, 1);
      }
    }
  }

  function drawSplashes() {
    splashes.forEach((d) => {
      const k = 1 - d.life / d.ttl;
      ctx.fillStyle = `rgba(180, 220, 255, ${0.55 * k})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawRipples() {
    ctx.lineWidth = 1;
    ripples.forEach((r) => {
      const k = 1 - r.life / r.ttl;
      ctx.strokeStyle = `rgba(150, 210, 255, ${0.4 * k})`;
      ctx.beginPath();
      ctx.ellipse(r.x, waterY, r.r, r.r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawBubbles() {
    ctx.strokeStyle = "rgba(190, 225, 255, 0.4)";
    ctx.lineWidth = 0.8;
    bubbles.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x + Math.sin(b.wob) * 1.4, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // Press "r" to restart the delivery from the beginning.
  function reset() {
    while (boxes.length) {
      const b = boxes.pop();
      Composite.remove(world, b);
    }
    splashes.length = 0;
    ripples.length = 0;
    bubbles.length = 0;
    heli.state = "idle";
    heli.stateT = 0;
    heli.carrying = null;
    heli.nextIndex = 0;
    heli.x = -200;
    heli.y = heliCruiseY;
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") reset();
  });

  // ── Rendering ─────────────────────────────────────────────────────
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // The platform stands on a braced steel truss rather than a solid
  // block — it splays slightly towards the seabed, so the whole thing
  // reads as a rig instead of a floating slab.
  function drawPillar() {
    const cx = platform.position.x;
    const top = platformY + platformH / 2;
    const half = pillarW / 2;
    const splay = 4;

    // Legs.
    ctx.strokeStyle = "#24382c";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - half, top); ctx.lineTo(cx - half - splay, top + pillarH);
    ctx.moveTo(cx + half, top); ctx.lineTo(cx + half + splay, top + pillarH);
    ctx.stroke();

    // Cross bracing between the legs.
    ctx.strokeStyle = "rgba(58, 208, 122, 0.2)";
    ctx.lineWidth = 1;
    const rungs = Math.max(3, Math.round(pillarH / 15));
    ctx.beginPath();
    for (let i = 0; i < rungs; i++) {
      const y0 = top + (pillarH * i) / rungs;
      const y1 = top + (pillarH * (i + 1)) / rungs;
      const s0 = half + (splay * i) / rungs;
      const s1 = half + (splay * (i + 1)) / rungs;
      ctx.moveTo(cx - s0, y0); ctx.lineTo(cx + s1, y1);
      ctx.moveTo(cx + s0, y0); ctx.lineTo(cx - s1, y1);
      ctx.moveTo(cx - s1, y1); ctx.lineTo(cx + s1, y1);
    }
    ctx.stroke();

    // Rust/algae stain where the legs meet the water.
    const stainW = half + (splay * (waterY - top)) / pillarH;
    ctx.strokeStyle = "rgba(130, 200, 255, 0.3)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - stainW - 1, waterY); ctx.lineTo(cx - stainW + 1.5, waterY + 5);
    ctx.moveTo(cx + stainW + 1, waterY); ctx.lineTo(cx + stainW - 1.5, waterY + 5);
    ctx.stroke();
  }

  // The depth gradient and the backdrop never change between resizes,
  // so they are built once instead of per frame. Both are invalidated
  // by setting them back to null in the resize handler.
  let depthGrad = null;
  let backdrop = null;

  function buildDepthGradient() {
    const g = ctx.createLinearGradient(0, waterY, 0, H);
    g.addColorStop(0, "rgba(91, 157, 255, 0.06)");
    g.addColorStop(1, "rgba(58, 90, 160, 0.22)");
    depthGrad = g;
  }

  // Stars and the horizon glow are static, so they are baked into an
  // offscreen canvas and blitted in one draw call.
  function buildBackdrop() {
    const c = document.createElement("canvas");
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const b = c.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Phosphor haze lifting off the horizon.
    const band = 46;
    const glow = b.createLinearGradient(0, waterY - band, 0, waterY);
    glow.addColorStop(0, "rgba(58, 208, 122, 0)");
    glow.addColorStop(1, "rgba(58, 208, 122, 0.08)");
    b.fillStyle = glow;
    b.fillRect(0, waterY - band, W, band);
    b.fillStyle = "rgba(130, 244, 163, 0.14)";
    b.fillRect(0, waterY - 0.5, W, 0.5);

    // Stars — density scales with width so a narrow canvas isn't dense.
    const ceiling = Math.max(10, waterY - 56);
    const count = Math.round(W * 0.14);
    for (let i = 0; i < count; i++) {
      b.fillStyle = `rgba(215, 234, 217, ${0.05 + Math.random() * 0.2})`;
      b.fillRect(Math.random() * W, Math.random() * ceiling, 1, 1);
    }
    backdrop = c;
  }

  function drawBackdrop() {
    if (!backdrop) buildBackdrop();
    ctx.drawImage(backdrop, 0, 0, W, H);
  }

  // Sunlight fanning down through the water.
  function drawGodRays(t) {
    if (W < 340) return; // too tight to read on a narrow canvas
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterY, W, H - waterY);
    ctx.clip();
    ctx.fillStyle = "rgba(130, 200, 255, 0.035)";
    for (let i = 0; i < 3; i++) {
      const cx = W * (0.24 + i * 0.26) + Math.sin(t * 0.12 + i * 1.7) * 11;
      const w = 15 + i * 5;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, waterY);
      ctx.lineTo(cx + w / 2, waterY);
      ctx.lineTo(cx + w * 1.6, H);
      ctx.lineTo(cx - w * 0.5, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Everything above the water line, mirrored into it. Clipped to the
  // water rect and drawn faint, so it reads as reflection not clutter.
  function drawReflections(t) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterY, W, H - waterY);
    ctx.clip();
    ctx.globalAlpha = 0.17;
    ctx.translate(Math.sin(t * 0.8) * 0.9, waterY * 2);
    ctx.scale(1, -1);
    drawPlatformSlab();
    boxes.forEach((b) => {
      if (b.position.y + boxH / 2 > waterY) return; // already floating
      drawBoxShape(b.position.x, b.position.y, b.angle, b.gameData, false);
    });
    if (heli.state !== "gone") drawHelicopterShape(t);
    ctx.restore();
  }

  function drawWaterBody() {
    ctx.fillStyle = "rgba(91, 157, 255, 0.14)";
    ctx.fillRect(0, waterY, W, H - waterY);
    if (!depthGrad) buildDepthGradient();
    ctx.fillStyle = depthGrad;
    ctx.fillRect(0, waterY, W, H - waterY);
  }

  function drawWaterSurface(t) {
    // Animated surface wave
    ctx.strokeStyle = "rgba(130, 200, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const y =
        waterY +
        Math.sin(x * 0.06 + t * 1.4) * 1.6 +
        Math.sin(x * 0.13 - t * 0.8) * 0.9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // A subtler ripple line below the surface
    ctx.strokeStyle = "rgba(130, 200, 255, 0.18)";
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y =
        waterY +
        6 +
        Math.sin(x * 0.04 - t * 1.1) * 1.2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // A third, slower swell further down, at a frequency that doesn't
    // divide into the other two — keeps the water from looking looped.
    ctx.strokeStyle = "rgba(130, 200, 255, 0.1)";
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = waterY + 13 + Math.sin(x * 0.027 + t * 0.55) * 1.6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glints riding the crests.
    ctx.fillStyle = "rgba(200, 232, 255, 0.5)";
    const glints = Math.round(W / 90);
    for (let i = 0; i < glints; i++) {
      const gx = ((t * 9 + i * 137) % (W + 40)) - 20;
      const gy = waterY + Math.sin(gx * 0.06 + t * 1.4) * 1.6;
      ctx.fillRect(gx, gy - 0.5, 3, 1);
    }
  }

  // Just the deck slab. Split out so the reflection pass can reuse it
  // without dragging the label along.
  function drawPlatformSlab() {
    ctx.save();
    ctx.translate(platform.position.x, platform.position.y);
    ctx.rotate(platform.angle);
    ctx.fillStyle = "#0c1812";
    ctx.fillRect(-platformW / 2, -platformH / 2, platformW, platformH);
    ctx.strokeStyle = "#3ad07a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-platformW / 2 + 0.5, -platformH / 2 + 0.5, platformW - 1, platformH - 1);
    ctx.strokeStyle = "rgba(58, 208, 122, 0.35)";
    ctx.lineWidth = 1;
    for (let x = -platformW / 2 + 6; x < platformW / 2 - 6; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, -platformH / 2 + 3);
      ctx.lineTo(x + 4, platformH / 2 - 3);
      ctx.stroke();
    }
    // Lit deck edge, so boxes look like they land on something solid.
    ctx.strokeStyle = "rgba(130, 244, 163, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-platformW / 2 + 2, -platformH / 2 + 0.5);
    ctx.lineTo(platformW / 2 - 2, -platformH / 2 + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlatform(t) {
    drawPlatformSlab();

    // Hazard beacons on the deck corners. Steady under reduced motion —
    // a blinking light is exactly what that preference is asking about.
    const pulse = reduceMotion ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.4));
    ctx.save();
    ctx.translate(platform.position.x, platform.position.y);
    ctx.rotate(platform.angle);
    [-1, 1].forEach((side) => {
      const bx = side * (platformW / 2 - 3);
      const by = -platformH / 2 - 3;
      ctx.fillStyle = `rgba(255, 180, 84, ${0.22 * pulse})`;
      ctx.beginPath();
      ctx.arc(bx, by, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 200, 130, ${pulse})`;
      ctx.fillRect(bx - 1, by - 1, 2, 2);
    });
    ctx.restore();

    // platform label
    ctx.save();
    ctx.translate(platform.position.x, platform.position.y + platformH / 2 + 14);
    ctx.fillStyle = "#0c1812";
    ctx.strokeStyle = "#3ad07a";
    ctx.lineWidth = 1;
    roundRect(-58, -9, 116, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3ad07a";
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▌ tech platform", 0, 0.5);
    ctx.restore();
  }

  function drawHelicopter(t) {
    if (heli.state === "gone") return;
    const x = heli.x, y = heli.y;

    // Rope to the box, if any.
    if (heli.carrying !== null) {
      ctx.strokeStyle = "rgba(215, 234, 217, 0.65)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x, y + ropeLen);
      ctx.stroke();
    }

    drawDownwash(t);
    drawHelicopterShape(t);
  }

  // Rotor wash: short streaks blown down and out from under the disc,
  // strongest while the heli is descending or holding station.
  function drawDownwash(t) {
    const working = heli.state === "lower" || heli.state === "hold" || heli.state === "raise";
    if (!working) return;
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.strokeStyle = "rgba(215, 234, 217, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const phase = (t * 2.4 + Math.abs(i) * 0.4) % 1;
      const sx = i * 8;
      const y0 = 10 + phase * 14;
      ctx.moveTo(sx + i * phase * 4, y0);
      ctx.lineTo(sx + i * phase * 5.5, y0 + 5);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawHelicopterShape(t) {
    ctx.save();
    ctx.translate(heli.x, heli.y);

    // Body
    ctx.fillStyle = "#0c1812";
    ctx.strokeStyle = "#3ad07a";
    ctx.lineWidth = 1.4;
    roundRect(-20, -6, 40, 14, 5);
    ctx.fill();
    ctx.stroke();

    // Cockpit window — facing the direction of approach when carrying
    const facing = heli.carrying !== null ? heli.dir : -heli.dir;
    ctx.fillStyle = "rgba(91, 157, 255, 0.55)";
    ctx.beginPath();
    ctx.moveTo(facing * 10, -3);
    ctx.lineTo(facing * 18, 0);
    ctx.lineTo(facing * 10, 4);
    ctx.closePath();
    ctx.fill();

    // Skids
    ctx.strokeStyle = "rgba(58, 208, 122, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-14, 8); ctx.lineTo(14, 8);
    ctx.moveTo(-12, 8); ctx.lineTo(-10, 11);
    ctx.moveTo(12, 8); ctx.lineTo(10, 11);
    ctx.stroke();

    // Tail boom + tail rotor
    ctx.strokeStyle = "#3ad07a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-facing * 20, 0);
    ctx.lineTo(-facing * 34, -2);
    ctx.stroke();
    // tail fin
    ctx.beginPath();
    ctx.moveTo(-facing * 34, -2);
    ctx.lineTo(-facing * 36, -8);
    ctx.stroke();
    // tail rotor (small spinning line)
    const tr = t * 40;
    ctx.beginPath();
    ctx.moveTo(-facing * 36 + Math.cos(tr) * 3, -3 + Math.sin(tr) * 3);
    ctx.lineTo(-facing * 36 - Math.cos(tr) * 3, -3 - Math.sin(tr) * 3);
    ctx.stroke();

    // Main rotor — spinning blur
    const rot = t * 70;
    ctx.strokeStyle = "rgba(58, 208, 122, 0.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const rx = Math.cos(rot) * 24;
    const ry = Math.sin(rot) * 1.2;
    ctx.moveTo(rx, -9 + ry);
    ctx.lineTo(-rx, -9 - ry);
    ctx.stroke();
    // outer faint blade trail
    ctx.strokeStyle = "rgba(58, 208, 122, 0.12)";
    ctx.beginPath();
    ctx.ellipse(0, -9, 24, 1.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    // hub
    ctx.fillStyle = "#82f4a3";
    ctx.fillRect(-1.5, -10, 3, 3);

    // The disc the blades sweep, as a faint wash rather than a blur.
    ctx.fillStyle = "rgba(58, 208, 122, 0.05)";
    ctx.beginPath();
    ctx.ellipse(0, -9, 24, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Navigation lights: red to port, green to starboard, plus a white
    // strobe on the spine. Held steady when reduced motion is asked for.
    const nav = reduceMotion ? 0.8 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 5));
    const facingNav = heli.carrying !== null ? heli.dir : -heli.dir;
    [
      { dx: -facingNav * 19, col: "255, 122, 146" },
      { dx: facingNav * 19, col: "130, 244, 163" },
    ].forEach((l) => {
      ctx.fillStyle = `rgba(${l.col}, ${0.16 * nav})`;
      ctx.beginPath();
      ctx.arc(l.dx, 1, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${l.col}, ${nav})`;
      ctx.fillRect(l.dx - 0.9, 0.1, 1.8, 1.8);
    });
    const strobe = reduceMotion ? 0.25 : (t * 1.6) % 1 < 0.08 ? 1 : 0.12;
    ctx.fillStyle = `rgba(233, 245, 236, ${strobe})`;
    ctx.fillRect(-1, -7.5, 2, 1.6);

    ctx.restore();
  }

  function drawCarriedBox() {
    if (heli.carrying === null) return;
    const item = items[heli.carrying];
    const x = heli.x;
    const y = heli.y + ropeLen + boxH / 2;
    drawBoxShape(x, y, 0, { ...item, w: boxW, h: boxH });
  }

  function drawBoxShape(x, y, angle, d, withLabel = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Fake bloom: a wide, faint stroke under the real border. Cheaper
    // than shadowBlur, and it doesn't smear the 1px phosphor lines.
    // Composed against the inherited alpha rather than overwriting it,
    // so the reflection pass stays faint.
    const baseAlpha = ctx.globalAlpha;
    roundRect(-d.w / 2, -d.h / 2, d.w, d.h, 4);
    ctx.strokeStyle = d.color;
    ctx.globalAlpha = baseAlpha * 0.16;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = baseAlpha;

    ctx.fillStyle = "#0c1812";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // A lit top edge and a shaded bottom one give the crate a little
    // dimension without committing to isometric geometry.
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(215, 234, 217, 0.16)";
    ctx.beginPath();
    ctx.moveTo(-d.w / 2 + 5, -d.h / 2 + 1.5);
    ctx.lineTo(d.w / 2 - 5, -d.h / 2 + 1.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.moveTo(-d.w / 2 + 5, d.h / 2 - 1.5);
    ctx.lineTo(d.w / 2 - 5, d.h / 2 - 1.5);
    ctx.stroke();

    if (withLabel) {
      ctx.fillStyle = d.color;
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${d.icon}  ${d.label}`, 0, 0.5);
    }
    ctx.restore();
  }

  function drawBox(body) {
    drawBoxShape(body.position.x, body.position.y, body.angle, body.gameData);
  }

  // A moored marker buoy, riding the same swell as the water surface.
  function drawBuoy(t) {
    const bx = Math.max(26, W * 0.14);
    const by = waterY + Math.sin(bx * 0.06 + t * 1.4) * 1.6 + Math.sin(t * 0.9) * 1.1;
    const tilt = Math.sin(t * 0.8) * 0.14;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(tilt);
    // Body.
    ctx.fillStyle = "#0c1812";
    ctx.strokeStyle = "rgba(255, 180, 84, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(-2.6, -6);
    ctx.lineTo(2.6, -6);
    ctx.lineTo(4, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Mast and lamp.
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(0, -11);
    ctx.stroke();
    const lamp = reduceMotion ? 0.6 : (t * 0.9) % 1 < 0.3 ? 1 : 0.15;
    ctx.fillStyle = `rgba(255, 180, 84, ${0.2 * lamp})`;
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 210, 150, ${lamp})`;
    ctx.fillRect(-1, -13, 2, 2);
    ctx.restore();
  }

  // ── Fauna: seagulls overhead, fish below the surface ──────────────
  // They start drifting in after half a minute of real time, so the toy
  // gains some life if you leave the page open.
  const FAUNA_AFTER = 30; // seconds
  const fauna = {
    seagulls: [],
    fish: [],
    lastGull: 0,
    lastFish: 0,
  };

  function updateFauna(t, dt) {
    if (t < FAUNA_AFTER) return;

    if (fauna.seagulls.length < 4 && t - fauna.lastGull > 6 + Math.random() * 7) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      fauna.seagulls.push({
        x: dir > 0 ? -20 : W + 20,
        y: heliCruiseY - 30 + Math.random() * 36,
        vx: dir * (16 + Math.random() * 14),
        wingT: Math.random() * Math.PI,
        dir,
      });
      fauna.lastGull = t;
    }
    if (fauna.fish.length < 4 && t - fauna.lastFish > 5 + Math.random() * 6) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      fauna.fish.push({
        x: dir > 0 ? -16 : W + 16,
        y: waterY + 12 + Math.random() * (H - waterY - 22),
        vx: dir * (12 + Math.random() * 10),
        tailT: 0,
        bobBase: 0,
        dir,
      });
      fauna.lastFish = t;
    }

    fauna.seagulls = fauna.seagulls.filter((s) => {
      s.x += s.vx * dt;
      s.y += Math.sin(t * 0.6 + s.x * 0.02) * 0.15;
      s.wingT += dt * (4 + Math.abs(s.vx) * 0.05);
      return s.x > -40 && s.x < W + 40;
    });
    fauna.fish = fauna.fish.filter((f) => {
      f.x += f.vx * dt;
      f.tailT += dt * 9;
      f.bobBase += dt;
      return f.x > -30 && f.x < W + 30;
    });
  }

  function drawSeagulls() {
    ctx.strokeStyle = "rgba(215, 234, 217, 0.55)";
    ctx.lineWidth = 1.1;
    fauna.seagulls.forEach((s) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.dir, 1);
      const flap = (Math.sin(s.wingT) + 1) * 0.5; // 0..1
      const wingDip = -3 - flap * 4;
      ctx.beginPath();
      ctx.moveTo(-9, 1);
      ctx.quadraticCurveTo(-4, wingDip, 0, 0.5);
      ctx.quadraticCurveTo(4, wingDip, 9, 1);
      ctx.stroke();
      // tiny head
      ctx.beginPath();
      ctx.moveTo(0, 0.5);
      ctx.lineTo(2.5, 0.5);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawFish() {
    ctx.strokeStyle = "rgba(130, 200, 255, 0.55)";
    ctx.fillStyle = "rgba(91, 157, 255, 0.18)";
    ctx.lineWidth = 1;
    fauna.fish.forEach((f) => {
      ctx.save();
      ctx.translate(f.x, f.y + Math.sin(f.bobBase * 1.4) * 1.2);
      ctx.scale(f.dir, 1);
      // body
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // tail
      const wag = Math.sin(f.tailT) * 1.6;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-10, -2 + wag);
      ctx.lineTo(-10, 2 + wag);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // eye
      ctx.fillStyle = "rgba(215, 234, 217, 0.7)";
      ctx.beginPath();
      ctx.arc(3, -0.5, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(91, 157, 255, 0.18)";
      ctx.restore();
    });
  }

  // ── Solar system ──────────────────────────────────────────────────
  // A sun and three planets on tilted orbits, each planet flying the flag
  // of an agent harness. Planets behind the sun are drawn before it and
  // shrink a little, so the orbits read as a disc seen from above.
  function loadLogo(src) {
    const img = new Image();
    img.src = src;
    return img;
  }
  const planets = [
    { color: "#d97757", r: 8,   orbit: 0.42, speed: 0.34, phase: 0.6, logo: loadLogo("/logos/claude-code.svg?v=1") },
    { color: "#5b9dff", r: 11,  orbit: 0.7,  speed: 0.21, phase: 2.9, logo: loadLogo("/logos/hermes.png?v=1") },
    { color: "#9a9696", r: 9.5, orbit: 0.97, speed: 0.13, phase: 4.6, logo: loadLogo("/logos/opencode.svg?v=1") },
  ];

  function solarGeometry() {
    const cx = W / 2;
    const cy = skyBand / 2 + 8;
    // The flag flies to the right of its planet, so keep it inside the frame.
    const maxRx = W / 2 - 42;
    // Leave room above the far side of the outer orbit for its flag.
    const tilt = Math.max(0.2, Math.min(0.38, (skyBand / 2 - 44) / maxRx));
    return { cx, cy, maxRx, tilt };
  }

  function drawOrbits(g) {
    ctx.save();
    ctx.strokeStyle = "rgba(130, 244, 163, 0.13)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    planets.forEach((p) => {
      const rx = g.maxRx * p.orbit;
      ctx.beginPath();
      ctx.ellipse(g.cx, g.cy, rx, rx * g.tilt, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSun(g, t) {
    const pulse = 1 + Math.sin(t * 1.3) * 0.04;
    const halo = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, 34 * pulse);
    halo.addColorStop(0, "rgba(255, 210, 122, 0.35)");
    halo.addColorStop(1, "rgba(255, 180, 84, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(g.cx - 3, g.cy - 3, 1, g.cx, g.cy, 12);
    body.addColorStop(0, "#fff2c4");
    body.addColorStop(1, "#ffb454");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFlag(x, y, logo, t, seed) {
    const poleH = 20, fw = 30, fh = 22;
    const top = y - poleH;
    ctx.strokeStyle = "rgba(215, 234, 217, 0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, top - 1);
    ctx.stroke();

    // The cloth ripples along its length; the free edge moves most.
    const wave = Math.sin(t * 3 + seed) * 1.6;
    ctx.fillStyle = "#e8efe9";
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + fw / 2, top - wave, x + fw, top + wave * 0.6);
    ctx.lineTo(x + fw, top + fh + wave * 0.6);
    ctx.quadraticCurveTo(x + fw / 2, top + fh - wave, x, top + fh);
    ctx.closePath();
    ctx.fill();

    if (logo.complete && logo.naturalWidth) {
      const s = 17;
      ctx.drawImage(logo, x + (fw - s) / 2, top + (fh - s) / 2 + wave * 0.15, s, s);
    }
  }

  function drawPlanet(g, p, t) {
    const a = p.phase + t * p.speed;
    const rx = g.maxRx * p.orbit;
    const x = g.cx + Math.cos(a) * rx;
    const y = g.cy + Math.sin(a) * rx * g.tilt;
    const depth = 0.84 + 0.16 * Math.sin(a); // far side is smaller
    const r = p.r * depth;

    const shade = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    shade.addColorStop(0, "rgba(255, 255, 255, 0.55)");
    shade.addColorStop(0.35, p.color);
    shade.addColorStop(1, "rgba(8, 16, 11, 0.9)");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    drawFlag(x, y - r + 1, p.logo, t, p.phase);
  }

  function drawSolarSystem(t) {
    const g = solarGeometry();
    drawOrbits(g);
    const behind = [], front = [];
    planets.forEach((p) => {
      (Math.sin(p.phase + t * p.speed) < 0 ? behind : front).push(p);
    });
    behind.forEach((p) => drawPlanet(g, p, t));
    drawSun(g, t);
    front.forEach((p) => drawPlanet(g, p, t));
  }

  let lastTime = performance.now();
  function frame(now) {
    const dtMs = Math.min(32, now - lastTime || 16.666);
    lastTime = now;
    const dt = dtMs / 1000;
    updateHeli(dt);
    Engine.update(engine, dtMs);

    const t = engine.timing.timestamp / 1000;
    updateFauna(t, dt);
    updateAmbience(t, dt);

    // Back to front: sky, then everything the water sits over, then the
    // water itself, then what floats on or stands above it.
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    drawSolarSystem(t);
    drawSeagulls();
    drawPillar();
    drawWaterBody();
    drawReflections(t);
    drawGodRays(t);
    drawFish();
    drawBubbles();
    drawWaterSurface(t);
    drawRipples();
    drawBuoy(t);
    drawPlatform(t);
    boxes.forEach(drawBox);
    drawSplashes();
    drawCarriedBox();
    drawHelicopter(t);
    requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fit();
      // Cached layers are sized to the old canvas — force a rebuild.
      backdrop = null;
      depthGrad = null;
      Body.setPosition(leftWall,   { x: -wallT / 2,    y: H / 2 });
      Body.setPosition(rightWall,  { x: W + wallT / 2, y: H / 2 });
      Body.setPosition(bottomWall, { x: W / 2,         y: H + wallT / 2 - 2 });
    }, 120);
  });

  requestAnimationFrame(frame);
};

// On wide screens the canvas is as tall as the text column beside it, and
// that column reflows when the web fonts arrive, so measure after they do.
(document.fonts ? document.fonts.ready : Promise.resolve()).then(startStacker);
