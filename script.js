// whirlwin.io — tiny enhancements. No framework, no tracking.

(() => {
  // ── Typing animation on the hero command line ──────────────────────
  const el = document.getElementById("typed");
  if (el) {
    const phrases = [
      "whirlwin --help",
      "ssh me@whirlwin.io",
      "cat ~/.about",
      "make things && ship",
      "echo \"hi.\""
    ];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      el.textContent = phrases[0];
    } else {
      let p = 0, i = 0, deleting = false;
      const tick = () => {
        const current = phrases[p];
        if (!deleting) {
          el.textContent = current.slice(0, ++i);
          if (i === current.length) {
            deleting = true;
            return setTimeout(tick, 2200);
          }
        } else {
          el.textContent = current.slice(0, --i);
          if (i === 0) {
            deleting = false;
            p = (p + 1) % phrases.length;
          }
        }
        setTimeout(tick, deleting ? 35 : 70 + Math.random() * 60);
      };
      // delay so the rise animation can play first
      setTimeout(tick, 600);
    }
  }

  // ── Clock in the status bar ────────────────────────────────────────
  const clock = document.getElementById("clock");
  if (clock) {
    const pad = (n) => String(n).padStart(2, "0");
    const draw = () => {
      const d = new Date();
      clock.textContent =
        `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
    };
    draw();
    setInterval(draw, 1000);
  }

  // ── Year ───────────────────────────────────────────────────────────
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // ── A tiny easter egg: konami-style "vim" types
  let buf = "";
  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-3);
    if (buf === "vim") {
      document.documentElement.animate(
        [{ filter: "hue-rotate(0deg)" }, { filter: "hue-rotate(360deg)" }],
        { duration: 1200, iterations: 1 }
      );
      buf = "";
    }
  });
})();
