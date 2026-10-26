'use client';

import type { DashboardStats } from '@/lib/types';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { AlertTriangle, Briefcase, Building2, RefreshCw, UserCheck, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const CARD_STYLES = [
  {
    key: 'developers' as const,
    label: 'Developers',
    icon: Users,
    iconClassName: 'bg-primary/10 text-primary',
  },
  {
    key: 'onBench' as const,
    label: 'On Bench',
    icon: UserCheck,
    iconClassName: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    key: 'assigned' as const,
    label: 'Assigned',
    icon: Briefcase,
    iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'clients' as const,
    label: 'Clients',
    icon: Building2,
    iconClassName: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
];

export function StatsCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/aya/stats', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Could not load dashboard stats (${response.status}).`);
      }
      setStats((await response.json()) as DashboardStats);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load dashboard stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Loading dashboard stats">
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
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          <p className="flex-1 text-sm text-destructive">{error ?? 'Stats are unavailable.'}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadStats()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CARD_STYLES.map((card) => {
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
                    {stats[card.key].toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Utilization: <strong className="text-foreground">{stats.utilizationRate}%</strong>
        </span>
        <span>
          Active contracts: <strong className="text-foreground">{stats.activeContracts}</strong>
        </span>
        <span>
          Expiring in 30 days:{' '}
          <strong className="text-foreground">{stats.expiringContracts}</strong>
        </span>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Open alerts: <strong className="text-foreground">{stats.openAlerts}</strong>
        </span>
      </div>
    </div>
  );
}
