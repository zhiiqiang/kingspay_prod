

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Filter, Inbox, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/i18n/language-provider';

function formatAmount(amount?: number) {
  return typeof amount === 'number' ? amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';
}

export function MerchantSummaryReportPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ totalTransaksi: number; totalAmount: number }>({ totalTransaksi: 0, totalAmount: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterInputs, setFilterInputs] = useState({
    idMerchant: '',
    idAgent: '',
    dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
  });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());

  const columnConfigs = useMemo(() => [
    {
      id: 'idMerchant',
      label: t('reports.merchantSummary.merchantId'),
      render: (item: any) => item.idMerchant ?? '-',
    },
    {
      id: 'merchantName',
      label: t('reports.merchantSummary.merchantName'),
      render: (item: any) => item.merchantName ?? '-',
    },
    {
      id: 'agentName',
      label: t('reports.merchantSummary.agentName'),
      render: (item: any) => item.agentName ?? '-',
    },
    {
      id: 'totalTransaksi',
      label: t('reports.merchantSummary.totalTransaction'),
      render: (item: any) => item.totalTransaksi ?? '-',
    },
    {
      id: 'totalAmount',
      label: t('reports.merchantSummary.totalAmount'),
      render: (item: any) => formatAmount(item.totalAmount),
    },
  ], [t]);

  const allColumnIds = useMemo(() => columnConfigs.map((col) => col.id), [columnConfigs]);

  useEffect(() => {
    if (visibleColumns.size === 0 && allColumnIds.length > 0) {
      setVisibleColumns(new Set(allColumnIds));
    }
  }, [allColumnIds, visibleColumns]);

  const visibleColumnConfigs = useMemo(
    () => columnConfigs.filter((column) => visibleColumns.has(column.id)),
    [columnConfigs, visibleColumns],
  );

  const toggleColumnVisibility = useCallback((columnId: string, isVisible: boolean) => {
    setVisibleColumns((previous) => {
      const next = new Set(previous);
      if (isVisible) {
        next.add(columnId);
      } else {
        next.delete(columnId);
      }
      return next;
    });
  }, []);

  const pageOptions = useMemo(() => {
    return Array.from({ length: Math.max(1, pagination.totalPages) }, (_, index) => index + 1);
  }, [pagination.totalPages]);

  const fetchMerchantSummary = useCallback(
    async (overridePage?: number) => {
      setIsLoading(true);
      try {
        const activePage = overridePage ?? pagination.page;
        const response = await apiFetch<any>('/report/merchant-summary', {
          method: 'POST',
          body: {
            page: activePage,
            limit: pagination.limit,
            idMerchant: filterInputs.idMerchant.trim(),
            idAgent: filterInputs.idAgent.trim(),
            dateFrom: filterInputs.dateFrom,
            dateTo: filterInputs.dateTo,
          },
        });
        setData(response.data ?? []);
        setSummary(response.summary ?? { totalTransaksi: 0, totalAmount: 0 });
        setPagination(response.pagination ?? { total: 0, page: activePage, limit: 10, totalPages: 1 });
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
    [filterInputs, pagination.limit, pagination.page, t],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMerchantSummary();
    setIsRefreshing(false);
  }, [fetchMerchantSummary]);

  const handleSearch = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    void fetchMerchantSummary(1);
    setIsFilterDialogOpen(false);
  }, [fetchMerchantSummary]);

  const handleResetFilters = useCallback(() => {
    setFilterInputs({
      idMerchant: '',
      idAgent: '',
      dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
    void fetchMerchantSummary(1);
  }, [fetchMerchantSummary]);

  useEffect(() => {
    void fetchMerchantSummary();
  }, []);

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
            >
              <RefreshCcw className={cn('h-4 w-4 transition', isRefreshing && 'animate-spin')} aria-hidden />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-auto bg-primary text-white hover:bg-primary/90 flex items-center justify-center">
                  <Filter className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="font-medium">{t('reports.merchantSummary.toggleColumns')}</DropdownMenuLabel>
                {columnConfigs.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={visibleColumns.has(column.id)}
                    onCheckedChange={(checked) => toggleColumnVisibility(column.id, !!checked)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2"
              onClick={() => setIsFilterDialogOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {t('common.filters')}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
            >
              {t('common.reset')}
            </Button>
          </div>
        </CardHeader>
        {isFilterDialogOpen && (
          <div className="border-t border-border px-6 py-4 bg-muted/30 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-merchant">{t('reports.merchantSummary.merchantId')}</Label>
                <Input
                  id="filter-merchant"
                  placeholder={t('common.search')}
                  value={filterInputs.idMerchant}
                  onChange={(e) => setFilterInputs((prev) => ({ ...prev, idMerchant: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-agent">{t('reports.merchantSummary.agentId')}</Label>
                <Input
                  id="filter-agent"
                  placeholder={t('common.search')}
                  value={filterInputs.idAgent}
                  onChange={(e) => setFilterInputs((prev) => ({ ...prev, idAgent: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('reports.merchantSummary.dateFrom')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterInputs.dateFrom}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={new Date(filterInputs.dateFrom)}
                      onSelect={(date) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          dateFrom: format(date ?? new Date(), 'yyyy-MM-dd'),
                        }))
                      }
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t('reports.merchantSummary.dateTo')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterInputs.dateTo}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={new Date(filterInputs.dateTo)}
                      onSelect={(date) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          dateTo: format(date ?? new Date(), 'yyyy-MM-dd'),
                        }))
                      }
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="bg-primary text-white hover:bg-primary/90" onClick={handleSearch}>
                {t('common.search')}
              </Button>
            </div>
          </div>
        )}
        <Separator />
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
        <Separator />
        <CardContent className="flex flex-col gap-4 px-5 py-4 md:gap-5 md:px-6">
          <div className="relative overflow-x-auto sm:rounded-md sm:border">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumnConfigs.length === 0 ? (
                    <TableHead className="whitespace-nowrap">{t('common.noColumns')}</TableHead>
                  ) : (
                    visibleColumnConfigs.map((column) => (
                      <TableHead key={column.id} className="whitespace-nowrap">
                        {column.label}
                      </TableHead>
                    ))
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 10 }).map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      {(visibleColumnConfigs.length > 0 ? visibleColumnConfigs : [null]).map((column, colIndex) => (
                        <TableCell key={`skeleton-cell-${rowIndex}-${colIndex}`}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!isLoading && data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(visibleColumnConfigs.length, 1)}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                          <Inbox className="h-7 w-7" aria-hidden />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{t('common.noData')}</div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  data.map((item, index) => (
                    <TableRow key={`${item.idMerchant}-${index}`}>
                      {visibleColumnConfigs.map((column) => (
                        <TableCell key={column.id} className="whitespace-nowrap">
                          {column.render(item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{t('common.page')}</span>
                <Select value={String(pagination.page)} onValueChange={(value) => void fetchMerchantSummary(Number(value))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {pageOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span>{t('common.limit')}</span>
                <Select value={String(pagination.limit)} onValueChange={(value) => setPagination((prev) => ({ ...prev, limit: Number(value), page: 1 }))}>
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
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1}
              >
                {t('common.prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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
