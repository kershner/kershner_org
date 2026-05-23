export function createFullscreenController({ canvas, getControlsElement }) {
  const hiddenElements = new Map();

  return {
    set(enabled) {
      Array.from(document.body.children).forEach((element) => {
        if (element === canvas || element === getControlsElement?.()) {
          return;
        }

        if (enabled) {
          if (!hiddenElements.has(element)) {
            hiddenElements.set(element, element.style.display);
          }

          element.style.display = "none";
          return;
        }

        if (hiddenElements.has(element)) {
          element.style.display = hiddenElements.get(element);
        }
      });

      if (!enabled) {
        hiddenElements.clear();
      }
    },
  };
}
