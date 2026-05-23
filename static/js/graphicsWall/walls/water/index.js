import { waterControls } from "./controls.js";
import { waterDefaults } from "./defaults.js";
import { WATER_WALL_FRAGMENT_SHADER, WATER_WALL_VERTEX_SHADER } from "./shaders.js";

const uniformPaths = {
  rotateColors: "wall.rotateColors",
  waterColor: "wall.waterColor",
  deepColor: "wall.deepColor",
  highlightColor: "wall.highlightColor",
  cursorColor: "wall.cursorColor",
  colorTransitionSpeed: "wall.colorTransitionSpeed",
  waveScale: "wall.waveScale",
  waveStrength: "wall.waveStrength",
  waveSpeed: "wall.waveSpeed",
  detailStrength: "wall.detailStrength",
  surfaceDistortion: "wall.surfaceDistortion",
  reflectionStrength: "wall.reflectionStrength",
  causticStrength: "wall.causticStrength",
  foamStrength: "wall.foamStrength",
  rippleStrength: "wall.rippleStrength",
};

export function createWaterWall({ THREE, scene, sharedUniforms, config }) {
  const wallConfig = config.wall;
  const interactionConfig = config.interaction;

  const uniforms = {
    ...sharedUniforms,
    uWaveScale: { value: wallConfig.waveScale },
    uWaveStrength: { value: wallConfig.waveStrength },
    uWaveSpeed: { value: wallConfig.waveSpeed },
    uDetailStrength: { value: wallConfig.detailStrength },
    uSurfaceDistortion: { value: wallConfig.surfaceDistortion },
    uReflectionStrength: { value: wallConfig.reflectionStrength },
    uCausticStrength: { value: wallConfig.causticStrength },
    uFoamStrength: { value: wallConfig.foamStrength },
    uRippleStrength: { value: wallConfig.rippleStrength },
    uCursorRadius: { value: interactionConfig.cursorRadius },
    uPulseStrength: { value: interactionConfig.pulseStrength },
    uPulseRadius: { value: interactionConfig.pulseRadius },
    uWaterColor: { value: new THREE.Color(wallConfig.waterColor) },
    uDeepColor: { value: new THREE.Color(wallConfig.deepColor) },
    uHighlightColor: { value: new THREE.Color(wallConfig.highlightColor) },
    uCursorColor: { value: new THREE.Color(wallConfig.cursorColor) },
  };

  const targetWaterColor = new THREE.Color(wallConfig.waterColor);
  const targetDeepColor = new THREE.Color(wallConfig.deepColor);
  const targetHighlightColor = new THREE.Color(wallConfig.highlightColor);
  const targetCursorColor = new THREE.Color(wallConfig.cursorColor);

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WATER_WALL_VERTEX_SHADER,
    fragmentShader: WATER_WALL_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  scene.add(mesh);

  function syncInteractionUniforms() {
    uniforms.uCursorRadius.value = config.interaction.cursorRadius;
    uniforms.uPulseStrength.value = config.interaction.pulseStrength;
    uniforms.uPulseRadius.value = config.interaction.pulseRadius;
  }

  function set(path, value) {
    const key = path.startsWith("wall.") ? path.slice(5) : path;

    if (key === "waterColor") {
      targetWaterColor.set(value);
      return true;
    }

    if (key === "deepColor") {
      targetDeepColor.set(value);
      return true;
    }

    if (key === "highlightColor") {
      targetHighlightColor.set(value);
      return true;
    }

    if (key === "cursorColor") {
      targetCursorColor.set(value);
      return true;
    }

    const uniformKey = `u${key[0].toUpperCase()}${key.slice(1)}`;

    if (uniforms[uniformKey]) {
      uniforms[uniformKey].value = value;
    }

    return true;
  }

  return {
    controls: waterControls,

    resolvePath(key) {
      return uniformPaths[key] || null;
    },

    set,

    update() {
      syncInteractionUniforms();
      uniforms.uWaterColor.value.lerp(targetWaterColor, config.wall.colorTransitionSpeed);
      uniforms.uDeepColor.value.lerp(targetDeepColor, config.wall.colorTransitionSpeed);
      uniforms.uHighlightColor.value.lerp(targetHighlightColor, config.wall.colorTransitionSpeed);
      uniforms.uCursorColor.value.lerp(targetCursorColor, config.wall.colorTransitionSpeed);
    },

    destroy() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}

createWaterWall.defaults = waterDefaults;
