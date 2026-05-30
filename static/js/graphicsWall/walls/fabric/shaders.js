export const CLOTH_VERTEX_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uCursorRadius;
  uniform float uPulseStrength;
  uniform float uPulseRadius;
  uniform float uVelocityStrength;
  uniform float uPleatStrength;
  uniform float uPleatScale;
  uniform float uPleatSpeed;
  uniform float uDrapeStrength;
  uniform float uTensionStrength;
  uniform float uPinStrength;
  uniform float uHoverDepth;
  uniform float uTouchDepth;
  uniform float uDragStrength;
  uniform float uWrinkleStrength;
  uniform float uWrinkleScale;
  uniform float uPulseWaveStrength;
  uniform float uPulseFrequency;
  uniform float uPulseSpeed;
  uniform float uPointerDown;
  uniform float uClickPulse;
  uniform vec2 uPointerSmooth;
  uniform vec2 uPointerVelocity;
  uniform vec2 uPulsePointer;

  varying vec2 vUv;
  varying float vHeight;
  varying float vPleat;
  varying float vInteraction;
  varying float vTension;
  varying float vPin;

  void main() {
    vUv = uv;

    vec3 p = position;
    vec2 centered = uv * 2.0 - 1.0;
    float t = uTime;

    float topPin = smoothstep(0.60, 1.0, uv.y) * uPinStrength;
    float bottomWeight = pow(max(1.0 - uv.y, 0.0), 1.35);
    float freedom = clamp(1.0 - topPin * 0.92, 0.06, 1.0);

    float pleatA = sin((centered.x * 0.92 + centered.y * 0.09) * uPleatScale + t * uPleatSpeed);
    float pleatB = sin((centered.x * 1.84 - centered.y * 0.12) * uPleatScale - t * uPleatSpeed * 0.38);
    float pleatC = sin((centered.x * 3.70 + centered.y * 0.22) * uPleatScale + t * uPleatSpeed * 0.18);
    float pleat = pleatA * 0.64 + pleatB * 0.26 + pleatC * 0.10;
    float pleatMask = mix(0.40, 1.0, bottomWeight) * freedom;

    vec2 pointerDelta = vec2((p.x - uPointerSmooth.x) * uAspect, p.y - uPointerSmooth.y);
    float pointerDistance = length(pointerDelta);
    float pointerRadius = max(uCursorRadius, 0.001);
    float pointerField = exp(-pointerDistance * pointerDistance / (pointerRadius * pointerRadius));
    float rimDistance = pointerDistance - pointerRadius * 0.58;
    float rimWidth = max(pointerRadius * 0.20, 0.001);
    float rim = exp(-(rimDistance * rimDistance) / (rimWidth * rimWidth));

    float press = pointerField * (uHoverDepth + uPointerDown * uTouchDepth) * freedom;
    float angle = atan(pointerDelta.y, pointerDelta.x);
    float radialWrinkles = sin(pointerDistance * uWrinkleScale - t * 2.2 + sin(angle * 8.0) * 0.65);
    radialWrinkles *= rim * uWrinkleStrength * (0.35 + uPointerDown * 0.65) * freedom;

    vec2 velocity = vec2(uPointerVelocity.x * uAspect, uPointerVelocity.y);
    float speed = clamp(length(velocity) * uVelocityStrength, 0.0, 1.0);
    vec2 dragDirection = -normalize(velocity + vec2(0.0001, 0.0));
    vec2 drag = dragDirection * pointerField * speed * uDragStrength * 0.105 * freedom;

    vec2 pulseDelta = vec2((p.x - uPulsePointer.x) * uAspect, p.y - uPulsePointer.y);
    float pulseDistance = length(pulseDelta);
    float pulseAge = 1.0 - uClickPulse;
    float pulseCenter = mix(0.02, uPulseRadius, pulseAge);
    float pulseWidth = max(0.035 + pulseAge * 0.045, 0.001);
    float pulseOffset = pulseDistance - pulseCenter;
    float pulseMask = exp(-(pulseOffset * pulseOffset) / (pulseWidth * pulseWidth));
    float pulse = sin(pulseDistance * uPulseFrequency - t * uPulseSpeed) * pulseMask * uClickPulse * uPulseStrength * uPulseWaveStrength * freedom;

    float height = pleat * uPleatStrength * pleatMask + radialWrinkles + pulse - press * 0.28;
    float sag = -bottomWeight * uDrapeStrength;
    float sideTension = pow(abs(centered.x), 1.6) * bottomWeight;
    float catenary = -centered.x * centered.x * uTensionStrength * bottomWeight;

    p.x += drag.x + pleat * uPleatStrength * 0.19 * pleatMask - centered.x * sideTension * uTensionStrength * 0.05;
    p.y += drag.y + sag + catenary - press * 0.018;
    p.z += height + press * 0.32;

    vHeight = height;
    vPleat = pleat;
    vInteraction = clamp(pointerField * (0.25 + uPointerDown * 0.75) + pulseMask * uClickPulse, 0.0, 1.0);
    vTension = clamp(topPin + sideTension + abs(pleat) * 0.28 + speed * pointerField, 0.0, 1.0);
    vPin = topPin;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const CLOTH_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uOpacity;
  uniform float uSheenStrength;
  uniform float uSheenScale;
  uniform float uSheenSharpness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uVignetteStrength;
  uniform float uThreadStrength;
  uniform float uThreadScale;
  uniform float uThreadDefinition;
  uniform float uRibStrength;
  uniform float uRibScale;
  uniform float uTranslucency;
  uniform float uCutDarkness;
  uniform sampler2D uCutTexture;
  uniform vec3 uBaseColor;
  uniform vec3 uShadowColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uCursorColor;

  varying vec2 vUv;
  varying float vHeight;
  varying float vPleat;
  varying float vInteraction;
  varying float vTension;
  varying float vPin;

  vec3 saturateColor(vec3 color, float amount) {
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(gray), color, amount);
  }

  float threadLine(float value, float scale, float width) {
    float cell = abs(fract(value * scale) - 0.5);
    return 1.0 - smoothstep(width, width + 0.045, cell);
  }

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;

    float cut = texture2D(uCutTexture, vec2(vUv.x, 1.0 - vUv.y)).r;
    float cutL = texture2D(uCutTexture, vec2(max(vUv.x - 0.003, 0.0), 1.0 - vUv.y)).r;
    float cutR = texture2D(uCutTexture, vec2(min(vUv.x + 0.003, 1.0), 1.0 - vUv.y)).r;
    float cutU = texture2D(uCutTexture, vec2(vUv.x, 1.0 - min(vUv.y + 0.003, 1.0))).r;
    float cutD = texture2D(uCutTexture, vec2(vUv.x, 1.0 - max(vUv.y - 0.003, 0.0))).r;
    float cutEdge = clamp(max(max(cutL, cutR), max(cutU, cutD)) - cut, 0.0, 1.0);

    float warp = threadLine(centered.x + vPleat * 0.016, uThreadScale, uThreadDefinition);
    float weft = threadLine(centered.y + vHeight * 0.035, uThreadScale * 0.72, uThreadDefinition * 1.22);
    float weave = (warp * 0.62 + weft * 0.38 - 0.5) * uThreadStrength;

    float ribs = sin((centered.x + vPleat * 0.026) * uRibScale + vPleat * 2.6);
    float ribShade = ribs * uRibStrength;

    float foldShade = 0.5 + vPleat * 0.33 + vHeight * 2.2;
    float verticalSheen = pow(abs(sin((vUv.x * 1.08 + vPleat * 0.08) * uSheenScale)), uSheenSharpness);
    float crossSheen = pow(abs(sin((vUv.x * -0.36 + vUv.y * 0.82 + vHeight * 0.42) * uSheenScale * 0.72)), uSheenSharpness * 1.35);
    float sheen = (verticalSheen * 0.82 + crossSheen * 0.28) * uSheenStrength;
    sheen *= mix(0.62, 1.18, smoothstep(-0.2, 0.75, vPleat));

    float shade = clamp(foldShade + ribShade + weave, 0.0, 1.15);
    vec3 color = mix(uShadowColor, uBaseColor, smoothstep(0.18, 0.92, shade));
    color = mix(color, uHighlightColor, clamp(sheen * 0.58 + vTension * 0.10, 0.0, 1.0));

    float fiberDark = clamp((warp * weft) * uThreadStrength * 0.32, 0.0, 0.35);
    color *= 1.0 - fiberDark;

    float touchGlow = vInteraction * (0.24 + sheen * 0.16);
    color = mix(color, uCursorColor, clamp(touchGlow, 0.0, 0.55));

    float backlight = pow(max(1.0 - abs(vUv.y - 0.58) * 1.7, 0.0), 2.0) * uTranslucency;
    color += uHighlightColor * backlight;
    color *= 1.0 - vPin * 0.20;

    float vignetteAmount = distance(vUv, vec2(0.5, 0.5));
    float vignette = mix(1.0 - uVignetteStrength, 1.0, 1.0 - smoothstep(0.12, 0.86, vignetteAmount));
    color *= vignette;
    color = (color - 0.5) * uContrast + 0.5;
    color = saturateColor(color, uSaturation);

    color = mix(color, uShadowColor, clamp(cutEdge * uCutDarkness, 0.0, 0.9));
    color += uHighlightColor * cutEdge * 0.16;

    float alpha = uOpacity * (0.90 + backlight * 0.16 + sheen * 0.035);
    alpha *= 1.0 - smoothstep(0.2, 0.85, cut);
    alpha += cutEdge * 0.05;
    if (alpha < 0.015) discard;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
  }
`;
