export const orbsControls = [
  {
    title: "Orbs",
    controls: [
      { type: "range", path: "wall.orbCount", label: "Orb count", min: 2, max: 12, step: 1, help: "How many orbs appear; new ones load in gradually." },
      { type: "range", path: "wall.orbScale", label: "Orb size", min: 0.65, max: 2.6, step: 0.01, help: "Scales all orbs and changes how crowded they feel." },
      { type: "range", path: "wall.spread", label: "Spread", min: 0.55, max: 1.65, step: 0.01, help: "Wider feels airier; lower feels more packed." },
      { type: "range", path: "wall.driftSpeed", label: "Drift speed", min: 0, max: 1.8, step: 0.01, help: "Controls the orbs' natural drifting motion." },
      { type: "range", path: "wall.collisionStrength", label: "Bounciness", min: 0, max: 1.35, step: 0.01, help: "Higher values make orb collisions livelier." },
      { type: "range", path: "wall.tapBounceAmount", label: "Tap bounce", min: 0, max: 1.8, step: 0.01, help: "Sets the subtle down-then-up tap feedback." },
      { type: "range", path: "wall.throwPower", label: "Throw power", min: 0.15, max: 1.8, step: 0.01, help: "Higher values make released drags carry more momentum." },
    ],
  },
  {
    title: "Light",
    controls: [
      { type: "range", path: "wall.lightIntensity", label: "Cursor light", min: 0, max: 1.4, step: 0.01, help: "Controls cursor-driven highlights and shadow drama." },
      { type: "range", path: "wall.lightDepth", label: "Light distance", min: 3.2, max: 8.5, step: 0.01, help: "Closer feels punchier; farther spreads light out." },
    ],
  },
  {
    title: "Colors",
    controls: [
      { type: "range", path: "wall.colorTransitionSpeed", label: "Color speed", min: 0.001, max: 0.025, step: 0.001, help: "Controls how quickly colors drift to the next palette." },
      { type: "checkbox", path: "global.rotateColors", label: "Rotate colors", help: "Allow this wall to follow portfolio color changes." },
      { type: "color", path: "wall.backgroundColor", label: "Background", help: "The wall builds the full gradient from this color." },
    ],
  },
];
