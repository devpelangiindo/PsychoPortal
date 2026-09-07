import { useEffect } from "react";
import { useLocation } from "wouter";

type ContentContext = { contentType?: string; contentSlug?: string };

const SESSION_KEY = "pi_analytics_session";
const ACQUISITION_KEY = "pi_analytics_acquisition";

function apiBase() {
  if (import.meta.env.VITE_ASESMEN_API_URL) return String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "");
  return window.location.hostname === "localhost" ? "http://localhost:5001" : "https://asesmen.pi-psychology.com";
}

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function acquisition() {
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

function deviceType() {
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

function contentFor(path: string): ContentContext {
  const rules: Array<[RegExp, string]> = [
    [/^\/produk-layanan\/produk-edukasi\/produk-digital\/([^/]+)$/, "digital-product"],
    [/^\/produk-layanan\/produk-edukasi\/produk-fisik\/([^/]+)$/, "physical-product"],
    [/^\/produk-layanan\/terapi\/([^/]+)$/, "therapy"],
    [/^\/produk-layanan\/pelatihan\/([^/]+)$/, "training"],
    [/^\/produk-layanan\/horecal\/([^/]+)$/, "hospitality"],
    [/^\/artikel\/([^/]+)$/, "article"],
  ];
  for (const [pattern, contentType] of rules) {
    const match = path.match(pattern);
    if (match) return { contentType, contentSlug: match[1] };
  }
  if (path === "/produk-layanan/kursus") return { contentType: "course", contentSlug: "kursus" };
  if (path === "/produk-layanan/produk-edukasi/alat-tes-psikologi") return { contentType: "psychology-test", contentSlug: "alat-tes-psikologi" };
  return {};
}

function sendEvent(eventType: string, pagePath: string, extra: Record<string, unknown> = {}) {
  const context = contentFor(pagePath);
  void fetch(`${apiBase()}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: sessionId(), eventType, pagePath, deviceType: deviceType(), ...acquisition(), ...context, ...extra }),
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

function ctaType(target: Element) {
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
    sendEvent("page_view", path);
    if (contentFor(path).contentSlug) sendEvent("content_view", path);
  }, [location]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a,button") : null;
      if (!target) return;
      const type = ctaType(target);
      if (type) sendEvent("cta_click", window.location.pathname, { ctaType: type });
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return null;
}
