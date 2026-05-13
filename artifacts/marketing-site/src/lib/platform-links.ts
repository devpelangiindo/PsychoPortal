export function getAsesmenPlatformHref() {
  if (import.meta.env.VITE_ASESMEN_PLATFORM_URL) {
    return import.meta.env.VITE_ASESMEN_PLATFORM_URL;
  }

  if (window.location.hostname === "localhost") {
    return "http://localhost:8084/";
  }

  return "https://psychoportal-asesmen.onrender.com";
}

export function getBookingHref() {
  if (import.meta.env.VITE_ASESMEN_PLATFORM_URL) {
    return `${import.meta.env.VITE_ASESMEN_PLATFORM_URL.replace(/\/$/, "")}/booking`;
  }

  if (window.location.hostname === "localhost") {
    return "http://localhost:8084/booking";
  }

  return "https://psychoportal-asesmen.onrender.com/booking";
}
