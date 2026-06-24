"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendPoint {
  date: string;
  count?: number;
  score?: number;
}

function MiniBarChart({
  data,
  valueKey,
  maxValue,
  colorClass,
}: {
  data: TrendPoint[];
  valueKey: "count" | "score";
  maxValue: number;
  colorClass: string;
}) {
  const safeMax = maxValue || 1;

  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((point) => {
        const value = point[valueKey] ?? 0;
        const height = Math.max(4, Math.round((value / safeMax) * 100));
        return (
          <div key={point.date} className="group flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm ${colorClass} transition-all group-hover:opacity-80`}
              style={{ height: `${height}%` }}
              title={`${point.date}: ${value}`}
            />
            <span className="hidden text-[10px] text-muted-foreground sm:block">
              {point.date.slice(8)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({
  title,
  description,
  data,
  valueKey,
  colorClass,
}: {
  title: string;
  description: string;
  data: TrendPoint[];
  valueKey: "count" | "score";
  colorClass: string;
}) {
  const maxValue = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  const total = data.reduce((sum, d) => sum + (d[valueKey] ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {description} · Last 30 days · Total {total}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MiniBarChart data={data} valueKey={valueKey} maxValue={maxValue} colorClass={colorClass} />
      </CardContent>
    </Card>
  );
}

interface BrainAnalyticsChartsProps {
  knowledgeGrowth: TrendPoint[];
  learningGrowth: TrendPoint[];
  confidenceTrend: TrendPoint[];
}

export function BrainAnalyticsCharts({
  knowledgeGrowth,
  learningGrowth,
  confidenceTrend,
}: BrainAnalyticsChartsProps) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ChartCard
        title="Knowledge Growth"
        description="Entries, FAQs, and documents added"
        data={knowledgeGrowth}
        valueKey="count"
        colorClass="bg-primary"
      />
      <ChartCard
        title="Learning Growth"
        description="Suggestions and customer memories"
        data={learningGrowth}
        valueKey="count"
        colorClass="bg-emerald-500"
      />
      <ChartCard
        title="Confidence Trend"
        description="Average AI confidence score"
        data={confidenceTrend}
        valueKey="score"
        colorClass="bg-amber-500"
      />
    </div>
  );
}
