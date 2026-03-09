import { FormEvent, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Settings, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { useLanguage } from '@/i18n/language-provider';

const initialFormState = {
  oldPassword: '',
  newPassword: '',
  verifPassword: '',
};

type ChangePasswordResponse = {
  status?: boolean;
  message?: string;
};

export function AccountSettingsPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState(initialFormState);
  const [showPasswords, setShowPasswords] = useState({
    oldPassword: false,
    newPassword: false,
    verifPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.oldPassword || !form.newPassword || !form.verifPassword) {
      toast.error(t('accountSettings.validation.required'), {
        duration: 1500,
        icon: <XCircle className="h-5 w-5 text-rose-500" />,
      });
      return;
    }

    if (form.newPassword !== form.verifPassword) {
      toast.error(t('accountSettings.validation.mismatch'), {
        duration: 1500,
        icon: <XCircle className="h-5 w-5 text-rose-500" />,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch<ChangePasswordResponse>('/auth/change-password', {
        method: 'POST',
        body: {
          oldPassword: form.oldPassword,
          newPassword: form.newPassword,
          verifPassword: form.verifPassword,
        },
      });

      toast.success(response.message ?? t('accountSettings.toast.success'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      setForm(initialFormState);
    } catch (error) {
      if (error instanceof ApiAuthError) {
        toast.error(t('auth.sessionExpired'), {
          duration: 1500,
          icon: <XCircle className="h-5 w-5 text-rose-500" />,
        });
      } else {
        toast.error(error instanceof Error ? error.message : t('accountSettings.toast.error'), {
          duration: 1500,
          icon: <XCircle className="h-5 w-5 text-rose-500" />,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-background">
            <Settings className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight">{t('accountSettings.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('accountSettings.subtitle')}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountSettings.changePassword.title')}</CardTitle>
          <CardDescription>{t('accountSettings.changePassword.description')}</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-5">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="old-password">{t('accountSettings.fields.oldPassword')}</Label>
                <div className="relative">
                  <Input
                    id="old-password"
                    type={showPasswords.oldPassword ? 'text' : 'password'}
                    value={form.oldPassword}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, oldPassword: event.target.value }))
                    }
                    placeholder={t('accountSettings.placeholders.oldPassword')}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPasswords.oldPassword
                        ? t('accountSettings.actions.hidePassword')
                        : t('accountSettings.actions.showPassword')
                    }
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        oldPassword: !prev.oldPassword,
                      }))
                    }
                  >
                    {showPasswords.oldPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="new-password">{t('accountSettings.fields.newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPasswords.newPassword ? 'text' : 'password'}
                    value={form.newPassword}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                    placeholder={t('accountSettings.placeholders.newPassword')}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPasswords.newPassword
                        ? t('accountSettings.actions.hidePassword')
                        : t('accountSettings.actions.showPassword')
                    }
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        newPassword: !prev.newPassword,
                      }))
                    }
                  >
                    {showPasswords.newPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="verify-password">{t('accountSettings.fields.verifyPassword')}</Label>
                <div className="relative">
                  <Input
                    id="verify-password"
                    type={showPasswords.verifPassword ? 'text' : 'password'}
                    value={form.verifPassword}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, verifPassword: event.target.value }))
                    }
                    placeholder={t('accountSettings.placeholders.verifyPassword')}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPasswords.verifPassword
                        ? t('accountSettings.actions.hidePassword')
                        : t('accountSettings.actions.showPassword')
                    }
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        verifPassword: !prev.verifPassword,
                      }))
                    }
                  >
                    {showPasswords.verifPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('accountSettings.actions.savePassword')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
