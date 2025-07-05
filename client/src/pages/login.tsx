import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { loginSchema, type LoginRequest } from "@shared/schema";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      const response = await apiRequest('POST', '/api/auth/login', data);
      return response.json();
    },
    onSuccess: (data) => {
      // Store user data and tokens in localStorage
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      toast({
        title: "Login Berhasil!",
        description: `Selamat datang, ${data.user.firstName}!`,
      });
      
      // Redirect to dashboard
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      if (error.message?.includes("belum diverifikasi")) {
        setNeedsVerification(true);
        setUserEmail(form.getValues("email"));
      } else {
        toast({
          title: "Login Gagal",
          description: error.message || "Email atau password salah",
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (data: LoginRequest) => {
    setNeedsVerification(false);
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="border-green-200 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-green-700 dark:text-green-400">
                🧠 Login
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400">
                Masuk ke akun Rumah Psikologi Indonesia
              </p>
            </CardHeader>
            <CardContent>
              {needsVerification && (
                <Alert className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email Anda belum diverifikasi. Silakan{" "}
                    <Button 
                      variant="link" 
                      onClick={() => setLocation('/verify-email')}
                      className="p-0 text-orange-600 hover:text-orange-700 underline"
                    >
                      verifikasi email
                    </Button>{" "}
                    terlebih dahulu.
                  </AlertDescription>
                </Alert>
              )}

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
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input 
                              {...field} 
                              type={showPassword ? "text" : "password"} 
                              placeholder="Masukkan password" 
                              className="pl-10 pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="text-right">
                    <Button 
                      type="button"
                      variant="link" 
                      onClick={() => setLocation('/forgot-password')}
                      className="p-0 text-sm text-green-600 hover:text-green-700"
                    >
                      Lupa password?
                    </Button>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Masuk...
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Atau</span>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Belum punya akun?{" "}
                    <Button 
                      variant="link" 
                      onClick={() => setLocation('/register')}
                      className="p-0 text-green-600 hover:text-green-700"
                    >
                      Daftar di sini
                    </Button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>


        </div>
      </div>
      <Footer />
    </div>
  );
}