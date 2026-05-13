import { MapPin } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const branches = [
  {
    name: "Cabang Colombo",
    address: "Jl. Colombo No.8, Samirono, Caturtunggal, Sleman",
    phone: "+62 811-256-238",
    href: "https://wa.me/62811256238",
  },
  {
    name: "Cabang Bantul",
    address: "Jl. Mgr. Sugiyo Pranoto No.14, Melikan Kidul, Bantul",
    phone: "+62 816-669-533",
    href: "https://wa.me/62816669533",
  },
];

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
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={triggerClass}
          style={variant === "button" ? { background: "#25D366" } : undefined}
          aria-label={variant === "floating" ? "Pilih cabang WhatsApp" : undefined}
        >
          <SiWhatsapp size={variant === "floating" ? 26 : 18} color="white" />
          {variant === "button" && label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Pilih Cabang</DialogTitle>
          <DialogDescription>
            Hubungi cabang yang paling sesuai dengan kebutuhan Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {branches.map((branch) => (
            <a
              key={branch.href}
              href={branch.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-gray-100 p-4 transition-colors hover:border-green-200 hover:bg-green-50"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-800">
                  <MapPin size={17} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{branch.name}</div>
                  <div className="mt-1 text-sm leading-relaxed text-gray-500">{branch.address}</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                    <SiWhatsapp size={14} />
                    {branch.phone}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
