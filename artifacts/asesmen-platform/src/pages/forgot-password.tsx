import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Mail, CheckCircle, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid")
});

const resetPasswordSchema = z.object({
  otp: z.string().length(6, "OTP harus 6 digit"),
  newPassword: z.string().min(8, "Password minimal 8 karakter"),
  confirmPassword: z.string().min(8, "Konfirmasi password minimal 8 karakter"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Konfirmasi password tidak sesuai",
  path: ["confirmPassword"],
});

type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

export default function ForgotPassword() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });
  const resetForm = useForm<ResetPasswordRequest>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordRequest) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await apiRequest("POST", "/api/auth/forgot-password", data);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengirim email reset password. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async (data: ResetPasswordRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        email: form.getValues("email"),
        otp: data.otp,
        newPassword: data.newPassword,
      });
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mereset password. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-800">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-200">
              Password Diperbarui
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400">
              Password Anda berhasil diperbarui
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              Silakan kembali ke halaman login dan masuk menggunakan password baru.
            </div>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white">
                <Link to="/login">
                  Kembali ke Login
                </Link>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  setIsSubmitted(false);
                  setOtpSent(false);
                  form.reset();
                  resetForm.reset();
                }}
                className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900"
              >
                Reset Password Lain
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-800">
            <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-200">
            {otpSent ? "Masukkan Kode Reset" : "Lupa Password"}
          </CardTitle>
          <CardDescription className="text-green-600 dark:text-green-400">
            {otpSent
              ? "Masukkan OTP dari email dan password baru Anda"
              : "Masukkan email Anda untuk menerima kode reset password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!otpSent ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-green-700 dark:text-green-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@example.com"
                {...form.register("email")}
                className="border-green-300 focus:border-green-500 focus:ring-green-500"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? "Mengirim..." : "Kirim Email Reset"}
            </Button>
          </form>
          ) : (
          <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Kode OTP telah dikirim ke {form.getValues("email")}. Periksa inbox atau folder spam/junk.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="otp" className="text-green-700 dark:text-green-300">
                Kode OTP
              </Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                {...resetForm.register("otp")}
                className="border-green-300 focus:border-green-500 focus:ring-green-500"
              />
              {resetForm.formState.errors.otp && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {resetForm.formState.errors.otp.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-green-700 dark:text-green-300">
                Password Baru
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Minimal 8 karakter"
                {...resetForm.register("newPassword")}
                className="border-green-300 focus:border-green-500 focus:ring-green-500"
              />
              {resetForm.formState.errors.newPassword && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {resetForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-green-700 dark:text-green-300">
                Konfirmasi Password Baru
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Ulangi password baru"
                {...resetForm.register("confirmPassword")}
                className="border-green-300 focus:border-green-500 focus:ring-green-500"
              />
              {resetForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {resetForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {isLoading ? "Menyimpan..." : "Reset Password"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => form.handleSubmit(onSubmit)()}
              className="w-full border-green-300 text-green-700 hover:bg-green-50"
            >
              Kirim Ulang OTP
            </Button>
          </form>
          )}

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              asChild
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900"
            >
              <Link to="/login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali ke Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
