import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type NotFoundPageProps = {
  fullScreen?: boolean;
};

export function NotFoundPage({ fullScreen = false }: NotFoundPageProps) {
  return (
    <div
      className={[
        'flex w-full flex-col items-center justify-center gap-6 px-4 text-center',
        fullScreen ? 'min-h-screen' : 'min-h-[70vh]',
      ].join(' ')}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-primary">
        <AlertTriangle className="size-8" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Button asChild className="min-w-44 bg-primary text-white hover:bg-primary/90">
        <Link to="/admin/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
