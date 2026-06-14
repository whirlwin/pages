// whirlwin.io — tiny enhancements. No framework, no tracking.

(() => {
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
