import { clamp, lerp } from "./math.js";

// Scales a color into an existing output color.
export function addScaledColor(out, color, scale) {
  out.r = clamp(color.r * scale, 0, 1);
  out.g = clamp(color.g * scale, 0, 1);
  out.b = clamp(color.b * scale, 0, 1);
  return out;
}

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

// Formats a THREE color as CSS rgb().
export function colorToCssRgb(color) {
  return `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;
}

// Formats a THREE color as CSS rgba().
export function colorToCssRgba(color, alpha) {
  return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${alpha})`;
}
