import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
  logoUrl?: string | null;
  onboardingStep?: string;
  onboardingCompleted?: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string; name: string | null; emailVerified: boolean } | null;
  organizations: AuthOrganization[];
  currentOrganizationId: string | null;
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: AuthState["user"];
    organizations: AuthOrganization[];
  }) => void;
  setCurrentOrganization: (id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      organizations: [],
      currentOrganizationId: null,
      setAuth: ({ accessToken, refreshToken, user, organizations }) =>
        set({
          accessToken,
          refreshToken,
          user,
          organizations,
          currentOrganizationId: organizations[0]?.id ?? null,
        }),
      setCurrentOrganization: (id) => set({ currentOrganizationId: id }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          organizations: [],
          currentOrganizationId: null,
        }),
    }),
    { name: "torio-auth" },
  ),
);
