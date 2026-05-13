// Tiny physics toy: stack the boxes on the swaying platform.
// No score, no win state — just a fiddle activity.
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

  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0009 } });
  const world = engine.world;

  // Side walls to keep boxes in play horizontally.
  const wallT = 80;
  const leftWall  = Bodies.rectangle(-wallT / 2,    H / 2, wallT, H * 4, { isStatic: true });
  const rightWall = Bodies.rectangle(W + wallT / 2, H / 2, wallT, H * 4, { isStatic: true });
  Composite.add(world, [leftWall, rightWall]);

  // Platform — kinematic, gently sways horizontally.
  const platformW = Math.min(220, W * 0.55);
  const platformH = 14;
  const platformY = H - 56;
  const platformBaseX = W / 2;
  const platform = Bodies.rectangle(platformBaseX, platformY, platformW, platformH, {
    isStatic: true,
    friction: 0.95,
    frictionStatic: 1.2,
  });
  Composite.add(world, platform);

  // Pillar under the platform (decorative — static, doesn't sway).
  const pillarW = 26;
  const pillarH = H - platformY - platformH / 2;

  // Boxes.
  const items = [
    { label: "Cloud Native", icon: "☁",  color: "#5b9dff" },
    { label: "Agentic AI",   icon: "✦",  color: "#b48cff" },
    { label: "Compliance",   icon: "✓",  color: "#82f4a3" },
    { label: "FinOps",       icon: "$",  color: "#ffb454" },
    { label: "Sovereignty",  icon: "⬡",  color: "#ff7a92" },
    { label: "Management",   icon: "▤",  color: "#7ee0d1" },
  ];
  const boxW = Math.min(120, Math.max(96, W * 0.30));
  const boxH = 28;

  function spawnSlot(i) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      x: 30 + col * (boxW + 6) + boxW / 2,
      y: -30 - row * (boxH + 10),
    };
  }

  function makeBox(item, i) {
    const slot = spawnSlot(i);
    const body = Bodies.rectangle(slot.x, slot.y, boxW, boxH, {
      restitution: 0.12,
      friction: 0.9,
      frictionAir: 0.012,
      density: 0.0045,
      chamfer: { radius: 4 },
    });
    body.gameData = { ...item, w: boxW, h: boxH };
    body.spawnSlot = i;
    return body;
  }

  let boxes = items.map(makeBox);
  Composite.add(world, boxes);

  // Mouse / touch drag.
  const mouse = Mouse.create(canvas);
  mouse.pixelRatio = 1;
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

  // Sway the platform.
  Events.on(engine, "beforeUpdate", () => {
    const t = engine.timing.timestamp / 1000;
    const x = platformBaseX + Math.sin(t * 0.55) * 26;
    Body.setPosition(platform, { x, y: platformY });
  });

  // Recycle anything that falls off-screen.
  Events.on(engine, "afterUpdate", () => {
    boxes.forEach((b) => {
      const off =
        b.position.y > H + 80 ||
        b.position.x < -80 ||
        b.position.x > W + 80;
      if (off) {
        const slot = spawnSlot(b.spawnSlot);
        Body.setPosition(b, slot);
        Body.setVelocity(b, { x: 0, y: 0 });
        Body.setAngularVelocity(b, 0);
        Body.setAngle(b, 0);
      }
    });
  });

  // Press "r" to reset positions.
  function reset() {
    boxes.forEach((b, i) => {
      const slot = spawnSlot(i);
      Body.setPosition(b, slot);
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
    // tiny base
    const baseW = pillarW + 18;
    ctx.fillStyle = "#11221a";
    ctx.fillRect(x - 9, H - 8, baseW, 8);
    ctx.strokeStyle = "#1c2c23";
    ctx.strokeRect(x - 9 + 0.5, H - 8 + 0.5, baseW - 1, 7);
  }

  function drawPlatform() {
    ctx.save();
    ctx.translate(platform.position.x, platform.position.y);
    ctx.rotate(platform.angle);
    // body
    ctx.fillStyle = "#0c1812";
    ctx.fillRect(-platformW / 2, -platformH / 2, platformW, platformH);
    ctx.strokeStyle = "#3ad07a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-platformW / 2 + 0.5, -platformH / 2 + 0.5, platformW - 1, platformH - 1);
    // top hatching
    ctx.strokeStyle = "rgba(58, 208, 122, 0.35)";
    ctx.lineWidth = 1;
    for (let x = -platformW / 2 + 6; x < platformW / 2 - 6; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, -platformH / 2 + 3);
      ctx.lineTo(x + 4, platformH / 2 - 3);
      ctx.stroke();
    }
    ctx.restore();

    // label tag floating just below
    ctx.save();
    ctx.translate(platform.position.x, platform.position.y + platformH / 2 + 14);
    ctx.fillStyle = "#0c1812";
    ctx.strokeStyle = "#3ad07a";
    ctx.lineWidth = 1;
    roundRect(-46, -9, 92, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3ad07a";
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▌ platform", 0, 0.5);
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

  function drawGrid() {
    // Subtle vertical guide where the platform rests.
    ctx.strokeStyle = "rgba(58, 208, 122, 0.08)";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(32, now - lastTime || 16.666);
    lastTime = now;
    Engine.update(engine, dt);

    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawPillar();
    drawPlatform();
    boxes.forEach(drawBox);
    requestAnimationFrame(frame);
  }

  // Re-fit on resize (and rebuild walls). Keeps things sensible if user resizes.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fit();
      Body.setPosition(leftWall,  { x: -wallT / 2,    y: H / 2 });
      Body.setPosition(rightWall, { x: W + wallT / 2, y: H / 2 });
    }, 120);
  });

  requestAnimationFrame(frame);
})();
