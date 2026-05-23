export function createGrassGeometry({ THREE, baseGeometry, bladeCount }) {
  const geometry = new THREE.InstancedBufferGeometry();

  geometry.index = baseGeometry.index;
  geometry.attributes.position = baseGeometry.attributes.position;
  geometry.attributes.uv = baseGeometry.attributes.uv;

  const offsets = new Float32Array(bladeCount * 2);
  const scales = new Float32Array(bladeCount * 2);
  const randoms = new Float32Array(bladeCount * 4);
  const shapes = new Float32Array(bladeCount * 4);

  const columns = Math.ceil(Math.sqrt(bladeCount * 1.35));
  const rows = Math.ceil(bladeCount / columns);
  const rowHeight = 2.25 / Math.max(rows - 1, 1);

  for (let i = 0; i < bladeCount; i++) {
    const row = Math.floor(i / columns);
    const offsetIndex = i * 2;
    const randomIndex = i * 4;

    const cluster = Math.random() < 0.35 ? Math.random() * 0.08 - 0.04 : 0;
    const yBase = 1.125 - row * rowHeight;

    offsets[offsetIndex] = Math.random() * 2.25 - 1.125;
    offsets[offsetIndex + 1] = yBase + cluster + (Math.random() - 0.5) * rowHeight;

    const heightRoll = Math.random();
    const widthRoll = Math.random();
    const clumpBoost = Math.random() < 0.18 ? 1.25 + Math.random() * 0.75 : 1;
    const squatBlade = Math.random() < 0.16;

    scales[offsetIndex] = (0.008 + Math.pow(widthRoll, 2.65) * 0.082) * clumpBoost;
    scales[offsetIndex + 1] = squatBlade
      ? 0.045 + Math.random() * 0.16
      : 0.08 + Math.pow(heightRoll, 1.45) * 0.55;

    randoms[randomIndex] = Math.random();
    randoms[randomIndex + 1] = Math.random();
    randoms[randomIndex + 2] = Math.random();
    randoms[randomIndex + 3] = Math.random();

    shapes[randomIndex] = Math.random();
    shapes[randomIndex + 1] = Math.random();
    shapes[randomIndex + 2] = Math.random();
    shapes[randomIndex + 3] = Math.random();
  }

  geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 2));
  geometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(scales, 2));
  geometry.setAttribute("aRandom", new THREE.InstancedBufferAttribute(randoms, 4));
  geometry.setAttribute("aShape", new THREE.InstancedBufferAttribute(shapes, 4));

  return geometry;
}
