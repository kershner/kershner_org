const GRASS_WALL_VERTEX_SHADER = `
  attribute vec2 aOffset;
  attribute vec2 aScale;
  attribute vec4 aRandom;
  attribute vec4 aShape;

  uniform float uTime;
  uniform float uAspect;
  uniform float uWind;
  uniform float uBreeze;
  uniform vec4 uBreezeGustA;
  uniform vec4 uBreezeGustB;
  uniform vec4 uBreezeGustC;
  uniform vec4 uBreezeGustD;
  uniform vec4 uSettleA;
  uniform vec4 uSettleB;
  uniform vec4 uSettleC;
  uniform vec4 uSettleD;
  uniform vec2 uSettleDirA;
  uniform vec2 uSettleDirB;
  uniform vec2 uSettleDirC;
  uniform vec2 uSettleDirD;
  uniform float uCursorRadius;
  uniform float uCursorStrength;
  uniform float uVerticalPush;
  uniform float uWidthMultiplier;
  uniform float uTipWidth;
  uniform float uHeightMultiplier;
  uniform float uVariation;
  uniform float uTouchBoost;
  uniform float uBrushStrength;
  uniform float uWakeStrength;
  uniform float uPulseStrength;
  uniform float uVelocityStrength;
  uniform float uPointerDown;
  uniform float uClickPulse;
  uniform float uPulseRadius;
  uniform vec2 uPulsePointer;
  uniform vec2 uPointerSmooth;
  uniform vec2 uPointerVelocity;
  uniform vec2 uWakePointer;

  varying vec2 vUv;
  varying float vY;
  varying float vRandom;
  varying float vForce;
  varying vec3 vBladeTint;

  void main() {
    vec3 pos = position;

    float bladeY = uv.y;
    float widthCurve = mix(0.72, 1.45, aShape.x);
    float taper = mix(
      uTipWidth,
      1.0,
      pow(smoothstep(0.0, 0.95, 1.0 - bladeY), widthCurve)
    );
    float bladeEdgeWave = sin(bladeY * 3.14159) * (aShape.y - 0.5) * 0.85 * uVariation;

    pos.x *= aScale.x * taper * uWidthMultiplier;
    pos.x += bladeEdgeWave * aScale.x * uWidthMultiplier;
    pos.y *= aScale.y * uHeightMultiplier;

    vec2 interactionPoint = aOffset + vec2(
      0.0,
      aScale.y * uHeightMultiplier * 0.42
    );

    vec2 pointerDelta = vec2(
      (interactionPoint.x - uPointerSmooth.x) * uAspect,
      interactionPoint.y - uPointerSmooth.y
    );

    float pointerDist = length(pointerDelta);
    float pointerForce = smoothstep(uCursorRadius, 0.0, pointerDist);
    vec2 pointerPush = normalize(pointerDelta + 0.0001) * pointerForce;

    vec2 wakeDelta = vec2(
      (interactionPoint.x - uWakePointer.x) * uAspect,
      interactionPoint.y - uWakePointer.y
    );

    float wakeForce = smoothstep(uCursorRadius * 1.2, 0.0, length(wakeDelta));
    vec2 wakePush = normalize(wakeDelta + 0.0001) * wakeForce;

    vec2 velocity = vec2(uPointerVelocity.x * uAspect, uPointerVelocity.y);
    float velocityAmount = clamp(length(velocity) * uVelocityStrength, 0.0, 1.0);
    vec2 brushDirection = normalize(velocity + 0.0001);

    vec2 pulseDelta = vec2(
      (interactionPoint.x - uPulsePointer.x) * uAspect,
      interactionPoint.y - uPulsePointer.y
    );

    float pulseDist = length(pulseDelta);
    float pulseAge = 1.0 - uClickPulse;
    float pulseRadius = mix(0.06, uPulseRadius, pulseAge);
    float pulseWidth = mix(0.26, 0.09, pulseAge);

    float pulseRing = 1.0 - smoothstep(0.0, pulseWidth, abs(pulseDist - pulseRadius));
    float pulseBreakup = 0.65 + 0.35 * sin(
      dot(interactionPoint, vec2(10.2, 6.8)) +
      uTime * 5.0 +
      aRandom.z * 6.28318
    );

    pulseRing *= uClickPulse * pulseBreakup;

    float breezeAngle =
      sin(uTime * 0.13) * 1.4 +
      sin(uTime * 0.047 + 2.0) * 2.2;

    vec2 breezeDirection = normalize(vec2(
      cos(breezeAngle),
      sin(breezeAngle) * 0.35
    ));

    float gust = 0.45 + 0.55 * pow(
      0.5 + 0.5 * sin(uTime * 0.22 + sin(uTime * 0.09) * 3.0),
      2.0
    );

    float localWave = sin(
      dot(aOffset, vec2(3.2, 1.7)) +
      uTime * mix(0.8, 1.8, aRandom.y) +
      aRandom.z * 12.566
    );

    float windPower = mix(0.45, 1.35, aRandom.w);
    float stiffness = mix(1.45, 0.58, aShape.w);

    vec2 gustADelta = aOffset - uBreezeGustA.xy;
    vec2 gustBDelta = aOffset - uBreezeGustB.xy;
    vec2 gustCDelta = aOffset - uBreezeGustC.xy;
    vec2 gustDDelta = aOffset - uBreezeGustD.xy;

    float gustA = (1.0 - smoothstep(0.0, max(uBreezeGustA.z, 0.001), length(gustADelta))) * uBreezeGustA.w;
    float gustB = (1.0 - smoothstep(0.0, max(uBreezeGustB.z, 0.001), length(gustBDelta))) * uBreezeGustB.w;
    float gustC = (1.0 - smoothstep(0.0, max(uBreezeGustC.z, 0.001), length(gustCDelta))) * uBreezeGustC.w;
    float gustD = (1.0 - smoothstep(0.0, max(uBreezeGustD.z, 0.001), length(gustDDelta))) * uBreezeGustD.w;

    float packetBreakup = 0.62 + 0.38 * sin(
      dot(aOffset, vec2(9.7, 6.3)) +
      uTime * 3.4 +
      aRandom.z * 6.28318
    );

    float breezePackets = abs(gustA + gustB + gustC + gustD) * packetBreakup;

    vec2 gustVector = breezeDirection * breezePackets * uBreeze;

    vec2 settleADelta = vec2((interactionPoint.x - uSettleA.x) * uAspect, interactionPoint.y - uSettleA.y);
    vec2 settleBDelta = vec2((interactionPoint.x - uSettleB.x) * uAspect, interactionPoint.y - uSettleB.y);
    vec2 settleCDelta = vec2((interactionPoint.x - uSettleC.x) * uAspect, interactionPoint.y - uSettleC.y);
    vec2 settleDDelta = vec2((interactionPoint.x - uSettleD.x) * uAspect, interactionPoint.y - uSettleD.y);

    float settleA = (1.0 - smoothstep(0.0, max(uSettleA.z, 0.001), length(settleADelta))) * uSettleA.w;
    float settleB = (1.0 - smoothstep(0.0, max(uSettleB.z, 0.001), length(settleBDelta))) * uSettleB.w;
    float settleC = (1.0 - smoothstep(0.0, max(uSettleC.z, 0.001), length(settleCDelta))) * uSettleC.w;
    float settleD = (1.0 - smoothstep(0.0, max(uSettleD.z, 0.001), length(settleDDelta))) * uSettleD.w;

    vec2 settleVector =
      gustVector * 1.45 +
      uSettleDirA * settleA +
      uSettleDirB * settleB +
      uSettleDirC * settleC +
      uSettleDirD * settleD;

    float settleForce = clamp(length(settleVector), 0.0, 1.0);
    vec2 settleDirection = normalize(settleVector + breezeDirection * 0.0001);

    float interactionOverride = max(
      pointerForce,
      max(wakeForce * velocityAmount, pulseRing)
    );

    float activeOverride = clamp(max(interactionOverride, settleForce), 0.0, 1.0);
    float baseWind = uWind * windPower * stiffness * (gust + localWave * 0.28);
    float settledWind = max(
      baseWind,
      uWind * windPower * stiffness * (1.15 + settleForce * 1.35)
    );
    float wind = mix(baseWind, settledWind, settleForce) * (1.0 - interactionOverride * 0.86);
    vec2 windDirection = normalize(mix(breezeDirection, settleDirection, activeOverride));
    float bend = bladeY * bladeY;
    float bow = bend * (1.0 - bladeY * 0.18);

    float lean = (aRandom.x - 0.5) * mix(0.075, 0.155, aShape.z) * uVariation;
    float curve = (aShape.z - 0.5) * 0.22 * bow * uVariation;
    float tipHook = (aRandom.y - 0.5) * smoothstep(0.58, 1.0, bladeY) * 0.095 * uVariation;
    float wiggle = (aRandom.z - 0.5) * mix(0.024, 0.07, aShape.y) * uVariation;
    float pressure = 1.0 + uPointerDown * uTouchBoost;

    pos.x += lean * bend;
    pos.x += curve + tipHook;
    pos.x += windDirection.x * wind * bend;
    pos.y += windDirection.y * wind * bend * 0.45;

    pos.x += pointerPush.x * bend * uCursorStrength * pressure;
    pos.y += pointerPush.y * bend * uVerticalPush * pressure;

    pos.x += brushDirection.x * pointerForce * velocityAmount * bend * uBrushStrength;
    pos.y += brushDirection.y * pointerForce * velocityAmount * bend * uBrushStrength * 0.32;

    pos.x += wakePush.x * wakeForce * velocityAmount * bend * uWakeStrength;
    pos.y += wakePush.y * wakeForce * velocityAmount * bend * uWakeStrength * 0.3;

    vec2 pulseDirection = normalize(pulseDelta + 0.0001);

    pos.x += pulseDirection.x * pulseRing * bend * uPulseStrength;
    pos.y += pulseDirection.y * pulseRing * bend * uPulseStrength * 0.36;

    pos.x += wiggle * bladeY;
    pos.xy += aOffset;

    vUv = uv;
    vY = bladeY;
    vRandom = aRandom.w;
    vForce = max(pointerForce, max(wakeForce * velocityAmount * 0.75, pulseRing));
    vBladeTint = vec3(
      mix(0.82, 1.18, aRandom.x),
      mix(0.86, 1.16, aShape.y),
      mix(0.68, 1.08, aShape.z)
    );

    gl_Position = vec4(pos, 1.0);
  }
`;

