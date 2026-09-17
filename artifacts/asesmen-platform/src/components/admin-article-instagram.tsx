import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Instagram, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type Connection = { configured: boolean; connected: boolean; username: string | null; expired: boolean; expiresAt: string | null };
export type InstagramPost = { articleId?: number; trainingId?: number; status: string; caption: string; permalink: string | null; error: string | null };
type ContentKind = 'article' | 'training';
const connectionKey = ['/api/admin/instagram'];
const postsKey = ['/api/admin/instagram/posts'];
const trainingPostsKey = ['/api/admin/instagram/training-posts'];

export function InstagramConnectionPanel({ kind = 'article' }: { kind?: ContentKind }) {
  const contentLabel = kind === 'training' ? 'pelatihan' : 'artikel';
  const { toast } = useToast();
  const client = useQueryClient();
  const { data, isLoading, error } = useQuery<Connection>({ queryKey: connectionKey, refetchInterval: 30000 });
  const connect = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/admin/instagram/connect', { returnTo: kind })).json(),
    onSuccess: result => { window.location.assign(result.url); },
    onError: () => toast({ title: 'Koneksi Instagram belum dapat dimulai', description: 'Periksa konfigurasi Meta di server lalu coba lagi.', variant: 'destructive' }),
  });
  const disconnect = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/admin/instagram'),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: connectionKey }); await client.invalidateQueries({ queryKey: postsKey }); await client.invalidateQueries({ queryKey: trainingPostsKey }); },
    onError: () => toast({ title: 'Gagal memutus koneksi', variant: 'destructive' }),
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('instagram');
    if (!result) return;
    const messages: Record<string, string> = {
      connected: 'Akun Instagram berhasil dihubungkan.', cancelled: 'Koneksi Instagram dibatalkan.',
      invalid: 'Sesi koneksi kedaluwarsa. Silakan hubungkan ulang.',
      failed: 'Gagal menghubungkan akun. Periksa izin Meta; untuk mengganti akun, putuskan koneksi lama terlebih dahulu.',
    };
    toast({ title: messages[result] ?? 'Koneksi Instagram belum berhasil.', variant: result === 'connected' ? 'default' : 'destructive' });
    void client.invalidateQueries({ queryKey: connectionKey });
    url.searchParams.delete('instagram');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [client, toast]);
  return <section className="mb-7 rounded-2xl border border-pink-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Instagram className="h-5 w-5 text-pink-600" />Posting Instagram</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">{isLoading ? 'Memuat koneksi…' : error ? 'Status koneksi belum dapat dimuat.' : data?.connected ? `@${data.username}${data.expired ? ' · Izin kedaluwarsa, hubungkan ulang.' : ' · Terhubung'}` : `Belum terhubung. Anda dapat menyiapkan caption pada draft ${contentLabel} terlebih dahulu.`}</p>
        {data && !data.configured && <p className="mt-1 text-sm text-amber-800">Konfigurasi Meta belum tersedia. Koneksi akun dapat dilakukan setelah pengelola server menyiapkannya.</p>}
        <p className="mt-1 text-xs leading-5 text-gray-500">Posting hanya untuk {contentLabel} dengan opsi Instagram aktif saat pertama kali diterbitkan. Antrean dikirim setelah akun terhubung.</p>
        {kind === 'training' && <p className="mt-1 text-xs leading-5 text-gray-500">Akun ini juga digunakan untuk posting artikel. Pelatihan yang sudah selesai atau ditutup tidak dikirim.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!data?.configured || connect.isPending || disconnect.isPending} onClick={() => connect.mutate()}>
          {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{data?.connected ? 'Hubungkan Ulang' : 'Hubungkan Instagram'}
        </Button>
        {data?.connected && <Button variant="outline" disabled={disconnect.isPending || connect.isPending} onClick={() => {
          if (window.confirm('Putuskan koneksi Instagram dan batalkan antrean artikel serta pelatihan yang belum dikirim? Postingan yang sudah terbit tetap tersedia.')) disconnect.mutate();
        }}>Putuskan Koneksi</Button>}
      </div>
    </div>
  </section>;
}

