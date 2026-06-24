"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth, ADMIN_API_URL } from "@/lib/admin-auth";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { accessToken, admin, logout } = useAdminAuth();
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!accessToken) router.replace("/");
  }, [accessToken, router]);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${ADMIN_API_URL}/platform-admin/dashboard`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, [accessToken]);

  if (!accessToken) return null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Platform Dashboard</h1>
            <p className="text-slate-400 text-sm">{admin?.email}</p>
          </div>
          <button
            onClick={() => { logout(); router.push("/"); }}
            className="text-sm text-slate-400 hover:text-white"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ["Total Organizations", metrics?.totalOrganizations],
            ["Active Organizations", metrics?.activeOrganizations],
            ["Total Users", metrics?.totalUsers],
            ["Monthly Revenue (BDT)", metrics?.monthlyRevenue],
            ["Active Conversations", metrics?.activeConversations],
            ["Messages This Month", metrics?.messagesThisMonth],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="text-2xl font-bold mt-1">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
