import { SidebarTrigger } from '@workspace/ui/components/sidebar';
import { cn } from '@workspace/ui/lib/utils';

export function PageHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
