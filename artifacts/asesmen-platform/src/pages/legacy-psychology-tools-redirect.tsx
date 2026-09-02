import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const mainSiteUrl = import.meta.env.VITE_MAIN_SITE_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:8081" : "https://pi-psychology.com");

export default function LegacyPsychologyToolsRedirect() {
  useEffect(() => {
    window.location.replace(`${mainSiteUrl.replace(/\/$/, "")}/produk-layanan/produk-edukasi/alat-tes-psikologi`);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-emerald-800">
      <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /><p className="mt-4 font-semibold">Membuka Produk Edukasi...</p></div>
    </div>
  );
}
