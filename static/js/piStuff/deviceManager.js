export const DeviceManager = (() => {
  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('pi_device_id');
    if (!deviceId) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      deviceId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('pi_device_id', deviceId);
    }
    return deviceId;
  }

  function ensureDeviceIdInUrl() {
    const deviceId = getOrCreateDeviceId();
    const urlParams = new URLSearchParams(window.location.search);
    
    if (!urlParams.has('device_id')) {
      // Reload with device_id to get proper QR code
      urlParams.set('device_id', deviceId);
      window.location.search = urlParams.toString();
      return false; // Signal that we're reloading
    }
    
    return deviceId;
  }

  return { getOrCreateDeviceId, ensureDeviceIdInUrl };
})();