export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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

export function getPath(object, path) {
  if (!path) return object;

  return path.split(".").reduce((current, key) => {
    if (!current) return undefined;
    return current[key];
  }, object);
}

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

export function normalizeInitOptions(options) {
  const normalized = {
    type: options.type || "grass",
    global: {},
    interaction: {},
    wall: {},
  };

  const globalKeys = new Set(["zIndex", "showControls", "fullscreen", "opacity"]);
  const interactionKeys = new Set([
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

  Object.entries(options).forEach(([key, value]) => {
    if (key === "type") return;

    if (key === "global" || key === "interaction" || key === "wall") {
      normalized[key] = mergeDeep(normalized[key], value);
      return;
    }

    if (globalKeys.has(key)) {
      normalized.global[key] = value;
      return;
    }

    if (interactionKeys.has(key)) {
      normalized.interaction[key] = value;
      return;
    }

    normalized.wall[key] = value;
  });

  return normalized;
}
