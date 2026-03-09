import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/utils/number-format';

const metrics = [
  { label: 'Total Merchant Fee', value: 62000000, change: 4.3 },
  { label: 'Total Sub-Merchant Fee', value: 28000000, change: 6.1 },
  { label: 'Sub-Merchant Transactions', value: 1420, change: 3.4 },
];

// transactions are loaded from backend; initialize empty to avoid mock data
const initialEngineTransactions: { id: string; merchant: string; status: string; channel: string; amount: number }[] = [];

export function EngineDashboardPage() {
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [engineTransactions] = useState(initialEngineTransactions);

  const filtered = useMemo(() => {
    return engineTransactions.filter((txn) => {
      const matchesMerchant = merchantFilter === 'all' || txn.merchant === merchantFilter;
      const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
      return matchesMerchant && matchesStatus;
    });
  }, [merchantFilter, statusFilter]);

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">Dashboard Overview</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="border-0 px-4 pt-4 pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl">{metric.value.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <Badge variant={metric.change >= 0 ? 'default' : 'destructive'}>
                {metric.change >= 0 ? '+' : ''}
                {metric.change}% vs last period
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-md:self-start">
            <CardTitle>Sub-merchant performance</CardTitle>
            <CardDescription>Filter and download payin activity.</CardDescription>
          </div>
          <div className="flex gap-3">
            <Select value={merchantFilter} onValueChange={setMerchantFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Merchant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All merchants</SelectItem>
                {Array.from(new Set(engineTransactions.map((txn) => txn.merchant))).map((merchant) => (
                  <SelectItem key={merchant} value={merchant}>
                    {merchant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">Download report</Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Txn</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell data-label="Txn" className="font-medium">
                    {txn.id}
                  </TableCell>
                  <TableCell data-label="Merchant">{txn.merchant}</TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={txn.status === 'Completed' ? 'default' : 'outline'}>{txn.status}</Badge>
                  </TableCell>
                  <TableCell data-label="Channel">{txn.channel}</TableCell>
                  <TableCell data-label="Amount" className="text-right font-semibold">
                    {formatCurrency(txn.amount)}
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
