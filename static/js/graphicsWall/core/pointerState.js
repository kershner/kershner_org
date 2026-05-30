export function createPointerState({ THREE, viewport = null, eventTarget = null } = {}) {
  const getWidth = () => Math.max(viewport?.width || (typeof window !== "undefined" ? window.innerWidth : 1) || 1, 1);
  const getHeight = () => Math.max(viewport?.height || (typeof window !== "undefined" ? window.innerHeight : 1) || 1, 1);
  const target = eventTarget || (typeof document !== "undefined" ? document : null);
  const windowTarget = typeof window !== "undefined" ? window : target;

  const uniforms = {
    uPointer: { value: new THREE.Vector2(9, 9) },
    uPointerSmooth: { value: new THREE.Vector2(9, 9) },
    uPointerVelocity: { value: new THREE.Vector2() },
    uWakePointer: { value: new THREE.Vector2(9, 9) },
    uPointerDown: { value: 0 },
    uPointerDownRaw: { value: 0 },
    uClickPulse: { value: 0 },
    uPulsePointer: { value: new THREE.Vector2(9, 9) },
    uPointerIsTouch: { value: 0 },
    uClickId: { value: 0 },
  };

  let pointerDown = false;
  let activePointerId = null;
  let clickPulse = 0;
  let hasPointer = false;
  let pointerIsTouch = false;
  let clickId = 0;

  const nextPointer = new THREE.Vector2();
  const lastPointer = new THREE.Vector2(9, 9);
  const targetVelocity = new THREE.Vector2();

  function setViewport(width, height) {
    if (!viewport) return;
    viewport.width = width;
    viewport.height = height;
  }

  function setPointer(x, y, event = null) {
    if (event && typeof event.pointerType === "string") {
      pointerIsTouch = event.pointerType === "touch" ? true : pointerIsTouch && event.pointerType !== "mouse";
    }
    nextPointer.set(
      (x / getWidth()) * 2 - 1,
      -((y / getHeight()) * 2 - 1)
    );

    if (!hasPointer) {
      hasPointer = true;
      targetVelocity.set(0, 0);
      lastPointer.copy(nextPointer);
      uniforms.uPointer.value.copy(nextPointer);
      uniforms.uPointerSmooth.value.copy(nextPointer);
      uniforms.uWakePointer.value.copy(nextPointer);
      uniforms.uPointerVelocity.value.set(0, 0);
      return;
    }

    targetVelocity.subVectors(nextPointer, lastPointer);
    lastPointer.copy(nextPointer);
    uniforms.uPointer.value.copy(nextPointer);
  }

  function onPointerMove(event) {
    setPointer(event.clientX, event.clientY, event);
  }

  function onPointerDown(event) {
    pointerDown = true;
    uniforms.uPointerDownRaw.value = 1;
    activePointerId = event.pointerId;
    clickPulse = 1;
    clickId += 1;
    uniforms.uClickId.value = clickId;
    setPointer(event.clientX, event.clientY, event);
    uniforms.uPulsePointer.value.copy(uniforms.uPointer.value);
  }

  function onPointerUp(event) {
    if (activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }

    pointerDown = false;
    uniforms.uPointerDownRaw.value = 0;
    activePointerId = null;

    if (event && typeof event.clientX === "number") {
      setPointer(event.clientX, event.clientY, event);
    }
  }

  function onPointerLeave() {
    if (pointerDown) {
      return;
    }

    hasPointer = false;
    pointerIsTouch = false;
    targetVelocity.set(0, 0);
    lastPointer.set(9, 9);
    uniforms.uPointer.value.set(9, 9);
    uniforms.uPointerSmooth.value.set(9, 9);
    uniforms.uWakePointer.value.set(9, 9);
    uniforms.uPointerVelocity.value.set(0, 0);
  }

  function handlePointerEvent(event) {
    if (!event || !event.type) return;

    if (event.type === "pointermove") {
      onPointerMove(event);
    } else if (event.type === "pointerdown") {
      onPointerDown(event);
    } else if (event.type === "pointerup" || event.type === "pointercancel") {
      onPointerUp(event);
    } else if (event.type === "pointerleave") {
      onPointerLeave(event);
    }
  }

  return {
    uniforms,
    setViewport,
    handlePointerEvent,

    attach() {
      target?.addEventListener?.("pointermove", onPointerMove);
      windowTarget?.addEventListener?.("pointerdown", onPointerDown);
      windowTarget?.addEventListener?.("pointerup", onPointerUp);
      windowTarget?.addEventListener?.("pointercancel", onPointerUp);
      windowTarget?.addEventListener?.("pointerleave", onPointerLeave);
    },

    detach() {
      target?.removeEventListener?.("pointermove", onPointerMove);
      windowTarget?.removeEventListener?.("pointerdown", onPointerDown);
      windowTarget?.removeEventListener?.("pointerup", onPointerUp);
      windowTarget?.removeEventListener?.("pointercancel", onPointerUp);
      windowTarget?.removeEventListener?.("pointerleave", onPointerLeave);
    },

    update(config) {
      uniforms.uPointerSmooth.value.lerp(uniforms.uPointer.value, config.pointerSmoothing);
      uniforms.uWakePointer.value.lerp(uniforms.uPointer.value, config.wakeLag);
      uniforms.uPointerVelocity.value.lerp(targetVelocity, 0.22);
      uniforms.uPointerDownRaw.value = pointerDown ? 1 : 0;
      uniforms.uPointerDown.value += ((pointerDown ? 1 : 0) - uniforms.uPointerDown.value) * 0.18;
      uniforms.uPointerIsTouch.value += ((pointerIsTouch ? 1 : 0) - uniforms.uPointerIsTouch.value) * 0.25;

      targetVelocity.multiplyScalar(0.88);
      clickPulse *= config.pulseDecay;
      uniforms.uClickPulse.value = clickPulse;
    },
  };
}
