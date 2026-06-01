import { DEFAULT_CONFIG, GLOBAL_CONTROLS, resolveTopLevelPath } from "./configSchema.js";
import { createPointerState } from "./pointerState.js";
import { createEventBus, getPath, mergeDeep, normalizeInitOptions, setPath } from "./utils.js";

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
    this.lastTime = 0;
    this.viewport = {
      width: options.width || (typeof window !== "undefined" ? window.innerWidth : 1),
      height: options.height || (typeof window !== "undefined" ? window.innerHeight : 1),
      devicePixelRatio: options.devicePixelRatio || (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
    };
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

    const isMobile = this.viewport.width < 768;

    this.renderer = new this.THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(Math.min(this.viewport.devicePixelRatio || 1, isMobile ? 1 : 1.5));

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

    if (this.activeWall && wallFactory.loadControls) {
      this.activeWall.controls = await wallFactory.loadControls();
    }

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

  // Merges core defaults, wall defaults, and user options into one config.
  createConfig(type, options, wallFactory) {
    if (!wallFactory) {
      throw new Error(`GraphicsWall: unknown wall type "${type}".`);
    }

    const wallDefaults = typeof wallFactory.defaults === "function"
      ? wallFactory.defaults(this.viewport)
      : wallFactory.defaults || {};

    return mergeDeep(
      mergeDeep(DEFAULT_CONFIG, wallDefaults),
      {
        global: options.global,
        interaction: options.interaction,
        wall: options.wall,
      }
    );
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
    this.renderer?.setPixelRatio(Math.min(this.viewport.devicePixelRatio, (width || this.viewport.width) < 768 ? 1 : 1.5));
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
    this.canvas.style.opacity = String(Math.max(0, Math.min(1, Number(this.config.global.opacity ?? 1))));
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

    this.activeWall?.set?.(path, value);

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
    if (this.activeWall && factory.loadControls) {
      this.activeWall.controls = await factory.loadControls();
    }
  }

  // Re-applies global DOM-level settings after reset/rebuild.
  applyGlobalConfig() {
    this.fullscreen?.set(Boolean(this.config.global.fullscreen));
    this.applyCanvasOpacity();
    this.canvas.style.zIndex = this.config.global.zIndex;
  }

  // Switches to another wall type.
  async setType(type, options = {}) {
    if (type === this.type) {
      return true;
    }

    let wallFactory = null;

    try {
      wallFactory = await this.getWallFactory(type);
    } catch (error) {
      console.warn(error.message);
      return false;
    }

    await this.rebuildWall(type, {
      type,
      global: this.config.global,
      interaction: this.config.interaction,
      wall: {},
    }, wallFactory);

    if (this.syncQueryParams && options.syncQueryParams === true) {
      this.queryParams?.updateGraphicsWallQueryParam("type", type, {
        remove: this.baseOptions.type === type,
      });
    }

    this.events.emit("typechange", { type });
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

  // Combines shared controls with wall-specific controls.
  getControlSchema() {
    return [
      ...GLOBAL_CONTROLS,
      ...(this.activeWall?.controls || []),
    ];
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
      reset: this.reset.bind(this),
      destroy: this.destroy.bind(this),
      on: this.on.bind(this),
    };
  }
}
