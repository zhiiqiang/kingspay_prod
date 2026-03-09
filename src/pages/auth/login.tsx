import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Helmet } from 'react-helmet-async';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2, Eye, EyeOff, MoonStar, Sun } from 'lucide-react';

import { ApiResponseError, apiFetch } from '@/lib/api';
import { LanguageSwitcher } from '@/components/language-switcher';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  persistAuthToken,
  persistUserName,
  persistUserPermissions,
  persistUserRole,
} from '@/lib/auth';
import { useLanguage } from '@/i18n/language-provider';
import { useTheme } from 'next-themes';
import { Switch } from '@/components/ui/switch';

type LoginResponse = {
  status?: boolean;
  message?: string;
  accessToken?: string;
  token?: string;
  role?: 'admin';
  name?: string;
  permissions?: string | string[] | null;
  redirectPath?: string;
};

type OtpResponse = {
  status?: boolean;
  message?: string;
  wait?: number;
};

const DEFAULT_REDIRECT = '/admin/dashboard';
const OTP_RESEND_DELAY_SECONDS = 190;
const OTP_STORAGE_KEY = 'kp-otp-login';
const OTP_SESSION_TTL_MS = 3 * 60 * 1000;

type OtpSession = {
  email: string;
  password: string;
  requestedAt: number;
  resendAvailableAt: number;
  expiresAt: number;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const isDarkMode = resolvedTheme === 'dark';
  const isResendDisabled = otpCountdown > 0 || isRequestingOtp;

  const resendCountdownLabel = useMemo(() => {
    if (otpCountdown <= 0) return '';
    return t('login.otpResendCountdown').replace('{seconds}', String(otpCountdown));
  }, [otpCountdown, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(OTP_STORAGE_KEY);
    if (!stored) return;
    try {
      const session = JSON.parse(stored) as OtpSession;
      if (session.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(OTP_STORAGE_KEY);
        return;
      }
      setEmail(session.email);
      setPassword(session.password);
      setOtpRequested(true);
      const remaining = Math.max(0, Math.ceil((session.resendAvailableAt - Date.now()) / 1000));
      setOtpCountdown(remaining);
    } catch {
      window.sessionStorage.removeItem(OTP_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpCountdown]);

  const persistOtpSession = (requestedAt: number, resendAvailableAt: number) => {
    if (typeof window === 'undefined') return;
    const session: OtpSession = {
      email: email.trim(),
      password,
      requestedAt,
      resendAvailableAt,
      expiresAt: requestedAt + OTP_SESSION_TTL_MS,
    };
    window.sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(session));
  };

  const clearOtpSession = () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(OTP_STORAGE_KEY);
  };

  const handleRequestOtp = async () => {
    setError('');
    setIsRequestingOtp(true);

    try {
      const response = await apiFetch<OtpResponse>('/auth/login/otp', {
        method: 'POST',
        body: {
          email: email.trim(),
          password,
        },
      });

      const waitSeconds =
        typeof response.wait === 'number' && response.wait > 0
          ? Math.ceil(response.wait)
          : OTP_RESEND_DELAY_SECONDS;
      const requestedAt = Date.now();
      const resendAvailableAt = requestedAt + waitSeconds * 1000;
      setOtpRequested(true);
      setOtpCountdown(waitSeconds);
      persistOtpSession(requestedAt, resendAvailableAt);
      toast.success(otpRequested ? t('login.otpResent') : t('login.otpSent'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
    } catch (exception) {
      if (exception instanceof ApiResponseError) {
        const responseBody = exception.responseBody as OtpResponse | null;
        const message = responseBody?.message ?? exception.message;
        const alreadySent = message.toLowerCase().includes('otp already sent');
        if (alreadySent) {
          const waitSeconds =
            typeof responseBody?.wait === 'number' && responseBody.wait > 0
              ? Math.ceil(responseBody.wait)
              : OTP_RESEND_DELAY_SECONDS;
          const now = Date.now();
          const resendAvailableAt = now + waitSeconds * 1000;
          if (typeof window !== 'undefined') {
            const stored = window.sessionStorage.getItem(OTP_STORAGE_KEY);
            if (stored) {
              try {
                const session = JSON.parse(stored) as OtpSession;
                if (session.expiresAt > Date.now()) {
                  setOtpRequested(true);
                  const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
                  setOtpCountdown(remaining);
                  persistOtpSession(now, resendAvailableAt);
                  toast.message(t('login.otpAlreadySent'), { duration: 1500 });
                  return;
                }
              } catch {
                window.sessionStorage.removeItem(OTP_STORAGE_KEY);
              }
            }
          }
          setOtpRequested(true);
          setOtpCountdown(waitSeconds);
          persistOtpSession(now, resendAvailableAt);
          toast.message(t('login.otpAlreadySent'), { duration: 1500 });
          return;
        }
      }
      setError(exception instanceof Error ? exception.message : t('login.errorFallback'));
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: email.trim(),
          password,
          otp,
        },
      });

      const authToken = response.accessToken ?? response.token;

      if (!authToken) {
        throw new Error(response.message || t('login.missingToken'));
      }

      persistAuthToken(authToken);
      persistUserRole(response.role ?? 'admin');
      persistUserPermissions(response.permissions);
      persistUserName(response.name ?? '');
      clearOtpSession();
      toast.success(t('login.success'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      navigate(response.redirectPath ?? DEFAULT_REDIRECT, { replace: true });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : t('login.errorFallback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleRequestOtp();
  };

  const handleEditCredentials = () => {
    setOtpRequested(false);
    setOtp('');
    setOtpCountdown(0);
    clearOtpSession();
  };

  return (
    <div className="relative grid min-h-screen w-full bg-muted/60 dark:bg-[#0c0f14] lg:grid-cols-2">
      <Helmet>
        <title>{t('login.pageTitle')}</title>
      </Helmet>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden lg:hidden">
        <div className="absolute left-1/2 top-[45%] size-[520px] -translate-x-1/2 -translate-y-1/2">
          <div className="size-full rounded-full bg-[conic-gradient(from_90deg,rgba(214,182,87,0.5),rgba(214,182,87,0.2),transparent_65%)] opacity-80 blur-[120px] animate-[vortex-spin_18s_linear_infinite] dark:bg-[conic-gradient(from_90deg,rgba(214,182,87,0.28),rgba(214,182,87,0.08),transparent_70%)]" />
        </div>
      </div>

      <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between sm:left-6 sm:right-6 sm:top-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-md border border-border/60 bg-background/95 shadow-sm">
            <img
              src={toAbsoluteUrl('/media/logo/mini-logo.svg')}
              alt={t('login.brand')}
              className="size-7"
            />
          </div>
          <span className="text-sm uppercase tracking-[0.25rem] text-primary">
            {t('login.brand')}
          </span>
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
            className={cn(
              'size-4 transition-colors',
              isDarkMode ? 'text-muted-foreground' : 'text-foreground',
            )}
          />
          <Switch
            checked={isDarkMode}
            onCheckedChange={() => setTheme(isDarkMode ? 'light' : 'dark')}
          />
          <MoonStar
            className={cn(
              'size-4 transition-colors',
              isDarkMode ? 'text-foreground' : 'text-muted-foreground',
            )}
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
                <img
                  src={toAbsoluteUrl('/media/logo/mini-logo.svg')}
                  alt={t('login.brand')}
                  className="size-6"
                />
              </div>
              <p className="text-sm uppercase tracking-[0.25rem] text-primary">
                {t('login.brand')}
              </p>
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-foreground">
              {t('login.welcomeTitle')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('login.welcomeDescription')}
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
                  {t('login.cardTitle')}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {t('login.cardDescription')}
                </CardDescription>
              </div>
              <div className='text-sm'>
                <span className="text-sm font-semibold text-foreground text-primary">
                  {t('login.brand')}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-8 pt-4 sm:px-8">
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

            {!otpRequested ? (
              <form className="space-y-5" onSubmit={handleCredentialsSubmit}>
                <div className="space-y-2 text-left">
                  <Label htmlFor="email">{t('login.emailLabel')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 text-left">
                  <Label htmlFor="password">{t('login.passwordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder={t('login.passwordPlaceholder')}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showPassword ? t('login.hidePassword') : t('login.showPassword')
                      }
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full rounded-lg bg-[#d6b657] text-base font-semibold text-white shadow-[0_12px_35px_rgba(214,182,87,0.45)] transition hover:bg-[#c8a84b]"
                  type="submit"
                  disabled={isRequestingOtp}
                >
                  {isRequestingOtp ? t('login.requestingOtp') : t('login.requestOtp')}
                </Button>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-left">
                  <p className="text-sm font-medium text-foreground">
                    {t('login.otpSentTo')}
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{t('login.emailLabel')}: </span>
                      {email}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        {t('login.passwordLabel')}:{' '}
                      </span>
                      {t('login.passwordHidden')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs text-primary hover:text-primary/80"
                    onClick={handleEditCredentials}
                  >
                    {t('login.editCredentials')}
                  </Button>
                </div>

                <div className="space-y-2 text-left">
                  <Label htmlFor="otp">{t('login.otpLabel')}</Label>
                  <Input
                    id="otp"
                    name="otp"
                    type="text"
                    autoComplete="one-time-code"
                    placeholder={t('login.otpPlaceholder')}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Button
                    className="w-full rounded-lg bg-[#d6b657] text-base font-semibold text-white shadow-[0_12px_35px_rgba(214,182,87,0.45)] transition hover:bg-[#c8a84b]"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t('login.submitting') : t('login.submit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isResendDisabled}
                    onClick={handleRequestOtp}
                  >
                    {isResendDisabled ? resendCountdownLabel : t('login.resendOtp')}
                  </Button>
                </div>
              </form>
            )}
            <div className="space-y-3 text-center">
              <p className="text-xs text-left text-muted-foreground sm:text-center">
                {t('login.terms')}
              </p>
              <div className="flex items-center justify-center gap-3 px-4 py-2 text-sm text-foreground lg:hidden">
                <Sun
                  className={cn(
                    'size-4 transition-colors',
                    isDarkMode ? 'text-muted-foreground' : 'text-foreground',
                  )}
                />
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={() => setTheme(isDarkMode ? 'light' : 'dark')}
                />
                <MoonStar
                  className={cn(
                    'size-4 transition-colors',
                    isDarkMode ? 'text-foreground' : 'text-muted-foreground',
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
