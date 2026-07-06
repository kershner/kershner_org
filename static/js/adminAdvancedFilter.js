window.adminAdvancedFilter = {
  MODAL_ID: "af-modal",
  ENDPOINT_PATH: "advanced-filter/",
  HELP_TEXT: "Select one or more fields to build an advanced filter.",
  config: null,

  // Adds the changelist button once the page is ready.
  init() {
    if (!document.getElementById("changelist")) return;

    this.addButton();
    this.addClearFiltersButton();
  },

  // Adds the entry button near the changelist filters/tools.
  addButton() {
    if (document.getElementById("af-open")) return;

    const openButton = this.button("Advanced Filter", "button", () => this.openModal());
    const target = document.getElementById("changelist-filter") || document.querySelector(".object-tools");

    openButton.id = "af-open";

    if (target) {
      target.appendChild(this.el("div", { className: "af-button-wrap" }, [openButton]));
    }
  },

  // Adds Django-style clear action link when advanced filter are active.
  async addClearFiltersButton() {
    const target = document.getElementById("changelist-filter");

    if (!target || document.getElementById("changelist-filter-clear")) return;

    const config = await this.getConfig();
    if (!this.hasAdvancedFilters(config)) return;

    const heading = target.querySelector("h2");
    const clear = this.el("h3", { id: "changelist-filter-clear" }, [
      this.el("a", {
        href: window.location.pathname,
        textContent: "✖ Clear all filters",
      }),
    ]);

    if (heading) {
      heading.after(clear);
    } else {
      target.prepend(clear);
    }
  },

  // Loads field config and renders the modal.
  async openModal() {
    const config = await this.getConfig();
    const search = this.el("input", {
      type: "search",
      placeholder: "Filter fields",
      className: "vTextField af-search",
    });
    const list = this.el("div", { className: "af-list" });
    const selected = this.el("div", { className: "af-selected" });
    const help = this.el("p", {
      className: "af-help",
      textContent: config.help_text || this.HELP_TEXT,
    });
    const indicator = this.el("p", { className: "af-indicator", hidden: true });
    const error = this.el("div", { className: "af-error", hidden: true });
    const submitButton = this.button("Submit", "button default", () => this.submit(config, selected, error));

    this.closeModal();

    document.body.appendChild(
      this.modal(config, search, list, selected, help, indicator, error, submitButton)
    );

    search.addEventListener("input", () => {
      this.renderFields(config, list, selected, help, indicator, submitButton, search.value);
    });

    this.refreshSelectedState(selected, help, indicator, submitButton);
    this.renderFields(config, list, selected, help, indicator, submitButton, "");
  },

  // Builds the modal shell.
  modal(config, search, list, selected, help, indicator, error, submitButton) {
    const node = this.el("div", { id: this.MODAL_ID, className: "af-backdrop" }, [
      this.el("div", { className: "af-box" }, [
        this.el("h2", { textContent: config.title || "Advanced Filter" }),
        this.el("div", { className: "af-grid" }, [
          this.el("div", {}, [search, list]),
          this.el("div", {}, [indicator, selected, help, error]),
        ]),
        this.el("div", { className: "af-actions" }, [
          this.button("Cancel", "button af-remove", () => this.closeModal()),
          submitButton,
        ]),
      ]),
    ]);

    node.addEventListener("click", (event) => {
      if (event.target === node) this.closeModal();
    });

    return node;
  },

  // Shows matching fields in the left column.
  renderFields(config, list, selected, help, indicator, submitButton, query) {
    const needle = query.trim().toLowerCase();
    const fields = config.fields.filter((field) =>
      field.name.toLowerCase().includes(needle) ||
      field.label.toLowerCase().includes(needle)
    );

    list.replaceChildren();

    if (!fields.length) {
      list.appendChild(this.el("p", {
        className: "af-empty",
        textContent: "No fields available.",
      }));
      return;
    }

    fields.forEach((field) => {
      const isSelected = selected.querySelector(`[data-field="${this.cssEscape(field.name)}"]`);
      const className = isSelected ? "af-field af-field-selected" : "af-field";
      
      list.appendChild(this.button(field.label, className, () => {
        this.addField(config, field, list, selected, help, indicator, submitButton, query);
      }));
    });
  },

  // Adds a selected field row.
  addField(config, field, list, selected, help, indicator, submitButton, query) {
    if (selected.querySelector(`[data-field="${this.cssEscape(field.name)}"]`)) return;

    const widget = this.html(field.html);
    const row = this.el("div", { className: "af-row" });

    widget.className = "af-widget";
    row.dataset.field = field.name;

    this.resetWidget(widget);
    this.normalizeDateTimeWidget(widget, field);

    row.append(
      this.el("strong", { textContent: field.label }),
      this.lookupSelect(field.lookups),
      widget,
      this.button("X", "button af-remove", () => {
        row.remove();
        this.refreshSelectedState(selected, help, indicator, submitButton);
        this.renderFields(config, list, selected, help, indicator, submitButton, query);
      })
    );

    selected.appendChild(row);
    this.initAdminWidgets(row);
    this.refreshSelectedState(selected, help, indicator, submitButton);
    this.renderFields(config, list, selected, help, indicator, submitButton, query);
  },

  // Redirects to the changelist with the selected filters applied as query params.
  submit(config, selected, error) {
    this.hideError(error);

    if (!selected.querySelector(".af-row")) {
      this.showError(error, "Select at least one field.");
      return;
    }

    const filters = this.filtersFrom(selected);

    if (filters.some((filter) => filter.lookup !== "isnull" && !filter.value)) {
      this.showError(error, "Enter a value for each selected field.");
      return;
    }

    this.redirectWithFilters(config, filters);
  },

  // Converts selected rows into changelist filter params.
  filtersFrom(selected) {
    return Array.from(selected.querySelectorAll(".af-row")).map((row) => {
      const lookup = row.querySelector(".af-lookup").value;

      return {
        field: row.dataset.field,
        lookup,
        value: this.filterValueFrom(row, lookup),
      };
    });
  },

  // Redirects while preserving existing changelist params.
  redirectWithFilters(config, filters) {
    const url = new URL(window.location.href);

    url.searchParams.delete("p");
    this.removeAdvancedFilterParams(url, config);

    filters.forEach((filter) => {
      url.searchParams.set(`${filter.field}__${filter.lookup}`, filter.value);
    });

    window.location.href = `${url.pathname}?${url.searchParams.toString()}`;
  },

  // Removes previous advanced filter params before applying new ones.
  removeAdvancedFilterParams(url, config) {
    config.fields.forEach((field) => {
      field.lookups.forEach((lookup) => {
        url.searchParams.delete(`${field.name}__${lookup}`);
      });
    });
  },

  // Detects whether advanced filter are currently applied.
  hasAdvancedFilters(config) {
    const params = new URL(window.location.href).searchParams;

    return config.fields.some((field) =>
      field.lookups.some((lookup) => params.has(`${field.name}__${lookup}`))
    );
  },

  // Reads the direct changelist value from one selected row.
  filterValueFrom(row, lookup) {
    if (lookup === "isnull") return "True";

    return this.serializedValue(row.dataset.field, this.valuesFrom(row));
  },

  // Converts widget values into a single changelist query value.
  serializedValue(fieldName, values) {
    if (values[fieldName]) {
      return values[fieldName].join(",");
    }

    const parts = Object.entries(values)
      .filter(([key]) => key.startsWith(`${fieldName}_`))
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([, value]) => value)
      .filter(Boolean);

    if (parts.length) {
      return parts.join(" ");
    }

    return Object.values(values)
      .flat()
      .filter(Boolean)
      .join(",");
  },

  // Reads form control values from one selected row.
  valuesFrom(row) {
    const values = {};

    row.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!field.name || field.matches(".af-lookup")) return;
      if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return;

      values[field.name] ||= [];
      values[field.name].push(field.value);
    });

    return values;
  },

  // Builds the lookup dropdown.
  lookupSelect(lookups) {
    const select = this.el("select", { className: "af-lookup" });

    lookups.forEach((lookup) => {
      select.appendChild(this.el("option", { value: lookup, textContent: lookup }));
    });

    return select;
  },

  // Clears text-like defaults without disturbing FK/autocomplete selects.
  resetWidget(root) {
    root.querySelectorAll("input, textarea").forEach((field) => {
      if (field.type === "checkbox" || field.type === "radio") {
        field.checked = false;
      } else {
        field.value = "";
        field.removeAttribute("value");
      }
    });
  },

  // Converts Django date/time widgets to native browser input types.
  normalizeDateTimeWidget(root, field) {
    const inputs = root.querySelectorAll("input");

    if (field.input_type === "datetime-local" && inputs.length >= 2) {
      inputs[0].type = "date";
      inputs[1].type = "time";
    } else if (field.input_type && inputs.length === 1) {
      inputs[0].type = field.input_type;
    }
  },

  // Returns the mixin endpoint for the current changelist.
  endpoint() {
    const path = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;

    return `${path}${this.ENDPOINT_PATH}`;
  },

  // Fetches and caches the field config for the current changelist.
  async getConfig() {
    this.config ||= await this.getJson(this.endpoint());
    return this.config;
  },

  // Fetches JSON and raises on failed responses.
  async getJson(url) {
    const response = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });

    if (!response.ok) throw new Error("Request failed.");
    return response.json();
  },

  // Removes the modal.
  closeModal() {
    document.getElementById(this.MODAL_ID)?.remove();
  },

  // Initializes Django autocomplete widgets inserted into the modal.
  initAdminWidgets(root) {
    const $ = window.django && window.django.jQuery;

    if ($ && $.fn.djangoAdminSelect2) {
      $(root).find(".admin-autocomplete").djangoAdminSelect2();
    }
  },

  // Shows an error inside the modal.
  showError(error, message) {
    error.textContent = message;
    error.hidden = false;
  },

  // Clears the modal error area.
  hideError(error) {
    error.textContent = "";
    error.hidden = true;
  },

  // Updates empty help text, selected indicator, and submit availability.
  refreshSelectedState(selected, help, indicator, submitButton) {
    const count = selected.querySelectorAll(".af-row").length;

    help.hidden = count > 0;
    indicator.hidden = count === 0;
    indicator.textContent = `${count} field${count === 1 ? "" : "s"} selected`;
    submitButton.disabled = count === 0;
  },

  // Creates a button and wires its click handler.
  button(text, className, onClick) {
    const node = this.el("button", {
      type: "button",
      className,
      textContent: text,
    });

    node.addEventListener("click", onClick);
    return node;
  },

  // Wraps server-rendered widget HTML in a DOM node.
  html(markup) {
    const node = this.el("div");
    node.innerHTML = markup;
    return node;
  },

  // Creates an element with properties/attributes and optional children.
  el(tag, props = {}, children = []) {
    const node = document.createElement(tag);

    Object.entries(props).forEach(([key, value]) => {
      if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    });

    node.append(...children);
    return node;
  },

  // Escapes field names for attribute selectors.
  cssEscape(value) {
    return window.CSS && window.CSS.escape
      ? window.CSS.escape(value)
      : String(value).replaceAll('"', '\\"');
  },
};

document.addEventListener("DOMContentLoaded", () => {
  window.adminAdvancedFilter.init();
});
