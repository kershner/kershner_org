import { isConfigPath, resolveTopLevelPath } from "./configSchema.js";
import { setPath } from "./utils.js";
const NUMBER_PATTERN = /^-?(?:\d+|\d*\.\d+)(?:e[-+]?\d+)?$/i;

// Checks whether query-string syncing can safely run.
function canUseBrowserUrl() {
  return typeof window !== "undefined" && window.location && window.history;
}

// Converts query-string values into booleans, numbers, or strings.
function parseQueryValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (NUMBER_PATTERN.test(value)) return Number(value);
  return value;
}

// Converts config values back into query-string text.
function formatQueryValue(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value ?? "");
}

// Converts shorthand query keys into full config paths.
function normalizeQueryPath(key) {
  if (key === "type") return "type";
  if (isConfigPath(key)) return key;
  return resolveTopLevelPath(key);
}

// Reads graphics wall options from the current query string.
export function readGraphicsWallQueryParams(search = canUseBrowserUrl() ? window.location.search : "") {
  const options = {};
  const params = new URLSearchParams(search || "");

  params.forEach((value, key) => {
    const path = normalizeQueryPath(key);
    if (!path) return;

    if (path === "type") {
      options.type = value;
      return;
    }

    setPath(options, path, parseQueryValue(value));
  });


  return options;
}

// Writes one graphics wall option to the current query string.
export function updateGraphicsWallQueryParam(path, value, options = {}) {
  if (!canUseBrowserUrl()) return;

  const normalizedPath = normalizeQueryPath(path);
  if (!normalizedPath) return;

  const url = new URL(window.location.href);

  if (options.remove) {
    url.searchParams.delete(normalizedPath);
  } else {
    url.searchParams.set(normalizedPath, formatQueryValue(value));
  }

  window.history.replaceState(window.history.state, "", url);
}


// Removes all recognized graphics wall options from the query string.
export function clearGraphicsWallQueryParams() {
  if (!canUseBrowserUrl()) return;

  const url = new URL(window.location.href);

  Array.from(url.searchParams.keys()).forEach((key) => {
    if (normalizeQueryPath(key)) {
      url.searchParams.delete(key);
    }
  });

  window.history.replaceState(window.history.state, "", url);
}


// Removes recognized graphics wall options under one config prefix.
export function clearGraphicsWallQueryParamsByPrefix(prefix) {
  if (!canUseBrowserUrl()) return;

  const url = new URL(window.location.href);

  Array.from(url.searchParams.keys()).forEach((key) => {
    const path = normalizeQueryPath(key);
    if (path?.startsWith(prefix)) {
      url.searchParams.delete(key);
    }
  });

  window.history.replaceState(window.history.state, "", url);
}
