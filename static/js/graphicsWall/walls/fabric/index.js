import { createUniformPathResolver, makeColorTargets } from "../../core/wallUtils.js";
import { fabricDefaults } from "./defaults.js";

const colorKeys = ["baseColor"];

const uniformPaths = createUniformPathResolver([
  "columns",
  "rows",
  "width",
  "height",
  "gravity",
  "damping",
  "constraintIterations",
  "stiffness",
  "windStrength",
  "windSpeed",
  "foldStrength",
  "foldCount",
  "pinStyle",
  "depthScale",
  "dragStrength",
  "hoverPush",
  "hoverLift",
  "grabStrength",
  "edgeStability",
  "bendStability",
  "tearEnabled",
  "cutLength",
  "cutWidth",
  "cutCooldown",
  "cutSpacing",
  "tearOpening",
  "cutStrength",
  "selfHeal",
  "healDelay",
  "healDuration",
  "healPull",
  "maxTriangleStretch",
  "threadStrength",
  "threadScale",
  "crossThreadStrength",
  "sheenStrength",
  "shadowStrength",
  "edgeDarkness",
  "frayStrength",
  "opacity",
  ...colorKeys,
], {
  silkColor: "wall.baseColor",
  accentColor: "wall.baseColor",
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / ((edge1 - edge0) || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy || 1;
  const t = clamp((wx * vx + wy * vy) / lenSq, 0, 1);
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return { distance: Math.sqrt(dx * dx + dy * dy), along: t };
}

function hash01(value) {
  const n = Math.sin(value * 12.9898) * 43758.5453123;
  return n - Math.floor(n);
}

function addScaledColor(out, color, scale) {
  out.r = clamp(color.r * scale, 0, 1);
  out.g = clamp(color.g * scale, 0, 1);
  out.b = clamp(color.b * scale, 0, 1);
  return out;
}

function makePoint(x, y, z, pinned) {
  return { x, y, z, px: x, py: y, pz: z, ox: x, oy: y, oz: z, pinned, fray: 0 };
}

function mixColor(out, a, b, t) {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
  return out;
}

function derivedHslColor(THREE, source, lightness, saturationScale = 1, saturationAdd = 0) {
  const hsl = { h: 0, s: 0, l: 0 };
  source.getHSL(hsl);
  return new THREE.Color().setHSL(
    hsl.h,
    clamp(hsl.s * saturationScale + saturationAdd, 0, 1),
    clamp(lightness, 0, 1),
  );
}

function colorToCssRgb(color) {
  return `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;
}

function colorToCssRgba(color, alpha) {
  return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${alpha})`;
}

function buildFabricState(THREE, wall) {
  const columns = clamp(Math.round(wall.columns || 92), 24, 170);
  const rows = clamp(Math.round(wall.rows || 64), 18, 120);
  const width = Number(wall.width || 2.28);
  const height = Number(wall.height || 2.08);
  const count = columns * rows;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const points = [];
  const constraints = [];
  const constraintMap = new Map();
  const constraintsByPoint = Array.from({ length: count }, () => []);
  const trianglesByPoint = Array.from({ length: count }, () => []);
  const edgeToTriangles = new Map();
  const restX = width / (columns - 1);
  const restY = height / (rows - 1);
  const foldStrength = Number(wall.foldStrength || 0);
  const foldCount = Number(wall.foldCount || 6.5);
  const pinStyle = String(wall.pinStyle || "top");

  function pinHash(x, y) {
    const n = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function nearColumn(x, target, radius = 1) {
    return Math.abs(x - target) <= radius;
  }

  function isPinned(x, y) {
    const lastX = columns - 1;
    const lastY = rows - 1;
    const centerX = Math.round(lastX * 0.5);

    if (pinStyle === "side") {
      return x === 0;
    }

    if (pinStyle === "fourCorners") {
      return (y === 0 || y === lastY) && (x === 0 || x === lastX);
    }

    if (pinStyle === "randomTacks") {
      if (y === 0 && (x === 0 || x === lastX || nearColumn(x, centerX, 1))) return true;
      if (y > Math.round(lastY * 0.42)) return false;
      if (x < 3 || x > lastX - 3 || y < 2) return false;
      const xBucket = Math.round(columns / 9);
      const yBucket = Math.round(rows / 7);
      return x % xBucket === Math.floor(xBucket * 0.37) && y % yBucket === Math.floor(yBucket * 0.58) && pinHash(x, y) > 0.28;
    }

    if (y !== 0) return false;

    if (pinStyle === "center") {
      return nearColumn(x, centerX, Math.max(1, Math.round(columns * 0.018)));
    }

    if (pinStyle === "corners") return x === 0 || x === lastX;

    if (pinStyle === "tabs") {
      const tabEvery = Math.max(6, Math.round(columns / 9));
      return x === 0 || x === lastX || x % tabEvery === 0;
    }

    if (pinStyle === "clothesline") {
      const anchors = 7;
      for (let i = 0; i < anchors; i += 1) {
        const anchorX = Math.round((lastX * i) / (anchors - 1));
        if (nearColumn(x, anchorX, 1)) return true;
      }
      return false;
    }

    return true;
  }

  function id(x, y) {
    return y * columns + x;
  }

  function edgeKey(a, b) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  for (let y = 0; y < rows; y += 1) {
    const v = y / (rows - 1);
    const sag = v * v * height * 0.085;
    for (let x = 0; x < columns; x += 1) {
      const u = x / (columns - 1);
      const sx = (u - 0.5) * width;
      const sy = 1.02 - v * height - sag;
      const pleat = Math.sin(u * Math.PI * 2 * foldCount) * foldStrength * Math.sin(v * Math.PI);
      const p = makePoint(sx + pleat * 0.18, sy, pleat, isPinned(x, y));
      const index = id(x, y);
      points[index] = p;
      positions[index * 3] = p.x;
      positions[index * 3 + 1] = p.y;
      positions[index * 3 + 2] = p.z;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = 1 - v;
    }
  }

  function addConstraint(a, b, rest, kind) {
    const c = { a, b, rest, kind, active: true, broken: false, healProgress: 0, cutId: 0 };
    constraints.push(c);
    constraintMap.set(edgeKey(a, b), c);
    constraintsByPoint[a].push(c);
    constraintsByPoint[b].push(c);
    return c;
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      if (x < columns - 1) addConstraint(id(x, y), id(x + 1, y), restX, "warp");
      if (y < rows - 1) addConstraint(id(x, y), id(x, y + 1), restY, "weft");
      if (x < columns - 1 && y < rows - 1) {
        const diag = Math.sqrt(restX * restX + restY * restY);
        addConstraint(id(x, y), id(x + 1, y + 1), diag, "bias");
        addConstraint(id(x + 1, y), id(x, y + 1), diag, "bias");
      }
      if (x < columns - 2) addConstraint(id(x, y), id(x + 2, y), restX * 2, "bend");
      if (y < rows - 2) addConstraint(id(x, y), id(x, y + 2), restY * 2, "bend");
    }
  }

  for (let y = 0; y < rows - 1; y += 1) {
    addConstraint(id(0, y), id(0, y + 1), restY, "hem");
    addConstraint(id(columns - 1, y), id(columns - 1, y + 1), restY, "hem");
  }

  const triangles = [];
  const drawIndices = [];
  function addTri(a, b, c) {
    function rest(pa, pb) {
      const p1 = points[pa];
      const p2 = points[pb];
      const dx = p2.ox - p1.ox;
      const dy = p2.oy - p1.oy;
      const dz = p2.oz - p1.oz;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
    }
    const pa = points[a];
    const pb = points[b];
    const pc = points[c];
    const restArea = (pb.ox - pa.ox) * (pc.oy - pa.oy) - (pb.oy - pa.oy) * (pc.ox - pa.ox);
    const tri = {
      a,
      b,
      c,
      edgePairs: [[a, b, edgeKey(a, b)], [b, c, edgeKey(b, c)], [c, a, edgeKey(c, a)]],
      rAB: rest(a, b),
      rBC: rest(b, c),
      rCA: rest(c, a),
      restArea,
      hidden: false,
      cutId: 0,
      healProgress: 0,
      culled: false,
      cullHold: 0,
    };
    triangles.push(tri);
    for (const edge of tri.edgePairs) {
      let list = edgeToTriangles.get(edge[2]);
      if (!list) {
        list = [];
        edgeToTriangles.set(edge[2], list);
      }
      list.push(tri);
    }
    trianglesByPoint[a].push(tri);
    trianglesByPoint[b].push(tri);
    trianglesByPoint[c].push(tri);
    drawIndices.push(a, b, c);
  }

  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < columns - 1; x += 1) {
      const a = id(x, y);
      const b = id(x + 1, y);
      const c = id(x, y + 1);
      const d = id(x + 1, y + 1);
      addTri(a, c, b);
      addTri(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(drawIndices);
  geometry.computeVertexNormals();

  return {
    columns,
    rows,
    width,
    height,
    restX,
    restY,
    positions,
    colors,
    uvs,
    points,
    constraints,
    constraintMap,
    constraintsByPoint,
    trianglesByPoint,
    edgeToTriangles,
    triangles,
    drawIndices: geometry.index.array,
    geometry,
    frame: 0,
    triangleDirty: true,
    lastCutTime: -999,
    nextCutId: 1,
    cuts: [],
  };
}

export function createFabricWall({ THREE, scene, sharedUniforms, config }) {
  const wallConfig = config.wall;
  const interactionConfig = config.interaction;

  // Top-level init aliases like `fabricColor` land in `wall.fabricColor`,
  // while the fabric renderer itself uses `wall.baseColor`. Resolve that
  // before building any color targets so fabric cold-starts the same way it
  // behaves after selecting/changing it through controls.
  if (wallConfig.fabricColor && !wallConfig.baseColor) {
    wallConfig.baseColor = wallConfig.fabricColor;
  } else if (wallConfig.fabricColor) {
    wallConfig.baseColor = wallConfig.fabricColor;
  }

  const colorTargets = makeColorTargets(THREE, wallConfig, colorKeys);
  const currentColors = makeColorTargets(THREE, wallConfig, colorKeys);
  const tempColor = new THREE.Color();
  let fabricTexture = null;
  let fabricTextureKey = "";
  let backgroundTexture = null;
  let backgroundTextureKey = "";

  function makeFabricTexture() {
    // Keep startup cheap: this tile is intentionally small and drawn with canvas
    // primitives instead of a 2048x2048 per-pixel ImageData loop.
    const size = 768;
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(size, size)
      : document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const strength = clamp(Number(config.wall.threadStrength || 0.248), 0, 0.8);
    const scale = Math.max(140, Number(config.wall.threadScale || 430));
    const yarnScale = clamp(scale / 430, 0.5, 1.8);

    ctx.fillStyle = "rgb(226,226,226)";
    ctx.fillRect(0, 0, size, size);

    const satin = ctx.createLinearGradient(0, 0, size, size);
    satin.addColorStop(0, "rgba(255,255,255,0.22)");
    satin.addColorStop(0.35, "rgba(176,176,176,0.08)");
    satin.addColorStop(0.68, "rgba(255,255,255,0.18)");
    satin.addColorStop(1, "rgba(140,140,140,0.10)");
    ctx.fillStyle = satin;
    ctx.fillRect(0, 0, size, size);

    const warpStep = Math.max(3.5, 6.5 / yarnScale);
    const weftStep = Math.max(4.5, 8.0 / yarnScale);
    const warpAlpha = 0.045 + strength * 0.13;
    const weftAlpha = 0.028 + strength * 0.08;

    ctx.lineWidth = 1;
    for (let x = 0; x < size; x += warpStep) {
      const wave = Math.sin(x * 0.031) * 1.25;
      ctx.strokeStyle = `rgba(255,255,255,${warpAlpha})`;
      ctx.beginPath();
      ctx.moveTo(x + wave, 0);
      ctx.lineTo(x - wave * 0.5, size);
      ctx.stroke();

      ctx.strokeStyle = `rgba(42,42,42,${warpAlpha * 0.42})`;
      ctx.beginPath();
      ctx.moveTo(x + warpStep * 0.48, 0);
      ctx.lineTo(x + warpStep * 0.48 - wave, size);
      ctx.stroke();
    }

    for (let y = 0; y < size; y += weftStep) {
      const wave = Math.sin(y * 0.024) * 1.7;
      ctx.strokeStyle = `rgba(255,255,255,${weftAlpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y + wave);
      ctx.lineTo(size, y - wave * 0.35);
      ctx.stroke();

      ctx.strokeStyle = `rgba(35,35,35,${weftAlpha * 0.55})`;
      ctx.beginPath();
      ctx.moveTo(0, y + weftStep * 0.52);
      ctx.lineTo(size, y + weftStep * 0.52 + wave * 0.25);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.05 + strength * 0.08;
    for (let i = 0; i < 230; i += 1) {
      const x = (hash01(i * 19.37) * size) | 0;
      const y = (hash01(i * 31.91) * size) | 0;
      const len = 8 + hash01(i * 7.13) * 22;
      ctx.strokeStyle = hash01(i * 5.7) > 0.5 ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + len * 0.18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7.2, 5.4);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  function syncFabricTexture(force = false) {
    const key = `${Math.round(Number(config.wall.threadStrength || 0.28) * 1000)}:${Math.round(Number(config.wall.threadScale || 210))}`;
    if (!force && key === fabricTextureKey && fabricTexture) return;
    const nextTexture = makeFabricTexture();
    const oldTexture = fabricTexture;
    fabricTexture = nextTexture;
    fabricTextureKey = key;
    material.map = fabricTexture;
    material.needsUpdate = true;
    if (oldTexture) oldTexture.dispose();
  }


  function makeBackgroundTexture(baseColor = currentColors.baseColor) {
    const width = 1024;
    const height = 1024;
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);

    const shadow = derivedHslColor(THREE, baseColor, Math.max(0.012, hsl.l * 0.10), 1.05, 0.06);
    const low = derivedHslColor(THREE, baseColor, clamp(hsl.l * 0.24 + 0.015, 0.035, 0.18), 1.04, 0.04);
    const mid = derivedHslColor(THREE, baseColor, clamp(hsl.l * 0.58 + 0.035, 0.11, 0.42), 0.9, 0.02);
    const high = derivedHslColor(THREE, baseColor, clamp(hsl.l * 1.12 + 0.14, 0.32, 0.78), 0.62, -0.04);

    const sweep = ctx.createLinearGradient(0, 0, width, height);
    sweep.addColorStop(0, colorToCssRgb(high));
    sweep.addColorStop(0.22, colorToCssRgb(mid));
    sweep.addColorStop(0.58, colorToCssRgb(low));
    sweep.addColorStop(1, colorToCssRgb(shadow));
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.25, height * 0.18, 0, width * 0.28, height * 0.18, width * 0.82);
    glow.addColorStop(0, colorToCssRgba(high, 0.62));
    glow.addColorStop(0.42, colorToCssRgba(mid, 0.20));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const lowerShade = ctx.createRadialGradient(width * 0.72, height * 0.92, 0, width * 0.72, height * 0.92, width * 0.76);
    lowerShade.addColorStop(0, colorToCssRgba(shadow, 0.58));
    lowerShade.addColorStop(0.48, colorToCssRgba(low, 0.26));
    lowerShade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lowerShade;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "multiply";
    const vignette = ctx.createRadialGradient(width * 0.46, height * 0.32, width * 0.22, width * 0.5, height * 0.5, width * 0.86);
    vignette.addColorStop(0, "rgba(255,255,255,1)");
    vignette.addColorStop(0.66, "rgba(165,165,165,1)");
    vignette.addColorStop(1, "rgba(30,30,36,1)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function syncBackgroundTexture(force = false) {
    const hsl = { h: 0, s: 0, l: 0 };
    currentColors.baseColor.getHSL(hsl);
    const key = `${Math.round(hsl.h * 360)}:${Math.round(hsl.s * 100)}:${Math.round(hsl.l * 100)}`;
    if (!force && key === backgroundTextureKey && backgroundTexture) return;
    const nextTexture = makeBackgroundTexture(currentColors.baseColor);
    const oldTexture = backgroundTexture;
    backgroundTexture = nextTexture;
    backgroundTextureKey = key;
    backgroundMaterial.map = backgroundTexture;
    backgroundMaterial.needsUpdate = true;
    if (oldTexture) oldTexture.dispose();
  }

  function syncBackgroundColor() {
    // Keep this cheap on cold start: do not regenerate canvas textures while
    // the fabric color is transitioning. The background is a dramatic vertex
    // gradient derived from the current fabric color and updates by changing
    // four vertex colors only.
    const geometry = backgroundMesh.geometry;
    const colorAttr = geometry.attributes.color;
    if (!colorAttr) return;

    const baseColor = currentColors.baseColor;
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);

    const high = derivedHslColor(THREE, baseColor, clamp(hsl.l * 1.18 + 0.14, 0.34, 0.82), 0.62, -0.04);
    const mid = derivedHslColor(THREE, baseColor, clamp(hsl.l * 0.62 + 0.035, 0.12, 0.46), 0.9, 0.02);
    const low = derivedHslColor(THREE, baseColor, clamp(hsl.l * 0.24 + 0.012, 0.035, 0.18), 1.05, 0.04);
    const shadow = derivedHslColor(THREE, baseColor, Math.max(0.012, hsl.l * 0.08), 1.08, 0.06);

    const positions = geometry.attributes.position.array;
    for (let i = 0; i < colorAttr.count; i += 1) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const diagonal = clamp((x * -0.55 + y * 0.75 + 1.25) * 0.42, 0, 1);
      const vertical = clamp((y + 1.1) * 0.46, 0, 1);
      const c = tempColor;
      mixColor(c, shadow, low, vertical);
      mixColor(c, c, mid, diagonal * 0.72);
      mixColor(c, c, high, clamp(diagonal * vertical * 1.35, 0, 0.88));
      colorAttr.setXYZ(i, c.r, c.g, c.b);
    }

    colorAttr.needsUpdate = true;
    backgroundMaterial.color.set(0xffffff);
  }



  function createBackgroundGeometry(wall) {
    const width = Number(wall.backgroundWidth || Math.max(Number(wall.width || 2.28) * 1.36, 3.0));
    const height = Number(wall.backgroundHeight || 2.62);
    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
    return geometry;
  }

  let state = buildFabricState(THREE, wallConfig);
  const backgroundMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    depthTest: false,
  });
  const backgroundMesh = new THREE.Mesh(
    createBackgroundGeometry(wallConfig),
    backgroundMaterial,
  );
  backgroundMesh.position.set(0, -0.08, -0.34);
  backgroundMesh.renderOrder = 0;
  scene.add(backgroundMesh);

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: wallConfig.opacity,
    depthWrite: false,
    depthTest: false,
  });
  syncBackgroundColor();
  syncFabricTexture(true);
  const mesh = new THREE.Mesh(state.geometry, material);
  mesh.renderOrder = 1;
  scene.add(mesh);


  let lastPulse = 0;
  let lastClickId = 0;
  let lastPointerDown = 0;
  let lastCutX = null;
  let lastCutY = null;

  function rebuildGeometry() {
    const oldGeometry = state.geometry;
    state = buildFabricState(THREE, config.wall);
    mesh.geometry = state.geometry;
    oldGeometry.dispose();

    const oldBackgroundGeometry = backgroundMesh.geometry;
    backgroundMesh.geometry = createBackgroundGeometry(config.wall);
    oldBackgroundGeometry.dispose();
    syncBackgroundColor();
  }

  function applyConstraint(c, stiffness) {
    if (!c.active) return;
    const kindFactor = c.kind === "bias" ? 0.55 : c.kind === "bend" ? Number(config.wall.bendStability || 0.28) : c.kind === "hem" ? 1.15 : 1;
    const a = state.points[c.a];
    const b = state.points[c.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
    const healBoost = c.healProgress > 0 ? 0.35 + c.healProgress * 0.9 : 1;
    const diff = ((dist - c.rest) / dist) * stiffness * healBoost * kindFactor;
    let aw = a.pinned ? 0 : 0.5;
    let bw = b.pinned ? 0 : 0.5;
    if (a.pinned && !b.pinned) bw = 1;
    if (!a.pinned && b.pinned) aw = 1;
    if (a.pinned && b.pinned) return;
    const ox = dx * diff;
    const oy = dy * diff;
    const oz = dz * diff;
    a.x += ox * aw;
    a.y += oy * aw;
    a.z += oz * aw;
    b.x -= ox * bw;
    b.y -= oy * bw;
    b.z -= oz * bw;
  }

  function integrate(delta, time) {
    const dt = clamp(delta || 0.016, 0.001, 0.033);
    const gravity = Number(config.wall.gravity || 0.72) * dt * dt;
    const damping = clamp(Number(config.wall.damping || 0.988), 0.9, 0.9995);
    const wind = Number(config.wall.windStrength || 0) * dt;
    const windSpeed = Number(config.wall.windSpeed || 0.8);
    const pointer = sharedUniforms.uPointerSmooth.value;
    const pointerVelocity = sharedUniforms.uPointerVelocity.value;
    const pointerDown = sharedUniforms.uPointerDown.value;
    const radius = Math.max(0.001, Number(interactionConfig.cursorRadius || 0.32));
    const radiusSq = radius * radius;
    const cursorStrength = 0.16;
    const brushStrength = 0.055;
    const wakeStrength = 0.12;
    const velocityScale = 1;
    const grabStrength = Number(config.wall.grabStrength || 0.85);
    const hoverPush = Number(config.wall.hoverPush || 0.08);
    const hoverLift = Number(config.wall.hoverLift || 0.15);
    const depthScale = Number(config.wall.depthScale || 0.38);
    const foldStrength = Number(config.wall.foldStrength || 0);
    const foldCount = Number(config.wall.foldCount || 6.5);
    const edgeStability = Number(config.wall.edgeStability || 0.24);

    for (let i = 0; i < state.points.length; i += 1) {
      const p = state.points[i];
      p.fray *= 0.988;

      if (p.pinned) {
        p.x = p.ox;
        p.y = p.oy;
        p.z = p.oz + Math.sin(time * 0.7 + i * 0.03) * 0.004;
        p.px = p.x;
        p.py = p.y;
        p.pz = p.z;
        continue;
      }

      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      const vz = (p.z - p.pz) * damping;
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;

      const u = (i % state.columns) / (state.columns - 1);
      const v = Math.floor(i / state.columns) / (state.rows - 1);
      const fold = Math.sin(u * Math.PI * 2 * foldCount + time * 0.22) * foldStrength * Math.sin(v * Math.PI);
      const air = Math.sin(time * windSpeed + u * 9.0 + v * 5.0) * wind * Math.sin(v * Math.PI);

      p.x += vx + air * 0.45;
      p.y += vy - gravity;
      p.z += vz + (fold - p.z) * 0.006 + air * depthScale;

      const column = i % state.columns;
      const row = Math.floor(i / state.columns);
      const edgeColumn = column === 0 || column === state.columns - 1;
      if (edgeColumn) {
        const edgeT = edgeStability * (0.45 + v * 0.55);
        p.x += (p.ox - p.x) * edgeT * 0.045;
        p.z += (p.oz - p.z) * edgeT * 0.025;
      }
      if (row === state.rows - 1) {
        p.z += (p.oz - p.z) * 0.012;
      }
      const maxSide = state.width * 0.64;
      p.x = clamp(p.x, -maxSide, maxSide);
      p.z = clamp(p.z, -0.52, 0.52);

      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < radiusSq) {
        const d = Math.sqrt(dSq) || 0.0001;
        const falloff = (1 - d / radius) ** 2;
        const force = falloff * cursorStrength;
        p.z += (hoverPush + pointerDown * hoverLift) * force + Math.abs(pointerVelocity.x) * force * wakeStrength * 0.018;
        p.x += pointerVelocity.x * force * Number(config.wall.dragStrength || 0.42) * velocityScale * (0.75 + brushStrength * 2.0);
        p.y += pointerVelocity.y * velocityScale * force * Number(config.wall.dragStrength || 0.42);

        if (pointerDown > 0.05) {
          const cutting = config.wall.tearEnabled !== false;
          const grab = cutting ? grabStrength * 0.32 : grabStrength * 0.56;
          p.x += (pointer.x - p.x) * force * grab * pointerDown;
          p.y += (pointer.y - p.y) * force * grab * pointerDown;
        }
      }
    }
  }

  function solveConstraints() {
    const iterations = clamp(Math.round(config.wall.constraintIterations || 6), 1, 14);
    const stiffness = clamp(Number(config.wall.stiffness || 0.92), 0.05, 1);
    for (let i = 0; i < iterations; i += 1) {
      for (const c of state.constraints) applyConstraint(c, stiffness);
    }
  }

  function triangleIsStretched(tri) {
    const maxStretch = Math.max(1.05, Number(config.wall.maxTriangleStretch || 1.45));
    const a = state.points[tri.a];
    const b = state.points[tri.b];
    const c = state.points[tri.c];
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const restSign = Math.sign(tri.restArea || 1);
    if (Math.abs(area) < state.restX * state.restY * 0.18) return true;
    if (Math.sign(area || restSign) !== restSign) return true;

    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;
    const nz = ux * vy - uy * vx;
    const normalLen = Math.sqrt((uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + nz * nz) || 0.0001;
    if (Math.abs(nz / normalLen) < 0.18) return true;
    function tooLong(p1, p2, rest) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) > rest * maxStretch;
    }
    return tooLong(a, b, tri.rAB) || tooLong(b, c, tri.rBC) || tooLong(c, a, tri.rCA);
  }

  function triangleHasCutInfluence(tri) {
    if (tri.hidden || tri.cutId > 0) return true;
    return state.points[tri.a].fray > 0.02 || state.points[tri.b].fray > 0.02 || state.points[tri.c].fray > 0.02;
  }

  function updateTriangleIndexBuffer(force = false) {
    state.frame = (state.frame || 0) + 1;
    const hasOpenCut = state.cuts && state.cuts.some((cut) => !cut.healed);
    const shouldRefresh = force || state.triangleDirty || hasOpenCut || state.frame % 6 === 0;
    if (!shouldRefresh) return;

    let changed = false;
    const index = state.drawIndices;
    for (let i = 0; i < state.triangles.length; i += 1) {
      const tri = state.triangles[i];
      const offset = i * 3;
      const cutInfluenced = hasOpenCut && triangleHasCutInfluence(tri);
      const unstable = tri.hidden || (cutInfluenced && triangleIsStretched(tri));
      if (unstable) {
        tri.cullHold = Math.max(tri.cullHold || 0, tri.hidden ? 18 : 8);
      } else if (tri.cullHold > 0) {
        tri.cullHold = Math.max(0, tri.cullHold - (hasOpenCut ? 1 : 3));
      }
      const culled = (tri.cullHold || 0) > 0;
      if (tri.culled !== culled) changed = true;
      tri.culled = culled;
      if (culled) {
        if (index[offset] !== tri.a || index[offset + 1] !== tri.a || index[offset + 2] !== tri.a) changed = true;
        index[offset] = tri.a;
        index[offset + 1] = tri.a;
        index[offset + 2] = tri.a;
      } else {
        if (index[offset] !== tri.a || index[offset + 1] !== tri.b || index[offset + 2] !== tri.c) changed = true;
        index[offset] = tri.a;
        index[offset + 1] = tri.b;
        index[offset + 2] = tri.c;
      }
    }
    if (changed || state.triangleDirty) state.geometry.index.needsUpdate = true;
    state.triangleDirty = false;
  }

  function deriveTone(color, lightness, saturationShift = 0) {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return new THREE.Color().setHSL(hsl.h, clamp(hsl.s + saturationShift, 0, 1), clamp(lightness, 0, 1));
  }


  function updateBuffers(time = 0) {
    const pos = state.positions;
    const col = state.colors;
    const normals = state.geometry.attributes.normal.array;
    const pointer = sharedUniforms.uPointerSmooth.value;
    const radius = Math.max(0.001, Number(interactionConfig.cursorRadius || 0.28));
    const threadStrength = Number(config.wall.threadStrength || 0.22) * 0.32;
    const threadScale = Number(config.wall.threadScale || 130) * 0.72;
    const crossThreadStrength = Number(config.wall.crossThreadStrength || 0.12) * 0.32;
    const sheenStrength = Number(config.wall.sheenStrength || 0.58);
    const shadowStrength = Number(config.wall.shadowStrength || 0.74);
    const edgeDarkness = Number(config.wall.edgeDarkness || 0.18);
    const frayStrength = Number(config.wall.frayStrength || 0.4);
    const base = currentColors.baseColor;
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    const shadowColor = deriveTone(base, Math.max(0.025, hsl.l * 0.18), 0.06);
    const deepShadowColor = deriveTone(base, Math.max(0.012, hsl.l * 0.07), 0.08);
    const highlightColor = deriveTone(base, Math.min(0.92, hsl.l + 0.28), -0.12);
    const cursorColor = highlightColor.clone();
    const frayColor = deriveTone(base, Math.min(0.86, hsl.l + 0.18), -0.04);

    for (let i = 0; i < state.points.length; i += 1) {
      const p = state.points[i];
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
    }

    state.geometry.attributes.position.needsUpdate = true;
    updateTriangleIndexBuffer();
    state.geometry.computeVertexNormals();

    for (let i = 0; i < state.points.length; i += 1) {
      const p = state.points[i];
      const u = (i % state.columns) / (state.columns - 1);
      const v = Math.floor(i / state.columns) / (state.rows - 1);
      const nx = normals[i * 3] || 0;
      const ny = normals[i * 3 + 1] || 0;
      const nz = normals[i * 3 + 2] || 1;
      const colIndex = i % state.columns;
      const left = state.points[Math.max(0, i - 1)];
      const right = state.points[Math.min(state.points.length - 1, i + 1)];
      const hasNeighbors = colIndex > 0 && colIndex < state.columns - 1;
      const foldCurve = hasNeighbors ? Math.abs(left.z + right.z - p.z * 2) / Math.max(0.0001, state.restX * 1.8) : 0;
      const foldValley = hasNeighbors ? clamp((p.z - Math.max(left.z, right.z)) / -0.055, 0, 1) : 0;
      const light = clamp(nx * -0.42 + ny * 0.22 + nz * 0.86 + 0.22, 0, 1);
      const foldShadow = clamp((1 - light) * shadowStrength * 0.9 + foldCurve * 0.32 + foldValley * 0.98, 0, 1);
      const sheenBand = Math.sin((u * 9.0 + p.z * 5.4 - v * 1.7) + time * 0.18) * 0.5 + 0.5;
      const anisotropic = Math.pow(clamp(Math.abs(nx) * 1.15 + nz * 0.32 + sheenBand * 0.18, 0, 1), 2.15) * sheenStrength * (0.68 + v * 0.32);
      const warp = Math.sin(u * threadScale * Math.PI * 2) * threadStrength;
      const weft = Math.sin(v * threadScale * Math.PI * 2.35 + u * 0.9) * crossThreadStrength;
      const micro = Math.sin((u + v * 0.55) * threadScale * Math.PI * 1.7) * threadStrength * 0.24;
      const thread = warp * 0.38 + weft * 0.34 + micro;
      const edge = (Math.abs(u - 0.5) * 2) ** 2 * edgeDarkness;
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const touch = clamp(1 - Math.sqrt(dx * dx + dy * dy) / radius, 0, 1) ** 2;
      const fray = clamp(p.fray * frayStrength, 0, 1);

      mixColor(tempColor, base, shadowColor, clamp(foldShadow * 0.94 + edge - Math.max(thread, 0) * 0.16, 0, 1));
      mixColor(tempColor, tempColor, deepShadowColor, clamp(foldValley * 0.72 + foldCurve * 0.18, 0, 0.9));
      mixColor(tempColor, tempColor, highlightColor, clamp(anisotropic * 0.78 + Math.max(thread, 0) * 0.12 + light * 0.06, 0, 0.68));
      // Torn vertices get a subtle darkened, abraded edge color without adding a visible stitch overlay.
      mixColor(tempColor, tempColor, deepShadowColor, fray * 0.46);
      mixColor(tempColor, tempColor, frayColor, fray * 0.14);
      mixColor(tempColor, tempColor, cursorColor, touch * 0.13);
      tempColor.multiplyScalar(clamp(0.92 + thread * 0.42 + anisotropic * 0.14 + light * 0.05, 0.34, 1.18));

      col[i * 3] = tempColor.r;
      col[i * 3 + 1] = tempColor.g;
      col[i * 3 + 2] = tempColor.b;
    }

    state.geometry.attributes.color.needsUpdate = true;
  }

  function collectCutCandidates(ax, ay, bx, by, radius) {
    const minX = Math.min(ax, bx) - radius;
    const maxX = Math.max(ax, bx) + radius;
    const minY = Math.min(ay, by) - radius;
    const maxY = Math.max(ay, by) + radius;
    const colMin = clamp(Math.floor(((minX / state.width) + 0.5) * (state.columns - 1)) - 3, 0, state.columns - 1);
    const colMax = clamp(Math.ceil(((maxX / state.width) + 0.5) * (state.columns - 1)) + 3, 0, state.columns - 1);
    const topY = 1.02;
    const rowMin = clamp(Math.floor(((topY - maxY) / state.height) * (state.rows - 1)) - 3, 0, state.rows - 1);
    const rowMax = clamp(Math.ceil(((topY - minY) / state.height) * (state.rows - 1)) + 3, 0, state.rows - 1);
    const candidateConstraints = new Set();
    const candidateTriangles = new Set();

    for (let y = rowMin; y <= rowMax; y += 1) {
      for (let x = colMin; x <= colMax; x += 1) {
        const index = y * state.columns + x;
        for (const c of state.constraintsByPoint[index]) candidateConstraints.add(c);
        for (const tri of state.trianglesByPoint[index]) candidateTriangles.add(tri);
      }
    }

    return { constraints: candidateConstraints, triangles: candidateTriangles };
}

  function cutAt(pointer, velocity, time, options = {}) {
    if (config.wall.tearEnabled === false) return false;
    const cooldown = options.force ? 0 : Number(config.wall.cutCooldown || 0.045);
    if (time - state.lastCutTime < cooldown) return false;
    state.lastCutTime = time;

    const speed = velocity.length();
    const angle = options.angle ?? (speed > 0.002 ? Math.atan2(velocity.y, velocity.x) : -0.22);
    const lengthBoost = options.length || 1;
    const pulseStrength = clamp(Number(interactionConfig.pulseStrength ?? 0.7), 0, 2);
    const pulseRadiusScale = clamp(Number(interactionConfig.pulseRadius ?? 2) / 2, 0.35, 1.35);
    const cutStrength = clamp(Number(config.wall.cutStrength ?? 0.43) * (0.72 + pulseStrength * 0.4), 0, 1.25);
    const cutScale = 0.7 + cutStrength * 0.7;
    const clickReliability = options.click ? 1.18 : 1;
    const half = Number(config.wall.cutLength || 0.28) * lengthBoost * pulseRadiusScale * (0.86 + cutStrength * 0.28) * 0.5 * clickReliability;
    const width = Math.max(Number(config.wall.cutWidth || 0.043) * cutScale, options.click ? Math.min(state.restX, state.restY) * 1.65 : 0);
    const ax = pointer.x - Math.cos(angle) * half;
    const ay = pointer.y - Math.sin(angle) * half;
    const bx = pointer.x + Math.cos(angle) * half;
    const by = pointer.y + Math.sin(angle) * half;
    const opening = Number(config.wall.tearOpening || 0.022) * (0.72 + cutStrength * 0.65) * (0.75 + pulseStrength * 0.25);
    const cutId = state.nextCutId;
    state.nextCutId += 1;

    const cut = { id: cutId, time, healed: false, ax, ay, bx, by, width, constraints: [], triangles: [], guardTriangles: [], points: new Set() };

    const candidates = collectCutCandidates(ax, ay, bx, by, width + Math.max(state.restX, state.restY) * 5);

    for (const c of candidates.constraints) {
      if (!c.active) continue;
      const a = state.points[c.a];
      const b = state.points[c.b];
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const hit = distanceToSegment(mx, my, ax, ay, bx, by);
      if (hit.distance < width) {
        c.active = false;
        c.broken = true;
        c.healProgress = 0;
        c.cutId = cutId;
        cut.constraints.push({ constraint: c, along: hit.along });
        const adjacent = state.edgeToTriangles.get(c.a < c.b ? `${c.a}:${c.b}` : `${c.b}:${c.a}`) || [];
        for (const tri of adjacent) {
          if (tri.cutId === 0) {
            tri.cutId = cutId;
            cut.guardTriangles.push(tri);
          }
        }
        cut.points.add(c.a);
        cut.points.add(c.b);

        a.fray = Math.max(a.fray, 1);
        b.fray = Math.max(b.fray, 1);
        const side = Math.sign((mx - pointer.x) * Math.sin(angle) - (my - pointer.y) * Math.cos(angle)) || 1;
        if (!a.pinned) {
          a.x += Math.sin(angle) * opening * side;
          a.y -= Math.cos(angle) * opening * side;
          a.z += opening * 0.25;
        }
        if (!b.pinned) {
          b.x += Math.sin(angle) * opening * side;
          b.y -= Math.cos(angle) * opening * side;
          b.z += opening * 0.25;
        }
      }
    }

    for (const tri of candidates.triangles) {
      if (tri.hidden) continue;
      const a = state.points[tri.a];
      const b = state.points[tri.b];
      const c = state.points[tri.c];
      const cx = (a.x + b.x + c.x) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      const hit = distanceToSegment(cx, cy, ax, ay, bx, by);
      const va = distanceToSegment(a.x, a.y, ax, ay, bx, by).distance;
      const vb = distanceToSegment(b.x, b.y, ax, ay, bx, by).distance;
      const vc = distanceToSegment(c.x, c.y, ax, ay, bx, by).distance;
      if (hit.distance < width * 0.72 || Math.min(va, vb, vc) < width * 0.55) {
        tri.hidden = true;
        tri.cutId = cutId;
        tri.healProgress = 0;
        cut.triangles.push({ triangle: tri, along: hit.along });
        cut.points.add(tri.a);
        cut.points.add(tri.b);
        cut.points.add(tri.c);
        state.points[tri.a].fray = Math.max(state.points[tri.a].fray, 1);
        state.points[tri.b].fray = Math.max(state.points[tri.b].fray, 1);
        state.points[tri.c].fray = Math.max(state.points[tri.c].fray, 1);
      }
    }

    if (cut.constraints.length || cut.triangles.length) {
      state.triangleDirty = true;
      state.cuts.push(cut);
      return true;
    }
    return false;
  }

  function healCuts(time) {
    if (config.wall.selfHeal === false || !state.cuts.length) return;
    const delay = Math.max(0, Number(config.wall.healDelay || 2.4));
    const duration = Math.max(0.05, Number(config.wall.healDuration || 1.65));
    const pull = Number(config.wall.healPull || 0.18);

    for (const cut of state.cuts) {
      if (cut.healed) continue;
      const raw = (time - cut.time - delay) / duration;
      if (raw <= 0) continue;
      const progress = smoothstep(0, 1, clamp(raw, 0, 1));

      for (const item of cut.constraints) {
        const c = item.constraint;
        if (!c.broken) continue;
        const local = smoothstep(item.along - 0.2, item.along + 0.2, progress);
        c.healProgress = local;
        const a = state.points[c.a];
        const b = state.points[c.b];
        if (!a.pinned) {
          a.x += (a.ox - a.x) * pull * local * 0.012;
          a.y += (a.oy - a.y) * pull * local * 0.006;
        }
        if (!b.pinned) {
          b.x += (b.ox - b.x) * pull * local * 0.012;
          b.y += (b.oy - b.y) * pull * local * 0.006;
        }
        if (local > 0.35) c.active = true;
        if (local > 0.98) {
          c.broken = false;
          c.healProgress = 0;
          c.cutId = 0;
        }
      }

      for (const item of cut.triangles) {
        const tri = item.triangle;
        if (!tri.hidden) continue;
        const local = smoothstep(item.along - 0.15, item.along + 0.15, progress);
        tri.healProgress = local;
        if (local > 0.82 && !triangleIsStretched(tri)) {
          tri.hidden = false;
          state.triangleDirty = true;
          tri.cutId = 0;
          tri.healProgress = 0;
        }
      }

      if (progress >= 1) {
        for (const item of cut.constraints) {
          item.constraint.active = true;
          item.constraint.broken = false;
          item.constraint.healProgress = 0;
          item.constraint.cutId = 0;
        }
        for (const pointIndex of cut.points) {
          const p = state.points[pointIndex];
          if (!p || p.pinned) continue;
          p.x += (p.ox - p.x) * pull * 0.08;
          p.y += (p.oy - p.y) * pull * 0.045;
          p.z += (p.oz - p.z) * pull * 0.08;
          p.px = p.x;
          p.py = p.y;
          p.pz = p.z;
          p.fray *= 0.35;
        }
        for (const item of cut.triangles) {
          item.triangle.hidden = false;
          state.triangleDirty = true;
          item.triangle.cutId = 0;
          item.triangle.healProgress = 0;
          item.triangle.culled = false;
          item.triangle.cullHold = 0;
        }
        for (const tri of cut.guardTriangles || []) {
          if (!tri.hidden) {
            tri.cutId = 0;
            tri.healProgress = 0;
            tri.culled = false;
            tri.cullHold = 0;
          }
        }
        cut.healed = true;
      }
    }

    state.cuts = state.cuts.filter((cut) => !cut.healed || time - cut.time < delay + duration + 0.5);
  }

  function repairStaleHiddenTriangles() {
    if (config.wall.selfHeal === false) return;
    const hasOpenCut = state.cuts.some((cut) => !cut.healed);
    if (hasOpenCut) return;
    for (const tri of state.triangles) {
      if (tri.hidden) {
        tri.hidden = false;
        state.triangleDirty = true;
        tri.cutId = 0;
        tri.healProgress = 0;
        tri.cullHold = 0;
      }
    }
  }

  function syncColors() {
    const speed = clamp(Number(config.global.colorTransitionSpeed ?? config.wall.colorTransitionSpeed ?? 0.08), 0, 1);
    for (const key of colorKeys) {
      currentColors[key].lerp(colorTargets[key], config.global.rotateColors === false ? 1 : speed);
    }
  }

  function set(path, value) {
    const key = path.startsWith("wall.") ? path.slice(5) : path;

    if (path === "global.colorTransitionSpeed") {
      config.global.colorTransitionSpeed = value;
      return true;
    }

    if (key === "fabricColor" || key === "silkColor" || key === "baseColor") {
      colorTargets.baseColor.set(value);
      config.wall.baseColor = value;
      return true;
    }

    if (key === "highlightColor" || key === "cursorColor" || key === "frayColor" || key === "accentColor") {
      colorTargets.baseColor.set(value);
      config.wall.baseColor = value;
      return true;
    }

    if (colorTargets[key]) {
      colorTargets[key].set(value);
      config.wall[key] = value;
      return true;
    }

    config.wall[key] = value;

    if (key === "columns" || key === "rows" || key === "width" || key === "height" || key === "pinStyle") rebuildGeometry();
    if (key === "opacity") material.opacity = value;
    if (key === "threadStrength" || key === "threadScale") syncFabricTexture(true);
    return true;
  }

  return {
    initialWarmupFrames: 4,

    resolvePath(key) {
      return uniformPaths[key] || null;
    },

    set,

    update({ delta = 0.016 } = {}) {
      const time = sharedUniforms.uTime.value;
      syncColors();
      syncBackgroundColor();
      material.opacity = Number(config.wall.opacity ?? 0.98);

      const pulse = sharedUniforms.uClickPulse.value;
      const clickId = sharedUniforms.uClickId?.value || 0;
      if (clickId !== lastClickId) {
        const p = sharedUniforms.uPulsePointer.value;
        cutAt(p, sharedUniforms.uPointerVelocity.value, time, { force: true, click: true });
        lastCutX = p.x;
        lastCutY = p.y;
        lastClickId = clickId;
      } else if (pulse > 0.92 && lastPulse <= 0.92) {
        const p = sharedUniforms.uPulsePointer.value;
        cutAt(p, sharedUniforms.uPointerVelocity.value, time, { force: true, click: true });
        lastCutX = p.x;
        lastCutY = p.y;
      }
      lastPulse = pulse;

      const pointerDown = sharedUniforms.uPointerDown.value;
      const pointer = sharedUniforms.uPointer.value;
      if (pointerDown > 0.15 && config.wall.tearEnabled !== false) {
        if (lastPointerDown <= 0.15 || lastCutX === null) {
          cutAt(pointer, sharedUniforms.uPointerVelocity.value, time, { force: true });
          lastCutX = pointer.x;
          lastCutY = pointer.y;
        } else {
          const dx = pointer.x - lastCutX;
          const dy = pointer.y - lastCutY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const spacing = Math.max(0.035, Number(config.wall.cutSpacing || 0.055));
          if (dist >= spacing) {
            const angle = Math.atan2(dy, dx);
            const p = { x: (lastCutX + pointer.x) * 0.5, y: (lastCutY + pointer.y) * 0.5 };
            const baseLength = Math.max(0.001, Number(config.wall.cutLength || 0.26));
            const length = clamp((dist + baseLength * 0.45) / baseLength, 0.85, 2.6);
            cutAt(p, sharedUniforms.uPointerVelocity.value, time, { force: false, angle, length });
            lastCutX = pointer.x;
            lastCutY = pointer.y;
          }
        }
      } else {
        lastCutX = null;
        lastCutY = null;
      }
      lastPointerDown = pointerDown;

      integrate(delta, time);
      healCuts(time);
      repairStaleHiddenTriangles();
      solveConstraints();
      updateBuffers(time);
    },

    destroy() {
      scene.remove(mesh);
      scene.remove(backgroundMesh);
      state.geometry.dispose();
      backgroundMesh.geometry.dispose();
      if (fabricTexture) fabricTexture.dispose();
      if (backgroundTexture) backgroundTexture.dispose();
      material.dispose();
      backgroundMaterial.dispose();
    },
  };
}

createFabricWall.defaults = fabricDefaults;
createFabricWall.loadControls = () => import("./controls.js").then((module) => module.fabricControls);