const GRASS_WALL_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uOpacity;
  uniform vec3 uGrassColor;
  uniform vec3 uCursorColor;
  uniform float uVariation;
  uniform float uEdgeSoftness;

  varying vec2 vUv;
  varying float vY;
  varying float vRandom;
  varying float vForce;
  varying vec3 vBladeTint;

  void main() {
    float edge = abs(vUv.x - 0.5) * 2.0;
    float softEdge = smoothstep(1.0, uEdgeSoftness, edge);

    float baseFade = smoothstep(0.0, 0.18, vY);
    float tipFade = smoothstep(1.0, 0.76, vY);
    float alpha = softEdge * baseFade * tipFade * uOpacity;

    vec3 base = uGrassColor * 0.58;
    vec3 mid = uGrassColor;
    vec3 tip = mix(uGrassColor, vec3(1.0), 0.32);

    vec3 color = mix(base, mid, smoothstep(0.0, 0.65, vY));
    color = mix(color, tip, smoothstep(0.45, 1.0, vY));

    vec3 tint = mix(vec3(1.0), vBladeTint, uVariation);
    vec3 warmTip = vec3(1.12, 1.08, 0.78);
    vec3 coolBase = vec3(0.72, 0.94, 0.82);

    color *= 0.72 + vRandom * 0.48 * uVariation;
    color *= tint;
    color = mix(color, color * warmTip, smoothstep(0.55, 1.0, vY) * vRandom * 0.35 * uVariation);
    color = mix(color, color * coolBase, smoothstep(0.0, 0.38, 1.0 - vY) * (1.0 - vRandom) * 0.22 * uVariation);
    color += vForce * uCursorColor;

    gl_FragColor = vec4(color, alpha);
  }
