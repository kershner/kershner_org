export const waterControls = [
  {
    title: "Water Motion",
    controls: [
      { type: "range", path: "wall.waveScale", label: "Wave scale", min: 0.25, max: 3, step: 0.01 },
      { type: "range", path: "wall.waveStrength", label: "Wave strength", min: 0, max: 2, step: 0.01 },
      { type: "range", path: "wall.waveSpeed", label: "Wave speed", min: 0, max: 2.5, step: 0.01 },
      { type: "range", path: "wall.detailStrength", label: "Fine detail", min: 0, max: 2.5, step: 0.01 },
      { type: "range", path: "wall.rippleStrength", label: "Ripple strength", min: 0, max: 2.5, step: 0.01 },
    ],
  },
  {
    title: "Water Surface",
    controls: [
      { type: "range", path: "wall.surfaceDistortion", label: "Surface distortion", min: 0, max: 1.5, step: 0.01 },
      { type: "range", path: "wall.reflectionStrength", label: "Reflection", min: 0, max: 2, step: 0.01 },
      { type: "range", path: "wall.causticStrength", label: "Caustics", min: 0, max: 2, step: 0.01 },
      { type: "range", path: "wall.foamStrength", label: "Foam", min: 0, max: 1.5, step: 0.01 },
    ],
  },
  {
    title: "Water Color",
    controls: [
      { type: "checkbox", path: "wall.rotateColors", label: "Rotate colors" },
      { type: "range", path: "wall.colorTransitionSpeed", label: "Color speed", min: 0.01, max: 1, step: 0.01 },
      { type: "color", path: "wall.waterColor", label: "Water color" },
      { type: "color", path: "wall.deepColor", label: "Deep color" },
      { type: "color", path: "wall.highlightColor", label: "Highlight" },
      { type: "color", path: "wall.cursorColor", label: "Cursor glow" },
    ],
  },
];
