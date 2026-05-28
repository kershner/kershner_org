const DEFAULT_ASSET_BASE_URL = "/static";
const THREE_PATH = "vendor/three.js/r160/three.min.js";
const WORKER_PATH = "js/graphicsWall/graphicsWall.worker.js";

let threeLoadPromise = null;
let threeLoadUrl = null;

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeInitArgs(baseS3UrlOrOptions = {}, maybeOptions = {}) {
  if (typeof baseS3UrlOrOptions === "string") {
    return {
      ...maybeOptions,
      baseS3Url: baseS3UrlOrOptions,
    };
  }

  return baseS3UrlOrOptions || {};
}

function getAssetBaseUrl(options = {}) {
  return trimTrailingSlash(
    options.baseS3Url ||
    options.baseS3URL ||
    options.baseUrl ||
    options.assetBaseUrl ||
    window.GRAPHICS_WALL_BASE_S3_URL ||
    DEFAULT_ASSET_BASE_URL
  );
}

function getThreeUrl(options = {}) {
  if (options.threeUrl) return options.threeUrl;
  return `${getAssetBaseUrl(options)}/${THREE_PATH}`;
}

function getWorkerUrl(options = {}) {
  return options.workerUrl || `${getAssetBaseUrl(options)}/${WORKER_PATH}`;
}

function loadThree(options = {}) {
  if (window.THREE) return Promise.resolve(window.THREE);

  const threeUrl = getThreeUrl(options);

  if (!threeLoadPromise || threeLoadUrl !== threeUrl) {
    threeLoadUrl = threeUrl;
    threeLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = threeUrl;
      script.async = true;

      script.onload = () => resolve(window.THREE);
      script.onerror = () => reject(new Error(`Failed to load Three.js: ${threeUrl}`));

      document.head.appendChild(script);
    });
  }

  return threeLoadPromise;
}

function isIOSLike() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function supportsOffscreenCanvas() {
  return Boolean(
    !isIOSLike() &&
    window.Worker &&
    window.OffscreenCanvas &&
    HTMLCanvasElement.prototype.transferControlToOffscreen
  );
}

function createWallCanvas(options) {
  const canvas = document.createElement("canvas");

  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: options.zIndex ?? -1,
    opacity: "0",
    transition: `opacity ${options.fadeInDuration ?? 600}ms ease`,
    willChange: "opacity",
  });

  document.body.prepend(canvas);
  return canvas;
}

function revealCanvas(canvas, options) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      canvas.style.opacity = String(Math.max(0, Math.min(1, Number(options.opacity ?? 1))));
      window.setTimeout(() => {
        canvas.style.willChange = "auto";
      }, options.fadeInDuration ?? 600);
    });
  });
}

const GLOBAL_CONTROLS = [
  {
    title: "General",
    controls: [
      { type: "checkbox", path: "global.fullscreen", label: "Fullscreen", help: "Expands the wall to fill the viewport." },
      { type: "range", path: "global.opacity", label: "Opacity", min: 0, max: 1, step: 0.01, help: "Fades the whole wall without changing its settings." },
    ],
  },
  {
    title: "Interaction",
    controls: [
      { type: "range", path: "interaction.cursorRadius", label: "Cursor radius", min: 0.05, max: 1.2, step: 0.01, help: "Larger values affect elements farther from the cursor." },
      { type: "range", path: "interaction.pulseStrength", label: "Click pulse", min: 0, max: 0.7, step: 0.01, help: "Controls click-generated ripples.", walls: ["grass", "water"] },
      { type: "range", path: "interaction.pulseRadius", label: "Pulse radius", min: 0.15, max: 2, step: 0.01, help: "Controls the starting size of click pulses.", walls: ["grass", "water"] },
      { type: "range", path: "interaction.pulseDecay", label: "Pulse decay", min: 0.85, max: 0.99, step: 0.001, help: "Higher values make click pulses linger.", walls: ["grass", "water"] },
    ],
  },
];

const DEFAULT_CONFIG = {
  global: {
    zIndex: -1,
    showControls: true,
    fullscreen: false,
    opacity: 1,
    fadeInDuration: 600,
    rotateColors: true,
  },
  interaction: {
    cursorRadius: 0.3,
    cursorStrength: 0.13,
    verticalPush: 0,
    pointerSmoothing: 0.3,
    touchBoost: 2,
    brushStrength: 0.09,
    wakeStrength: 0.34,
    wakeLag: 0.132,
    pulseStrength: 0.7,
    pulseRadius: 2,
    pulseDecay: 0.965,
    velocityStrength: 13.2,
  },
  wall: {},
};

