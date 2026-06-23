import { SiWhatsapp } from "react-icons/si";

const HOTLINE_NUMBER = "085117658242";
const HOTLINE_URL = "https://wa.me/6285117658242";

type WhatsAppBranchChooserProps = {
  label?: string;
  variant?: "button" | "floating";
  className?: string;
};

export default function WhatsAppBranchChooser({
  label = "Hubungi Kami",
  variant = "button",
  className,
}: WhatsAppBranchChooserProps) {
  const triggerClass = variant === "floating"
    ? "wa-float"
    : `flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white transition-all hover:scale-105 hover:shadow-xl ${className ?? ""}`;

  return (
    <a
      href={HOTLINE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={triggerClass}
      style={variant === "button" ? { background: "#25D366" } : undefined}
      aria-label={variant === "floating" ? `Hotline WhatsApp ${HOTLINE_NUMBER}` : undefined}
      title={`Hotline ${HOTLINE_NUMBER}`}
    >
      <SiWhatsapp size={variant === "floating" ? 26 : 18} color="white" />
      {variant === "button" && label}
    </a>
  );
}
