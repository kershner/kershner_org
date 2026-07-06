(function () {
  "use strict";

  const MODAL_ID = "af-modal";
  const ENDPOINT_PATH = "advanced-filters/";
  const HELP_TEXT = "Select one or more fields to build an advanced filter.";
  document.addEventListener("DOMContentLoaded", init);

  // Adds the changelist button once the page is ready.
  function init() {
    if (!document.getElementById("changelist")) return;

    addButton();
    addClearFiltersButton();
  }

  // Adds the entry button near the changelist filters/tools.
  function addButton() {
    if (document.getElementById("af-open")) return;

    const openButton = button("Advanced Filters", "button", openModal);
    const target = document.getElementById("changelist-filter") || document.querySelector(".object-tools");

    openButton.id = "af-open";

    if (target) {
      target.appendChild(el("div", { className: "af-button-wrap" }, [openButton]));
    }
  }

  // Adds Django-style clear action when advanced filters are active.
  async function addClearFiltersButton() {
    const target = document.getElementById("changelist-filter");

    if (!target || document.getElementById("changelist-filter-clear")) return;

    const config = await getJson(endpoint());
    if (!hasAdvancedFilters(config)) return;

    const heading = target.querySelector("h2");
    const clear = el("h3", { id: "changelist-filter-clear" }, [
      el("a", {
        href: window.location.pathname,
        textContent: "✖ Clear all filters",
      }),
    ]);

    if (heading) {
      heading.after(clear);
    } else {
      target.prepend(clear);
    }
  }

  // Loads field config and renders the modal.
  async function openModal() {
    const config = await getJson(endpoint());
    const search = el("input", {
      type: "search",
      placeholder: "Filter fields",
      className: "vTextField af-search",
    });
    const list = el("div", { className: "af-list" });
    const selected = el("div", { className: "af-selected" });
    const help = el("p", {
      className: "af-help",
      textContent: config.help_text || HELP_TEXT,
    });
    const indicator = el("p", { className: "af-indicator", hidden: true });
    const error = el("div", { className: "af-error", hidden: true });
    const submitButton = button("Submit", "button default", () => submit(config, selected, error));

    closeModal();

    document.body.appendChild(
      modal(config, search, list, selected, help, indicator, error, submitButton)
    );

    search.addEventListener("input", () => {
      renderFields(config, list, selected, help, indicator, submitButton, search.value);
    });

    refreshSelectedState(selected, help, indicator, submitButton);
    renderFields(config, list, selected, help, indicator, submitButton, "");
  }

  // Builds the modal shell.
  function modal(config, search, list, selected, help, indicator, error, submitButton) {
    const node = el("div", { id: MODAL_ID, className: "af-backdrop" }, [
      el("div", { className: "af-box" }, [
        el("h2", { textContent: config.title || "Advanced Filters" }),
        el("div", { className: "af-grid" }, [
          el("div", {}, [search, list]),
          el("div", {}, [indicator, selected, help, error]),
        ]),
        el("div", { className: "af-actions" }, [
          button("Cancel", "button af-remove", closeModal),
          submitButton,
        ]),
      ]),
    ]);

    node.addEventListener("click", (event) => {
      if (event.target === node) closeModal();
    });

    return node;
  }

  // Shows matching fields in the left column.
  function renderFields(config, list, selected, help, indicator, submitButton, query) {
    const needle = query.trim().toLowerCase();
    const fields = config.fields.filter((field) =>
      field.name.toLowerCase().includes(needle) ||
      field.label.toLowerCase().includes(needle)
    );

    list.replaceChildren();

    if (!fields.length) {
      list.appendChild(el("p", {
        className: "af-empty",
        textContent: "No fields available.",
      }));
      return;
    }

    fields.forEach((field) => {
      const isSelected = selected.querySelector(`[data-field="${cssEscape(field.name)}"]`);
      const className = isSelected ? "af-field af-field-selected" : "af-field";
      
      list.appendChild(button(field.label, className, () => {
        addField(config, field, list, selected, help, indicator, submitButton, query);
      }));
    });
  }

  // Adds a selected field row.
  function addField(config, field, list, selected, help, indicator, submitButton, query) {
    if (selected.querySelector(`[data-field="${cssEscape(field.name)}"]`)) return;

    const widget = html(field.html);
    const row = el("div", { className: "af-row" });

    widget.className = "af-widget";
    row.dataset.field = field.name;

    resetWidget(widget);
    normalizeDateTimeWidget(widget, field);

    row.append(
      el("strong", { textContent: field.label }),
      lookupSelect(field.lookups),
      widget,
      button("X", "button af-remove", () => {
        row.remove();
        refreshSelectedState(selected, help, indicator, submitButton);
        renderFields(config, list, selected, help, indicator, submitButton, query);
      })
    );

    selected.appendChild(row);
    initAdminWidgets(row);
    refreshSelectedState(selected, help, indicator, submitButton);
    renderFields(config, list, selected, help, indicator, submitButton, query);
  }

  // Redirects to the changelist with the selected filters applied as query params.
  function submit(config, selected, error) {
    hideError(error);

    if (!selected.querySelector(".af-row")) {
      showError(error, "Select at least one field.");
      return;
    }

    const filters = filtersFrom(selected);

    if (filters.some((filter) => filter.lookup !== "isnull" && !filter.value)) {
      showError(error, "Enter a value for each selected field.");
      return;
    }

    redirectWithFilters(config, filters);
  }

  // Converts selected rows into changelist filter params.
  function filtersFrom(selected) {
    return Array.from(selected.querySelectorAll(".af-row")).map((row) => {
      const lookup = row.querySelector(".af-lookup").value;

      return {
        field: row.dataset.field,
        lookup,
        value: filterValueFrom(row, lookup),
      };
    });
  }

  // Redirects while preserving existing changelist params.
  function redirectWithFilters(config, filters) {
    const url = new URL(window.location.href);

    url.searchParams.delete("p");
    removeAdvancedFilterParams(url, config);

    filters.forEach((filter) => {
      url.searchParams.set(`${filter.field}__${filter.lookup}`, filter.value);
    });

    window.location.href = `${url.pathname}?${url.searchParams.toString()}`;
  }

  // Removes previous advanced filter params before applying new ones.
  function removeAdvancedFilterParams(url, config) {
    config.fields.forEach((field) => {
      field.lookups.forEach((lookup) => {
        url.searchParams.delete(`${field.name}__${lookup}`);
      });
    });
  }

  // Detects whether advanced filters are currently applied.
  function hasAdvancedFilters(config) {
    const params = new URL(window.location.href).searchParams;

    return config.fields.some((field) =>
      field.lookups.some((lookup) => params.has(`${field.name}__${lookup}`))
    );
  }

  // Reads the direct changelist value from one selected row.
  function filterValueFrom(row, lookup) {
    if (lookup === "isnull") return "True";

    return serializedValue(row.dataset.field, valuesFrom(row));
  }

  // Converts widget values into a single changelist query value.
  function serializedValue(fieldName, values) {
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
  }

  // Reads form control values from one selected row.
  function valuesFrom(row) {
    const values = {};

    row.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!field.name || field.matches(".af-lookup")) return;
      if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return;

      values[field.name] ||= [];
      values[field.name].push(field.value);
    });

    return values;
  }

  // Builds the lookup dropdown.
  function lookupSelect(lookups) {
    const select = el("select", { className: "af-lookup" });

    lookups.forEach((lookup) => {
      select.appendChild(el("option", { value: lookup, textContent: lookup }));
    });

    return select;
  }

  // Clears text-like defaults without disturbing FK/autocomplete selects.
  function resetWidget(root) {
    root.querySelectorAll("input, textarea").forEach((field) => {
      if (field.type === "checkbox" || field.type === "radio") {
        field.checked = false;
      } else {
        field.value = "";
        field.removeAttribute("value");
      }
    });
  }

  // Converts Django date/time widgets to native browser input types.
  function normalizeDateTimeWidget(root, field) {
    const inputs = root.querySelectorAll("input");

    if (field.input_type === "datetime-local" && inputs.length >= 2) {
      inputs[0].type = "date";
      inputs[1].type = "time";
    } else if (field.input_type && inputs.length === 1) {
      inputs[0].type = field.input_type;
    }
  }

  // Returns the mixin endpoint for the current changelist.
  function endpoint() {
    const path = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;

    return `${path}${ENDPOINT_PATH}`;
  }

  // Fetches JSON and raises on failed responses.
  async function getJson(url) {
    const response = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });

    if (!response.ok) throw new Error("Request failed.");
    return response.json();
  }

  // Removes the modal.
  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
  }

  // Initializes Django autocomplete widgets inserted into the modal.
  function initAdminWidgets(root) {
    const $ = window.django && window.django.jQuery;

    if ($ && $.fn.djangoAdminSelect2) {
      $(root).find(".admin-autocomplete").djangoAdminSelect2();
    }
  }

  // Shows an error inside the modal.
  function showError(error, message) {
    error.textContent = message;
    error.hidden = false;
  }

  // Clears the modal error area.
  function hideError(error) {
    error.textContent = "";
    error.hidden = true;
  }

  // Updates empty help text, selected indicator, and submit availability.
  function refreshSelectedState(selected, help, indicator, submitButton) {
    const count = selected.querySelectorAll(".af-row").length;

    help.hidden = count > 0;
    indicator.hidden = count === 0;
    indicator.textContent = `${count} field${count === 1 ? "" : "s"} selected`;
    submitButton.disabled = count === 0;
  }

  // Creates a button and wires its click handler.
  function button(text, className, onClick) {
    const node = el("button", {
      type: "button",
      className,
      textContent: text,
    });

    node.addEventListener("click", onClick);
    return node;
  }

  // Wraps server-rendered widget HTML in a DOM node.
  function html(markup) {
    const node = el("div");
    node.innerHTML = markup;
    return node;
  }

  // Creates an element with properties/attributes and optional children.
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);

    Object.entries(props).forEach(([key, value]) => {
      if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    });

    node.append(...children);
    return node;
  }

  // Escapes field names for attribute selectors.
  function cssEscape(value) {
    return window.CSS && window.CSS.escape
      ? window.CSS.escape(value)
      : String(value).replaceAll('"', '\\"');
  }
})();
