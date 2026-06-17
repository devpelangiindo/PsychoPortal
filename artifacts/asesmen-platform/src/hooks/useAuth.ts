import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getAuthToken } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!getAuthToken(), // Only run if we have a token
  });

  // Clear localStorage if we get an unauthorized error
  if (error && error.message?.includes('401')) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    }
  };
}
