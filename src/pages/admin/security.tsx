import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff } from 'lucide-react';

export function AdminSecurityPage() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState<string>('');
  const [mfa, setMfa] = useState<boolean>(true);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const updatePassword = () => {
    if (!form.current || !form.next || form.next !== form.confirm) {
      setPasswordMessage('Passwords do not match or are incomplete.');
      return;
    }
    setPasswordMessage('Password updated and session refreshed.');
    setForm({ current: '', next: '', confirm: '' });
  };

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">Change Password &amp; Security</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update password</CardTitle>
          <CardDescription>Require a strong passphrase for all operator roles.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="current">Current password</Label>
              <div className="relative">
                <Input
                  id="current"
                  type={showPasswords.current ? 'text' : 'password'}
                  value={form.current}
                  onChange={(event) => setForm((prev) => ({ ...prev, current: event.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                >
                  {showPasswords.current ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="next">New password</Label>
              <div className="relative">
                <Input
                  id="next"
                  type={showPasswords.next ? 'text' : 'password'}
                  value={form.next}
                  onChange={(event) => setForm((prev) => ({ ...prev, next: event.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPasswords.next ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPasswords((prev) => ({ ...prev, next: !prev.next }))}
                >
                  {showPasswords.next ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                >
                  {showPasswords.confirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
          <Button onClick={updatePassword}>Save changes</Button>
          {passwordMessage && <div className="text-sm text-primary">{passwordMessage}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session enforcement</CardTitle>
          <CardDescription>Enable multi-factor auth and revoke active tokens.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <Switch checked={mfa} onCheckedChange={setMfa} />
            Require multi-factor authentication for all operators
          </label>
          <Button variant="outline">Revoke all active sessions</Button>
        </CardContent>
      </Card>
    </div>
  );
}
