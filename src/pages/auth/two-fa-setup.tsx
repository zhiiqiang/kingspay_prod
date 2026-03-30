import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router';
import { CheckCircle2, Copy, MoonStar, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Switch } from '@/components/ui/switch';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';

const TWO_FA_SETUP_STORAGE_KEY = 'kp-two-fa-setup';

type TwoFaSetupPayload = {
  status?: boolean;
  message?: string;
  name?: string;
  setupToken?: string;
  twoFaId?: string;
  otpauthUrl?: string;
  permissions?: string | string[] | null;
  role?: 'admin';
  wait?: number;
  setupExpiresAt?: number;
};

type TwoFaVerifyResponse = {
  logId?: string;
  status?: boolean;
  message?: string;
};

const createQrImageUrl = (otpauthUrl?: string) => {
  if (!otpauthUrl) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpauthUrl)}`;
};

export function TwoFaSetupPage() {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDarkMode = resolvedTheme === 'dark';

  const payload = useMemo((): TwoFaSetupPayload | null => {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(TWO_FA_SETUP_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TwoFaSetupPayload;
    } catch {
      return null;
    }
  }, []);
  const [countdown, setCountdown] = useState(0);
  const [isCountdownReady, setIsCountdownReady] = useState(false);

  useEffect(() => {
    if (!payload) {
      navigate('/login', { replace: true });
    }
  }, [navigate, payload]);
  const waitSeconds = typeof payload?.wait === 'number' ? payload.wait : 0;
  const setupExpiresAt = typeof payload?.setupExpiresAt === 'number' ? payload.setupExpiresAt : 0;
  const setupToken = payload?.setupToken?.trim() ?? '';
  const countdownMinutes = Math.floor(countdown / 60);
  const countdownRemainderSeconds = countdown % 60;

  useEffect(() => {
    if (!payload) return;
    if (waitSeconds <= 0) {
      setIsCountdownReady(true);
      return;
    }
    if (setupExpiresAt > 0) {
      const remaining = Math.max(0, Math.ceil((setupExpiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      setIsCountdownReady(true);
      return;
    }
    setCountdown(waitSeconds);
    setIsCountdownReady(true);
  }, [payload, setupExpiresAt, waitSeconds]);

  useEffect(() => {
    if (waitSeconds <= 0 || countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown, waitSeconds]);

  useEffect(() => {
    if (!isCountdownReady || waitSeconds <= 0 || countdown > 0) return;
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(TWO_FA_SETUP_STORAGE_KEY);
    }
    toast.error('2FA setup session expired. Please sign in again.');
    navigate('/login', { replace: true });
  }, [countdown, isCountdownReady, navigate, waitSeconds]);

  if (!payload) {
    return null;
  }

  const qrImageUrl = createQrImageUrl(payload.otpauthUrl);

  const handleCopySecret = async () => {
    const secret = payload.twoFaId?.trim();
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success('Secret key copied');
    } catch {
      toast.error('Failed to copy secret key');
    }
  };

  const handleVerifySetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!setupToken || !code.trim()) return;

    setError('');
    setIsSubmitting(true);
    try {
      const response = await apiFetch<TwoFaVerifyResponse>('/auth/2fa/setup/verify', {
        method: 'POST',
        body: {
          setupToken,
          code: code.trim(),
        },
      });

      if (!response.status) {
        throw new Error(response.message || 'Unable to verify 2FA setup.');
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(TWO_FA_SETUP_STORAGE_KEY);
      }
      toast.success(response.message || '2FA setup success, Please login again');
      navigate('/login', { replace: true });
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : 'Unable to verify 2FA setup.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative grid min-h-screen w-full bg-muted/60 dark:bg-[#0c0f14] lg:grid-cols-2">
      <Helmet>
        <title>Kingspay Administrator | Setup 2FA</title>
      </Helmet>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden lg:hidden">
        <div className="absolute left-1/2 top-[45%] size-[520px] -translate-x-1/2 -translate-y-1/2">
          <div className="size-full rounded-full bg-[conic-gradient(from_90deg,rgba(214,182,87,0.5),rgba(214,182,87,0.2),transparent_65%)] opacity-80 blur-[120px] animate-[vortex-spin_18s_linear_infinite] dark:bg-[conic-gradient(from_90deg,rgba(214,182,87,0.28),rgba(214,182,87,0.08),transparent_70%)]" />
        </div>
      </div>

      <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between sm:left-6 sm:right-6 sm:top-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-md border border-border/60 bg-background/95 shadow-sm">
            <img src={toAbsoluteUrl('/media/logo/mini-logo.svg')} alt="Kingspay" className="size-7" />
          </div>
          <span className="text-sm uppercase tracking-[0.25rem] text-primary">Kingspay</span>
        </div>
        <LanguageSwitcher
          size="sm"
          showLabel={false}
          className="w-[64px] bg-background/95 backdrop-blur sm:w-[120px]"
        />
      </div>

      <div className="absolute right-6 top-6 z-20 hidden lg:flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Sun
            className={cn('size-4 transition-colors', isDarkMode ? 'text-muted-foreground' : 'text-foreground')}
          />
          <Switch checked={isDarkMode} onCheckedChange={() => setTheme(isDarkMode ? 'light' : 'dark')} />
          <MoonStar
            className={cn('size-4 transition-colors', isDarkMode ? 'text-foreground' : 'text-muted-foreground')}
          />
        </div>
        <LanguageSwitcher
          size="sm"
          showLabel={false}
          className="w-[140px] bg-background/95 backdrop-blur"
        />
      </div>

      <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-primary/12 via-white to-muted dark:from-primary/8 dark:via-[#0d1117] dark:to-[#0c0f14] lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(214,182,87,0.14),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(214,182,87,0.18),transparent_30%),radial-gradient(circle_at_55%_80%,rgba(214,182,87,0.12),transparent_35%)]" />
        <div className="pointer-events-none absolute -left-40 top-1/2 z-0 size-[680px] -translate-y-1/2">
          <div className="size-full rounded-full bg-[conic-gradient(from_120deg,rgba(214,182,87,0.45),rgba(214,182,87,0.15),transparent_70%)] opacity-90 blur-[140px] animate-[vortex-spin_24s_linear_infinite] dark:bg-[conic-gradient(from_120deg,rgba(214,182,87,0.22),rgba(214,182,87,0.06),transparent_75%)]" />
        </div>
        <div className="relative z-10 max-w-xl space-y-8 px-12 py-16">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md border border-border/60 bg-background/95 shadow-sm">
                <img src={toAbsoluteUrl('/media/logo/mini-logo.svg')} alt="Kingspay" className="size-6" />
              </div>
              <p className="text-sm uppercase tracking-[0.25rem] text-primary">Kingspay</p>
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-foreground">Secure your account with 2FA</h1>
            <p className="text-lg text-muted-foreground">
              Complete one-time authenticator setup to continue using the Kingspay admin dashboard.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center px-4 pb-12 pt-24 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent lg:hidden" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(circle_at_50%_100%,rgba(214,182,87,0.4),transparent_65%)] opacity-80 blur-3xl animate-[pulse_6s_ease-in-out_infinite] lg:hidden dark:bg-[radial-gradient(circle_at_50%_100%,rgba(214,182,87,0.22),transparent_70%)]" />
        <Card className="relative w-full max-w-md rounded-xl border border-border/80 bg-card/95 shadow-[0_20px_80px_rgba(0,0,0,0.12)] backdrop-blur-lg dark:border-white/10 dark:bg-[rgba(14,16,22,0.92)] dark:shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <CardHeader className="space-y-4 border-0 px-6 pb-2 pt-8 text-left sm:px-8">
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-2">
                <CardTitle className="text-xl font-semibold leading-tight text-foreground">
                  Set up two-factor authentication
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {payload.message || 'First-time setup is required before you can continue login.'}
                </CardDescription>
              </div>
              <div className="text-sm">
                <span className="text-sm font-semibold text-foreground text-primary">Kingspay</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-6 pb-8 pt-4 sm:px-8">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Open Google Authenticator (or another TOTP app).</li>
              <li>Scan the QR code below, or add manually using the secret key.</li>
              <li>Enter the generated code below to finish setup.</li>
            </ol>

            {qrImageUrl && (
              <div className="space-y-2">
                <div className="flex justify-center rounded-lg border border-border/60 bg-white p-4">
                  <img src={qrImageUrl} alt="2FA setup QR code" className="h-52 w-52 sm:h-56 sm:w-56" />
                </div>
                {waitSeconds > 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    Setup session expires in {countdownMinutes}m {countdownRemainderSeconds}s
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="whitespace-nowrap text-center text-xs sm:text-[11px]">
                <span className="font-semibold text-foreground">Secret Key: </span>
                <span className="text-muted-foreground">{payload.twoFaId || '-'}</span>
                {payload.twoFaId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-1 inline-flex h-4 w-4 align-middle text-muted-foreground hover:text-foreground"
                    onClick={handleCopySecret}
                    aria-label="Copy secret key"
                    title="Copy secret key"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleVerifySetup}>
              <div className="space-y-2 text-left">
                <Label htmlFor="twoFaCode">Verification Code</Label>
                <Input
                  id="twoFaCode"
                  name="twoFaCode"
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
                {error && (
                  <Alert
                    variant="destructive"
                    appearance="light"
                    size="sm"
                    className="border-destructive/30 bg-destructive/5 text-destructive"
                  >
                    {error}
                  </Alert>
                )}
              </div>
              <Button
                className="w-full rounded-lg bg-[#d6b657] text-base font-semibold text-white shadow-[0_12px_35px_rgba(214,182,87,0.45)] transition hover:bg-[#c8a84b]"
                type="submit"
                disabled={isSubmitting || !setupToken || !code.trim() || (waitSeconds > 0 && countdown <= 0)}
              >
                {isSubmitting ? 'Verifying...' : 'Verify setup'}
              </Button>
            </form>

            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.removeItem(TWO_FA_SETUP_STORAGE_KEY);
                }
                navigate('/login', { replace: true });
              }}
            >
              Back to Login
            </Button>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>After successful verification, you will be redirected to login.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
