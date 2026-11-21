'use client';

import { forecastQuery } from '@/lib/queries';
import type { CapacityForecast, ForecastOpening } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader } from '@workspace/ui/components/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@workspace/ui/components/chart';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  AlertTriangle,
  CalendarClock,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const timelineChartConfig = {
  onBench: {
    label: 'Developers on bench',
    color: 'var(--chart-1)',
  },
  openings: {
    label: 'Contracts ending that week',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;
import { EmptyRows, LoadingRows, ManagementPage, QueryError } from '../management/ui';

const HORIZONS = [4, 8, 12, 26] as const;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function confidenceVariant(confidence: string): 'default' | 'secondary' | 'outline' {
  if (confidence === 'strong') return 'default';
  if (confidence === 'partial') return 'secondary';
  return 'outline';
}

function SummaryCards({ forecast }: { forecast: CapacityForecast }) {
  const cards = [
    {
      key: 'openings',
      label: 'Openings',
      value: forecast.summary.openings,
      detail: `${forecast.summary.clientsAffected} client${
        forecast.summary.clientsAffected === 1 ? '' : 's'
      } affected`,
      icon: CalendarClock,
      iconClassName: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    {
      key: 'bench',
      label: 'Available now',
      value: forecast.summary.onBenchNow,
      detail: `${forecast.summary.benchOver30Days} on bench 30+ days`,
      icon: UserCheck,
      iconClassName: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      key: 'projected',
      label: 'Projected bench',
      value: forecast.summary.projectedBench,
      detail: `in ${forecast.horizonWeeks} weeks`,
      icon: TrendingUp,
      iconClassName: 'bg-primary/10 text-primary',
    },
    {
      key: 'utilization',
      label: 'Projected utilization',
      value: `${forecast.summary.projectedUtilization}%`,
      detail: 'at the end of the horizon',
      icon: Users,
      iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key}>
            <CardContent className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconClassName}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{card.detail}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TimelineChart({ forecast }: { forecast: CapacityForecast }) {
  const data = forecast.timeline.map((week) => ({
    week: week.weekStart.slice(5),
    onBench: week.onBench,
    openings: week.openings,
    utilization: `${week.utilizationRate}%`,
  }));

  return (
    <Card>
      <CardHeader>
        <h3 className="font-heading text-base leading-snug font-medium">
          Weekly supply and demand
        </h3>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={timelineChartConfig}
          className="h-48 w-full"
          role="img"
          aria-label="Weekly bench capacity"
        >
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="onBench" fill="var(--color-onBench)" radius={4} />
            <Bar dataKey="openings" fill="var(--color-openings)" radius={4} />
          </BarChart>
        </ChartContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Projected utilization is shown per week in the chart tooltip.
        </p>
      </CardContent>
    </Card>
  );
}

function OpeningCard({ opening }: { opening: ForecastOpening }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{opening.client}</p>
            <p className="text-xs text-muted-foreground">
              {opening.developer} · {opening.developerSeniority} · {opening.clientIndustry}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {opening.renewalLikely ? <Badge variant="secondary">Renewal likely</Badge> : null}
            <Badge variant="outline">Ends {formatDate(opening.endDate)}</Badge>
            <Badge>{opening.daysUntilEnd}d</Badge>
          </div>
        </div>

        {opening.requiredSkills.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Skills needed:{' '}
            <span className="text-foreground">
              {opening.requiredSkills.map((skill) => skill.name).join(', ')}
            </span>
          </p>
        ) : null}

        <div className="space-y-2">
          {opening.recommendations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No bench developer is available in time for this opening.
            </p>
          ) : (
            opening.recommendations.map((recommendation) => (
              <div
                key={recommendation.developerId}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{recommendation.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={confidenceVariant(recommendation.confidence)}>
                      {recommendation.confidence}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      score {recommendation.score}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recommendation.seniority} · available{' '}
                  {recommendation.availableFrom
                    ? formatDate(recommendation.availableFrom)
                    : 'unknown'}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {recommendation.reasons.map((reason) => (
                    <li key={reason}>· {reason}</li>
                  ))}
                </ul>
                {recommendation.missingSkills.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Missing: {recommendation.missingSkills.join(', ')}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CapacityPage() {
  const [weeks, setWeeks] = useState<number>(8);
  const forecast = useQuery(forecastQuery(weeks));

  return (
    <ManagementPage
      title="Capacity"
      subtitle="Supply and demand forecast"
      description="Projected bench supply, contracts opening up, and recommended backfills for the coming weeks."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {HORIZONS.map((horizon) => (
              <Button
                key={horizon}
                type="button"
                size="sm"
                variant={weeks === horizon ? 'secondary' : 'ghost'}
                onClick={() => setWeeks(horizon)}
              >
                {horizon}w
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void forecast.refetch()}
            disabled={forecast.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      }
    >
      {forecast.isPending ? (
        <div className="space-y-4" aria-label="Loading capacity forecast">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Card key={index}>
                <CardContent className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <LoadingRows label="Loading capacity forecast…" />
          </Card>
        </div>
      ) : forecast.error ? (
        <QueryError message={forecast.error.message} />
      ) : !forecast.data ? (
        <Card>
          <EmptyRows message="The capacity forecast is unavailable." />
        </Card>
      ) : (
        <div className="space-y-4">
          <SummaryCards forecast={forecast.data} />
          <TimelineChart forecast={forecast.data} />

          <section className="space-y-3" aria-labelledby="openings-heading">
            <div>
              <h2 id="openings-heading" className="text-lg font-semibold tracking-tight">
                Openings and backfills
              </h2>
              <p className="text-sm text-muted-foreground">
                Contracts ending inside the horizon, with recommended bench candidates.
              </p>
            </div>
            {forecast.data.openings.length === 0 ? (
              <Card>
                <EmptyRows message="No contracts end inside this forecast window." />
              </Card>
            ) : (
              <div className="space-y-3">
                {forecast.data.openings.map((opening) => (
                  <OpeningCard key={opening.contractId} opening={opening} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="bench-heading">
            <div>
              <h2 id="bench-heading" className="text-lg font-semibold tracking-tight">
                Bench pool
              </h2>
              <p className="text-sm text-muted-foreground">
                Developers available today, longest on bench first.
              </p>
            </div>
            {forecast.data.benchPool.length === 0 ? (
              <Card>
                <EmptyRows message="Nobody is on the bench right now." />
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-3">
                  {forecast.data.benchPool.map((member) => (
                    <div
                      key={member.developerId}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.seniority} · {member.skills.join(', ') || 'No skills recorded'}
                        </p>
                      </div>
                      <Badge variant={member.benchDays > 30 ? 'destructive' : 'secondary'}>
                        {member.benchDays} days on bench
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>

          {forecast.data.summary.openings > forecast.data.summary.openingsWithRecommendations ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {forecast.data.summary.openings - forecast.data.summary.openingsWithRecommendations}{' '}
              opening
              {forecast.data.summary.openings -
                forecast.data.summary.openingsWithRecommendations ===
              1
                ? ''
                : 's'}{' '}
              have no available backfill candidate.
            </p>
          ) : null}
        </div>
      )}
    </ManagementPage>
  );
}
