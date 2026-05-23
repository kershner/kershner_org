export function createControls({ manager }) {
  const panel = document.createElement("details");
  panel.open = false;
  panel.classList.add("graphics-wall-controls");

  Object.assign(panel.style, {
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
  });

  const style = document.createElement("style");
  style.textContent = `
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
  `;
  document.head.appendChild(style);

  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel.addEventListener("pointermove", (event) => event.stopPropagation());
  panel.addEventListener("pointerup", (event) => event.stopPropagation());

  function createInput(control) {
    const wrapper = document.createElement("p");
    const label = document.createElement("label");
    const value = manager.get(control.path);

    label.textContent = `${control.label}: `;

    if (control.type === "range") {
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
        manager.set(control.path, nextValue);
      });

      label.append(input, " ", output);
    } else if (control.type === "color") {
      const input = document.createElement("input");

      input.type = "color";
      input.value = value;

      input.addEventListener("input", () => {
        manager.set(control.path, input.value);
      });

      label.append(input);
    } else if (control.type === "checkbox") {
      const input = document.createElement("input");

      input.type = "checkbox";
      input.checked = Boolean(value);

      input.addEventListener("change", () => {
        manager.set(control.path, input.checked);
      });

      label.append(input);
    }

    wrapper.appendChild(label);

    if (control.help) {
      const help = document.createElement("small");
      help.textContent = control.help;
      wrapper.appendChild(help);
    }

    return wrapper;
  }

  function createWallTypeSelect() {
    const wrapper = document.createElement("p");
    const label = document.createElement("label");
    const select = document.createElement("select");

    label.textContent = "Wall type: ";

    manager.getWallTypes().forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      option.selected = type === manager.getType();
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      manager.setType(select.value);
    });

    label.appendChild(select);
    wrapper.appendChild(label);
    return wrapper;
  }

  function render() {
    panel.innerHTML = "<summary>Settings</summary>";
    panel.classList.add('dynamic-color-button');
    panel.appendChild(createWallTypeSelect());

    manager.getControlSchema().forEach((group) => {
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");

      legend.textContent = group.title;
      fieldset.appendChild(legend);

      group.controls.forEach((control) => {
        fieldset.appendChild(createInput(control));
      });

      panel.appendChild(fieldset);
    });
  }

  const offTypeChange = manager.on("typechange", render);
  render();
  document.body.appendChild(panel);

  return {
    getElement() {
      return panel;
    },

    destroy() {
      offTypeChange();
      style.remove();
      panel.remove();
    },
  };
}
