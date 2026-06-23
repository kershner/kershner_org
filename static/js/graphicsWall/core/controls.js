const PANEL_CSS = `
  .graphics-wall-controls {
    position: fixed;
    top: 8px;
    right: 12px;
    z-index: 99999;
    max-width: min(23rem, calc(100vw - 24px));
    max-height: 80vh;
    overflow: visible;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #fff;
    color-scheme: dark;
    cursor: pointer;
    font: 0.8rem/1rem system-ui, sans-serif;
  }

  .graphics-wall-controls[open] {
    overflow: auto;
    padding: 0 0.9rem 0.9rem;
    border-radius: 1rem;
    background: #202020;
  }

  .graphics-wall-controls summary {
    position: sticky;
    top: -7px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    box-sizing: border-box;
    margin: 0;
    border: 0 !important;
    outline: 0;
    background: transparent !important;
    box-shadow: none !important;
    list-style: none;
    font-size: 2rem;
    line-height: 1;
    text-shadow: 0 1px 2px rgba(0,0,0,0.34);
    appearance: none;
    -webkit-appearance: none;
  }

  .graphics-wall-controls summary::-webkit-details-marker,
  .graphics-wall-controls summary::before,
  .graphics-wall-controls summary::after {
    display: none !important;
    content: none !important;
  }

  .graphics-wall-controls[open] summary {
    width: auto;
    height: auto;
    min-width: 2.65rem;
    min-height: 2.65rem;
    margin: 0 -0.9rem;
    padding: 0.7rem 0.9rem 0.45rem;
    border-radius: 1rem 1rem 0 0;
    background: #202020 !important;
  }

  .graphics-wall-controls .graphics-wall-title {
    display: none;
    margin: 0;
    color: #cfcfcf;
    font-size: 1.18rem;
    font-style: italic;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.1;
    text-align: right;
    text-decoration: underline;
    text-underline-offset: 0.18em;
    text-decoration-thickness: 0.08em;
    text-shadow: 0 0 0.9rem rgba(255,255,255,0.24);
  }

  .graphics-wall-controls[open] .graphics-wall-title {
    display: inline-block;
  }

  .graphics-wall-controls .graphics-wall-title:hover,
  .graphics-wall-controls .graphics-wall-title:focus-visible {
    color: #fff;
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
    position: sticky;
    top: 1.35rem;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.35rem 0;
    background: #202020;
  }

  .graphics-wall-controls .wall-type-row label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
  }

  .graphics-wall-controls .wall-actions {
    display: flex;
    flex: 0 0 auto;
    gap: 0.35rem;
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
export function createControls({ manager, titleUrl, settingsIcon = "☰" }) {
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
      const options = (control.options || []).map((option) => (
        typeof option === "string" ? { value: option, label: option } : option
      ));

      options.forEach((item, index) => {
        const optionEl = document.createElement("option");
        optionEl.value = String(index);
        optionEl.textContent = item.label || String(item.value);
        optionEl.selected = item.value === value;
        select.appendChild(optionEl);
      });

      select.addEventListener("change", () => {
        const selectedOption = options[Number(select.value)];
        if (selectedOption) manager.set(control.path, selectedOption.value, { syncQueryParams: true });
      });

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
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = "Random";
    button.title = "Randomize wall settings.";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await manager.randomizeSettings({ syncQueryParams: true });
      } finally {
        button.disabled = false;
      }
    });

    return button;
  }

  function createWallTypeSelect() {
    const wrapper = document.createElement("p");
    const label = document.createElement("label");
    const select = document.createElement("select");
    const actions = document.createElement("span");
    const randomButton = createRandomButton();
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
    resetButton.title = "Restore default settings.";
    resetButton.addEventListener("click", () => {
      manager.reset({ syncQueryParams: true });
    });

    actions.className = "wall-actions";
    actions.append(randomButton, resetButton);

    label.appendChild(select);
    wrapper.appendChild(label);
    wrapper.appendChild(actions);
    return wrapper;
  }

  function createPanelTitle() {
    const title = document.createElement("a");
    title.className = "graphics-wall-title";
    title.href = titleUrl;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = "graphicsWall.js";
    return title;
  }

  function render() {
    const summary = document.createElement("summary");
    const icon = document.createElement("span");

    summary.title = "Settings";
    summary.setAttribute("aria-label", "Settings");
    icon.textContent = settingsIcon;
    summary.append(createPanelTitle(), icon);

    panel.replaceChildren(summary);
    panel.appendChild(createWallTypeSelect());

    manager.getControlSchema().forEach((group) => {
      const visibleControls = group.controls.filter(shouldShowControl);
      if (!visibleControls.length) return;

      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");

      legend.textContent = group.title;
      fieldset.appendChild(legend);

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