
function isInteractiveElement(element) {
  return Boolean(element?.closest?.(
    'input, textarea, select, button, a, [contenteditable="true"], [contenteditable=""], [role="button"], .graphics-wall-controls'
  ));
}

function pointIntersectsTextNode(node, x, y) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = range.getClientRects();

  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      range.detach?.();
      return true;
    }
  }

  range.detach?.();
  return false;
}

function canUseSelectionGuard() {
  return Boolean(
    typeof document !== "undefined" &&
    document.body &&
    document.body.style &&
    typeof document.elementFromPoint === "function" &&
    typeof document.createRange === "function" &&
    typeof document.createTreeWalker === "function"
  );
}

function pointHitsSelectableText(x, y) {
  if (!canUseSelectionGuard()) return false;

  let element = document.elementFromPoint(x, y);
  if (!element || element === document.documentElement || element === document.body) return false;
  if (isInteractiveElement(element)) return true;

  let depth = 0;
  while (element && element !== document.body && depth < 5) {
    if (element.matches?.('p, span, a, li, label, h1, h2, h3, h4, h5, h6, pre, code, blockquote, td, th')) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();

      while (node) {
        if (node.nodeValue.trim() && pointIntersectsTextNode(node, x, y)) {
          return true;
        }
        node = walker.nextNode();
      }
    }

    element = element.parentElement;
    depth += 1;
  }

  return false;
}

function createSelectionGuard() {
  let tracking = false;
  let active = false;
  let startX = 0;
  let startY = 0;
  let originalUserSelect = "";
  let originalWebkitUserSelect = "";

  function begin(event) {
    active = false;
    tracking = false;

    if (!canUseSelectionGuard() || pointHitsSelectableText(event.clientX, event.clientY)) {
      return;
    }

    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  }

  function move(event) {
    if (!tracking || active) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if ((dx * dx + dy * dy) < 36) return;

    active = true;
    originalUserSelect = document.body.style.userSelect;
    originalWebkitUserSelect = document.body.style.webkitUserSelect;
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
  }

  function disable() {
    tracking = false;

    if (!active || !canUseSelectionGuard()) return;

    active = false;
    document.body.style.userSelect = originalUserSelect;
    document.body.style.webkitUserSelect = originalWebkitUserSelect;
  }

  return { enable: begin, move, disable };
}

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
  const selectionGuard = createSelectionGuard();

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
    selectionGuard.move(event);
    setPointer(event.clientX, event.clientY, event);
  }

  function onPointerDown(event) {
    selectionGuard.enable(event);
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

    selectionGuard.disable();
  }

  function onPointerLeave() {
    if (!pointerDown) {
      selectionGuard.disable();
    }

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
      target?.addEventListener?.("pointermove", onPointerMove, { passive: false });
      windowTarget?.addEventListener?.("pointerdown", onPointerDown, { passive: false });
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
