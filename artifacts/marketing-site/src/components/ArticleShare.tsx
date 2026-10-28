import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok, SiWhatsapp } from "react-icons/si";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import "./article-share.css";

type ArticleShareProps = {
  slug: string;
  title: string;
  excerpt?: string;
  apiBase: string;
  imageUrl?: string;
  variant?: "button" | "floating";
};

export function articleCanonicalUrl(slug: string) {
  return `https://pi-psychology.com/artikel/${encodeURIComponent(slug)}`;
}

// Preserve the server's original tags so leaving an article never leaves its
// title or preview attached to an unrelated SPA page.
export function useArticleMetadata(article: { slug: string; title: string; excerpt: string; apiBase: string } | null) {
  const slug = article?.slug;
  const title = article?.title;
  const excerpt = article?.excerpt;
  const apiBase = article?.apiBase;

  useEffect(() => {
    if (!slug || !title || !apiBase) return;
    const previousTitle = document.title;
    const startedWithArticle = document.head.querySelector('meta[property="og:type"]')?.getAttribute("content") === "article";
    const canonical = articleCanonicalUrl(slug);
    const image = `${apiBase}/api/articles/${encodeURIComponent(slug)}/share-image.jpg`;
    const restore: (() => void)[] = [];
    document.title = `${title} | Pelangi Indonesia Group`;
    const tags = [
      ["name", "description", excerpt || title],
      ["property", "og:title", title],
      ["property", "og:description", excerpt || title],
      ["property", "og:type", "article"],
      ["property", "og:url", canonical],
      ["property", "og:image", image],
      ["property", "og:image:width", "1200"],
      ["property", "og:image:height", "630"],
      ["property", "og:image:alt", title],
      ["name", "twitter:card", "summary_large_image"],
      ["name", "twitter:title", title],
      ["name", "twitter:description", excerpt || title],
      ["name", "twitter:image", image],
    ];
    for (const [attribute, name, value] of tags) {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
      const element = existing ?? document.createElement("meta");
      const previousContent = element.getAttribute("content");
      element.setAttribute(attribute, name);
      element.setAttribute("content", value);
      if (!existing) document.head.append(element);
      restore.push(() => {
        if (!existing) element.remove();
        else if (previousContent === null) element.removeAttribute("content");
        else element.setAttribute("content", previousContent);
      });
    }
    const previousCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const canonicalElement = previousCanonical ?? document.createElement("link");
    const previousHref = canonicalElement.getAttribute("href");
    canonicalElement.rel = "canonical";
    canonicalElement.href = canonical;
    if (!previousCanonical) document.head.append(canonicalElement);
    return () => {
      document.title = previousTitle;
      restore.forEach((reset) => reset());
      if (!previousCanonical) canonicalElement.remove();
      else if (previousHref === null) canonicalElement.removeAttribute("href");
      else canonicalElement.setAttribute("href", previousHref);
      // A direct visit starts with server-rendered article tags. Restoring those
      // after navigating to the list would leak the previous article's preview.
      if (startedWithArticle) {
        document.title = "Pelangi Indonesia Group – Website";
        document.head.querySelectorAll('meta[property^="og:"], meta[property^="article:"], meta[name^="twitter:"]').forEach((tag) => tag.remove());
        document.head.querySelector('meta[name="description"]')?.remove();
        canonicalElement.href = new URL(window.location.pathname, "https://pi-psychology.com").href;
      }
    };
  }, [slug, title, excerpt, apiBase]);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Older browsers and denied clipboard permission can still allow a copy
      // initiated by a click using a selected field.
    }
  }
  const previousFocus = document.activeElement as HTMLElement | null;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  // Keep the field inside an active dialog's focus scope.
  (document.querySelector('[role="dialog"][data-state="open"]') ?? document.body).append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
    selection?.removeAllRanges();
    ranges.forEach((range) => selection?.addRange(range));
  }
  if (!copied) throw new Error("clipboard-unavailable");
}

