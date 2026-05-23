export const GRASS_WALL_VERTEX_SHADER = `
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
  varying vec2 vWorldPos;

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

    float breezePackets = (gustA + gustB + gustC + gustD) * packetBreakup;
    float breezeBoost = max(0.18, 1.0 + uBreeze * breezePackets);
    float wind = uWind * breezeBoost * windPower * stiffness * (gust + localWave * 0.28);
    float bend = bladeY * bladeY;
    float bow = bend * (1.0 - bladeY * 0.18);

    float lean = (aRandom.x - 0.5) * mix(0.075, 0.155, aShape.z) * uVariation;
    float curve = (aShape.z - 0.5) * 0.22 * bow * uVariation;
    float tipHook = (aRandom.y - 0.5) * smoothstep(0.58, 1.0, bladeY) * 0.095 * uVariation;
    float wiggle = (aRandom.z - 0.5) * mix(0.024, 0.07, aShape.y) * uVariation;
    float pressure = 1.0 + uPointerDown * uTouchBoost;

    pos.x += lean * bend;
    pos.x += curve + tipHook;
    pos.x += breezeDirection.x * wind * bend;
    pos.y += breezeDirection.y * wind * bend * 0.45;

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

    vWorldPos = pos.xy;
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

export const GRASS_WALL_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uOpacity;
  uniform vec3 uGrassColor;
  uniform vec3 uCursorColor;
  uniform float uVariation;
  uniform float uEdgeSoftness;
  uniform float uFireflies;
  uniform float uFireflyCount;
  uniform float uFireflyStrength;
  uniform float uFireflySize;
  uniform float uFireflySpeed;
  uniform float uFireflyFlicker;
  uniform float uFireflyDrift;
  uniform float uFireflyReflection;
  uniform float uFireflyReflectionRadius;

  varying vec2 vUv;
  varying float vY;
  varying float vRandom;
  varying float vForce;
  varying vec3 vBladeTint;
  varying vec2 vWorldPos;

  float rand(float seed) {
    return fract(sin(seed * 91.3458) * 47453.5453);
  }

  vec2 fireflyPosition(float seed) {
    float speed = uTime * uFireflySpeed;
    float lane = rand(seed * 2.71);
    float xBase = rand(seed * 5.31) * 2.6 - 1.3;
    float yBase = rand(seed * 7.17) * 2.4 - 1.2;
    float rise = mod(speed * mix(0.12, 0.42, lane) + rand(seed * 13.19), 2.4) - 1.2;

    float x = xBase + sin(speed * mix(0.45, 1.15, rand(seed * 19.9)) + seed) * uFireflyDrift;
    float y = mod(yBase + rise, 2.4) - 1.2;

    return vec2(x, y);
  }

  float fireflyReflectionGlow(vec2 uv, vec2 center, float seed) {
    vec2 delta = vec2((uv.x - center.x) * uAspect, uv.y - center.y);
    float distanceToCenter = length(delta);
    float radius = max(uFireflyReflectionRadius, 0.001);
    float flicker = 0.62 + 0.38 * sin(uTime * uFireflyFlicker * mix(1.0, 2.7, rand(seed * 23.2)) + seed * 5.13);
    float pulse = 0.78 + 0.22 * sin(uTime * uFireflyFlicker * 0.41 + seed * 17.3);
    float glow = 1.0 - smoothstep(0.0, radius, distanceToCenter);

    return glow * glow * flicker * pulse;
  }

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

    vec2 bladeUv = vWorldPos;
    float reflectedGlow = 0.0;

    for (int i = 0; i < 16; i++) {
      float index = float(i);

      if (index < uFireflyCount) {
        float seed = index + 1.0;
        reflectedGlow += fireflyReflectionGlow(bladeUv, fireflyPosition(seed), seed);
      }
    }

    reflectedGlow = clamp(reflectedGlow * uFireflies * uFireflyStrength * uFireflyReflection, 0.0, 1.0);

    vec3 hotCore = vec3(1.0, 0.92, 0.42);
    vec3 safeCursorColor = max(uCursorColor, vec3(0.38));
    vec3 glowColor = mix(hotCore, safeCursorColor, 0.45);
    float bladeLightMask = softEdge * smoothstep(0.08, 0.82, vY);

    color = mix(color, glowColor, reflectedGlow * bladeLightMask * 0.42);
    color += glowColor * reflectedGlow * bladeLightMask * 0.82;

    gl_FragColor = vec4(color, alpha);
  }
`;

export const FIREFLY_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const FIREFLY_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uCursorColor;
  uniform float uFireflies;
  uniform float uFireflyCount;
  uniform float uFireflyStrength;
  uniform float uFireflySize;
  uniform float uFireflySpeed;
  uniform float uFireflyFlicker;
  uniform float uFireflyDrift;

  varying vec2 vUv;

  float rand(float seed) {
    return fract(sin(seed * 91.3458) * 47453.5453);
  }

  vec2 fireflyPosition(float seed) {
    float speed = uTime * uFireflySpeed;
    float lane = rand(seed * 2.71);
    float xBase = rand(seed * 5.31) * 2.6 - 1.3;
    float yBase = rand(seed * 7.17) * 2.4 - 1.2;
    float rise = mod(speed * mix(0.12, 0.42, lane) + rand(seed * 13.19), 2.4) - 1.2;

    float x = xBase + sin(speed * mix(0.45, 1.15, rand(seed * 19.9)) + seed) * uFireflyDrift;
    float y = mod(yBase + rise, 2.4) - 1.2;

    return vec2(x, y);
  }

  float fireflyGlow(vec2 uv, vec2 center, float seed) {
    vec2 delta = vec2((uv.x - center.x) * uAspect, uv.y - center.y);
    float distanceToCenter = length(delta);
    float coreSize = max(uFireflySize, 0.001);
    float haloSize = coreSize * 5.8;
    float flicker = 0.62 + 0.38 * sin(uTime * uFireflyFlicker * mix(1.0, 2.7, rand(seed * 23.2)) + seed * 5.13);
    float pulse = 0.78 + 0.22 * sin(uTime * uFireflyFlicker * 0.41 + seed * 17.3);
    float core = 1.0 - smoothstep(0.0, coreSize, distanceToCenter);
    float halo = 1.0 - smoothstep(0.0, haloSize, distanceToCenter);

    return (core * 1.45 + halo * 0.62) * flicker * pulse;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float glow = 0.0;

    for (int i = 0; i < 16; i++) {
      float index = float(i);

      if (index < uFireflyCount) {
        float seed = index + 1.0;
        glow += fireflyGlow(uv, fireflyPosition(seed), seed);
      }
    }

    glow = clamp(glow * uFireflies * uFireflyStrength, 0.0, 1.0);

    vec3 hotCore = vec3(1.0, 0.92, 0.42);
    vec3 safeCursorColor = max(uCursorColor, vec3(0.38));
    vec3 glowColor = mix(hotCore, safeCursorColor, 0.45);
    vec3 color = glowColor * glow * 1.9;

    gl_FragColor = vec4(color, glow);
  }
`;
