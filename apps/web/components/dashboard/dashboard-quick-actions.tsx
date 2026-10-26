'use client';

import { Button } from '@workspace/ui/components/button';
import { AlertTriangle, BarChart3, Bell, FileText, UserCheck } from 'lucide-react';

const ACTIONS = [
  {
    label: 'Bench status',
    icon: UserCheck,
    className: 'text-amber-600 dark:text-amber-400',
    query: 'Show me developers on the bench',
  },
  {
    label: 'Utilization',
    icon: BarChart3,
    className: 'text-emerald-600 dark:text-emerald-400',
    query: 'What is our utilization rate?',
  },
  {
    label: 'Renewals',
    icon: FileText,
    className: 'text-red-600 dark:text-red-400',
    query: 'Show me contracts expiring this month',
  },
  {
    label: 'Alerts',
    icon: Bell,
    className: 'text-orange-600 dark:text-orange-400',
    query: 'Show me all active alerts',
  },
];

export function DashboardQuickActions({ onAction }: { onAction: (query: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((action) => (
        <Button
          key={action.label}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAction(action.query)}
        >
          <action.icon className={`mr-2 h-4 w-4 ${action.className}`} aria-hidden="true" />
          {action.label}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onAction('Show all active risk alerts')}
      >
        <AlertTriangle
          className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        Risk review
      </Button>
    </div>
  );
}
