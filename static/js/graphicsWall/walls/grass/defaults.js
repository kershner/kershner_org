const isMobile = window.innerWidth < 768;

export const grassDefaults = {
  global: {
    opacity: isMobile ? 0.82 : 1,
  },
  wall: {
    bladeCount: isMobile ? 4500 : 12000,
    rotateColors: true,
    grassColor: "#75c94a",
    cursorColor: "#3a2e27",
    colorTransitionSpeed: 0.007,
    wind: 0.078,
    breezeChance: 1,
    widthMultiplier: isMobile ? 0.72 : 0.75,
    tipWidth: isMobile ? 0.52 : 0.38,
    heightMultiplier: isMobile ? 0.72 : 1,
    variation: isMobile ? 2 : 1.14,
    edgeSoftness: 0.15,
    fireflies: true,
    fireflyCount: 6,
    fireflyStrength: 0.98,
    fireflySize: 0.015,
    fireflySpeed: 0.12,
    fireflyFlicker: 1.0,
    fireflyDrift: 0.75,
    fireflyReflection: 0.85,
    fireflyReflectionRadius: 0.34,
  },
};
