export function getAsesmenPlatformHref() {
  if (import.meta.env.VITE_ASESMEN_PLATFORM_URL) {
    return import.meta.env.VITE_ASESMEN_PLATFORM_URL;
  }

  if (window.location.hostname === "localhost") {
    return "http://localhost:8084/asesmen/";
  }

  return "/asesmen/";
}

export function getBookingHref() {
  if (import.meta.env.VITE_ASESMEN_PLATFORM_URL) {
    return `${import.meta.env.VITE_ASESMEN_PLATFORM_URL.replace(/\/$/, "")}/booking`;
  }

  if (window.location.hostname === "localhost") {
    return "http://localhost:8084/asesmen/booking";
  }

  return "/asesmen/booking";
}