const wallTypes = {
  grass: () => import("./walls/grass/index.js").then((m) => m.createGrassWall),
  water: () => import("./walls/water/index.js").then((m) => m.createWaterWall),
  orbs: () => import("./walls/orbs/index.js").then((m) => m.createOrbsWall),
};

const wallControls = {
  grass: () => import("./walls/grass/controls.js").then((m) => m.grassControls),
  water: () => import("./walls/water/controls.js").then((m) => m.waterControls),
  orbs: () => import("./walls/orbs/controls.js").then((m) => m.orbsControls),
};

const wallDefaults = {
  grass: () => import("./walls/grass/defaults.js").then((m) => m.grassDefaults),
  water: () => import("./walls/water/defaults.js").then((m) => m.waterDefaults),
  orbs: () => import("./walls/orbs/defaults.js").then((m) => m.orbsDefaults),
};

async function getWallDefaults(type) {
  return wallDefaults[type] ? wallDefaults[type]() : {};
}

async function createLocalConfig(type, options) {
  const [{ mergeDeep, normalizeInitOptions }, defaults] = await Promise.all([
    import("./core/utils.js"),
    getWallDefaults(type),
  ]);
  const normalized = normalizeInitOptions(options);
  return mergeDeep(mergeDeep(DEFAULT_CONFIG, defaults), {
    global: normalized.global,
    interaction: normalized.interaction,
    wall: normalized.wall,
  });
}

