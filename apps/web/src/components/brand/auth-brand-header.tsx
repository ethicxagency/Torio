import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/config/branding";

interface AuthBrandHeaderProps {
  title: string;
  subtitle?: string;
}

export function AuthBrandHeader({ title, subtitle }: AuthBrandHeaderProps) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-4 flex justify-center">
        <Logo variant="icon" className="h-14 w-14 rounded-2xl shadow-lg" iconClassName="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function AuthBrandName() {
  return <span>{BRAND.name}</span>;
}
