"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { AuthBrandHeader } from "@/components/brand/auth-brand-header";
import { BRAND } from "@/config/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const STEPS = [
  "Business Information",
  "Connect Channels",
  "Knowledge Base",
  "Invite Team",
  "Complete",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken, currentOrganizationId } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const businessForm = useForm({
    defaultValues: { name: "", industry: "", website: "", facebookPage: "" },
  });

  const knowledgeForm = useForm({
    defaultValues: {
      faq: "",
      shipping: "",
      returns: "",
    },
  });

  async function submitBusiness(data: Record<string, string>) {
    setLoading(true);
    try {
      await api("/onboarding/business-info", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify(data),
      });
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  async function completeChannels() {
    setLoading(true);
    try {
      await api("/onboarding/channels/complete", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
      });
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  async function submitKnowledge(data: Record<string, string>) {
    setLoading(true);
    try {
      await api("/onboarding/knowledge", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({
          items: [
            { title: "FAQ", content: data.faq },
            { title: "Shipping Policy", content: data.shipping },
            { title: "Return Policy", content: data.returns },
          ].filter((i) => i.content.trim()),
        }),
      });
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  async function finishOnboarding() {
    setLoading(true);
    try {
      await api("/onboarding/complete", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
      });
      setStep(4);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <div className="auth-gradient min-h-screen px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-8">
          <AuthBrandHeader
            title={BRAND.onboarding.welcome}
            subtitle={BRAND.onboarding.subtitle}
          />

          <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {step + 1} of {STEPS.length}</span>
              <span>{STEPS[step]}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-center gap-2 sm:justify-between">
              {STEPS.map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium sm:h-auto sm:w-auto sm:max-w-[5rem] sm:truncate sm:rounded-none sm:bg-transparent sm:text-[10px]",
                    i <= step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    i === step && "ring-2 ring-primary ring-offset-2 sm:bg-transparent sm:ring-0 sm:ring-offset-0",
                  )}
                  title={label}
                >
                  <span className="sm:hidden">{i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              ))}
            </div>
          </div>

          {step === 0 && (
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Business Information</CardTitle>
                <CardDescription>Tell us about your eCommerce business</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={businessForm.handleSubmit(submitBusiness)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input {...businessForm.register("name", { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input placeholder="e.g. Fashion, Electronics" {...businessForm.register("industry")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input placeholder="https://" {...businessForm.register("website")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Facebook Page</Label>
                    <Input placeholder="facebook.com/yourpage" {...businessForm.register("facebookPage")} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    Continue
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">{BRAND.onboarding.channelsTitle}</CardTitle>
                <CardDescription>{BRAND.onboarding.channelsDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Channel OAuth integrations are configured in Settings → Channels after onboarding.
                  You can connect them now or skip and connect later.
                </div>
                <Button onClick={completeChannels} disabled={loading} className="w-full">
                  Continue (connect later in Settings)
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Knowledge Base</CardTitle>
                <CardDescription>Help AI answer customer questions in Bangla & English</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={knowledgeForm.handleSubmit(submitKnowledge)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>FAQ</Label>
                    <Textarea {...knowledgeForm.register("faq")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping Policy</Label>
                    <Textarea {...knowledgeForm.register("shipping")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Return Policy</Label>
                    <Textarea {...knowledgeForm.register("returns")} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    Continue
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Invite Team</CardTitle>
                <CardDescription>Collaborate with agents and admins</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Invite team members from Settings → Team after setup.
                </div>
                <Button onClick={finishOnboarding} disabled={loading} className="w-full">
                  Finish Setup
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-0 shadow-xl">
              <CardContent className="space-y-6 pt-8 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
                <div>
                  <h2 className="text-xl font-bold">{BRAND.onboarding.completeTitle}</h2>
                  <p className="mt-2 text-muted-foreground">{BRAND.onboarding.completeDescription}</p>
                </div>
                <Button onClick={() => router.push("/dashboard")} className="w-full">
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
