// Converts a config key into its shader uniform name.
export function uniformNameFor(key) {
  return `u${key[0].toUpperCase()}${key.slice(1)}`;
}

// Builds shorthand-to-config-path mappings for wall options.
export function createUniformPathResolver(keys, prefix = "wall") {
  return Object.fromEntries(keys.map((key) => [key, `${prefix}.${key}`]));
}

// Builds uniforms from config keys.
export function makeConfigUniforms(source, keys, nameFor = uniformNameFor) {
  return Object.fromEntries(keys.map((key) => [nameFor(key), { value: source[key] }]));
}

// Copies config values into matching uniforms.
export function syncUniformValues(uniforms, source, keys, nameFor = uniformNameFor) {
  keys.forEach((key) => {
    const uniform = uniforms[nameFor(key)];
    if (uniform) uniform.value = source[key];
  });
}

// Builds mutable THREE color targets from config keys.
export function makeColorTargets(THREE, source, keys) {
  return Object.fromEntries(keys.map((key) => [key, new THREE.Color(source[key])]));
}



// Lerp-or-copies target colors into shader uniforms.
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
