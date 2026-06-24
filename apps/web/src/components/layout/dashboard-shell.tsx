"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AuthGuard } from "@/components/auth-guard";
import { SidebarProvider, useSidebarState } from "@/hooks/use-sidebar-state";
import { SIDEBAR_TRANSITION_MS } from "@/config/nav-items";
import { cn } from "@/lib/utils";

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { width } = useSidebarState();
  const isFullBleed = pathname.startsWith("/inbox");

  return (
    <div
      className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-background"
      style={
        {
          "--sidebar-width": `${width}px`,
          "--layout-transition": `${SIDEBAR_TRANSITION_MS}ms ease-in-out`,
        } as React.CSSProperties
      }
    >
      <Sidebar />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <TopNav onMenuClick={() => setMobileNavOpen(true)} />
      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col lg:pl-[var(--sidebar-width)]",
          isFullBleed ? "overflow-hidden pb-[env(safe-area-inset-bottom)]" : "pb-6",
        )}
        style={{ transition: `padding-left var(--layout-transition)` }}
      >
        <div
          className={cn(
            "min-w-0",
            isFullBleed
              ? "flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden"
              : "container max-w-7xl w-full max-w-full flex-1 px-4 py-4 sm:py-6 md:px-6",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <DashboardShellContent>{children}</DashboardShellContent>
      </SidebarProvider>
    </AuthGuard>
  );
}
