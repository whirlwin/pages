// Tiny physics toy: pull the boxes off the right-side wall shelves
// and stack them on the swaying platform. No score, no win state.
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

  // Side walls keep boxes in play horizontally.
  const wallT = 80;
  const leftWall  = Bodies.rectangle(-wallT / 2,    H / 2, wallT, H * 4, { isStatic: true });
  const rightWall = Bodies.rectangle(W + wallT / 2, H / 2, wallT, H * 4, { isStatic: true });
  Composite.add(world, [leftWall, rightWall]);

  // Platform — kinematic, sways gently. Sits on the left side now.
  const platformW = Math.min(180, Math.max(140, W * 0.45));
  const platformH = 14;
  const platformY = H - 56;
  const platformBaseX = Math.max(110, W * 0.30);
  const swayAmp = 18;
  const platform = Bodies.rectangle(platformBaseX, platformY, platformW, platformH, {
    isStatic: true,
    friction: 0.95,
    frictionStatic: 1.2,
  });
  Composite.add(world, platform);

  // Pillar under the platform (decorative).
  const pillarW = 26;
  const pillarH = H - platformY - platformH / 2;

  // ── Shelves on the right wall ─────────────────────────────────────
  const items = [
    { label: "Cloud Native", icon: "☁",  color: "#5b9dff" },
    { label: "Agentic AI",   icon: "✦",  color: "#b48cff" },
    { label: "Compliance",   icon: "✓",  color: "#82f4a3" },
    { label: "FinOps",       icon: "$",  color: "#ffb454" },
    { label: "Sovereignty",  icon: "⬡",  color: "#ff7a92" },
    { label: "Management",   icon: "▤",  color: "#7ee0d1" },
  ];

  const boxW = Math.min(120, Math.max(100, (W - platformBaseX - platformW / 2) * 0.9));
  const boxH = 22;
  const shelfH = 4;
  const shelfW = boxW + 16;
  const shelfRightEdge = W - 6;
  const shelfCenterX = shelfRightEdge - shelfW / 2;
  const topPad = 24;
  const bottomLimit = H - 30;
  const rowGap = Math.min(48, Math.max(40, (bottomLimit - topPad) / items.length));

  const shelves = items.map((_, i) => {
    const y = topPad + i * rowGap;
    return Bodies.rectangle(shelfCenterX, y, shelfW, shelfH, {
      isStatic: true,
      friction: 0.9,
      frictionStatic: 1.2,
    });
  });
  Composite.add(world, shelves);

  function shelfRestY(i) {
    return topPad + i * rowGap - shelfH / 2 - boxH / 2;
  }

  function makeBox(item, i) {
    const body = Bodies.rectangle(shelfCenterX, shelfRestY(i), boxW, boxH, {
      restitution: 0.08,
      friction: 0.88,
      frictionAir: 0.014,
      density: 0.005,
      chamfer: { radius: 4 },
    });
    body.gameData = { ...item, w: boxW, h: boxH };
    body.spawnSlot = i;
    return body;
  }

  const boxes = items.map(makeBox);
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
    const x = platformBaseX + Math.sin(t * 0.55) * swayAmp;
    Body.setPosition(platform, { x, y: platformY });
  });

  // Anything that falls off — return it to its shelf.
  Events.on(engine, "afterUpdate", () => {
    boxes.forEach((b) => {
      const off =
        b.position.y > H + 80 ||
        b.position.x < -80 ||
        b.position.x > W + 80;
      if (off) {
        Body.setPosition(b, { x: shelfCenterX, y: shelfRestY(b.spawnSlot) });
        Body.setVelocity(b, { x: 0, y: 0 });
        Body.setAngularVelocity(b, 0);
        Body.setAngle(b, 0);
      }
    });
  });

  // Press "r" to reset everything back onto the shelves.
  function reset() {
    boxes.forEach((b, i) => {
      Body.setPosition(b, { x: shelfCenterX, y: shelfRestY(i) });
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

  function drawShelfMount() {
    // Vertical "wall" the shelves are bolted to.
    const x = shelfRightEdge;
    ctx.strokeStyle = "rgba(58, 208, 122, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, topPad - 10);
    ctx.lineTo(x + 0.5, bottomLimit + 6);
    ctx.stroke();

    // Tick marks on the wall.
    ctx.strokeStyle = "rgba(58, 208, 122, 0.18)";
    ctx.lineWidth = 1;
    for (let y = topPad - 10; y < bottomLimit + 6; y += 6) {
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 0.5);
      ctx.lineTo(x + 0.5, y + 0.5);
      ctx.stroke();
    }
  }

  function drawShelves() {
    shelves.forEach((s) => {
      ctx.fillStyle = "#0c1812";
      ctx.fillRect(s.position.x - shelfW / 2, s.position.y - shelfH / 2, shelfW, shelfH);
      ctx.strokeStyle = "#3ad07a";
      ctx.lineWidth = 1.25;
      ctx.strokeRect(
        s.position.x - shelfW / 2 + 0.5,
        s.position.y - shelfH / 2 + 0.5,
        shelfW - 1,
        shelfH - 1
      );
      // small bracket triangle on the right (attaches to wall)
      ctx.fillStyle = "rgba(58, 208, 122, 0.4)";
      ctx.beginPath();
      ctx.moveTo(s.position.x + shelfW / 2, s.position.y - shelfH / 2);
      ctx.lineTo(s.position.x + shelfW / 2 + 6, s.position.y + shelfH / 2);
      ctx.lineTo(s.position.x + shelfW / 2, s.position.y + shelfH / 2);
      ctx.closePath();
      ctx.fill();
    });
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
    ctx.font = '500 10.5px "JetBrains Mono", ui-monospace, monospace';
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

    ctx.clearRect(0, 0, W, H);
    drawShelfMount();
    drawShelves();
    drawPillar();
    drawPlatform();
    boxes.forEach(drawBox);
    requestAnimationFrame(frame);
  }

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
