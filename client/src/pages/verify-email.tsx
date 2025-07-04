import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { otpVerificationSchema, type OtpVerificationRequest } from "@shared/schema";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);

  const form = useForm<OtpVerificationRequest>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: {
      email: "",
      otp: ""
    }
  });

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const verifyMutation = useMutation({
    mutationFn: async (data: OtpVerificationRequest) => {
      return await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data) => {
      // Store user data and tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      toast({
        title: "Email Berhasil Diverifikasi!",
        description: `Selamat datang, ${data.user.firstName}!`,
      });
      
      // Redirect to dashboard
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: "Verifikasi Gagal",
        description: error.message || "Kode OTP tidak valid atau sudah kadaluarsa",
        variant: "destructive"
      });
    }
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    },
    onSuccess: () => {
      toast({
        title: "OTP Baru Terkirim",
        description: "Silakan cek email Anda untuk kode OTP yang baru.",
      });
      setCountdown(60); // 60 seconds cooldown
      setCanResend(false);
    },
    onError: (error: any) => {
      toast({
        title: "Gagal Mengirim OTP",
        description: error.message || "Terjadi kesalahan saat mengirim OTP",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: OtpVerificationRequest) => {
    verifyMutation.mutate(data);
  };

  const handleResendOtp = () => {
    const email = form.getValues("email");
    if (!email) {
      toast({
        title: "Email Diperlukan",
        description: "Silakan masukkan email terlebih dahulu",
        variant: "destructive"
      });
      return;
    }
    resendMutation.mutate(email);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="border-green-200 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-700 dark:text-green-400">
                Verifikasi Email
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400">
                Masukkan kode OTP yang telah dikirim ke email Anda
              </p>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Kode OTP berlaku selama 10 menit. Jika tidak menerima email, 
                  periksa folder spam atau kirim ulang kode.
                </AlertDescription>
              </Alert>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input {...field} type="email" placeholder="email@example.com" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kode OTP</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="123456" 
                            className="text-center text-lg tracking-widest"
                            maxLength={6}
                            onChange={(e) => {
                              // Only allow numbers
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-gray-500 text-center">
                          Masukkan 6 digit kode OTP
                        </p>
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memverifikasi...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Verifikasi Email
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Tidak menerima kode OTP?
                  </p>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleResendOtp}
                    disabled={!canResend || resendMutation.isPending}
                    className="w-full"
                  >
                    {resendMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mengirim...
                      </>
                    ) : !canResend ? (
                      <>
                        <Clock className="mr-2 h-4 w-4" />
                        Kirim ulang dalam {countdown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Kirim Ulang OTP
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Kembali ke{" "}
                    <Button 
                      variant="link" 
                      onClick={() => setLocation('/login')}
                      className="p-0 text-green-600 hover:text-green-700"
                    >
                      halaman login
                    </Button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="mt-6 border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                💡 Tips Verifikasi Email
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li>• Periksa folder inbox dan spam/junk email</li>
                <li>• Pastikan email address sudah benar</li>
                <li>• Kode OTP berlaku selama 10 menit</li>
                <li>• Hanya dapat menggunakan kode OTP yang terbaru</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}