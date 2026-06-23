const DEFAULT_ASSET_BASE_URL = "/static";
const THREE_PATH = "vendor/three.js/r160/three.min.js";
const DEFAULT_TITLE_URL = "https://github.com/kershner/kershner_org/tree/master/static/js/graphicsWall";
const DEFAULT_SETTINGS_ICON = "☰";


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

function getTitleUrl(options = {}) {
  return options.titleUrl || options.titleURL || window.GRAPHICS_WALL_TITLE_URL || DEFAULT_TITLE_URL;
}

function getSettingsIcon(options = {}) {
  return options.settingsIcon || window.GRAPHICS_WALL_SETTINGS_ICON || DEFAULT_SETTINGS_ICON;
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


const BOOTSTRAP_CONTROLS_CSS = `
  .graphics-wall-bootstrap-controls {
    position: fixed;
    top: 8px;
    right: 12px;
    z-index: 99999;
    max-width: min(23rem, calc(100vw - 24px));
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #fff;
    color-scheme: dark;
    cursor: pointer;
    font: 0.8rem/1rem system-ui, sans-serif;
  }

  .graphics-wall-bootstrap-controls[open] {
    padding: 0 0.9rem 0.9rem;
    border-radius: 1rem;
    background: #202020;
  }

  .graphics-wall-bootstrap-controls summary {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    box-sizing: border-box;
    margin: 0;
    border: 0 !important;
    outline: 0;
    background: transparent !important;
    box-shadow: none !important;
    list-style: none;
    font-size: 2rem;
    line-height: 1;
    text-shadow: 0 1px 2px rgba(0,0,0,0.34);
    appearance: none;
    -webkit-appearance: none;
  }

  .graphics-wall-bootstrap-controls summary::-webkit-details-marker,
  .graphics-wall-bootstrap-controls summary::before,
  .graphics-wall-bootstrap-controls summary::after {
    display: none !important;
    content: none !important;
  }

  .graphics-wall-bootstrap-controls[open] summary {
    width: auto;
    height: auto;
    min-width: 2.65rem;
    min-height: 2.65rem;
    margin: 0 -0.9rem;
    padding: 0.7rem 0.9rem 0.45rem;
    border-radius: 1rem 1rem 0 0;
    background: #202020 !important;
  }

  .graphics-wall-bootstrap-title {
    display: none;
    margin: 0;
    color: #cfcfcf;
    font-size: 1.18rem;
    font-style: italic;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.1;
    text-align: right;
    text-decoration: underline;
    text-underline-offset: 0.18em;
    text-decoration-thickness: 0.08em;
    text-shadow: 0 0 0.9rem rgba(255,255,255,0.24);
  }

  .graphics-wall-bootstrap-controls[open] .graphics-wall-bootstrap-title {
    display: inline-block;
  }

  .graphics-wall-bootstrap-title:hover,
  .graphics-wall-bootstrap-title:focus-visible {
    color: #fff;
  }

  .graphics-wall-bootstrap-controls p {
    margin: 0.6rem 0 0;
  }

  .graphics-wall-bootstrap-controls label {
    display: block;
  }
`;

function ensureBootstrapControlsStyle() {
  const existingStyle = document.getElementById("graphics-wall-bootstrap-controls-style");
  if (existingStyle) return existingStyle;

  const style = document.createElement("style");
  style.id = "graphics-wall-bootstrap-controls-style";
  style.textContent = BOOTSTRAP_CONTROLS_CSS;
  document.head.appendChild(style);
  return style;
}

function createBootstrapControls({ getEnabled, setEnabled, titleUrl, settingsIcon }) {
  ensureBootstrapControlsStyle();

  const panel = document.createElement("details");
  const title = document.createElement("a");
  const label = document.createElement("label");
  const select = document.createElement("select");
  const wrapper = document.createElement("p");

  panel.className = "graphics-wall-bootstrap-controls";

  const summary = document.createElement("summary");
  const icon = document.createElement("span");

  summary.title = "Settings";
  summary.setAttribute("aria-label", "Settings");

  title.className = "graphics-wall-bootstrap-title";
  title.href = titleUrl;
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.textContent = "graphicsWall.js";

  icon.textContent = settingsIcon;

  summary.append(title, icon);
  panel.appendChild(summary);

  [
    { value: "true", label: "Enabled" },
    { value: "false", label: "Disabled" },
  ].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  });

  function syncSelect() {
    select.value = getEnabled() ? "true" : "false";
  }

  label.textContent = "Status: ";
  label.appendChild(select);
  wrapper.appendChild(label);
  panel.appendChild(wrapper);

  ["pointerdown", "pointermove", "pointerup"].forEach((eventName) => {
    panel.addEventListener(eventName, (event) => event.stopPropagation());
  });

  select.addEventListener("change", async () => {
    const enabled = select.value === "true";
    select.disabled = true;

    try {
      await setEnabled(enabled);
      syncSelect();
    } catch (error) {
      console.error(error);
      syncSelect();
    } finally {
      select.disabled = false;
    }
  });

  let appendCancelled = false;

  function appendPanel() {
    if (appendCancelled || panel.isConnected) return;
    document.body?.appendChild(panel);
  }

  syncSelect();

  if (document.body) {
    appendPanel();
  } else {
    document.addEventListener("DOMContentLoaded", appendPanel, { once: true });
  }

  return {
    destroy() {
      appendCancelled = true;
      document.removeEventListener("DOMContentLoaded", appendPanel);
      panel.remove();
    },
    sync: syncSelect,
  };
}

