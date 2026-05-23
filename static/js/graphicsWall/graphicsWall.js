import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GraphicsWallManager } from "./core/GraphicsWallManager.js";
import { createGrassWall } from "./walls/grass/index.js";
import { createWaterWall } from "./walls/water/index.js";

const wallTypes = {
  grass: createGrassWall,
  water: createWaterWall,
};

const GraphicsWall = {
  init(options = {}) {
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
