export const WATER_WALL_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const WATER_WALL_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uOpacity;
  uniform float uWaveScale;
  uniform float uWaveStrength;
  uniform float uWaveSpeed;
  uniform float uDetailStrength;
  uniform float uSurfaceDistortion;
  uniform float uReflectionStrength;
  uniform float uCausticStrength;
  uniform float uFoamStrength;
  uniform float uRippleStrength;
  uniform float uCursorRadius;
  uniform float uPulseStrength;
  uniform float uPulseRadius;
  uniform float uClickPulse;
  uniform float uPointerDown;
  uniform vec2 uPointerSmooth;
  uniform vec2 uPointerVelocity;
  uniform vec2 uPulsePointer;
  uniform vec3 uWaterColor;
  uniform vec3 uDeepColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uCursorColor;

  varying vec2 vUv;

  float wave(vec2 p, vec2 direction, float frequency, float speed, float phase) {
    return sin(dot(p, normalize(direction)) * frequency + uTime * speed + phase);
  }

  float heightField(vec2 p) {
    float t = uTime * uWaveSpeed;
    float h = 0.0;

    h += wave(p, vec2(1.0, 0.22), 4.3 * uWaveScale, 0.72 * uWaveSpeed, 0.1) * 0.38;
    h += wave(p, vec2(-0.42, 1.0), 6.7 * uWaveScale, 1.08 * uWaveSpeed, 2.2) * 0.24;
    h += wave(p, vec2(0.72, -0.58), 10.1 * uWaveScale, 1.52 * uWaveSpeed, 4.1) * 0.13;
    h += sin((p.x * 17.0 + sin(p.y * 5.0 + t)) * uWaveScale + t * 1.8) * 0.05 * uDetailStrength;
    h += sin((p.y * 19.0 + cos(p.x * 4.0 - t)) * uWaveScale - t * 1.45) * 0.045 * uDetailStrength;

    vec2 pointerDelta = p - vec2(uPointerSmooth.x * uAspect, uPointerSmooth.y);
    float pointerDistance = length(pointerDelta);
    float pointerWake = 1.0 - smoothstep(0.0, max(uCursorRadius, 0.001), pointerDistance);
    float velocityAmount = clamp(length(vec2(uPointerVelocity.x * uAspect, uPointerVelocity.y)) * 18.0, 0.0, 1.0);

    h += sin(pointerDistance * 42.0 - uTime * 12.0) * pointerWake * uRippleStrength * (0.018 + velocityAmount * 0.055);
    h += pointerWake * uPointerDown * uRippleStrength * 0.07;

    vec2 pulseDelta = p - vec2(uPulsePointer.x * uAspect, uPulsePointer.y);
    float pulseDistance = length(pulseDelta);
    float pulseAge = 1.0 - uClickPulse;
    float radius = mix(0.04, uPulseRadius, pulseAge);
    float width = mix(0.18, 0.035, pulseAge);
    float ring = 1.0 - smoothstep(0.0, width, abs(pulseDistance - radius));

    h += sin((pulseDistance - radius) * 36.0) * ring * uClickPulse * uRippleStrength * uPulseStrength * 0.12;

    return h * uWaveStrength;
  }

  vec3 waterNormal(vec2 p) {
    float e = 0.0035;
    float h = heightField(p);
    float hx = heightField(p + vec2(e, 0.0));
    float hy = heightField(p + vec2(0.0, e));

    return normalize(vec3((h - hx) / e, (h - hy) / e, 1.0));
  }

  float caustic(vec2 p, float h) {
    vec2 q = p * (8.0 + uWaveScale * 3.0);
    q += vec2(
      sin(q.y * 1.7 + uTime * 0.9),
      cos(q.x * 1.4 - uTime * 0.75)
    ) * uSurfaceDistortion;

    float a = sin(q.x + h * 5.0 + uTime * 0.55);
    float b = sin(q.y * 1.31 - h * 4.0 - uTime * 0.42);
    float c = sin((q.x + q.y) * 0.72 + uTime * 0.33);
    float lines = abs(a + b + c) / 3.0;

    return pow(1.0 - smoothstep(0.18, 0.76, lines), 2.1);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uAspect;

    float h = heightField(p);
    vec3 n = waterNormal(p);

    vec3 lightDirection = normalize(vec3(-0.34, 0.48, 0.82));
    vec3 viewDirection = vec3(0.0, 0.0, 1.0);
    vec3 halfDirection = normalize(lightDirection + viewDirection);

    float diffuse = clamp(dot(n, lightDirection), 0.0, 1.0);
    float fresnel = pow(1.0 - clamp(dot(n, viewDirection), 0.0, 1.0), 3.0);
    float specular = pow(max(dot(n, halfDirection), 0.0), 96.0) * uReflectionStrength;

    vec2 distortedUv = uv + n.xy * uSurfaceDistortion * 0.045;
    float depthGradient = smoothstep(-0.85, 0.92, distortedUv.y + h * 0.35);

    vec3 color = mix(uDeepColor, uWaterColor, depthGradient);
    color = mix(color, uHighlightColor, diffuse * 0.22 + fresnel * 0.34);

    float c = caustic(p + n.xy * 0.2, h) * uCausticStrength;
    color += uHighlightColor * c * 0.34;
    color += uHighlightColor * specular * 1.45;

    float foam = smoothstep(0.32, 0.88, abs(h) + pow(fresnel, 0.58) * 0.7) * uFoamStrength;
    foam *= 0.45 + 0.55 * sin((p.x + p.y) * 18.0 + uTime * 1.8);
    foam = clamp(foam, 0.0, 1.0);
    color = mix(color, uHighlightColor, foam * 0.32);

    vec2 pointerDelta = p - vec2(uPointerSmooth.x * uAspect, uPointerSmooth.y);
    float pointerGlow = 1.0 - smoothstep(0.0, max(uCursorRadius, 0.001), length(pointerDelta));
    color += uCursorColor * pointerGlow * uRippleStrength * 0.18;

    float vignette = smoothstep(1.55, 0.28, length(vec2((uv.x - 0.5) * uAspect, uv.y - 0.5)));
    color *= 0.78 + vignette * 0.28;

    gl_FragColor = vec4(color, uOpacity);
  }
`;
