import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDateTime } from "@/lib/date-format";
import { bookingPaymentLabel, canRegisterReconciliation, paymentMethodLabel, type PaymentOrder } from "./booking-payment-state";

type ReviewOrder = PaymentOrder & { clientName?: string; email?: string; createdAt?: string; bookings?: { preferredDate?: string; preferredTime?: string; psychologistName?: string | null }[] };
type Candidate = ReviewOrder & { orderId?: number; replacementOrderId: number; matches: boolean; issues: string[]; alreadyLinked: boolean };
type CandidateResponse = { sourceOrder: ReviewOrder; candidates: Candidate[]; reviewReason?: string | null };
type Preview = { eligible: boolean; alreadyApplied: boolean; issues: string[]; sourceOrder: ReviewOrder; replacementOrder: ReviewOrder; provider: { verified: boolean; paymentId?: string; amount?: number; settlementTime?: string; transactionStatus?: string } };

const issueLabels: Record<string, string> = {
  different_client_account: "Kedua pesanan dimiliki akun klien yang berbeda.",
  booking_client_account_mismatch: "Akun klien pada booking tidak sesuai dengan pesanan.",
  amount_mismatch: "Nominal kedua pesanan berbeda.",
  counseling_bookings_required: "Kedua pesanan harus memiliki booking konseling.",
  session_count_mismatch: "Jumlah sesi pada kedua pesanan berbeda.",
  session_details_mismatch: "Psikolog, tanggal, jam, atau lokasi sesi berbeda.",
  incomplete_session_details: "Detail sesi belum lengkap.",
  source_provider_payment_required: "Pesanan asal harus berasal dari pembayaran provider.",
  manual_replacement_required: "Pesanan layanan harus merupakan booking manual.",
  replacement_has_separate_provider_payment: "Pesanan layanan memiliki pembayaran provider terpisah.",
  replacement_chain_or_conflicting_link: "Pesanan sudah memiliki hubungan pengganti yang berbeda.",
  source_not_verified_paid: "Pembayaran pesanan asal belum terverifikasi lunas.",
  source_has_multiple_provider_payments: "Terdapat lebih dari satu pembayaran provider. Periksa seluruh penerimaan dana sebelum menghubungkan pesanan.",
  unregistered_source_payment: "Transaksi pembayaran asal belum tercatat dengan benar.",
  provider_amount_mismatch: "Nominal provider berbeda dengan nominal pesanan.",
  provider_settlement_time_required: "Waktu pembayaran provider belum tersedia.",
  provider_verification_unavailable: "Provider belum dapat dihubungi untuk memverifikasi pembayaran.",
  another_booking_occupies_slot: "Jadwal telah dipakai booking lain; perlu peninjauan penjadwalan.",
  session_changed_retry_preview: "Jadwal berubah. Ulangi tinjauan sebelum melanjutkan.",
};

function issueText(issue: string) { return issueLabels[issue] || issue; }

function errorText(error: unknown) {
  const raw = error instanceof Error ? error.message : "Permintaan belum berhasil. Silakan coba lagi.";
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const value = JSON.parse(raw.slice(jsonStart)) as { message?: string; issues?: string[] };
      return value.issues?.length ? value.issues.map(issueText).join(" ") : value.message || raw;
    } catch { /* Use the original error when it is not JSON. */ }
  }
  return raw;
}

function OrderSummary({ title, order }: { title: string; order: ReviewOrder }) {
  return <div className="rounded-lg border p-3 text-sm">
    <p className="font-semibold">{title} #{order.id}</p>
    <p>{order.clientName || order.email || ""}</p>
    <p className="mt-1">{bookingPaymentLabel(order.status, order)} · Rp {Number(order.totalAmount || 0).toLocaleString("id-ID")}</p>
    <p className="text-neutral-600">{paymentMethodLabel(order.paymentMethod)} · {order.paymentId || "ID pembayaran belum tersedia"}</p>
    <p className="text-neutral-600">{order.paymentMethod === "manual_offline" ? "Waktu pencatatan pembayaran" : "Waktu bayar"}: {order.paidAt ? formatDisplayDateTime(order.paidAt) : "belum terkonfirmasi"}</p>
    {order.bookings?.map((booking, index) => <p key={index} className="mt-1">{booking.psychologistName} · {booking.preferredDate} · {booking.preferredTime}</p>)}
  </div>;
}

