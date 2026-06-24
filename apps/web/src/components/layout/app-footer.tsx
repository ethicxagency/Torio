import { BRAND } from "@/config/branding";

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer className={className}>
      <p className="text-xs text-muted-foreground">{BRAND.footer}</p>
      <p className="mt-1 text-xs text-muted-foreground">{BRAND.poweredBy}</p>
    </footer>
  );
}
