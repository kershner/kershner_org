import { createPointerState } from "./pointerState.js";
import { createEventBus, getPath, mergeDeep, normalizeInitOptions, setPath } from "./utils.js";

const DEFAULT_CONFIG = {
  global: {
    zIndex: -1,
    showControls: true,
    fullscreen: false,
    opacity: 1,
    fadeInDuration: 600,
    rotateColors: true,
    colorTransitionSpeed: 0.007,
  },
  interaction: {
    cursorRadius: 0.32,
    cursorStrength: 0.13,
    verticalPush: 0,
    pointerSmoothing: 0.3,
    touchBoost: 2,
    brushStrength: 0.09,
    wakeStrength: 0.34,
    wakeLag: 0.132,
    pulseStrength: 1.18,
    pulseRadius: 2.15,
    pulseDecay: 0.988,
    velocityStrength: 13.2,
  },
  wall: {},
};


const GLOBAL_PATHS = new Set(["fullscreen", "opacity", "zIndex", "showControls", "fadeInDuration", "rotateColors", "colorTransitionSpeed"]);
const INTERACTION_PATHS = new Set([
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

function resolveTopLevelPath(key) {
  if (GLOBAL_PATHS.has(key)) return `global.${key}`;
  if (INTERACTION_PATHS.has(key)) return `interaction.${key}`;
  return null;
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
      { type: "range", path: "interaction.pulseStrength", label: "Click pulse", min: 0, max: 2, step: 0.01, help: "Controls click-generated ripples.", walls: ["grass", "water", "fabric"] },
      { type: "range", path: "interaction.pulseRadius", label: "Pulse radius", min: 0.15, max: 3, step: 0.01, help: "Controls the starting size of click pulses.", walls: ["grass", "water", "fabric"] },
      { type: "range", path: "interaction.pulseDecay", label: "Pulse decay", min: 0.85, max: 0.995, step: 0.001, help: "Higher values make click pulses linger.", walls: ["grass", "water", "fabric"] },
    ],
  },
];

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
    this.workerMode = Boolean(options.workerMode);
    this.externalCanvas = options.canvas || null;
    this.viewport = {
      width: options.width || (typeof window !== "undefined" ? window.innerWidth : 1),
      height: options.height || (typeof window !== "undefined" ? window.innerHeight : 1),
      devicePixelRatio: options.devicePixelRatio || (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
    };
  }

  async init() {
    if (!this.THREE) {
      console.error("GraphicsWall: THREE could not be loaded.");
      return null;
    }

    if (this.syncQueryParams && !this.workerMode) {
      this.queryParams = await import("./queryParams.js");
      this.options = normalizeInitOptions(mergeDeep(this.baseOptions, this.queryParams.readGraphicsWallQueryParams()));
    }

    this.type = this.options.type;
    const wallFactory = await this.getWallFactory(this.type);
    this.baseConfig = this.createConfig(this.type, this.baseOptions, wallFactory);
    this.config = this.createConfig(this.type, this.options, wallFactory);
    this.canvas = this.externalCanvas || document.createElement("canvas");

    if (!this.workerMode) {
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
    }

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
    if (!this.workerMode) {
      this.pointer.attach();
    }

    this.sharedUniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uOpacity: { value: this.config.global.opacity },
      ...this.pointer.uniforms,
    };

    await this.createActiveWall(wallFactory);

    if (!this.workerMode && this.activeWall && wallFactory.loadControls) {
      this.activeWall.controls = await wallFactory.loadControls();
    }

    if (!this.workerMode && this.config.global.showControls) {
      const { createControls } = await import("./controls.js");
      this.controls = createControls({ manager: this });
    }

    if (!this.workerMode) {
      const { createFullscreenController } = await import("./fullscreen.js");
      this.fullscreen = createFullscreenController({
        canvas: this.canvas,
        getControlsElement: () => this.controls?.getElement(),
      });

      if (this.config.global.fullscreen) {
        this.fullscreen.set(true);
      }
    }

    this.resize = this.resize.bind(this);
    this.animate = this.animate.bind(this);

    if (!this.workerMode) {
      window.addEventListener("resize", this.resize);
    }
    this.resize();
    this.renderInitialFrame();
    this.warmupInitialFrames();
    this.reveal();
    this.animationFrame = requestAnimationFrame(this.animate);

    return this.createPublicApi();
  }

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

  createConfig(type, options, wallFactory) {
    if (!wallFactory) {
      throw new Error(`GraphicsWall: unknown wall type "${type}".`);
    }

    return mergeDeep(
      mergeDeep(DEFAULT_CONFIG, wallFactory.defaults || {}),
      {
        global: options.global,
        interaction: options.interaction,
        wall: options.wall,
      }
    );
  }

  async createActiveWall(wallFactory = null) {
    const factory = wallFactory || await this.getWallFactory(this.type);

    this.activeWall = factory({
      THREE: this.THREE,
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      sharedUniforms: this.sharedUniforms,
      config: this.config,
    });
  }

  resize() {
    const width = this.workerMode ? this.viewport.width : window.innerWidth;
    const height = this.workerMode ? this.viewport.height : window.innerHeight;

    this.renderer.setSize(width, height, false);
    this.sharedUniforms.uAspect.value = width / height;
  }

  setSize(width, height, devicePixelRatio = this.viewport.devicePixelRatio) {
    this.viewport.width = Math.max(1, width || 1);
    this.viewport.height = Math.max(1, height || 1);
    this.viewport.devicePixelRatio = devicePixelRatio || 1;
    this.pointer?.setViewport?.(this.viewport.width, this.viewport.height);
    this.renderer?.setPixelRatio(Math.min(this.viewport.devicePixelRatio, this.viewport.width < 768 ? 1 : 1.5));
    this.resize();
    this.activeWall?.resize?.({ width: this.viewport.width, height: this.viewport.height });
  }

  handlePointerEvent(event) {
    this.pointer?.handlePointerEvent?.(event);
  }

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

  applyCanvasOpacity() {
    if (!this.canvas || this.workerMode) return;
    this.canvas.style.opacity = String(Math.max(0, Math.min(1, Number(this.config.global.opacity ?? 1))));
  }

  reveal() {
    if (this.workerMode) return;

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

    if (path === "global.zIndex" && !this.workerMode) {
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

  get(path) {
    if (!path.includes(".")) {
      const resolvedPath = resolveTopLevelPath(path) || this.activeWall?.resolvePath?.(path);
      if (resolvedPath) return getPath(this.config, resolvedPath);
    }

    return getPath(this.config, path);
  }

  async rebuildWall(type, options, wallFactory = null) {
    const factory = wallFactory || await this.getWallFactory(type);

    this.activeWall?.destroy();
    this.type = type;
    this.baseConfig = this.createConfig(type, { ...this.baseOptions, type }, factory);
    this.config = this.createConfig(type, options, factory);
    await this.createActiveWall(factory);
    if (!this.workerMode && this.activeWall && factory.loadControls) {
      this.activeWall.controls = await factory.loadControls();
    }
  }

  applyGlobalConfig() {
    this.fullscreen?.set(Boolean(this.config.global.fullscreen));
    this.applyCanvasOpacity();
    if (!this.workerMode) {
      this.canvas.style.zIndex = this.config.global.zIndex;
    }
  }

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

  getType() {
    return this.type;
  }

  getWallTypes() {
    return Object.keys(this.wallTypes);
  }

  getControlSchema() {
    return [
      ...GLOBAL_CONTROLS,
      ...(this.activeWall?.controls || []),
    ];
  }

  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  on(eventName, callback) {
    return this.events.on(eventName, callback);
  }

  destroy() {
    this.fullscreen?.set(false);
    cancelAnimationFrame(this.animationFrame);
    if (!this.workerMode) {
      window.removeEventListener("resize", this.resize);
    }
    this.pointer?.detach();
    this.controls?.destroy();
    this.activeWall?.destroy();
    this.renderer?.dispose();
    if (!this.workerMode) {
      this.canvas?.remove();
    }
  }

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
