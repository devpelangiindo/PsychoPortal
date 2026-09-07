import { useEffect } from "react";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/api-base";

const SESSION_KEY = "pi_analytics_session";
const ACQUISITION_KEY = "pi_analytics_acquisition";
const PRIVATE_PATH = /^\/(admin|cso|dashboard|psychologist|results|assessment\/|sensory-profile|learning-style|multiple-intelligence|mental-health-checkup|student-potential-test|career-potential-test|dass-screening|srq-screening|payment-)/;
const CHECKOUT_PATH = /^\/(cart|checkout|digital-products\/checkout|physical-products\/checkout|training\/register)$/;

function getSessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function getAcquisition() {
  const existing = sessionStorage.getItem(ACQUISITION_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch { /* create a clean value below */ }
  }
  const params = new URLSearchParams(window.location.search);
  let referrerHost = "";
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* ignore invalid referrer */ }
  const value = {
    source: (params.get("utm_source") || (referrerHost ? referrerHost : "direct")).slice(0, 100),
    medium: (params.get("utm_medium") || (referrerHost ? "referral" : "none")).slice(0, 100),
    campaign: (params.get("utm_campaign") || "").slice(0, 150),
    referrerHost: referrerHost.slice(0, 255),
  };
  sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(value));
  return value;
}

function getDeviceType() {
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

function contentFor(path: string) {
  if (path === "/assessments/online") return { contentType: "assessment", contentSlug: "online" };
  if (path === "/assessments/onsite") return { contentType: "assessment", contentSlug: "onsite" };
  const article = path.match(/^\/artikel\/([^/]+)$/);
  return article ? { contentType: "article", contentSlug: article[1] } : {};
}

function sendEvent(eventType: string, pagePath: string, extra: Record<string, unknown> = {}) {
  void fetch(apiUrl("/api/analytics/events"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: getSessionId(), eventType, pagePath, deviceType: getDeviceType(), ...getAcquisition(), ...contentFor(pagePath), ...extra }),
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

function identifyCta(target: Element) {
  const text = (target.textContent || "").trim().toLowerCase();
  const href = target instanceof HTMLAnchorElement ? target.href.toLowerCase() : "";
  if (href.includes("wa.me") || href.includes("whatsapp")) return "whatsapp";
  if (text.includes("beli sekarang")) return "buy_now";
  if (text.includes("daftar sekarang")) return "register_now";
  if (text.includes("more info") || text.includes("selengkapnya")) return "more_info";
  if (text.includes("hubungi")) return "contact";
  if (text.includes("keranjang")) return "add_to_cart";
  return undefined;
}

export default function WebsiteAnalytics() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location.split("?")[0] || "/";
    if (PRIVATE_PATH.test(path)) return;
    if (CHECKOUT_PATH.test(path)) sendEvent("checkout_start", path);
    else {
      sendEvent("page_view", path);
      if (contentFor(path).contentSlug) sendEvent("content_view", path);
    }
  }, [location]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const path = window.location.pathname;
      if (PRIVATE_PATH.test(path) || CHECKOUT_PATH.test(path)) return;
      const target = event.target instanceof Element ? event.target.closest("a,button") : null;
      if (!target) return;
      const type = identifyCta(target);
      if (type) sendEvent("cta_click", path, { ctaType: type });
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return null;
}
