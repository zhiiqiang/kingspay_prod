import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CalendarIcon, Inbox, Loader2, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiAuthError, apiFetch } from '@/lib/api';
import {
  fetchProfitData,
  fetchWithdrawHistory,
  inquiryWithdraw,
  transferWithdraw,
  type InquiryResponse,
  type ProfitEntry,
  type WithdrawHistoryEntry,
} from '@/lib/profit-api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/language-provider';
import { Calendar } from '@/components/ui/calendar';
import { format, subMonths } from 'date-fns';

interface BankItem {
  id: number;
  code: string;
  name: string;
  status: string;
}

interface BankListResponse {
  status: boolean;
  data: BankItem[];
}

const formatAmount = (amount?: number) =>
  typeof amount === 'number' ? amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

const getDateOnlyString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getStartOfDayString = (date: Date) => `${getDateOnlyString(date)} 00:00:00`;
const getEndOfDayString = (date: Date) => `${getDateOnlyString(date)} 23:59:59`;
const getDefaultFromDate = () => getDateOnlyString(subMonths(new Date(), 1));
const getDefaultToDate = () => getDateOnlyString(new Date());

const getStatusBadge = (status?: string) => {
  const s = (status ?? '').toLowerCase();
  if (s === 'success') return { variant: 'success' as const, label: status };
  if (s === 'process' || s === 'pending') return { variant: 'warning' as const, label: status };
  if (s === 'failed') return { variant: 'destructive' as const, label: status };
  return { variant: 'outline' as const, label: status ?? '-' };
};

const errorToastStyle = {
  border: '2px solid #fda4af',
  background: '#fff1f2',
  color: '#f43f5e',
  boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
  padding: '0.5rem',
} as const;

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'flex w-full justify-between gap-2 text-left font-normal md:w-[220px]',
              !parsed && 'text-muted-foreground',
            )}
          >
            <span>{parsed ? format(parsed, 'yyyy-MM-dd') : 'yyyy-mm-dd'}</span>
            <CalendarIcon className="h-4 w-4 opacity-70" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => d && onChange(getDateOnlyString(d))}
            defaultMonth={parsed}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type ProfitTab = 'list' | 'withdraw' | 'history';

