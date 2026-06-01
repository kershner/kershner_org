export const MOBILE_BREAKPOINT = 768;
export const DESKTOP_PIXEL_RATIO_LIMIT = 1.5;

// Returns true when the viewport should use mobile-oriented defaults.
export function isMobileWidth(width = 0) {
  return Number(width) < MOBILE_BREAKPOINT;
}

// Creates the initial viewport without forcing browser globals at import time.
export function createViewport(options = {}) {
  const hasWindow = typeof window !== "undefined";

  return {
    width: options.width || (hasWindow ? window.innerWidth : 1),
    height: options.height || (hasWindow ? window.innerHeight : 1),
    devicePixelRatio: options.devicePixelRatio || (hasWindow ? window.devicePixelRatio : 1) || 1,
  };
}

// Returns the small device info object passed into responsive wall defaults.
export function getDeviceInfo(viewport) {
  return {
    width: viewport.width,
    height: viewport.height,
    devicePixelRatio: viewport.devicePixelRatio,
    isMobile: isMobileWidth(viewport.width),
  };
}

// Caps renderer pixel ratio to keep mobile GPUs cool and desktop rendering sharp enough.
export function getRendererPixelRatio(viewport) {
  const limit = isMobileWidth(viewport.width) ? 1 : DESKTOP_PIXEL_RATIO_LIMIT;
  return Math.min(viewport.devicePixelRatio || 1, limit);
}
