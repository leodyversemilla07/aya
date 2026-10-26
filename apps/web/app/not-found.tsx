import { Button } from '@workspace/ui/components/button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist. Head back to the dashboard to keep working with
        Aya.
      </p>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
