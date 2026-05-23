export const WATER_SIM_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const WATER_SIM_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uState;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uAspect;
  uniform float uDamping;
  uniform float uPropagation;
  uniform float uViscosity;
  uniform float uRippleStrength;
  uniform float uHoverRippleStrength;
  uniform float uWakeRippleStrength;
  uniform float uRandomRippleStrength;
  uniform float uRandomRippleFrequency;
  uniform float uDisturbanceStrength;
  uniform float uDisturbanceFrequency;
  uniform float uNaturalChaos;
  uniform float uRippleVariety;
  uniform float uTinyRippleStrength;
  uniform float uCursorRadius;
  uniform float uPointerDown;
  uniform float uClickPulse;
  uniform float uPulseStrength;
  uniform float uPulseRadius;
  uniform vec2 uPointerSmooth;
  uniform vec2 uPointerVelocity;
  uniform vec2 uWakePointer;
  uniform vec2 uPulsePointer;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 37.19);
    return fract(p.x * p.y);
  }

  void main() {
    vec4 center = texture2D(uState, vUv);
    float h = center.r;
    float previous = center.g;
    float energy = center.b;

    float left = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
    float right = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
    float down = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
    float up = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;
    float diagonalA = texture2D(uState, vUv + vec2(uTexel.x, uTexel.y)).r;
    float diagonalB = texture2D(uState, vUv + vec2(-uTexel.x, uTexel.y)).r;
    float diagonalC = texture2D(uState, vUv + vec2(uTexel.x, -uTexel.y)).r;
    float diagonalD = texture2D(uState, vUv + vec2(-uTexel.x, -uTexel.y)).r;

    float cardinal = left + right + down + up;
    float diagonal = diagonalA + diagonalB + diagonalC + diagonalD;
    float laplacian = cardinal * 0.74 + diagonal * 0.26 - 4.0 * h;
    float velocity = (h - previous) * uDamping;
    float next = h + velocity + laplacian * uPropagation;

    vec2 pointer = vec2(uPointerSmooth.x * 0.5 + 0.5, uPointerSmooth.y * 0.5 + 0.5);
    vec2 pointerDelta = vec2((vUv.x - pointer.x) * uAspect, vUv.y - pointer.y);
    float pointerDistance = length(pointerDelta);
    float pointerMask = exp(-pow(pointerDistance / max(uCursorRadius * 0.48, 0.001), 2.0));
    float pointerRing = exp(-pow((pointerDistance - uCursorRadius * 0.38) / max(uCursorRadius * 0.12, 0.001), 2.0));
    vec2 velocityVector = vec2(uPointerVelocity.x * uAspect, uPointerVelocity.y);
    float pointerVelocity = clamp(length(velocityVector) * 18.0, 0.0, 1.0);
    vec2 velocityDir = normalize(velocityVector + vec2(0.0001));

    float hoverPressure = sin(uTime * 8.5 + pointerDistance * 54.0) * 0.5 + 0.5;
    float hoverBowl = (pointerMask * -0.0018 + pointerRing * (0.0014 + hoverPressure * 0.0012)) * uHoverRippleStrength * uRippleStrength;

    vec2 wake = vec2(uWakePointer.x * 0.5 + 0.5, uWakePointer.y * 0.5 + 0.5);
    vec2 wakeDelta = vec2((vUv.x - wake.x) * uAspect, vUv.y - wake.y);
    float alongWake = dot(wakeDelta, -velocityDir);
    float acrossWake = abs(dot(wakeDelta, vec2(-velocityDir.y, velocityDir.x)));
    float wakeTrail = smoothstep(0.28, 0.0, alongWake) * smoothstep(-0.02, 0.05, alongWake);
    float wakeMask = exp(-pow(acrossWake / max(uCursorRadius * 0.24, 0.001), 2.0)) * wakeTrail;
    float wakeRipples = sin(alongWake * 92.0 - uTime * 7.2) * exp(-max(alongWake, 0.0) * 3.2);
    float wakeShoulder = sin(alongWake * 38.0 - uTime * 3.1) * exp(-max(alongWake, 0.0) * 1.9);

    float brush = hoverBowl + wakeMask * (wakeRipples * 0.72 + wakeShoulder * 0.46) * (0.25 + pointerVelocity) * uWakeRippleStrength * uRippleStrength * 0.0062;
    brush += (pointerMask * -0.0065 + pointerRing * 0.0055) * uPointerDown * uRippleStrength;
    next += brush;
    energy = max(energy, max(pointerMask * (0.18 + uPointerDown), wakeMask * pointerVelocity) * uRippleStrength * max(uHoverRippleStrength, uWakeRippleStrength) * 0.38);

    vec2 pulse = vec2(uPulsePointer.x * 0.5 + 0.5, uPulsePointer.y * 0.5 + 0.5);
    vec2 pulseDelta = vec2((vUv.x - pulse.x) * uAspect, vUv.y - pulse.y);
    float pulseDistance = length(pulseDelta);
    float pulseAge = 1.0 - uClickPulse;
    float pulseRingRadius = mix(0.012, uPulseRadius * 0.46, pulseAge);
    float pulseWidth = mix(0.072, 0.026, pulseAge);
    float pulseRing = exp(-pow((pulseDistance - pulseRingRadius) / max(pulseWidth, 0.001), 2.0));
    float pulseInnerRadius = pulseRingRadius * 0.58;
    float pulseInner = exp(-pow((pulseDistance - pulseInnerRadius) / max(pulseWidth * 0.72, 0.001), 2.0));
    float pulseOuter = exp(-pow((pulseDistance - pulseRingRadius * 1.42) / max(pulseWidth * 1.18, 0.001), 2.0));
    float impactBowl = exp(-pow(pulseDistance / max(mix(0.04, 0.12, pulseAge), 0.001), 2.0));
    float clickWave = pulseRing * 1.0 - pulseInner * 0.42 + pulseOuter * 0.24 - impactBowl * (1.0 - smoothstep(0.0, 0.35, pulseAge)) * 0.82;
    next += clickWave * uClickPulse * uPulseStrength * uRippleStrength * 0.030;
    energy = max(energy, max(pulseRing, impactBowl) * uClickPulse * uRippleStrength * uPulseStrength * 0.85);

    float disturbance = 0.0;
    float disturbanceEnergy = 0.0;

    for (int i = 0; i < 9; i++) {
      float stream = float(i);
      float speedJitter = mix(0.62, 1.55, hash(vec2(stream, 91.7)));
      float eventWindow = mix(10.5, 1.65, clamp(uRandomRippleFrequency, 0.0, 1.0)) * speedJitter;
      float eventId = floor((uTime + stream * 1.93) / eventWindow);
      float eventAge = fract((uTime + stream * 1.93) / eventWindow);
      float chance = clamp(uRandomRippleFrequency * mix(0.48, 1.0, uDisturbanceFrequency), 0.0, 1.0);
      float eventAllowed = step(1.0 - chance, hash(vec2(eventId, stream * 17.31 + 4.0)));
      float eventEnvelope = pow(max(sin(eventAge * 3.14159265), 0.0), mix(1.55, 3.4, hash(vec2(stream, eventId + 14.0)))) * eventAllowed;
      vec2 eventCenter = vec2(
        mix(0.04, 0.96, hash(vec2(eventId + stream * 31.0, 2.7))),
        mix(0.06, 0.94, hash(vec2(eventId + stream * 29.0, 8.4)))
      );
      float angle = hash(vec2(eventId, stream + 44.0)) * 6.2831853;
      vec2 axis = vec2(cos(angle), sin(angle));
      vec2 side = vec2(-axis.y, axis.x);
      vec2 eventDelta = vec2((vUv.x - eventCenter.x) * uAspect, vUv.y - eventCenter.y);
      float ellipse = mix(1.0, 2.8, hash(vec2(stream, eventId + 7.0)) * uRippleVariety);
      vec2 shapedDelta = vec2(dot(eventDelta, axis) / ellipse, dot(eventDelta, side));
      float dist = length(shapedDelta);
      float maxRadius = mix(0.12, 0.54, hash(vec2(stream, eventId)));
      float radius = mix(0.006, maxRadius, eventAge);
      float width = mix(0.006, 0.038, hash(vec2(eventId, stream + 6.0))) * mix(0.72, 1.55, uRippleVariety);
      float ring = exp(-pow((dist - radius) / max(width, 0.001), 2.0));
      float ringCount = mix(42.0, 118.0, hash(vec2(stream, 12.0)));
      float signedRing = ring * sin((dist - radius) * ringCount + hash(vec2(stream, eventId + 3.0)) * 6.2831853);
      disturbance += signedRing * eventEnvelope * mix(0.38, 1.35, hash(vec2(stream, 33.0)));
      disturbanceEnergy = max(disturbanceEnergy, ring * eventEnvelope);
    }

    for (int i = 0; i < 4; i++) {
      float stream = float(i);
      float laneTime = uTime * mix(0.035, 0.11, hash(vec2(stream, 5.0))) + stream * 2.31;
      vec2 windDir = normalize(vec2(cos(stream * 1.71 + 0.4), sin(stream * 1.31 + 1.2)));
      vec2 side = vec2(-windDir.y, windDir.x);
      vec2 center = vec2(fract(hash(vec2(floor(laneTime), stream)) + laneTime * 0.37), fract(hash(vec2(stream, floor(laneTime) + 8.0)) + laneTime * 0.19));
      vec2 d = vec2((vUv.x - center.x) * uAspect, vUv.y - center.y);
      float along = dot(d, windDir);
      float across = dot(d, side);
      float packet = exp(-pow(across / mix(0.018, 0.055, hash(vec2(stream, 9.0))), 2.0)) * exp(-pow(along / mix(0.12, 0.34, hash(vec2(stream, 11.0))), 2.0));
      float wrinkle = sin(along * mix(85.0, 170.0, hash(vec2(stream, 13.0))) + uTime * mix(0.7, 1.8, hash(vec2(stream, 15.0))));
      disturbance += packet * wrinkle * uNaturalChaos * 0.42;
      disturbanceEnergy = max(disturbanceEnergy, packet * 0.45);
    }

    vec2 cell = floor(vUv * mix(26.0, 62.0, uDisturbanceFrequency));
    float tick = floor(uTime * mix(0.85, 2.8, uDisturbanceFrequency));
    float driftNoise = hash(cell + tick);
    float tinyTap = smoothstep(mix(0.995, 0.972, uDisturbanceFrequency), 1.0, driftNoise) * uDisturbanceFrequency;
    vec2 cellCenter = (cell + vec2(hash(cell + 2.0), hash(cell + 7.0))) / mix(26.0, 62.0, uDisturbanceFrequency);
    vec2 tapDelta = vec2((vUv.x - cellCenter.x) * uAspect, vUv.y - cellCenter.y);
    float tapDist = length(tapDelta);
    float tapRing = exp(-pow((tapDist - fract(uTime * 1.7 + driftNoise) * 0.055) / 0.006, 2.0));
    disturbance += tapRing * sin(tapDist * 170.0 - uTime * 8.0) * uTinyRippleStrength * 0.38;
    disturbanceEnergy = max(disturbanceEnergy, tapRing * tinyTap);

    next += disturbance * uRandomRippleStrength * uDisturbanceStrength * uNaturalChaos * 0.0028;
    energy = max(energy, disturbanceEnergy * uRandomRippleStrength * uDisturbanceStrength * 0.48);

    float neighborAverage = (cardinal + diagonal * 0.5) / 6.0;
    next = mix(next, neighborAverage, uViscosity);
    next = clamp(next, -0.18, 0.18);
    energy *= 0.976;

    gl_FragColor = vec4(next, h, energy, 1.0);
  }
