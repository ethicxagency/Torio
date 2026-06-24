"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, Save, Shield, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PolicyTab = "shipping" | "payment" | "return" | "refund" | "exchange" | "cancellation";

interface PolicyStatus {
  status: "DRAFT" | "PUBLISHED";
}

interface ShippingPolicy extends PolicyStatus {
  deliveryAreas?: string | null;
  deliveryTime?: string | null;
  deliveryCharge?: string | null;
  internationalShipping?: string | null;
  courierInfo?: string | null;
  additionalNotes?: string | null;
}

interface PaymentPolicy extends PolicyStatus {
  cashOnDelivery?: string | null;
  onlinePayment?: string | null;
  bankTransfer?: string | null;
  mobileBanking?: string | null;
  additionalNotes?: string | null;
}

interface ReturnPolicy extends PolicyStatus {
  returnAvailable?: boolean;
  returnWindow?: string | null;
  returnConditions?: string[];
  nonReturnableItems?: string[];
  additionalNotes?: string | null;
}

interface RefundPolicy extends PolicyStatus {
  refundAvailable?: boolean;
  refundProcessingTime?: string | null;
  refundMethods?: string[];
  refundConditions?: string | null;
}

interface ExchangePolicy extends PolicyStatus {
  exchangeAvailable?: boolean;
  exchangeWindow?: string | null;
  exchangeConditions?: string | null;
  exchangeProcess?: string | null;
  additionalNotes?: string | null;
}

interface CancellationPolicy extends PolicyStatus {
  cancellationAllowed?: boolean;
  cancellationWindow?: string | null;
  cancellationConditions?: string | null;
  additionalNotes?: string | null;
}

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
}

interface PolicyVersion {
  id: string;
  policyType: string;
  status: string;
  createdAt: string;
  snapshot: Record<string, unknown>;
}

interface PoliciesData {
  shipping: ShippingPolicy | null;
  payment: PaymentPolicy | null;
  return: ReturnPolicy | null;
  refund: RefundPolicy | null;
  exchange: ExchangePolicy | null;
  cancellation: CancellationPolicy | null;
  templates: PolicyTemplate[];
}

interface PolicyTestResult {
  response: string;
  confidenceScore: number;
  action: string;
  policiesUsed: { type: string; label: string; content: string }[];
  breakdown?: {
    policyScore: number;
    rulesScore: number;
  };
  model: string;
  escalated: boolean;
}

interface Props {
  accessToken: string | null;
  organizationId: string | null;
}

const POLICY_TABS: { id: PolicyTab; label: string; endpoint: string }[] = [
  { id: "shipping", label: "Shipping", endpoint: "shipping" },
  { id: "payment", label: "Payment", endpoint: "payment" },
  { id: "return", label: "Return", endpoint: "return" },
  { id: "refund", label: "Refund", endpoint: "refund" },
  { id: "exchange", label: "Exchange", endpoint: "exchange" },
  { id: "cancellation", label: "Cancellation", endpoint: "cancellation" },
];

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value?: string[]): string {
  return (value ?? []).join("\n");
}

