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
  const platformW = Math.min(220, Math.max(160, W * 0.55));
  const platformH = 14;
  const platformY = H - 80;
  const platformBaseX = W / 2;
  const swayAmp = 9;
  const tiltAmp = 0.045;
  const platform = Bodies.rectangle(platformBaseX, platformY, platformW, platformH, {
    isStatic: true,
    friction: 0.22,
    frictionStatic: 0.3,
  });
  Composite.add(world, platform);

  // Water surface — anything below this gets wet.
  const waterY = H - 32;

  // Pillar under the platform (decorative).
  const pillarW = 26;
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

  const boxW = Math.min(140, Math.max(110, platformW * 0.75));
  const boxH = 24;

  // Stack rest positions (centered above the platform, base = platform top).
  function stackedRest(i) {
    const platformTop = platformY - platformH / 2;
    return {
      x: platformBaseX,
      y: platformTop - boxH / 2 - i * boxH,
    };
  }

  function makeBox(item, i) {
    const rest = stackedRest(i);
    const body = Bodies.rectangle(rest.x, rest.y, boxW, boxH, {
      restitution: 0.15,
      friction: 0.22,
      frictionStatic: 0.28,
      frictionAir: 0.006,
      density: 0.0038,
      chamfer: { radius: 4 },
    });
    body.gameData = { ...item, w: boxW, h: boxH };
    body.spawnIndex = i;
    Body.setVelocity(body, { x: 0, y: 0 });
    return body;
  }

  const boxes = items.map(makeBox);
  Composite.add(world, boxes);

  // Mouse / touch drag. Canvas backing store is W*dpr×H*dpr but the physics
  // world is W×H, so down-scale Matter's mouse mapping by 1/dpr.
  const mouse = Mouse.create(canvas);
  Mouse.setScale(mouse, { x: 1 / dpr, y: 1 / dpr });
  const mc = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, damping: 0.12, render: { visible: false } },
  });
  Composite.add(world, mc);

  // Don't let the page scroll while dragging on touch.
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

  // Press "r" to reset everything back into the stack.
  function reset() {
    boxes.forEach((b, i) => {
      Body.setPosition(b, stackedRest(i));
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
      Body.setAngle(b, 0);
    });
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

  function drawBox(body) {
    const d = body.gameData;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
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

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(32, now - lastTime || 16.666);
    lastTime = now;
    Engine.update(engine, dt);

    const t = engine.timing.timestamp / 1000;
    ctx.clearRect(0, 0, W, H);
    drawPillar();
    drawWater(t);
    drawPlatform();
    boxes.forEach(drawBox);
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
