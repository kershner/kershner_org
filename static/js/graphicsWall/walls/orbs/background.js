import { clamp } from "./math.js";

export function makeBackgroundGradientColors(THREE, baseColor) {
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

export function makeBackgroundMaterial(THREE, colors) {
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
