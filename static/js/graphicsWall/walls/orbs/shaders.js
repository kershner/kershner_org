export const ORBS_WALL_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const ORBS_WALL_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uOpacity;
  uniform float uCursorRadius;
  uniform float uCursorStrength;
  uniform float uPulseStrength;
  uniform float uPulseRadius;
  uniform float uClickPulse;
  uniform vec2 uPointerSmooth;
  uniform vec2 uPulsePointer;
  uniform vec3 uBackgroundColor;
  uniform vec3 uBackgroundLiftColor;
  uniform vec3 uKeyLightColor;
  uniform vec3 uFillLightColor;
  uniform vec3 uChromeColor;
  uniform vec3 uWarmOrbColor;
  uniform vec3 uCoolOrbColor;
  uniform vec3 uDarkOrbColor;
  uniform float uOrbCount;
  uniform float uOrbScale;
  uniform float uDriftSpeed;
  uniform float uSpread;
  uniform float uChrome;
  uniform float uTextureStrength;
  uniform float uContrast;
  uniform float uRetroBanding;
  uniform float uGrain;
  uniform float uVignette;

  varying vec2 vUv;

  const float FAR_CLIP = 38.0;
  const int MAX_ORBS = 12;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float sphereRadius(float i) {
    float seed = i * 29.73;
    float base = mix(0.48, 1.3, pow(hash(seed + 3.0), 0.75));
    float huge = step(0.68, hash(seed + 33.0)) * mix(0.85, 1.75, hash(seed + 4.0));
    float nearBoost = smoothstep(0.55, 0.98, hash(seed + 5.0)) * 0.42;
    return (base + huge + nearBoost) * uOrbScale;
  }

  vec3 orbPosition(float i) {
    float seed = i * 37.21;
    float speed = (0.34 + hash(seed + 8.0) * 0.58) * uDriftSpeed;
    float lane = (hash(seed + 1.0) - 0.5) * 9.2 * uSpread;
    float z = mix(4.1, 18.5, pow(hash(seed + 2.0), 1.45));
    float cycle = 12.4 + sphereRadius(i) * 1.2;
    float y = -6.2 - sphereRadius(i) + mod(hash(seed + 4.0) * cycle + uTime * speed, cycle);

    float x = lane;
    x += sin(uTime * (0.11 + hash(seed + 7.0) * 0.16) + seed) * (0.45 + hash(seed + 9.0) * 0.95) * uSpread;
    x += sin(uTime * (0.035 + hash(seed + 10.0) * 0.07) + seed * 1.7) * 0.8 * uSpread;
    y += sin(uTime * (0.09 + hash(seed + 11.0) * 0.11) + seed) * 0.34;

    vec2 pointer = vec2(uPointerSmooth.x * 5.8, uPointerSmooth.y * 3.3);
    vec2 away = vec2(x, y) - pointer;
    float influence = exp(-dot(away, away) / max(uCursorRadius * uCursorRadius * 22.0, 0.001));
    vec2 push = normalize(away + vec2(0.03, -0.02)) * influence * uCursorStrength * (0.7 + z * 0.025);
    x += push.x;
    y += push.y;

    return vec3(x, y, z);
  }

  vec2 mapScene(vec3 p) {
    vec2 result = vec2(999.0, -1.0);

    for (int i = 0; i < MAX_ORBS; i++) {
      float fi = float(i);
      if (fi >= uOrbCount) break;
      vec3 c = orbPosition(fi);
      float r = sphereRadius(fi);
      float d = length(p - c) - r;
      if (d < result.x) result = vec2(d, 10.0 + fi);
    }

    return result;
  }

  vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0035, 0.0);
    return normalize(vec3(
      mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
      mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
      mapScene(p + e.yyx).x - mapScene(p - e.yyx).x
    ));
  }

  vec3 background(vec3 rd) {
    float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBackgroundColor, uBackgroundLiftColor, pow(h, 1.25) * 0.62);
    float lightFalloff = exp(-dot(rd.xy - vec2(-0.18, 0.22), rd.xy - vec2(-0.18, 0.22)) * 1.7);
    float lowShelf = exp(-pow((rd.y + 0.22) / 0.26, 2.0)) * 0.24;
    col += uKeyLightColor * lightFalloff * 0.08;
    col += uFillLightColor * lowShelf * 0.05;
    return col;
  }

  float reflectionPanel(vec3 r, vec2 center, vec2 size, float soft) {
    vec2 q = abs(r.xy - center) - size;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    return 1.0 - smoothstep(0.0, soft, d);
  }

  vec3 environment(vec3 r) {
    vec3 col = background(r) * 0.7;
    col += uKeyLightColor * reflectionPanel(r, vec2(-0.42, 0.42), vec2(0.28, 0.66), 0.12) * 1.65;
    col += vec3(1.0) * reflectionPanel(r, vec2(0.33, 0.18), vec2(0.1, 0.5), 0.08) * 0.75;
    col += uFillLightColor * reflectionPanel(r, vec2(0.5, -0.2), vec2(0.22, 0.34), 0.12) * 0.56;
    col += uChromeColor * exp(-pow(length(r.xy - vec2(0.05, 0.72)) / 0.14, 2.0)) * 0.65;
    col += uBackgroundColor * smoothstep(0.55, -0.5, r.y) * 0.9;
    return col;
  }

  vec3 orbBaseColor(float fi) {
    float seed = fi * 41.13;
    float pick = hash(seed + 10.0);
    vec3 spectrum = hsv2rgb(vec3(hash(seed + 12.0), 0.72 + hash(seed + 13.0) * 0.24, 0.72 + hash(seed + 14.0) * 0.28));
    vec3 warm = mix(uWarmOrbColor, spectrum, 0.55);
    vec3 cool = mix(uCoolOrbColor, spectrum, 0.6);
    vec3 dark = mix(uDarkOrbColor, spectrum * 0.75, 0.52);
    vec3 col = mix(warm, cool, smoothstep(0.18, 0.78, pick));
    col = mix(col, dark, step(0.78, hash(seed + 15.0)) * 0.45);
    col = mix(col, uChromeColor, step(0.9, hash(seed + 16.0)) * 0.72);
    return max(col, vec3(0.08));
  }

  float orbPattern(float fi, vec3 local, vec3 n) {
    float seed = fi * 53.91;
    float kind = floor(hash(seed + 14.0) * 6.0);
    vec3 q = local;
    q.xy *= rot(seed * 0.37 + uTime * (0.025 + hash(seed + 1.0) * 0.04));
    float marble = sin((q.x * 9.0 + q.y * 5.0 + q.z * 4.0) + noise(q.xy * 5.0 + seed) * 7.0);
    float bands = sin((q.y + q.z * 0.34) * (14.0 + hash(seed + 2.0) * 28.0));
    float checker = step(0.5, mod(floor((q.x + 1.0) * 6.0) + floor((q.y + 1.0) * 6.0) + floor((q.z + 1.0) * 6.0), 2.0));
    float speck = step(0.76, noise(q.xy * 24.0 + q.z * 7.0 + seed));
    float contour = smoothstep(0.1, 0.16, abs(sin(atan(q.y, q.x) * (4.0 + hash(seed + 8.0) * 8.0) + q.z * 5.0)));
    float facets = pow(abs(dot(n, normalize(vec3(hash(seed), hash(seed + 1.0), hash(seed + 2.0)) * 2.0 - 1.0))), 4.0);

    float p = marble * 0.5 + 0.5;
    p = mix(p, bands * 0.5 + 0.5, step(1.0, kind));
    p = mix(p, checker, step(2.0, kind));
    p = mix(p, speck, step(3.0, kind));
    p = mix(p, contour, step(4.0, kind));
    p = mix(p, facets, step(5.0, kind));
    return p;
  }

  vec3 shadeOrb(vec3 p, vec3 n, vec3 rd, float id) {
    float fi = id - 10.0;
    vec3 c = orbPosition(fi);
    float r = sphereRadius(fi);
    vec3 local = (p - c) / max(r, 0.001);
    float seed = fi * 61.77;

    float bumpA = noise(local.xy * (9.0 + hash(seed) * 18.0) + local.z * 3.0 + seed);
    float bumpB = noise(local.yz * (12.0 + hash(seed + 2.0) * 16.0) - local.x * 2.0 + seed * 0.3);
    n = normalize(n + (vec3(bumpA, bumpB, bumpA - bumpB) - 0.5) * uTextureStrength * (0.08 + hash(seed + 3.0) * 0.16));

    vec3 lightDir = normalize(vec3(-0.44, 0.7, -0.56));
    vec3 fillDir = normalize(vec3(0.6, -0.04, -0.5));
    vec3 halfDir = normalize(lightDir - rd);
    vec3 refl = reflect(rd, n);

    float diffuse = max(dot(n, lightDir), 0.0);
    float fill = max(dot(n, fillDir), 0.0);
    float spec = pow(max(dot(n, halfDir), 0.0), 60.0 + hash(seed + 4.0) * 120.0);
    float hardSpec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 160.0 + hash(seed + 5.0) * 220.0);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.65);

    float pattern = orbPattern(fi, local, n);
    vec3 base = orbBaseColor(fi);
    vec3 accent = hsv2rgb(vec3(hash(seed + 19.0), 0.78, 0.98));
    vec3 textureTint = mix(base * 0.42, accent, pattern);
    base = mix(base, textureTint, uTextureStrength * (0.28 + hash(seed + 6.0) * 0.42));

    float materialKind = hash(seed + 7.0);
    float metallic = clamp(0.2 + hash(seed + 8.0) * 0.95 + uChrome * 0.35, 0.0, 1.65);
    float mirror = smoothstep(0.38, 1.18, metallic) * uChrome;
    mirror = mix(mirror * 0.58, mirror, step(0.28, materialKind));
    mirror = mix(mirror, 1.18, step(0.82, materialKind));

    vec3 env = environment(refl);
    vec3 col = base * (0.32 + diffuse * 0.82 + fill * 0.28);
    col = mix(col, env * (0.95 + mirror * 0.4), clamp(mirror * 0.52, 0.0, 0.92));
    col += uKeyLightColor * spec * (0.8 + uChrome * 0.42);
    col += uChromeColor * hardSpec * (1.2 + uChrome * 0.7);
    col += env * fresnel * (0.4 + uChrome * 0.55);

    float rim = smoothstep(0.44, 0.96, fresnel) * (0.32 + hash(seed + 9.0) * 0.34);
    col += mix(uFillLightColor, base, 0.5) * rim;
    return col;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uAspect;

    vec2 pulse = (vUv * 2.0 - 1.0) - uPulsePointer;
    pulse.x *= uAspect;
    float pulseRing = exp(-pow((length(pulse) - (1.0 - uClickPulse) * uPulseRadius) / 0.06, 2.0)) * uClickPulse;

    vec3 ro = vec3(0.0, 0.0, -7.6);
    ro.xy += vec2(sin(uTime * 0.06), cos(uTime * 0.05)) * 0.08;
    vec3 target = vec3(sin(uTime * 0.04) * 0.26, cos(uTime * 0.045) * 0.18, 10.0);
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.28 * ww);

    vec3 col = background(rd);
    float t = 0.0;
    float id = -1.0;
    float glow = 0.0;

    for (int i = 0; i < 78; i++) {
      vec3 p = ro + rd * t;
      vec2 hit = mapScene(p);
      float d = hit.x;
      id = hit.y;
      glow += exp(-abs(d) * 7.0) * 0.0018;
      if (d < 0.004 || t > FAR_CLIP) break;
      t += d * 0.8;
    }

    if (t < FAR_CLIP && id > 0.0) {
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p);
      col = shadeOrb(p, n, rd, id);
      float fog = smoothstep(18.0, FAR_CLIP, t);
      col = mix(col, background(rd), fog * 0.54);
    }

    col += uFillLightColor * glow;
    col += uKeyLightColor * pulseRing * uPulseStrength * 0.12;

    col = (col - 0.5) * uContrast + 0.5;
    col = max(col, vec3(0.0));

    float bands = max(18.0, mix(240.0, 44.0, uRetroBanding));
    col = mix(col, floor(col * bands) / bands, uRetroBanding * 0.5);

    float grain = hash(floor(vUv * vec2(1440.0, 960.0)) + floor(uTime * 24.0));
    col += (grain - 0.5) * uGrain;

    float vig = smoothstep(1.48, 0.14, length((vUv - 0.5) * vec2(uAspect, 1.0)));
    col *= mix(1.0 - uVignette * 0.48, 1.0, vig);

    gl_FragColor = vec4(col, uOpacity);
  }
`;
