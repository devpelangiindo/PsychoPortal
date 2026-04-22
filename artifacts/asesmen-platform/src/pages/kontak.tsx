import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Mail, CheckCircle } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

const contactSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  phone: z.string().optional(),
  subject: z.string().min(3, "Subjek minimal 3 karakter"),
  message: z.string().min(10, "Pesan minimal 10 karakter"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function Kontak() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Gagal mengirim pesan");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal mengirim pesan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="gradient-hero py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-[#248f59] mb-4">
              Hubungi Kami
            </h1>
            <p className="text-lg text-neutral-600 dark:text-muted-foreground max-w-2xl mx-auto">
              Ada pertanyaan atau ingin berkonsultasi? Kami siap membantu Anda.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Info */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-foreground mb-6">
                    Informasi Kontak
                  </h2>
                  <div className="space-y-5">
                    <div className="flex items-start space-x-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <MapPin className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-foreground">Cabang Sleman</p>
                        <p className="text-neutral-600 dark:text-muted-foreground text-sm leading-relaxed">
                          Jl. Colombo No. 8, Samirono Baru, Caturtunggal,<br />
                          Depok, Sleman, Yogyakarta, 55281
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <MapPin className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-foreground">Cabang Bantul</p>
                        <p className="text-neutral-600 dark:text-muted-foreground text-sm leading-relaxed">
                          Jl. Mgr. Sugiyo Pranoto No. 14, Melikan Kidul,<br />
                          Bantul, Bantul, Yogyakarta, 55711
                        </p>
                      </div>
                    </div>

                    <a
                      href="https://wa.me/6281991466546"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-4 group"
                    >
                      <div className="w-10 h-10 bg-green-100 group-hover:bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
                        <FaWhatsapp className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-foreground group-hover:text-green-600 transition-colors">
                          WhatsApp – Konsultasi Online
                        </p>
                        <p className="text-neutral-600 dark:text-muted-foreground text-sm">081991466546</p>
                      </div>
                    </a>

                    <a
                      href="https://wa.me/628816502701"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-4 group"
                    >
                      <div className="w-10 h-10 bg-green-100 group-hover:bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
                        <Phone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-foreground group-hover:text-green-600 transition-colors">
                          WhatsApp – Dukungan Teknis
                        </p>
                        <p className="text-neutral-600 dark:text-muted-foreground text-sm">08816502701</p>
                      </div>
                    </a>

                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-foreground">Email</p>
                        <p className="text-neutral-600 dark:text-muted-foreground text-sm">
                          Kirim formulir di samping untuk menghubungi kami via email.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick WhatsApp CTA */}
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <FaWhatsapp className="w-6 h-6 text-green-600" />
                      <h3 className="font-semibold text-green-800 dark:text-green-400">
                        Butuh respons cepat?
                      </h3>
                    </div>
                    <p className="text-green-700 dark:text-green-400 text-sm mb-4">
                      Hubungi kami langsung via WhatsApp untuk mendapatkan respons dalam hitungan menit.
                    </p>
                    <a
                      href="https://wa.me/6281991466546?text=Halo%2C%20saya%20ingin%20bertanya%20tentang%20layanan%20Rumah%20Psikologi%20Pelangi%20Indonesia."
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="bg-green-600 hover:bg-green-700 w-full">
                        <FaWhatsapp className="w-4 h-4 mr-2" />
                        Chat WhatsApp Sekarang
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Form */}
              <div>
                {submitted ? (
                  <Card className="border-green-200">
                    <CardContent className="p-10 text-center">
                      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-neutral-900 dark:text-foreground mb-2">
                        Pesan Terkirim!
                      </h3>
                      <p className="text-neutral-600 dark:text-muted-foreground mb-6">
                        Terima kasih sudah menghubungi kami. Tim kami akan membalas pesan Anda
                        dalam waktu 1×24 jam kerja.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setSubmitted(false)}
                      >
                        Kirim Pesan Lain
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8">
                      <h2 className="text-2xl font-bold text-neutral-900 dark:text-foreground mb-6">
                        Kirim Pesan
                      </h2>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nama Lengkap *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Masukkan nama Anda" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nomor HP / WhatsApp</FormLabel>
                                  <FormControl>
                                    <Input placeholder="08xxxxxxxxxx" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email *</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="email@contoh.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="subject"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Subjek *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Perihal pesan Anda" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="message"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pesan *</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Tuliskan pesan atau pertanyaan Anda di sini..."
                                    className="min-h-[140px] resize-none"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700"
                            disabled={mutation.isPending}
                          >
                            {mutation.isPending ? "Mengirim..." : "Kirim Pesan"}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
