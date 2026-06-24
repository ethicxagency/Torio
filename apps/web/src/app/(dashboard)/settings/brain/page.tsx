"use client";

import { memo, useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Brain,
  FileUp,
  Globe,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { api, apiForm } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PageHeader } from "@/components/layout/page-header";
import { BRAND } from "@/config/branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EnhancedRuleForm } from "@/components/brain/brain-engine-panels";

const BrandVoicePanel = dynamic(
  () => import("@/components/brain/brain-engine-panels").then((m) => m.BrandVoicePanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);
const LearningCenterPanel = dynamic(
  () => import("@/components/brain/brain-engine-panels").then((m) => m.LearningCenterPanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);
const MemoriesPanel = dynamic(
  () => import("@/components/brain/brain-engine-panels").then((m) => m.MemoriesPanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);
const BrainAnalyticsCharts = dynamic(
  () => import("@/components/brain/brain-analytics-charts").then((m) => m.BrainAnalyticsCharts),
  { loading: () => <Skeleton className="h-64 w-full" /> },
);
const ProductMemoryPanel = dynamic(
  () => import("@/components/brain/product-memory-panel").then((m) => m.ProductMemoryPanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);
const OrderMemoryPanel = dynamic(
  () => import("@/components/brain/order-memory-panel").then((m) => m.OrderMemoryPanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);
const CommercePanel = dynamic(
  () => import("@/components/brain/commerce-panel").then((m) => m.CommercePanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);
const CustomMemoryPanel = dynamic(
  () => import("@/components/brain/custom-memory-panel").then((m) => m.CustomMemoryPanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);
const PoliciesPanel = dynamic(
  () => import("@/components/brain/policies-panel").then((m) => m.PoliciesPanel),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);

type BrainTab =
  | "overview"
  | "BUSINESS_INFO"
  | "SHIPPING"
  | "PAYMENT"
  | "RETURN_REFUND"
  | "PRODUCT"
  | "faqs"
  | "rules"
  | "brand-voice"
  | "learning"
  | "memories"
  | "product-memory"
  | "order-memory"
  | "commerce"
  | "custom-memory"
  | "policies"
  | "documents"
  | "test"
  | "settings";

interface BrainEntry {
  id: string;
  key: string;
  label: string;
  value: string;
}

interface BrainCategory {
  id: string;
  type: string;
  title: string;
  entries: BrainEntry[];
}

interface BrainRule {
  id: string;
  name: string;
  description: string;
  rule: string;
  type: string;
  priority: number;
  isActive: boolean;
}

interface BrainFaq {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
}

interface BrainDocument {
  id: string;
  title: string;
  documentType: string;
  status: string;
  sourceUrl?: string | null;
  createdAt: string;
}

interface BrainSettings {
  isEnabled: boolean;
  confidenceThreshold: number;
  defaultLanguage: string;
  escalationKeywords: string[];
}

interface BrainAnalytics {
  totalKnowledgeEntries: number;
  filledKnowledgeEntries: number;
  totalFaqs: number;
  totalRules: number;
  totalDocuments: number;
  totalMemories: number;
  totalProducts?: number;
  totalOrders?: number;
  totalOrderRevenue?: number;
  suggestedKnowledge: number;
  averageConfidence: number;
  aiUsage: number;
}

interface BrainOverview {
  settings: BrainSettings;
  analytics: BrainAnalytics;
}

interface TestResult {
  response: string;
  confidence: number;
  confidenceScore: number;
  action: string;
  sources: { type: string; label: string; content: string }[];
  rulesUsed: { type: string; label: string; content: string }[];
  policiesUsed: { type: string; label: string; content: string }[];
  ordersUsed: { type: string; label: string; content: string }[];
  productsUsed: { type: string; label: string; content: string }[];
  memoriesUsed: { type: string; label: string; content: string }[];
  knowledgeUsed: { type: string; label: string; content: string }[];
  breakdown?: {
    rulesScore: number;
    policyScore: number;
    orderScore: number;
    productScore: number;
    faqScore: number;
    memoryScore: number;
    knowledgeScore: number;
  };
  language: string;
  escalated: boolean;
  model: string;
}

const TABS: { id: BrainTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "BUSINESS_INFO", label: "Business" },
  { id: "SHIPPING", label: "Shipping" },
  { id: "PAYMENT", label: "Payment" },
  { id: "RETURN_REFUND", label: "Returns" },
  { id: "PRODUCT", label: "Products" },
  { id: "faqs", label: "FAQs" },
  { id: "rules", label: "Business Rules" },
  { id: "brand-voice", label: "Brand Voice" },
  { id: "learning", label: "Learning Center" },
  { id: "memories", label: "Customer Memory" },
  { id: "product-memory", label: "Product Memory" },
  { id: "order-memory", label: "Order Memory" },
  { id: "commerce", label: "Commerce AI" },
  { id: "custom-memory", label: "Custom Memory" },
  { id: "policies", label: "Policies" },
  { id: "documents", label: "Documents" },
  { id: "test", label: "Test Center" },
  { id: "settings", label: "Settings" },
];

const CATEGORY_TABS = new Set<BrainTab>([
  "BUSINESS_INFO",
  "SHIPPING",
  "PAYMENT",
  "RETURN_REFUND",
  "PRODUCT",
]);

function useBrainAuth() {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const enabled = !!accessToken && !!currentOrganizationId;
  return { accessToken, currentOrganizationId, enabled };
}

export default function BrainPage() {
  const { accessToken, currentOrganizationId, enabled } = useBrainAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<BrainTab>("overview");
  const [entryDrafts, setEntryDrafts] = useState<Record<string, string>>({});
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [testQuestion, setTestQuestion] = useState("Do you deliver outside Bangladesh?");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["brain-overview", currentOrganizationId],
    queryFn: () =>
      api<BrainOverview>("/brain/overview", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled,
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["brain-categories", currentOrganizationId],
    queryFn: () =>
      api<BrainCategory[]>("/brain/categories", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: enabled && CATEGORY_TABS.has(tab),
  });

  const { data: faqs, isLoading: faqsLoading } = useQuery({
    queryKey: ["brain-faqs", currentOrganizationId],
    queryFn: () =>
      api<BrainFaq[]>("/brain/faqs", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: enabled && tab === "faqs",
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["brain-rules", currentOrganizationId],
    queryFn: () =>
      api<BrainRule[]>("/brain/rules", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: enabled && tab === "rules",
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["brain-documents", currentOrganizationId],
    queryFn: () =>
      api<BrainDocument[]>("/brain/documents", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: enabled && tab === "documents",
  });

  const { data: growthData } = useQuery({
    queryKey: ["brain-growth", currentOrganizationId],
    queryFn: () =>
      api<{
        knowledgeGrowth: { date: string; count: number }[];
        learningGrowth: { date: string; count: number }[];
        confidenceTrend: { date: string; score: number }[];
      }>("/brain/analytics/growth", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: enabled && tab === "overview",
  });

  const { data: copilotAnalytics } = useQuery({
    queryKey: ["brain-copilot-analytics", currentOrganizationId],
    queryFn: () =>
      api<{
        productRecommendations: number;
        upsellRecommendations: number;
        crossSellRecommendations: number;
        acceptedSuggestions: number;
        revenueInfluenced: number;
        averageLeadScore: number;
        leadConversions: number;
      }>("/brain/copilot/analytics", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: enabled && tab === "overview",
  });

  const invalidateOverview = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["brain-overview"] }),
    [queryClient],
  );

  const saveEntries = useMutation({
    mutationFn: (payload: { type: string; entries: { key: string; value: string }[] }) =>
      api(`/brain/categories/${payload.type}/entries`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ entries: payload.entries }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-categories"] });
      invalidateOverview();
    },
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/rules/${id}`, {
        method: "DELETE",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-rules"] });
      invalidateOverview();
    },
  });

  const createFaq = useMutation({
    mutationFn: () =>
      api("/brain/faqs", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ question: newFaqQ, answer: newFaqA }),
      }),
    onSuccess: () => {
      setNewFaqQ("");
      setNewFaqA("");
      queryClient.invalidateQueries({ queryKey: ["brain-faqs"] });
      invalidateOverview();
    },
  });

  const deleteFaq = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/faqs/${id}`, {
        method: "DELETE",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-faqs"] });
      invalidateOverview();
    },
  });

  const importWebsite = useMutation({
    mutationFn: () =>
      api("/brain/documents/import-website", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ url: websiteUrl }),
      }),
    onSuccess: () => {
      setWebsiteUrl("");
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      invalidateOverview();
    },
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiForm("/brain/documents/upload", form, {
        token: accessToken,
        organizationId: currentOrganizationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      invalidateOverview();
    },
  });

  const runTest = useMutation({
    mutationFn: () =>
      api<TestResult>("/brain/test", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ question: testQuestion }),
      }),
    onSuccess: setTestResult,
  });

  const updateSettings = useMutation({
    mutationFn: (payload: Partial<BrainSettings>) =>
      api("/brain/settings", {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidateOverview,
  });

  const activeCategory = useMemo(
    () => categories?.find((c) => c.type === tab),
    [categories, tab],
  );

  const getEntryValue = useCallback(
    (entry: BrainEntry) => entryDrafts[entry.id] ?? entry.value,
    [entryDrafts],
  );

  const saveCategory = useCallback(
    (type: string, entries: BrainEntry[]) => {
      saveEntries.mutate({
        type,
        entries: entries.map((e) => ({ key: e.key, value: getEntryValue(e) })),
      });
    },
    [getEntryValue, saveEntries],
  );

  const handleTabChange = useCallback((nextTab: BrainTab) => setTab(nextTab), []);

  const settings = overview?.settings;
  const analytics = overview?.analytics;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-[44px] text-muted-foreground">
        <Link href="/settings">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to settings
        </Link>
      </Button>

      <PageHeader
        title={BRAND.pages.brain}
        description="Teach Torio everything about your business. AI answers only from Torio Brain — never guesses."
      >
        {settings ? (
          <Badge variant={settings.isEnabled ? "default" : "secondary"}>
            {settings.isEnabled ? "Brain Active" : "Brain Disabled"}
          </Badge>
        ) : (
          <Skeleton className="h-6 w-24" />
        )}
      </PageHeader>

      <div className="flex flex-col gap-6 lg:flex-row">
        <TabNav tabs={TABS} activeTab={tab} onTabChange={handleTabChange} />

        <div className="min-w-0 flex-1 space-y-6">
          {tab === "overview" && (
            overviewLoading || !analytics ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <OverviewTab
                analytics={analytics}
                growthData={growthData}
                copilotAnalytics={copilotAnalytics}
              />
            )
          )}

          {CATEGORY_TABS.has(tab) && (
            categoriesLoading || !activeCategory ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <CategoryTab
                category={activeCategory}
                getEntryValue={getEntryValue}
                onEntryChange={(id, value) =>
                  setEntryDrafts((prev) => ({ ...prev, [id]: value }))
                }
                onSave={() => saveCategory(activeCategory.type, activeCategory.entries)}
                saving={saveEntries.isPending}
              />
            )
          )}

          {tab === "faqs" && (
            faqsLoading || !faqs ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <FaqsTab
                faqs={faqs}
                newFaqQ={newFaqQ}
                newFaqA={newFaqA}
                onQuestionChange={setNewFaqQ}
                onAnswerChange={setNewFaqA}
                onCreate={() => createFaq.mutate()}
                onDelete={(id) => deleteFaq.mutate(id)}
                creating={createFaq.isPending}
              />
            )
          )}

          {tab === "rules" && (
            rulesLoading || !rules ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <RulesTab
                rules={rules}
                accessToken={accessToken}
                organizationId={currentOrganizationId}
                onRuleCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ["brain-rules"] });
                  invalidateOverview();
                }}
                onDelete={(id) => deleteRule.mutate(id)}
              />
            )
          )}

          {tab === "brand-voice" && (
            <BrandVoicePanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "learning" && (
            <LearningCenterPanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "memories" && (
            <MemoriesPanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "product-memory" && (
            <ProductMemoryPanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "order-memory" && (
            <OrderMemoryPanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "commerce" && (
            <CommercePanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "custom-memory" && (
            <CustomMemoryPanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "policies" && (
            <PoliciesPanel accessToken={accessToken} organizationId={currentOrganizationId} />
          )}

          {tab === "documents" && (
            documentsLoading || !documents ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <DocumentsTab
                documents={documents}
                websiteUrl={websiteUrl}
                onWebsiteUrlChange={setWebsiteUrl}
                onImport={() => importWebsite.mutate()}
                importing={importWebsite.isPending}
                onUpload={(file) => uploadFile.mutate(file)}
              />
            )
          )}

          {tab === "test" && (
            <TestTab
              testQuestion={testQuestion}
              onQuestionChange={setTestQuestion}
              onRun={() => runTest.mutate()}
              running={runTest.isPending}
              testResult={testResult}
            />
          )}

          {tab === "settings" && (
            !settings ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <SettingsTab
                settings={settings}
                onUpdate={(payload) => updateSettings.mutate(payload)}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

const TabNav = memo(function TabNav({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: BrainTab; label: string }[];
  activeTab: BrainTab;
  onTabChange: (tab: BrainTab) => void;
}) {
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
            activeTab === item.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
});

const MetricCard = memo(function MetricCard({
  title,
  value,
  subtitle,
  suffix,
}: {
  title: string;
  value: number;
  subtitle?: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}{suffix ?? ""}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
    </Card>
  );
});

const OverviewTab = memo(function OverviewTab({
  analytics,
  growthData,
  copilotAnalytics,
}: {
  analytics: BrainAnalytics;
  growthData?: {
    knowledgeGrowth: { date: string; count: number }[];
    learningGrowth: { date: string; count: number }[];
    confidenceTrend: { date: string; score: number }[];
  };
  copilotAnalytics?: {
    productRecommendations: number;
    upsellRecommendations: number;
    crossSellRecommendations: number;
    acceptedSuggestions: number;
    revenueInfluenced: number;
    averageLeadScore: number;
    leadConversions: number;
  };
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Business Rules" value={analytics.totalRules} />
        <MetricCard title="FAQs" value={analytics.totalFaqs} />
        <MetricCard title="Customer Memories" value={analytics.totalMemories ?? 0} />
        <MetricCard title="Products" value={analytics.totalProducts ?? 0} />
        <MetricCard title="Orders" value={analytics.totalOrders ?? 0} />
        <MetricCard title="Avg Confidence" value={analytics.averageConfidence ?? 0} suffix="%" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Knowledge Entries"
          value={analytics.filledKnowledgeEntries}
          subtitle={`of ${analytics.totalKnowledgeEntries} fields`}
        />
        <MetricCard title="Documents" value={analytics.totalDocuments} />
        <MetricCard title="Suggested Knowledge" value={analytics.suggestedKnowledge ?? 0} />
        <MetricCard title="AI Usage" value={analytics.aiUsage} />
      </div>
      {growthData && (
        <BrainAnalyticsCharts
          knowledgeGrowth={growthData.knowledgeGrowth}
          learningGrowth={growthData.learningGrowth}
          confidenceTrend={growthData.confidenceTrend}
        />
      )}
      {copilotAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Intelligence Analytics</CardTitle>
            <CardDescription>Copilot recommendations and revenue influence</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Product Recs" value={copilotAnalytics.productRecommendations} />
            <MetricCard title="Upsells" value={copilotAnalytics.upsellRecommendations} />
            <MetricCard title="Cross-Sells" value={copilotAnalytics.crossSellRecommendations} />
            <MetricCard
              title="Revenue Influenced"
              value={Math.round(copilotAnalytics.revenueInfluenced)}
              suffix=" BDT"
            />
            <MetricCard title="Avg Lead Score" value={copilotAnalytics.averageLeadScore} suffix="%" />
            <MetricCard title="Hot Leads" value={copilotAnalytics.leadConversions} />
            <MetricCard title="Accepted Suggestions" value={copilotAnalytics.acceptedSuggestions} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            How Torio Brain Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Business rules override everything (shipping, payment, sales, support).</p>
          <p>2. Order memory answers order status, tracking, and delivery questions.</p>
          <p>3. Product memory answers product questions from your catalog only.</p>
          <p>4. Customer memory and insights personalize replies per customer.</p>
          <p>5. FAQs, knowledge entries, and documents provide factual context.</p>
          <p>6. Confidence engine decides auto-reply, suggest, or human takeover.</p>
          <p className="font-medium text-foreground">Torio AI never guesses — it only responds from your Brain.</p>
        </CardContent>
      </Card>
    </>
  );
});

const CategoryTab = memo(function CategoryTab({
  category,
  getEntryValue,
  onEntryChange,
  onSave,
  saving,
}: {
  category: BrainCategory;
  getEntryValue: (entry: BrainEntry) => string;
  onEntryChange: (id: string, value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{category.title}</CardTitle>
        <CardDescription>Train Torio with accurate {category.title.toLowerCase()}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {category.entries.map((entry) => (
          <div key={entry.id} className="space-y-2">
            <Label htmlFor={entry.id}>{entry.label}</Label>
            <Textarea
              id={entry.id}
              rows={entry.value.length > 80 || getEntryValue(entry).length > 80 ? 3 : 2}
              value={getEntryValue(entry)}
              onChange={(e) => onEntryChange(entry.id, e.target.value)}
              placeholder={`Enter ${entry.label.toLowerCase()}...`}
            />
          </div>
        ))}
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save {category.title}
        </Button>
      </CardContent>
    </Card>
  );
});

const FaqsTab = memo(function FaqsTab({
  faqs,
  newFaqQ,
  newFaqA,
  onQuestionChange,
  onAnswerChange,
  onCreate,
  onDelete,
  creating,
}: {
  faqs: BrainFaq[];
  newFaqQ: string;
  newFaqA: string;
  onQuestionChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  creating: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Frequently Asked Questions</CardTitle>
        <CardDescription>Add Q&A pairs Torio can use in customer conversations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 rounded-lg border p-4">
          <Input
            placeholder="Question: How long does delivery take?"
            value={newFaqQ}
            onChange={(e) => onQuestionChange(e.target.value)}
          />
          <Textarea
            placeholder="Answer: Delivery usually takes 2 to 5 business days."
            value={newFaqA}
            onChange={(e) => onAnswerChange(e.target.value)}
          />
          <Button onClick={onCreate} disabled={!newFaqQ || !newFaqA || creating}>
            <Plus className="mr-2 h-4 w-4" /> Add FAQ
          </Button>
        </div>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{faq.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(faq.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

const RulesTab = memo(function RulesTab({
  rules,
  accessToken,
  organizationId,
  onRuleCreated,
  onDelete,
}: {
  rules: BrainRule[];
  accessToken: string | null;
  organizationId: string | null;
  onRuleCreated: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Business Rules Engine
        </CardTitle>
        <CardDescription>Highest priority. Rules override all AI knowledge.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <EnhancedRuleForm
          accessToken={accessToken}
          organizationId={organizationId}
          onCreated={onRuleCreated}
        />
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <p className="font-medium">{rule.name || rule.rule}</p>
                    <Badge variant="outline">{rule.type}</Badge>
                    <Badge variant="secondary">P{rule.priority}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{rule.description || rule.rule}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

const DocumentsTab = memo(function DocumentsTab({
  documents,
  websiteUrl,
  onWebsiteUrlChange,
  onImport,
  importing,
  onUpload,
}: {
  documents: BrainDocument[];
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onImport: () => void;
  importing: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>PDF, DOCX, or TXT — content is extracted into Torio Brain.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 hover:bg-muted/50">
            <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Click to upload</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,text/plain,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Import from Website
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="https://yourstore.com"
            value={websiteUrl}
            onChange={(e) => onWebsiteUrlChange(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button onClick={onImport} disabled={!websiteUrl || importing} className="shrink-0 sm:w-auto">
            Import
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Stored Documents</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.title}</p>
                <p className="truncate text-muted-foreground">{doc.documentType} · {doc.status}</p>
              </div>
              <Badge className="shrink-0 self-start sm:self-center" variant={doc.status === "READY" ? "default" : "secondary"}>{doc.status}</Badge>
            </div>
          ))}
          {!documents.length && (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

const TestTab = memo(function TestTab({
  testQuestion,
  onQuestionChange,
  onRun,
  running,
  testResult,
}: {
  testQuestion: string;
  onQuestionChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  testResult: TestResult | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Test Torio Brain
        </CardTitle>
        <CardDescription>Preview how Torio responds using your business knowledge.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={3}
          value={testQuestion}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder="Do you deliver outside Bangladesh?"
        />
        <Button onClick={onRun} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Run Test
        </Button>
        {testResult && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">AI Response</p>
              <p className="mt-1 whitespace-pre-wrap">{testResult.response}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Confidence: {testResult.confidenceScore ?? Math.round(testResult.confidence * 100)}%</Badge>
              <Badge variant="outline">{testResult.action?.replace(/_/g, " ")}</Badge>
              <Badge variant="outline">{testResult.model}</Badge>
              <Badge variant={testResult.escalated ? "warning" : "secondary"}>
                {testResult.escalated ? "Human Takeover" : "Auto-reply OK"}
              </Badge>
            </div>
            {testResult.breakdown && (
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-7">
                <div className="rounded border bg-background p-2">Rules: {testResult.breakdown.rulesScore}</div>
                <div className="rounded border bg-background p-2">Policies: {testResult.breakdown.policyScore}</div>
                <div className="rounded border bg-background p-2">Orders: {testResult.breakdown.orderScore}</div>
                <div className="rounded border bg-background p-2">Products: {testResult.breakdown.productScore}</div>
                <div className="rounded border bg-background p-2">FAQ: {testResult.breakdown.faqScore}</div>
                <div className="rounded border bg-background p-2">Memory: {testResult.breakdown.memoryScore}</div>
                <div className="rounded border bg-background p-2">Knowledge: {testResult.breakdown.knowledgeScore}</div>
              </div>
            )}
            {testResult.rulesUsed?.length > 0 && (
              <SourceBlock title="Business Rules Used" items={testResult.rulesUsed} />
            )}
            {testResult.policiesUsed?.length > 0 && (
              <SourceBlock title="Policies Used" items={testResult.policiesUsed} />
            )}
            {testResult.ordersUsed?.length > 0 && (
              <SourceBlock title="Order Memory Used" items={testResult.ordersUsed} />
            )}
            {testResult.productsUsed?.length > 0 && (
              <SourceBlock title="Product Memory Used" items={testResult.productsUsed} />
            )}
            {testResult.memoriesUsed?.length > 0 && (
              <SourceBlock title="Customer Memory Used" items={testResult.memoriesUsed} />
            )}
            {testResult.knowledgeUsed?.length > 0 && (
              <SourceBlock title="Knowledge Used" items={testResult.knowledgeUsed} />
            )}
            {testResult.sources.length > 0 && !testResult.knowledgeUsed?.length && (
              <SourceBlock title="Knowledge Sources Used" items={testResult.sources} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const SettingsTab = memo(function SettingsTab({
  settings,
  onUpdate,
}: {
  settings: BrainSettings;
  onUpdate: (payload: Partial<BrainSettings>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Torio Brain Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Enable Torio Brain</p>
            <p className="text-sm text-muted-foreground">When disabled, AI will not use business knowledge.</p>
          </div>
          <Button
            variant={settings.isEnabled ? "default" : "outline"}
            onClick={() => onUpdate({ isEnabled: !settings.isEnabled })}
          >
            {settings.isEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Confidence Threshold ({Math.round(settings.confidenceThreshold * 100)}%)</Label>
          <Input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={settings.confidenceThreshold}
            onChange={(e) => onUpdate({ confidenceThreshold: parseFloat(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label>Default Language</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={settings.defaultLanguage}
            onChange={(e) => onUpdate({ defaultLanguage: e.target.value })}
          >
            <option value="bn">Bangla</option>
            <option value="en">English</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
});

const SourceBlock = memo(function SourceBlock({
  title,
  items,
}: {
  title: string;
  items: { type: string; label: string; content: string }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((s, i) => (
          <div key={i} className="rounded border bg-background p-3 text-sm">
            <Badge variant="outline" className="mb-1">{s.type}</Badge>
            <p className="font-medium">{s.label}</p>
            <p className="text-muted-foreground">{s.content.slice(0, 200)}</p>
          </div>
        ))}
      </div>
    </div>
  );
});
