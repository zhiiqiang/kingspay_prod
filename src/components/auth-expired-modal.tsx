import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AUTH_EXPIRED_EVENT } from '@/lib/api';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type AuthExpiredDetail = {
  message?: string;
};

export function AuthExpiredModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const checkMissingToken = (currentPath: string) => {
    if (currentPath.startsWith('/login')) {
      return;
    }

    const token = window.localStorage.getItem('kp-auth-token');
    if (!token) {
      setOpen(false);
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => {
    const handleAuthExpired = (event: Event) => {
      const detail = (event as CustomEvent<AuthExpiredDetail>).detail;
      setMessage(detail?.message ?? null);
      setOpen(true);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    checkMissingToken(location.pathname);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [location.pathname]);

  const handleLoginRedirect = () => {
    setOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="rounded-lg sm:rounded-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-2">
          <p className="text-sm text-muted-foreground max-[680px]:text-center">
            {message ??
              'Your session is no longer valid. Please log in again to continue using the admin dashboard.'}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button className="w-full bg-primary text-white hover:bg-primary/90 md:w-auto md:self-stretch" onClick={handleLoginRedirect}>
            Go to login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
