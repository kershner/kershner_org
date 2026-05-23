import { GraphicsWallManager } from "./core/GraphicsWallManager.js";

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

const wallTypes = {
  grass: () => import("./walls/grass/index.js").then((m) => m.createGrassWall),
  water: () => import("./walls/water/index.js").then((m) => m.createWaterWall),
  orbs: () => import("./walls/orbs/index.js").then((m) => m.createOrbsWall),
};

const GraphicsWall = {
  async init(baseS3UrlOrOptions = {}, maybeOptions = {}) {
    const options = normalizeInitArgs(baseS3UrlOrOptions, maybeOptions);
    const THREE = await loadThree(options);

    const {
      baseS3Url,
      baseS3URL,
      baseUrl,
      assetBaseUrl,
      threeUrl,
      ...managerOptions
    } = options;

    const manager = new GraphicsWallManager({
      THREE,
      wallTypes,
      ...managerOptions,
    });

    return manager.init();
  },
};

window.GraphicsWall = GraphicsWall;

export default GraphicsWall;
