export function uniformNameFor(key) {
  return `u${key[0].toUpperCase()}${key.slice(1)}`;
}

export function createUniformPathResolver(keys, aliases = {}, prefix = "wall") {
  const paths = Object.fromEntries(keys.map((key) => [key, `${prefix}.${key}`]));
  return { ...paths, ...aliases };
}

export function makeConfigUniforms(source, keys, nameFor = uniformNameFor) {
  return Object.fromEntries(keys.map((key) => [nameFor(key), { value: source[key] }]));
}

export function syncUniformValues(uniforms, source, keys, nameFor = uniformNameFor) {
  keys.forEach((key) => {
    const uniform = uniforms[nameFor(key)];
    if (uniform) uniform.value = source[key];
  });
}

export function makeColorTargets(THREE, source, keys) {
  return Object.fromEntries(keys.map((key) => [key, new THREE.Color(source[key])]));
}



export function applyColorUniforms(uniforms, targets, keys, speed, shouldLerp = true, nameFor = uniformNameFor) {
  keys.forEach((key) => {
    const uniform = uniforms[nameFor(key)];
    const target = targets[key];
    if (!uniform || !target) return;
    if (shouldLerp) {
      uniform.value.lerp(target, speed);
    } else {
      uniform.value.copy(target);
    }
  });
}
