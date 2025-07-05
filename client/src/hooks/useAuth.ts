import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!localStorage.getItem('accessToken'), // Only run if we have a token
  });

  // Clear localStorage if we get an unauthorized error
  if (error && error.message?.includes('401')) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  };
}