async function createWorkerProxy({ worker, canvas, options, wallType }) {
  const [{ createControls }, { createFullscreenController }, utils] = await Promise.all([
    import("./core/controls.js"),
    import("./core/fullscreen.js"),
    import("./core/utils.js"),
  ]);
  const { createEventBus, getPath, setPath } = utils;

  const events = createEventBus();
  const wallControlCache = new Map();
  let type = wallType;
  let config = await createLocalConfig(type, options);
  let controls = null;

  const fullscreen = createFullscreenController({
    canvas,
    getControlsElement: () => controls?.getElement(),
  });

  async function getTypeControls(currentType) {
    if (!wallControlCache.has(currentType)) {
      wallControlCache.set(currentType, await wallControls[currentType]());
    }
    return wallControlCache.get(currentType);
  }

  function post(message) {
    worker.postMessage(message);
  }

  const api = {
    set(path, value) {
      if (path === "type") return api.setType(value);

      if (!path.includes(".")) {
        path = `wall.${path}`;
      }

      setPath(config, path, value);
      post({ type: "set", path, value });

      if (path === "global.fullscreen") {
        fullscreen.set(Boolean(value));
      }

      if (path === "global.opacity") {
        canvas.style.opacity = String(Math.max(0, Math.min(1, Number(value ?? 1))));
      }

      if (path === "global.zIndex") {
        canvas.style.zIndex = value;
      }

      events.emit("configchange", { path, value });
      return true;
    },

    get(path) {
      if (!path.includes(".")) {
        const globalPath = ["fullscreen", "opacity", "zIndex", "showControls", "fadeInDuration", "rotateColors"].includes(path) ? `global.${path}` : null;
        const interactionPath = [
          "cursorRadius", "cursorStrength", "verticalPush", "pointerSmoothing", "touchBoost", "brushStrength",
          "wakeStrength", "wakeLag", "pulseStrength", "pulseRadius", "pulseDecay", "velocityStrength",
        ].includes(path) ? `interaction.${path}` : null;
        path = globalPath || interactionPath || `wall.${path}`;
      }

      return getPath(config, path);
    },

    async setType(nextType) {
      if (nextType === type || !wallTypes[nextType]) return true;

      type = nextType;
      config = await createLocalConfig(type, {
        ...options,
        type,
        global: config.global,
        interaction: config.interaction,
        wall: {},
      });
      post({ type: "setType", wallType: type });
      events.emit("typechange", { type });
      return true;
    },

    getType() {
      return type;
    },

    getWallTypes() {
      return Object.keys(wallTypes);
    },

    getConfig() {
      return JSON.parse(JSON.stringify(config));
    },

    async reset() {
      config = await createLocalConfig(options.type || type, options);
      type = options.type || type;
      post({ type: "reset" });
      fullscreen.set(Boolean(config.global.fullscreen));
      canvas.style.opacity = String(Math.max(0, Math.min(1, Number(config.global.opacity ?? 1))));
      canvas.style.zIndex = config.global.zIndex;
      events.emit("typechange", { type });
      events.emit("configchange", { reset: true });
      return true;
    },

    destroy() {
      controls?.destroy();
      fullscreen.set(false);
      worker.terminate();
      canvas.remove();
      window.removeEventListener("resize", sendResize);
      document.removeEventListener("pointermove", sendPointerEvent);
      window.removeEventListener("pointerdown", sendPointerEvent);
      window.removeEventListener("pointerup", sendPointerEvent);
      window.removeEventListener("pointercancel", sendPointerEvent);
      window.removeEventListener("pointerleave", sendPointerEvent);
    },

    on(eventName, callback) {
      return events.on(eventName, callback);
    },

    async getControlSchema() {
      return [
        ...GLOBAL_CONTROLS,
        ...(await getTypeControls(type)),
      ];
    },
  };

  const originalGetControlSchema = api.getControlSchema;
  api.getControlSchema = function getControlSchema() {
    const cached = wallControlCache.get(type);
    if (cached) return [...GLOBAL_CONTROLS, ...cached];

    getTypeControls(type).then(() => events.emit("configchange", { reset: true }));
    return GLOBAL_CONTROLS;
  };

  function sendResize() {
    post({
      type: "resize",
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }

  function sendPointerEvent(event) {
    post({
      type: "pointer",
      event: {
        type: event.type,
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId ?? 1,
        cancelable: event.cancelable,
      },
    });
  }

  window.addEventListener("resize", sendResize);
  document.addEventListener("pointermove", sendPointerEvent, { passive: true });
  window.addEventListener("pointerdown", sendPointerEvent, { passive: false });
  window.addEventListener("pointerup", sendPointerEvent, { passive: true });
  window.addEventListener("pointercancel", sendPointerEvent, { passive: true });
  window.addEventListener("pointerleave", sendPointerEvent, { passive: true });

  if (config.global.showControls) {
    await getTypeControls(type);
    controls = createControls({ manager: api });
  }

  if (config.global.fullscreen) {
    fullscreen.set(true);
  }

  return api;
}

async function initMainThread(options) {
  const [{ GraphicsWallManager }, THREE] = await Promise.all([
    import("./core/GraphicsWallManager.js"),
    loadThree(options),
  ]);

  const {
    baseS3Url,
    baseS3URL,
    baseUrl,
    assetBaseUrl,
    threeUrl,
    workerUrl,
    useWorker,
    ...managerOptions
  } = options;

  const manager = new GraphicsWallManager({
    THREE,
    wallTypes,
    ...managerOptions,
  });

  return manager.init();
}

async function initWorker(options) {
  const wallType = options.type || "grass";
  const canvas = createWallCanvas(options);
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker(getWorkerUrl(options));
  const readyPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Graphics wall worker timed out.")), 6000);

    worker.addEventListener("message", function onMessage(event) {
      if (event.data?.type === "ready") {
        window.clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve();
      } else if (event.data?.type === "error") {
        window.clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        reject(new Error(event.data.message || "Graphics wall worker failed."));
      }
    });
  });

  worker.addEventListener("error", (event) => {
    console.warn("Graphics wall worker error.", event.message || event);
  });

  worker.postMessage({
    type: "init",
    canvas: offscreen,
    options: {
      ...options,
      syncQueryParams: false,
      showControls: false,
      workerMode: true,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      threeUrl: getThreeUrl(options),
      baseS3Url: getAssetBaseUrl(options),
    },
  }, [offscreen]);

  try {
    await readyPromise;
  } catch (error) {
    worker.terminate();
    canvas.remove();
    throw error;
  }

  revealCanvas(canvas, options);
  return createWorkerProxy({ worker, canvas, options, wallType });
}

const GraphicsWall = {
  async init(baseS3UrlOrOptions = {}, maybeOptions = {}) {
    const options = normalizeInitArgs(baseS3UrlOrOptions, maybeOptions);

    if (options.useWorker !== false && supportsOffscreenCanvas()) {
      try {
        return await initWorker(options);
      } catch (error) {
        console.warn("Graphics wall worker failed; falling back to main-thread rendering.", error);
      }
    }

    return initMainThread(options);
  },
};

window.GraphicsWall = GraphicsWall;

export default GraphicsWall;
