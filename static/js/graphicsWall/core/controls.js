const PANEL_STYLE = {
  position: "fixed",
  right: "12px",
  top: "8px",
  zIndex: "99999",
  maxHeight: "80vh",
  overflow: "auto",
  background: "#202020",
  color: "#FFF",
  padding: "0.4em 1em",
  cursor: "pointer",
  borderRadius: "2em",
  fontSize: "0.8rem",
  lineHeight: "1rem",
  fontFamily: "system-ui, sans-serif",
};

const PANEL_CSS = `
  .graphics-wall-controls fieldset {
    margin: 0.35rem 0;
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.25);
  }
  .graphics-wall-controls p { margin: 0.35rem 0; }
  .graphics-wall-controls label { display: block; }
  .graphics-wall-controls small { opacity: 0.75; display: block; }
  .graphics-wall-controls select,
  .graphics-wall-controls input { max-width: 100%; }
  .graphics-wall-controls .wall-type-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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
`;

function stopPointerEvent(event) {
  event.stopPropagation();
}

function addHelpText(wrapper, helpText) {
  if (!helpText) return;
  const help = document.createElement("small");
  help.textContent = helpText;
  wrapper.appendChild(help);
}

export function createControls({ manager }) {
  const panel = document.createElement("details");
  panel.open = false;
  panel.classList.add("graphics-wall-controls");
  Object.assign(panel.style, PANEL_STYLE);

  const style = document.createElement("style");
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  panel.addEventListener("pointerdown", stopPointerEvent);
  panel.addEventListener("pointermove", stopPointerEvent);
  panel.addEventListener("pointerup", stopPointerEvent);

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

      visibleControls.forEach((control) => {
        const input = createInput(control);
        if (input) fieldset.appendChild(input);
      });

      panel.appendChild(fieldset);
    });
  }

  const offTypeChange = manager.on("typechange", render);
  const offConfigChange = manager.on("configchange", ({ reset } = {}) => {
    if (reset) render();
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
      style.remove();
      panel.remove();
    },
  };
}