`;

(function () {
  window.GrassWall = {
    init(options = {}) {
      if (!window.THREE) {
        console.error("GrassWall: THREE is not loaded.");
        return null;
      }

      const isMobile = window.innerWidth < 768;

      const config = {
        bladeCount: isMobile ? 4500 : 12000,
        zIndex: -1,
        showControls: true,
        rotateColors: true,
        fullscreen: false,
        grassColor: "#75c94a",
        cursorColor: "#3a2e27",
        colorTransitionSpeed: 0.007,
        opacity: isMobile ? 0.82 : 1,
        wind: 0.078,
        breezeChance: 1,
        cursorRadius: 0.3,
        cursorStrength: 0.13,
        verticalPush: 0,
        pointerSmoothing: 0.3,
        widthMultiplier: isMobile ? 0.72 : 0.75,
        tipWidth: isMobile ? 0.52 : 0.38,
        heightMultiplier: isMobile ? 0.72 : 1,
        variation: isMobile ? 2 : 1.14,
        edgeSoftness: 0.15,
        touchBoost: 2,
        brushStrength: 0.09,
        wakeStrength: 0.34,
        wakeLag: 0.132,
        pulseStrength: 0.7,
        pulseRadius: 2,
        pulseDecay: 0.965,
        velocityStrength: 13.2,
        settleStrength: 0.34,
        settleRadius: 0.42,
        settleLifetime: 1900,
        settleDecay: 2.35,
        settleSpawnDistance: 0.035,

        ...options,
      };

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

      const canvas = document.createElement("canvas");

      Object.assign(canvas.style, {
        position: "fixed",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: config.zIndex,
      });

      document.body.prepend(canvas);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5));

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

      const baseGeometry = new THREE.PlaneGeometry(1, 1, 1, 8);
      baseGeometry.translate(0, 0.5, 0);

      const uniforms = {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPointer: { value: new THREE.Vector2(9, 9) },
        uPointerSmooth: { value: new THREE.Vector2(9, 9) },
        uPointerVelocity: { value: new THREE.Vector2() },
        uWakePointer: { value: new THREE.Vector2(9, 9) },
        uPointerDown: { value: 0 },
        uClickPulse: { value: 0 },
        uPulseRadius: { value: config.pulseRadius },
        uPulsePointer: { value: new THREE.Vector2(9, 9) },

        uOpacity: { value: config.opacity },
        uWind: { value: config.wind },
        uBreeze: { value: 0 },
        uBreezeGustA: { value: new THREE.Vector4(9, 9, 0, 0) },
        uBreezeGustB: { value: new THREE.Vector4(9, 9, 0, 0) },
        uBreezeGustC: { value: new THREE.Vector4(9, 9, 0, 0) },
        uBreezeGustD: { value: new THREE.Vector4(9, 9, 0, 0) },
        uSettleA: { value: new THREE.Vector4(9, 9, 0, 0) },
        uSettleB: { value: new THREE.Vector4(9, 9, 0, 0) },
        uSettleC: { value: new THREE.Vector4(9, 9, 0, 0) },
        uSettleD: { value: new THREE.Vector4(9, 9, 0, 0) },
        uSettleDirA: { value: new THREE.Vector2(1, 0) },
        uSettleDirB: { value: new THREE.Vector2(1, 0) },
        uSettleDirC: { value: new THREE.Vector2(1, 0) },
        uSettleDirD: { value: new THREE.Vector2(1, 0) },
        uCursorRadius: { value: config.cursorRadius },
        uCursorStrength: { value: config.cursorStrength },
        uVerticalPush: { value: config.verticalPush },
        uWidthMultiplier: { value: config.widthMultiplier },
        uTipWidth: { value: config.tipWidth },
        uHeightMultiplier: { value: config.heightMultiplier },
        uVariation: { value: config.variation },
        uEdgeSoftness: { value: config.edgeSoftness },
        uTouchBoost: { value: config.touchBoost },
        uBrushStrength: { value: config.brushStrength },
        uWakeStrength: { value: config.wakeStrength },
        uPulseStrength: { value: config.pulseStrength },
        uVelocityStrength: { value: config.velocityStrength },

        uGrassColor: { value: new THREE.Color(config.grassColor) },
        uCursorColor: { value: new THREE.Color(config.cursorColor) },
      };

      const targetGrassColor = new THREE.Color(config.grassColor);
      const targetCursorColor = new THREE.Color(config.cursorColor);

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: GRASS_WALL_VERTEX_SHADER,
        fragmentShader: GRASS_WALL_FRAGMENT_SHADER,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      });

      let grass = null;
      let grassGeometry = null;
      let animationFrame = null;
      let controls = null;
      let clickPulse = 0;
      let pointerDown = false;
      let activePointerId = null;
      let lastPointer = new THREE.Vector2(9, 9);
      let targetVelocity = new THREE.Vector2();
      let hasPointer = false;
      let breezeDirection = 1;
      let lastBreezeTime = 0;
      let breezeGusts = [];
      let settleForces = [];
      let lastSettlePointer = new THREE.Vector2(9, 9);
      let nextDirectionChangeAt = 0;
      const nextPointer = new THREE.Vector2();
      const fullscreenHiddenElements = new Map();

      function setFullscreen(enabled) {
        Array.from(document.body.children).forEach((element) => {
          if (element === canvas || element === controls) {
            return;
          }

          if (enabled) {
            if (!fullscreenHiddenElements.has(element)) {
              fullscreenHiddenElements.set(element, element.style.display);
            }

            element.style.display = "none";
            return;
          }

          if (fullscreenHiddenElements.has(element)) {
            element.style.display = fullscreenHiddenElements.get(element);
          }
        });

        if (!enabled) {
          fullscreenHiddenElements.clear();
        }
      }

      function exportConfig() {
        return { ...config };
      }

      function logConfig() {
        console.log("GrassWall.init(" + JSON.stringify(exportConfig(), null, 2) + ");");
      }

      function updateConfig(key, value) {
        if (!(key in config)) {
          console.warn(`GrassWall: unknown config key "${key}".`);
          return false;
        }

        config[key] = value;

        if (key === "grassColor") {
          targetGrassColor.set(value);
          return true;
        }

        if (key === "cursorColor") {
          targetCursorColor.set(value);
          return true;
        }

        if (key === "bladeCount") {
          rebuildGrass(value);
          return true;
        }

        if (key === "fullscreen") {
          setFullscreen(Boolean(value));
          return true;
        }

        if (key === "rotateColors") {
          return true;
        }

        if (key === "breezeChance" && value <= 0) {
          breezeGusts.length = 0;
        }

        const uniformKey = `u${key[0].toUpperCase()}${key.slice(1)}`;

        if (uniforms[uniformKey]) {
          uniforms[uniformKey].value = value;
          return true;
        }

        return true;
      }

      function randomBetween(min, max) {
        return min + Math.random() * (max - min);
      }

      function createGrassGeometry(bladeCount) {
        const geometry = new THREE.InstancedBufferGeometry();

        geometry.index = baseGeometry.index;
        geometry.attributes.position = baseGeometry.attributes.position;
        geometry.attributes.uv = baseGeometry.attributes.uv;

        const offsets = new Float32Array(bladeCount * 2);
        const scales = new Float32Array(bladeCount * 2);
        const randoms = new Float32Array(bladeCount * 4);
        const shapes = new Float32Array(bladeCount * 4);

        const columns = Math.ceil(Math.sqrt(bladeCount * 1.35));
        const rows = Math.ceil(bladeCount / columns);
        const rowHeight = 2.25 / Math.max(rows - 1, 1);

        for (let i = 0; i < bladeCount; i++) {
          const row = Math.floor(i / columns);
          const offsetIndex = i * 2;
          const randomIndex = i * 4;

          const cluster = Math.random() < 0.35 ? Math.random() * 0.08 - 0.04 : 0;
          const yBase = 1.125 - row * rowHeight;

          offsets[offsetIndex] = Math.random() * 2.25 - 1.125;
          offsets[offsetIndex + 1] = yBase + cluster + (Math.random() - 0.5) * rowHeight;

          const heightRoll = Math.random();
          const widthRoll = Math.random();
          const clumpBoost = Math.random() < 0.18 ? 1.25 + Math.random() * 0.75 : 1;
          const squatBlade = Math.random() < 0.16;

          scales[offsetIndex] = (0.008 + Math.pow(widthRoll, 2.65) * 0.082) * clumpBoost;
          scales[offsetIndex + 1] = squatBlade
            ? 0.045 + Math.random() * 0.16
            : 0.08 + Math.pow(heightRoll, 1.45) * 0.55;

          randoms[randomIndex] = Math.random();
          randoms[randomIndex + 1] = Math.random();
          randoms[randomIndex + 2] = Math.random();
          randoms[randomIndex + 3] = Math.random();

          shapes[randomIndex] = Math.random();
          shapes[randomIndex + 1] = Math.random();
          shapes[randomIndex + 2] = Math.random();
          shapes[randomIndex + 3] = Math.random();
        }

        geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 2));
        geometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(scales, 2));
        geometry.setAttribute("aRandom", new THREE.InstancedBufferAttribute(randoms, 4));
        geometry.setAttribute("aShape", new THREE.InstancedBufferAttribute(shapes, 4));

        return geometry;
      }

      function rebuildGrass(bladeCount) {
        if (grass) {
          scene.remove(grass);
          grassGeometry.dispose();
        }

        grassGeometry = createGrassGeometry(bladeCount);
        grass = new THREE.Mesh(grassGeometry, material);
        scene.add(grass);
      }

      function resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        renderer.setSize(width, height, false);
        uniforms.uAspect.value = width / height;
      }

      function setPointer(x, y) {
        nextPointer.set(
          (x / window.innerWidth) * 2 - 1,
          -((y / window.innerHeight) * 2 - 1)
        );

        if (!hasPointer) {
          hasPointer = true;
          targetVelocity.set(0, 0);
          lastPointer.copy(nextPointer);
          uniforms.uPointer.value.copy(nextPointer);
          uniforms.uPointerSmooth.value.copy(nextPointer);
          uniforms.uWakePointer.value.copy(nextPointer);
          uniforms.uPointerVelocity.value.set(0, 0);
          lastSettlePointer.copy(nextPointer);
          return;
        }

        targetVelocity.subVectors(nextPointer, lastPointer);

        const settleDistance = nextPointer.distanceTo(lastSettlePointer);
        if (settleDistance >= config.settleSpawnDistance) {
          const pushDirection = new THREE.Vector2()
            .subVectors(lastSettlePointer, nextPointer)
            .normalize();

          addSettleForce(
            nextPointer.x,
            nextPointer.y,
            pushDirection.x,
            pushDirection.y,
            config.settleRadius,
            config.settleStrength * Math.min(1.35, 0.65 + targetVelocity.length() * config.velocityStrength * 0.12),
            performance.now(),
            config.settleLifetime
          );

          lastSettlePointer.copy(nextPointer);
        }

        lastPointer.copy(nextPointer);
        uniforms.uPointer.value.copy(nextPointer);
      }

      function onPointerMove(event) {
        setPointer(event.clientX, event.clientY);
      }

      function onPointerDown(event) {
        pointerDown = true;
        activePointerId = event.pointerId;
        clickPulse = 1;
        setPointer(event.clientX, event.clientY);
        uniforms.uPulsePointer.value.copy(uniforms.uPointer.value);
        addSettleForce(
          uniforms.uPointer.value.x,
          uniforms.uPointer.value.y,
          0,
          1,
          config.settleRadius * 1.25,
          config.settleStrength * 1.15,
          performance.now(),
          config.settleLifetime * 1.15
        );
      }

      function onPointerUp(event) {
        pointerDown = false;
        activePointerId = null;

        if (event && typeof event.clientX === "number") {
          setPointer(event.clientX, event.clientY);
        }
      }

      function onPointerLeave() {
        if (pointerDown) {
          return;
        }

        hasPointer = false;
        targetVelocity.set(0, 0);
        lastPointer.set(9, 9);
        uniforms.uPointer.value.set(9, 9);
        uniforms.uPointerSmooth.value.set(9, 9);
        uniforms.uWakePointer.value.set(9, 9);
        uniforms.uPointerVelocity.value.set(0, 0);
      }

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

      function smoothstep(edge0, edge1, x) {
        const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
        return t * t * (3 - 2 * t);
      }

      function addSettleForce(x, y, dirX, dirY, radius, strength, time, lifetime) {
        const direction = new THREE.Vector2(dirX, dirY);

        if (direction.lengthSq() < 0.0001) {
          direction.set(breezeDirection, 0);
        }

        direction.normalize();

        settleForces.unshift({
          x,
          y,
          dirX: direction.x,
          dirY: direction.y,
          radius,
          strength,
          bornAt: time,
          lifetime,
        });

        settleForces.length = Math.min(settleForces.length, 4);
      }

      function settleEnvelope(t) {
        const clamped = Math.min(Math.max(t, 0), 1);
        return Math.exp(-clamped * config.settleDecay) * (1 - smoothstep(0.82, 1.0, clamped));
      }

      function setSettleUniform(forceUniform, dirUniform, force, fade) {
        forceUniform.value.set(
          force.x,
          force.y,
          force.radius,
          force.strength * fade
        );
        dirUniform.value.set(force.dirX, force.dirY);
      }

      function clearSettleUniforms(time) {
        const empty = {
          x: 9,
          y: 9,
          dirX: 1,
          dirY: 0,
          radius: 0,
          strength: 0,
          bornAt: time,
          lifetime: 1,
        };

        [
          [uniforms.uSettleA, uniforms.uSettleDirA],
          [uniforms.uSettleB, uniforms.uSettleDirB],
          [uniforms.uSettleC, uniforms.uSettleDirC],
          [uniforms.uSettleD, uniforms.uSettleDirD],
        ].forEach(([forceUniform, dirUniform]) => {
          setSettleUniform(forceUniform, dirUniform, empty, 0);
        });
      }

      function updateSettleUniforms(time) {
        const empty = {
          x: 9,
          y: 9,
          dirX: 1,
          dirY: 0,
          radius: 0,
          strength: 0,
          bornAt: time,
          lifetime: 1,
        };

        settleForces = settleForces.filter((force) => {
          return (time - force.bornAt) / force.lifetime < 1;
        });

        [
          [uniforms.uSettleA, uniforms.uSettleDirA],
          [uniforms.uSettleB, uniforms.uSettleDirB],
          [uniforms.uSettleC, uniforms.uSettleDirC],
          [uniforms.uSettleD, uniforms.uSettleDirD],
        ].forEach(([forceUniform, dirUniform], index) => {
          const force = settleForces[index] || empty;
          const t = (time - force.bornAt) / force.lifetime;
          setSettleUniform(forceUniform, dirUniform, force, settleEnvelope(t));
        });
      }

      function gustEnvelope(t, springTail) {
        if (t < 1) {
          return Math.sin(t * Math.PI * 0.5);
        }

        const tail = Math.min((t - 1) / springTail, 1);
        return Math.exp(-tail * 3.4) * (1 - smoothstep(0.72, 1.0, tail));
      }

      function setGustUniform(uniform, gust, fade) {
        uniform.value.set(
          gust.x,
          gust.y,
          gust.radius,
          gust.strength * fade
        );
      }

      function clearBreezeUniforms(time) {
        const empty = {
          x: 9,
          y: 9,
          radius: 0,
          strength: 0,
          bornAt: time,
          lifetime: 1,
          springTail: 1,
        };

        [
          uniforms.uBreezeGustA,
          uniforms.uBreezeGustB,
          uniforms.uBreezeGustC,
          uniforms.uBreezeGustD,
        ].forEach((uniform) => {
          setGustUniform(uniform, empty, 0);
        });
      }

      function updateBreezeUniforms(time) {
        const empty = {
          x: 9,
          y: 9,
          radius: 0,
          strength: 0,
          bornAt: time,
          lifetime: 1,
          springTail: 1,
        };

        [
          uniforms.uBreezeGustA,
          uniforms.uBreezeGustB,
          uniforms.uBreezeGustC,
          uniforms.uBreezeGustD,
        ].forEach((uniform, index) => {
          const gust = breezeGusts[index] || empty;
          const t = (time - gust.bornAt) / gust.lifetime;
          const fade = gustEnvelope(t, gust.springTail);
          setGustUniform(uniform, gust, fade);
        });
      }

      function updateBreeze(time) {
        const deltaSeconds = lastBreezeTime
          ? Math.min((time - lastBreezeTime) * 0.001, 0.1)
          : 0;

        lastBreezeTime = time;

        if (config.breezeChance <= 0) {
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
        const spawnChance = config.breezeChance * deltaSeconds;

        if (breezeGusts.length < maxGusts && Math.random() < spawnChance) {
          const gustPacket = randomGustPacket(breezeDirection, time);
          breezeGusts.push(gustPacket);
          addSettleForce(
            gustPacket.x,
            gustPacket.y,
            breezeDirection,
            0,
            gustPacket.radius * 1.12,
            config.settleStrength * 1.25,
            time,
            config.settleLifetime * 1.2
          );
        }

        if (
          config.breezeChance > 0.65 &&
          breezeGusts.length < maxGusts &&
          Math.random() < spawnChance * 0.65
        ) {
          const gustPacket = randomGustPacket(breezeDirection, time);
          breezeGusts.push(gustPacket);
          addSettleForce(
            gustPacket.x,
            gustPacket.y,
            breezeDirection,
            0,
            gustPacket.radius * 1.12,
            config.settleStrength * 1.25,
            time,
            config.settleLifetime * 1.2
          );
        }

        if (
          config.breezeChance > 0.9 &&
          breezeGusts.length < maxGusts &&
          Math.random() < spawnChance * 0.35
        ) {
          const gustPacket = randomGustPacket(breezeDirection, time);
          breezeGusts.push(gustPacket);
          addSettleForce(
            gustPacket.x,
            gustPacket.y,
            breezeDirection,
            0,
            gustPacket.radius * 1.12,
            config.settleStrength * 1.25,
            time,
            config.settleLifetime * 1.2
          );
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

      function animate(time) {
        uniforms.uTime.value = time * 0.001;
        updateBreeze(time);
        updateSettleUniforms(time);
        uniforms.uPointerSmooth.value.lerp(
          uniforms.uPointer.value,
          config.pointerSmoothing
        );
        uniforms.uWakePointer.value.lerp(uniforms.uPointer.value, config.wakeLag);
        uniforms.uPointerVelocity.value.lerp(targetVelocity, 0.22);
        uniforms.uPointerDown.value += ((pointerDown ? 1 : 0) - uniforms.uPointerDown.value) * 0.18;

        uniforms.uGrassColor.value.lerp(targetGrassColor, config.colorTransitionSpeed);
        uniforms.uCursorColor.value.lerp(targetCursorColor, config.colorTransitionSpeed);

        targetVelocity.multiplyScalar(0.88);
        clickPulse *= config.pulseDecay;
        uniforms.uClickPulse.value = clickPulse;

        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
      }

      function createControls() {
        const panel = document.createElement("details");
        panel.open = false;

        Object.assign(panel.style, {
          position: "fixed",
          right: "12px",
          top: "6px",
          zIndex: "99999",
          maxHeight: "80vh",
          overflow: "auto",
          background: "#202020",
          color: "#FFF",
          padding: "0.5rem 1rem",
          cursor: "pointer",
          borderRadius: "1rem",
          fontSize: "0.8rem"
        });

        panel.innerHTML = `<summary>Settings</summary>`;

        panel.addEventListener("pointerdown", (event) => event.stopPropagation());
        panel.addEventListener("pointermove", (event) => event.stopPropagation());
        panel.addEventListener("pointerup", (event) => event.stopPropagation());

        function addRange(label, key, min, max, step, help, onInput) {
          const wrapper = document.createElement("p");

          const labelEl = document.createElement("label");
          labelEl.textContent = `${label}: `;

          const output = document.createElement("output");
          output.value = config[key];
          output.textContent = config[key];

          const input = document.createElement("input");
          input.type = "range";
          input.min = min;
          input.max = max;
          input.step = step;
          input.value = config[key];

          input.addEventListener("input", () => {
            const value = Number(input.value);
            updateConfig(key, value);
            output.value = value;
            output.textContent = value;

            if (onInput) {
              onInput(value);
            }

            logConfig();
          });

          const helpEl = document.createElement("small");
          helpEl.textContent = help;

          labelEl.append(input, " ", output);
          wrapper.append(labelEl, document.createElement("br"), helpEl);
          return wrapper;
        }

        function addColor(label, key, help) {
          const wrapper = document.createElement("p");

          const labelEl = document.createElement("label");
          labelEl.textContent = `${label}: `;

          const input = document.createElement("input");
          input.type = "color";
          input.value = config[key];

          input.addEventListener("input", () => {
            updateConfig(key, input.value);
            logConfig();
          });

          const helpEl = document.createElement("small");
          helpEl.textContent = help;

          labelEl.append(input);
          wrapper.append(labelEl, document.createElement("br"), helpEl);
          return wrapper;
        }

        function addCheckbox(label, key, help) {
          const wrapper = document.createElement("p");

          const labelEl = document.createElement("label");
          labelEl.textContent = `${label}: `;

          const input = document.createElement("input");
          input.type = "checkbox";
          input.checked = Boolean(config[key]);

          input.addEventListener("change", () => {
            updateConfig(key, input.checked);
            logConfig();
          });

          const helpEl = document.createElement("small");
          helpEl.textContent = help;

          labelEl.append(input);
          wrapper.append(labelEl, document.createElement("br"), helpEl);
          return wrapper;
        }

        function addGroup(title, controls) {
          const fieldset = document.createElement("fieldset");
          const legend = document.createElement("legend");
          legend.textContent = title;

          fieldset.append(legend, ...controls);
          panel.appendChild(fieldset);
        }

        addGroup("General", [
          addCheckbox("Fullscreen", "fullscreen", "Hide page content behind the grass."),
          addRange("Blade count", "bladeCount", 300, 12000, 100, "How dense the grass is."),
          addRange("Opacity", "opacity", 0, 1, 0.01, "Overall transparency."),
        ]);

        addGroup("Wind", [
          addRange("Wind", "wind", 0, 0.12, 0.001, "Constant swaying strength."),
          addRange("Breeze chance", "breezeChance", 0, 1, 0.01, "How often gusts appear."),
        ]);

        addGroup("Cursor", [
          addRange("Cursor radius", "cursorRadius", 0.05, 1.2, 0.01, "How wide the cursor effect is."),
          addRange("Cursor force", "cursorStrength", 0, 0.7, 0.01, "How strongly grass moves away."),
          addRange("Vertical push", "verticalPush", 0, 0.2, 0.001, "Up/down cursor movement."),
          addRange("Pointer smooth", "pointerSmoothing", 0.01, 0.3, 0.001, "Lower is smoother and laggier."),
          addRange("Touch boost", "touchBoost", 0, 2, 0.01, "Extra force while pressing."),
          addRange("Brush force", "brushStrength", 0, 0.6, 0.01, "Directional drag from movement."),
          addRange("Velocity sensitivity", "velocityStrength", 1, 40, 0.1, "How much pointer speed matters."),
        ]);

        addGroup("Click pulse", [
          addRange("Click pulse", "pulseStrength", 0, 0.7, 0.01, "Ripple strength on click."),
          addRange("Pulse radius", "pulseRadius", 0.15, 2, 0.01, "How far the ripple expands."),
          addRange("Pulse decay", "pulseDecay", 0.85, 0.99, 0.001, "Higher lasts longer."),
        ]);

        addGroup("Blade shape", [
          addRange("Blade width", "widthMultiplier", 0.3, 3, 0.01, "Overall blade width."),
          addRange("Tip width", "tipWidth", 0.02, 0.6, 0.01, "Lower makes sharper tips."),
          addRange("Blade height", "heightMultiplier", 0.3, 3, 0.01, "Overall blade height."),
          addRange("Variation", "variation", 0, 2, 0.01, "Randomness in shape and color."),
          addRange("Edge softness", "edgeSoftness", 0.15, 0.75, 0.01, "Softness of blade edges."),
        ]);

        addGroup("Color", [
          addCheckbox("Rotate colors", "rotateColors", "Determines if colors should rotate automatically."),
          addRange("Color speed", "colorTransitionSpeed", 0.01, 1, 0.01, "How fast colors fade between values."),
          addColor("Grass color", "grassColor", "Main grass color."),
          addColor("Cursor glow", "cursorColor", "Tint added near interaction."),
        ]);

        document.body.appendChild(panel);
        return panel;
      }

      window.addEventListener("resize", resize);
      document.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("pointerleave", onPointerLeave);

      rebuildGrass(config.bladeCount);

      if (config.showControls) {
        controls = createControls();
      }

      if (config.fullscreen) {
        setFullscreen(true);
      }

      resize();
      animationFrame = requestAnimationFrame(animate);

      return {
        set(key, value) {
          return updateConfig(key, value);
        },

        get(key) {
          return config[key];
        },

        getConfig() {
          return exportConfig();
        },

        destroy() {
          setFullscreen(false);
          cancelAnimationFrame(animationFrame);

          window.removeEventListener("resize", resize);
          document.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerdown", onPointerDown);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerUp);
          window.removeEventListener("pointerleave", onPointerLeave);

          if (controls) controls.remove();

          baseGeometry.dispose();
          if (grassGeometry) grassGeometry.dispose();
          material.dispose();
          renderer.dispose();
          canvas.remove();
        },
      };
    },
  };
})();