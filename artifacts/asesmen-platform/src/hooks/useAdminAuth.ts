import { useQuery } from "@tanstack/react-query";

export function useAdminAuth() {
  const token = localStorage.getItem('adminToken');
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!token, // Only run query if token exists
    queryFn: async ({ queryKey }) => {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
      }
      
      const res = await fetch(queryKey[0] as string, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
        }
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      return await res.json();
    },
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