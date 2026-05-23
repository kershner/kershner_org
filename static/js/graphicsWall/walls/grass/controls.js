export const grassControls = [
  {
    title: "Grass Wind",
    controls: [
      { type: "range", path: "wall.wind", label: "Wind", min: 0, max: 0.12, step: 0.001, help: "Constant swaying strength." },
      { type: "range", path: "wall.breezeChance", label: "Breeze chance", min: 0, max: 1, step: 0.01, help: "How often gusts appear." },
    ],
  },
  {
    title: "Blade Shape",
    controls: [
      { type: "range", path: "wall.bladeCount", label: "Blade count", min: 300, max: 12000, step: 100, help: "How dense the grass is." },
      { type: "range", path: "wall.widthMultiplier", label: "Blade width", min: 0.3, max: 3, step: 0.01 , help: "Blade thickness." },
      { type: "range", path: "wall.tipWidth", label: "Tip width", min: 0.02, max: 0.6, step: 0.01 , help: "Blade tips." },
      { type: "range", path: "wall.heightMultiplier", label: "Blade height", min: 0.3, max: 3, step: 0.01 , help: "Blade length." },
      { type: "range", path: "wall.variation", label: "Variation", min: 0, max: 2, step: 0.01 , help: "Random shape." },
      { type: "range", path: "wall.edgeSoftness", label: "Edge softness", min: 0.15, max: 0.75, step: 0.01 , help: "Softer edges." },
    ],
  },
  {
    title: "Grass Color",
    controls: [
      { type: "range", path: "wall.colorTransitionSpeed", label: "Color speed", min: 0.01, max: 1, step: 0.01 , help: "Palette speed." },
      { type: "checkbox", path: "global.rotateColors", label: "Rotate colors", help: "Allow this wall to follow portfolio color changes." },
      { type: "color", path: "wall.grassColor", label: "Grass color" , help: "Base tint." },
      { type: "color", path: "wall.cursorColor", label: "Cursor glow" , help: "Pointer color." },
    ],
  },
  {
    title: "Fireflies",
    controls: [
      { type: "checkbox", path: "wall.fireflies", label: "Fireflies" , help: "Toggle bugs." },
      { type: "range", path: "wall.fireflyCount", label: "Firefly count", min: 0, max: 16, step: 1 , help: "How many." },
      { type: "range", path: "wall.fireflyStrength", label: "Firefly strength", min: 0, max: 2.5, step: 0.01 , help: "Glow power." },
      { type: "range", path: "wall.fireflySize", label: "Firefly size", min: 0.015, max: 0.22, step: 0.001 , help: "Bug size." },
      { type: "range", path: "wall.fireflySpeed", label: "Firefly speed", min: 0, max: 2, step: 0.01 , help: "Flight speed." },
      { type: "range", path: "wall.fireflyFlicker", label: "Firefly flicker", min: 0, max: 8, step: 0.1 , help: "Blink rate." },
      { type: "range", path: "wall.fireflyDrift", label: "Firefly drift", min: 0, max: 0.8, step: 0.01 , help: "Wander amount." },
      { type: "range", path: "wall.fireflyReflection", label: "Grass reflection", min: 0, max: 2, step: 0.01 , help: "Glow on grass." },
      { type: "range", path: "wall.fireflyReflectionRadius", label: "Reflection radius", min: 0.05, max: 0.8, step: 0.01 , help: "Glow spread." },
    ],
  },
];