export default function ArticleShare({ slug, title, excerpt, apiBase, imageUrl, variant = "button" }: ArticleShareProps) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<"all" | "Instagram" | "TikTok">("all");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [copied, setCopied] = useState<"link" | "caption" | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const [cardError, setCardError] = useState(false);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const copyReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = articleCanonicalUrl(slug);
  const caption = [title, excerpt, `Baca selengkapnya: ${url}`].filter(Boolean).join("\n\n");
  const cardUrl = `${apiBase}/api/articles/${encodeURIComponent(slug)}/share-card.jpg`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function");
    return () => { if (copyReset.current) clearTimeout(copyReset.current); };
  }, []);

  useEffect(() => {
    setOpen(false);
    setCardError(false);
    setManualCopy(null);
    setCopied(null);
  }, [slug]);

  const showDialog = (event: MouseEvent<HTMLButtonElement>, target: typeof destination = "all") => {
    if (!open) returnFocus.current = event.currentTarget;
    setDestination(target);
    setManualCopy(null);
    setCardError(false);
    setOpen(true);
  };

  const copy = async (kind: "link" | "caption") => {
    const value = kind === "link" ? url : caption;
    try {
      await copyText(value);
      setCopied(kind);
      setManualCopy(null);
      toast({ title: kind === "link" ? "Tautan artikel disalin" : "Caption dan tautan disalin" });
      if (copyReset.current) clearTimeout(copyReset.current);
      copyReset.current = setTimeout(() => setCopied(null), 3000);
    } catch {
      setManualCopy(value);
      setOpen(true);
      toast({ title: "Salin secara manual", description: "Pilih teks pada kolom yang tersedia, lalu salin." });
    }
  };

  const getCard = async () => {
    const response = await fetch(cardUrl);
    if (!response.ok) throw new Error("card-unavailable");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("invalid-card");
    return new File([blob], `${slug}-pi-psychology.jpg`, { type: blob.type });
  };

  const downloadCard = async () => {
    setBusy("download");
    try {
      const file = await getCard();
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      toast({ title: "Kartu artikel siap diunduh", description: `Unggah gambar melalui aplikasi ${destination === "all" ? "pilihan Anda" : destination}.` });
    } catch {
      toast({ title: "Gambar belum dapat diunduh", description: "Silakan coba lagi. Anda tetap dapat menyalin tautan artikel.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: title, url });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast({ title: "Menu berbagi belum tersedia", description: "Gunakan pilihan WhatsApp, Facebook, atau Salin Tautan." });
    }
  };

  // Fetching before the user's next click preserves the activation required by
  // browser file sharing; a second explicit button shares the prepared image.
  const [preparedCard, setPreparedCard] = useState<File | null>(null);
  useEffect(() => {
    if (!open || destination === "all" || !canNativeShare) return;
    let cancelled = false;
    setPreparedCard(null);
    getCard().then((file) => {
      if (!cancelled && navigator.canShare?.({ files: [file] })) setPreparedCard(file);
    }).catch(() => { /* Download and copy remain available. */ });
    return () => { cancelled = true; };
  }, [open, destination, cardUrl, canNativeShare]);

  const shareCard = async () => {
    if (!preparedCard) return;
    setBusy("share");
    try {
      await navigator.share({ files: [preparedCard], title });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast({ title: "Gambar belum dapat dibagikan", description: "Unduh gambar lalu unggah melalui aplikasi pilihan Anda." });
      }
    } finally {
      setBusy(null);
    }
  };

  const actionClass = "article-share-action";
  const socialActions = (compact = false): ReactNode => (
    <>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={actionClass} aria-label="Bagikan ke WhatsApp" title="Bagikan ke WhatsApp">
        <SiWhatsapp aria-hidden="true" className="text-[#16883c]" size={21} />{!compact && <span>WhatsApp</span>}
      </a>
      <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className={actionClass} aria-label="Bagikan ke Facebook" title="Bagikan ke Facebook">
        <SiFacebook aria-hidden="true" className="text-[#1877f2]" size={21} />{!compact && <span>Facebook</span>}
      </a>
      <button type="button" className={actionClass} onClick={(event) => showDialog(event, "Instagram")} aria-label="Bagikan ke Instagram" title="Bagikan ke Instagram">
        <SiInstagram aria-hidden="true" className="text-[#c13584]" size={21} />{!compact && <span>Instagram</span>}
      </button>
      <button type="button" className={actionClass} onClick={(event) => showDialog(event, "TikTok")} aria-label="Bagikan ke TikTok" title="Bagikan ke TikTok">
        <SiTiktok aria-hidden="true" className="text-gray-900" size={21} />{!compact && <span>TikTok</span>}
      </button>
      <button type="button" className={actionClass} onClick={(event) => { if (!open) returnFocus.current = event.currentTarget; void copy("link"); }} aria-label="Salin tautan artikel" title="Salin tautan artikel">
        {copied === "link" ? <Check aria-hidden="true" size={21} className="text-green-700" /> : <Copy aria-hidden="true" size={21} />}{!compact && <span>{copied === "link" ? "Tautan Disalin" : "Salin Tautan"}</span>}
      </button>
      {canNativeShare && <button type="button" className={actionClass} onClick={nativeShare} aria-label="Bagikan melalui aplikasi lainnya" title="Bagikan lainnya">
        <Share2 aria-hidden="true" size={21} />{!compact && <span>Bagikan Lainnya</span>}
      </button>}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {variant === "floating" ? (
        <aside className="article-share-floating" aria-label="Bagikan artikel">
          <div className="article-share-desktop">
            <p className="mb-2 text-center text-[11px] font-bold leading-4 text-green-950">Bagikan<br />Artikel</p>
            <div className="flex flex-col items-center gap-1">{socialActions(true)}</div>
          </div>
          <button type="button" className="article-share-mobile" onClick={(event) => showDialog(event)} aria-haspopup="dialog" aria-expanded={open}>
            <Share2 aria-hidden="true" size={18} /><span>Bagikan Artikel</span>
          </button>
        </aside>
      ) : (
        <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-green-200 px-3 py-2 text-xs font-bold text-green-800 transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" onClick={(event) => showDialog(event)} aria-haspopup="dialog" aria-label={`Bagikan artikel: ${title}`}>
          <Share2 aria-hidden="true" size={15} />Bagikan
        </button>
      )}

      <DialogContent className="max-h-[85dvh] w-[calc(100vw_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border-green-100 bg-white p-5 sm:p-6" onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus({ preventScroll: true }); }}>
        <DialogHeader className="pr-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-green-950"><Share2 aria-hidden="true" size={20} />Bagikan Artikel</DialogTitle>
          <DialogDescription className="mt-1 line-clamp-2 text-sm text-gray-600">{title}</DialogDescription>
        </DialogHeader>

        {destination === "all" ? (
          <>
            {imageUrl && <img src={imageUrl} alt="" className="h-32 w-full rounded-xl object-cover" />}
            <div className="grid grid-cols-2 gap-2">{socialActions()}</div>
          </>
        ) : (
          <div className="space-y-4">
            <button type="button" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-green-800 hover:underline" onClick={() => { setDestination("all"); setManualCopy(null); }}><ArrowLeft aria-hidden="true" size={14} />Semua pilihan berbagi</button>
            <p className="text-sm leading-relaxed text-gray-600">Bagikan ke <strong className="text-gray-900">{destination}</strong> menggunakan kartu gambar berikut. Unduh gambar, salin caption, lalu unggah melalui aplikasi. Untuk Instagram Story, tambahkan tautan artikel melalui stiker tautan.</p>
            {cardError ? <div className="rounded-xl bg-green-50 p-5 text-center text-sm text-green-900">Pratinjau gambar belum tersedia. Silakan coba lagi atau salin tautan artikel.</div> : <img src={cardUrl} alt={`Kartu berbagi: ${title}`} className="mx-auto max-h-[32dvh] max-w-full rounded-lg border border-gray-100 object-contain" onError={() => setCardError(true)} />}
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={`${actionClass} bg-green-50`} onClick={downloadCard} disabled={busy !== null}>{busy === "download" ? <Loader2 aria-hidden="true" size={18} className="animate-spin" /> : <Download aria-hidden="true" size={18} />}Unduh Gambar</button>
              <button type="button" className={actionClass} onClick={() => copy("caption")}>{copied === "caption" ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}{copied === "caption" ? "Caption Disalin" : "Salin Caption & Tautan"}</button>
              {preparedCard && <button type="button" className={`${actionClass} sm:col-span-2`} disabled={busy !== null} onClick={shareCard}>{busy === "share" ? <Loader2 aria-hidden="true" size={18} className="animate-spin" /> : <Share2 aria-hidden="true" size={18} />}Bagikan Gambar melalui Ponsel</button>}
            </div>
            <p className="text-xs leading-relaxed text-gray-500">Pilihan aplikasi pada menu berbagi mengikuti dukungan perangkat Anda.</p>
          </div>
        )}

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600" htmlFor={`share-link-${slug}-${variant}`}>{manualCopy && manualCopy !== url ? "Caption siap disalin" : "Tautan artikel"}</label>
          <textarea id={`share-link-${slug}-${variant}`} readOnly value={manualCopy ?? url} rows={manualCopy && manualCopy !== url ? 5 : 2} onFocus={(event) => event.currentTarget.select()} className="block w-full resize-none rounded-md border border-gray-200 bg-white p-2 text-xs leading-5 text-gray-700 focus:border-green-600 focus:outline-none" />
          {manualCopy && <p role="status" className="mt-2 text-xs text-gray-600">Tekan dan tahan atau pilih teks di atas untuk menyalinnya.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
