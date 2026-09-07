import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, BarChart3, Download, Eye, MousePointerClick, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AnalyticsResponse = {
  days: number;
  startDate: string;
  endDate: string;
  timezone: string;
  summary: {
    pageViews: number; uniqueVisitors: number; sessions: number; contentViews: number;
    ctaClicks: number; checkoutPageViews: number; checkoutVisitors: number; checkoutStarts: number;
    convertedOrders: number; paidOrders: number; revenue: string | number; conversionRate: number;
  };
  daily: Array<{ day: string; pageViews: number; visitors: number; ctaClicks: number }>;
  topContent: Array<{ contentType: string; contentSlug: string; views: number; visitors: number }>;
  topPages: Array<{ path: string; views: number; visitors: number }>;
  sources: Array<{ source: string; sessions: number }>;
  devices: Array<{ device: string; sessions: number }>;
  privacy: { rawRetentionDays: number; visitorRotation: string };
};

const number = new Intl.NumberFormat("id-ID");
const contentLabels: Record<string, string> = {
  "digital-product": "Produk Digital", "physical-product": "Produk Fisik", "psychology-test": "Alat Tes Psikologi",
  therapy: "Terapi", course: "Kursus", training: "Pelatihan", hospitality: "Hospitality", article: "Artikel", assessment: "Asesmen",
};
const deviceLabels: Record<string, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Ponsel", unknown: "Lainnya" };

function prettySlug(value: string) {
  return value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function periodDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`));
}

function Metric({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>{icon}
    </CardHeader>
    <CardContent><div className="text-2xl font-bold text-slate-950">{value}</div><p className="mt-1 text-xs text-slate-500">{detail}</p></CardContent>
  </Card>;
}

export default function AdminWebsiteAnalytics() {
  const [days, setDays] = useState("30");
  const { data, isLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: ["website-analytics", days],
    queryFn: async () => (await apiRequest("GET", `/api/admin/website-analytics?days=${days}`)).json(),
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Tanggal", "Tayangan halaman", "Pengunjung", "Klik CTA"],
      ...data.daily.map((item) => [item.day, item.pageViews, item.visitors, item.ctaClicks]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `analytics-website-${data.startDate}-${data.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const summary = data?.summary;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/admin/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-900"><ArrowLeft className="h-4 w-4" />Dashboard Admin</Link>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-950"><BarChart3 className="h-8 w-8 text-emerald-700" />Analytics Website</h1>
          <p className="mt-2 text-slate-600">Ringkasan trafik publik, minat layanan, CTA, dan konversi pembayaran.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex gap-2">
            <Select value={days} onValueChange={setDays}><SelectTrigger className="w-[150px] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 hari</SelectItem><SelectItem value="30">30 hari</SelectItem><SelectItem value="90">90 hari</SelectItem></SelectContent></Select>
            <Button variant="outline" onClick={exportCsv} disabled={!data}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </div>
          {data && <p className="text-xs font-medium text-slate-600">{periodDate(data.startDate)} – {periodDate(data.endDate)} WIB</p>}
        </div>
      </div>

      {isLoading && <Card><CardContent className="py-12 text-center text-slate-500">Memuat analytics…</CardContent></Card>}
      {error && <Card className="border-red-200"><CardContent className="py-12 text-center text-red-700">Data analytics belum dapat dimuat. Coba login ulang atau muat kembali halaman.</CardContent></Card>}
      {data && summary && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Pengunjung unik" value={number.format(summary.uniqueVisitors)} detail="Estimasi anonim, dirotasi tiap bulan" icon={<Users className="h-5 w-5 text-blue-600" />} />
          <Metric title="Sesi" value={number.format(summary.sessions)} detail={`${number.format(summary.pageViews)} tayangan halaman`} icon={<Eye className="h-5 w-5 text-emerald-600" />} />
          <Metric title="Klik CTA" value={number.format(summary.ctaClicks)} detail={`${number.format(summary.contentViews)} tampilan produk/layanan`} icon={<MousePointerClick className="h-5 w-5 text-violet-600" />} />
        </div>

        <Card>
          <CardHeader><CardTitle>Tren Harian</CardTitle><CardDescription>Tayangan halaman dan estimasi pengunjung unik</CardDescription></CardHeader>
          <CardContent className="h-80">
            {data.daily.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.daily}><defs><linearGradient id="pageViews" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#047857" stopOpacity={0.35}/><stop offset="95%" stopColor="#047857" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day" tick={{fontSize: 12}}/><YAxis allowDecimals={false} tick={{fontSize: 12}}/><Tooltip/><Area type="monotone" dataKey="pageViews" name="Tayangan" stroke="#047857" fill="url(#pageViews)" strokeWidth={2}/><Area type="monotone" dataKey="visitors" name="Pengunjung" stroke="#2563eb" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-500">Data akan tampil setelah ada kunjungan publik.</div>}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Produk & Layanan Terpopuler</CardTitle><CardDescription>Diurutkan berdasarkan tampilan detail</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Konten</TableHead><TableHead className="text-right">Tampilan</TableHead><TableHead className="text-right">Pengunjung</TableHead></TableRow></TableHeader><TableBody>{data.topContent.length ? data.topContent.map((item) => <TableRow key={`${item.contentType}-${item.contentSlug}`}><TableCell><div className="font-medium">{prettySlug(item.contentSlug)}</div><div className="text-xs text-slate-500">{contentLabels[item.contentType] || item.contentType}</div></TableCell><TableCell className="text-right">{number.format(item.views)}</TableCell><TableCell className="text-right">{number.format(item.visitors)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="py-8 text-center text-slate-500">Belum ada data.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
          <Card><CardHeader><CardTitle>Halaman Terpopuler</CardTitle><CardDescription>Halaman publik yang paling sering dibuka</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Path</TableHead><TableHead className="text-right">Tampilan</TableHead><TableHead className="text-right">Pengunjung</TableHead></TableRow></TableHeader><TableBody>{data.topPages.length ? data.topPages.map((item) => <TableRow key={item.path}><TableCell className="max-w-[280px] truncate font-mono text-xs" title={item.path}>{item.path}</TableCell><TableCell className="text-right">{number.format(item.views)}</TableCell><TableCell className="text-right">{number.format(item.visitors)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="py-8 text-center text-slate-500">Belum ada data.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
          <Card><CardHeader><CardTitle>Sumber Trafik</CardTitle></CardHeader><CardContent className="space-y-3">{data.sources.length ? data.sources.map((item) => <div key={item.source} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"><span className="truncate">{item.source}</span><strong>{number.format(item.sessions)} sesi</strong></div>) : <p className="py-6 text-center text-slate-500">Belum ada data.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Perangkat</CardTitle></CardHeader><CardContent className="space-y-3">{data.devices.length ? data.devices.map((item) => <div key={item.device} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"><span>{deviceLabels[item.device] || item.device}</span><strong>{number.format(item.sessions)} sesi</strong></div>) : <p className="py-6 text-center text-slate-500">Belum ada data.</p>}</CardContent></Card>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/70"><CardContent className="py-4 text-sm text-emerald-950"><strong>Privasi:</strong> analytics hanya mencatat interaksi di halaman publik. IP, user-agent, identitas klien, isi asesmen, hasil tes, dan data konseling tidak disimpan. Identitas statistik anonim dirotasi bulanan; event mentah disimpan maksimal {data.privacy.rawRetentionDays} hari.</CardContent></Card>
      </>}
    </div>
  </main>;
}
