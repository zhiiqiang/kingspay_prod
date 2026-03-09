import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { CalendarIcon, Inbox, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MerchantSummaryItem {
  idMerchant?: number;
  merchantName?: string;
  agentId?: number | null;
  agentName?: string | null;
  totalTransaksi?: number;
  totalAmount?: number;
}

interface MerchantSummaryResponse {
  summary?: {
    totalTransaksi?: number;
    totalAmount?: number;
  };
  data?: MerchantSummaryItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

const formatAmount = (amount?: number) =>
  typeof amount === 'number' ? amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

const getDateOnlyString = (date: Date) => format(date, 'yyyy-MM-dd');

export function MerchantSummaryReportPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<MerchantSummaryItem[]>([]);
  const [summary, setSummary] = useState({ totalTransaksi: 0, totalAmount: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const defaultFilter = useMemo(
    () => ({
      idMerchant: '',
      idAgent: '',
      dateFrom: getDateOnlyString(subDays(new Date(), 30)),
      dateTo: getDateOnlyString(new Date()),
    }),
    [],
  );

  const [filters, setFilters] = useState(defaultFilter);
  const [filterDraft, setFilterDraft] = useState(defaultFilter);

  const fetchMerchantSummary = useCallback(
    async (nextPage = pagination.page, nextLimit = pagination.limit, nextFilters = filters) => {
      setIsLoading(true);
      try {
        const response = await apiFetch<MerchantSummaryResponse>('/report/merchant-summary', {
          method: 'POST',
          body: {
            page: nextPage,
            limit: nextLimit,
            idMerchant: nextFilters.idMerchant.trim(),
            idAgent: nextFilters.idAgent.trim(),
            dateFrom: nextFilters.dateFrom,
            dateTo: nextFilters.dateTo,
          },
        });

        const nextPagination = response.pagination ?? {};
        setRows(response.data ?? []);
        setSummary({
          totalTransaksi: response.summary?.totalTransaksi ?? 0,
          totalAmount: response.summary?.totalAmount ?? 0,
        });
        setPagination({
          total: nextPagination.total ?? 0,
          page: nextPagination.page ?? nextPage,
          limit: nextPagination.limit ?? nextLimit,
          totalPages: Math.max(1, nextPagination.totalPages ?? 1),
        });
      } catch (error) {
        if (error instanceof ApiAuthError) {
          toast.error(t('auth.sessionExpired'));
        } else {
          toast.error(error instanceof Error ? error.message : t('reports.merchantSummary.loadError'));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [filters, pagination.limit, pagination.page, t],
  );

  useEffect(() => {
    void fetchMerchantSummary(1, pagination.limit, filters);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setFilters(filterDraft);
    setIsFilterDialogOpen(false);
    void fetchMerchantSummary(1, pagination.limit, filterDraft);
  }, [fetchMerchantSummary, filterDraft, pagination.limit]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMerchantSummary(pagination.page, pagination.limit, filters);
    setIsRefreshing(false);
  }, [fetchMerchantSummary, filters, pagination.limit, pagination.page]);

  const handleResetFilters = useCallback(() => {
    setFilterDraft(defaultFilter);
    setFilters(defaultFilter);
    void fetchMerchantSummary(1, pagination.limit, defaultFilter);
  }, [defaultFilter, fetchMerchantSummary, pagination.limit]);

  const handlePageChange = useCallback(
    (page: number) => {
      void fetchMerchantSummary(page, pagination.limit, filters);
    },
    [fetchMerchantSummary, filters, pagination.limit],
  );

  const handleLimitChange = useCallback(
    (limit: number) => {
      void fetchMerchantSummary(1, limit, filters);
    },
    [fetchMerchantSummary, filters],
  );

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('menu.merchantSummary')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('reports.merchantSummary.title')}</CardTitle>
            <CardDescription>{t('reports.merchantSummary.description')}</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto">
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label={t('common.refresh')}
            >
              <RefreshCcw className={cn('h-4 w-4 transition', isRefreshing && 'animate-spin')} aria-hidden />
            </Button>
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  {t('common.filters')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[680px]">
                <DialogHeader>
                  <DialogTitle>{t('common.filters')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="merchant-summary-filter-merchant">{t('reports.merchantSummary.merchantId')}</Label>
                    <Input
                      id="merchant-summary-filter-merchant"
                      value={filterDraft.idMerchant}
                      onChange={(event) => setFilterDraft((prev) => ({ ...prev, idMerchant: event.target.value }))}
                      placeholder={t('common.search')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="merchant-summary-filter-agent">{t('reports.merchantSummary.agentId')}</Label>
                    <Input
                      id="merchant-summary-filter-agent"
                      value={filterDraft.idAgent}
                      onChange={(event) => setFilterDraft((prev) => ({ ...prev, idAgent: event.target.value }))}
                      placeholder={t('common.search')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('reports.merchantSummary.dateFrom')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span>{filterDraft.dateFrom}</span>
                          <CalendarIcon className="h-4 w-4" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={new Date(filterDraft.dateFrom)}
                          onSelect={(date) => {
                            if (date) {
                              setFilterDraft((prev) => ({ ...prev, dateFrom: getDateOnlyString(date) }));
                            }
                          }}
                          disabled={(date) => date > new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('reports.merchantSummary.dateTo')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span>{filterDraft.dateTo}</span>
                          <CalendarIcon className="h-4 w-4" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={new Date(filterDraft.dateTo)}
                          onSelect={(date) => {
                            if (date) {
                              setFilterDraft((prev) => ({ ...prev, dateTo: getDateOnlyString(date) }));
                            }
                          }}
                          disabled={(date) => date > new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button className="bg-primary text-white hover:bg-primary/90" onClick={handleApplyFilters}>
                    {t('common.search')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
            >
              {t('common.reset')}
            </Button>
          </div>
        </CardHeader>
        <Separator />

        <CardContent className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.merchantSummary.totalTransaction')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.totalTransaksi}</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.merchantSummary.totalAmount')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatAmount(summary.totalAmount)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto sm:rounded-md sm:border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.merchantSummary.merchantId')}</TableHead>
                  <TableHead>{t('reports.merchantSummary.merchantName')}</TableHead>
                  <TableHead>{t('reports.merchantSummary.agentId')}</TableHead>
                  <TableHead>{t('reports.merchantSummary.agentName')}</TableHead>
                  <TableHead>{t('reports.merchantSummary.totalTransaction')}</TableHead>
                  <TableHead>{t('reports.merchantSummary.totalAmount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: pagination.limit }).map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      {Array.from({ length: 6 }).map((__, cellIndex) => (
                        <TableCell key={`skeleton-cell-${rowIndex}-${cellIndex}`}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                          <Inbox className="h-7 w-7" aria-hidden />
                        </div>
                        <div className="font-medium text-foreground">{t('common.noData')}</div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  rows.map((item, index) => (
                    <TableRow key={`${item.idMerchant ?? 'merchant'}-${index}`}>
                      <TableCell>{item.idMerchant ?? '-'}</TableCell>
                      <TableCell>{item.merchantName ?? '-'}</TableCell>
                      <TableCell>{item.agentId ?? '-'}</TableCell>
                      <TableCell>{item.agentName ?? '-'}</TableCell>
                      <TableCell>{item.totalTransaksi ?? 0}</TableCell>
                      <TableCell>{formatAmount(item.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{t('common.page')}</span>
                <Select value={String(pagination.page)} onValueChange={(value) => handlePageChange(Number(value))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {Array.from({ length: Math.max(1, pagination.totalPages) }, (_, index) => index + 1).map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span>{t('common.limit')}</span>
                <Select value={String(pagination.limit)} onValueChange={(value) => handleLimitChange(Number(value))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {t('common.perPage').replace('{count}', String(option))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                {t('common.total').replace('{count}', String(pagination.total))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                disabled={pagination.page <= 1}
              >
                {t('common.prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                disabled={pagination.page >= pagination.totalPages}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MerchantSummaryReportPage;
