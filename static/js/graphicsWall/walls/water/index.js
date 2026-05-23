import { waterControls } from "./controls.js";
import { waterDefaults } from "./defaults.js";
import {
  WATER_SIM_FRAGMENT_SHADER,
  WATER_SIM_VERTEX_SHADER,
  WATER_WALL_FRAGMENT_SHADER,
  WATER_WALL_VERTEX_SHADER,
} from "./shaders.js";

const uniformPaths = {
  rotateColors: "wall.rotateColors",
  waterColor: "wall.shallowColor",
  shallowColor: "wall.shallowColor",
  deepColor: "wall.deepColor",
  skyColor: "wall.skyColor",
  horizonColor: "wall.horizonColor",
  bankColor: "wall.bankColor",
  sunColor: "wall.sunColor",
  colorTransitionSpeed: "wall.colorTransitionSpeed",
  simulationSteps: "wall.simulationSteps",
  damping: "wall.damping",
  propagation: "wall.propagation",
  viscosity: "wall.viscosity",
  rippleStrength: "wall.rippleStrength",
  hoverRippleStrength: "wall.hoverRippleStrength",
  wakeRippleStrength: "wall.wakeRippleStrength",
  pondMotion: "wall.pondMotion",
  pondScale: "wall.pondScale",
  pondSpeed: "wall.pondSpeed",
  randomRippleStrength: "wall.randomRippleStrength",
  randomRippleFrequency: "wall.randomRippleFrequency",
  disturbanceStrength: "wall.disturbanceStrength",
  disturbanceFrequency: "wall.disturbanceFrequency",
  naturalChaos: "wall.naturalChaos",
  rippleVariety: "wall.rippleVariety",
  tinyRippleStrength: "wall.tinyRippleStrength",
  windAngle: "wall.windAngle",
  normalStrength: "wall.normalStrength",
  fineRippleStrength: "wall.fineRippleStrength",
  fineRippleScale: "wall.fineRippleScale",
  microRippleStrength: "wall.microRippleStrength",
  microRippleScale: "wall.microRippleScale",
  reflectionStrength: "wall.reflectionStrength",
  fresnelStrength: "wall.fresnelStrength",
  specularStrength: "wall.specularStrength",
  roughness: "wall.roughness",
  depthStrength: "wall.depthStrength",
  contrast: "wall.contrast",
  definition: "wall.definition",
  ringHighlightStrength: "wall.ringHighlightStrength",
  refractionStrength: "wall.refractionStrength",
  vignetteStrength: "wall.vignetteStrength",
  shorelineReflection: "wall.shorelineReflection",
  sunAngle: "wall.sunAngle",
};

