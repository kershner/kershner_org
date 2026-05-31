const DEFAULT_ASSET_BASE_URL = "/static";
const THREE_PATH = "vendor/three.js/r160/three.min.js";

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

function shouldSkipGraphicsWall(options = {}) {
  if (options.forceNoWebGL === true) return true;
  if (options.forceGraphicsWall === true || options.forceWebGL === true) return false;
  if (options.detectHardwareAcceleration === false) return false;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
    canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
    canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: true });

  if (!context) return true;

  const debugInfo = context.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : context.getParameter(context.RENDERER);

  const rendererName = String(renderer || "").toLowerCase();
  const isSoftwareRenderer = /swiftshader|llvmpipe|software|mesa offscreen|microsoft basic render|warp/.test(rendererName);
  const loseContext = context.getExtension("WEBGL_lose_context");
  loseContext?.loseContext?.();

  return isSoftwareRenderer;
}

function createSkippedManager(reason = "unsupported-webgl") {
  return {
    set() {
      return false;
    },
    get(path) {
      if (path === "type") return null;
      if (path === "global.rotateColors" || path === "rotateColors") return false;
      return undefined;
    },
    setType() {
      return false;
    },
    getType() {
      return null;
    },
    getWallTypes() {
      return [];
    },
    getConfig() {
      return {
        skipped: true,
        reason,
      };
    },
    reset() {
      return false;
    },
    destroy() {},
    on() {
      return () => {};
    },
    skipped: true,
    reason,
  };
}

const wallTypes = {
  grass: () => import("./walls/grass/index.js").then((m) => m.createGrassWall),
  water: () => import("./walls/water/index.js").then((m) => m.createWaterWall),
  orbs: () => import("./walls/orbs/index.js").then((m) => m.createOrbsWall),
  fabric: () => import("./walls/fabric/index.js").then((m) => m.createFabricWall),
};

async function initMainThread(options) {
  if (shouldSkipGraphicsWall(options)) {
    return createSkippedManager("software-or-unsupported-webgl");
  }

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
    forceGraphicsWall,
    forceWebGL,
    forceNoWebGL,
    detectHardwareAcceleration,
    ...managerOptions
  } = options;

  const manager = new GraphicsWallManager({
    THREE,
    wallTypes,
    ...managerOptions,
  });

  return manager.init();
}

const GraphicsWall = {
  async init(baseS3UrlOrOptions = {}, maybeOptions = {}) {
    return initMainThread(normalizeInitArgs(baseS3UrlOrOptions, maybeOptions));
  },
};

window.GraphicsWall = GraphicsWall;

export default GraphicsWall;
