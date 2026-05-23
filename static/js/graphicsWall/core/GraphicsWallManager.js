import { createControls } from "./controls.js";
import { createFullscreenController } from "./fullscreen.js";
import { createPointerState } from "./pointerState.js";
import { createEventBus, getPath, mergeDeep, normalizeInitOptions, setPath } from "./utils.js";

const DEFAULT_CONFIG = {
  global: {
    zIndex: -1,
    showControls: true,
    fullscreen: false,
    opacity: 1,
    fadeInDuration: 600,
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

const GLOBAL_CONTROLS = [
  {
    title: "General",
    controls: [
      { type: "checkbox", path: "global.fullscreen", label: "Fullscreen", help: "Hide page content behind the wall." },
      { type: "range", path: "global.opacity", label: "Opacity", min: 0, max: 1, step: 0.01, help: "Overall transparency." },
    ],
  },
  {
    title: "Interaction",
    controls: [
      { type: "range", path: "interaction.cursorRadius", label: "Cursor radius", min: 0.05, max: 1.2, step: 0.01 },
      { type: "range", path: "interaction.cursorStrength", label: "Cursor force", min: 0, max: 0.7, step: 0.01 },
      { type: "range", path: "interaction.verticalPush", label: "Vertical push", min: 0, max: 0.2, step: 0.001 },
      { type: "range", path: "interaction.pointerSmoothing", label: "Pointer smooth", min: 0.01, max: 0.3, step: 0.001 },
      { type: "range", path: "interaction.touchBoost", label: "Touch boost", min: 0, max: 2, step: 0.01 },
      { type: "range", path: "interaction.brushStrength", label: "Brush force", min: 0, max: 0.6, step: 0.01 },
      { type: "range", path: "interaction.velocityStrength", label: "Velocity sensitivity", min: 1, max: 40, step: 0.1 },
      { type: "range", path: "interaction.pulseStrength", label: "Click pulse", min: 0, max: 0.7, step: 0.01 },
      { type: "range", path: "interaction.pulseRadius", label: "Pulse radius", min: 0.15, max: 2, step: 0.01 },
      { type: "range", path: "interaction.pulseDecay", label: "Pulse decay", min: 0.85, max: 0.99, step: 0.001 },
    ],
  },
];

export class GraphicsWallManager {
  constructor({ THREE, wallTypes, ...options }) {
    this.THREE = THREE;
    this.wallTypes = wallTypes;
    this.options = normalizeInitOptions(options);
    this.events = createEventBus();
    this.activeWall = null;
    this.wallFactoryCache = {};
    this.controls = null;
    this.animationFrame = null;
    this.lastTime = 0;
  }

  async init() {
    if (!this.THREE) {
      console.error("GraphicsWall: THREE could not be loaded.");
      return null;
    }

    this.type = this.options.type;
    const wallFactory = await this.getWallFactory(this.type);
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

    const isMobile = window.innerWidth < 768;

    this.renderer = new this.THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5));

    this.scene = new this.THREE.Scene();
    this.camera = new this.THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.pointer = createPointerState({ THREE: this.THREE });
    this.pointer.attach();

    this.sharedUniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uOpacity: { value: this.config.global.opacity },
      ...this.pointer.uniforms,
    };

    await this.createActiveWall(wallFactory);

    if (this.config.global.showControls) {
      this.controls = createControls({ manager: this });
    }

    this.fullscreen = createFullscreenController({
      canvas: this.canvas,
      getControlsElement: () => this.controls?.getElement(),
    });

    if (this.config.global.fullscreen) {
      this.fullscreen.set(true);
    }

    this.resize = this.resize.bind(this);
    this.animate = this.animate.bind(this);

    window.addEventListener("resize", this.resize);
    this.resize();
    this.renderInitialFrame();
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
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height, false);
    this.sharedUniforms.uAspect.value = width / height;
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

  reveal() {
    this.canvas.style.opacity = "0";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.canvas.style.opacity = "1";

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

  set(path, value) {
    if (path === "type") {
      return this.setType(value);
    }

    if (!path.includes(".")) {
      path = this.activeWall?.resolvePath?.(path) || `wall.${path}`;
    }

    setPath(this.config, path, value);

    if (path === "global.fullscreen") {
      this.fullscreen?.set(Boolean(value));
    }

    if (path === "global.zIndex") {
      this.canvas.style.zIndex = value;
    }

    this.activeWall?.set?.(path, value);
    this.events.emit("configchange", { path, value });
    return true;
  }

  get(path) {
    if (!path.includes(".")) {
      const resolvedPath = this.activeWall?.resolvePath?.(path);
      if (resolvedPath) return getPath(this.config, resolvedPath);
    }

    return getPath(this.config, path);
  }

  async setType(type) {
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

    this.activeWall?.destroy();
    this.type = type;
    this.config = this.createConfig(type, {
      type,
      global: this.config.global,
      interaction: this.config.interaction,
      wall: {},
    }, wallFactory);
    await this.createActiveWall(wallFactory);
    this.events.emit("typechange", { type });
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
    window.removeEventListener("resize", this.resize);
    this.pointer?.detach();
    this.controls?.destroy();
    this.activeWall?.destroy();
    this.renderer?.dispose();
    this.canvas?.remove();
  }

  createPublicApi() {
    return {
      set: this.set.bind(this),
      get: this.get.bind(this),
      setType: this.setType.bind(this),
      getType: this.getType.bind(this),
      getWallTypes: this.getWallTypes.bind(this),
      getConfig: this.getConfig.bind(this),
      destroy: this.destroy.bind(this),
      on: this.on.bind(this),
    };
  }
}
