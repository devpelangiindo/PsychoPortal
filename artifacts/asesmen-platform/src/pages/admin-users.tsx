import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Search, Edit, Key, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userUpdateSchema, passwordResetSchema, type UserUpdateRequest, type PasswordResetRequest } from "@shared/schema";
import { z } from "zod";
import { formatDisplayDateTime } from "@/lib/date-format";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  whatsappNumber: string | null;
  psychologistProfileName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
    queryFn: async ({ queryKey }) => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
      }
      
      const res = await fetch(queryKey[0] as string, {
        headers: {
          'Authorization': `Bearer ${token}`,
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UserUpdateRequest }) => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
      }
      
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Berhasil",
        description: "Data pengguna berhasil diperbarui.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui data pengguna.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
      }
      
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      setIsPasswordDialogOpen(false);
      toast({
        title: "Berhasil",
        description: "Password pengguna berhasil direset.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal mereset password.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user: User) => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Token admin tidak ditemukan. Silakan login ulang.');
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Berhasil",
        description: "User tidak terpakai berhasil dihapus.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Gagal menghapus user",
        description: error.message || "User masih memiliki data terkait atau tidak dapat dihapus.",
        variant: "destructive",
      });
    },
  });

  const editForm = useForm<UserUpdateRequest>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      whatsappNumber: "",
      psychologistProfileName: "",
      isActive: true,
      role: "user",
    },
  });

  const passwordForm = useForm<{ newPassword: string }>({
    resolver: zodResolver(z.object({
      newPassword: z.string().min(6, "Password minimal 6 karakter"),
    })),
    defaultValues: {
      newPassword: "",
    },
  });

  const filteredUsers = users?.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    editForm.reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      whatsappNumber: user.whatsappNumber || "",
      psychologistProfileName: user.psychologistProfileName || "",
      isActive: user.isActive,
      role: user.role as "user" | "admin" | "internal" | "psychologist",
    });
    setIsEditDialogOpen(true);
  };

  const openPasswordDialog = (user: User) => {
    setSelectedUser(user);
    passwordForm.reset({ newPassword: "" });
    setIsPasswordDialogOpen(true);
  };

  const onUpdateUser = (data: UserUpdateRequest) => {
    if (selectedUser) {
      updateUserMutation.mutate({ userId: selectedUser.id, data });
    }
  };

  const onResetPassword = (data: { newPassword: string }) => {
    if (selectedUser) {
      resetPasswordMutation.mutate({ userId: selectedUser.id, newPassword: data.newPassword });
    }
  };

  const onDeleteUser = (user: User) => {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    if (!window.confirm(`Hapus user "${name}"? User hanya dapat dihapus jika belum memiliki order, booking, atau asesmen.`)) return;
    deleteUserMutation.mutate(user);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Belum pernah";
    return formatDisplayDateTime(dateString);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Manajemen Pengguna
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Kelola semua pengguna sistem
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Daftar Pengguna ({filteredUsers.length})</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Cari pengguna..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Login Terakhir</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Tidak ada nama'}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.whatsappNumber || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            user.role === 'admin' 
                              ? 'destructive' 
                              : user.role === 'internal'
                                ? 'default'
                                : user.role === 'psychologist'
                                  ? 'outline'
                                : 'secondary'
                          }
                          className={user.role === 'internal' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                        >
                          {user.role === 'admin' ? 'Admin' : user.role === 'internal' ? 'Internal' : user.role === 'psychologist' ? 'Psikolog' : 'Pengguna'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {user.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(user.lastLoginAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPasswordDialog(user)}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDeleteUser(user)}
                            disabled={deleteUserMutation.isPending}
                            aria-label="Hapus user"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdateUser)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Depan</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nama depan" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Belakang</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nama belakang" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="whatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor WhatsApp</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="08xxxxxxxxxx" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <select {...field} className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md px-3 py-2">
                        <option value="user">Pengguna</option>
                        <option value="admin">Admin</option>
                        <option value="internal">Internal</option>
                        <option value="psychologist">Psikolog</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editForm.watch("role") === "psychologist" && (
                <FormField
                  control={editForm.control}
                  name="psychologistProfileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Profil Psikolog</FormLabel>
                      <FormControl>
                        <select {...field} value={field.value ?? ""} className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md px-3 py-2">
                          <option value="">Pilih nama di layanan booking</option>
                          <option value="Tria Khusni Barokah, M.Psi., Psikolog">Tria Khusni Barokah, M.Psi., Psikolog</option>
                          <option value="Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog">Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog</option>
                          <option value="Retno Rahayu, M.Psi., Psikolog">Retno Rahayu, M.Psi., Psikolog</option>
                          <option value="Ridwan Rahmawan, S.Psi., M.H., Psikolog">Ridwan Rahmawan, S.Psi., M.H., Psikolog</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Status Aktif</FormLabel>
                      <div className="text-sm text-gray-500">
                        Pengguna dapat login dan menggunakan sistem
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onResetPassword)} className="space-y-4">
              <p className="text-sm text-gray-600">
                Reset password untuk: <strong>{selectedUser?.email}</strong>
              </p>
              
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Baru</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Masukkan password baru" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  variant="destructive"
                >
                  {resetPasswordMutation.isPending ? "Mereset..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
