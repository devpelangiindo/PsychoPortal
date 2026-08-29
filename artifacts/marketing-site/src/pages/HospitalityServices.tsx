import { useEffect, useRef, useState, type ComponentType, type TouchEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BedDouble, Building2, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Coffee, Images, Loader2, Shirt, Soup, Sparkles, Users } from "lucide-react";
import { Link, useRoute } from "wouter";
import { SiWhatsapp } from "react-icons/si";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type WhyItem = { title: string; description: string };
type PriceOption = { label: string; price: number | string; promoPrice?: number | string | null; unit?: string };
type OfferingImage = { id: number; focusX: number; focusY: number; sortOrder: number };
type ServiceGalleryImage = { id: number; focusX: number; focusY: number; sortOrder: number };
type Offering = {
  id: number; serviceId: number; slug: string; title: string; description: string;
  capacity?: string | null; area?: string | null; facilities?: string | null; duration?: string | null;
  priceOptions: PriceOption[]; hasImage: boolean; imageFocusX: number; imageFocusY: number;
  images: OfferingImage[];
};
type Service = {
  id: number; slug: string; title: string; summary: string; description: string;
  hasImage: boolean; imageFocusX: number; imageFocusY: number; offerings: Offering[];
  galleryDescription: string; galleryImages: ServiceGalleryImage[];
};
type Catalog = {
  settings: { intro: string; aboutText: string; whyItems: WhyItem[]; philosophy: string };
  services: Service[];
};
type GalleryImage = { id: number; title?: string | null; caption?: string | null; focusX: number; focusY: number };

function apiBase() {
  if (import.meta.env.VITE_ASESMEN_API_URL) return String(import.meta.env.VITE_ASESMEN_API_URL).replace(/\/$/, "");
  return window.location.hostname === "localhost" ? "http://localhost:5001" : "https://asesmen.pi-psychology.com";
}

function serviceImageUrl(id: number) { return `${apiBase()}/api/hospitality/services/${id}/image`; }
function offeringGalleryImageUrl(id: number) { return `${apiBase()}/api/hospitality/offering-images/${id}`; }
function serviceGalleryImageUrl(id: number) { return `${apiBase()}/api/hospitality/service-gallery-images/${id}`; }
function galleryImageUrl(id: number) { return `${apiBase()}/api/hospitality/gallery/images/${id}`; }
function money(value: string | number) { return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value) || 0)}`; }
function whatsappHref(topic: string) {
  return `https://wa.me/6285117658242?text=${encodeURIComponent(`Halo Admin Pelangi Indonesia, saya ingin mengetahui informasi lebih lanjut mengenai ${topic}.`)}`;
}

const icons: Record<string, ComponentType<{ className?: string }>> = {
  homestay: BedDouble,
  "sewa-gedung-ruangan": Building2,
  kedai: Coffee,
  catering: Soup,
  laundry: Shirt,
};

function ImageOrIcon({ service, className = "h-full w-full" }: { service: Service; className?: string }) {
  const Icon = icons[service.slug] || Sparkles;
  return service.hasImage
    ? <img src={serviceImageUrl(service.id)} alt={service.title} className={`${className} object-cover`} style={{ objectPosition: `${service.imageFocusX}% ${service.imageFocusY}%` }} />
    : <div className={`${className} flex items-center justify-center bg-gradient-to-br from-emerald-100 to-amber-50`}><Icon className="h-16 w-16 text-green-800" /></div>;
}

