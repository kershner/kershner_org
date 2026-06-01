import { resolveTopLevelPath } from "./configSchema.js";


// Keeps numeric config values inside a safe range.
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

// Interpolates between two numbers.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Produces a smooth 0..1 transition between two edges.
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / ((edge1 - edge0) || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

// Measures the closest distance from a point to a segment.
export function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy || 1;
  const t = clamp((wx * vx + wy * vy) / lenSq, 0, 1);
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return { distance: Math.sqrt(dx * dx + dy * dy), along: t };
}

// Generates a stable pseudo-random value from a number.
export function hash01(value) {
  const n = Math.sin(value * 12.9898) * 43758.5453123;
  return n - Math.floor(n);
}

// Generates a random number inside a range.
export function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Checks whether a value is a plain mergeable object.
export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Recursively merges config objects without mutating the target.
export function mergeDeep(target, source) {
  const output = { ...target };

  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      output[key] = mergeDeep(targetValue, sourceValue);
      return;
    }

    output[key] = sourceValue;
  });

  return output;
}

// Reads a dotted path from an object.
export function getPath(object, path) {
  if (!path) return object;

  return path.split(".").reduce((current, key) => {
    if (!current) return undefined;
    return current[key];
  }, object);
}

// Writes a dotted path into an object.
export function setPath(object, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();

  const parent = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }

    return current[key];
  }, object);

  parent[lastKey] = value;
}

// Creates a tiny pub/sub event bus.
export function createEventBus() {
  const listeners = new Map();

  return {
    on(eventName, callback) {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }

      listeners.get(eventName).add(callback);

      return () => {
        listeners.get(eventName)?.delete(callback);
      };
    },

    emit(eventName, payload) {
      listeners.get(eventName)?.forEach((callback) => callback(payload));
    },
  };
}

// Normalizes public init options into global, interaction, and wall buckets.
export function normalizeInitOptions(options = {}) {
  const normalized = {
    type: options.type || "grass",
    global: {},
    interaction: {},
    wall: {},
  };

  Object.entries(options || {}).forEach(([key, value]) => {
    if (["type", "syncQueryParams"].includes(key)) return;

    if (key === "global" || key === "interaction" || key === "wall") {
      normalized[key] = mergeDeep(normalized[key], value);
      return;
    }

    const resolvedPath = resolveTopLevelPath(key);

    if (resolvedPath?.startsWith("global.")) {
      normalized.global[key] = value;
      return;
    }

    if (resolvedPath?.startsWith("interaction.")) {
      normalized.interaction[key] = value;
      return;
    }

    normalized.wall[key] = value;
  });

  return normalized;
}
