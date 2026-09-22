import { ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

export type TrainingPromo = { id:number; title:string; description:string; buttonText:string; linkUrl:string; hasImage:boolean; updatedAt:string };

export default function TrainingPromos({promos,apiBase}:{promos:TrainingPromo[];apiBase:string}) {
  return <aside aria-label="Promo & Info Pelatihan" className="min-w-0 space-y-4">
    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Promo & Info</h3>
    {promos.map(promo=><article key={promo.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      {promo.hasImage && <img src={`${apiBase}/api/training-promos/${promo.id}/image?v=${encodeURIComponent(promo.updatedAt)}`} alt={promo.title} loading="lazy" className="mb-3 h-auto w-full rounded-lg" />}
      <h4 className="mb-1 break-words text-sm font-semibold text-[#2D6A4F]">{promo.title}</h4>
      <p className="mb-2 whitespace-pre-line break-words text-xs leading-5 text-gray-500">{promo.description}</p>
      {promo.linkUrl.startsWith('/') ? <Link href={promo.linkUrl} className="flex items-center gap-1 text-xs font-semibold text-[#2D6A4F]">{promo.buttonText}<ArrowRight size={10}/></Link>
        : <a href={promo.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-[#2D6A4F]">{promo.buttonText}<ArrowRight size={10}/></a>}
    </article>)}
  </aside>;
}
