import { createResourceTracker } from "../../core/resources.js";
import { applyColorUniforms, createUniformPathResolver, makeConfigUniforms, syncUniformValues } from "../../core/wallUtils.js";
import { createGrassDefaults } from "./defaults.js";
import { createGrassGeometry } from "./geometry.js";
import {
  FIREFLY_FRAGMENT_SHADER,
  FIREFLY_VERTEX_SHADER,
  GRASS_WALL_FRAGMENT_SHADER,
  GRASS_WALL_VERTEX_SHADER,
} from "./shaders.js";

const breezeSettings = {
  minRadius: 0.22,
  maxRadius: 0.78,
  minStrength: 0.75,
  maxStrength: 2.75,
  minLifetime: 1500,
  maxLifetime: 3200,
  minDriftSpeed: 0.24,
  maxDriftSpeed: 0.9,
  minSpringTail: 1.15,
  maxSpringTail: 2.35,
};

const wallUniformKeys = [
  "wind",
  "widthMultiplier",
  "tipWidth",
  "heightMultiplier",
  "variation",
  "edgeSoftness",
  "fireflies",
  "fireflyCount",
  "fireflyStrength",
  "fireflySize",
  "fireflySpeed",
  "fireflyFlicker",
  "fireflyDrift",
  "fireflyReflection",
  "fireflyReflectionRadius",
];

const interactionUniformKeys = [
  "cursorRadius",
  "cursorStrength",
  "verticalPush",
  "touchBoost",
  "brushStrength",
  "wakeStrength",
  "pulseStrength",
  "velocityStrength",
  "pulseRadius",
];

const uniformPaths = createUniformPathResolver([
  "breezeChance",
  "grassColor",
  "cursorColor",
  "bladeCount",
  ...wallUniformKeys,
]);

// Returns a random number inside a range.
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Shapes the rise and decay of one breeze gust.
function gustEnvelope(t, springTail) {
  if (t < 1) {
    return Math.sin(t * Math.PI);
  }

  const tail = Math.min((t - 1) / springTail, 1);
  return -Math.sin(tail * Math.PI * 4.5) * Math.exp(-tail * 4.2) * 0.42;
}

