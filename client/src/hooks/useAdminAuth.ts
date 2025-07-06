import { useQuery } from "@tanstack/react-query";

export function useAdminAuth() {
  const token = localStorage.getItem('accessToken');
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!token, // Only run query if token exists
  });

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
  };
}