import {
  memo,
  ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, CheckCircle2, Eye, EyeOff, Filter, Inbox, Info, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/i18n/language-provider';
import { getStoredUserPermissions } from '@/lib/auth';

interface DisbursementItem {
  id: number;
  idMerchant?: number;
  idChannel?: number;
  idAgent?: number;
  agentName?: string;
  merchantName?: string;
  channelName?: string;
  merchantTrxId?: string;
  platformTrxId?: string;
  partnerTrxId?: string;
  accountNo?: string;
  accountName?: string | null;
  bankCode?: string;
  amount?: number;
  biayaChannel?: number;
  biayaPlatform?: number;
  biayaAgent?: number;
  status?: string;
  created_at?: string;
  success_at?: string;
}

interface DisbursementListResponse {
  status: boolean;
  message?: string;
  data: DisbursementItem[];
  summary?: DisbursementSummary;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

const formatAmount = (amount?: number) =>
  typeof amount === 'number' ? amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

const formatEntityInfo = (id?: number | string, name?: string) => {
  const idValue = id === null || id === undefined ? '' : String(id);
  const nameValue = name ?? '';

  if (!idValue && !nameValue) {
    return '-';
  }

  if (idValue && nameValue) {
    return `${idValue} - ${nameValue}`;
  }

  return idValue || nameValue;
};

const getStatusBadgeStyle = (status?: string) => {
  const normalized = status?.toLowerCase();

  if (normalized === 'pending' || normalized === 'process') {
    return { variant: 'warning' as const, appearance: 'light' as const };
  }

  if (normalized === 'success') {
    return { variant: 'success' as const, appearance: 'light' as const };
  }

  if (normalized === 'failed') {
    return { variant: 'destructive' as const, appearance: 'light' as const };
  }

  if (normalized === 'refund') {
    return {
      variant: 'warning' as const,
      appearance: 'light' as const,
      className:
        'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border border-orange-200 dark:border-orange-900',
    };
  }

  return { variant: 'outline' as const };
};

const getDateOnlyString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getStartOfDayString = (date: Date) => `${getDateOnlyString(date)} 00:00:00`;
const getEndOfDayString = (date: Date) => `${getDateOnlyString(date)} 23:59:59`;
/** Default created-date range: yesterday through today (inclusive). */
const getDefaultCreatedFromDate = () => getDateOnlyString(subDays(new Date(), 1));

type DisbursementColumnId =
  | 'id'
  | 'platformTrxId'
  | 'merchantTrxId'
  | 'partnerTrxId'
  | 'merchantInfo'
  | 'channelName'
  | 'agentInfo'
  | 'accountNo'
  | 'accountName'
  | 'bankCode'
  | 'amount'
  | 'biayaChannel'
  | 'biayaPlatform'
  | 'biayaAgent'
  | 'status'
  | 'created_at'
  | 'success_at'
  | 'action';

interface DisbursementColumnConfig {
  id: DisbursementColumnId;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (disbursement: DisbursementItem) => ReactNode;
}

/** Matches pga-be-admin disbursement list validation (inquiry rows excluded server-side) */
const DISBURSEMENT_STATUS_OPTIONS = ['pending', 'process', 'success', 'failed'] as const;

interface DisbursementFiltersProps {
  platformTrxId: string;
  merchantTrxId: string;
  partnerTrxId: string;
  idMerchant: string;
  idAgent: string;
  status: string;
  filterResetKey: number;
  platformTrxIdRef: React.MutableRefObject<HTMLInputElement | null>;
  merchantTrxIdRef: React.MutableRefObject<HTMLInputElement | null>;
  partnerTrxIdRef: React.MutableRefObject<HTMLInputElement | null>;
  idMerchantRef: React.MutableRefObject<HTMLInputElement | null>;
  idAgentRef: React.MutableRefObject<HTMLInputElement | null>;
  createdFromInput: string;
  createdToInput: string;
  successFromInput: string;
  successToInput: string;
  columnConfigs: DisbursementColumnConfig[];
  visibleColumns: Set<DisbursementColumnId>;
  isRefreshing: boolean;
  onSearch: (payload: { status: string }) => void;
  onRefresh: () => void;
  onReset: () => void;
  onDatePickerApply: (value: string, field: 'from' | 'to') => void;
  onDatePickerClose: () => void;
  onSuccessDatePickerApply: (value: string, field: 'from' | 'to') => void;
  onSuccessDatePickerClose: () => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onSuccessFromChange: (value: string) => void;
  onSuccessToChange: (value: string) => void;
  onToggleColumnVisibility: (columnId: DisbursementColumnId, isVisible: boolean) => void;
}

interface DisbursementSummary {
  sumAmount?: number;
  sumBiayaChannel?: number;
  sumBiayaPlatform?: number;
  sumBiayaAgent?: number;
}

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onApply?: (value: string) => void;
  onClose?: () => void;
}

const parseDateValue = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

function DatePickerField({ label, value, onChange, onApply, onClose }: DatePickerFieldProps) {
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = useState(false);
  const didApplyRef = useRef(false);
  const applyValueRef = useRef<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            didApplyRef.current = false;
            applyValueRef.current = null;
          }
          setOpen(nextOpen);
          if (!nextOpen) {
            const applyValue = applyValueRef.current;
            if (didApplyRef.current && applyValue) {
              setTimeout(() => onApply?.(applyValue), 0);
              return;
            }
            setTimeout(() => onClose?.(), 0);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'flex w-full items-center justify-between gap-2 text-left font-normal shadow-sm transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 md:w-[220px]',
              !selectedDate && 'text-muted-foreground',
            )}
          >
            <span>{selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'yyyy-mm-dd'}</span>
            <CalendarIcon className="h-4 w-4 opacity-70" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" sideOffset={6}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              if (nextDate) {
                const nextValue = getDateOnlyString(nextDate);
                onChange(nextValue);
                didApplyRef.current = true;
                applyValueRef.current = nextValue;
                setOpen(false);
                return;
              }

              // Close the picker even if the same date is clicked again.
              if (!nextDate && selectedDate) {
                const nextValue = getDateOnlyString(selectedDate);
                onChange(nextValue);
                didApplyRef.current = true;
                applyValueRef.current = nextValue;
                setOpen(false);
                return;
              }

              if (nextDate || selectedDate) {
                setOpen(false);
              }
            }}
            defaultMonth={selectedDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

const DisbursementSummaryCards = memo(function DisbursementSummaryCards({
  summary,
  isLoading,
}: {
  summary: DisbursementSummary | null;
  isLoading: boolean;
}) {
  const { t } = useLanguage();
  const isSummaryLoading = isLoading && !summary;
  const summaryItems = useMemo(
    () => [
      {
        key: 'amount',
        label: t('disbursement.summary.totalAmount'),
        value: formatAmount(summary?.sumAmount),
      },
      {
        key: 'channel',
        label: t('disbursement.summary.channelFee'),
        value: formatAmount(summary?.sumBiayaChannel),
      },
      {
        key: 'platform',
        label: t('disbursement.summary.platformFee'),
        value: formatAmount(summary?.sumBiayaPlatform),
      },
      {
        key: 'agent',
        label: t('disbursement.summary.agentFee'),
        value: formatAmount(summary?.sumBiayaAgent),
      },
    ],
    [summary?.sumAmount, summary?.sumBiayaAgent, summary?.sumBiayaChannel, summary?.sumBiayaPlatform, t],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaryItems.map((item) => (
        <Card key={item.key} className="relative overflow-hidden border-muted/60">
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="font-medium">{item.label}</span>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                IDR
              </span>
            </div>
            <div className="max-w-full break-words text-2xl font-semibold text-foreground">
              {isSummaryLoading ? <Skeleton className="h-7 w-28" /> : item.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

const DisbursementFilters = memo(function DisbursementFilters({
  platformTrxId,
  merchantTrxId,
  partnerTrxId,
  idMerchant,
  idAgent,
  status,
  filterResetKey,
  platformTrxIdRef,
  merchantTrxIdRef,
  partnerTrxIdRef,
  idMerchantRef,
  idAgentRef,
  createdFromInput,
  createdToInput,
  successFromInput,
  successToInput,
  columnConfigs,
  visibleColumns,
  isRefreshing,
  onSearch,
  onRefresh,
  onReset,
  onDatePickerApply,
  onDatePickerClose,
  onSuccessDatePickerApply,
  onSuccessDatePickerClose,
  onCreatedFromChange,
  onCreatedToChange,
  onSuccessFromChange,
  onSuccessToChange,
  onToggleColumnVisibility,
}: DisbursementFiltersProps) {
  const { t } = useLanguage();
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState(status);
  useEffect(() => {
    setStatusDraft(status);
  }, [status]);
  const appliedRef = useRef(false);
  const snapshotRef = useRef({
    platformTrxId,
    merchantTrxId,
    partnerTrxId,
    idMerchant,
    idAgent,
    status,
    createdFromInput,
    createdToInput,
    successFromInput,
    successToInput,
  });
  const activeFilterCount = useMemo(() => {
    const extraFilters =
      Number(Boolean(platformTrxId.trim())) +
      Number(Boolean(merchantTrxId.trim())) +
      Number(Boolean(partnerTrxId.trim())) +
      Number(Boolean(idMerchant.trim())) +
      Number(Boolean(idAgent.trim())) +
      Number(status !== 'all') +
      Number(Boolean(successFromInput.trim())) +
      Number(Boolean(successToInput.trim()));

    return 2 + extraFilters;
  }, [
    idAgent,
    idMerchant,
    merchantTrxId,
    partnerTrxId,
    platformTrxId,
    status,
    successFromInput,
    successToInput,
  ]);

  const restoreSnapshot = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (platformTrxIdRef.current) platformTrxIdRef.current.value = snapshot.platformTrxId;
    if (merchantTrxIdRef.current) merchantTrxIdRef.current.value = snapshot.merchantTrxId;
    if (partnerTrxIdRef.current) partnerTrxIdRef.current.value = snapshot.partnerTrxId;
    if (idMerchantRef.current) idMerchantRef.current.value = snapshot.idMerchant;
    if (idAgentRef.current) idAgentRef.current.value = snapshot.idAgent;
    setStatusDraft(snapshot.status);
    onCreatedFromChange(snapshot.createdFromInput);
    onCreatedToChange(snapshot.createdToInput);
    onSuccessFromChange(snapshot.successFromInput);
    onSuccessToChange(snapshot.successToInput);
  }, [
    idAgentRef,
    idMerchantRef,
    merchantTrxIdRef,
    onCreatedFromChange,
    onCreatedToChange,
    onSuccessFromChange,
    onSuccessToChange,
    partnerTrxIdRef,
    platformTrxIdRef,
  ]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        appliedRef.current = false;
        setStatusDraft(status);
        snapshotRef.current = {
          platformTrxId: platformTrxIdRef.current?.value ?? platformTrxId,
          merchantTrxId: merchantTrxIdRef.current?.value ?? merchantTrxId,
          partnerTrxId: partnerTrxIdRef.current?.value ?? partnerTrxId,
          idMerchant: idMerchantRef.current?.value ?? idMerchant,
          idAgent: idAgentRef.current?.value ?? idAgent,
          status,
          createdFromInput,
          createdToInput,
          successFromInput,
          successToInput,
        };
      }

      if (!nextOpen && !appliedRef.current) {
        restoreSnapshot();
      }
      setIsFilterDialogOpen(nextOpen);
    },
    [
      createdFromInput,
      createdToInput,
      idAgent,
      idAgentRef,
      idMerchant,
      idMerchantRef,
      merchantTrxId,
      merchantTrxIdRef,
      partnerTrxId,
      partnerTrxIdRef,
      platformTrxId,
      platformTrxIdRef,
      restoreSnapshot,
      status,
      successFromInput,
      successToInput,
    ],
  );

  return (
    <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2 max-md:self-start">
        <CardTitle className="max-[480px]:leading-[1.5]">{t('disbursement.cardTitle')}</CardTitle>
        <CardDescription>{t('disbursement.cardDescription')}</CardDescription>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button
          className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
          onClick={onRefresh}
          aria-label={t('common.refresh')}
        >
          <RefreshCcw className={cn('h-4 w-4 transition', isRefreshing && 'animate-spin')} aria-hidden />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="w-auto bg-primary text-white hover:bg-primary/90 flex items-center justify-center"
              aria-label={t('disbursement.filters.columns')}
            >
              <Filter className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
            <DropdownMenuLabel className="font-medium">{t('disbursement.filters.toggleColumns')}</DropdownMenuLabel>
            {columnConfigs.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={visibleColumns.has(column.id)}
                onCheckedChange={(checked) => onToggleColumnVisibility(column.id, !!checked)}
                onSelect={(event) => event.preventDefault()}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={isFilterDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {t('disbursement.filters.title')}
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>{t('disbursement.filters.title')}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="disbursement-filter-platform-trx-id">{t('disbursement.filters.platformTrxId')}</Label>
                  <Input
                    key={`platform-${filterResetKey}`}
                    id="disbursement-filter-platform-trx-id"
                    defaultValue={platformTrxId}
                    ref={platformTrxIdRef}
                    placeholder={t('disbursement.filters.platformTrxIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="disbursement-filter-merchant-trx-id">{t('disbursement.filters.merchantTrxId')}</Label>
                  <Input
                    key={`merchant-trx-${filterResetKey}`}
                    id="disbursement-filter-merchant-trx-id"
                    defaultValue={merchantTrxId}
                    ref={merchantTrxIdRef}
                    placeholder={t('disbursement.filters.merchantTrxIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="disbursement-filter-partner-trx-id">{t('disbursement.filters.partnerTrxId')}</Label>
                  <Input
                    key={`partner-trx-${filterResetKey}`}
                    id="disbursement-filter-partner-trx-id"
                    defaultValue={partnerTrxId}
                    ref={partnerTrxIdRef}
                    placeholder={t('disbursement.filters.partnerTrxIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="disbursement-filter-merchant-id">{t('disbursement.filters.merchantId')}</Label>
                  <Input
                    key={`merchant-${filterResetKey}`}
                    id="disbursement-filter-merchant-id"
                    defaultValue={idMerchant}
                    ref={idMerchantRef}
                    placeholder={t('disbursement.filters.merchantIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="disbursement-filter-agent-id">{t('disbursement.filters.agentId')}</Label>
                  <Input
                    key={`agent-${filterResetKey}`}
                    id="disbursement-filter-agent-id"
                    defaultValue={idAgent}
                    ref={idAgentRef}
                    placeholder={t('disbursement.filters.agentIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="disbursement-filter-status">{t('disbursement.filters.status')}</Label>
                  <Select
                    key={`status-${filterResetKey}`}
                    value={statusDraft}
                    onValueChange={setStatusDraft}
                  >
                    <SelectTrigger id="disbursement-filter-status" className="bg-background">
                      <SelectValue placeholder={t('disbursement.filters.statusPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('disbursement.filters.statusAll')}</SelectItem>
                      {DISBURSEMENT_STATUS_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`disbursement.status.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <DatePickerField
                  label={t('disbursement.filters.createdFrom')}
                  value={createdFromInput}
                  onChange={onCreatedFromChange}
                  onApply={(value) => onDatePickerApply(value, 'from')}
                  onClose={onDatePickerClose}
                />
                <DatePickerField
                  label={t('disbursement.filters.createdTo')}
                  value={createdToInput}
                  onChange={onCreatedToChange}
                  onApply={(value) => onDatePickerApply(value, 'to')}
                  onClose={onDatePickerClose}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DatePickerField
                  label={t('disbursement.filters.successFrom')}
                  value={successFromInput}
                  onChange={onSuccessFromChange}
                  onApply={(value) => onSuccessDatePickerApply(value, 'from')}
                  onClose={onSuccessDatePickerClose}
                />
                <DatePickerField
                  label={t('disbursement.filters.successTo')}
                  value={successToInput}
                  onChange={onSuccessToChange}
                  onApply={(value) => onSuccessDatePickerApply(value, 'to')}
                  onClose={onSuccessDatePickerClose}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  appliedRef.current = false;
                  restoreSnapshot();
                  setIsFilterDialogOpen(false);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 sm:w-auto"
                onClick={() => {
                  appliedRef.current = true;
                  onSearch({ status: statusDraft });
                  setIsFilterDialogOpen(false);
                }}
              >
                {t('common.search')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          onClick={onReset}
          className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
        >
          {t('common.reset')}
        </Button>
      </div>
    </CardHeader>
  );
});

const DisbursementTable = memo(function DisbursementTable({
  disbursements,
  visibleColumnConfigs,
  calculatedMinTableWidth,
  isLoading,
  tableWrapperRef,
}: {
  disbursements: DisbursementItem[];
  visibleColumnConfigs: DisbursementColumnConfig[];
  calculatedMinTableWidth: string;
  isLoading: boolean;
  tableWrapperRef: React.RefObject<HTMLDivElement>;
}) {
  const { t } = useLanguage();

  return (
    <div className="overflow-x-auto sm:rounded-md sm:border" ref={tableWrapperRef}>
      <Table style={{ minWidth: calculatedMinTableWidth }}>
        <TableHeader>
          <TableRow>
            {visibleColumnConfigs.length === 0 ? (
              <TableHead className="whitespace-nowrap">{t('disbursement.table.noColumns')}</TableHead>
            ) : (
              visibleColumnConfigs.map((column) => (
                <TableHead key={column.id} className={column.headerClassName}>
                  {column.label}
                </TableHead>
              ))
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`}>
                {(visibleColumnConfigs.length > 0 ? visibleColumnConfigs : [null]).map((column, colIndex) => (
                  <TableCell
                    key={`skeleton-cell-${rowIndex}-${colIndex}`}
                    data-label={column?.label}
                    className={column?.cellClassName}
                  >
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : disbursements.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={Math.max(visibleColumnConfigs.length, 1)}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Inbox className="h-7 w-7" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-medium text-foreground">{t('disbursement.empty.title')}</div>
                    <div>{t('disbursement.empty.description')}</div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            disbursements.map((disbursement) => (
              <TableRow key={disbursement.id}>
                {visibleColumnConfigs.map((column) => (
                  <TableCell
                    key={column.id}
                    data-label={column.label}
                    className={column.cellClassName ?? 'whitespace-nowrap'}
                  >
                    {column.render(disbursement)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
});

const DisbursementTableShell = memo(function DisbursementTableShell({
  disbursements,
  visibleColumnConfigs,
  calculatedMinTableWidth,
  isLoading,
  tableWrapperRef,
}: {
  disbursements: DisbursementItem[];
  visibleColumnConfigs: DisbursementColumnConfig[];
  calculatedMinTableWidth: string;
  isLoading: boolean;
  tableWrapperRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="relative">
      <DisbursementTable
        disbursements={disbursements}
        visibleColumnConfigs={visibleColumnConfigs}
        calculatedMinTableWidth={calculatedMinTableWidth}
        isLoading={isLoading}
        tableWrapperRef={tableWrapperRef}
      />
    </div>
  );
});

const DisbursementPagination = memo(function DisbursementPagination({
  page,
  limit,
  totalPages,
  totalItems,
  pageOptions,
  disbursementsLength,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number | undefined;
  pageOptions: number[];
  disbursementsLength: number;
  onPageChange: (nextPage: number) => void;
  onLimitChange: (nextLimit: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Page</span>
          <Select value={String(page)} onValueChange={(value) => onPageChange(Number(value))}>
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
          <span>Limit</span>
          <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          {totalItems ?? disbursementsLength} transactions
        </div>
      </div>

      {disbursementsLength > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
            onClick={() => onPageChange(Math.min(totalPages || 1, page + 1))}
            disabled={(totalPages || 1) <= page}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
});

export function AdminDisbursementPage() {
  const { t } = useLanguage();
  const [disbursements, setDisbursements] = useState<DisbursementItem[]>([]);
  const deferredDisbursements = useDeferredValue(disbursements);
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [platformTrxId, setPlatformTrxId] = useState('');
  const [merchantTrxId, setMerchantTrxId] = useState('');
  const [partnerTrxId, setPartnerTrxId] = useState('');
  const [idMerchant, setIdMerchant] = useState('');
  const [idAgent, setIdAgent] = useState('');
  const [status, setStatus] = useState('all');
  const [createdFromDate, setCreatedFromDate] = useState(getDefaultCreatedFromDate());
  const [createdToDate, setCreatedToDate] = useState(getDateOnlyString(new Date()));
  const [createdFromInput, setCreatedFromInput] = useState(getDefaultCreatedFromDate());
  const [createdToInput, setCreatedToInput] = useState(getDateOnlyString(new Date()));
  const [successFromDate, setSuccessFromDate] = useState('');
  const [successToDate, setSuccessToDate] = useState('');
  const [successFromInput, setSuccessFromInput] = useState('');
  const [successToInput, setSuccessToInput] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | undefined>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<DisbursementSummary | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<DisbursementColumnId>>(new Set());
  const [filterResetKey, setFilterResetKey] = useState(0);
  const platformTrxIdRef = useRef<HTMLInputElement | null>(null);
  const merchantTrxIdRef = useRef<HTMLInputElement | null>(null);
  const partnerTrxIdRef = useRef<HTMLInputElement | null>(null);
  const idMerchantRef = useRef<HTMLInputElement | null>(null);
  const idAgentRef = useRef<HTMLInputElement | null>(null);
  const skipAutoFetchRef = useRef(false);
  const isTableBusy = isLoading || isPending;
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isActionColumnStuck, setIsActionColumnStuck] = useState(false);
  const [callbackDialogOpen, setCallbackDialogOpen] = useState(false);
  const [callbackItem, setCallbackItem] = useState<DisbursementItem | null>(null);
  const [isCallbackSubmitting, setIsCallbackSubmitting] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updatePlatformTrxId, setUpdatePlatformTrxId] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [isUpdateSubmitting, setIsUpdateSubmitting] = useState(false);
  const canResendCallback = useMemo(() => getStoredUserPermissions().includes('trx:resendCallback'), []);
  const canUpdateFailedDisbursement = useMemo(
    () => getStoredUserPermissions().includes('disbursement:update:failed'),
    [],
  );

  const handleCallbackOpen = useCallback((item: DisbursementItem) => {
    setCallbackItem(item);
    setCallbackDialogOpen(true);
  }, []);

  const handleCallbackClose = useCallback(() => {
    setCallbackDialogOpen(false);
    setCallbackItem(null);
  }, []);

  const handleUpdateOpen = useCallback((item: DisbursementItem) => {
    setUpdatePlatformTrxId(item.platformTrxId ?? '');
    setUpdatePassword('');
    setShowUpdatePassword(false);
    setUpdateDialogOpen(true);
  }, []);

  const handleUpdateClose = useCallback(() => {
    setUpdateDialogOpen(false);
    setUpdatePlatformTrxId('');
    setUpdatePassword('');
    setShowUpdatePassword(false);
  }, []);

  const resetFilters = useCallback(() => {
    const today = getDateOnlyString(new Date());
    const defaultFromDate = getDefaultCreatedFromDate();
    setPlatformTrxId('');
    setMerchantTrxId('');
    setPartnerTrxId('');
    setIdMerchant('');
    setIdAgent('');
    setStatus('all');
    setCreatedFromDate(defaultFromDate);
    setCreatedToDate(today);
    setCreatedFromInput(defaultFromDate);
    setCreatedToInput(today);
    setSuccessFromDate('');
    setSuccessToDate('');
    setSuccessFromInput('');
    setSuccessToInput('');
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    setFilterResetKey((prev) => prev + 1);
  }, [resetFilters]);

  const columnConfigs = useMemo<DisbursementColumnConfig[]>(
    () => [
      {
        id: 'id',
        label: t('disbursement.table.id'),
        headerClassName: 'w-[100px] whitespace-nowrap',
        cellClassName: 'font-medium whitespace-nowrap',
        render: (disbursement) => disbursement.id ?? '-',
      },
      {
        id: 'platformTrxId',
        label: t('disbursement.table.platformTrxId'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.platformTrxId ?? '-',
      },
      {
        id: 'merchantTrxId',
        label: t('disbursement.table.merchantTrxId'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.merchantTrxId ?? '-',
      },
      {
        id: 'partnerTrxId',
        label: t('disbursement.table.partnerTrxId'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.partnerTrxId ?? '-',
      },
      {
        id: 'merchantInfo',
        label: t('disbursement.table.merchantInfo'),
        headerClassName: 'w-[220px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => formatEntityInfo(disbursement.idMerchant, disbursement.merchantName),
      },
      {
        id: 'agentInfo',
        label: t('disbursement.table.agentInfo'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => formatEntityInfo(disbursement.idAgent, disbursement.agentName),
      },
      {
        id: 'channelName',
        label: t('disbursement.table.channelName'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.channelName ?? '-',
      },
      {
        id: 'accountNo',
        label: t('disbursement.table.accountNo'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.accountNo ?? '-',
      },
      {
        id: 'accountName',
        label: t('disbursement.table.accountName'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.accountName ?? '-',
      },
      {
        id: 'bankCode',
        label: t('disbursement.table.bankCode'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.bankCode ?? '-',
      },
      {
        id: 'amount',
        label: t('disbursement.table.amount'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => formatAmount(disbursement.amount),
      },
      {
        id: 'biayaChannel',
        label: t('disbursement.table.channelFee'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => formatAmount(disbursement.biayaChannel),
      },
      {
        id: 'biayaPlatform',
        label: t('disbursement.table.platformFee'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => formatAmount(disbursement.biayaPlatform),
      },
      {
        id: 'biayaAgent',
        label: t('disbursement.table.agentFee'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => formatAmount(disbursement.biayaAgent),
      },
      {
        id: 'status',
        label: t('disbursement.table.status'),
        headerClassName: 'w-[120px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => {
          const normalizedStatus = disbursement.status?.toLowerCase();
          const statusKey =
            normalizedStatus === 'success' ||
            normalizedStatus === 'failed' ||
            normalizedStatus === 'process' ||
            normalizedStatus === 'pending' ||
            normalizedStatus === 'refund'
              ? normalizedStatus
              : undefined;
          const badgeStyle = getStatusBadgeStyle(statusKey);
          const statusLabel = statusKey ? t(`disbursement.status.${statusKey}`) : disbursement.status ?? '-';

          return (
            <Badge
              variant={badgeStyle.variant}
              appearance={badgeStyle.appearance}
              className={badgeStyle.className}
            >
              {statusLabel}
            </Badge>
          );
        },
      },
      {
        id: 'created_at',
        label: t('disbursement.table.createdAt'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.created_at ?? '-',
      },
      {
        id: 'success_at',
        label: t('disbursement.table.successAt'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (disbursement) => disbursement.success_at ?? '-',
      },
      {
        id: 'action',
        label: t('disbursement.table.action'),
        headerClassName: cn(
          'sticky right-0 z-10 bg-background text-center w-[160px] whitespace-nowrap',
          isActionColumnStuck && 'border-l border-border',
        ),
        cellClassName: cn(
          'sticky right-0 z-10 sm:bg-background sm:text-center w-[160px] sm:group-hover:bg-muted w-full sm:w-fit',
          isActionColumnStuck && 'border-l border-border',
        ),
        render: (disbursement) => {
          const normalizedStatus = disbursement.status?.toLowerCase();
          const canUpdateFailedForStatus = normalizedStatus === 'success' || normalizedStatus === 'process';
          const canResendCallbackForStatus = normalizedStatus === 'success' || normalizedStatus === 'failed';

          return (
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:justify-center">
            {canUpdateFailedDisbursement && canUpdateFailedForStatus && (
              <Button
                size="sm"
                className="w-full max-w-[120px] bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800"
                onClick={() => handleUpdateOpen(disbursement)}
              >
                {t('disbursement.actions.update')}
              </Button>
            )}
            {canResendCallback && canResendCallbackForStatus && (
              <Button
                size="sm"
                className="w-full max-w-[120px] bg-primary text-white hover:bg-primary/90 active:bg-primary/80"
                onClick={() => handleCallbackOpen(disbursement)}
              >
                {t('disbursement.actions.callback')}
              </Button>
            )}
          </div>
          );
        },
      },
    ],
    [canResendCallback, canUpdateFailedDisbursement, handleCallbackOpen, handleUpdateOpen, isActionColumnStuck, t],
  );

  const allColumnIds = useMemo(() => columnConfigs.map((column) => column.id), [columnConfigs]);

  useEffect(() => {
    if (visibleColumns.size === 0 && allColumnIds.length > 0) {
      setVisibleColumns(new Set(allColumnIds));
    }
  }, [allColumnIds, visibleColumns]);

  const visibleColumnConfigs = useMemo(
    () => columnConfigs.filter((column) => visibleColumns.has(column.id)),
    [columnConfigs, visibleColumns],
  );

  const calculatedMinTableWidth = useMemo(
    () => `${Math.max(visibleColumnConfigs.length * 140, 700)}px`,
    [visibleColumnConfigs.length],
  );

  const toggleColumnVisibility = useCallback((columnId: DisbursementColumnId, isVisible: boolean) => {
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
    const calculatedPages = Math.max(1, totalPages || Math.ceil((totalItems ?? 0) / limit) || 1);

    return Array.from({ length: calculatedPages }, (_, index) => index + 1);
  }, [limit, totalItems, totalPages]);

  const fetchDisbursements = useCallback(
    async (
      controller?: AbortController,
      overrides?: Partial<{
        page: number;
        limit: number;
        platformTrxId: string;
        merchantTrxId: string;
        partnerTrxId: string;
        idMerchant: string;
        idAgent: string;
        status: string;
        createdFromDate: string;
        createdToDate: string;
        successFromDate: string;
        successToDate: string;
      }>,
    ) => {
      const nextPage = overrides?.page ?? page;
      const nextLimit = overrides?.limit ?? limit;
      const nextPlatformTrxId = overrides?.platformTrxId ?? platformTrxId;
      const nextMerchantTrxId = overrides?.merchantTrxId ?? merchantTrxId;
      const nextPartnerTrxId = overrides?.partnerTrxId ?? partnerTrxId;
      const nextIdMerchant = overrides?.idMerchant ?? idMerchant;
      const nextIdAgent = overrides?.idAgent ?? idAgent;
      const nextStatus = overrides?.status ?? status;
      const nextCreatedFromDate = overrides?.createdFromDate ?? createdFromDate;
      const nextCreatedToDate = overrides?.createdToDate ?? createdToDate;
      const nextSuccessFromDate = overrides?.successFromDate ?? successFromDate;
      const nextSuccessToDate = overrides?.successToDate ?? successToDate;
      const activeController = controller ?? new AbortController();
      const errorToastStyle = {
        border: '2px solid #fda4af',
        background: '#fff1f2',
        color: '#f43f5e',
        boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
        padding: '0.5rem',
      } as const;

      setIsLoading(true);
      try {
        const response = await apiFetch<DisbursementListResponse>('/transaction/disbursement/list', {
          method: 'POST',
          body: {
            page: nextPage,
            limit: nextLimit,
            ...(nextPlatformTrxId.trim() ? { platformTrxId: nextPlatformTrxId.trim() } : {}),
            ...(nextMerchantTrxId.trim() ? { merchantTrxId: nextMerchantTrxId.trim() } : {}),
            ...(nextPartnerTrxId.trim() ? { partnerTrxId: nextPartnerTrxId.trim() } : {}),
            ...(nextIdMerchant.trim() ? { idMerchant: nextIdMerchant.trim() } : {}),
            ...(nextIdAgent.trim() ? { idAgent: nextIdAgent.trim() } : {}),
            ...(nextStatus !== 'all' ? { status: nextStatus } : {}),
            createdFrom: getStartOfDayString(new Date(nextCreatedFromDate)),
            createdTo: getEndOfDayString(new Date(nextCreatedToDate)),
            ...(nextSuccessFromDate.trim()
              ? { successFrom: getStartOfDayString(new Date(nextSuccessFromDate)) }
              : {}),
            ...(nextSuccessToDate.trim() ? { successTo: getEndOfDayString(new Date(nextSuccessToDate)) } : {}),
          },
          signal: activeController.signal,
        });

        const receivedDisbursements = Array.isArray(response.data) ? response.data : [];
        startTransition(() => {
          setDisbursements(receivedDisbursements);
          setTotalPages(response.pagination?.totalPages ?? 1);
          setTotalItems(response.pagination?.total ?? receivedDisbursements.length);
          setSummary(response.summary ?? null);
        });
      } catch (error) {
        if (error instanceof ApiAuthError) {
          toast.error(t('auth.sessionExpired'), {
            duration: 1500,
            style: errorToastStyle,
          });
        } else {
          toast.error(error instanceof Error ? error.message : t('disbursement.toast.loadError'), {
            duration: 1500,
            style: errorToastStyle,
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      createdFromDate,
      createdToDate,
      idAgent,
      idMerchant,
      limit,
      merchantTrxId,
      page,
      partnerTrxId,
      platformTrxId,
      status,
      successFromDate,
      successToDate,
    ],
  );

  const triggerDisbursementSearch = useCallback(
    (
      overrides?: Partial<{
        page: number;
        platformTrxId: string;
        merchantTrxId: string;
        partnerTrxId: string;
        idMerchant: string;
        idAgent: string;
        status: string;
        createdFromDate: string;
        createdToDate: string;
        successFromDate: string;
        successToDate: string;
      }>,
    ) => {
      const nextPage = overrides?.page ?? page;
      const nextPlatformTrxId = overrides?.platformTrxId ?? platformTrxId;
      const nextMerchantTrxId = overrides?.merchantTrxId ?? merchantTrxId;
      const nextPartnerTrxId = overrides?.partnerTrxId ?? partnerTrxId;
      const nextIdMerchant = overrides?.idMerchant ?? idMerchant;
      const nextIdAgent = overrides?.idAgent ?? idAgent;
      const nextStatus = overrides?.status ?? status;
      const nextCreatedFromDate = overrides?.createdFromDate ?? createdFromDate;
      const nextCreatedToDate = overrides?.createdToDate ?? createdToDate;
      const nextSuccessFromDate = overrides?.successFromDate ?? successFromDate;
      const nextSuccessToDate = overrides?.successToDate ?? successToDate;

      skipAutoFetchRef.current = true;
      setPage(nextPage);
      setPlatformTrxId(nextPlatformTrxId);
      setMerchantTrxId(nextMerchantTrxId);
      setPartnerTrxId(nextPartnerTrxId);
      setIdMerchant(nextIdMerchant);
      setIdAgent(nextIdAgent);
      setStatus(nextStatus);
      setCreatedFromDate(nextCreatedFromDate);
      setCreatedToDate(nextCreatedToDate);
      setSuccessFromDate(nextSuccessFromDate);
      setSuccessToDate(nextSuccessToDate);

      void fetchDisbursements(undefined, {
        page: nextPage,
        limit,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        status: nextStatus,
        createdFromDate: nextCreatedFromDate,
        createdToDate: nextCreatedToDate,
        successFromDate: nextSuccessFromDate,
        successToDate: nextSuccessToDate,
      });
    },
    [
      createdFromDate,
      createdToDate,
      fetchDisbursements,
      idAgent,
      idMerchant,
      limit,
      merchantTrxId,
      page,
      partnerTrxId,
      platformTrxId,
      status,
      successFromDate,
      successToDate,
    ],
  );

  const handleDatePickerApply = useCallback(
    (nextValue: string, field: 'from' | 'to') => {
      const nextPlatformTrxId = platformTrxIdRef.current?.value ?? platformTrxId;
      const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? merchantTrxId;
      const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? partnerTrxId;
      const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
      const nextIdAgent = idAgentRef.current?.value ?? idAgent;
      triggerDisbursementSearch({
        page: 1,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        status,
        createdFromDate: field === 'from' ? nextValue : createdFromInput,
        createdToDate: field === 'to' ? nextValue : createdToInput,
        successFromDate: successFromInput,
        successToDate: successToInput,
      });
    },
    [
      createdFromInput,
      createdToInput,
      idAgent,
      idMerchant,
      merchantTrxId,
      partnerTrxId,
      platformTrxId,
      status,
      successFromInput,
      successToInput,
      triggerDisbursementSearch,
    ],
  );

  const handleDatePickerClose = useCallback(() => {
    const nextPlatformTrxId = platformTrxIdRef.current?.value ?? platformTrxId;
    const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? merchantTrxId;
    const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? partnerTrxId;
    const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
    const nextIdAgent = idAgentRef.current?.value ?? idAgent;
    triggerDisbursementSearch({
      page: 1,
      platformTrxId: nextPlatformTrxId,
      merchantTrxId: nextMerchantTrxId,
      partnerTrxId: nextPartnerTrxId,
      idMerchant: nextIdMerchant,
      idAgent: nextIdAgent,
      status,
      createdFromDate: createdFromInput,
      createdToDate: createdToInput,
      successFromDate: successFromInput,
      successToDate: successToInput,
    });
  }, [
    createdFromInput,
    createdToInput,
    idAgent,
    idMerchant,
    merchantTrxId,
    partnerTrxId,
    platformTrxId,
    status,
    successFromInput,
    successToInput,
    triggerDisbursementSearch,
  ]);

  const handleSuccessDatePickerApply = useCallback(
    (nextValue: string, field: 'from' | 'to') => {
      const nextPlatformTrxId = platformTrxIdRef.current?.value ?? platformTrxId;
      const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? merchantTrxId;
      const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? partnerTrxId;
      const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
      const nextIdAgent = idAgentRef.current?.value ?? idAgent;
      triggerDisbursementSearch({
        page: 1,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        status,
        createdFromDate: createdFromInput,
        createdToDate: createdToInput,
        successFromDate: field === 'from' ? nextValue : successFromInput,
        successToDate: field === 'to' ? nextValue : successToInput,
      });
    },
    [
      createdFromInput,
      createdToInput,
      idAgent,
      idMerchant,
      merchantTrxId,
      partnerTrxId,
      platformTrxId,
      status,
      successFromInput,
      successToInput,
      triggerDisbursementSearch,
    ],
  );

  const handleSuccessDatePickerClose = useCallback(() => {
    const nextPlatformTrxId = platformTrxIdRef.current?.value ?? platformTrxId;
    const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? merchantTrxId;
    const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? partnerTrxId;
    const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
    const nextIdAgent = idAgentRef.current?.value ?? idAgent;
    triggerDisbursementSearch({
      page: 1,
      platformTrxId: nextPlatformTrxId,
      merchantTrxId: nextMerchantTrxId,
      partnerTrxId: nextPartnerTrxId,
      idMerchant: nextIdMerchant,
      idAgent: nextIdAgent,
      status,
      createdFromDate: createdFromInput,
      createdToDate: createdToInput,
      successFromDate: successFromInput,
      successToDate: successToInput,
    });
  }, [
    createdFromInput,
    createdToInput,
    idAgent,
    idMerchant,
    merchantTrxId,
    partnerTrxId,
    platformTrxId,
    status,
    successFromInput,
    successToInput,
    triggerDisbursementSearch,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchDisbursements();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchDisbursements]);

  const handleSendCallback = useCallback(async () => {
    if (!callbackItem?.platformTrxId) {
      toast.error(t('disbursement.toast.callbackMissingId'));
      return;
    }

    setIsCallbackSubmitting(true);
    handleCallbackClose();
    try {
      const response = await apiFetch<{ status: boolean; message?: string }>('transaction/resendCallback', {
        method: 'POST',
        body: {
          platformTrxId: callbackItem.platformTrxId,
        },
      });
      if (response.status) {
        toast.success(t('disbursement.toast.callbackSuccess'), {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        });
      } else {
        toast.error(t('disbursement.toast.callbackError'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('disbursement.toast.callbackError'));
    } finally {
      setIsCallbackSubmitting(false);
    }
  }, [callbackItem?.platformTrxId, handleCallbackClose, t]);

  const handleSendUpdate = useCallback(async () => {
    const trimmedPlatformTrxId = updatePlatformTrxId.trim();
    const trimmedPassword = updatePassword.trim();

    if (!trimmedPlatformTrxId) {
      toast.error(t('disbursement.toast.updateMissingPlatformTrxId'));
      return;
    }

    if (!trimmedPassword) {
      toast.error(t('disbursement.toast.updateMissingPassword'));
      return;
    }

    setIsUpdateSubmitting(true);
    handleUpdateClose();
    try {
      const response = await apiFetch<{ status: boolean; message?: string }>('transaction/disbursement/update/failed', {
        method: 'POST',
        body: {
          platformTrxId: trimmedPlatformTrxId,
          password: trimmedPassword,
        },
      });
      if (response.status) {
        toast.success(response.message || t('disbursement.toast.updateSuccess'), {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        });
      } else {
        toast.error(response.message || t('disbursement.toast.updateError'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('disbursement.toast.updateError'));
    } finally {
      setIsUpdateSubmitting(false);
    }
  }, [handleUpdateClose, t, updatePassword, updatePlatformTrxId]);

  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    const updateStickyState = () => {
      setIsActionColumnStuck(wrapper.scrollLeft > 0);
    };

    updateStickyState();
    wrapper.addEventListener('scroll', updateStickyState, { passive: true });

    return () => {
      wrapper.removeEventListener('scroll', updateStickyState);
    };
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      skipAutoFetchRef.current = true;
      setPage(nextPage);
      void fetchDisbursements(undefined, { page: nextPage, limit });
    },
    [fetchDisbursements, limit],
  );

  const handleLimitChange = useCallback(
    (nextLimit: number) => {
      skipAutoFetchRef.current = true;
      setLimit(nextLimit);
      setPage(1);
      void fetchDisbursements(undefined, { page: 1, limit: nextLimit });
    },
    [fetchDisbursements],
  );

  const handleSearch = useCallback(
    ({ status: nextStatus }: { status: string }) => {
      const nextPlatformTrxId = platformTrxIdRef.current?.value ?? '';
      const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? '';
      const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? '';
      const nextIdMerchant = idMerchantRef.current?.value ?? '';
      const nextIdAgent = idAgentRef.current?.value ?? '';
      triggerDisbursementSearch({
        page: 1,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        status: nextStatus,
        createdFromDate: createdFromInput,
        createdToDate: createdToInput,
        successFromDate: successFromInput,
        successToDate: successToInput,
      });
    },
    [createdFromInput, createdToInput, successFromInput, successToInput, triggerDisbursementSearch],
  );

  useEffect(() => {
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    fetchDisbursements(controller);

    return () => controller.abort();
  }, [fetchDisbursements]);

  useEffect(() => {
    setPage(1);
  }, [createdFromDate, createdToDate, successFromDate, successToDate]);

  useEffect(() => {
    setCreatedFromInput(createdFromDate);
    setCreatedToInput(createdToDate);
  }, [createdFromDate, createdToDate]);

  useEffect(() => {
    setSuccessFromInput(successFromDate);
    setSuccessToInput(successToDate);
  }, [successFromDate, successToDate]);

  useEffect(() => {
    const startDate = parseDateValue(createdFromDate);
    const endDate = parseDateValue(createdToDate);

    if (!startDate || !endDate) return;

    if (startDate > endDate) {
      setCreatedFromDate(getDateOnlyString(endDate));
      setCreatedToDate(getDateOnlyString(startDate));
    }
  }, [createdFromDate, createdToDate]);

  useEffect(() => {
    const startDate = parseDateValue(successFromDate);
    const endDate = parseDateValue(successToDate);

    if (!startDate || !endDate) return;

    if (startDate > endDate) {
      setSuccessFromDate(getDateOnlyString(endDate));
      setSuccessToDate(getDateOnlyString(startDate));
    }
  }, [successFromDate, successToDate]);

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('disbursement.pageTitle')}</h1>
      </div>

      <DisbursementSummaryCards summary={summary} isLoading={isLoading} />
      <div className="flex justify-start">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-primary bg-primary/90 px-3 py-1.5 text-xs font-medium text-white">
          <Info className="h-4 w-4" aria-hidden />
          <span>{t('disbursement.summary.caption')}</span>
        </div>
      </div>

      <Card>
        <DisbursementFilters
          platformTrxId={platformTrxId}
          merchantTrxId={merchantTrxId}
          partnerTrxId={partnerTrxId}
          idMerchant={idMerchant}
          idAgent={idAgent}
          status={status}
          filterResetKey={filterResetKey}
          platformTrxIdRef={platformTrxIdRef}
          merchantTrxIdRef={merchantTrxIdRef}
          partnerTrxIdRef={partnerTrxIdRef}
          idMerchantRef={idMerchantRef}
          idAgentRef={idAgentRef}
          createdFromInput={createdFromInput}
          createdToInput={createdToInput}
          successFromInput={successFromInput}
          successToInput={successToInput}
          columnConfigs={columnConfigs}
          visibleColumns={visibleColumns}
          isRefreshing={isRefreshing}
          onSearch={handleSearch}
          onRefresh={handleRefresh}
          onReset={handleResetFilters}
          onDatePickerApply={handleDatePickerApply}
          onDatePickerClose={handleDatePickerClose}
          onSuccessDatePickerApply={handleSuccessDatePickerApply}
          onSuccessDatePickerClose={handleSuccessDatePickerClose}
          onCreatedFromChange={setCreatedFromInput}
          onCreatedToChange={setCreatedToInput}
          onSuccessFromChange={setSuccessFromInput}
          onSuccessToChange={setSuccessToInput}
          onToggleColumnVisibility={toggleColumnVisibility}
        />
        <Separator />
        <CardContent className="flex flex-col gap-4 px-5 py-4 md:gap-5 md:px-6">
          <DisbursementTableShell
            disbursements={deferredDisbursements}
            visibleColumnConfigs={visibleColumnConfigs}
            calculatedMinTableWidth={calculatedMinTableWidth}
            isLoading={isTableBusy}
            tableWrapperRef={tableWrapperRef}
          />

          <DisbursementPagination
            page={page}
            limit={limit}
            totalPages={totalPages}
            totalItems={totalItems}
            pageOptions={pageOptions}
            disbursementsLength={disbursements.length}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </CardContent>
      </Card>

      <Dialog
        open={callbackDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCallbackClose();
          } else {
            setCallbackDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('disbursement.callback.title')}</DialogTitle>
            <DialogDescription>{t('disbursement.callback.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleCallbackClose} disabled={isCallbackSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80"
              onClick={handleSendCallback}
              disabled={isCallbackSubmitting}
            >
              {isCallbackSubmitting ? t('common.loading') : t('disbursement.actions.confirmCallback')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={updateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleUpdateClose();
          } else {
            setUpdateDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('disbursement.update.title')}</DialogTitle>
            <DialogDescription>{t('disbursement.update.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disbursement-update-platform-trx-id">{t('disbursement.update.platformTrxId')}</Label>
              <Input
                id="disbursement-update-platform-trx-id"
                value={updatePlatformTrxId}
                disabled
                placeholder={t('disbursement.update.platformTrxIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disbursement-update-password">{t('disbursement.update.password')}</Label>
              <div className="relative">
                <Input
                  id="disbursement-update-password"
                  type={showUpdatePassword ? 'text' : 'password'}
                  value={updatePassword}
                  onChange={(event) => setUpdatePassword(event.target.value)}
                  placeholder={t('disbursement.update.passwordPlaceholder')}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showUpdatePassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowUpdatePassword((prev) => !prev)}
                >
                  {showUpdatePassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleUpdateClose} disabled={isUpdateSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80"
              onClick={handleSendUpdate}
              disabled={isUpdateSubmitting || !updatePassword.trim()}
            >
              {isUpdateSubmitting ? t('common.loading') : t('disbursement.actions.confirmUpdate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDisbursementPage;
