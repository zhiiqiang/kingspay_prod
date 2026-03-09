import { ShieldOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function AccessDeniedPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-primary">
        <ShieldOff className="size-8" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          You do not have permission to view this page
        </h1>
        <p className="text-sm text-muted-foreground">
          Please contact your administrator if you believe this is a mistake.
        </p>
      </div>
      <Button asChild className="min-w-44 bg-primary text-white hover:bg-primary/90">
        <Link to="/admin/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
