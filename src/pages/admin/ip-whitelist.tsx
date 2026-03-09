import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface WhitelistRow {
  id: string;
  cidr: string;
  description: string;
}

export function AdminIpWhitelistPage() {
  // initialize empty; backend should provide rows when available
  const [rows, setRows] = useState<WhitelistRow[]>([]);
  const [form, setForm] = useState({ cidr: '', description: '' });

  const addRow = () => {
    if (!form.cidr) return;
    const entry: WhitelistRow = {
      id: `WL-${String(rows.length + 1).padStart(2, '0')}`,
      cidr: form.cidr,
      description: form.description || 'No description',
    };
    setRows((prev) => [...prev, entry]);
    setForm({ cidr: '', description: '' });
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">IP Whitelist</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add allowed IP</CardTitle>
          <CardDescription>Apply CIDR notation for ranges.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder="e.g. 203.0.113.10/32"
            value={form.cidr}
            onChange={(event) => setForm((prev) => ({ ...prev, cidr: event.target.value }))}
          />
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <Button onClick={addRow} className="w-full">
            Save entry
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed ranges</CardTitle>
          <CardDescription>Remove stale records as networks are rotated.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>CIDR</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell data-label="Record" className="font-medium">
                    {row.id}
                  </TableCell>
                  <TableCell data-label="CIDR">{row.cidr}</TableCell>
                  <TableCell data-label="Description">{row.description}</TableCell>
                  <TableCell data-label="Actions" className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => removeRow(row.id)}>
                      Remove
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
