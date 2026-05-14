// Tiny physics toy: a tower of boxes pre-stacked on a swaying platform.
// Drag them around. No score, no win state — just a fiddle activity.
(() => {
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

  // ── Boxes (stacked on the platform, Cloud Native at the bottom) ──
  const items = [
    { label: "Cloud Native", icon: "☁",  color: "#5b9dff" }, // bottom
    { label: "Agentic AI",   icon: "✦",  color: "#b48cff" },
    { label: "Compliance",   icon: "✓",  color: "#82f4a3" },
    { label: "FinOps",       icon: "$",  color: "#ffb454" },
    { label: "Sovereignty",  icon: "⬡",  color: "#ff7a92" },
    { label: "Management",   icon: "▤",  color: "#7ee0d1" }, // top
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
  const heliCruiseY = 48;
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
      }
    });
  });

  // Press "r" to restart the delivery from the beginning.
  function reset() {
    while (boxes.length) {
      const b = boxes.pop();
      Composite.remove(world, b);
    }
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

  function drawPillar() {
    const x = platform.position.x - pillarW / 2;
    const y = platformY + platformH / 2;
    ctx.fillStyle = "#0c1812";
    ctx.fillRect(x, y, pillarW, pillarH);
    ctx.strokeStyle = "#1c2c23";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, pillarW - 1, pillarH - 1);
  }

  function drawWater(t) {
    // Body of water
    ctx.fillStyle = "rgba(91, 157, 255, 0.14)";
    ctx.fillRect(0, waterY, W, H - waterY);
    // Deeper tint at the bottom
    const grad = ctx.createLinearGradient(0, waterY, 0, H);
    grad.addColorStop(0, "rgba(91, 157, 255, 0.06)");
    grad.addColorStop(1, "rgba(58, 90, 160, 0.22)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, waterY, W, H - waterY);

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
  }

  function drawPlatform() {
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

    ctx.save();
    ctx.translate(x, y);

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

    ctx.restore();
  }

  function drawCarriedBox() {
    if (heli.carrying === null) return;
    const item = items[heli.carrying];
    const x = heli.x;
    const y = heli.y + ropeLen + boxH / 2;
    drawBoxShape(x, y, 0, { ...item, w: boxW, h: boxH });
  }

  function drawBoxShape(x, y, angle, d) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    roundRect(-d.w / 2, -d.h / 2, d.w, d.h, 4);
    ctx.fillStyle = "#0c1812";
    ctx.fill();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = d.color;
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${d.icon}  ${d.label}`, 0, 0.5);
    ctx.restore();
  }

  function drawBox(body) {
    drawBoxShape(body.position.x, body.position.y, body.angle, body.gameData);
  }

  // ── Fauna: seagulls overhead, fish below the surface ──────────────
  // They start drifting in after one minute of real time, so the toy
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
        y: 18 + Math.random() * 36,
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

  let lastTime = performance.now();
  function frame(now) {
    const dtMs = Math.min(32, now - lastTime || 16.666);
    lastTime = now;
    const dt = dtMs / 1000;
    updateHeli(dt);
    Engine.update(engine, dtMs);

    const t = engine.timing.timestamp / 1000;
    updateFauna(t, dt);

    ctx.clearRect(0, 0, W, H);
    drawSeagulls();
    drawPillar();
    drawWater(t);
    drawFish();
    drawPlatform();
    boxes.forEach(drawBox);
    drawCarriedBox();
    drawHelicopter(t);
    requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fit();
      Body.setPosition(leftWall,   { x: -wallT / 2,    y: H / 2 });
      Body.setPosition(rightWall,  { x: W + wallT / 2, y: H / 2 });
      Body.setPosition(bottomWall, { x: W / 2,         y: H + wallT / 2 - 2 });
    }, 120);
  });

  requestAnimationFrame(frame);
})();