export function InstagramContentFields({ contentId, kind = 'article', imageVersion, hasImage, firstPublished, enabled, caption, title, excerpt, suggestedCaption, onEnabled, onCaption }: {
  contentId?: number; kind?: ContentKind; imageVersion?: string | null; suggestedCaption?: string;
  hasImage: boolean; firstPublished: boolean; enabled: boolean; caption: string; title: string; excerpt: string;
  onEnabled(value: boolean): void; onCaption(value: string): void;
}) {
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState('');
  const contentLabel = kind === 'training' ? 'pelatihan' : 'artikel';
  const imageLabel = kind === 'training' ? 'poster pelatihan' : 'gambar utama';
  const defaultCaption = suggestedCaption ?? [title.trim(), excerpt.trim()].filter(Boolean).join('\n\n');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPreview(''); setPreviewError('');
    if (enabled && contentId && hasImage) {
      void apiRequest('GET', `/api/admin/${kind === 'training' ? 'trainings' : 'articles'}/${contentId}/instagram/preview`)
        .then(response => response.blob()).then(blob => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob); setPreview(objectUrl);
        }).catch(() => { if (active) setPreviewError(`Gambar belum dapat diproses. Periksa ${imageLabel}.`); });
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [enabled, contentId, hasImage, kind, imageVersion]);
  return <section className="space-y-4 rounded-xl border border-pink-200 bg-pink-50/40 p-4">
    <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-pink-600" checked={enabled} onChange={event => onEnabled(event.target.checked)} />
      Posting otomatis ke Instagram saat {contentLabel} pertama kali diterbitkan
    </label>
    {firstPublished && <p className="text-sm leading-6 text-amber-800">Konten ini sudah pernah terbit. Menyimpan perubahan tidak membuat posting Instagram baru. Untuk pengiriman yang gagal, gunakan tombol Coba Lagi pada kartu {contentLabel}.</p>}
    {enabled && <>
      {!hasImage && <p className="text-sm leading-6 text-amber-800">Simpan sebagai draft, unggah {imageLabel}, lalu edit kembali untuk melihat pratinjau dan menerbitkan {contentLabel}.</p>}
      <label className="block text-sm font-medium">Caption Instagram
        <Textarea className="mt-2 bg-white" rows={5} maxLength={2200} value={caption || defaultCaption}
          onChange={event => onCaption(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>{(caption || defaultCaption).length}/2.200 karakter</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => onCaption('')}>{kind === 'training' ? 'Gunakan Data Pelatihan' : 'Gunakan Judul & Ringkasan'}</Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        <p className="border-b px-4 py-3 text-sm font-semibold">Pratinjau Instagram · Satu gambar</p>
        {preview ? <img src={preview} alt="Pratinjau gambar posting Instagram" className="mx-auto aspect-square w-full max-w-sm object-contain" />
          : <p className="p-4 text-sm text-gray-500">{previewError || (hasImage ? 'Menyiapkan gambar…' : kind === 'training' ? 'Poster pelatihan akan ditampilkan di sini.' : 'Gambar utama akan ditampilkan di sini.')}</p>}
        <p className="whitespace-pre-wrap break-words border-t p-4 text-sm leading-6">{caption || defaultCaption || 'Caption akan ditampilkan di sini.'}</p>
      </div>
    </>}
  </section>;
}

export function InstagramPostStatus({ contentId, kind = 'article', post }: { contentId: number; kind?: ContentKind; post?: InstagramPost }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const retry = useMutation({
    mutationFn: () => apiRequest('POST', `/api/admin/${kind === 'training' ? 'trainings' : 'articles'}/${contentId}/instagram/retry`),
    onSuccess: () => client.invalidateQueries({ queryKey: kind === 'training' ? trainingPostsKey : postsKey }),
    onError: () => toast({ title: 'Belum dapat mencoba lagi', description: kind === 'training' ? 'Pastikan akun tujuan semula terhubung, opsi Instagram aktif, dan pendaftaran pelatihan masih dibuka.' : 'Pastikan akun tujuan semula terhubung, artikel terbit, dan opsi Instagram aktif.', variant: 'destructive' }),
  });
  if (!post) return null;
  const labels: Record<string, string> = { pending: 'Menunggu pengiriman', processing: 'Sedang diproses', published: 'Berhasil diposting', failed: 'Gagal dikirim', review: 'Perlu pemeriksaan status', cancelled: 'Dibatalkan' };
  return <div className="mt-3 rounded-lg border border-pink-100 bg-pink-50/50 p-3 text-sm">
    <p className="font-semibold">Instagram: {labels[post.status] ?? post.status}</p>
    {post.error && <p className="mt-1 text-xs leading-5 text-gray-600">{post.error}</p>}
    {post.permalink && <a className="mt-2 inline-block font-medium text-pink-700 underline" href={post.permalink} target="_blank" rel="noopener noreferrer">Lihat Postingan</a>}
    {['failed', 'review', 'cancelled'].includes(post.status) && <Button size="sm" variant="outline" className="mt-2" disabled={retry.isPending} onClick={() => retry.mutate()}>{post.status === 'review' ? 'Periksa Status' : 'Coba Lagi'}</Button>}
  </div>;
}
