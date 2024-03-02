// Vanilla JS version of jQuery's .parents() 
// find the first parent of the given element that the matches given selector
export function parents(element: HTMLElement, selector: string): HTMLElement[] {
  const parentsArray: HTMLElement[] = [];
  let currentElement: HTMLElement | null = element.parentElement;

  while (currentElement) {
    if (!selector || currentElement.matches(selector)) {
      parentsArray.push(currentElement);
    }
    currentElement = currentElement.parentElement;
  }

  return parentsArray;
}

// Custom wrapper for fetch() standardization across apps
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
type RequestOptions = {
  [key: string]: string | FormData
}
type FetchWrapperCallback<T> = (response: T) => void

export const fetchWrapper = <T>(
  endpoint: RequestInfo,
  method: HttpMethod,
  params: RequestOptions = {},
  headers: RequestOptions = {},
  callback: FetchWrapperCallback<T>,
): void => {
  const callParams: RequestInit = {
    headers: headers as HeadersInit,
    method: method,
    credentials: 'include',
    mode: 'same-origin',
  }

  if (params instanceof FormData) {
    callParams.body = params
  } else {
    if (method.toLowerCase() === 'post') {
      callParams.body = JSON.stringify(params)
    }
  }

  fetch(endpoint, callParams)
    .then((response) => response.text())
    .then((data) => {
      const parsedResponse = JSON.parse(data)
      callback(parsedResponse)
    })
    .catch((error) => {
      console.error(error)
    })
}

export function parseParams(defaultParams?: object | null) {
  let params: { [key: string]: string | boolean } = {};

  if (defaultParams) {
    params = defaultParams as { [key: string]: string | boolean };;
  }

  if (window.location.search !== "") {
      const urlSearchParams = new URLSearchParams(window.location.search);
      params = Object.fromEntries(urlSearchParams.entries());

      // Convert true/false query params to actual JS bools
      for (const key in params) {
          const value = params[key];
          if (value === "true" || value === "false") {
              params[key] = value !== "false";
          }
      }
  }

  return params;
}

export async function copyToClipboard(text: string) {
  try {
      await navigator.clipboard.writeText(text);
  } catch (err) {
      console.error('Failed to copy: ', err);
  }
}