function parseBooleanValue(value) {
  if (value === true || value === false) return value;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "disabled", ""].includes(normalized)) return false;
  return undefined;
}

function getOptionEnabled(options = {}) {
  return parseBooleanValue(options.global?.enabled ?? options.enabled);
}

function getQueryEnabled(search = window.location?.search || "") {
  const params = new URLSearchParams(search || "");
  if (params.has("global.enabled")) return parseBooleanValue(params.get("global.enabled"));
  if (params.has("enabled")) return parseBooleanValue(params.get("enabled"));
  return undefined;
}

function getInitialEnabled(options = {}) {
  const optionEnabled = getOptionEnabled(options);

  if (options.syncQueryParams === false) {
    return optionEnabled === true;
  }

  const queryEnabled = getQueryEnabled();
  if (queryEnabled !== undefined) return queryEnabled;
  return optionEnabled === true;
}

function withEnabledOption(options = {}, enabled) {
  return {
    ...options,
    global: {
      ...(options.global || {}),
      enabled,
    },
  };
}

function normalizeEnabledPath(path) {
  if (path === "enabled" || path === "global.enabled") return "global.enabled";
  return path;
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
      if (path === "global.enabled" || path === "enabled") return false;
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
    getDeviceInfo() {
      return { width: 0, height: 0, devicePixelRatio: 1, isMobile: false };
    },
    setCurrentColor() {
      return false;
    },
    cycleRandomWall() {
      return false;
    },
    randomizeSettings() {
      return false;
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

function createLazyDisabledManager(startOptions = {}) {
  let activeManager = null;
  let activeInitPromise = null;
  let options = withEnabledOption(startOptions, false);
  let bootstrapControls = null;
  const listeners = new Map();

  function emit(eventName, payload) {
    (listeners.get(eventName) || []).forEach((callback) => callback(payload));
  }

  function updateQueryParam(enabled) {
    if (options.syncQueryParams === false || !window.location || !window.history) return;
    const url = new URL(window.location.href);
    url.searchParams.set("global.enabled", enabled ? "true" : "false");
    window.history.replaceState(window.history.state, "", url);
  }


  function removeBootstrapControls() {
    bootstrapControls?.destroy?.();
    bootstrapControls = null;
  }

  function renderBootstrapControls() {
    if (bootstrapControls || activeManager || activeInitPromise) return;
    bootstrapControls = createBootstrapControls({
      getEnabled: () => Boolean(activeManager || activeInitPromise),
      setEnabled: (enabled) => api.set("global.enabled", enabled, { syncQueryParams: true }),
      titleUrl: getTitleUrl(options),
      settingsIcon: getSettingsIcon(options),
    });
  }

  async function enable(enableOptions = {}) {
    if (activeManager) return activeManager;
    if (activeInitPromise) return activeInitPromise;

    options = withEnabledOption(options, true);
    if (enableOptions.syncQueryParams !== false) updateQueryParam(true);
    removeBootstrapControls();

    activeInitPromise = initMainThread({
      ...options,
      onDisabled: disable,
    }).then((manager) => {
      activeManager = manager;
      activeInitPromise = null;

      listeners.forEach((callbacks, eventName) => {
        callbacks.forEach((callback) => activeManager?.on?.(eventName, callback));
      });

      emit("configchange", { path: "global.enabled", value: true });
      return api;
    }).catch((error) => {
      activeInitPromise = null;
      renderBootstrapControls();
      throw error;
    });

    return activeInitPromise;
  }

  function disable() {
    activeManager?.destroy?.();
    activeManager = null;
    activeInitPromise = null;
    options = withEnabledOption(options, false);
    updateQueryParam(false);
    emit("configchange", { path: "global.enabled", value: false });
    renderBootstrapControls();
    return true;
  }

  const api = {
    async set(path, value, setOptions = {}) {
      const normalizedPath = normalizeEnabledPath(path);

      if (normalizedPath === "global.enabled") {
        return parseBooleanValue(value) === true ? enable(setOptions) : disable();
      }

      if (activeManager) return activeManager.set(path, value, setOptions);
      return false;
    },
    get(path) {
      const normalizedPath = normalizeEnabledPath(path);
      if (normalizedPath === "global.enabled") return Boolean(activeManager || activeInitPromise);
      return activeManager?.get?.(path);
    },
    async setType(type, setOptions = {}) {
      if (!activeManager) return false;
      return activeManager.setType(type, setOptions);
    },
    getType() {
      return activeManager?.getType?.() || null;
    },
    getWallTypes() {
      return activeManager?.getWallTypes?.() || Object.keys(wallTypes);
    },
    getConfig() {
      if (activeManager) return activeManager.getConfig();
      return {
        global: {
          enabled: false,
        },
      };
    },
    getDeviceInfo() {
      return activeManager?.getDeviceInfo?.() || { width: 0, height: 0, devicePixelRatio: 1, isMobile: false };
    },
    async setCurrentColor(color) {
      if (!activeManager) return false;
      return activeManager.setCurrentColor(color);
    },
    async cycleRandomWall() {
      if (!activeManager) return false;
      return activeManager.cycleRandomWall();
    },
    async randomizeSettings(randomizeOptions = {}) {
      if (!activeManager) return false;
      return activeManager.randomizeSettings(randomizeOptions);
    },
    async reset(resetOptions = {}) {
      if (!activeManager) return false;
      return activeManager.reset(resetOptions);
    },
    destroy: disable,
    on(eventName, callback) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(callback);
      const activeUnsubscribe = activeManager?.on?.(eventName, callback);

      return () => {
        listeners.get(eventName)?.delete(callback);
        activeUnsubscribe?.();
      };
    },
    skipped: false,
    disabled: true,
  };

  renderBootstrapControls();
  return api;
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
    titleUrl,
    titleURL,
    settingsIcon,
    forceGraphicsWall,
    forceWebGL,
    forceNoWebGL,
    detectHardwareAcceleration,
    enabled,
    ...managerOptions
  } = options;

  const manager = new GraphicsWallManager({
    THREE,
    wallTypes,
    titleUrl: getTitleUrl(options),
    settingsIcon: getSettingsIcon(options),
    ...managerOptions,
  });

  return manager.init();
}

const GraphicsWall = {
  async init(baseS3UrlOrOptions = {}, maybeOptions = {}) {
    const options = normalizeInitArgs(baseS3UrlOrOptions, maybeOptions);
    const manager = createLazyDisabledManager(options);

    if (getInitialEnabled(options)) {
      await manager.set("global.enabled", true, { syncQueryParams: false });
    }

    return manager;
  },
};

window.GraphicsWall = GraphicsWall;

export default GraphicsWall;