// Creates the grass wall and owns its meshes and materials.
export function createGrassWall({ THREE, scene, sharedUniforms, config }) {
  const resources = createResourceTracker();
  const baseGeometry = resources.track(new THREE.PlaneGeometry(1, 1, 1, 8));
  baseGeometry.translate(0, 0.5, 0);

  const wallConfig = config.wall;
  const interactionConfig = config.interaction;

  const uniforms = {
    ...sharedUniforms,
    ...makeConfigUniforms(wallConfig, wallUniformKeys),
    ...makeConfigUniforms(interactionConfig, interactionUniformKeys),
    uFireflies: { value: wallConfig.fireflies ? 1 : 0 },
    uBreeze: { value: 0 },
    uBreezeGustA: { value: new THREE.Vector4(9, 9, 0, 0) },
    uBreezeGustB: { value: new THREE.Vector4(9, 9, 0, 0) },
    uBreezeGustC: { value: new THREE.Vector4(9, 9, 0, 0) },
    uBreezeGustD: { value: new THREE.Vector4(9, 9, 0, 0) },
    uGrassColor: { value: new THREE.Color(wallConfig.grassColor) },
    uCursorColor: { value: new THREE.Color(wallConfig.cursorColor) },
  };

  const targetGrassColor = new THREE.Color(wallConfig.grassColor);
  const targetCursorColor = new THREE.Color(wallConfig.cursorColor);

  const material = resources.track(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: GRASS_WALL_VERTEX_SHADER,
    fragmentShader: GRASS_WALL_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  }));

  const fireflyUniforms = {
    uTime: uniforms.uTime,
    uAspect: uniforms.uAspect,
    uCursorColor: uniforms.uCursorColor,
    uFireflies: uniforms.uFireflies,
    uFireflyCount: uniforms.uFireflyCount,
    uFireflyStrength: uniforms.uFireflyStrength,
    uFireflySize: uniforms.uFireflySize,
    uFireflySpeed: uniforms.uFireflySpeed,
    uFireflyFlicker: uniforms.uFireflyFlicker,
    uFireflyDrift: uniforms.uFireflyDrift,
  };

  const fireflyGeometry = resources.track(new THREE.PlaneGeometry(2, 2));
  const fireflyMaterial = resources.track(new THREE.ShaderMaterial({
    uniforms: fireflyUniforms,
    vertexShader: FIREFLY_VERTEX_SHADER,
    fragmentShader: FIREFLY_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }));

  const fireflyPlane = new THREE.Mesh(fireflyGeometry, fireflyMaterial);
  fireflyPlane.renderOrder = 10;
  scene.add(fireflyPlane);

  let grass = null;
  let grassGeometry = null;
  let breezeDirection = 1;
  let breezeGusts = [];
  let nextDirectionChangeAt = 0;

  // Rebuilds instanced grass geometry when blade count changes.
  function rebuildGrass(bladeCount) {
    if (grass) {
      scene.remove(grass);
      grassGeometry.dispose();
    }

    grassGeometry = createGrassGeometry({ THREE, baseGeometry, bladeCount });
    grass = new THREE.Mesh(grassGeometry, material);
    grass.renderOrder = 1;
    scene.add(grass);
  }

  // Creates one breeze gust with randomized radius and lifetime.
  function randomGustPacket(direction, time) {
    const radius = randomBetween(breezeSettings.minRadius, breezeSettings.maxRadius);
    const strength = randomBetween(breezeSettings.minStrength, breezeSettings.maxStrength);
    const lifetime = randomBetween(breezeSettings.minLifetime, breezeSettings.maxLifetime);
    const springTail = randomBetween(breezeSettings.minSpringTail, breezeSettings.maxSpringTail);
    const driftSpeed = randomBetween(breezeSettings.minDriftSpeed, breezeSettings.maxDriftSpeed);

    return {
      x: -direction * randomBetween(1.1, 1.65),
      y: randomBetween(-1.1, 1.1),
      radius,
      strength,
      bornAt: time,
      lifetime,
      springTail,
      driftSpeed,
      wobbleAmount: randomBetween(0.035, 0.14),
      wobbleSpeed: randomBetween(0.0011, 0.0024),
      wobbleSeed: Math.random() * 100,
    };
  }

  // Copies one gust into a shader uniform.
  function setGustUniform(uniform, gust, fade) {
    uniform.value.set(gust.x, gust.y, gust.radius, gust.strength * fade);
  }

  // Resets unused breeze uniforms to inactive values.
  function clearBreezeUniforms(time) {
    const empty = { x: 9, y: 9, radius: 0, strength: 0, bornAt: time, lifetime: 1, springTail: 1 };

    [uniforms.uBreezeGustA, uniforms.uBreezeGustB, uniforms.uBreezeGustC, uniforms.uBreezeGustD].forEach((uniform) => {
      setGustUniform(uniform, empty, 0);
    });
  }

  // Pushes active breeze gusts into shader uniforms.
  function updateBreezeUniforms(time) {
    const empty = { x: 9, y: 9, radius: 0, strength: 0, bornAt: time, lifetime: 1, springTail: 1 };

    [uniforms.uBreezeGustA, uniforms.uBreezeGustB, uniforms.uBreezeGustC, uniforms.uBreezeGustD].forEach((uniform, index) => {
      const gust = breezeGusts[index] || empty;
      const t = (time - gust.bornAt) / gust.lifetime;
      const fade = gustEnvelope(t, gust.springTail);
      setGustUniform(uniform, gust, fade);
    });
  }

  // Ages existing gusts and occasionally starts new ones.
  function updateBreeze(time, deltaSeconds) {
    if (config.wall.breezeChance <= 0) {
      breezeGusts.length = 0;
      uniforms.uBreeze.value += (0 - uniforms.uBreeze.value) * 0.035;
      clearBreezeUniforms(time);
      return;
    }

    if (time >= nextDirectionChangeAt) {
      breezeDirection = Math.random() < 0.5 ? -1 : 1;
      nextDirectionChangeAt = time + randomBetween(3800, 10500);
    }

    const maxGusts = 4;
    const spawnChance = config.wall.breezeChance * deltaSeconds;

    if (breezeGusts.length < maxGusts && Math.random() < spawnChance) {
      breezeGusts.push(randomGustPacket(breezeDirection, time));
    }

    if (config.wall.breezeChance > 0.65 && breezeGusts.length < maxGusts && Math.random() < spawnChance * 0.65) {
      breezeGusts.push(randomGustPacket(breezeDirection, time));
    }

    if (config.wall.breezeChance > 0.9 && breezeGusts.length < maxGusts && Math.random() < spawnChance * 0.35) {
      breezeGusts.push(randomGustPacket(breezeDirection, time));
    }

    breezeGusts = breezeGusts
      .map((gust) => ({
        ...gust,
        x: gust.x + breezeDirection * deltaSeconds * gust.driftSpeed,
        y: gust.y + Math.sin(time * gust.wobbleSpeed + gust.wobbleSeed) * deltaSeconds * gust.wobbleAmount,
      }))
      .filter((gust) => {
        const age = (time - gust.bornAt) / gust.lifetime;
        const alive = age < 1 + gust.springTail;
        const onScreen = Math.abs(gust.x) < 1.85 + gust.radius;
        return alive && onScreen;
      });

    uniforms.uBreeze.value += ((breezeGusts.length > 0 ? 1 : 0) - uniforms.uBreeze.value) * 0.035;
    updateBreezeUniforms(time);
  }

  // Pushes shared pointer config into grass uniforms.
  function syncInteractionUniforms() {
    syncUniformValues(uniforms, config.interaction, interactionUniformKeys);
  }

  // Applies live config changes to grass colors and uniforms.
  function set(path, value) {
    const key = path.startsWith("wall.") ? path.slice(5) : path;

    if (path === "global.colorTransitionSpeed") {
      config.global.colorTransitionSpeed = value;
      return true;
    }

    if (path === "global.currentColor") {
      targetGrassColor.set(value);
      config.global.currentColor = value;
      config.wall.grassColor = value;
      return true;
    }

    if (key === "grassColor") {
      targetGrassColor.set(value);
      config.wall.grassColor = value;
      return true;
    }

    if (key === "cursorColor") {
      targetCursorColor.set(value);
      config.wall.cursorColor = value;
      return true;
    }

    if (key === "bladeCount") {
      rebuildGrass(value);
      return true;
    }

    if (key === "fireflies") {
      uniforms.uFireflies.value = value ? 1 : 0;
      return true;
    }

    if (key === "breezeChance" && value <= 0) {
      breezeGusts.length = 0;
    }

    const uniformKey = `u${key[0].toUpperCase()}${key.slice(1)}`;

    if (uniforms[uniformKey]) {
      uniforms[uniformKey].value = value;
    }

    return true;
  }

  rebuildGrass(wallConfig.bladeCount);

  return {
    resolvePath(key) {
      return uniformPaths[key] || null;
    },

    set,

    update({ time, delta }) {
      syncInteractionUniforms();
      updateBreeze(time, delta || 0);
      applyColorUniforms(
        uniforms,
        { grassColor: targetGrassColor, cursorColor: targetCursorColor },
        ["grassColor", "cursorColor"],
        config.global.colorTransitionSpeed,
        config.global.rotateColors !== false
      );
    },

    destroy() {
      if (grass) {
        scene.remove(grass);
      }

      scene.remove(fireflyPlane);
      grassGeometry?.dispose();
      resources.dispose();
    },
  };
}

createGrassWall.defaults = createGrassDefaults;
createGrassWall.loadControls = () => import("./controls.js").then((module) => module.grassControls);
