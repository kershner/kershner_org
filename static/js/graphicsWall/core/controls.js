const PANEL_CSS = `
  .graphics-wall-controls {
    position: fixed;
    right: 12px;
    top: 8px;
    z-index: 99999;
    max-height: 80vh;
    max-width: min(23rem, calc(100vw - 24px));
    overflow: auto;
    color-scheme: dark;
    background: #202020;
    color: #fff;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    border-radius: 2em;
    font: 0.8rem/1rem system-ui, sans-serif;
  }

  .graphics-wall-controls[open] {
    padding: 0 0.9rem 0.9rem;
    border-radius: 1rem;
  }

  .graphics-wall-controls summary,
  .graphics-wall-controls .wall-type-row {
    position: sticky;
    z-index: 2;
    background: #202020;
  }

  .graphics-wall-controls summary {
    top: -7px;
  }

  .graphics-wall-controls[open] summary {
    margin: 0 -0.9rem;
    padding: 0.75rem 0.9rem 0.55rem;
    border-radius: 1rem 1rem 0 0;
  }

  .graphics-wall-controls fieldset {
    max-height: 16rem;
    overflow-y: auto;
    margin: 0.5rem 0;
    padding: 0.45rem 0.65rem 0.6rem;
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 0.5rem;
  }

  .graphics-wall-controls p { margin: 0.45rem 0; }
  .graphics-wall-controls :is(label, small) { display: block; }
  .graphics-wall-controls small { opacity: 0.75; max-width: 100%; white-space: normal; }
  .graphics-wall-controls :is(select, input) { max-width: 100%; }

  .graphics-wall-controls .wall-type-row {
    top: 1.35rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.35rem 0;
  }

  .graphics-wall-controls .wall-type-row label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
  }

  .graphics-wall-controls .wall-reset-button {
    flex: 0 0 auto;
  }

  .graphics-wall-controls .randomize-row {
    margin-top: 0;
  }
`;

// Stops control-panel pointer events from reaching the wall.
function stopPointerEvent(event) {
  event.stopPropagation();
}

// Adds optional helper copy below an input.
function addHelpText(wrapper, helpText) {
  if (!helpText) return;
  const help = document.createElement("small");
  help.textContent = helpText;
  wrapper.appendChild(help);
}

function ensureControlsStyle() {
  const existingStyle = document.getElementById("graphics-wall-controls-style");
  if (existingStyle) return existingStyle;

  const style = document.createElement("style");
  style.id = "graphics-wall-controls-style";
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  return style;
}

// Builds the floating settings panel for the active wall.
export function createControls({ manager }) {
  const panel = document.createElement("details");
  panel.open = false;
  panel.classList.add("graphics-wall-controls");

  ensureControlsStyle();

  ["pointerdown", "pointermove", "pointerup"].forEach((eventName) => {
    panel.addEventListener(eventName, stopPointerEvent);
  });

  const inputRenderers = {
    range(control, value) {
      const input = document.createElement("input");
      const output = document.createElement("output");

      input.type = "range";
      input.min = control.min;
      input.max = control.max;
      input.step = control.step;
      input.value = value;
      output.value = value;
      output.textContent = value;

      input.addEventListener("input", () => {
        const nextValue = Number(input.value);
        output.value = nextValue;
        output.textContent = nextValue;
        manager.set(control.path, nextValue, { syncQueryParams: true });
      });

      return [input, " ", output];
    },

    color(control, value) {
      const input = document.createElement("input");
      input.type = "color";
      input.value = value;
      input.addEventListener("input", () => manager.set(control.path, input.value, { syncQueryParams: true }));
      return [input];
    },

    checkbox(control, value) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(value);
      input.addEventListener("change", () => manager.set(control.path, input.checked, { syncQueryParams: true }));
      return [input];
    },

    select(control, value) {
      const select = document.createElement("select");
      (control.options || []).forEach((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : option;
        const optionEl = document.createElement("option");
        optionEl.value = item.value;
        optionEl.textContent = item.label || item.value;
        optionEl.selected = item.value === value;
        select.appendChild(optionEl);
      });
      select.addEventListener("change", () => manager.set(control.path, select.value, { syncQueryParams: true }));
      return [select];
    },
  };

  function shouldShowControl(control) {
    const type = manager.getType();
    if (Array.isArray(control.walls) && !control.walls.includes(type)) return false;
    if (Array.isArray(control.hideForWalls) && control.hideForWalls.includes(type)) return false;
    return true;
  }

  function createInput(control) {
    const renderInput = inputRenderers[control.type];
    if (!renderInput) return null;

    const wrapper = document.createElement("p");
    const label = document.createElement("label");
    label.textContent = `${control.label}: `;
    label.append(...renderInput(control, manager.get(control.path)));
    wrapper.appendChild(label);
    addHelpText(wrapper, control.help);
    return wrapper;
  }

  function createRandomButton() {
    const wrapper = document.createElement("p");
    const button = document.createElement("button");

    wrapper.className = "randomize-row";
    button.type = "button";
    button.textContent = "Random";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await manager.randomizeSettings({ syncQueryParams: true });
      } finally {
        button.disabled = false;
      }
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  function createWallTypeSelect() {
    const wrapper = document.createElement("p");
    const label = document.createElement("label");
    const select = document.createElement("select");
    const resetButton = document.createElement("button");

    wrapper.className = "wall-type-row";
    label.textContent = "Wall type: ";

    manager.getWallTypes().forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      option.selected = type === manager.getType();
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      manager.setType(select.value, { syncQueryParams: true });
    });

    resetButton.type = "button";
    resetButton.textContent = "Reset";
    resetButton.className = "wall-reset-button";
    resetButton.addEventListener("click", () => {
      manager.reset({ syncQueryParams: true });
    });

    label.appendChild(select);
    wrapper.appendChild(label);
    wrapper.appendChild(resetButton);
    return wrapper;
  }

  function render() {
    panel.innerHTML = "<summary>Settings</summary>";
    panel.appendChild(createWallTypeSelect());

    manager.getControlSchema().forEach((group) => {
      const visibleControls = group.controls.filter(shouldShowControl);
      if (!visibleControls.length) return;

      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");

      legend.textContent = group.title;
      fieldset.appendChild(legend);

      if (group.title === "General") {
        fieldset.appendChild(createRandomButton());
      }

      visibleControls.forEach((control) => {
        const input = createInput(control);
        if (input) fieldset.appendChild(input);
      });

      panel.appendChild(fieldset);
    });
  }

  const offTypeChange = manager.on("typechange", render);
  const offConfigChange = manager.on("configchange", ({ randomize, reset } = {}) => {
    if (randomize || reset) render();
  });

  render();
  document.body.appendChild(panel);

  return {
    getElement() {
      return panel;
    },

    destroy() {
      offTypeChange();
      offConfigChange();
      panel.remove();
    },
  };
}