export function createWaterWall({ THREE, scene, renderer, sharedUniforms, config }) {
  const wallConfig = config.wall;
  const interactionConfig = config.interaction;
  const resolution = Math.max(128, Math.min(1024, Number(wallConfig.simulationResolution) || 512));
  const texel = new THREE.Vector2(1 / resolution, 1 / resolution);

  const renderTargetOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  };

  let readTarget = new THREE.WebGLRenderTarget(resolution, resolution, renderTargetOptions);
  let writeTarget = new THREE.WebGLRenderTarget(resolution, resolution, renderTargetOptions);

  const simScene = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const simGeometry = new THREE.PlaneGeometry(2, 2);

  const simUniforms = {
    uState: { value: readTarget.texture },
    uTexel: { value: texel },
    uTime: sharedUniforms.uTime,
    uAspect: sharedUniforms.uAspect,
    uDamping: { value: wallConfig.damping },
    uPropagation: { value: wallConfig.propagation },
    uViscosity: { value: wallConfig.viscosity },
    uRippleStrength: { value: wallConfig.rippleStrength },
    uHoverRippleStrength: { value: wallConfig.hoverRippleStrength },
    uWakeRippleStrength: { value: wallConfig.wakeRippleStrength },
    uRandomRippleStrength: { value: wallConfig.randomRippleStrength },
    uRandomRippleFrequency: { value: wallConfig.randomRippleFrequency },
    uDisturbanceStrength: { value: wallConfig.disturbanceStrength },
    uDisturbanceFrequency: { value: wallConfig.disturbanceFrequency },
    uNaturalChaos: { value: wallConfig.naturalChaos },
    uRippleVariety: { value: wallConfig.rippleVariety },
    uTinyRippleStrength: { value: wallConfig.tinyRippleStrength },
    uCursorRadius: { value: interactionConfig.cursorRadius },
    uPointerDown: sharedUniforms.uPointerDown,
    uClickPulse: sharedUniforms.uClickPulse,
    uPulseStrength: { value: interactionConfig.pulseStrength },
    uPulseRadius: { value: interactionConfig.pulseRadius },
    uPointerSmooth: sharedUniforms.uPointerSmooth,
    uPointerVelocity: sharedUniforms.uPointerVelocity,
    uWakePointer: sharedUniforms.uWakePointer,
    uPulsePointer: sharedUniforms.uPulsePointer,
  };

  const simMaterial = new THREE.ShaderMaterial({
    uniforms: simUniforms,
    vertexShader: WATER_SIM_VERTEX_SHADER,
    fragmentShader: WATER_SIM_FRAGMENT_SHADER,
    depthWrite: false,
    depthTest: false,
  });

  const simMesh = new THREE.Mesh(simGeometry, simMaterial);
  simScene.add(simMesh);

  const renderUniforms = {
    ...sharedUniforms,
    uWaterState: { value: readTarget.texture },
    uTexel: { value: texel },
    uPondMotion: { value: wallConfig.pondMotion },
    uPondScale: { value: wallConfig.pondScale },
    uPondSpeed: { value: wallConfig.pondSpeed },
    uWindAngle: { value: wallConfig.windAngle },
    uNormalStrength: { value: wallConfig.normalStrength },
    uFineRippleStrength: { value: wallConfig.fineRippleStrength },
    uFineRippleScale: { value: wallConfig.fineRippleScale },
    uMicroRippleStrength: { value: wallConfig.microRippleStrength },
    uMicroRippleScale: { value: wallConfig.microRippleScale },
    uReflectionStrength: { value: wallConfig.reflectionStrength },
    uFresnelStrength: { value: wallConfig.fresnelStrength },
    uSpecularStrength: { value: wallConfig.specularStrength },
    uRoughness: { value: wallConfig.roughness },
    uDepthStrength: { value: wallConfig.depthStrength },
    uContrast: { value: wallConfig.contrast },
    uDefinition: { value: wallConfig.definition },
    uRingHighlightStrength: { value: wallConfig.ringHighlightStrength },
    uRefractionStrength: { value: wallConfig.refractionStrength },
    uVignetteStrength: { value: wallConfig.vignetteStrength },
    uShorelineReflection: { value: wallConfig.shorelineReflection },
    uSunAngle: { value: wallConfig.sunAngle },
    uShallowColor: { value: new THREE.Color(wallConfig.shallowColor || wallConfig.waterColor) },
    uDeepColor: { value: new THREE.Color(wallConfig.deepColor) },
    uSkyColor: { value: new THREE.Color(wallConfig.skyColor) },
    uHorizonColor: { value: new THREE.Color(wallConfig.horizonColor) },
    uBankColor: { value: new THREE.Color(wallConfig.bankColor) },
    uSunColor: { value: new THREE.Color(wallConfig.sunColor) },
  };

  const colorTargets = {
    shallowColor: new THREE.Color(wallConfig.shallowColor || wallConfig.waterColor),
    deepColor: new THREE.Color(wallConfig.deepColor),
    skyColor: new THREE.Color(wallConfig.skyColor),
    horizonColor: new THREE.Color(wallConfig.horizonColor),
    bankColor: new THREE.Color(wallConfig.bankColor),
    sunColor: new THREE.Color(wallConfig.sunColor),
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: renderUniforms,
    vertexShader: WATER_WALL_VERTEX_SHADER,
    fragmentShader: WATER_WALL_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  scene.add(mesh);

  function swapTargets() {
    const next = readTarget;
    readTarget = writeTarget;
    writeTarget = next;
    simUniforms.uState.value = readTarget.texture;
    renderUniforms.uWaterState.value = readTarget.texture;
  }

  function clearTargets() {
    const previousClearColor = renderer.getClearColor(new THREE.Color());
    const previousClearAlpha = renderer.getClearAlpha();

    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(readTarget);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(writeTarget);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(null);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
  }

  function syncInteractionUniforms() {
    simUniforms.uCursorRadius.value = config.interaction.cursorRadius;
    simUniforms.uPulseStrength.value = config.interaction.pulseStrength;
    simUniforms.uPulseRadius.value = config.interaction.pulseRadius;
  }

  function set(path, value) {
    const key = path.startsWith("wall.") ? path.slice(5) : path;

    if (key === "waterColor" || key === "shallowColor") {
      colorTargets.shallowColor.set(value);
      config.wall.shallowColor = value;
      config.wall.waterColor = value;
      return true;
    }

    if (colorTargets[key]) {
      colorTargets[key].set(value);
      return true;
    }

    const uniformKey = `u${key[0].toUpperCase()}${key.slice(1)}`;

    if (simUniforms[uniformKey]) {
      simUniforms[uniformKey].value = value;
    }

    if (renderUniforms[uniformKey]) {
      renderUniforms[uniformKey].value = value;
    }

    return true;
  }

  clearTargets();

  return {
    controls: waterControls,

    resolvePath(key) {
      return uniformPaths[key] || null;
    },

    set,

    update() {
      syncInteractionUniforms();

      const previousRenderTarget = renderer.getRenderTarget();
      const steps = Math.max(1, Math.min(6, Math.round(config.wall.simulationSteps || 1)));

      for (let i = 0; i < steps; i++) {
        simUniforms.uState.value = readTarget.texture;
        renderer.setRenderTarget(writeTarget);
        renderer.render(simScene, simCamera);
        swapTargets();
      }

      renderer.setRenderTarget(previousRenderTarget);

      renderUniforms.uShallowColor.value.lerp(colorTargets.shallowColor, config.wall.colorTransitionSpeed);
      renderUniforms.uDeepColor.value.lerp(colorTargets.deepColor, config.wall.colorTransitionSpeed);
      renderUniforms.uSkyColor.value.lerp(colorTargets.skyColor, config.wall.colorTransitionSpeed);
      renderUniforms.uHorizonColor.value.lerp(colorTargets.horizonColor, config.wall.colorTransitionSpeed);
      renderUniforms.uBankColor.value.lerp(colorTargets.bankColor, config.wall.colorTransitionSpeed);
      renderUniforms.uSunColor.value.lerp(colorTargets.sunColor, config.wall.colorTransitionSpeed);
    },

    destroy() {
      scene.remove(mesh);
      simScene.remove(simMesh);
      geometry.dispose();
      material.dispose();
      simGeometry.dispose();
      simMaterial.dispose();
      readTarget.dispose();
      writeTarget.dispose();
    },
  };
}

createWaterWall.defaults = waterDefaults;
