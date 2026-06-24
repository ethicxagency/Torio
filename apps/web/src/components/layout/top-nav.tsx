"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/config/branding";
import { Bell, Moon, Sun, LogOut, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface TopNavProps {
  onMenuClick?: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const { user, organizations, currentOrganizationId, setCurrentOrganization, logout, accessToken, refreshToken } =
    useAuthStore();
  const router = useRouter();

  const currentOrg = organizations.find((o) => o.id === currentOrganizationId);

  async function handleLogout() {
    if (accessToken) {
      await api("/auth/logout", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    logout();
    router.push("/auth/login");
  }

  return (
    <header
      className="sticky top-0 z-40 flex h-16 min-w-0 shrink-0 items-center gap-1.5 overflow-hidden border-b bg-background/80 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:gap-2 sm:px-4 md:px-6 lg:pl-[var(--sidebar-width)]"
      style={{ transition: "padding-left var(--layout-transition)" }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Link href="/dashboard" className="flex min-w-0 shrink items-center gap-2 lg:hidden">
        <Logo variant="icon" className="h-8 w-8 shrink-0" iconClassName="h-4 w-4" />
        <span className="hidden truncate text-sm font-semibold min-[375px]:inline">{BRAND.name}</span>
      </Link>

      <div className="min-w-0 flex-1 lg:hidden" />

      <div className="hidden flex-1 lg:block" />

      {organizations.length > 1 ? (
        <Select
          className="h-10 w-full max-w-[88px] shrink-0 text-xs sm:max-w-[140px] sm:text-sm md:max-w-[180px]"
          value={currentOrganizationId ?? ""}
          onChange={(e) => setCurrentOrganization(e.target.value)}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>
      ) : (
        currentOrg && (
          <span className="hidden max-w-[72px] shrink-0 truncate rounded-full border bg-muted/50 px-2 py-1 text-xs font-medium min-[375px]:inline-block sm:max-w-[140px] md:max-w-none md:px-3 md:py-1.5">
            {currentOrg.name}
          </span>
        )
      )}

      <div className="flex shrink-0 items-center gap-0 sm:gap-0.5">
        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-0.5 border-l pl-1 sm:gap-1 sm:pl-2 md:pl-3">
          <Avatar name={user?.name ?? user?.email} size="sm" className="hidden sm:flex" />
          <div className="hidden min-w-0 text-right lg:block">
            <p className="truncate text-sm font-medium leading-none">{user?.name ?? user?.email}</p>
            <p className="mt-1 truncate text-xs capitalize text-muted-foreground">{currentOrg?.role?.toLowerCase()}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
