"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { AppFooter } from "@/components/layout/app-footer";
import { navItems, SIDEBAR_TRANSITION_MS } from "@/config/nav-items";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, width } = useSidebarState();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
      style={{ width, transition: `width ${SIDEBAR_TRANSITION_MS}ms ease-in-out` }}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border transition-all duration-300",
          collapsed ? "justify-center px-0" : "px-6",
        )}
      >
        {collapsed ? (
          <Logo variant="icon" className="h-9 w-9 shrink-0" iconClassName="h-5 w-5" />
        ) : (
          <Logo showTagline />
        )}
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col overflow-x-hidden overflow-y-auto transition-all duration-300",
          collapsed ? "space-y-1 px-2 py-3" : "space-y-1 p-3",
        )}
      >
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center rounded-lg text-sm font-medium transition-colors duration-200",
                collapsed
                  ? "mx-auto h-10 w-10 justify-center p-0"
                  : "min-h-[44px] gap-3 px-3",
                active
                  ? "bg-sidebar-accent text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
              aria-label={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} label={item.label} side="right" className="w-full">
                {link}
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-sidebar-border transition-all duration-300",
          collapsed ? "px-2 py-3" : "p-3",
        )}
      >
        {!collapsed && (
          <div className="mb-3 px-1">
            <AppFooter />
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn(
            collapsed ? "mx-auto h-10 w-10" : "min-h-[44px] w-full justify-start",
          )}
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="mr-2 h-4 w-4 shrink-0" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
