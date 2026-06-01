// Tracks disposable resources and cleanup callbacks for a wall instance.
export function createResourceTracker() {
  const disposables = new Set();
  const cleanupFns = [];

  return {
    // Registers anything with dispose() so wall cleanup stays centralized.
    track(resource) {
      if (resource?.dispose) disposables.add(resource);
      return resource;
    },

    // Registers custom cleanup work such as event listener removal.
    onCleanup(callback) {
      if (typeof callback === "function") cleanupFns.push(callback);
      return callback;
    },

    // Disposes resources once and runs callbacks in reverse order.
    dispose() {
      cleanupFns.splice(0).reverse().forEach((callback) => callback());
      disposables.forEach((resource) => resource.dispose?.());
      disposables.clear();
    },
  };
}
