export const DEFAULT_CONFIG = {
  global: {
    zIndex: -1,
    showControls: true,
    fullscreen: false,
    opacity: 1,
    fadeInDuration: 2500,
    rotateColors: true,
    currentColor: "#75c94a",
    colorTransitionSpeed: 0.007,
    cycleWalls: true,
    randomizeSettingsOnCycle: false,
    wallCycleInterval: 30000,
  },
  interaction: {
    cursorRadius: 0.32,
    cursorStrength: 0.13,
    verticalPush: 0,
    pointerSmoothing: 0.3,
    touchBoost: 2,
    brushStrength: 0.09,
    wakeStrength: 0.34,
    wakeLag: 0.132,
    pulseStrength: 1.18,
    pulseRadius: 2.15,
    pulseDecay: 0.988,
    velocityStrength: 13.2,
  },
  wall: {},
};

export const GLOBAL_CONFIG_KEYS = Object.freeze(Object.keys(DEFAULT_CONFIG.global));
export const INTERACTION_CONFIG_KEYS = Object.freeze(Object.keys(DEFAULT_CONFIG.interaction));
export const CONFIG_ROOTS = Object.freeze(["global", "interaction", "wall"]);

const GLOBAL_PATHS = new Set(GLOBAL_CONFIG_KEYS);
const INTERACTION_PATHS = new Set(INTERACTION_CONFIG_KEYS);

export const GLOBAL_CONTROLS = [
  {
    title: "General",
    randomize: false,
    controls: [
      { type: "checkbox", path: "global.fullscreen", label: "Fullscreen", help: "Expands the wall to fill the viewport." },
      { type: "range", path: "global.opacity", label: "Opacity", min: 0, max: 1, step: 0.01, help: "Fades the whole wall without changing its settings." },
      { type: "checkbox", path: "global.cycleWalls", label: "Cycle walls", help: "Randomly rebuilds a wall after the selected interval." },
      { type: "checkbox", path: "global.randomizeSettingsOnCycle", label: "Randomize settings", help: "Randomizes settings before each cycled wall appears." },
      { type: "range", path: "global.wallCycleInterval", label: "Cycle interval", min: 1000, max: 60000, step: 500, help: "Milliseconds between random wall selections." },
      { type: "checkbox", path: "global.rotateColors", label: "Rotate colors", help: "Allows color changes to transition instead of snapping." },
    ],
  },
  {
    title: "Color",
    controls: [
      { type: "color", path: "global.currentColor", label: "Current color", help: "Shared color external code can update through the graphics wall API." },
      { type: "range", path: "global.colorTransitionSpeed", label: "Color speed", min: 0.001, max: 1, step: 0.001, help: "How quickly wall colors move toward the current color.", randomize: false },
    ],
  },
  {
    title: "Interaction",
    controls: [
      { type: "range", path: "interaction.cursorRadius", label: "Cursor radius", min: 0.05, max: 1.2, step: 0.01, help: "Larger values affect elements farther from the cursor." },
      { type: "range", path: "interaction.pulseStrength", label: "Click pulse", min: 0, max: 2, step: 0.01, help: "Controls click-generated ripples.", walls: ["grass", "water", "fabric"] },
      { type: "range", path: "interaction.pulseRadius", label: "Pulse radius", min: 0.15, max: 3, step: 0.01, help: "Controls the starting size of click pulses.", walls: ["grass", "water", "fabric"] },
      { type: "range", path: "interaction.pulseDecay", label: "Pulse decay", min: 0.85, max: 0.995, step: 0.001, help: "Higher values make click pulses linger.", walls: ["grass", "water", "fabric"] },
    ],
  },
];

// Resolves shorthand config keys to their full config path.
export function resolveTopLevelPath(key) {
  if (GLOBAL_PATHS.has(key)) return `global.${key}`;
  if (INTERACTION_PATHS.has(key)) return `interaction.${key}`;
  return null;
}

// Checks whether a dotted string points at a supported config root.
export function isConfigPath(path) {
  const [root, ...rest] = String(path || "").split(".");
  return CONFIG_ROOTS.includes(root) && rest.length > 0 && rest.every(Boolean);
}
