export const fabricControls = [
  {
    title: "Fabric",
    controls: [
      { type: "range", path: "wall.height", label: "Curtain length", min: 1.35, max: 2.08, step: 0.01, help: "Controls how far the curtain hangs down." },
      { type: "select", path: "wall.pinStyle", label: "Pin style", options: [
        { value: "top", label: "Full top" },
        { value: "tabs", label: "Hanging tabs" },
        { value: "corners", label: "Corners only" },
        { value: "center", label: "Center pinch" },
        { value: "clothesline", label: "Clothesline" },
        { value: "side", label: "Side drape" },
        { value: "fourCorners", label: "Four corners" },
        { value: "randomTacks", label: "Random tacks" },
      ], help: "Changes how the fabric is attached along the top edge." },
      { type: "range", path: "wall.gravity", label: "Weight", min: 0.15, max: 1.6, step: 0.01, help: "How heavily the fabric hangs." },
      { type: "range", path: "wall.stiffness", label: "Tension", min: 0.45, max: 1, step: 0.01, help: "How tightly the fabric holds together." },
      { type: "range", path: "wall.foldStrength", label: "Motion", min: 0, max: 0.16, step: 0.001, help: "How much the fabric breathes and folds on its own." },
      { type: "range", path: "wall.windStrength", label: "Wind", min: 0, max: 0.09, step: 0.001, help: "Directional drifting movement across the fabric." },
      { type: "range", path: "wall.sheenStrength", label: "Gloss", min: 0.15, max: 1.35, step: 0.01, help: "Silky highlight strength." },
    ],
  },
  {
    title: "Cutting",
    controls: [
      { type: "checkbox", path: "wall.tearEnabled", label: "Click cuts fabric", help: "Breaks simulated threads and opens a slit." },
      { type: "range", path: "wall.cutStrength", label: "Cut strength", min: 0, max: 1, step: 0.01, help: "How wide and forceful cuts feel." },
      { type: "checkbox", path: "wall.selfHeal", label: "Self-heal cuts", help: "Rewinds cuts after a short delay." },
      { type: "range", path: "wall.healDelay", label: "Self heal time", min: 0, max: 8, step: 0.1, help: "Seconds before a cut starts healing." },
    ],
  },
  {
    title: "Color",
    controls: [
      { type: "color", path: "wall.baseColor", label: "Fabric color", help: "Main fabric color." },
    ],
  },
];
