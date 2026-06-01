// Captures renderer, camera, and scene settings that walls may temporarily change.
export function captureRendererState({ renderer, camera, scene }) {
  const state = {
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping,
    toneMappingExposure: renderer.toneMappingExposure,
    useLegacyLights: renderer.useLegacyLights,
    shadowEnabled: renderer.shadowMap?.enabled,
    shadowType: renderer.shadowMap?.type,
    camera: camera ? {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      near: camera.near,
      far: camera.far,
      position: camera.position.clone(),
      rotation: camera.rotation.clone(),
      zoom: camera.zoom,
    } : null,
    environment: scene?.environment ?? null,
  };

  // Restores the captured settings after a wall is destroyed.
  return function restoreRendererState() {
    renderer.outputColorSpace = state.outputColorSpace;
    renderer.toneMapping = state.toneMapping;
    renderer.toneMappingExposure = state.toneMappingExposure;
    renderer.useLegacyLights = state.useLegacyLights;

    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = state.shadowEnabled;
      renderer.shadowMap.type = state.shadowType;
    }

    if (camera && state.camera) {
      Object.assign(camera, {
        left: state.camera.left,
        right: state.camera.right,
        top: state.camera.top,
        bottom: state.camera.bottom,
        near: state.camera.near,
        far: state.camera.far,
        zoom: state.camera.zoom,
      });
      camera.position.copy(state.camera.position);
      camera.rotation.copy(state.camera.rotation);
      camera.updateProjectionMatrix();
    }

    if (scene) scene.environment = state.environment;
  };
}
