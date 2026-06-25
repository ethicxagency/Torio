"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    router.replace(accessToken ? "/dashboard" : "/login");
  }, [accessToken, ready, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading Torio...</p>
    </div>
  );
}
