import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { adminLoginSchema, type AdminLoginRequest } from "@shared/schema";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<AdminLoginRequest>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: AdminLoginRequest) => {
      const response = await apiRequest("POST", "/api/admin/login", data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log('Admin login success:', data);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Debug: Verify token was stored
      const storedToken = localStorage.getItem('accessToken');
      console.log('Token stored:', storedToken ? 'SUCCESS' : 'FAILED');
      
      // Clear React Query cache to ensure fresh data
      queryClient.clear();
      
      toast({
        title: "Berhasil!",
        description: "Login admin berhasil.",
      });
      
      // Add a small delay to ensure token is stored before navigation
      setTimeout(() => {
        setLocation("/admin/dashboard");
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Login gagal. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AdminLoginRequest) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src={logoPath} 
                alt="Rumah Psikologi Pelangi Indonesia" 
                className="h-16 w-16 object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-200">
              Admin Login
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400">
              Masuk ke panel administrator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Admin</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="admin@example.com"
                          className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                        />
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
                        <Input
                          {...field}
                          type="password"
                          placeholder="Masukkan password admin"
                          className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                >
                  {loginMutation.isPending ? "Memproses..." : "Masuk"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center">
              <Link href="/" className="text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">
                ← Kembali ke Beranda
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}