import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/utils/number-format';
import { cn } from '@/lib/utils';

interface Engine {
  id: string;
  name: string;
  contact: string;
  fee: number;
  status: 'Active' | 'Onboarding';
}

interface PayIn {
  id: string;
  engine: string;
  channel: string;
  amount: number;
  status: 'Captured' | 'Pending' | 'Failed';
}

// initialize without mock data; real data should come from backend
const initialEngines: Engine[] = [];
const initialPayIns: PayIn[] = [];

export function AdminEngineManagementPage() {
  const [engines, setEngines] = useState<Engine[]>(initialEngines);
  const [payIns, setPayIns] = useState<PayIn[]>(initialPayIns);
  const [filterEngine, setFilterEngine] = useState<string>('all');
  const [callbackLog, setCallbackLog] = useState<string>('');
  const [form, setForm] = useState({ name: '', contact: '', fee: 1000 });

  const filteredPayIns = useMemo(() => {
    if (filterEngine === 'all') return payIns;
    return payIns.filter((txn) => txn.engine === filterEngine);
  }, [filterEngine, payIns]);

  const addEngine = () => {
    if (!form.name || !form.contact) return;
    const engine: Engine = {
      id: `EN-${String(engines.length + 1).padStart(3, '0')}`,
      name: form.name,
      contact: form.contact,
      fee: form.fee,
      status: 'Onboarding',
    };
    setEngines((prev) => [...prev, engine]);
    setForm({ name: '', contact: '', fee: 1000 });
  };

  const updateFee = (id: string, fee: number) => {
    setEngines((prev) => prev.map((engine) => (engine.id === id ? { ...engine, fee } : engine)));
  };

  const sendCallback = (id: string) => {
    const message = `Callback queued for ${id} at ${new Date().toLocaleTimeString()}`;
    setCallbackLog(message);
  };

  const markStatus = (id: string, status: PayIn['status']) => {
    setPayIns((prev) => prev.map((txn) => (txn.id === id ? { ...txn, status } : txn)));
  };

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">Engine Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add engine</CardTitle>
          <CardDescription>Capture onboarding details and pricing before activation.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Input
            placeholder="Engine name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            placeholder="Finance contact"
            value={form.contact}
            onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))}
          />
          <div>
            <Label htmlFor="fee">Fee (IDR)</Label>
            <Input
              id="fee"
              type="number"
              value={form.fee}
              onChange={(event) => setForm((prev) => ({ ...prev, fee: Number(event.target.value) }))}
            />
          </div>
          <Button onClick={addEngine} className="w-full self-end">
            Save engine
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engine pricing</CardTitle>
          <CardDescription>Inline edits update fee schedules instantly.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engine</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fee / trx</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {engines.map((engine) => (
                <TableRow key={engine.id}>
                  <TableCell data-label="Engine" className="font-medium">
                    {engine.name}
                  </TableCell>
                  <TableCell data-label="Contact" className="text-sm text-muted-foreground">
                    {engine.contact}
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge
                      variant={engine.status === 'Active' ? 'default' : 'outline'}
                      className={cn(
                        engine.status === 'Active' &&
                          'rounded-md px-2 py-0.5 text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                      )}
                    >
                      {engine.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Fee / trx">
                    <Input
                      type="number"
                      value={engine.fee}
                      onChange={(event) => updateFee(engine.id, Number(event.target.value))}
                    />
                  </TableCell>
                  <TableCell data-label="Update" className="text-right">
                    <Button variant="outline" size="sm">
                      Save pricing
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>QRIS transaction monitoring</CardTitle>
            <CardDescription>Filter payin activity and correct the status before resending callbacks.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Filter by engine"
              className="w-[200px]"
              value={filterEngine === 'all' ? '' : filterEngine}
              onChange={(event) => setFilterEngine(event.target.value || 'all')}
            />
            <Button variant="outline" onClick={() => setFilterEngine('all')}>
              Clear filter
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayIns.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell data-label="Transaction" className="font-medium">
                    {txn.id}
                  </TableCell>
                  <TableCell data-label="Engine">{txn.engine}</TableCell>
                  <TableCell data-label="Channel">{txn.channel}</TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={txn.status === 'Captured' ? 'default' : 'outline'}>
                      {txn.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Amount" className="text-right font-semibold">
                    {formatCurrency(txn.amount)}
                  </TableCell>
                  <TableCell data-label="Actions" className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => markStatus(txn.id, 'Captured')}>
                      Mark captured
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => sendCallback(txn.id)}>
                      Send callback
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {callbackLog && <div className="text-sm text-primary">{callbackLog}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
