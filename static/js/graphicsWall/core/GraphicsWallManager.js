import { DEFAULT_CONFIG, GLOBAL_CONTROLS, resolveTopLevelPath } from "./configSchema.js";
import { createViewport, getDeviceInfo, getRendererPixelRatio } from "./device.js";
import { createPointerState } from "./pointerState.js";
import { clamp, createEventBus, getPath, mergeDeep, normalizeInitOptions, rand, setPath } from "./utils.js";


function getRandomArrayItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const output = [...items];

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output;
}

function getStepDecimals(step) {
  const text = String(step || 1);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

function randomRangeValue(control) {
  const min = Number(control.min ?? 0);
  const max = Number(control.max ?? 1);
  const step = Number(control.step || 0);

  if (!step) {
    return rand(min, max);
  }

  const steps = Math.max(0, Math.round((max - min) / step));
  const value = min + Math.floor(Math.random() * (steps + 1)) * step;
  return Number(value.toFixed(getStepDecimals(step)));
}

function randomColorValue() {
  return `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0")}`;
}

function randomControlValue(control) {
  if (control.type === "range") return randomRangeValue(control);
  if (control.type === "color") return randomColorValue();
  if (control.type === "checkbox") return Math.random() >= 0.5;

  if (control.type === "select") {
    const options = control.options || [];
    const option = getRandomArrayItem(options);
    return typeof option === "string" ? option : option?.value;
  }

  return undefined;
}

function isControlVisibleForType(control, type) {
  if (Array.isArray(control.walls) && !control.walls.includes(type)) return false;
  if (Array.isArray(control.hideForWalls) && control.hideForWalls.includes(type)) return false;
  return true;
}

const PRIMARY_COLOR_KEYS = {
  grass: ["grassColor"],
  water: ["shallowColor", "deepColor"],
  fabric: ["baseColor"],
  orbs: ["backgroundColor"],
};

export class GraphicsWallManager {
  constructor({ THREE, wallTypes, ...options }) {
    this.THREE = THREE;
    this.wallTypes = wallTypes;
    this.syncQueryParams = options.syncQueryParams !== false;
    this.baseOptions = normalizeInitOptions(options);
    this.options = this.baseOptions;
    this.queryParams = null;
    this.events = createEventBus();
    this.activeWall = null;
    this.wallFactoryCache = {};
    this.controls = null;
    this.animationFrame = null;
    this.wallCycleTimer = null;
    this.lastTime = 0;
    this.viewport = createViewport(options);
  }

  // Boots the renderer, active wall, controls, and animation loop.
  async init() {
    if (!this.THREE) {
      console.error("GraphicsWall: THREE could not be loaded.");
      return null;
    }

    if (this.syncQueryParams) {
      this.queryParams = await import("./queryParams.js");
      this.options = normalizeInitOptions(mergeDeep(this.baseOptions, this.queryParams.readGraphicsWallQueryParams()));
    }

    this.type = this.options.type;
    const wallFactory = await this.getWallFactory(this.type);
    this.baseConfig = this.createConfig(this.type, this.baseOptions, wallFactory);
    this.config = this.createConfig(this.type, this.options, wallFactory);
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: this.config.global.zIndex,
      opacity: "0",
      transition: `opacity ${this.config.global.fadeInDuration}ms ease`,
      willChange: "opacity",
    });

    document.body.prepend(this.canvas);

    this.renderer = new this.THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(getRendererPixelRatio(this.viewport));

    this.scene = new this.THREE.Scene();
    this.camera = new this.THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.pointer = createPointerState({ THREE: this.THREE, viewport: this.viewport });
    this.pointer.attach();

    this.sharedUniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uOpacity: { value: this.config.global.opacity },
      ...this.pointer.uniforms,
    };

    await this.createActiveWall(wallFactory);
    await this.loadActiveWallControls(wallFactory);

    if (this.config.global.showControls) {
      const { createControls } = await import("./controls.js");
      this.controls = createControls({ manager: this });
    }

    const { createFullscreenController } = await import("./fullscreen.js");
    this.fullscreen = createFullscreenController({
      canvas: this.canvas,
      getControlsElement: () => this.controls?.getElement(),
    });

    if (this.config.global.fullscreen) {
      this.fullscreen.set(true);
    }

    this.resize = this.resize.bind(this);
    this.handleWindowResize = () => this.resize(window.innerWidth, window.innerHeight);
    this.animate = this.animate.bind(this);

    window.addEventListener("resize", this.handleWindowResize);
    this.resize(this.viewport.width, this.viewport.height);
    this.renderInitialFrame();
    this.warmupInitialFrames();
    this.reveal();
    this.updateWallCycleTimer();
    this.animationFrame = requestAnimationFrame(this.animate);

    return this.createPublicApi();
  }

  // Loads and caches a wall factory by type.
  async getWallFactory(type) {
    if (this.wallFactoryCache[type]) {
      return this.wallFactoryCache[type];
    }

    const loader = this.wallTypes[type];

    if (!loader) {
      throw new Error(`GraphicsWall: unknown wall type "${type}".`);
    }

    const wallFactory = await loader();

    if (typeof wallFactory !== "function") {
      throw new Error(`GraphicsWall: wall type "${type}" did not load a valid factory.`);
    }

    this.wallFactoryCache[type] = wallFactory;
    return wallFactory;
  }

  // Returns current viewport/device flags used by responsive wall defaults.
  getDeviceInfo() {
    return getDeviceInfo(this.viewport);
  }

  // Returns the wall color keys controlled by the shared current color.
  getPrimaryColorKeys(type = this.type) {
    return PRIMARY_COLOR_KEYS[type] || [];
  }

  // Applies the shared current color to the active wall's primary colors.
  applyCurrentColorToConfig(type, config) {
    const currentColor = config.global.currentColor;
    if (!currentColor) return config;

    this.getPrimaryColorKeys(type).forEach((key) => {
      config.wall[key] = currentColor;
    });

    return config;
  }

  // Merges core defaults, wall defaults, and user options into one config.
  createConfig(type, options, wallFactory) {
    if (!wallFactory) {
      throw new Error(`GraphicsWall: unknown wall type "${type}".`);
    }

    const wallDefaults = typeof wallFactory.defaults === "function"
      ? wallFactory.defaults(this.getDeviceInfo())
      : wallFactory.defaults || {};

    const config = mergeDeep(
      mergeDeep(DEFAULT_CONFIG, wallDefaults),
      {
        global: options.global,
        interaction: options.interaction,
        wall: options.wall,
      }
    );

    return this.applyCurrentColorToConfig(type, config);
  }

  // Instantiates the current wall implementation.
  async createActiveWall(wallFactory = null) {
    const factory = wallFactory || await this.getWallFactory(this.type);

    this.activeWall = factory({
      THREE: this.THREE,
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      sharedUniforms: this.sharedUniforms,
      viewport: this.viewport,
      config: this.config,
    });

    this.syncActiveWallCurrentColor();
  }

  // Loads optional controls for the current wall.
  async loadActiveWallControls(wallFactory) {
    if (this.activeWall && wallFactory?.loadControls) {
      this.activeWall.controls = await wallFactory.loadControls();
    }
  }

  // Applies the viewport size to the renderer and active wall.
  resize(width = this.viewport.width, height = this.viewport.height) {
    this.viewport.width = Math.max(1, width || 1);
    this.viewport.height = Math.max(1, height || 1);
    this.renderer.setSize(this.viewport.width, this.viewport.height, false);
    this.sharedUniforms.uAspect.value = this.viewport.width / this.viewport.height;
    this.pointer?.setViewport?.(this.viewport.width, this.viewport.height);
    this.activeWall?.resize?.({ width: this.viewport.width, height: this.viewport.height });
  }

  // Updates the managed viewport size for embedded/non-window usage.
  setSize(width, height, devicePixelRatio = this.viewport.devicePixelRatio) {
    this.viewport.devicePixelRatio = devicePixelRatio || 1;
    this.renderer?.setPixelRatio(getRendererPixelRatio({ ...this.viewport, width: width || this.viewport.width }));
    this.resize(width, height);
  }

  // Allows external callers to feed pointer events manually.
  handlePointerEvent(event) {
    this.pointer?.handlePointerEvent?.(event);
  }

  // Draws a first frame before the animation loop begins.
  renderInitialFrame() {
    this.sharedUniforms.uTime.value = 0;
    this.sharedUniforms.uOpacity.value = this.config.global.opacity;
    this.activeWall?.update({
      time: 0,
      delta: 0,
      config: this.config,
    });
    this.renderer.render(this.scene, this.camera);
  }

  // Advances simulations a few frames before reveal to reduce cold-start artifacts.
  warmupInitialFrames() {
    const frames = Math.max(0, Math.min(12, Number(this.activeWall?.initialWarmupFrames || 0)));
    if (!frames) return;

    for (let i = 0; i < frames; i += 1) {
      const elapsed = (i + 1) * (1000 / 60);
      this.sharedUniforms.uTime.value = elapsed * 0.001;
      this.sharedUniforms.uOpacity.value = this.config.global.opacity;
      this.pointer.update(this.config.interaction);
      this.activeWall?.update({
        time: elapsed,
        delta: 1 / 60,
        config: this.config,
      });
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Applies global opacity to the canvas element.
  applyCanvasOpacity() {
    if (!this.canvas) return;
    this.canvas.style.opacity = String(clamp(Number(this.config.global.opacity ?? 1), 0, 1));
  }

  // Waits for a small timed transition without blocking rendering.
  wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms || 0)));
  }

  // Fades the wall canvas to the target opacity.
  async fadeCanvasTo(opacity, duration) {
    if (!this.canvas) return;

    this.canvas.style.willChange = "opacity";
    this.canvas.style.transition = `opacity ${Math.max(0, duration || 0)}ms ease`;
    this.canvas.style.opacity = String(clamp(opacity, 0, 1));
    await this.wait(duration);
  }

  // Reapplies the current global color to a freshly created wall.
  syncActiveWallCurrentColor() {
    const currentColor = this.config?.global?.currentColor;
    if (!currentColor) return;

    this.applyCurrentColorToConfig(this.type, this.config);
    this.activeWall?.set?.("global.currentColor", currentColor);
  }

  // Fades the canvas in after initial rendering.
  reveal() {
    this.canvas.style.opacity = "0";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.applyCanvasOpacity();

        window.setTimeout(() => {
          this.canvas.style.willChange = "auto";
        }, this.config.global.fadeInDuration);
      });
    });
  }

  // Runs one animation frame and schedules the next.
  animate(time) {
    const delta = this.lastTime ? Math.min((time - this.lastTime) * 0.001, 0.1) : 0;
    this.lastTime = time;

    this.sharedUniforms.uTime.value = time * 0.001;
    this.sharedUniforms.uOpacity.value = this.config.global.opacity;
    this.pointer.update(this.config.interaction);

    this.activeWall?.update({
      time,
      delta,
      config: this.config,
    });

    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  // Updates one config value and forwards it to the active wall.
  set(path, value, options = {}) {
    if (path === "type") {
      return this.setType(value, options);
    }

    if (!path.includes(".")) {
      path = resolveTopLevelPath(path) || this.activeWall?.resolvePath?.(path) || `wall.${path}`;
    }

    const previousValue = getPath(this.config, path);
    setPath(this.config, path, value);

    if (path === "global.fullscreen") {
      this.fullscreen?.set(Boolean(value));
    }

    if (path === "global.opacity") {
      this.applyCanvasOpacity();
    }

    if (path === "global.zIndex") {
      this.canvas.style.zIndex = value;
    }

    if (path === "global.cycleWalls" || path === "global.wallCycleInterval") {
      this.updateWallCycleTimer();
    }

    if (path === "global.currentColor") {
      this.applyCurrentColorToConfig(this.type, this.config);
    }

    this.activeWall?.set?.(path, value);

    if (path === "global.currentColor") {
      this.getPrimaryColorKeys(this.type).forEach((key) => {
        this.activeWall?.set?.(`wall.${key}`, value);
      });
    }

    if (this.syncQueryParams && options.syncQueryParams === true && previousValue !== value) {
      this.queryParams?.updateGraphicsWallQueryParam(path, value, {
        remove: getPath(this.baseConfig, path) === value,
      });
    }

    this.events.emit("configchange", { path, value });
    return true;
  }

  // Reads one config value using shorthand or full paths.
  get(path) {
    if (!path.includes(".")) {
      const resolvedPath = resolveTopLevelPath(path) || this.activeWall?.resolvePath?.(path);
      if (resolvedPath) return getPath(this.config, resolvedPath);
    }

    return getPath(this.config, path);
  }

  // Replaces the active wall while preserving shared renderer state.
  async rebuildWall(type, options, wallFactory = null) {
    const factory = wallFactory || await this.getWallFactory(type);

    this.activeWall?.destroy();
    this.type = type;
    this.baseConfig = this.createConfig(type, { ...this.baseOptions, type }, factory);
    this.config = this.createConfig(type, options, factory);
    await this.createActiveWall(factory);
    await this.loadActiveWallControls(factory);
  }

  // Re-applies global DOM-level settings after reset/rebuild.
  applyGlobalConfig() {
    this.fullscreen?.set(Boolean(this.config.global.fullscreen));
    this.applyCanvasOpacity();
    this.canvas.style.zIndex = this.config.global.zIndex;
    this.updateWallCycleTimer();
  }

  // Switches to another wall type.
  async setType(type, options = {}) {
    if (type === this.type && options.force !== true) {
      return true;
    }

    let wallFactory = null;

    try {
      wallFactory = await this.getWallFactory(type);
    } catch (error) {
      console.warn(error.message);
      return false;
    }

    const shouldFade = options.fade !== false && Boolean(this.canvas);
    const fadeInDuration = Math.max(0, Number(this.config.global.fadeInDuration) || 0);
    const fadeOutDuration = Math.min(2000, Math.max(600, fadeInDuration * 0.5));

    if (shouldFade) {
      await this.fadeCanvasTo(0, fadeOutDuration);
    }

    await this.rebuildWall(type, {
      type,
      global: this.config.global,
      interaction: this.config.interaction,
      wall: {},
    }, wallFactory);

    this.renderInitialFrame();

    if (shouldFade) {
      await this.fadeCanvasTo(clamp(Number(this.config.global.opacity ?? 1), 0, 1), fadeInDuration);
      this.canvas.style.willChange = "auto";
    }

    if (this.syncQueryParams && options.syncQueryParams === true) {
      this.queryParams?.updateGraphicsWallQueryParam("type", type, {
        remove: this.baseOptions.type === type,
      });
    }

    this.events.emit("typechange", { type });
    return true;
  }

  // Randomly selects one registered wall type and skips if it matches the current wall.
  async cycleRandomWall() {
    const types = this.getWallTypes();
    if (!types.length) return false;

    const nextType = types[Math.floor(Math.random() * types.length)];
    if (nextType === this.type) return true;

    return this.setType(nextType);
  }

  // Starts or stops automatic random wall cycling.
  updateWallCycleTimer() {
    if (this.wallCycleTimer) {
      window.clearTimeout(this.wallCycleTimer);
      this.wallCycleTimer = null;
    }

    if (!this.config?.global?.cycleWalls) return;

    const interval = Math.max(1000, Number(this.config.global.wallCycleInterval) || 8000);
    this.wallCycleTimer = window.setTimeout(async () => {
      await this.cycleRandomWall();
      this.updateWallCycleTimer();
    }, interval);
  }

  getRandomizableControls(type = this.type) {
    const seenPaths = new Set();

    return this.getControlSchema()
      .filter((group) => group.randomize !== false)
      .flatMap((group) => group.controls)
      .filter((control) => control.randomize !== false)
      .filter((control) => control.path && isControlVisibleForType(control, type))
      .filter((control) => ["range", "color", "checkbox", "select"].includes(control.type))
      .filter((control) => {
        if (seenPaths.has(control.path)) return false;
        seenPaths.add(control.path);
        return true;
      });
  }

  async randomizeSettings(options = {}) {
    const types = this.getWallTypes();
    const shouldChangeType = false;

    if (shouldChangeType) {
      const nextTypes = types.filter((type) => type !== this.type);
      await this.setType(getRandomArrayItem(nextTypes), {
        fade: options.fade,
        syncQueryParams: options.syncQueryParams,
      });

      if (this.syncQueryParams && options.syncQueryParams === true) {
        this.queryParams?.clearGraphicsWallQueryParamsByPrefix?.("wall.");
      }
    }

    const controls = this.getRandomizableControls(this.type);
    if (!controls.length) return false;

    const randomizeAll = Math.random() < 0.45;
    const handfulSize = Math.min(controls.length, Math.max(3, Math.floor(rand(3, 9))));
    const selectedControls = randomizeAll ? controls : shuffle(controls).slice(0, handfulSize);

    selectedControls.forEach((control) => {
      const value = randomControlValue(control);
      if (value !== undefined) {
        this.set(control.path, value, { syncQueryParams: options.syncQueryParams });
      }
    });

    this.renderInitialFrame();
    this.events.emit("configchange", { randomize: true });
    return true;
  }

  // Restores the original type and config.
  async reset(options = {}) {
    const type = this.baseOptions.type;

    try {
      await this.rebuildWall(type, this.baseOptions);
    } catch (error) {
      console.warn(error.message);
      return false;
    }

    this.applyGlobalConfig();
    this.renderInitialFrame();

    if (this.syncQueryParams && options.syncQueryParams === true) {
      this.queryParams?.clearGraphicsWallQueryParams();
    }

    this.events.emit("typechange", { type });
    this.events.emit("configchange", { reset: true });
    return true;
  }

  // Returns the active wall type.
  getType() {
    return this.type;
  }

  // Returns every registered wall type.
  getWallTypes() {
    return Object.keys(this.wallTypes);
  }

  // Combines shared and wall-specific color controls into one Color section.
  getControlSchema() {
    const schema = GLOBAL_CONTROLS.map((group) => ({
      ...group,
      controls: [...group.controls],
    }));
    const colorGroup = schema.find((group) => group.title === "Color");

    (this.activeWall?.controls || []).forEach((group) => {
      if (group.title === "Color") {
        colorGroup?.controls.push(...group.controls);
        return;
      }

      schema.push(group);
    });

    return schema;
  }

  // Returns a safe copy of the current config.
  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  // Subscribes to manager events.
  on(eventName, callback) {
    return this.events.on(eventName, callback);
  }

  // Tears down rendering, controls, pointer handlers, and the active wall.
  destroy() {
    this.fullscreen?.set(false);
    cancelAnimationFrame(this.animationFrame);
    if (this.wallCycleTimer) window.clearTimeout(this.wallCycleTimer);
    window.removeEventListener("resize", this.handleWindowResize);
    this.pointer?.detach();
    this.controls?.destroy();
    this.activeWall?.destroy();
    this.renderer?.dispose();
    this.canvas?.remove();
  }

  // Exposes the supported public manager API.
  createPublicApi() {
    return {
      set: this.set.bind(this),
      get: this.get.bind(this),
      setType: this.setType.bind(this),
      getType: this.getType.bind(this),
      getWallTypes: this.getWallTypes.bind(this),
      getConfig: this.getConfig.bind(this),
      getDeviceInfo: this.getDeviceInfo.bind(this),
      setCurrentColor: (color) => this.set("global.currentColor", color),
      cycleRandomWall: this.cycleRandomWall.bind(this),
      randomizeSettings: this.randomizeSettings.bind(this),
      reset: this.reset.bind(this),
      destroy: this.destroy.bind(this),
      on: this.on.bind(this),
    };
  }
}
