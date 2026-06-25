"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBrandHeader } from "@/components/brand/auth-brand-header";
import { BRAND } from "@/config/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; name: string | null; emailVerified: boolean };
        organizations: { id: string; name: string; slug: string; role: string; onboardingCompleted?: boolean }[];
      }>("/auth/login", { method: "POST", body: JSON.stringify(data) });

      setAuth({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
        organizations: res.organizations,
      });

      const org = res.organizations[0];
      if (org && !org.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  }

  return (
    <div className="auth-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AuthBrandHeader
          title={BRAND.auth.loginTitle}
          subtitle={BRAND.auth.loginSubtitle}
        />

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{BRAND.auth.loginTitle}</CardTitle>
            <CardDescription>{BRAND.auth.loginSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@business.com" {...register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
              </div>
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full min-h-[44px]" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login"}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full min-h-[44px]" disabled>
              Continue with Google
            </Button>

            <div className="mt-6 flex flex-col gap-3 text-center text-sm">
              <Link href="/register" className="inline-flex min-h-[44px] items-center justify-center font-medium text-primary hover:underline">
                Create Account
              </Link>
              <Link href="/forgot-password" className="inline-flex min-h-[44px] items-center justify-center text-muted-foreground hover:text-foreground hover:underline">
                Forgot Password
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
