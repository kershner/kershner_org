import { clamp, lerp } from "../../core/utils.js";


// Mixes two colors into an existing output color.
export function mixColor(out, a, b, t) {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
  return out;
}

// Creates a related HSL color from an existing THREE color.
export function derivedHslColor(THREE, source, lightness, saturationScale = 1, saturationAdd = 0) {
  const hsl = { h: 0, s: 0, l: 0 };
  source.getHSL(hsl);
  return new THREE.Color().setHSL(
    hsl.h,
    clamp(hsl.s * saturationScale + saturationAdd, 0, 1),
    clamp(lightness, 0, 1),
  );
}

