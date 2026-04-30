import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
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
  totalProfit?: number;
  feeAgent?: number;
  feeChannel?: number;
  netAmount?: number;
}

interface MerchantSummaryResponse {
  summary?: {
    totalTransaksi?: number;
    totalAmount?: number;
    totalProfit?: number;
    feeAgent?: number;
    feeChannel?: number;
    netAmount?: number;
  };
  data?: MerchantSummaryItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

interface MerchantFilterItem {
  id: number;
  name?: string;
}

interface MerchantFilterListResponse {
  status: boolean;
  data?: MerchantFilterItem[];
}

interface AgentFilterItem {
  id: number;
  name?: string;
}

interface AgentFilterListResponse {
  status: boolean;
  data?: AgentFilterItem[] | { data?: AgentFilterItem[] };
}

interface MerchantSummaryFilters {
  idMerchant: string;
  idAgent: string;
  dateFrom: string;
  dateTo: string;
}

const formatAmount = (amount?: number) =>
  typeof amount === 'number' ? amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

const getDateOnlyString = (date: Date) => format(date, 'yyyy-MM-dd');

export function MerchantSummaryReportPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<MerchantSummaryItem[]>([]);
  const [summary, setSummary] = useState({
    totalTransaksi: 0,
    totalAmount: 0,
    totalProfit: 0,
    feeAgent: 0,
    feeChannel: 0,
    netAmount: 0,
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);
  const [merchants, setMerchants] = useState<MerchantFilterItem[]>([]);
  const [agents, setAgents] = useState<AgentFilterItem[]>([]);

  const defaultFilter = useMemo(
    () => ({
      idMerchant: '',
      idAgent: '',
      dateFrom: getDateOnlyString(new Date()),
      dateTo: getDateOnlyString(new Date()),
    }),
    [],
  );

  const [filters, setFilters] = useState<MerchantSummaryFilters>(defaultFilter);
  const [filterDraft, setFilterDraft] = useState<MerchantSummaryFilters>(defaultFilter);
  const filterSnapshotRef = useRef<MerchantSummaryFilters | null>(null);
  const didApplyFilterRef = useRef(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.idMerchant.trim()) count += 1;
    if (filters.idAgent.trim()) count += 1;
    if (filters.dateFrom !== defaultFilter.dateFrom) count += 1;
    if (filters.dateTo !== defaultFilter.dateTo) count += 1;
    return count;
  }, [defaultFilter.dateFrom, defaultFilter.dateTo, filters.dateFrom, filters.dateTo, filters.idAgent, filters.idMerchant]);

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
          totalProfit: response.summary?.totalProfit ?? 0,
          feeAgent: response.summary?.feeAgent ?? 0,
          feeChannel: response.summary?.feeChannel ?? 0,
          netAmount: response.summary?.netAmount ?? 0,
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

  useEffect(() => {
    const fetchFilterOptions = async () => {
      setIsLoadingMerchants(true);
      try {
        const [merchantResponse, agentResponse] = await Promise.all([
          apiFetch<MerchantFilterListResponse>('/merchant?page=1&limit=1000'),
          apiFetch<AgentFilterListResponse>('user?email=&name=&role=agent&idMerchant=&limit=1000', { method: 'GET' }),
        ]);
        setMerchants(Array.isArray(merchantResponse.data) ? merchantResponse.data : []);
        const agentPayload = agentResponse.data;
        if (Array.isArray(agentPayload)) {
          setAgents(agentPayload);
        } else if (agentPayload && Array.isArray(agentPayload.data)) {
          setAgents(agentPayload.data);
        } else {
          setAgents([]);
        }
      } catch {
        setMerchants([]);
        setAgents([]);
      } finally {
        setIsLoadingMerchants(false);
      }
    };
    void fetchFilterOptions();
  }, []);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        filterSnapshotRef.current = filterDraft;
        didApplyFilterRef.current = false;
      }

      if (!nextOpen && !didApplyFilterRef.current && filterSnapshotRef.current) {
        setFilterDraft(filterSnapshotRef.current);
      }

      setIsFilterDialogOpen(nextOpen);
    },
    [filterDraft],
  );

  const handleApplyFilters = useCallback(() => {
    didApplyFilterRef.current = true;
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
    didApplyFilterRef.current = true;
    filterSnapshotRef.current = defaultFilter;
    setFilterDraft(defaultFilter);
    setFilters(defaultFilter);
    setIsFilterDialogOpen(false);
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

  const summaryItems = useMemo(
    () => [
      { key: 'totalTransaksi', label: t('reports.merchantSummary.totalTransaction'), value: String(summary.totalTransaksi), badge: 'TRX' },
      { key: 'totalAmount', label: t('reports.merchantSummary.totalAmount'), value: formatAmount(summary.totalAmount), badge: 'IDR' },
      { key: 'totalProfit', label: t('reports.merchantSummary.totalProfit'), value: formatAmount(summary.totalProfit), badge: 'IDR' },
      { key: 'feeAgent', label: t('reports.merchantSummary.feeAgent'), value: formatAmount(summary.feeAgent), badge: 'IDR' },
      { key: 'feeChannel', label: t('reports.merchantSummary.feeChannel'), value: formatAmount(summary.feeChannel), badge: 'IDR' },
      { key: 'netAmount', label: t('reports.merchantSummary.netAmount'), value: formatAmount(summary.netAmount), badge: 'IDR' },
    ],
    [summary, t],
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
            <Dialog open={isFilterDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  {t('common.filters')}
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">{activeFilterCount}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[680px]">
                <DialogHeader>
                  <DialogTitle>{t('common.filters')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="merchant-summary-filter-merchant" className="text-sm font-medium text-muted-foreground">
                      {t('reports.merchantSummary.filters.idMerchant')}
                    </Label>
                    <Select
                      value={filterDraft.idMerchant || 'all'}
                      onValueChange={(value) =>
                        setFilterDraft((prev) => ({ ...prev, idMerchant: value === 'all' ? '' : value }))
                      }
                      disabled={isLoadingMerchants}
                    >
                      <SelectTrigger id="merchant-summary-filter-merchant" className="bg-background">
                        <SelectValue
                          placeholder={
                            isLoadingMerchants
                              ? t('agents.placeholders.loadingMerchants')
                              : t('reports.merchantSummary.filters.idMerchantPlaceholder')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.merchantSummary.filters.idMerchantAll')}</SelectItem>
                        {merchants.map((merchant) => (
                          <SelectItem key={merchant.id} value={String(merchant.id)}>
                            {merchant.id} - {merchant.name ?? '-'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="merchant-summary-filter-agent" className="text-sm font-medium text-muted-foreground">
                      {t('reports.merchantSummary.filters.idAgent')}
                    </Label>
                    <Select
                      value={filterDraft.idAgent || 'all'}
                      onValueChange={(value) =>
                        setFilterDraft((prev) => ({ ...prev, idAgent: value === 'all' ? '' : value }))
                      }
                      disabled={isLoadingMerchants}
                    >
                      <SelectTrigger id="merchant-summary-filter-agent" className="bg-background">
                        <SelectValue
                          placeholder={
                            isLoadingMerchants
                              ? t('agents.placeholders.loadingMerchants')
                              : t('reports.merchantSummary.filters.idAgentPlaceholder')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.merchantSummary.filters.idAgentAll')}</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={String(agent.id)}>
                            {agent.id} - {agent.name ?? '-'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">{t('reports.merchantSummary.dateFrom')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between bg-background font-normal">
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
                    <Label className="text-sm font-medium text-muted-foreground">{t('reports.merchantSummary.dateTo')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between bg-background font-normal">
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
                  <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summaryItems.map((item) => (
              <Card key={item.key} className="relative overflow-hidden border-muted/60 bg-muted/30">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="font-medium">{item.label}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                      {item.badge}
                    </span>
                  </div>
                  <div className="max-w-full break-words text-2xl font-semibold text-foreground">{item.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto sm:rounded-md sm:border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">{t('reports.merchantSummary.merchantId')}</TableHead>
                  <TableHead className="min-w-[180px]">{t('reports.merchantSummary.merchantName')}</TableHead>
                  <TableHead className="min-w-[120px]">{t('reports.merchantSummary.agentId')}</TableHead>
                  <TableHead className="min-w-[180px]">{t('reports.merchantSummary.agentName')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('reports.merchantSummary.totalTransaction')}</TableHead>
                  <TableHead className="min-w-[150px]">{t('reports.merchantSummary.totalAmount')}</TableHead>
                  <TableHead className="min-w-[150px]">{t('reports.merchantSummary.totalProfit')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('reports.merchantSummary.feeAgent')}</TableHead>
                  <TableHead className="min-w-[150px]">{t('reports.merchantSummary.feeChannel')}</TableHead>
                  <TableHead className="min-w-[150px]">{t('reports.merchantSummary.netAmount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: pagination.limit }).map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      {[
                        t('reports.merchantSummary.merchantId'),
                        t('reports.merchantSummary.merchantName'),
                        t('reports.merchantSummary.agentId'),
                        t('reports.merchantSummary.agentName'),
                        t('reports.merchantSummary.totalTransaction'),
                        t('reports.merchantSummary.totalAmount'),
                        t('reports.merchantSummary.totalProfit'),
                        t('reports.merchantSummary.feeAgent'),
                        t('reports.merchantSummary.feeChannel'),
                        t('reports.merchantSummary.netAmount'),
                      ].map((label, cellIndex) => (
                        <TableCell key={`skeleton-cell-${rowIndex}-${cellIndex}`} data-label={label}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
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
                      <TableCell data-label={t('reports.merchantSummary.merchantId')}>{item.idMerchant ?? '-'}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.merchantName')}>{item.merchantName ?? '-'}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.agentId')}>{item.agentId ?? '-'}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.agentName')}>{item.agentName ?? '-'}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.totalTransaction')}>{item.totalTransaksi ?? 0}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.totalAmount')} className="whitespace-nowrap">{formatAmount(item.totalAmount)}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.totalProfit')} className="whitespace-nowrap">{formatAmount(item.totalProfit)}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.feeAgent')} className="whitespace-nowrap">{formatAmount(item.feeAgent)}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.feeChannel')} className="whitespace-nowrap">{formatAmount(item.feeChannel)}</TableCell>
                      <TableCell data-label={t('reports.merchantSummary.netAmount')} className="whitespace-nowrap">{formatAmount(item.netAmount)}</TableCell>
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