`;

export const WATER_WALL_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const WATER_WALL_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uWaterState;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uAspect;
  uniform float uOpacity;
  uniform float uPondMotion;
  uniform float uPondScale;
  uniform float uPondSpeed;
  uniform float uWindAngle;
  uniform float uNormalStrength;
  uniform float uFineRippleStrength;
  uniform float uFineRippleScale;
  uniform float uMicroRippleStrength;
  uniform float uMicroRippleScale;
  uniform float uReflectionStrength;
  uniform float uFresnelStrength;
  uniform float uSpecularStrength;
  uniform float uRoughness;
  uniform float uDepthStrength;
  uniform float uContrast;
  uniform float uDefinition;
  uniform float uRingHighlightStrength;
  uniform float uRefractionStrength;
  uniform float uVignetteStrength;
  uniform float uShorelineReflection;
  uniform float uSunAngle;
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uBankColor;
  uniform vec3 uSunColor;

  varying vec2 vUv;

  float sampleHeight(vec2 uv) {
    return texture2D(uWaterState, clamp(uv, vec2(0.001), vec2(0.999))).r;
  }

  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += noise(p) * a;
      p = mat2(1.62, 1.08, -1.08, 1.62) * p;
      a *= 0.52;
    }
    return v;
  }

  float wave(vec2 p, vec2 dir, float frequency, float speed, float phase) {
    return sin(dot(p, normalize(dir)) * frequency + uTime * speed + phase);
  }

  vec2 proceduralSlope(vec2 p) {
    vec2 wind = vec2(cos(uWindAngle), sin(uWindAngle));
    vec2 crossWind = vec2(-wind.y, wind.x);
    float scale = mix(1.4, 8.5, clamp(uPondScale / 2.5, 0.0, 1.0));
    float speed = uPondSpeed;

    float a = wave(p, wind, scale, speed * 0.62, 0.1);
    float b = wave(p, normalize(wind * 0.7 + crossWind * 0.42), scale * 1.72, speed * 0.43, 2.2);
    float c = wave(p, normalize(wind * -0.28 + crossWind), scale * 2.85, speed * 0.31, 5.1);

    vec2 slope = vec2(0.0);
    slope += wind * cos(dot(p, normalize(wind)) * scale + uTime * speed * 0.62 + 0.1) * scale * 0.010;
    slope += normalize(wind * 0.7 + crossWind * 0.42) * cos(dot(p, normalize(wind * 0.7 + crossWind * 0.42)) * scale * 1.72 + uTime * speed * 0.43 + 2.2) * scale * 0.006;
    slope += normalize(wind * -0.28 + crossWind) * cos(dot(p, normalize(wind * -0.28 + crossWind)) * scale * 2.85 + uTime * speed * 0.31 + 5.1) * scale * 0.0035;

    float fineScale = mix(22.0, 90.0, clamp(uFineRippleScale / 3.0, 0.0, 1.0));
    float fineA = cos(dot(p, normalize(vec2(0.92, 0.24))) * fineScale + uTime * 0.45);
    float fineB = cos(dot(p, normalize(vec2(-0.34, 0.94))) * fineScale * 1.37 - uTime * 0.37);
    float fineNoiseA = fbm(p * fineScale * 0.45 + vec2(uTime * 0.025, -uTime * 0.018)) - 0.5;
    float fineNoiseB = fbm(p * fineScale * 0.55 - vec2(uTime * 0.016, uTime * 0.022)) - 0.5;

    float microScale = mix(95.0, 210.0, clamp(uMicroRippleScale / 3.0, 0.0, 1.0));
    vec2 microWind = normalize(wind * 0.82 + crossWind * 0.18);
    vec2 microCross = normalize(crossWind * 0.74 - wind * 0.26);
    float microA = cos(dot(p, microWind) * microScale + uTime * 0.92);
    float microB = cos(dot(p, microCross) * microScale * 1.41 - uTime * 0.73);
    float microNoise = fbm(p * microScale * 0.20 + vec2(uTime * 0.035, uTime * 0.018)) - 0.5;

    slope += vec2(fineA * 0.006 + fineNoiseA * 0.032, fineB * 0.006 + fineNoiseB * 0.032) * uFineRippleStrength;
    slope += (microWind * microA * 0.0028 + microCross * microB * 0.0021 + vec2(microNoise) * 0.006) * uMicroRippleStrength;
    return slope * uPondMotion;
  }

  vec3 environmentColor(vec2 reflectedUv, vec2 normalOffset, float fresnel) {
    vec2 uv = reflectedUv + normalOffset * 0.12;
    float skyGradient = smoothstep(-0.15, 1.12, uv.y);
    float cloud = fbm(vec2(uv.x * 2.2, uv.y * 0.84) + vec2(uTime * 0.006, 0.0));
    float cloudMask = smoothstep(0.52, 0.82, cloud) * 0.34;

    float horizon = exp(-pow((uv.y - 0.58) / 0.16, 2.0));
    float farBankNoise = fbm(vec2(uv.x * 6.0 + normalOffset.x * 4.0, uv.y * 2.4 - 1.2));
    float farBank = smoothstep(0.46, 0.72, farBankNoise + horizon * 0.45) * horizon;

    float verticalStreaks = fbm(vec2(uv.x * 18.0, uv.y * 5.2 + 1.7));
    float treeReflection = smoothstep(0.48, 0.86, verticalStreaks) * smoothstep(0.2, 0.95, uv.y) * uShorelineReflection;

    vec3 sky = mix(uHorizonColor, uSkyColor, skyGradient) + uSkyColor * cloudMask * 0.28;
    vec3 bank = mix(uBankColor * 0.8, uHorizonColor * 0.55, farBankNoise * 0.35);
    vec3 env = mix(sky, bank, clamp(farBank * uShorelineReflection, 0.0, 0.85));
    env = mix(env, uBankColor, treeReflection * 0.18);
    return env * (0.84 + fresnel * 0.26);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uAspect;

    float hL = sampleHeight(uv - vec2(uTexel.x, 0.0));
    float hR = sampleHeight(uv + vec2(uTexel.x, 0.0));
    float hD = sampleHeight(uv - vec2(0.0, uTexel.y));
    float hU = sampleHeight(uv + vec2(0.0, uTexel.y));
    vec4 state = texture2D(uWaterState, uv);
    float h = state.r;
    float previous = state.g;
    float energy = state.b;

    vec2 simSlope = vec2(hL - hR, hD - hU) * uNormalStrength * 2.2;
    vec2 slope = simSlope + proceduralSlope(p);
    vec3 normal = normalize(vec3(slope, 1.0));

    vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
    vec3 sunDir = normalize(vec3(cos(uSunAngle) * 0.42, sin(uSunAngle) * 0.26, 0.88));
    vec3 halfDir = normalize(viewDir + sunDir);

    float ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 3.0) * uFresnelStrength;
    float diffuse = clamp(dot(normal, sunDir), 0.0, 1.0);
    float specPower = mix(520.0, 46.0, clamp(uRoughness, 0.0, 1.0));
    float specular = pow(max(dot(normal, halfDir), 0.0), specPower) * uSpecularStrength;

    vec2 refractedUv = uv + normal.xy * uRefractionStrength + vec2(0.0, h * 0.12);
    float depth = smoothstep(-0.12, 1.12, refractedUv.y + h * 0.7);
    vec3 waterBody = mix(uDeepColor, uShallowColor, depth * uDepthStrength);

    vec2 reflectedUv = vec2(uv.x, 1.0 - uv.y) + normal.xy * 0.10 + vec2(0.0, h * 0.22);
    vec3 reflection = environmentColor(reflectedUv, normal.xy, fresnel);
    float reflectionMix = clamp(0.32 + fresnel * 0.7 + uReflectionStrength * 0.22, 0.0, 0.88);
    vec3 color = mix(waterBody, reflection, reflectionMix);

    float curvature = (hL + hR + hD + hU - 4.0 * h) * 24.0;
    float slopeAmount = length(slope);
    float tinyGlints = smoothstep(0.62, 0.95, fbm(p * 74.0 + normal.xy * 8.0 + uTime * 0.025));
    float definition = smoothstep(0.008, 0.072, slopeAmount * uDefinition + abs(curvature) * 0.11 + energy * 0.055);
    float ringEdge = smoothstep(0.018, 0.18, abs(curvature) * uRingHighlightStrength + energy * 0.18);
    float crestLight = max(curvature, 0.0) * 0.34 + max(h - previous, 0.0) * 13.0;
    float troughShade = max(-curvature, 0.0) * 0.22;

    color += uSkyColor * definition * 0.055;
    color += uSunColor * specular * (1.0 + tinyGlints * 0.75);
    color += uSunColor * tinyGlints * definition * 0.032;
    color += mix(uSkyColor, uSunColor, 0.28) * ringEdge * 0.05;
    color += uSkyColor * crestLight * 0.058;
    color *= 1.0 - troughShade * 0.075;
    color *= 0.92 + diffuse * 0.08;

    float edgeDistance = length(vec2((uv.x - 0.5) * uAspect, uv.y - 0.5));
    float vignette = smoothstep(0.95, 0.18, edgeDistance);
    color *= mix(1.0 - uVignetteStrength * 0.28, 1.0, vignette);
    color = mix(vec3(0.5), color, uContrast);
    color = pow(max(color, vec3(0.0)), vec3(0.92));

    gl_FragColor = vec4(color, uOpacity);
  }
`;
