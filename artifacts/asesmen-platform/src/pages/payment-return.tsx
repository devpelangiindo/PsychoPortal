import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Loader2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BookingPaymentNotice, hasConfirmedPayment, needsPaymentReview, type PaymentOrder } from "@/components/booking-payment-state";

type PaymentResult = PaymentOrder & { orderId: number };
type ReturnState = "loading" | "success" | "pending" | "inactive" | "unverified";
const transientReviewReasons = new Set(["verification_pending", "payment_initializing", "initialization_uncertain", "fulfillment_pending"]);

export default function PaymentReturn() {
  const [, setLocation] = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<ReturnState>("loading");
  const [orderData, setOrderData] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let latest: PaymentResult | null = null;
    setError("");
    setChecking(false);
    if (!isAuthenticated) {
      setPaymentStatus("unverified");
      setError("Masuk ke akun yang membuat pesanan untuk memeriksa pembayaran.");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("external_id") || params.get("order_id") || params.get("transaction_order_id");
    const directId = params.get("orderId");
    const match = paymentId ? /^order_(\d+)_\d+$/.exec(paymentId) : null;
    const orderId = Number(match?.[1] || (/^\d+$/.test(directId || "") ? directId : /^\d+$/.test(paymentId || "") ? paymentId : 0));
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setPaymentStatus("unverified");
      setError("Nomor pesanan tidak tersedia pada tautan pembayaran. Buka riwayat pesanan di dashboard.");
      return;
    }

    const check = async () => {
      if (!active) return;
      attempt++;
      setChecking(true);
      let providerChecked = false;
      try {
        try {
          const sync = await apiRequest("POST", `/api/midtrans/sync-status/${orderId}`, {});
          const result = await sync.json() as { valid?: boolean; failed?: boolean };
          providerChecked = result.valid !== false && result.failed !== true;
        } catch {
          // A saved successful payment can still be shown if the provider is temporarily unavailable.
        }
        if (!active) return;
        const response = await apiRequest("GET", `/api/payment-status/${orderId}`);
        const payment = await response.json() as PaymentResult;
        if (!active) return;
        payment.id = payment.id || payment.orderId;
        latest = payment;
        setOrderData(payment);
        const financialReview = [payment.paymentReviewReason, payment.paymentSourceOrder?.paymentReviewReason]
          .some((reason) => reason === "payment_reversal_review" || reason === "payment_status_conflict");
        if (financialReview) {
          setPaymentStatus("unverified");
          setError("Pembayaran sebelumnya tercatat diterima, tetapi status transaksi terbaru memerlukan pemeriksaan tim layanan. Hubungi CSO dengan nomor pesanan dan bukti pembayaran Anda.");
          setChecking(false);
          return;
        }
        const transientReview = transientReviewReasons.has(payment.paymentReviewReason ?? "");
        if (hasConfirmedPayment(payment)) {
          setPaymentStatus("success");
          setError("");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/user-assessments"] }),
          ]);
          if (!transientReview) {
            setChecking(false);
            return;
          }
        } else if ((needsPaymentReview(payment) && !transientReview) || payment.status === "schedule_review") {
          setPaymentStatus("unverified");
          setError("Pembayaran sedang diperiksa oleh tim layanan. Simpan bukti pembayaran dan nomor pesanan ini.");
          setChecking(false);
          return;
        } else if (providerChecked && ["expired", "cancelled", "failed"].includes(payment.paymentStatus || "")) {
          setPaymentStatus("inactive");
          setChecking(false);
          return;
        } else {
          setPaymentStatus("pending");
        }
      } catch {
        if (!active) return;
        if (latest && hasConfirmedPayment(latest)) {
          setPaymentStatus("success");
          setError("");
        } else {
          setPaymentStatus("unverified");
          setError("Status belum dapat diverifikasi karena pemeriksaan belum berhasil. Ini tidak berarti pembayaran dibatalkan.");
        }
      }
      if (!active) return;
      if (attempt < 6) timer = setTimeout(() => { void check(); }, 3000);
      else {
        setChecking(false);
        if (!latest || latest.status === "cancelled") {
          setPaymentStatus("unverified");
          setError("Status akhir belum dapat dipastikan. Jika sudah membayar, hubungi tim layanan dengan bukti pembayaran dan nomor pesanan ini.");
        }
      }
    };
    void check();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [authLoading, isAuthenticated, retryKey]);

  const success = paymentStatus === "success";
  const title = success ? "Pembayaran terkonfirmasi" : paymentStatus === "loading" ? "Memverifikasi pembayaran" : paymentStatus === "pending" ? "Menunggu konfirmasi pembayaran" : paymentStatus === "inactive" ? "Pembayaran tidak aktif" : "Status perlu diperiksa";
  return <div className="min-h-screen bg-neutral-50 dark:bg-background">
    <Header />
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-3xl font-bold">Status Pembayaran</h1>
      <Card className="mx-auto max-w-md">
        <CardHeader><CardTitle className={`flex items-center justify-center gap-2 ${success ? "text-green-700" : "text-amber-800"}`}>
          {success ? <CheckCircle /> : checking ? <Loader2 className="animate-spin" /> : paymentStatus === "pending" ? <Clock /> : <AlertCircle />}{title}
        </CardTitle></CardHeader>
        <CardContent className="space-y-4 text-center">
          {success ? <p>Pembayaran Anda sudah tercatat. Buka dashboard untuk melihat resi dan status layanan.</p> : paymentStatus === "inactive" ? <p>Pemeriksaan terakhir menunjukkan pembayaran tidak aktif. Jika dana sudah terpotong, hubungi tim layanan dengan bukti pembayaran sebelum membuat pembayaran baru.</p> : <p>{error || "Pembayaran mungkin masih diproses. Status diperiksa otomatis beberapa kali."}</p>}
          {orderData && <div className="rounded-lg bg-neutral-100 p-4 text-sm dark:bg-neutral-900"><p>Pesanan <strong>#{orderData.orderId}</strong></p><p>Rp {Number(orderData.totalAmount || 0).toLocaleString("id-ID")}</p><BookingPaymentNotice order={orderData} /></div>}
          {checking && <p role="status" className="text-sm text-neutral-600">Pemeriksaan otomatis sedang berjalan...</p>}
          {!success && <Button variant="outline" className="w-full" disabled={checking} onClick={() => { setPaymentStatus("loading"); setRetryKey((value) => value + 1); }}>Periksa kembali</Button>}
          <Button className="w-full" onClick={() => setLocation(isAuthenticated ? "/dashboard" : "/login")}>{isAuthenticated ? "Buka dashboard" : "Masuk ke akun"}</Button>
        </CardContent>
      </Card>
    </main>
    <Footer />
  </div>;
}