export default function BookingReconciliation({ initialOrderId }: { initialOrderId?: number | null }) {
  const queryClient = useQueryClient();
  const [orderInput, setOrderInput] = useState("");
  const [sourceOrderId, setSourceOrderId] = useState<number | null>(null);
  const [replacementOrderId, setReplacementOrderId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!initialOrderId) return;
    setOrderInput(String(initialOrderId));
    setSourceOrderId(initialOrderId);
    setReplacementOrderId(null);
    setReason("");
    setNotice("");
  }, [initialOrderId]);
  const candidates = useQuery<CandidateResponse>({
    queryKey: ["/api/admin/booking-reconciliation/candidates", sourceOrderId],
    queryFn: async () => (await apiRequest("GET", `/api/admin/booking-reconciliation/candidates?orderId=${sourceOrderId}`)).json(),
    enabled: Boolean(sourceOrderId),
    staleTime: 0,
    retry: false,
  });
  const preview = useMutation<Preview>({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/booking-reconciliation/preview", { sourceOrderId, replacementOrderId })).json(),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/psychologist/bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-reconciliation/candidates"] }),
    ]);
  };
  const verify = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/booking-reconciliation/verify/${sourceOrderId}`, {})).json(),
    onSuccess: async () => { setNotice("Pemeriksaan provider selesai. Periksa status pesanan dan kandidat di bawah."); preview.reset(); await refresh(); },
  });
  const apply = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/booking-reconciliation/apply", { sourceOrderId, replacementOrderId, reason: reason.trim() })).json(),
    onSuccess: async () => { setNotice("Pesanan berhasil dihubungkan. Pembayaran tercatat pada pesanan asal dan jadwal pada booking pengganti."); preview.reset(); setReplacementOrderId(null); setReason(""); await refresh(); },
  });
  const register = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/booking-reconciliation/register", { sourceOrderId, replacementOrderId, reason: reason.trim() })).json(),
    onSuccess: async (result: { message?: string; alreadyApplied?: boolean }) => {
      setNotice(result.alreadyApplied ? "Pasangan pesanan sudah terhubung." : "Pasangan pesanan dicatat untuk verifikasi otomatis. Pembayaran belum dinyatakan lunas sampai bukti provider terverifikasi.");
      preview.reset(); await refresh();
    },
  });
  const recover = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/manual-counseling-bookings", { sourceOrderId })).json(),
    onSuccess: async (result: { message?: string }) => {
      setNotice(result.message || "Pesanan asal telah diperiksa. Booking yang sudah ada digunakan untuk memulihkan layanan; periksa status jadwal di bawah.");
      preview.reset(); await refresh();
    },
  });
  const inspect = () => {
    const id = Number(orderInput);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    setSourceOrderId(id); setReplacementOrderId(null); setNotice(""); preview.reset(); apply.reset(); verify.reset(); register.reset(); recover.reset();
    if (id === sourceOrderId) void candidates.refetch();
  };
  const orders = candidates.data?.candidates ?? [];
  const pending = candidates.isFetching || verify.isPending || preview.isPending || apply.isPending || register.isPending || recover.isPending;
  return <Card id="booking-reconciliation" className="mt-8">
    <CardHeader><CardTitle>Periksa pembayaran dan booking pengganti</CardTitle><CardDescription>Cari pesanan website yang bermasalah, periksa pembayaran Midtrans, lalu hubungkan booking manual yang sudah dibuat untuk sesi yang sama.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><div><Label htmlFor="reconcile-source-order">Nomor pesanan website asal</Label><Input id="reconcile-source-order" type="number" min="1" value={orderInput} onChange={(event) => setOrderInput(event.target.value)} placeholder="Contoh: 116" /></div><Button onClick={inspect} disabled={pending || !/^[1-9]\d*$/.test(orderInput)}>Periksa pesanan</Button>{sourceOrderId && <Button variant="outline" onClick={() => verify.mutate()} disabled={pending}>Periksa ke Midtrans</Button>}</div>
      {notice && <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {pending && <p role="status" className="text-sm text-neutral-600">Sedang memeriksa data...</p>}
      {[candidates.error, verify.error, preview.error, apply.error, register.error, recover.error].filter(Boolean).map((error, index) => <p key={index} role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{errorText(error)}</p>)}
      {candidates.data && <>
        <OrderSummary title="Pesanan pembayaran asal" order={candidates.data.sourceOrder} />
        {candidates.data.reviewReason && <p className="text-sm text-amber-800">{candidates.data.reviewReason}</p>}
        {orders.length ? <div className="space-y-3"><Label>Booking manual pada akun klien yang sama</Label>{orders.map((order) => <label key={order.replacementOrderId} className="flex gap-3 rounded-lg border p-3"><input type="radio" name="reconcile-replacement" checked={replacementOrderId === order.replacementOrderId} onChange={() => { setReplacementOrderId(order.replacementOrderId); preview.reset(); apply.reset(); register.reset(); setReason(""); }} disabled={pending} /><div className="min-w-0 flex-1"><OrderSummary title="Pesanan layanan" order={order} /><p className={`mt-2 text-sm ${order.matches ? "text-green-800" : "text-amber-800"}`}>{order.matches ? "Data klien dan sesi sesuai; pembayaran masih perlu diverifikasi." : order.issues.map(issueText).join(" ")}{order.alreadyLinked ? " Pasangan telah dicatat sebelumnya." : ""}</p></div></label>)}<Button variant="outline" disabled={pending || !replacementOrderId} onClick={() => preview.mutate()}>Tinjau penggabungan</Button></div> : <p className="text-sm text-neutral-600">Tidak ditemukan kandidat booking manual. Pastikan nomor pesanan dan detail sesi benar.</p>}
        {!candidates.data.sourceOrder.replacedByOrderId && <div className="space-y-2"><Button variant="outline" disabled={pending} onClick={() => recover.mutate()}>Pulihkan booking asli</Button><p className="text-sm text-neutral-600">Memverifikasi pembayaran dan memakai data booking yang sudah tersimpan. Jika jadwal berbenturan, pembayaran tetap dicatat dan jadwal ditinjau tim layanan.</p></div>}
      </>}
      {preview.data && preview.data.sourceOrder.id === sourceOrderId && preview.data.replacementOrder.id === replacementOrderId && <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="font-semibold">Tinjauan sebelum dihubungkan</p><div className="grid gap-3 md:grid-cols-2"><OrderSummary title="Pembayaran tetap pada" order={preview.data.sourceOrder} /><OrderSummary title="Sesi dilayani melalui" order={preview.data.replacementOrder} /></div>
        <p className="text-sm">Tindakan ini menghubungkan dua pesanan untuk satu layanan. Tidak membuat pembayaran baru. Pastikan klien, psikolog, tanggal, jam, dan nominal cocok.</p>
        {preview.data.provider.verified && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800"><p>Pembayaran provider terverifikasi: {preview.data.provider.paymentId}</p><p>Nominal: Rp {Number(preview.data.provider.amount || 0).toLocaleString("id-ID")} · Waktu bayar: {formatDisplayDateTime(preview.data.provider.settlementTime)}</p></div>}
        {preview.data.issues.map((issue, index) => <p key={index} role="alert" className="text-sm text-red-800">{issueText(issue)}</p>)}
        <Label htmlFor="reconcile-reason">Alasan penghubungan (10–2000 karakter)</Label><Textarea id="reconcile-reason" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contoh: Booking manual dibuat setelah pembayaran website tidak masuk jadwal; bukti pembayaran telah diperiksa." />
        <div className="flex flex-wrap gap-3"><Button disabled={!preview.data.eligible || preview.data.alreadyApplied || reason.trim().length < 10 || pending} onClick={() => apply.mutate()}>Hubungkan pembayaran dan booking</Button><Button variant="outline" disabled={!canRegisterReconciliation(preview.data.issues, preview.data.alreadyApplied) || reason.trim().length < 10 || pending} onClick={() => register.mutate()}>Catat pasangan untuk verifikasi otomatis</Button></div>
        <p className="text-sm text-neutral-700">Pencatatan pasangan hanya menyimpan hubungan untuk diperiksa otomatis saat bukti pembayaran tersedia. Data pembayaran dan jadwal belum berubah menjadi lunas atau terkonfirmasi.</p>
      </div>}
    </CardContent>
  </Card>;
}
