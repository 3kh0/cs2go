// Reconstruction of ParticleControls.UpdateMainMenuTopBar and
// ui_mainmenu_navbar_press.vpcf. The browser uses
// additive canvas squares in place of Source 2's glow_square_01 sprite shader.
const PANEL_WIDTH = 670;
const WORLD_WIDTH = 32 * 35;
// The native 256-particle capacity is not 256 opaque square sprites. Its glow
// shader/rope mask attenuate overlapping particles; draw each browser cell once.
const PRESS_COUNT = 64;

function curve(time: number, points: readonly (readonly [number, number])[]) {
  for (let i = 1; i < points.length; i++) {
    const [end, value] = points[i]!;
    const [start, previous] = points[i - 1]!;
    if (time <= end) return previous + ((time - start) / (end - start)) * (value - previous);
  }
  return points.at(-1)![1];
}

export function setupHeaderParticles(menu: HTMLElement) {
  const nav = menu.querySelector<HTMLElement>(".home-nav")!;
  const header = menu.querySelector<HTMLElement>(".home-header")!;
  const buttons = [...nav.querySelectorAll<HTMLButtonElement>("button")];
  for (const button of buttons) {
    const field = document.createElement("span");
    field.className = "nav-cell-field";
    field.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 24; index++) {
      const cell = document.createElement("i");
      cell.className = "nav-cell";
      cell.style.setProperty("--cell-duration", `${1800 + ((index * 739) % 2300)}ms`);
      cell.style.setProperty("--cell-delay", `${-((index * 997) % 4200)}ms`);
      cell.style.setProperty("--cell-peak", String(0.12 + ((index * 13) % 19) / 100));
      field.append(cell);
    }
    button.append(field);
  }

  const canvas = document.createElement("canvas");
  canvas.className = "header-navigation-particles";
  canvas.setAttribute("aria-hidden", "true");
  header.append(canvas);
  const context = canvas.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let selected: string | undefined;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };
  const retrigger = (id?: string) => {
    stop();
    if (!context || document.hidden || menu.classList.contains("hidden") || reducedMotion.matches)
      return;
    const button = buttons.find((candidate) => candidate.id === id);
    // Icon navigation has no selected tab. The user's idle home treatment stays
    // white on PLAY, while a selected tab uses the native cyan/green palette.
    if (!button) return;
    const headerRect = header.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const scale = headerRect.height / 64;
    const width = PANEL_WIDTH * scale;
    const scalar = width / WORLD_WIDTH;
    const center = buttonRect.x + buttonRect.width / 2 - (headerRect.width - width) / 2;
    const text = document.createRange();
    text.selectNodeContents(button.firstChild!);
    const halfWidth = text.getBoundingClientRect().width / 2 + 20 * scale;
    const ratio = Math.min(devicePixelRatio, 2);
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(headerRect.height * ratio);
    const start = performance.now();
    const draw = (now: number) => {
      if (document.hidden || menu.classList.contains("hidden") || reducedMotion.matches) {
        stop();
        return;
      }
      const age = (now - start) / 1000;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, headerRect.height);
      if (age >= 1) {
        frame = 0;
        return;
      }
      context.globalCompositeOperation = "lighter";
      // Native CP-change-age extent peaks at .047/.255 s, then contracts by1s.
      const extent = curve(age, [
        [0, 0],
        [0.047344, 0.93728],
        [0.255471, 0.97768],
        [0.482646, 0.24032],
        [1, 0],
      ]);
      const brightness = curve(age, [
        [0, 0.25],
        [0.039084, 0.80752],
        [0.122393, 1.23576],
        [0.242729, 0.79944],
        [0.5, 0.25],
        [1, 0],
      ]);
      const flip = curve(age, [
        [0, 0],
        [0.103753, 1],
        [0.249853, 0],
        [1, 0],
      ]);
      for (let index = 0; index < PRESS_COUNT; index++) {
        const column = index % 32;
        const row = Math.floor(index / 32) % 2;
        const depth = -100 + ((index * 71) % 151);
        const perspective = 470 / (470 + depth * age * Math.exp(-0.15 * age));
        const x = (column - 15.5) * 32 * scalar + width / 2;
        const distance = (Math.abs(x - center) * extent) / halfWidth;
        // Keep CP2.y's .1 opacity. Applying native HDR overbright to solid canvas
        // squares stacked four times saturated the whole selected label.
        const alpha = Math.max(0, 1 - distance) * brightness * 0.1;
        if (alpha <= 0) continue;
        const size = 20 * 2 * 0.75 * scalar * perspective;
        const y = headerRect.height / 2 + (row - 0.5) * 32 * scalar;
        context.globalAlpha = alpha;
        context.fillStyle = index % 2 ? "rgb(85,212,238)" : "rgb(0,255,212)";
        context.fillRect(x - size / 2, y - size / 2, size, Math.max(0.5, size * (1 - flip)));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
  };
  document.addEventListener("visibilitychange", stop);
  reducedMotion.addEventListener("change", stop);
  return {
    select(id?: string) {
      if (selected === id) return;
      selected = id;
      retrigger(id);
    },
    retrigger,
  };
}
