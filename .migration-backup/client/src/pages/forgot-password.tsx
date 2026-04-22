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
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid")
});

type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  const onSubmit = async (data: ForgotPasswordRequest) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // For now, we'll just simulate the functionality
      // In a real implementation, this would send a password reset email
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsSubmitted(true);
    } catch (err) {
      setError("Terjadi kesalahan saat mengirim email reset password. Silakan coba lagi.");
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
              Email Terkirim
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400">
              Kami telah mengirim instruksi reset password ke email Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              Periksa kotak masuk email Anda dan ikuti petunjuk untuk mengatur password baru.
              Jika tidak ada email, periksa folder spam/junk.
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
                  form.reset();
                }}
                className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900"
              >
                Kirim Ulang Email
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
            Lupa Password
          </CardTitle>
          <CardDescription className="text-green-600 dark:text-green-400">
            Masukkan email Anda untuk menerima instruksi reset password
          </CardDescription>
        </CardHeader>
        <CardContent>
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