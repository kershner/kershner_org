import { createUniformPathResolver, makeColorTargets } from "../../core/wallUtils.js";
import { orbsControls } from "./controls.js";
import { orbsDefaults } from "./defaults.js";
import { makeEnvironmentTexture, makeOrbPatternTexture } from "./textures.js";

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBackgroundGradientColors(THREE, baseColor) {
  const base = baseColor.clone();
  const hsl = {};
  base.getHSL(hsl);

  const top = new THREE.Color().setHSL(
    (hsl.h + 0.055) % 1,
    clamp(hsl.s * 0.72 + 0.16, 0.18, 0.78),
    clamp(hsl.l + 0.15, 0.16, 0.46)
  );

  const accent = new THREE.Color().setHSL(
    (hsl.h + 0.58) % 1,
    clamp(hsl.s * 0.82 + 0.12, 0.2, 0.82),
    clamp(hsl.l + 0.18, 0.18, 0.52)
  );

  const floor = base.clone().multiplyScalar(0.38);
  return { top, accent, floor };
}

function makeBackgroundMaterial(THREE, colors) {
  const bottom = new THREE.Color(colors.backgroundColor);
  const gradient = makeBackgroundGradientColors(THREE, bottom);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: gradient.top },
      uAccent: { value: gradient.accent },
      uFloor: { value: gradient.floor },
      uBottom: { value: bottom },
      uContrast: { value: colors.contrast },
      uBanding: { value: colors.retroBanding },
      uGrain: { value: colors.grain },
      uVignette: { value: colors.vignette },
      uAspect: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uTop;
      uniform vec3 uAccent;
      uniform vec3 uFloor;
      uniform vec3 uBottom;
      uniform float uContrast;
      uniform float uBanding;
      uniform float uGrain;
      uniform float uVignette;
      uniform float uAspect;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float h = smoothstep(0.0, 1.0, vUv.y);
        float diagonal = smoothstep(-0.55, 0.95, (vUv.x - 0.52) * 0.85 + (vUv.y - 0.2) * 0.72);
        float upperGlow = exp(-dot(p - vec2(-0.34 * uAspect, 0.24), p - vec2(-0.34 * uAspect, 0.24)) * 2.15);
        float lowerGlow = exp(-dot(p - vec2(0.42 * uAspect, -0.28), p - vec2(0.42 * uAspect, -0.28)) * 2.9);
        float shelf = exp(-pow((vUv.y - 0.22) / 0.23, 2.0));

        vec3 col = mix(uFloor, uBottom, smoothstep(0.03, 0.52, vUv.y));
        col = mix(col, uTop, h * 0.64);
        col = mix(col, uAccent, diagonal * 0.16 + lowerGlow * 0.11);
        col += uTop * upperGlow * 0.16;
        col += uAccent * lowerGlow * 0.09;
        col += vec3(0.09, 0.085, 0.074) * shelf * 0.42;

        col = (col - 0.5) * uContrast + 0.5;
        float bands = max(10.0, mix(220.0, 18.0, clamp(uBanding, 0.0, 1.0)));
        col = mix(col, floor(col * bands) / bands, clamp(uBanding * 1.35, 0.0, 0.75));
        float grain = hash(floor(vUv * vec2(1100.0, 800.0)));
        col += (grain - 0.5) * uGrain * 4.2;
        float vig = smoothstep(1.42, 0.12, length(p));
        col *= mix(1.0 - uVignette * 0.72, 1.0, vig);
        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      }
    `,
    depthWrite: false,
    depthTest: false,
  });
}

const colorKeys = [
  "backgroundColor",
  "keyLightColor",
  "fillLightColor",
  "cursorLightColor",
  "chromeColor",
  "warmOrbColor",
  "coolOrbColor",
  "darkOrbColor",
];


const configurableKeys = [
  ...colorKeys,
  "rotateColors",
  "colorTransitionSpeed",
  "orbCount",
  "orbScale",
  "driftSpeed",
  "spread",
  "chrome",
  "textureStrength",
  "collisionStrength",
  "tapBounceAmount",
  "throwPower",
  "lightCount",
  "lightIntensity",
  "lightDepth",
  "contrast",
  "retroBanding",
  "grain",
  "vignette",
];

const uniformPaths = createUniformPathResolver(configurableKeys);

export function createOrbsWall({ THREE, scene, camera, renderer, sharedUniforms, config }) {
  const root = new THREE.Group();
  root.name = "GraphicsWallOrbs";
  scene.add(root);

  camera.near = -20;
  camera.far = 20;
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  if (renderer.outputColorSpace && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
  }
  if ("useLegacyLights" in renderer) {
    renderer.useLegacyLights = false;
  }
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true;
    if (THREE.PCFSoftShadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    else if (THREE.PCFShadowMap) renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  const palette = {};
  colorKeys.forEach((key) => { palette[key] = config.wall[key]; });
  let envTexture = makeEnvironmentTexture(THREE, palette);
  scene.environment = envTexture;

  const backgroundMaterial = makeBackgroundMaterial(THREE, {
    ...palette,
    contrast: config.wall.contrast,
    retroBanding: config.wall.retroBanding,
    grain: config.wall.grain,
    vignette: config.wall.vignette,
  });

  const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
  background.renderOrder = -1000;
  scene.add(background);

  const shadowBackdropMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.wall.backgroundColor).multiplyScalar(0.32),
    metalness: 0.0,
    roughness: 0.92,
  });
  const shadowBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), shadowBackdropMaterial);
  shadowBackdrop.position.set(0, 0, -1.95);
  shadowBackdrop.receiveShadow = true;
  shadowBackdrop.castShadow = false;
  shadowBackdrop.renderOrder = -20;
  root.add(shadowBackdrop);

  // Keep fixed lighting extremely low; the moving lamps should create the drama.
  const ambient = new THREE.AmbientLight(0xffffff, 0.004);
  const key = new THREE.DirectionalLight(0xffffff, 0.012);
  key.position.set(-3.2, 4.4, 6.0);
  const fill = new THREE.DirectionalLight(0xd7e5ff, 0.002);
  fill.position.set(4.2, -1.4, 4.0);
  const rim = new THREE.DirectionalLight(0xffffff, 0.018);
  rim.position.set(2.8, 2.2, -4.5);
  root.add(ambient, key, fill, rim);

  const driftLights = [];
  let aspect = window.innerWidth / Math.max(window.innerHeight, 1);

  function createDriftLight() {
    const color = new THREE.Color(config.wall.cursorLightColor);
    const group = new THREE.Group();
    const light = new THREE.PointLight(color, 0, 18.0, 1.75);
    // Keep the point light for glossy highlights, but do not let it add a
    // second noisy shadow pass on top of the cursor spotlight.
    light.castShadow = false;

    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, -1.85);
    root.add(spotTarget);

    const spot = new THREE.SpotLight(color, 0, 24.0, 0.82, 0.92, 1.18);
    spot.castShadow = true;
    spot.target = spotTarget;
    if (spot.shadow) {
      spot.shadow.mapSize.width = 2048;
      spot.shadow.mapSize.height = 2048;
      spot.shadow.bias = -0.00003;
      spot.shadow.normalBias = 0.028;
      spot.shadow.radius = 7.0;
      if ("blurSamples" in spot.shadow) spot.shadow.blurSamples = 10;
      spot.shadow.camera.near = 0.05;
      spot.shadow.camera.far = 28.0;
      spot.shadow.camera.fov = 72;
    }

    group.add(light, spot);
    root.add(group);

    const item = { group, light, spot, spotTarget, visible: true };
    item.group.position.set(rand(-aspect * 0.55, aspect * 0.55), rand(-0.72, 0.72), rand(4.2, 6.8));
    driftLights.push(item);
    return item;
  }

  createDriftLight();

  const colorTargets = makeColorTargets(THREE, config.wall, colorKeys);
  const maxOrbs = 12;
  const initialOrbBudget = Math.min(4, Math.max(2, Math.round(config.wall.orbCount || 0)));
  const baseSphereSegments = { width: 80, height: 40 };
  const textureCache = new Map();
  const orbGeometries = [];
  const orbs = [];
  const dragPlaneZ = 0;
  const tapSpinSpeed = 0.055;
  const holdDelayMs = 120;
  const dragMoveThreshold = 0.025;
  const dragReleaseVelocityScale = 8.5;
  const interaction = {
    pointerId: null,
    orb: null,
    isDown: false,
    isDragging: false,
    downTime: 0,
    offsetX: 0,
    offsetY: 0,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
  };

  function getOrbPatternTexture(index, mode) {
    const style = ((index * 7 + (mode === "bump" ? 11 : mode === "roughness" ? 19 : 0)) % 32 + 32) % 32;
    const key = `${mode}:${style}`;
    let texture = textureCache.get(key);
    if (!texture) {
      texture = makeOrbPatternTexture(THREE, style, mode);
      textureCache.set(key, texture);
    }
    return texture;
  }

  function paletteColor(index) {
    const colors = [
      config.wall.chromeColor,
      config.wall.warmOrbColor,
      config.wall.coolOrbColor,
      config.wall.darkOrbColor,
      "#b93722",
      "#d8b15a",
      "#1f7a73",
      "#334c91",
      "#834e2f",
      "#c2c4bd",
      "#24262b",
      "#7a8c52",
      "#6d352c",
      "#7c6f9a",
      "#2f6f9a",
      "#9a8535",
    ];
    return new THREE.Color(colors[index % colors.length]);
  }

  function makeSeamlessOrbGeometry(index, bumpiness) {
    const geometry = new THREE.SphereGeometry(1, baseSphereSegments.width, baseSphereSegments.height);
    const position = geometry.attributes.position;
    const normal = new THREE.Vector3();
    const p = new THREE.Vector3();
    const style = index % 18;
    const amount = Math.max(0, bumpiness);

    if (amount > 0.0001) {
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i);
        normal.copy(p).normalize();

        const angle = Math.atan2(normal.z, normal.x);
        let n = 0;
        if (style === 1) {
          n = Math.sin(normal.x * 17.0 + normal.y * 9.0) * 0.35
            + Math.sin(normal.y * 23.0 - normal.z * 13.0) * 0.28
            + Math.sin(normal.z * 29.0 + normal.x * 11.0) * 0.22;
        } else if (style === 2) {
          n = Math.sin(normal.y * 38.0) * 0.48 + Math.sin((normal.x + normal.z) * 18.0) * 0.18;
        } else if (style === 3) {
          n = Math.sin((normal.x * 7.0 + normal.y * 11.0 + normal.z * 13.0) * 2.2) * 0.42;
        } else if (style === 4) {
          n = Math.sin(normal.x * 45.0) * 0.18 + Math.sin(normal.z * 41.0) * 0.18;
        } else if (style === 5) {
          n = Math.sin(normal.x * 8.0) * Math.sin(normal.y * 10.0) * Math.sin(normal.z * 12.0);
        } else if (style === 6) {
          n = Math.sin(angle * 10.0) * 0.28 + Math.sin(normal.y * 24.0) * 0.18;
        } else if (style === 7) {
          n = Math.sign(Math.sin(normal.x * 10.0) + Math.sin(normal.y * 13.0) + Math.sin(normal.z * 16.0)) * 0.22;
        } else if (style === 8) {
          n = Math.sin(normal.y * 16.0 + Math.sin(normal.x * 8.0) * 2.5) * 0.42;
        } else if (style === 9) {
          n = Math.pow(Math.abs(Math.sin(normal.x * 12.0) * Math.sin(normal.z * 12.0)), 0.45) * 0.38;
        } else if (style === 10) {
          n = Math.sin((normal.x + normal.y + normal.z) * 31.0) * 0.12;
        } else if (style === 11) {
          n = Math.sin(normal.y * 7.0) * 0.16 + Math.sin(Math.atan2(normal.y, normal.x) * 6.0) * 0.26;
        } else if (style === 12) {
          n = Math.sin(angle * 18.0 + normal.y * 8.0) * 0.18 + Math.sin(normal.y * 42.0) * 0.10;
        } else if (style === 13) {
          n = Math.pow(Math.abs(Math.sin(normal.x * 18.0) + Math.sin(normal.y * 20.0) + Math.sin(normal.z * 22.0)) / 3.0, 0.55) * 0.42;
        } else if (style === 14) {
          n = Math.sin(Math.atan2(normal.z, normal.x) * 7.0 + normal.y * 12.0) * Math.sin(normal.y * 21.0) * 0.34;
        } else if (style === 15) {
          n = Math.sign(Math.sin(angle * 14.0) + Math.sin(normal.y * 26.0)) * 0.16 + Math.sin(normal.x * 31.0) * 0.07;
        } else if (style === 16) {
          n = Math.sin(normal.x * 9.0 + Math.sin(normal.z * 12.0) * 4.0) * 0.21 + Math.sin(normal.y * 15.0) * 0.17;
        } else if (style === 17) {
          n = Math.sin(normal.x * 52.0) * Math.sin(normal.y * 47.0) * Math.sin(normal.z * 43.0) * 0.11;
        }

        const scale = 1.0 + n * amount;
        position.setXYZ(i, normal.x * scale, normal.y * scale, normal.z * scale);
      }

      position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    }

    return geometry;
  }

  function makeOrbMaterial(index, bumpiness) {
    const base = paletteColor(index);
    const accent = paletteColor(index + 5);

    const materialTypes = [
      { metalness: 0.78, roughness: 0.022, env: 0.22, clear: 1.0, clearRough: 0.018, emissive: 0.003, sheen: 0.0, iridescence: 0.0 },
      { metalness: 0.10, roughness: 0.032, env: 0.09, clear: 1.0, clearRough: 0.012, emissive: 0.014, sheen: 0.0, iridescence: 0.06 },
      { metalness: 0.46, roughness: 0.11, env: 0.12, clear: 0.65, clearRough: 0.045, emissive: 0.005, sheen: 0.0, iridescence: 0.0 },
      { metalness: 0.00, roughness: 0.20, env: 0.06, clear: 0.92, clearRough: 0.06, emissive: 0.016, sheen: 0.18, iridescence: 0.0 },
      { metalness: 0.62, roughness: 0.055, env: 0.16, clear: 0.9, clearRough: 0.025, emissive: 0.004, sheen: 0.0, iridescence: 0.12 },
      { metalness: 0.24, roughness: 0.075, env: 0.10, clear: 1.0, clearRough: 0.02, emissive: 0.008, sheen: 0.08, iridescence: 0.0 },
      { metalness: 0.88, roughness: 0.16, env: 0.18, clear: 0.35, clearRough: 0.09, emissive: 0.003, sheen: 0.0, iridescence: 0.0 },
      { metalness: 0.04, roughness: 0.018, env: 0.08, clear: 1.0, clearRough: 0.008, emissive: 0.018, sheen: 0.0, iridescence: 0.18 },
      { metalness: 0.34, roughness: 0.24, env: 0.07, clear: 0.42, clearRough: 0.12, emissive: 0.006, sheen: 0.16, iridescence: 0.0 },
      { metalness: 0.70, roughness: 0.036, env: 0.17, clear: 1.0, clearRough: 0.016, emissive: 0.004, sheen: 0.0, iridescence: 0.22 },
      { metalness: 0.02, roughness: 0.12, env: 0.07, clear: 0.95, clearRough: 0.025, emissive: 0.015, sheen: 0.26, iridescence: 0.0 },
      { metalness: 0.54, roughness: 0.075, env: 0.13, clear: 0.86, clearRough: 0.04, emissive: 0.005, sheen: 0.0, iridescence: 0.08 },
      { metalness: 0.06, roughness: 0.34, env: 0.045, clear: 0.24, clearRough: 0.18, emissive: 0.010, sheen: 0.32, iridescence: 0.0 },
      { metalness: 0.96, roughness: 0.028, env: 0.26, clear: 0.72, clearRough: 0.02, emissive: 0.002, sheen: 0.0, iridescence: 0.0 },
      { metalness: 0.16, roughness: 0.052, env: 0.10, clear: 1.0, clearRough: 0.004, emissive: 0.019, sheen: 0.0, iridescence: 0.28 },
      { metalness: 0.38, roughness: 0.30, env: 0.06, clear: 0.58, clearRough: 0.20, emissive: 0.006, sheen: 0.38, iridescence: 0.0 },
      { metalness: 0.74, roughness: 0.18, env: 0.16, clear: 0.18, clearRough: 0.11, emissive: 0.003, sheen: 0.0, iridescence: 0.0 },
      { metalness: 0.01, roughness: 0.018, env: 0.11, clear: 1.0, clearRough: 0.006, emissive: 0.022, sheen: 0.0, iridescence: 0.36 },
    ];
    const type = materialTypes[index % materialTypes.length];
    const color = base.clone().multiplyScalar(index % 4 === 0 ? 1.26 : 1.08);

    const patternMap = getOrbPatternTexture(index, "color");
    const bumpMap = getOrbPatternTexture(index + 3, "bump");
    const roughnessMap = getOrbPatternTexture(index + 7, "roughness");

    const material = new THREE.MeshPhysicalMaterial({
      color,
      map: patternMap,
      metalness: type.metalness,
      roughness: type.roughness,
      roughnessMap,
      envMap: envTexture,
      envMapIntensity: type.env * config.wall.chrome,
      clearcoat: type.clear,
      clearcoatRoughness: type.clearRough,
      reflectivity: 1.0,
      specularIntensity: index % 3 === 0 ? 0.85 : 1.0,
      specularColor: accent.clone().lerp(new THREE.Color(0xffffff), 0.64),
      emissive: color.clone().multiplyScalar(type.emissive),
      emissiveIntensity: 0.08,
      bumpMap,
      bumpScale: 0.032 + Math.max(0, bumpiness) * 5.2 + (index % 5 === 0 ? 0.08 : 0.0) + (index % 7 === 3 ? 0.055 : 0.0),
      sheen: type.sheen,
      sheenRoughness: 0.55,
      iridescence: type.iridescence,
      iridescenceIOR: 1.35,
    });

    if (index % 6 === 1) {
      material.clearcoat = 1.0;
      material.clearcoatRoughness = 0.006;
    }
    if (index % 6 === 4) {
      material.roughness = Math.max(material.roughness, 0.14);
      material.bumpScale *= 1.65;
    }
    if (index % 8 === 2) {
      material.bumpScale *= 1.45;
      material.clearcoatRoughness = Math.min(0.26, material.clearcoatRoughness + 0.055);
    }
    if (index % 9 === 5) {
      material.roughness = Math.max(material.roughness, 0.22);
      material.envMapIntensity *= 0.72;
      material.sheen = Math.max(material.sheen || 0, 0.24);
    }

    return material;
  }

  function visibleBoundsFor(orb) {
    return {
      left: -aspect * config.wall.spread - orb.radius * 0.3,
      right: aspect * config.wall.spread + orb.radius * 0.3,
      top: 1.0 + orb.radius + 0.16,
      bottom: -1.0 - orb.radius - 0.22,
    };
  }

  function resetOrb(orb, placeVisible = false) {
    const huge = Math.random() < 0.34;
    orb.baseRadius = huge ? rand(0.32, 0.66) : rand(0.15, 0.36);
    const radius = orb.baseRadius * config.wall.orbScale;
    orb.radius = radius;
    orb.mass = Math.max(0.02, radius * radius);
    orb.mesh.scale.setScalar(radius);

    const bounds = visibleBoundsFor(orb);
    orb.mesh.position.x = rand(bounds.left, bounds.right);
    orb.mesh.position.y = placeVisible ? rand(bounds.bottom, bounds.top) : bounds.bottom - rand(0.04, 0.42);
    orb.mesh.position.z = rand(-0.5, 0.5);

    orb.vx = rand(-0.08, 0.08) * config.wall.spread;
    orb.baseVy = rand(0.12, 0.24);
    orb.vy = orb.baseVy * Math.max(config.wall.driftSpeed, 0.02);
    orb.spin.set(rand(-0.55, 0.55), rand(-0.75, 0.75), rand(-0.4, 0.4));
    orb.phase = Math.random() * Math.PI * 2;
  }

  function createOrb(index) {
    const bumpinessPresets = [
      0.0, 0.016, 0.024, 0.036, 0.01, 0.052, 0.006, 0.03, 0.02,
      0.044, 0.012, 0.018, 0.058, 0.026, 0.04, 0.014, 0.048, 0.032,
    ];
    const geometryBumpiness = bumpinessPresets[index % bumpinessPresets.length] * config.wall.textureStrength;
    const geometry = makeSeamlessOrbGeometry(index, geometryBumpiness);
    orbGeometries.push(geometry);

    const material = makeOrbMaterial(index, geometryBumpiness);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = index + 1;
    root.add(mesh);

    const orb = {
      mesh,
      material,
      radius: 0.2,
      baseRadius: 0.2,
      mass: 0.04,
      baseVy: 0.18,
      vx: 0,
      vy: 0,
      spin: new THREE.Vector3(),
      phase: Math.random() * Math.PI * 2,
      visible: true,
      isHeld: false,
      isDragging: false,
      materialIndex: index,
      baseColor: paletteColor(index),
      lightGlow: new THREE.Color(0, 0, 0),
      roughnessBase: material.roughness,
      envBase: material.envMapIntensity / Math.max(config.wall.chrome, 0.001),
      metalnessBase: material.metalness,
      bumpBase: material.bumpScale / Math.max(config.wall.textureStrength, 0.001),
      tapBounce: 0,
      tapOffsetY: 0,
    };
    resetOrb(orb, true);
    return orb;
  }

  function desiredOrbCount() {
    return Math.max(0, Math.min(maxOrbs, Math.round(config.wall.orbCount)));
  }

  function createOrbBatch(limit) {
    const target = desiredOrbCount();
    let made = 0;
    while (orbs.length < target && made < limit) {
      orbs.push(createOrb(orbs.length));
      made++;
    }
  }

  function applyOrbScale() {
    orbs.forEach((orb) => {
      const previousRadius = Math.max(orb.radius || 0.001, 0.001);
      orb.radius = Math.max(0.04, (orb.baseRadius || previousRadius) * config.wall.orbScale);
      orb.mass = Math.max(0.02, orb.radius * orb.radius);
      const scaleRatio = orb.radius / previousRadius;
      orb.mesh.scale.multiplyScalar(scaleRatio);
    });
  }

  createOrbBatch(initialOrbBudget);

  function eventToWorld(event) {
    return {
      x: ((event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1) * aspect,
      y: -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1),
    };
  }

  function findOrbAt(x, y) {
    let best = null;
    let bestScore = Infinity;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const orb = orbs[i];
      if (!orb.visible) continue;
      const dx = x - orb.mesh.position.x;
      const dy = y - orb.mesh.position.y;
      const hitRadius = Math.max(orb.radius * 1.18, 0.16);
      const distSq = dx * dx + dy * dy;
      if (distSq > hitRadius * hitRadius) continue;
      const score = distSq - orb.mesh.position.z * 0.015 - i * 0.0001;
      if (score < bestScore) {
        best = orb;
        bestScore = score;
      }
    }
    return best;
  }

  function slowOrbSpin(orb) {
    if (!orb) return;
    if (orb.spin.lengthSq() < 0.000001) {
      orb.spin.set(rand(-0.03, 0.03), rand(-0.04, 0.04), rand(-0.025, 0.025));
    }
    orb.spin.setLength(tapSpinSpeed);
  }

  function triggerTapBounce(orb) {
    if (!orb) return;
    orb.tapBounce = 1.0;
  }

  function beginOrbDrag(event) {
    const world = eventToWorld(event);
    const orb = findOrbAt(world.x, world.y);
    if (!orb) return;

    interaction.pointerId = event.pointerId;
    interaction.orb = orb;
    interaction.isDown = true;
    interaction.isDragging = false;
    interaction.downTime = performance.now();
    interaction.offsetX = orb.mesh.position.x - world.x;
    interaction.offsetY = orb.mesh.position.y - world.y;
    interaction.downX = world.x;
    interaction.downY = world.y;
    interaction.lastX = world.x;
    interaction.lastY = world.y;
    interaction.lastTime = interaction.downTime;
    interaction.velocityX = 0;
    interaction.velocityY = 0;

    orb.isHeld = true;
    triggerTapBounce(orb);
    orb.vx *= 0.15;
    orb.vy *= 0.15;
    slowOrbSpin(orb);
    if (event.cancelable) event.preventDefault();
  }

  function moveOrbDrag(event) {
    if (!interaction.isDown || interaction.pointerId !== event.pointerId || !interaction.orb) return;

    const now = performance.now();
    const world = eventToWorld(event);
    const dx = world.x - interaction.downX;
    const dy = world.y - interaction.downY;
    const movedEnough = dx * dx + dy * dy > dragMoveThreshold * dragMoveThreshold;
    if (!interaction.isDragging && (now - interaction.downTime > holdDelayMs || movedEnough)) {
      interaction.isDragging = true;
      interaction.orb.isDragging = true;
    }

    const dtMs = Math.max(8, now - interaction.lastTime);
    interaction.velocityX = (world.x - interaction.lastX) / dtMs;
    interaction.velocityY = (world.y - interaction.lastY) / dtMs;
    interaction.lastX = world.x;
    interaction.lastY = world.y;
    interaction.lastTime = now;

    if (interaction.isDragging) {
      const orb = interaction.orb;
      const bounds = visibleBoundsFor(orb);
      orb.mesh.position.x = clamp(world.x + interaction.offsetX, bounds.left, bounds.right);
      orb.mesh.position.y = clamp(world.y + interaction.offsetY, bounds.bottom, bounds.top);
      orb.mesh.position.z += (dragPlaneZ + 0.2 - orb.mesh.position.z) * 0.18;
      orb.vx = interaction.velocityX * 1000;
      orb.vy = interaction.velocityY * 1000;
      orb.spin.x += -interaction.velocityY * 18;
      orb.spin.y += interaction.velocityX * 18;
      orb.spin.multiplyScalar(0.94);
      if (event.cancelable) event.preventDefault();
    }
  }

  function endOrbDrag(event) {
    if (!interaction.isDown || interaction.pointerId !== event.pointerId) return;

    const orb = interaction.orb;
    if (orb) {
      if (interaction.isDragging) {
        const throwPower = Math.max(0, config.wall.throwPower ?? 1);
        orb.vx = clamp(interaction.velocityX * 1000 * dragReleaseVelocityScale * throwPower, -2.8, 2.8);
        orb.vy = clamp(interaction.velocityY * 1000 * dragReleaseVelocityScale * throwPower, -1.9, 2.4);
        orb.spin.x += clamp(-orb.vy * 1.8, -2.4, 2.4);
        orb.spin.y += clamp(orb.vx * 1.8, -2.4, 2.4);
        orb.spin.z += clamp((orb.vx - orb.vy) * 0.55, -1.4, 1.4);
      } else {
        slowOrbSpin(orb);
      }
      orb.isHeld = false;
      orb.isDragging = false;
    }

    interaction.pointerId = null;
    interaction.orb = null;
    interaction.isDown = false;
    interaction.isDragging = false;
    if (event.cancelable) event.preventDefault();
  }

  window.addEventListener("pointerdown", beginOrbDrag, { passive: false });
  window.addEventListener("pointermove", moveOrbDrag, { passive: false });
  window.addEventListener("pointerup", endOrbDrag, { passive: false });
  window.addEventListener("pointercancel", endOrbDrag, { passive: false });

  function syncOrbVisibility() {
    const count = desiredOrbCount();
    orbs.forEach((orb, index) => {
      orb.visible = index < count;
      orb.mesh.visible = orb.visible;
    });
  }

  function syncLightVisibility() {
    const enabled = config.wall.lightIntensity > 0 && config.wall.lightCount !== 0;
    driftLights.forEach((item, index) => {
      item.visible = enabled && index === 0;
      item.group.visible = item.visible;
      const power = config.wall.lightIntensity;
      item.light.intensity = item.visible ? power * 105.0 : 0;
      item.light.distance = Math.max(7.5, config.wall.lightDepth + 7.0);
      item.light.decay = 1.85;
      if (item.spot) {
        item.spot.visible = item.visible;
        item.spot.intensity = item.visible ? power * 155.0 : 0;
        item.spot.distance = Math.max(7.5, config.wall.lightDepth + 8.0);
        item.spot.angle = 0.82;
        item.spot.penumbra = 0.92;
        item.spot.decay = 1.18;
      }
    });
  }

  function updateProjection() {
    aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
    backgroundMaterial.uniforms.uAspect.value = aspect;
  }

  function applyCollisions() {
    const restitution = 0.92 * config.wall.collisionStrength;
    const passes = 4;

    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < orbs.length; i++) {
        const a = orbs[i];
        if (!a.visible) continue;

        for (let j = i + 1; j < orbs.length; j++) {
          const b = orbs[j];
          if (!b.visible) continue;

          const dx = b.mesh.position.x - a.mesh.position.x;
          const dy = b.mesh.position.y - a.mesh.position.y;
          const minDist = (a.radius + b.radius) * 1.04;
          const distSq = dx * dx + dy * dy;
          if (distSq <= 0.000001 || distSq >= minDist * minDist) continue;

          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          const invMassA = a.isDragging ? 0 : 1 / a.mass;
          const invMassB = b.isDragging ? 0 : 1 / b.mass;
          const invMassSum = invMassA + invMassB;
          if (invMassSum <= 0) continue;
          const correction = overlap / invMassSum;

          a.mesh.position.x -= nx * correction * invMassA;
          a.mesh.position.y -= ny * correction * invMassA;
          b.mesh.position.x += nx * correction * invMassB;
          b.mesh.position.y += ny * correction * invMassB;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal > 0) continue;

          const impulse = -(1 + restitution) * velAlongNormal / invMassSum;
          const ix = impulse * nx;
          const iy = impulse * ny;

          a.vx -= ix * invMassA;
          a.vy -= iy * invMassA;
          b.vx += ix * invMassB;
          b.vy += iy * invMassB;

          const tangent = rvx * -ny + rvy * nx;
          a.spin.x -= ny * Math.abs(tangent) * 1.6;
          a.spin.y += nx * Math.abs(tangent) * 1.6;
          b.spin.x += ny * Math.abs(tangent) * 1.6;
          b.spin.y -= nx * Math.abs(tangent) * 1.6;
        }
      }
    }
  }

  function updateMaterials(force = false, time = 0, cursorLightPosition = null) {
    const chrome = config.wall.chrome;
    const cursorColor = colorTargets.cursorLightColor || colorTargets.keyLightColor;
    orbs.forEach((orb, index) => {
      const base = paletteColor(index);
      if (config.wall.rotateColors) {
        orb.material.color.lerp(base, config.wall.colorTransitionSpeed);
      }

      // Keep the mirror environment present, but let the actual cursor light dominate.
      orb.material.envMapIntensity = orb.envBase * chrome * 0.72;
      orb.material.roughness = Math.max(0.006, Math.min(0.28, orb.roughnessBase / Math.max(chrome * 0.65, 0.55)));
      if ("bumpScale" in orb.material) {
        orb.material.bumpScale = orb.bumpBase * Math.max(0, config.wall.textureStrength);
      }

      let influence = 0;
      if (cursorLightPosition) {
        const dx = orb.mesh.position.x - cursorLightPosition.x;
        const dy = orb.mesh.position.y - cursorLightPosition.y;
        const dz = orb.mesh.position.z - cursorLightPosition.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        influence = Math.max(0, 1 - dist / Math.max(1.4, config.wall.lightDepth * 0.72));
        influence = influence * influence * config.wall.lightIntensity;
      }

      // Subtle whole-object light bleed helps the colored point light read on very
      // metallic spheres, while the main surface highlights still come from lights.
      const bleed = 0.015 + influence * (orb.metalnessBase > 0.85 ? 0.10 : 0.18);
      const preservedColor = base.clone().lerp(cursorColor, 0.35);
      orb.material.emissive.copy(preservedColor).multiplyScalar(bleed);
      orb.material.emissiveIntensity = 0.20 + influence * 0.72;
      if (orb.material.specularColor) {
        orb.material.specularColor.copy(base).lerp(cursorColor, 0.28).lerp(new THREE.Color(0xffffff), 0.35);
      }
      if (force) orb.material.needsUpdate = true;
    });
  }

  function rebuildEnvironment() {
    const oldEnv = envTexture;
    const nextPalette = {};
    colorKeys.forEach((key) => { nextPalette[key] = config.wall[key]; });
    const bgGradient = makeBackgroundGradientColors(THREE, new THREE.Color(config.wall.backgroundColor));
    envTexture = makeEnvironmentTexture(THREE, nextPalette);
    scene.environment = envTexture;
    orbs.forEach((orb) => {
      orb.material.envMap = envTexture;
      orb.material.needsUpdate = true;
    });
    oldEnv.dispose();
  }

  syncOrbVisibility();
  syncLightVisibility();
  updateProjection();
  updateMaterials(true);

  function set(path, value) {
    const keyName = path.startsWith("wall.") ? path.slice(5) : path;

    if (colorTargets[keyName]) {
      colorTargets[keyName].set(value);
      config.wall[keyName] = value;
      if (keyName === "cursorLightColor") {
        const color = new THREE.Color(value);
        driftLights.forEach((item) => {
          item.light.color.copy(color);
          if (item.spot) item.spot.color.copy(color);
        });
      }
      rebuildEnvironment();
      return true;
    }

    if (keyName in config.wall) {
      const previousValue = config.wall[keyName];
      config.wall[keyName] = value;
      if (keyName === "orbCount") syncOrbVisibility();
      if (keyName === "orbScale") applyOrbScale();
      if (keyName === "spread") {
        const oldSpread = Math.max(0.01, Number(previousValue) || 1);
        const newSpread = Math.max(0.01, Number(value) || 1);
        const ratio = newSpread / oldSpread;
        orbs.forEach((orb) => {
          if (orb.mesh && !orb.isDragging) {
            orb.mesh.position.x *= ratio;
            const bounds = visibleBoundsFor(orb);
            orb.mesh.position.x = clamp(orb.mesh.position.x, bounds.left, bounds.right);
            orb.vx *= ratio;
          }
        });
      }
      if (keyName === "driftSpeed") {
        orbs.forEach((orb) => {
          if (!orb.isDragging) {
            const targetVy = (orb.baseVy || 0.18) * Math.max(config.wall.driftSpeed, 0.02);
            orb.vy = Math.min(Math.max(orb.vy, targetVy * 0.35), targetVy * 2.2 + 0.02);
          }
        });
      }
      if (keyName === "lightCount" || keyName === "lightIntensity" || keyName === "lightDepth") syncLightVisibility();
      if (keyName === "chrome" || keyName === "textureStrength") updateMaterials(true);
    }

    return true;
  }

  return {
    controls: orbsControls,

    resolvePath(keyName) {
      return uniformPaths[keyName] || null;
    },

    set,

    update({ time, delta }) {
      createOrbBatch(1);
      syncOrbVisibility();
      syncLightVisibility();
      updateProjection();

      const t = time * 0.001;
      const dt = Math.min(delta || 0.016, 0.033);
      const pointer = sharedUniforms.uPointerSmooth?.value || { x: 9, y: 9 };
      const pointerX = pointer.x * aspect;
      const pointerY = pointer.y;

      backgroundMaterial.uniforms.uContrast.value = config.wall.contrast;
      backgroundMaterial.uniforms.uBanding.value = config.wall.retroBanding;
      backgroundMaterial.uniforms.uGrain.value = config.wall.grain;
      backgroundMaterial.uniforms.uVignette.value = config.wall.vignette;
      backgroundMaterial.uniforms.uBottom.value.lerp(colorTargets.backgroundColor, config.wall.colorTransitionSpeed);
      const bgGradient = makeBackgroundGradientColors(THREE, backgroundMaterial.uniforms.uBottom.value);
      backgroundMaterial.uniforms.uTop.value.lerp(bgGradient.top, 0.08);
      backgroundMaterial.uniforms.uAccent.value.lerp(bgGradient.accent, 0.08);
      backgroundMaterial.uniforms.uFloor.value.lerp(bgGradient.floor, 0.08);
      shadowBackdropMaterial.color.copy(bgGradient.floor).multiplyScalar(0.74);

      key.color.lerp(colorTargets.keyLightColor, 0.04);
      fill.color.lerp(colorTargets.fillLightColor, 0.04);

      for (let i = 0; i < driftLights.length; i++) {
        const item = driftLights[i];
        if (!item.visible) continue;

        const targetX = pointerX;
        const targetY = pointerY;
        const targetZ = config.wall.lightDepth;
        item.group.position.x += (targetX - item.group.position.x) * 0.58;
        item.group.position.y += (targetY - item.group.position.y) * 0.58;
        item.group.position.z += (targetZ - item.group.position.z) * 0.38;

        if (item.spotTarget) {
          item.spotTarget.position.x += (targetX - item.spotTarget.position.x) * 0.62;
          item.spotTarget.position.y += (targetY - item.spotTarget.position.y) * 0.62;
          item.spotTarget.position.z = -1.85;
        }

        const cursorColor = colorTargets.cursorLightColor || colorTargets.keyLightColor;
        item.light.color.lerp(cursorColor, 0.25);
        if (item.spot) item.spot.color.lerp(cursorColor, 0.25);
        item.light.intensity = config.wall.lightIntensity * 105.0;
        item.light.distance = Math.max(7.5, config.wall.lightDepth + 7.0);
        item.light.decay = 1.85;
        if (item.spot) {
          item.spot.intensity = config.wall.lightIntensity * 145.0;
          item.spot.distance = Math.max(7.5, config.wall.lightDepth + 8.0);
          item.spot.angle = 0.82;
          item.spot.penumbra = 0.92;
          item.spot.decay = 1.18;
        }
      }

      const primaryCursorLight = driftLights[0]?.group?.position || new THREE.Vector3(pointerX, pointerY, config.wall.lightDepth);
      updateMaterials(false, t, primaryCursorLight);

      for (const orb of orbs) {
        if (!orb.visible) continue;
        if (orb.tapOffsetY) {
          orb.mesh.position.y -= orb.tapOffsetY;
          orb.tapOffsetY = 0;
        }

        if (!orb.isDragging) {
          const wave = Math.sin(t * 0.31 + orb.phase) * 0.018 + Math.sin(t * 0.13 + orb.phase * 2.1) * 0.012;
          orb.mesh.position.x += (orb.vx + wave) * dt;
          orb.mesh.position.y += orb.vy * dt;

          const dx = orb.mesh.position.x - pointerX;
          const dy = orb.mesh.position.y - pointerY;
          const pointerDistSq = dx * dx + dy * dy;
          const pointerRadius = Math.max(config.interaction.cursorRadius, 0.001);
          if (!orb.isHeld && pointer.x < 8 && pointerDistSq < pointerRadius * pointerRadius * 2.8) {
            const d = Math.sqrt(Math.max(pointerDistSq, 0.0001));
            const push = (1 - d / (pointerRadius * 1.68)) * config.interaction.cursorStrength;
            orb.vx += (dx / d) * push * dt * 3.2;
            orb.vy += (dy / d) * push * dt * 1.2;
          }

          const bounds = visibleBoundsFor(orb);
          if (orb.mesh.position.x < bounds.left) {
            orb.mesh.position.x = bounds.left;
            orb.vx = Math.abs(orb.vx) * 0.82 + 0.035;
          } else if (orb.mesh.position.x > bounds.right) {
            orb.mesh.position.x = bounds.right;
            orb.vx = -Math.abs(orb.vx) * 0.82 - 0.035;
          }

          const driftTarget = (orb.baseVy || 0.18) * Math.max(config.wall.driftSpeed, 0.02);
          orb.vx += Math.sin(t * 0.23 + orb.phase) * dt * 0.01;
          orb.vx *= 0.996;
          orb.vy += (driftTarget - orb.vy) * dt * 0.42;
          orb.vy *= 0.999;
          orb.vy = Math.max(0.01, Math.min(0.52, orb.vy));

          if (orb.mesh.position.y - orb.radius > 1.28) {
            resetOrb(orb, false);
          }
        }

      }

      applyCollisions();

      for (const orb of orbs) {
        if (!orb.visible) continue;

        if (orb.tapBounce > 0) {
          const phase = 1.0 - orb.tapBounce;
          const bounceAmount = Math.max(0, config.wall.tapBounceAmount ?? 1);
          const down = Math.sin(Math.min(phase / 0.48, 1.0) * Math.PI) * -0.034 * bounceAmount;
          const reboundPhase = clamp((phase - 0.42) / 0.58, 0, 1);
          const rebound = Math.sin(reboundPhase * Math.PI) * 0.026 * bounceAmount;
          const offsetY = down + rebound;
          const squash = Math.max(0, -down / Math.max(0.001, 0.034 * bounceAmount));
          const stretch = Math.max(0, rebound / Math.max(0.001, 0.026 * bounceAmount));
          const scaleX = 1.0 + squash * 0.032 - stretch * 0.018;
          const scaleY = 1.0 - squash * 0.040 + stretch * 0.035;
          const scaleZ = 1.0 + squash * 0.024 - stretch * 0.012;
          orb.mesh.scale.set(orb.radius * scaleX, orb.radius * scaleY, orb.radius * scaleZ);
          orb.mesh.position.y += offsetY;
          orb.tapOffsetY = offsetY;
          orb.tapBounce = Math.max(0, orb.tapBounce - dt * 5.8);
        } else {
          if (orb.tapOffsetY) {
            orb.mesh.position.y -= orb.tapOffsetY;
            orb.tapOffsetY = 0;
          }
          if (Math.abs(orb.mesh.scale.x - orb.radius) > 0.0001) {
            orb.mesh.scale.setScalar(orb.radius);
          }
        }

        orb.mesh.rotation.x += orb.spin.x * dt;
        orb.mesh.rotation.y += orb.spin.y * dt;
        orb.mesh.rotation.z += orb.spin.z * dt;
        orb.spin.multiplyScalar(orb.isHeld ? 0.94 : 0.999);
      }
    },

    destroy() {
      window.removeEventListener("pointerdown", beginOrbDrag);
      window.removeEventListener("pointermove", moveOrbDrag);
      window.removeEventListener("pointerup", endOrbDrag);
      window.removeEventListener("pointercancel", endOrbDrag);
      scene.environment = null;
      scene.remove(background);
      background.geometry.dispose();
      backgroundMaterial.dispose();
      shadowBackdrop.geometry.dispose();
      shadowBackdropMaterial.dispose();
      scene.remove(root);
      orbGeometries.forEach((geometry) => geometry.dispose());
      envTexture.dispose();
      textureCache.forEach((texture) => texture.dispose());
      driftLights.forEach((item) => {
        if (item.spotTarget) root.remove(item.spotTarget);
      });
      orbs.forEach((orb) => orb.material.dispose());
    },
  };
}

createOrbsWall.defaults = orbsDefaults;
