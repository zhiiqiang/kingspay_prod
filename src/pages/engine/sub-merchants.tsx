import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface SubMerchantRow {
  id: string;
  name: string;
  email: string;
  ownerEmail?: string;
  status: 'Active' | 'Pending';
}

export function EngineSubMerchantsPage() {
  // initialize with empty array so no default rows are shown
  const [rows, setRows] = useState<SubMerchantRow[]>([]);
  const [form, setForm] = useState({ name: '', email: '' });

  const addRow = () => {
    if (!form.name || !form.email) return;
    const entry: SubMerchantRow = {
      id: `SM-${String(rows.length + 1).padStart(2, '0')}`,
      name: form.name,
      email: form.email,
      status: 'Pending',
    };
    setRows((prev) => [...prev, entry]);
    setForm({ name: '', email: '' });
  };

  const approveRow = (id: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status: 'Active' } : row)));
  };

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">Sub-Merchant Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add sub-merchant</CardTitle>
          <CardDescription>Create and invite a sub-merchant account.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder="Business name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            placeholder="Owner email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Button className="w-full" onClick={addRow}>
            Send invite
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sub-merchants</CardTitle>
          <CardDescription>Approve new merchants as soon as KYC is completed.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Owner Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell data-label="Merchant" className="font-medium">
                    {row.name}
                  </TableCell>
                  <TableCell data-label="Email">{row.email}</TableCell>
                  <TableCell data-label="Owner Email">{row.ownerEmail ?? row.email}</TableCell>
                  <TableCell data-label="Status">
                    <Badge
                      variant={row.status === 'Active' ? 'default' : 'outline'}
                      className={cn(
                        row.status === 'Active' &&
                          'rounded-md px-2 py-0.5 text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                      )}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Actions" className="text-right">
                    <Button variant="outline" size="sm" onClick={() => approveRow(row.id)}>
                      Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
