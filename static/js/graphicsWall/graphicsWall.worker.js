let manager = null;
let originalOptions = null;

function setupWorkerDomShim(width, height, devicePixelRatio) {
  self.window = self;
  self.innerWidth = width;
  self.innerHeight = height;
  self.devicePixelRatio = devicePixelRatio || 1;
  self.document = {
    addEventListener: self.addEventListener.bind(self),
    removeEventListener: self.removeEventListener.bind(self),
  };
}

function updateWorkerViewport(width, height, devicePixelRatio) {
  self.innerWidth = width;
  self.innerHeight = height;
  self.devicePixelRatio = devicePixelRatio || self.devicePixelRatio || 1;
}

function dispatchSyntheticPointerEvent(data) {
  const event = new Event(data.type, { cancelable: Boolean(data.cancelable) });
  Object.defineProperties(event, {
    clientX: { value: data.clientX || 0 },
    clientY: { value: data.clientY || 0 },
    pointerId: { value: data.pointerId || 1 },
  });
  self.dispatchEvent(event);
}

async function createManager(options) {
  setupWorkerDomShim(options.width, options.height, options.devicePixelRatio);
  importScripts(options.threeUrl);

  const [{ GraphicsWallManager }] = await Promise.all([
    import(`${options.baseS3Url}/js/graphicsWall/core/GraphicsWallManager.js`),
  ]);

  const wallTypes = {
    grass: () => import(`${options.baseS3Url}/js/graphicsWall/walls/grass/index.js`).then((m) => m.createGrassWall),
    water: () => import(`${options.baseS3Url}/js/graphicsWall/walls/water/index.js`).then((m) => m.createWaterWall),
    orbs: () => import(`${options.baseS3Url}/js/graphicsWall/walls/orbs/index.js`).then((m) => m.createOrbsWall),
    fabric: () => import(`${options.baseS3Url}/js/graphicsWall/walls/fabric/index.js`).then((m) => m.createFabricWall),
  };

  const wallManager = new GraphicsWallManager({
    THREE: self.THREE,
    wallTypes,
    ...options,
  });

  await wallManager.init();
  return wallManager;
}

self.addEventListener("message", async (event) => {
  const data = event.data || {};

  try {
    if (data.type === "init") {
      originalOptions = data.options;
      manager = await createManager({
        ...data.options,
        canvas: data.canvas,
      });
      self.postMessage({ type: "ready" });
      return;
    }

    if (!manager) return;

    if (data.type === "resize") {
      updateWorkerViewport(data.width, data.height, data.devicePixelRatio);
      manager.setSize?.(data.width, data.height, data.devicePixelRatio);
      return;
    }

    if (data.type === "pointer") {
      manager.handlePointerEvent?.(data.event);
      dispatchSyntheticPointerEvent(data.event);
      return;
    }

    if (data.type === "set") {
      manager.set(data.path, data.value);
      return;
    }

    if (data.type === "setType") {
      await manager.setType(data.wallType);
      return;
    }

    if (data.type === "reset") {
      await manager.reset();
      return;
    }

    if (data.type === "destroy") {
      manager.destroy();
      manager = null;
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || String(error),
    });
  }
});
