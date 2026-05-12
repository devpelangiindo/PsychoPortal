const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string) {
  if (!apiBaseUrl || !path.startsWith("/api")) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

export function installApiFetch() {
  if (!apiBaseUrl || window.__apiFetchInstalled) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return originalFetch(apiUrl(input), init);
    }

    if (input instanceof URL && input.pathname.startsWith("/api")) {
      return originalFetch(new URL(apiUrl(input.pathname + input.search)), init);
    }

    return originalFetch(input, init);
  };

  const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
  if (originalSendBeacon) {
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (typeof url === "string") {
        return originalSendBeacon(apiUrl(url), data);
      }

      if (url.pathname.startsWith("/api")) {
        return originalSendBeacon(new URL(apiUrl(url.pathname + url.search)), data);
      }

      return originalSendBeacon(url, data);
    };
  }

  window.__apiFetchInstalled = true;
}

declare global {
  interface Window {
    __apiFetchInstalled?: boolean;
  }
}
