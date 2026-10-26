'use client';

import { Button } from '@workspace/ui/components/button';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