export function AdminProfitPage({ tab = 'list' }: { tab?: ProfitTab }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Profit List
  const [profitData, setProfitData] = useState<ProfitEntry[]>([]);
  const [profitBalance, setProfitBalance] = useState<number>(0);
  const [profitPage, setProfitPage] = useState(1);
  const [profitLimit, setProfitLimit] = useState(10);
  const [profitTotalPages, setProfitTotalPages] = useState(1);
  const [profitTotal, setProfitTotal] = useState(0);
  const [profitFrom, setProfitFrom] = useState(getDefaultFromDate());
  const [profitTo, setProfitTo] = useState(getDefaultToDate());
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitFilterOpen, setProfitFilterOpen] = useState(false);

  // Withdraw History
  const [historyData, setHistoryData] = useState<WithdrawHistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFrom, setHistoryFrom] = useState(getDefaultFromDate());
  const [historyTo, setHistoryTo] = useState(getDefaultToDate());
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilterOpen, setHistoryFilterOpen] = useState(false);

  // Withdraw form
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [withdrawBank, setWithdrawBank] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [inquiryData, setInquiryData] = useState<InquiryResponse['data'] | null>(null);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [isInquiring, setIsInquiring] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof ApiAuthError) {
      toast.error(t('auth.sessionExpired'), { duration: 1500, style: errorToastStyle });
      return true;
    }
    return false;
  }, [t]);

  const loadBanks = useCallback(async () => {
    try {
      const res = await apiFetch<BankListResponse>(`bank-list?page=1&limit=200&status=active`, { method: 'GET' });
      setBanks(res.data ?? []);
    } catch {
      setBanks([]);
    }
  }, []);

  const loadProfitData = useCallback(async () => {
    setProfitLoading(true);
    try {
      const res = await fetchProfitData({
        page: profitPage,
        limit: profitLimit,
        createdAtFrom: getStartOfDayString(new Date(profitFrom)),
        createdAtTo: getEndOfDayString(new Date(profitTo)),
      });
      setProfitData(res.data ?? []);
      setProfitBalance(res.balance ?? 0);
      setProfitTotalPages(res.pagination?.totalPages ?? 1);
      setProfitTotal(res.pagination?.total ?? 0);
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('profit.toast.loadError'), {
        duration: 2000,
        style: errorToastStyle,
      });
    } finally {
      setProfitLoading(false);
    }
  }, [profitPage, profitLimit, profitFrom, profitTo, handleAuthError, t]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchWithdrawHistory({
        page: historyPage,
        limit: historyLimit,
        createdAtFrom: getStartOfDayString(new Date(historyFrom)),
        createdAtTo: getEndOfDayString(new Date(historyTo)),
      });
      setHistoryData(res.data ?? []);
      setHistoryTotalPages(res.pagination?.totalPages ?? 1);
      setHistoryTotal(res.pagination?.total ?? 0);
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('profit.withdrawHistory.toast.loadError'), {
        duration: 2000,
        style: errorToastStyle,
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyLimit, historyFrom, historyTo, handleAuthError, t]);

  useEffect(() => {
    if (tab === 'list') void loadProfitData();
  }, [tab, loadProfitData]);

  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, loadHistory]);

  useEffect(() => {
    if (tab === 'withdraw') void loadBanks();
  }, [tab, loadBanks]);

  const handleInquiry = useCallback(async () => {
    const bank = withdrawBank.trim();
    const account = withdrawAccount.trim();
    const amount = Number(withdrawAmount);
    if (!bank) {
      toast.error(t('profit.withdraw.validation.bankRequired'), { style: errorToastStyle });
      return;
    }
    if (!account) {
      toast.error(t('profit.withdraw.validation.accountRequired'), { style: errorToastStyle });
      return;
    }
    if (!amount || amount <= 0) {
      toast.error(t('profit.withdraw.validation.amountRequired'), { style: errorToastStyle });
      return;
    }
    setIsInquiring(true);
    setInquiryData(null);
    try {
      const res = await inquiryWithdraw({ bankCode: bank, accountNo: account, amount });
      setInquiryData(res.data);
      toast.success(t('profit.withdraw.inquirySuccess'));
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('profit.withdraw.inquiryError'), {
        style: errorToastStyle,
      });
    } finally {
      setIsInquiring(false);
    }
  }, [withdrawBank, withdrawAccount, withdrawAmount, handleAuthError, t]);

  const handleTransfer = useCallback(async () => {
    if (!inquiryData) return;
    const pwd = withdrawPassword.trim();
    if (!pwd) {
      toast.error(t('profit.withdraw.validation.passwordRequired'), { style: errorToastStyle });
      return;
    }
    setIsTransferring(true);
    try {
      await transferWithdraw({
        platformTrxId: inquiryData.platformTrxId,
        accountNo: inquiryData.accountNo,
        accountName: inquiryData.accountName,
        bankCode: inquiryData.bankCode,
        amount: inquiryData.amount,
        password: pwd,
      });
      toast.success(t('profit.withdraw.transferSuccess'));
      setInquiryData(null);
      setWithdrawBank('');
      setWithdrawAccount('');
      setWithdrawAmount('');
      setWithdrawPassword('');
      navigate('/admin/profit/history');
      void loadHistory();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('profit.withdraw.transferError'), {
        style: errorToastStyle,
      });
    } finally {
      setIsTransferring(false);
    }
  }, [inquiryData, withdrawPassword, handleAuthError, t, loadHistory, navigate]);

  const resetInquiry = useCallback(() => {
    setInquiryData(null);
    setWithdrawPassword('');
  }, []);

  const pageOptions = useMemo(
    () => Array.from({ length: Math.max(1, profitTotalPages) }, (_, i) => i + 1),
    [profitTotalPages],
  );
  const historyPageOptions = useMemo(
    () => Array.from({ length: Math.max(1, historyTotalPages) }, (_, i) => i + 1),
    [historyTotalPages],
  );

  const pageTitle =
    tab === 'list'
      ? t('menu.profitList')
      : tab === 'withdraw'
        ? t('menu.profitWithdraw')
        : t('menu.profitWithdrawHistory');

  return (
    <>
      <Helmet>
        <title>{pageTitle} | Kingspay Administrator</title>
      </Helmet>
      <div className="container space-y-6 pb-10 pt-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{t('profit.pageDescription')}</p>
        </div>

        {tab === 'list' && (
            <Card>
              <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 max-md:self-start">
                  <CardTitle>{t('profit.cardTitle')}</CardTitle>
                  <CardDescription>{t('profit.cardDescription')}</CardDescription>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('profit.balance')}</span>
                    <span className="text-lg font-semibold">
                      {profitLoading && !profitData.length ? (
                        <Skeleton className="h-6 w-24" />
                      ) : (
                        formatAmount(profitBalance)
                      )}
                    </span>
                  </div>
                  <Button
                    className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
                    onClick={() => void loadProfitData()}
                    disabled={profitLoading}
                    aria-label={t('common.refresh')}
                  >
                    <RefreshCcw className={cn('h-4 w-4 transition', profitLoading && 'animate-spin')} aria-hidden />
                  </Button>
                  <Dialog open={profitFilterOpen} onOpenChange={setProfitFilterOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" aria-hidden />
                        {t('profit.filters.title')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t('profit.filters.title')}</DialogTitle>
                        <DialogDescription className="sr-only">{t('profit.filters.title')}</DialogDescription>
                      </DialogHeader>
                      <DialogBody className="space-y-4">
                        <DatePickerField label={t('profit.filters.createdFrom')} value={profitFrom} onChange={setProfitFrom} />
                        <DatePickerField label={t('profit.filters.createdTo')} value={profitTo} onChange={setProfitTo} />
                      </DialogBody>
                      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setProfitFilterOpen(false)}>
                          {t('common.cancel')}
                        </Button>
                        <Button
                          className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 sm:w-auto"
                          onClick={() => {
                            setProfitFilterOpen(false);
                            void loadProfitData();
                          }}
                        >
                          {t('common.search')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[70px]">{t('profit.table.id')}</TableHead>
                        <TableHead>{t('profit.table.entryType')}</TableHead>
                        <TableHead className="text-right">{t('profit.table.balanceBefore')}</TableHead>
                        <TableHead className="text-right">{t('profit.table.balanceAfter')}</TableHead>
                        <TableHead className="text-right">{t('profit.table.amount')}</TableHead>
                        <TableHead>{t('profit.table.referenceType')}</TableHead>
                        <TableHead>{t('profit.table.idReference')}</TableHead>
                        <TableHead>{t('profit.table.createdAt')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profitLoading && !profitData.length ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                            {Array.from({ length: 8 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : profitData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Inbox className="h-12 w-12 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{t('profit.empty.title')}</div>
                                <div className="text-sm text-muted-foreground">{t('profit.empty.description')}</div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        profitData.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.id}</TableCell>
                            <TableCell>{row.entryType}</TableCell>
                            <TableCell className="text-right">{formatAmount(row.balanceBefore)}</TableCell>
                            <TableCell className="text-right">{formatAmount(row.balanceAfter)}</TableCell>
                            <TableCell className="text-right">{formatAmount(row.amount)}</TableCell>
                            <TableCell>{row.referenceType}</TableCell>
                            <TableCell>{row.idReference}</TableCell>
                            <TableCell>{row.created_at}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {profitTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {t('pagination.info')
                        .replace('{from}', String((profitPage - 1) * profitLimit + 1))
                        .replace('{to}', String(Math.min(profitPage * profitLimit, profitTotal)))
                        .replace('{count}', String(profitTotal))}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={profitPage <= 1 || profitLoading}
                        onClick={() => setProfitPage((p) => Math.max(1, p - 1))}
                      >
                        {t('common.prev')}
                      </Button>
                      <Select value={String(profitPage)} onValueChange={(v) => setProfitPage(Number(v))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pageOptions.map((p) => (
                            <SelectItem key={p} value={String(p)}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={profitPage >= profitTotalPages || profitLoading}
                        onClick={() => setProfitPage((p) => Math.min(profitTotalPages, p + 1))}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
        )}

        {tab === 'withdraw' && (
            <Card>
              <CardHeader className="pt-4 pb-4">
                <CardTitle>{t('profit.withdraw.title')}</CardTitle>
                <CardDescription>{t('profit.withdraw.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-lg space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="profit-bank">{t('profit.withdraw.bankCode')}</Label>
                    <Select value={withdrawBank} onValueChange={(v) => { setWithdrawBank(v); setInquiryData(null); }}>
                      <SelectTrigger id="profit-bank">
                        <SelectValue placeholder={t('profit.withdraw.bankCodePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.code}>
                            {b.code} - {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profit-account">{t('profit.withdraw.accountNo')}</Label>
                    <Input
                      id="profit-account"
                      placeholder={t('profit.withdraw.accountNoPlaceholder')}
                      value={withdrawAccount}
                      onChange={(e) => { setWithdrawAccount(e.target.value); setInquiryData(null); }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profit-amount">{t('profit.withdraw.amount')}</Label>
                    <Input
                      id="profit-amount"
                      type="number"
                      min={1}
                      placeholder={t('profit.withdraw.amountPlaceholder')}
                      value={withdrawAmount}
                      onChange={(e) => { setWithdrawAmount(e.target.value); setInquiryData(null); }}
                    />
                  </div>
                  <Button
                    className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80"
                    onClick={() => void handleInquiry()}
                    disabled={isInquiring}
                  >
                    {isInquiring ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('profit.withdraw.inquiring')}
                      </>
                    ) : (
                      t('profit.withdraw.inquiry')
                    )}
                  </Button>
                </div>

                {inquiryData && (
                  <div className="mt-6 max-w-lg rounded-lg border bg-muted/30 p-4">
                    <p className="mb-2 text-sm font-medium">{t('profit.withdraw.accountName')}</p>
                    <p className="mb-4 text-lg font-semibold">{inquiryData.accountName}</p>
                    <div className="space-y-2">
                      <Label htmlFor="profit-password">{t('profit.withdraw.password')}</Label>
                      <Input
                        id="profit-password"
                        type="password"
                        placeholder={t('profit.withdraw.passwordPlaceholder')}
                        value={withdrawPassword}
                        onChange={(e) => setWithdrawPassword(e.target.value)}
                      />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="w-full sm:w-auto" onClick={resetInquiry} disabled={isTransferring}>
                        {t('common.cancel')}
                      </Button>
                      <Button
                        className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 sm:w-auto"
                        onClick={() => void handleTransfer()}
                        disabled={isTransferring}
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('profit.withdraw.transferring')}
                          </>
                        ) : (
                          t('profit.withdraw.transfer')
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
        )}

        {tab === 'history' && (
            <Card>
              <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 max-md:self-start">
                  <CardTitle>{t('profit.withdrawHistory.cardTitle')}</CardTitle>
                  <CardDescription>{t('profit.withdrawHistory.cardDescription')}</CardDescription>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2">
                  <Button
                    className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
                    onClick={() => void loadHistory()}
                    disabled={historyLoading}
                    aria-label={t('common.refresh')}
                  >
                    <RefreshCcw className={cn('h-4 w-4 transition', historyLoading && 'animate-spin')} aria-hidden />
                  </Button>
                  <Dialog open={historyFilterOpen} onOpenChange={setHistoryFilterOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" aria-hidden />
                        {t('profit.filters.title')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t('profit.filters.title')}</DialogTitle>
                        <DialogDescription className="sr-only">{t('profit.filters.title')}</DialogDescription>
                      </DialogHeader>
                      <DialogBody className="space-y-4">
                        <DatePickerField label={t('profit.filters.createdFrom')} value={historyFrom} onChange={setHistoryFrom} />
                        <DatePickerField label={t('profit.filters.createdTo')} value={historyTo} onChange={setHistoryTo} />
                      </DialogBody>
                      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setHistoryFilterOpen(false)}>
                          {t('common.cancel')}
                        </Button>
                        <Button
                          className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 sm:w-auto"
                          onClick={() => {
                            setHistoryFilterOpen(false);
                            void loadHistory();
                          }}
                        >
                          {t('common.search')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('profit.withdrawHistory.table.platformTrxId')}</TableHead>
                        <TableHead>{t('profit.withdrawHistory.table.channelName')}</TableHead>
                        <TableHead>{t('profit.withdrawHistory.table.accountNo')}</TableHead>
                        <TableHead>{t('profit.withdrawHistory.table.accountName')}</TableHead>
                        <TableHead>{t('profit.withdrawHistory.table.bankCode')}</TableHead>
                        <TableHead className="text-right">{t('profit.withdrawHistory.table.amount')}</TableHead>
                        <TableHead>{t('profit.withdrawHistory.table.status')}</TableHead>
                        <TableHead>{t('profit.withdrawHistory.table.createdAt')}</TableHead>
                        <TableHead>{t('profit.withdrawHistory.table.successAt')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyLoading && !historyData.length ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={`sk-h-${i}`}>
                            {Array.from({ length: 9 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : historyData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Inbox className="h-12 w-12 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{t('profit.withdrawHistory.empty.title')}</div>
                                <div className="text-sm text-muted-foreground">{t('profit.withdrawHistory.empty.description')}</div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        historyData.map((row) => {
                          const badge = getStatusBadge(row.status);
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-mono text-sm">{row.platformTrxId}</TableCell>
                              <TableCell>{row.channelName}</TableCell>
                              <TableCell>{row.accountNo}</TableCell>
                              <TableCell>{row.accountName}</TableCell>
                              <TableCell>{row.bankCode}</TableCell>
                              <TableCell className="text-right">{formatAmount(row.amount)}</TableCell>
                              <TableCell>
                                <Badge variant={badge.variant} appearance="light">
                                  {badge.label}
                                </Badge>
                              </TableCell>
                              <TableCell>{row.created_at ?? '-'}</TableCell>
                              <TableCell>{row.success_at ?? '-'}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {historyTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {t('pagination.info')
                        .replace('{from}', String((historyPage - 1) * historyLimit + 1))
                        .replace('{to}', String(Math.min(historyPage * historyLimit, historyTotal)))
                        .replace('{count}', String(historyTotal))}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historyPage <= 1 || historyLoading}
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        {t('common.prev')}
                      </Button>
                      <Select value={String(historyPage)} onValueChange={(v) => setHistoryPage(Number(v))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {historyPageOptions.map((p) => (
                            <SelectItem key={p} value={String(p)}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historyPage >= historyTotalPages || historyLoading}
                        onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
        )}
      </div>
    </>
  );
}