function PriceRows({ prices }: { prices: PriceOption[] }) {
  if (!prices.length) return null;
  return <div className="space-y-2">
    {prices.map((price, index) => <div key={`${price.label}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-green-50 px-4 py-3">
      <span className="text-sm font-semibold text-gray-700">{price.label}</span>
      <span className="text-right">
        {price.promoPrice != null && <span className="mr-2 text-sm text-gray-400 line-through">{money(price.price)}</span>}
        <strong className="text-green-800">{money(price.promoPrice ?? price.price)}{price.unit || ""}</strong>
      </span>
    </div>)}
  </div>;
}

function OfferingCarousel({ offering }: { offering: Offering }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const touchX = useRef<number | null>(null);
  const images = offering.images || [];
  useEffect(() => { if (index >= images.length) setIndex(0); }, [index, images.length]);
  useEffect(() => {
    if (images.length <= 1 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % images.length), 4000);
    return () => window.clearInterval(timer);
  }, [images.length, paused, timerKey]);
  if (!images.length) return <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-green-100 via-white to-amber-100"><BedDouble className="h-16 w-16 text-green-800" /></div>;
  const active = images[index] || images[0];
  const move = (direction: -1 | 1) => { setIndex(current => (current + direction + images.length) % images.length); setTimerKey(current => current + 1); };
  return <div className="relative" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setPaused(false);}} onTouchStart={(event:TouchEvent<HTMLDivElement>)=>{touchX.current=event.touches[0]?.clientX??null;setPaused(true);}} onTouchEnd={(event:TouchEvent<HTMLDivElement>)=>{setPaused(false);if(touchX.current===null)return;const distance=(event.changedTouches[0]?.clientX??touchX.current)-touchX.current;touchX.current=null;if(Math.abs(distance)>=40)move(distance<0?1:-1);}}>
    <div className="aspect-[16/9] touch-pan-y overflow-hidden bg-green-50"><img key={active.id} src={offeringGalleryImageUrl(active.id)} alt={`${offering.title} - foto ${index+1}`} className="h-full w-full animate-in fade-in object-cover duration-500" style={{objectPosition:`${active.focusX}% ${active.focusY}%`}}/></div>
    {images.length>1&&<><button type="button" aria-label="Foto sebelumnya" onClick={()=>move(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white shadow hover:bg-black/65"><ChevronLeft className="h-5 w-5"/></button><button type="button" aria-label="Foto berikutnya" onClick={()=>move(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white shadow hover:bg-black/65"><ChevronRight className="h-5 w-5"/></button><div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">{images.map((image,imageIndex)=><button key={image.id} type="button" aria-label={`Tampilkan foto ${imageIndex+1}`} onClick={()=>{setIndex(imageIndex);setTimerKey(current=>current+1);}} className={`h-2.5 rounded-full shadow transition-all ${imageIndex===index?"w-7 bg-white":"w-2.5 bg-white/55"}`}/>)}</div></>}
  </div>;
}

function OfferingCard({ offering, serviceTitle }: { offering: Offering; serviceTitle: string }) {
  return <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
    <OfferingCarousel offering={offering} />
    <div className="space-y-5 p-6">
      <div><h2 className="text-2xl font-extrabold text-gray-950">{offering.title}</h2><p className="mt-3 leading-7 text-gray-600">{offering.description}</p></div>
      {(offering.capacity || offering.area || offering.duration) && <div className="grid gap-3 rounded-2xl bg-stone-50 p-4 text-sm sm:grid-cols-2">
        {offering.capacity && <p className="flex gap-2"><Users className="h-5 w-5 shrink-0 text-green-700" /><span><strong>Kapasitas:</strong> {offering.capacity}</span></p>}
        {offering.area && <p><strong>Luas:</strong> {offering.area}</p>}
        {offering.duration && <p className="flex gap-2"><Clock3 className="h-5 w-5 shrink-0 text-green-700" /><span><strong>Durasi:</strong> {offering.duration}</span></p>}
      </div>}
      {offering.facilities && <div><h3 className="font-bold text-gray-900">Fasilitas & Ketentuan</h3><p className="mt-2 whitespace-pre-line leading-7 text-gray-600">{offering.facilities}</p></div>}
      <PriceRows prices={offering.priceOptions || []} />
      <a href={whatsappHref(`${serviceTitle} - ${offering.title}`)} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white transition hover:brightness-95"><SiWhatsapp /> Hubungi Hotline PI</a>
    </div>
  </article>;
}

function ServiceGallery({ service }: { service: Service }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const touchX = useRef<number | null>(null);
  const images = service.galleryImages || [];
  useEffect(() => { if (index >= images.length) setIndex(0); }, [index, images.length]);
  useEffect(() => {
    if (images.length <= 1 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % images.length), 4000);
    return () => window.clearInterval(timer);
  }, [images.length, paused, timerKey]);
  if (!images.length) return null;
  const active = images[index] || images[0];
  const move = (direction: -1 | 1) => {
    setIndex(current => (current + direction + images.length) % images.length);
    setTimerKey(current => current + 1);
  };
  return <section className="mt-14">
    <div className="mb-7 text-center"><p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[.2em] text-green-700"><Images size={18} /> Galeri Foto</p><h2 className="mt-2 text-3xl font-extrabold text-gray-950">Galeri {service.title}</h2></div>
    <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5">
      <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }} onTouchStart={(event: TouchEvent<HTMLDivElement>) => { touchX.current = event.touches[0]?.clientX ?? null; setPaused(true); }} onTouchEnd={(event: TouchEvent<HTMLDivElement>) => { setPaused(false); if (touchX.current === null) return; const distance=(event.changedTouches[0]?.clientX??touchX.current)-touchX.current; touchX.current=null; if(Math.abs(distance)>=40)move(distance<0?1:-1); }}>
        <div className="aspect-video touch-pan-y overflow-hidden bg-green-50"><img key={active.id} src={serviceGalleryImageUrl(active.id)} alt={`${service.title} - foto galeri ${index + 1}`} className="h-full w-full animate-in fade-in object-cover duration-500" style={{ objectPosition: `${active.focusX}% ${active.focusY}%` }} /></div>
        {images.length > 1 && <><button type="button" aria-label="Foto sebelumnya" onClick={() => move(-1)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white shadow hover:bg-black/65"><ChevronLeft /></button><button type="button" aria-label="Foto berikutnya" onClick={() => move(1)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white shadow hover:bg-black/65"><ChevronRight /></button><div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">{images.map((image,imageIndex)=><button key={image.id} type="button" aria-label={`Tampilkan foto ${imageIndex+1}`} onClick={()=>{setIndex(imageIndex);setTimerKey(current=>current+1);}} className={`h-2.5 rounded-full shadow transition-all ${imageIndex===index?"w-8 bg-white":"w-2.5 bg-white/55"}`}/>)}</div></>}
      </div>
      {service.galleryDescription && <p className="whitespace-pre-line px-6 py-6 text-center leading-7 text-gray-600 sm:px-10">{service.galleryDescription}</p>}
    </div>
  </section>;
}

function ServiceDetail({ service, backHref }: { service: Service; backHref: string }) {
  const isLaundry = service.slug === "laundry";
  return <div className="min-h-screen bg-stone-50"><Navbar />
    <header className="bg-gradient-to-br from-[#173f33] via-[#245b47] to-[#9A6E5E] px-4 pb-20 pt-32 text-white">
      <div className="mx-auto max-w-6xl"><Link href={backHref} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-green-50"><ArrowLeft size={17} /> Kembali ke Hospitality Services</Link><div className="grid items-center gap-8 md:grid-cols-[1.2fr_.8fr]"><div><p className="text-sm font-bold uppercase tracking-[.22em] text-green-200">Hospitality Services</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">{service.title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/85">{service.description}</p></div><div className="aspect-video overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/20"><ImageOrIcon service={service} /></div></div></div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {isLaundry && service.offerings.length > 0 ? <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5"><div className="p-7"><h2 className="text-3xl font-extrabold">Paket Layanan Laundry</h2><p className="mt-2 text-gray-600">Pilih durasi pengerjaan yang sesuai dengan kebutuhan Anda.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-green-950 text-white"><tr><th className="px-6 py-4">Paket</th><th className="px-6 py-4">Tarif per Kg</th><th className="px-6 py-4">Estimasi Selesai</th></tr></thead><tbody>{service.offerings.map(item => <tr key={item.id} className="border-t"><td className="px-6 py-5 font-bold">{item.title}</td><td className="px-6 py-5 text-green-800">{money(item.priceOptions[0]?.price || 0)}</td><td className="px-6 py-5">{item.duration}</td></tr>)}</tbody></table></div><div className="p-6"><a href={whatsappHref(service.title)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white"><SiWhatsapp /> Hubungi Hotline PI</a></div></section>
        : service.offerings.length > 0 ? <div className="grid items-start gap-7 lg:grid-cols-2">{service.offerings.map(offering => <OfferingCard key={offering.id} offering={offering} serviceTitle={service.title} />)}</div>
        : <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5"><h2 className="text-2xl font-extrabold">Informasi {service.title}</h2><p className="mt-4 leading-8 text-gray-600">{service.description}</p><a href={whatsappHref(service.title)} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 font-bold text-white"><SiWhatsapp /> Hubungi Hotline PI</a></section>}
      <ServiceGallery service={service} />
    </main><Footer />
  </div>;
}

export default function HospitalityServices() {
  const [detailMatch, detailParams] = useRoute("/produk-layanan/horecal/:serviceSlug");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const { data, isLoading, isError } = useQuery<Catalog>({
    queryKey: ["hospitality-catalog"],
    queryFn: async () => { const response = await fetch(`${apiBase()}/api/hospitality`); if (!response.ok) throw new Error("Gagal memuat Hospitality Services"); return response.json(); },
    retry: 1,
  });
  const { data: gallery = [] } = useQuery<GalleryImage[]>({
    queryKey: ["hospitality-gallery"],
    queryFn: async () => { const response = await fetch(`${apiBase()}/api/hospitality/gallery`); if (!response.ok) throw new Error("Gagal memuat galeri"); return response.json(); },
    retry: 1,
  });
  useEffect(() => { if (galleryIndex >= gallery.length) setGalleryIndex(0); }, [galleryIndex, gallery.length]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-stone-50"><Loader2 className="h-8 w-8 animate-spin text-green-800" /></div>;
  const selected = detailMatch ? data?.services.find(service => service.slug === detailParams?.serviceSlug) : undefined;
  if (selected) return <ServiceDetail service={selected} backHref="/produk-layanan/horecal" />;

  const activeGallery = gallery[galleryIndex];
  const moveGallery = (direction: -1 | 1) => gallery.length > 1 && setGalleryIndex(current => (current + direction + gallery.length) % gallery.length);
  return <div className="min-h-screen bg-stone-50"><Navbar />
    <header className="relative isolate overflow-hidden bg-gradient-to-br from-[#173f33] via-[#245b47] to-[#9A6E5E] px-4 pb-20 pt-32 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_35%),radial-gradient(circle_at_80%_80%,#d8b4a0_0,transparent_35%)]" />
      <div className="mx-auto max-w-5xl text-center"><p className="text-sm font-bold uppercase tracking-[.28em] text-green-200">Pelangi Indonesia Group</p><h1 className="mt-4 text-5xl font-black sm:text-6xl">Hospitality Services</h1><p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/85">{data?.settings.intro || "Layanan hospitality yang holistik, nyaman, dan terintegrasi."}</p><button type="button" onClick={() => setAboutOpen(true)} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-green-900 shadow-lg transition hover:-translate-y-0.5">Tentang Hospitality Services <ArrowRight size={18} /></button></div>
    </header>

    <main>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="mb-10 max-w-3xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-green-700">Layanan Kami</p><h2 className="mt-2 text-3xl font-extrabold text-gray-950 sm:text-4xl">Semua kebutuhan dalam satu kawasan</h2><p className="mt-4 leading-7 text-gray-600">Pilih layanan untuk melihat fasilitas, pilihan paket, harga, dan detail selengkapnya.</p></div>
        {isError ? <div className="rounded-2xl bg-red-50 p-8 text-center text-red-800">Layanan belum dapat dimuat. Silakan coba kembali.</div> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{data?.services.map(service => <article key={service.id} className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl"><Link href={`/produk-layanan/horecal/${service.slug}`} className="block"><div className="aspect-[16/10] overflow-hidden"><ImageOrIcon service={service} className="h-full w-full transition duration-500 group-hover:scale-105" /></div><div className="px-6 pt-6"><h3 className="text-2xl font-extrabold text-gray-950 group-hover:text-green-800">{service.title}</h3><p className="mt-3 line-clamp-3 leading-7 text-gray-600">{service.summary}</p><span className="mt-5 inline-flex items-center gap-2 font-bold text-green-800">Lihat Selengkapnya <ArrowRight size={17} /></span></div></Link><div className="p-6 pt-4"><a href={whatsappHref(service.title)} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 px-4 py-2.5 text-sm font-bold text-green-800 transition hover:bg-green-50"><SiWhatsapp /> Info & Kontak</a></div></article>)}</div>}
      </section>

      {activeGallery && <section className="bg-green-950 py-16 text-white"><div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8"><p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[.2em] text-green-300"><Images size={18} /> Galeri Layanan</p><h2 className="mt-2 text-3xl font-extrabold">Suasana dan fasilitas Hospitality Services</h2><div className="relative mt-9 overflow-hidden rounded-3xl bg-white/10 shadow-2xl" onTouchStart={(event: TouchEvent<HTMLDivElement>) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event: TouchEvent<HTMLDivElement>) => { if (touchStartX.current === null) return; const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current; touchStartX.current = null; if (Math.abs(distance) >= 40) moveGallery(distance < 0 ? 1 : -1); }}><div className="aspect-video"><img src={galleryImageUrl(activeGallery.id)} alt={activeGallery.title || "Galeri Hospitality Services"} className="h-full w-full object-cover" style={{ objectPosition: `${activeGallery.focusX}% ${activeGallery.focusY}%` }} /></div>{gallery.length > 1 && <><button type="button" aria-label="Foto sebelumnya" onClick={() => moveGallery(-1)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-green-950 shadow"><ChevronLeft /></button><button type="button" aria-label="Foto berikutnya" onClick={() => moveGallery(1)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-green-950 shadow"><ChevronRight /></button></>}</div>{(activeGallery.title || activeGallery.caption) && <div className="mt-4"><p className="font-bold">{activeGallery.title}</p><p className="text-green-100">{activeGallery.caption}</p></div>}<div className="mt-5 flex justify-center gap-2">{gallery.map((item, index) => <button key={item.id} type="button" aria-label={`Buka foto ${index + 1}`} onClick={() => setGalleryIndex(index)} className={`h-2.5 rounded-full transition-all ${index === galleryIndex ? "w-8 bg-white" : "w-2.5 bg-white/40"}`} />)}</div></div></section>}

      <section className="px-4 py-16 text-center sm:px-6"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-9 shadow-sm ring-1 ring-black/5"><CheckCircle2 className="mx-auto h-10 w-10 text-green-700" /><h2 className="mt-4 text-3xl font-extrabold">Butuh bantuan memilih layanan?</h2><p className="mx-auto mt-3 max-w-2xl leading-7 text-gray-600">Tim Pelangi Indonesia siap membantu menyesuaikan akomodasi, ruangan, konsumsi, dan layanan pendukung dengan kebutuhan Anda.</p><a href={whatsappHref("Hospitality Services")} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 font-bold text-white"><SiWhatsapp /> Hubungi Hotline PI</a></div></section>
    </main>

    <Dialog open={aboutOpen} onOpenChange={setAboutOpen}><DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="text-2xl text-green-950">Tentang Hospitality Services</DialogTitle><DialogDescription>Pelayanan terpadu Pelangi Indonesia Group.</DialogDescription></DialogHeader><div className="space-y-7 pt-2"><section><h3 className="text-lg font-extrabold">Tentang Kami</h3><p className="mt-2 leading-7 text-gray-600">{data?.settings.aboutText}</p></section><section><h3 className="text-lg font-extrabold">Mengapa Memilih Layanan Kami?</h3><div className="mt-3 space-y-3">{data?.settings.whyItems.map(item => <div key={item.title} className="rounded-xl bg-green-50 p-4"><p className="font-bold text-green-950">{item.title}</p><p className="mt-1 leading-6 text-gray-600">{item.description}</p></div>)}</div></section><section><h3 className="text-lg font-extrabold">Filosofi Layanan</h3><p className="mt-2 leading-7 text-gray-600">{data?.settings.philosophy}</p></section></div></DialogContent></Dialog>
    <Footer />
  </div>;
}
