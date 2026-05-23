import { setPath } from "./utils.js";

const QUERY_ROOTS = new Set(["global", "interaction", "wall"]);
const GLOBAL_QUERY_KEYS = new Set(["zIndex", "showControls", "fullscreen", "opacity", "fadeInDuration", "rotateColors"]);
const INTERACTION_QUERY_KEYS = new Set([
  "cursorRadius",
  "cursorStrength",
  "verticalPush",
  "pointerSmoothing",
  "touchBoost",
  "brushStrength",
  "wakeStrength",
  "wakeLag",
  "pulseStrength",
  "pulseRadius",
  "pulseDecay",
  "velocityStrength",
]);
const NUMBER_PATTERN = /^-?(?:\d+|\d*\.\d+)(?:e[-+]?\d+)?$/i;

function canUseBrowserUrl() {
  return typeof window !== "undefined" && window.location && window.history;
}

function parseQueryValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (NUMBER_PATTERN.test(value)) return Number(value);
  return value;
}

function formatQueryValue(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value ?? "");
}

function isConfigPath(key) {
  const [root, ...rest] = key.split(".");
  return QUERY_ROOTS.has(root) && rest.length > 0 && rest.every(Boolean);
}

function normalizeQueryPath(key) {
  if (key === "type") return "type";
  if (isConfigPath(key)) return key;
  if (GLOBAL_QUERY_KEYS.has(key)) return `global.${key}`;
  if (INTERACTION_QUERY_KEYS.has(key)) return `interaction.${key}`;
  return null;
}

export function readGraphicsWallQueryParams(search = canUseBrowserUrl() ? window.location.search : "") {
  const options = {};
  const params = new URLSearchParams(search || "");

  params.forEach((value, key) => {
    const path = normalizeQueryPath(key);
    if (!path) return;

    if (path === "type") {
      options.type = value;
      return;
    }

    setPath(options, path, parseQueryValue(value));
  });


  return options;
}

export function updateGraphicsWallQueryParam(path, value, options = {}) {
  if (!canUseBrowserUrl()) return;

  const normalizedPath = normalizeQueryPath(path);
  if (!normalizedPath) return;

  const url = new URL(window.location.href);

  if (options.remove) {
    url.searchParams.delete(normalizedPath);
  } else {
    url.searchParams.set(normalizedPath, formatQueryValue(value));
  }

  window.history.replaceState(window.history.state, "", url);
}


export function clearGraphicsWallQueryParams() {
  if (!canUseBrowserUrl()) return;

  const url = new URL(window.location.href);

  Array.from(url.searchParams.keys()).forEach((key) => {
    if (normalizeQueryPath(key)) {
      url.searchParams.delete(key);
    }
  });

  window.history.replaceState(window.history.state, "", url);
}
