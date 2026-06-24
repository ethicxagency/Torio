"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STOCK_STATUSES = ["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK", "PRE_ORDER"] as const;
const COMMON_ATTRIBUTES = ["size", "color", "material", "weight", "warranty"] as const;

interface ProductAttribute {
  id: string;
  key: string;
  value: string;
}

interface ProductFaq {
  id: string;
  question: string;
  answer: string;
}

interface ProductMemory {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  brand?: string | null;
  price?: number | null;
  salePrice?: number | null;
  description?: string | null;
  features: string[];
  benefits: string[];
  specifications?: string | null;
  stockStatus: string;
  productUrl?: string | null;
  images: string[];
  isActive: boolean;
  attributes: ProductAttribute[];
  faqs: ProductFaq[];
}

interface SearchHit {
  product: ProductMemory;
  score: number;
  matchedFields: string[];
}

interface Props {
  accessToken: string | null;
  organizationId: string | null;
}

const EMPTY_FORM = {
  name: "",
  sku: "",
  category: "",
  brand: "",
  price: "",
  salePrice: "",
  description: "",
  features: "",
  benefits: "",
  specifications: "",
  stockStatus: "IN_STOCK",
  productUrl: "",
  images: "",
};

export function ProductMemoryPanel({ accessToken, organizationId }: Props) {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["brain-products", organizationId],
    queryFn: () =>
      api<ProductMemory[]>("/brain/products?limit=50", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("Do you have black polo shirts?");
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const effectiveSelectedId = selectedId ?? products[0]?.id ?? null;
  const selected = useMemo(
    () => products.find((p) => p.id === effectiveSelectedId) ?? null,
    [products, effectiveSelectedId],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["brain-products"] });

  const createProduct = useMutation({
    mutationFn: () =>
      api("/brain/products", {
        method: "POST",
        token: accessToken,
        organizationId,
        body: JSON.stringify({
          name: form.name,
          sku: form.sku || undefined,
          category: form.category || undefined,
          brand: form.brand || undefined,
          price: form.price ? Number(form.price) : undefined,
          salePrice: form.salePrice ? Number(form.salePrice) : undefined,
          description: form.description || undefined,
          features: form.features.split("\n").map((l) => l.trim()).filter(Boolean),
          benefits: form.benefits.split("\n").map((l) => l.trim()).filter(Boolean),
          specifications: form.specifications || undefined,
          stockStatus: form.stockStatus,
          productUrl: form.productUrl || undefined,
          images: form.images.split("\n").map((l) => l.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setShowCreate(false);
      invalidate();
    },
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/products/${id}`, {
        method: "DELETE",
        token: accessToken,
        organizationId,
      }),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });

  const searchProducts = useMutation({
    mutationFn: () =>
      api<SearchHit[]>(
        `/brain/products/search?query=${encodeURIComponent(searchQuery)}&limit=10`,
        { token: accessToken, organizationId },
      ),
    onSuccess: setSearchResults,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Product Search
          </CardTitle>
          <CardDescription>
            Test semantic product search. Torio only answers from your Product Memory catalog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Do you have black polo shirts?"
            />
            <Button onClick={() => searchProducts.mutate()} disabled={searchProducts.isPending}>
              {searchProducts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
          {searchResults && (
            <div className="space-y-2">
              {searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching products found.</p>
              )}
              {searchResults.map(({ product, score, matchedFields }) => (
                <div key={product.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{product.name}</p>
                    <Badge variant="outline">Score {score}</Badge>
                    {matchedFields.map((field) => (
                      <Badge key={field} variant="secondary">{field}</Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {product.category ?? "Uncategorized"} · {product.stockStatus.replace(/_/g, " ")}
                    {product.price != null ? ` · ${product.price} BDT` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Products ({products.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedId(product.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === product.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.sku ?? "No SKU"} · {product.stockStatus.replace(/_/g, " ")}
                </p>
              </button>
            ))}
            {!products.length && (
              <p className="text-sm text-muted-foreground">No products yet. Add your catalog.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {showCreate && (
            <Card>
              <CardHeader>
                <CardTitle>Add Product</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductForm form={form} setForm={setForm} />
                <Button className="mt-4" onClick={() => createProduct.mutate()} disabled={!form.name || createProduct.isPending}>
                  {createProduct.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                  Create Product
                </Button>
              </CardContent>
            </Card>
          )}

          {selected && (
            <SelectedProductEditor
              key={selected.id}
              product={selected}
              accessToken={accessToken}
              organizationId={organizationId}
              onDelete={() => deleteProduct.mutate(selected.id)}
              onInvalidate={invalidate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SelectedProductEditor({
  product,
  accessToken,
  organizationId,
  onDelete,
  onInvalidate,
}: {
  product: ProductMemory;
  accessToken: string | null;
  organizationId: string | null;
  onDelete: () => void;
  onInvalidate: () => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    sku: product.sku ?? "",
    category: product.category ?? "",
    brand: product.brand ?? "",
    price: product.price?.toString() ?? "",
    salePrice: product.salePrice?.toString() ?? "",
    description: product.description ?? "",
    features: product.features.join("\n"),
    benefits: product.benefits.join("\n"),
    specifications: product.specifications ?? "",
    stockStatus: product.stockStatus,
    productUrl: product.productUrl ?? "",
    images: product.images.join("\n"),
  });
  const [newAttrKey, setNewAttrKey] = useState("color");
  const [newAttrValue, setNewAttrValue] = useState("");
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");

  const updateProduct = useMutation({
    mutationFn: () =>
      api(`/brain/products/${product.id}`, {
        method: "PATCH",
        token: accessToken,
        organizationId,
        body: JSON.stringify({
          name: form.name,
          sku: form.sku || undefined,
          category: form.category || undefined,
          brand: form.brand || undefined,
          price: form.price ? Number(form.price) : undefined,
          salePrice: form.salePrice ? Number(form.salePrice) : undefined,
          description: form.description || undefined,
          features: form.features.split("\n").map((l) => l.trim()).filter(Boolean),
          benefits: form.benefits.split("\n").map((l) => l.trim()).filter(Boolean),
          specifications: form.specifications || undefined,
          stockStatus: form.stockStatus,
          productUrl: form.productUrl || undefined,
          images: form.images.split("\n").map((l) => l.trim()).filter(Boolean),
        }),
      }),
    onSuccess: onInvalidate,
  });

  const addAttribute = useMutation({
    mutationFn: () =>
      api(`/brain/products/${product.id}/attributes`, {
        method: "POST",
        token: accessToken,
        organizationId,
        body: JSON.stringify({ key: newAttrKey, value: newAttrValue }),
      }),
    onSuccess: () => {
      setNewAttrValue("");
      onInvalidate();
    },
  });

  const deleteAttribute = useMutation({
    mutationFn: (attributeId: string) =>
      api(`/brain/products/${product.id}/attributes/${attributeId}`, {
        method: "DELETE",
        token: accessToken,
        organizationId,
      }),
    onSuccess: onInvalidate,
  });

  const addFaq = useMutation({
    mutationFn: () =>
      api(`/brain/products/${product.id}/faqs`, {
        method: "POST",
        token: accessToken,
        organizationId,
        body: JSON.stringify({ question: newFaqQ, answer: newFaqA }),
      }),
    onSuccess: () => {
      setNewFaqQ("");
      setNewFaqA("");
      onInvalidate();
    },
  });

  const deleteFaq = useMutation({
    mutationFn: (faqId: string) =>
      api(`/brain/products/${product.id}/faqs/${faqId}`, {
        method: "DELETE",
        token: accessToken,
        organizationId,
      }),
    onSuccess: onInvalidate,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.brand ?? "No brand"} · {product.category ?? "No category"}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProductForm form={form} setForm={setForm} />
          <Button onClick={() => updateProduct.mutate()} disabled={updateProduct.isPending}>
            {updateProduct.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Product"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Attributes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {product.attributes.map((attr) => (
              <Badge key={attr.id} variant="outline" className="gap-2 px-3 py-1.5">
                {attr.key}: {attr.value}
                <button type="button" onClick={() => deleteAttribute.mutate(attr.id)}>×</button>
              </Badge>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={newAttrKey}
              onChange={(e) => setNewAttrKey(e.target.value)}
            >
              {COMMON_ATTRIBUTES.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
              <option value="custom">custom</option>
            </select>
            <Input
              placeholder={newAttrKey === "color" ? "Black" : "Value"}
              value={newAttrValue}
              onChange={(e) => setNewAttrValue(e.target.value)}
            />
            <Button disabled={!newAttrValue} onClick={() => addAttribute.mutate()}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product FAQs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {product.faqs.map((faq) => (
            <div key={faq.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{faq.question}</p>
                  <p className="mt-1 text-muted-foreground">{faq.answer}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteFaq.mutate(faq.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Input placeholder="Is this available in black?" value={newFaqQ} onChange={(e) => setNewFaqQ(e.target.value)} />
          <Textarea placeholder="Yes, available in black." value={newFaqA} onChange={(e) => setNewFaqA(e.target.value)} />
          <Button disabled={!newFaqQ || !newFaqA} onClick={() => addFaq.mutate()}>Add FAQ</Button>
        </CardContent>
      </Card>
    </>
  );
}

function ProductForm({
  form,
  setForm,
  readOnlyKeys = [],
}: {
  form: typeof EMPTY_FORM;
  setForm: (next: typeof EMPTY_FORM | ((prev: typeof EMPTY_FORM) => typeof EMPTY_FORM)) => void;
  readOnlyKeys?: string[];
}) {
  const update = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Product Name" value={form.name} onChange={(v) => update("name", v)} readOnly={readOnlyKeys.includes("name")} />
      <Field label="SKU" value={form.sku} onChange={(v) => update("sku", v)} />
      <Field label="Category" value={form.category} onChange={(v) => update("category", v)} />
      <Field label="Brand" value={form.brand} onChange={(v) => update("brand", v)} />
      <Field label="Price" value={form.price} onChange={(v) => update("price", v)} />
      <Field label="Sale Price" value={form.salePrice} onChange={(v) => update("salePrice", v)} />
      <div className="space-y-2 sm:col-span-2">
        <Label>Stock Status</Label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.stockStatus}
          onChange={(e) => update("stockStatus", e.target.value)}
        >
          {STOCK_STATUSES.map((status) => (
            <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Description</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Features (one per line)</Label>
        <Textarea rows={3} value={form.features} onChange={(e) => update("features", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Benefits (one per line)</Label>
        <Textarea rows={3} value={form.benefits} onChange={(e) => update("benefits", e.target.value)} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Specifications</Label>
        <Textarea rows={2} value={form.specifications} onChange={(e) => update("specifications", e.target.value)} />
      </div>
      <Field label="Product URL" value={form.productUrl} onChange={(v) => update("productUrl", v)} />
      <div className="space-y-2 sm:col-span-2">
        <Label>Product Images (one URL per line)</Label>
        <Textarea rows={2} value={form.images} onChange={(e) => update("images", e.target.value)} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
    </div>
  );
}
