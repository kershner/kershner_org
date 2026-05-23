import { GraphicsWallManager } from "./core/GraphicsWallManager.js";

const THREE_URL = "/static/vendor/three.js/r160/three.min.js";

let threeLoadPromise = null;

function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);

  if (!threeLoadPromise) {
    threeLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = THREE_URL;
      script.async = true;

      script.onload = () => resolve(window.THREE);
      script.onerror = () => reject(new Error(`Failed to load Three.js: ${THREE_URL}`));

      document.head.appendChild(script);
    });
  }

  return threeLoadPromise;
}

const wallTypes = {
  grass: () => import("./walls/grass/index.js").then((m) => m.createGrassWall),
  water: () => import("./walls/water/index.js").then((m) => m.createWaterWall),
};

const GraphicsWall = {
  async init(options = {}) {
    const THREE = await loadThree();

    const manager = new GraphicsWallManager({
      THREE,
      wallTypes,
      ...options,
    });

    return manager.init();
  },
};

window.GraphicsWall = GraphicsWall;

export default GraphicsWall;