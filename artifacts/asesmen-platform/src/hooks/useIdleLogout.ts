import { useEffect } from "react";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart", "visibilitychange"];

function clearAuthStorage() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
  localStorage.removeItem("lastActivityAt");
}

function hasActiveSession() {
  return Boolean(localStorage.getItem("accessToken") || localStorage.getItem("adminToken"));
}

export function useIdleLogout(timeoutMs = IDLE_TIMEOUT_MS) {
  useEffect(() => {
    const markActivity = () => {
      if (!hasActiveSession()) return;
      localStorage.setItem("lastActivityAt", String(Date.now()));
    };

    const logoutIfIdle = () => {
      if (!hasActiveSession()) return;
      const storedLastActivityAt = localStorage.getItem("lastActivityAt");
      if (!storedLastActivityAt) {
        markActivity();
        return;
      }
      const lastActivityAt = Number(storedLastActivityAt);
      if (Date.now() - lastActivityAt < timeoutMs) return;

      clearAuthStorage();
      window.location.href = "/login?session=expired";
    };

    markActivity();
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    const interval = window.setInterval(logoutIfIdle, 30_000);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.clearInterval(interval);
    };
  }, [timeoutMs]);
}
