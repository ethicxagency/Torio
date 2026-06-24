import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdminAuth {
  accessToken: string | null;
  admin: { id: string; email: string; name: string } | null;
  setAuth: (token: string, admin: AdminAuth["admin"]) => void;
  logout: () => void;
}

export const useAdminAuth = create<AdminAuth>()(
  persist(
    (set) => ({
      accessToken: null,
      admin: null,
      setAuth: (accessToken, admin) => set({ accessToken, admin }),
      logout: () => set({ accessToken: null, admin: null }),
    }),
    { name: "torio-admin-auth" },
  ),
);

export const ADMIN_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