function YesNoToggle({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={value ? "default" : "outline"}
        onClick={() => onChange(true)}
      >
        {yesLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={!value ? "default" : "outline"}
        onClick={() => onChange(false)}
      >
        {noLabel}
      </Button>
    </div>
  );
}

function PoliciesPanelComponent({ accessToken, organizationId }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PolicyTab>("shipping");
  const [shippingDraft, setShippingDraft] = useState<ShippingPolicy | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentPolicy | null>(null);
  const [returnDraft, setReturnDraft] = useState<ReturnPolicy | null>(null);
  const [refundDraft, setRefundDraft] = useState<RefundPolicy | null>(null);
  const [exchangeDraft, setExchangeDraft] = useState<ExchangePolicy | null>(null);
  const [cancellationDraft, setCancellationDraft] = useState<CancellationPolicy | null>(null);
  const [testQuestion, setTestQuestion] = useState("Can I return this product within 7 days?");
  const [testResult, setTestResult] = useState<PolicyTestResult | null>(null);
  const [versionFilter, setVersionFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["brain-policies", organizationId],
    queryFn: () =>
      api<PoliciesData>("/brain/policies", {
        token: accessToken!,
        organizationId,
      }),
    enabled: Boolean(accessToken && organizationId),
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ["brain-policy-versions", organizationId, versionFilter],
    queryFn: () =>
      api<PolicyVersion[]>(
        `/brain/policies/versions${versionFilter ? `?policyType=${versionFilter}` : ""}`,
        { token: accessToken!, organizationId },
      ),
    enabled: Boolean(accessToken && organizationId),
  });

  useEffect(() => {
    if (!data) return;
    setShippingDraft(data.shipping ?? { status: "DRAFT" });
    setPaymentDraft(data.payment ?? { status: "DRAFT" });
    setReturnDraft(data.return ?? { status: "DRAFT", returnAvailable: true, returnConditions: [], nonReturnableItems: [] });
    setRefundDraft(data.refund ?? { status: "DRAFT", refundAvailable: true, refundMethods: [] });
    setExchangeDraft(data.exchange ?? { status: "DRAFT", exchangeAvailable: true });
    setCancellationDraft(data.cancellation ?? { status: "DRAFT", cancellationAllowed: true });
  }, [data]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["brain-policies", organizationId] }),
    [queryClient, organizationId],
  );

  const savePolicy = useMutation({
    mutationFn: (payload: { endpoint: string; body: Record<string, unknown> }) =>
      api(`/brain/policies/${payload.endpoint}`, {
        method: "PATCH",
        token: accessToken!,
        organizationId,
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["brain-policy-versions", organizationId] });
    },
  });

  const applyTemplate = useMutation({
    mutationFn: (payload: { templateId: string; publish: boolean }) =>
      api("/brain/policies/templates/apply", {
        method: "POST",
        token: accessToken!,
        organizationId,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["brain-policy-versions", organizationId] });
    },
  });

  const runPolicyTest = useMutation({
    mutationFn: () =>
      api<PolicyTestResult>("/brain/policies/test", {
        method: "POST",
        token: accessToken!,
        organizationId,
        body: JSON.stringify({ question: testQuestion }),
      }),
    onSuccess: setTestResult,
  });

  const activeEndpoint = useMemo(
    () => POLICY_TABS.find((tab) => tab.id === activeTab)?.endpoint ?? "shipping",
    [activeTab],
  );

  const activeStatus = useMemo(() => {
    const map: Record<PolicyTab, PolicyStatus | null> = {
      shipping: shippingDraft,
      payment: paymentDraft,
      return: returnDraft,
      refund: refundDraft,
      exchange: exchangeDraft,
      cancellation: cancellationDraft,
    };
    return map[activeTab]?.status ?? "DRAFT";
  }, [activeTab, shippingDraft, paymentDraft, returnDraft, refundDraft, exchangeDraft, cancellationDraft]);

  const handleSave = (publish: boolean) => {
    const draftMap: Record<PolicyTab, Record<string, unknown> | null> = {
      shipping: shippingDraft as Record<string, unknown> | null,
      payment: paymentDraft as Record<string, unknown> | null,
      return: returnDraft as Record<string, unknown> | null,
      refund: refundDraft as Record<string, unknown> | null,
      exchange: exchangeDraft as Record<string, unknown> | null,
      cancellation: cancellationDraft as Record<string, unknown> | null,
    };
    const body = draftMap[activeTab];
    if (!body) return;
    savePolicy.mutate({ endpoint: activeEndpoint, body: { ...body, publish } });
  };

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Returns & Refunds Policies
          </CardTitle>
          <CardDescription>
            Merchant-defined policies are used by Torio AI before general knowledge. Publish to activate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Policy Templates</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.templates.map((template) => (
                <div key={template.id} className="rounded-lg border p-3">
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={applyTemplate.isPending}
                      onClick={() => applyTemplate.mutate({ templateId: template.id, publish: false })}
                    >
                      Apply as Draft
                    </Button>
                    <Button
                      size="sm"
                      disabled={applyTemplate.isPending}
                      onClick={() => applyTemplate.mutate({ templateId: template.id, publish: true })}
                    >
                      Apply & Publish
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Policy Editor</CardTitle>
            <Badge variant={activeStatus === "PUBLISHED" ? "default" : "secondary"}>
              {activeStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {POLICY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "shipping" && shippingDraft && (
            <ShippingForm draft={shippingDraft} onChange={setShippingDraft} />
          )}
          {activeTab === "payment" && paymentDraft && (
            <PaymentForm draft={paymentDraft} onChange={setPaymentDraft} />
          )}
          {activeTab === "return" && returnDraft && (
            <ReturnForm draft={returnDraft} onChange={setReturnDraft} />
          )}
          {activeTab === "refund" && refundDraft && (
            <RefundForm draft={refundDraft} onChange={setRefundDraft} />
          )}
          {activeTab === "exchange" && exchangeDraft && (
            <ExchangeForm draft={exchangeDraft} onChange={setExchangeDraft} />
          )}
          {activeTab === "cancellation" && cancellationDraft && (
            <CancellationForm draft={cancellationDraft} onChange={setCancellationDraft} />
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" disabled={savePolicy.isPending} onClick={() => handleSave(false)}>
              {savePolicy.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Draft
            </Button>
            <Button disabled={savePolicy.isPending} onClick={() => handleSave(true)}>
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
          <CardDescription>Published policy snapshots</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
          >
            <option value="">All policy types</option>
            <option value="SHIPPING">Shipping</option>
            <option value="PAYMENT">Payment</option>
            <option value="RETURN">Return</option>
            <option value="REFUND">Refund</option>
            <option value="EXCHANGE">Exchange</option>
            <option value="CANCELLATION">Cancellation</option>
          </select>
          {versionsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : versions.length ? (
            <div className="space-y-2">
              {versions.map((version) => (
                <div key={version.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{version.policyType}</Badge>
                    <Badge variant="secondary">{version.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No published versions yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Policy Test Center
          </CardTitle>
          <CardDescription>Test how Torio answers policy-related customer questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={3}
            value={testQuestion}
            onChange={(e) => setTestQuestion(e.target.value)}
            placeholder="Can I return this product within 7 days?"
          />
          <Button onClick={() => runPolicyTest.mutate()} disabled={runPolicyTest.isPending || !testQuestion}>
            {runPolicyTest.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Run Policy Test
          </Button>
          {testResult && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">AI Response</p>
                <p className="mt-1 whitespace-pre-wrap">{testResult.response}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Confidence: {testResult.confidenceScore}%</Badge>
                <Badge variant="outline">{testResult.action?.replace(/_/g, " ")}</Badge>
                {testResult.breakdown && (
                  <Badge variant="outline">Policy score: {testResult.breakdown.policyScore}</Badge>
                )}
                <Badge variant="outline">{testResult.model}</Badge>
              </div>
              {testResult.policiesUsed?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Policies Used</p>
                  <div className="space-y-2">
                    {testResult.policiesUsed.map((policy, index) => (
                      <div key={index} className="rounded border bg-background p-3 text-sm">
                        <Badge variant="outline" className="mb-1">
                          {policy.type}
                        </Badge>
                        <p className="font-medium">{policy.label}</p>
                        <p className="text-muted-foreground">{policy.content.slice(0, 300)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ShippingForm({
  draft,
  onChange,
}: {
  draft: ShippingPolicy;
  onChange: (value: ShippingPolicy) => void;
}) {
  const update = (patch: Partial<ShippingPolicy>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4">
      <Field label="Delivery Areas">
        <Textarea rows={2} value={draft.deliveryAreas ?? ""} onChange={(e) => update({ deliveryAreas: e.target.value })} />
      </Field>
      <Field label="Delivery Time">
        <Input value={draft.deliveryTime ?? ""} onChange={(e) => update({ deliveryTime: e.target.value })} />
      </Field>
      <Field label="Delivery Charge">
        <Input value={draft.deliveryCharge ?? ""} onChange={(e) => update({ deliveryCharge: e.target.value })} />
      </Field>
      <Field label="International Shipping">
        <Input value={draft.internationalShipping ?? ""} onChange={(e) => update({ internationalShipping: e.target.value })} />
      </Field>
      <Field label="Courier Info">
        <Input value={draft.courierInfo ?? ""} onChange={(e) => update({ courierInfo: e.target.value })} />
      </Field>
      <Field label="Additional Notes">
        <Textarea rows={4} value={draft.additionalNotes ?? ""} onChange={(e) => update({ additionalNotes: e.target.value })} />
      </Field>
    </div>
  );
}

function PaymentForm({
  draft,
  onChange,
}: {
  draft: PaymentPolicy;
  onChange: (value: PaymentPolicy) => void;
}) {
  const update = (patch: Partial<PaymentPolicy>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4">
      <Field label="Cash On Delivery">
        <Textarea rows={2} value={draft.cashOnDelivery ?? ""} onChange={(e) => update({ cashOnDelivery: e.target.value })} />
      </Field>
      <Field label="Online Payment">
        <Textarea rows={2} value={draft.onlinePayment ?? ""} onChange={(e) => update({ onlinePayment: e.target.value })} />
      </Field>
      <Field label="Bank Transfer">
        <Textarea rows={2} value={draft.bankTransfer ?? ""} onChange={(e) => update({ bankTransfer: e.target.value })} />
      </Field>
      <Field label="Mobile Banking">
        <Textarea rows={2} value={draft.mobileBanking ?? ""} onChange={(e) => update({ mobileBanking: e.target.value })} />
      </Field>
      <Field label="Additional Notes">
        <Textarea rows={4} value={draft.additionalNotes ?? ""} onChange={(e) => update({ additionalNotes: e.target.value })} />
      </Field>
    </div>
  );
}

function ReturnForm({
  draft,
  onChange,
}: {
  draft: ReturnPolicy;
  onChange: (value: ReturnPolicy) => void;
}) {
  const update = (patch: Partial<ReturnPolicy>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4">
      <Field label="Return Available">
        <YesNoToggle value={draft.returnAvailable ?? true} onChange={(returnAvailable) => update({ returnAvailable })} />
      </Field>
      <Field label="Return Window">
        <Input value={draft.returnWindow ?? ""} onChange={(e) => update({ returnWindow: e.target.value })} placeholder="7 Days" />
      </Field>
      <Field label="Return Conditions (one per line)">
        <Textarea
          rows={4}
          value={arrayToLines(draft.returnConditions)}
          onChange={(e) => update({ returnConditions: linesToArray(e.target.value) })}
        />
      </Field>
      <Field label="Non-Returnable Items (one per line)">
        <Textarea
          rows={3}
          value={arrayToLines(draft.nonReturnableItems)}
          onChange={(e) => update({ nonReturnableItems: linesToArray(e.target.value) })}
        />
      </Field>
      <Field label="Additional Notes">
        <Textarea rows={4} value={draft.additionalNotes ?? ""} onChange={(e) => update({ additionalNotes: e.target.value })} />
      </Field>
    </div>
  );
}

function RefundForm({
  draft,
  onChange,
}: {
  draft: RefundPolicy;
  onChange: (value: RefundPolicy) => void;
}) {
  const update = (patch: Partial<RefundPolicy>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4">
      <Field label="Refund Available">
        <YesNoToggle value={draft.refundAvailable ?? true} onChange={(refundAvailable) => update({ refundAvailable })} />
      </Field>
      <Field label="Refund Processing Time">
        <Input value={draft.refundProcessingTime ?? ""} onChange={(e) => update({ refundProcessingTime: e.target.value })} placeholder="7 Days" />
      </Field>
      <Field label="Refund Methods (one per line)">
        <Textarea
          rows={3}
          value={arrayToLines(draft.refundMethods)}
          onChange={(e) => update({ refundMethods: linesToArray(e.target.value) })}
        />
      </Field>
      <Field label="Refund Conditions">
        <Textarea rows={4} value={draft.refundConditions ?? ""} onChange={(e) => update({ refundConditions: e.target.value })} />
      </Field>
    </div>
  );
}

function ExchangeForm({
  draft,
  onChange,
}: {
  draft: ExchangePolicy;
  onChange: (value: ExchangePolicy) => void;
}) {
  const update = (patch: Partial<ExchangePolicy>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4">
      <Field label="Exchange Available">
        <YesNoToggle value={draft.exchangeAvailable ?? true} onChange={(exchangeAvailable) => update({ exchangeAvailable })} />
      </Field>
      <Field label="Exchange Window">
        <Input value={draft.exchangeWindow ?? ""} onChange={(e) => update({ exchangeWindow: e.target.value })} placeholder="7 Days" />
      </Field>
      <Field label="Exchange Conditions">
        <Textarea rows={3} value={draft.exchangeConditions ?? ""} onChange={(e) => update({ exchangeConditions: e.target.value })} />
      </Field>
      <Field label="Exchange Process">
        <Textarea rows={4} value={draft.exchangeProcess ?? ""} onChange={(e) => update({ exchangeProcess: e.target.value })} />
      </Field>
      <Field label="Additional Notes">
        <Textarea rows={3} value={draft.additionalNotes ?? ""} onChange={(e) => update({ additionalNotes: e.target.value })} />
      </Field>
    </div>
  );
}

function CancellationForm({
  draft,
  onChange,
}: {
  draft: CancellationPolicy;
  onChange: (value: CancellationPolicy) => void;
}) {
  const update = (patch: Partial<CancellationPolicy>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4">
      <Field label="Cancellation Allowed">
        <YesNoToggle value={draft.cancellationAllowed ?? true} onChange={(cancellationAllowed) => update({ cancellationAllowed })} />
      </Field>
      <Field label="Cancellation Window">
        <Input value={draft.cancellationWindow ?? ""} onChange={(e) => update({ cancellationWindow: e.target.value })} placeholder="Before dispatch" />
      </Field>
      <Field label="Cancellation Conditions">
        <Textarea rows={4} value={draft.cancellationConditions ?? ""} onChange={(e) => update({ cancellationConditions: e.target.value })} />
      </Field>
      <Field label="Additional Notes">
        <Textarea rows={3} value={draft.additionalNotes ?? ""} onChange={(e) => update({ additionalNotes: e.target.value })} />
      </Field>
    </div>
  );
}

export const PoliciesPanel = memo(PoliciesPanelComponent);
