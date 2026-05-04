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
import { CalendarIcon, CheckCircle2, ChevronDown, Clock3, Filter, Inbox, Info, RefreshCcw, SlidersHorizontal, Download, Loader2 } from 'lucide-react';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { getStoredAuthToken, getStoredUserPermissions } from '@/lib/auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/i18n/language-provider';

interface PayinItem {
  id: number;
  idMerchant?: number;
  idAgent?: number;
  agentName?: string;
  merchantName?: string;
  jenis?: string;
  channelName?: string;
  storeName?: string;
  idProduk?: number;
  merchantTrxId?: string;
  platformTrxId?: string;
  partnerTrxId?: string;
  amount?: number;
  feePercentage?: number;
  feeFixed?: number;
  biayaChannel?: number;
  biayaPlatform?: number;
  biayaAgent?: number;
  netAmount?: number;
  status?: string;
  rrn?: string;
  nmid?: string;
  idSettlement?: string;
  updateBy?: string;
  created_at?: string;
  updated_at?: string;
  success_at?: string;
}

interface PayinListResponse {
  status: boolean;
  message?: string;
  data: PayinItem[];
  summary?: PayinSummary;
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

const formatAmount = (amount?: number) =>
  typeof amount === 'number' ? amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

const formatRate = (feePercentage?: number, feeFixed?: number) => {
  if (feePercentage === undefined && feeFixed === undefined) {
    return '-';
  }

  const percentageValue =
    typeof feePercentage === 'number' ? `${feePercentage.toFixed(2)}%` : '-';
  const fixedValue = typeof feeFixed === 'number' ? feeFixed.toLocaleString('id-ID') : '-';

  return `${percentageValue} + ${fixedValue}`;
};

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

const getDateOnlyString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getStartOfDayString = (date: Date) => `${getDateOnlyString(date)} 00:00:00`;
const getEndOfDayString = (date: Date) => `${getDateOnlyString(date)} 23:59:59`;
const getDateTimeString = (date: Date, time: string, fallback: string) => {
  const normalizedTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback;
  return `${getDateOnlyString(date)} ${normalizedTime}:00`;
};
/** Default created-date range: yesterday through today (inclusive). */
const getDefaultCreatedFromDate = () => getDateOnlyString(new Date());

type PayinColumnId =
  | 'id'
  | 'platformTrxId'
  | 'merchantTrxId'
  | 'partnerTrxId'
  | 'merchantInfo'
  | 'jenis'
  | 'channelName'
  | 'storeName'
  | 'nmid'
  | 'agentInfo'
  | 'amount'
  | 'rate'
  | 'biayaChannel'
  | 'biayaAgent'
  | 'netAmount'
  | 'status'
  | 'rrn'
  | 'idSettlement'
  | 'updateBy'
  | 'created_at'
  | 'success_at'
  | 'updated_at'
  | 'action';

interface PayinColumnConfig {
  id: PayinColumnId;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (payin: PayinItem) => ReactNode;
}

/** Matches pga-be-admin transaksi list/export validation: pending | success | failed */
const PAYIN_STATUS_OPTIONS = ['pending', 'success', 'failed'] as const;

interface PayinFiltersProps {
  platformTrxId: string;
  merchantTrxId: string;
  partnerTrxId: string;
  storeName: string;
  nmid: string;
  idMerchant: string;
  idAgent: string;
  rrn: string;
  idSettlement: string;
  status: string;
  filterResetKey: number;
  platformTrxIdRef: React.MutableRefObject<HTMLInputElement | null>;
  merchantTrxIdRef: React.MutableRefObject<HTMLInputElement | null>;
  partnerTrxIdRef: React.MutableRefObject<HTMLInputElement | null>;
  idMerchantRef: React.MutableRefObject<HTMLInputElement | null>;
  idAgentRef: React.MutableRefObject<HTMLInputElement | null>;
  rrnRef: React.MutableRefObject<HTMLInputElement | null>;
  idSettlementRef: React.MutableRefObject<HTMLInputElement | null>;
  storeNameRef: React.MutableRefObject<HTMLInputElement | null>;
  nmidRef: React.MutableRefObject<HTMLInputElement | null>;
  createdFromInput: string;
  createdToInput: string;
  createdFromTimeInput: string;
  createdToTimeInput: string;
  successFromInput: string;
  successToInput: string;
  columnConfigs: PayinColumnConfig[];
  visibleColumns: Set<PayinColumnId>;
  isRefreshing: boolean;
  isExporting: boolean;
  canExport: boolean;
  onSearch: (payload: { status: string }) => void;
  onRefresh: () => void;
  onReset: () => void;
  onExport: () => void;
  onDatePickerApply: (value: string, field: 'from' | 'to') => void;
  onDatePickerClose: () => void;
  onSuccessDatePickerApply: (value: string, field: 'from' | 'to') => void;
  onSuccessDatePickerClose: (value: string, field: 'from' | 'to') => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onCreatedFromTimeChange: (value: string) => void;
  onCreatedToTimeChange: (value: string) => void;
  onSuccessFromChange: (value: string) => void;
  onSuccessToChange: (value: string) => void;
  onToggleColumnVisibility: (columnId: PayinColumnId, isVisible: boolean) => void;
}

interface PayinSummary {
  sumAmount?: number;
  sumBiayaChannel?: number;
  sumBiayaPlatform?: number;
  sumBiayaAgent?: number;
  sumProfit?: number;
  sumNetAmount?: number;
}

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onApply?: (value: string) => void;
  onClose?: () => void;
}

interface TimePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
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

function TimePickerField({ label, value, onChange }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () =>
      Array.from({ length: 24 * 4 }, (_, index) => {
        const hours = String(Math.floor(index / 4)).padStart(2, '0');
        const minutes = String((index % 4) * 15).padStart(2, '0');
        return `${hours}:${minutes}`;
      }),
    [],
  );

  return (
    <div className="flex min-w-[130px] flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-10 w-full justify-between px-3 text-xs font-medium"
            onClick={() => setOpen(true)}
          >
            <span className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5" />
              {value}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[130px] p-1" align="end" sideOffset={6}>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {options.map((time) => (
              <Button
                key={time}
                type="button"
                variant="ghost"
                onClick={() => {
                  onChange(time);
                  setOpen(false);
                }}
                className={cn(
                  'h-7 w-full justify-start gap-1.5 px-2 text-[11px]',
                  value === time && 'bg-accent font-semibold',
                )}
              >
                <Clock3 className="h-3 w-3" />
                {time}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const PayinSummaryCards = memo(function PayinSummaryCards({
  summary,
  isLoading,
}: {
  summary: PayinSummary | null;
  isLoading: boolean;
}) {
  const { t } = useLanguage();
  const isSummaryLoading = isLoading && !summary;
  const summaryItems = useMemo(
    () => [
      {
        key: 'amount',
        label: t('payin.summary.totalAmount'),
        value: formatAmount(summary?.sumAmount),
      },
      {
        key: 'channel',
        label: t('payin.summary.channelFee'),
        value: formatAmount(summary?.sumBiayaChannel),
      },
      {
        key: 'agent',
        label: t('payin.summary.agentFee'),
        value: formatAmount(summary?.sumBiayaAgent),
      },
      {
        key: 'profit',
        label: t('payin.summary.profit'),
        value: formatAmount(summary?.sumProfit),
      },
      {
        key: 'netAmount',
        label: t('payin.summary.netAmount'),
        value: formatAmount(summary?.sumNetAmount),
      },
    ],
    [
      summary?.sumAmount,
      summary?.sumBiayaAgent,
      summary?.sumBiayaChannel,
      summary?.sumNetAmount,
      summary?.sumProfit,
      t,
    ],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

const PayinFilters = memo(function PayinFilters({
  platformTrxId,
  merchantTrxId,
  partnerTrxId,
  storeName,
  nmid,
  idMerchant,
  idAgent,
  rrn,
  idSettlement,
  status,
  filterResetKey,
  platformTrxIdRef,
  merchantTrxIdRef,
  partnerTrxIdRef,
  storeNameRef,
  nmidRef,
  idMerchantRef,
  idAgentRef,
  rrnRef,
  idSettlementRef,
  createdFromInput,
  createdToInput,
  createdFromTimeInput,
  createdToTimeInput,
  successFromInput,
  successToInput,
  columnConfigs,
  visibleColumns,
  isRefreshing,
  isExporting,
  canExport,
  onSearch,
  onRefresh,
  onReset,
  onExport,
  onDatePickerApply,
  onDatePickerClose,
  onSuccessDatePickerApply,
  onSuccessDatePickerClose,
  onCreatedFromChange,
  onCreatedToChange,
  onCreatedFromTimeChange,
  onCreatedToTimeChange,
  onSuccessFromChange,
  onSuccessToChange,
  onToggleColumnVisibility,
}: PayinFiltersProps) {
  const { t } = useLanguage();
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState(status);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);
  const [merchants, setMerchants] = useState<MerchantFilterItem[]>([]);
  const [agents, setAgents] = useState<AgentFilterItem[]>([]);
  const [idMerchantDraft, setIdMerchantDraft] = useState(idMerchant);
  const [idAgentDraft, setIdAgentDraft] = useState(idAgent);
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
  useEffect(() => {
    setStatusDraft(status);
  }, [status]);
  useEffect(() => {
    setIdMerchantDraft(idMerchant);
  }, [idMerchant]);
  useEffect(() => {
    setIdAgentDraft(idAgent);
  }, [idAgent]);
  const appliedRef = useRef(false);
  const snapshotRef = useRef({
    platformTrxId,
    merchantTrxId,
    partnerTrxId,
    idMerchant,
    idAgent,
    rrn,
    idSettlement,
    status,
    createdFromInput,
    createdToInput,
    createdFromTimeInput,
    createdToTimeInput,
    successFromInput,
    successToInput,
  });
  const activeFilterCount = useMemo(() => {
    const extraFilters =
      Number(Boolean(platformTrxId.trim())) +
      Number(Boolean(merchantTrxId.trim())) +
      Number(Boolean(partnerTrxId.trim())) +
      Number(Boolean(storeName.trim())) +
      Number(Boolean(nmid.trim())) +
      Number(Boolean(idMerchant.trim())) +
      Number(Boolean(idAgent.trim())) +
      Number(Boolean(rrn.trim())) +
      Number(Boolean(idSettlement.trim())) +
      Number(status !== 'all') +
      Number(Boolean(successFromInput.trim())) +
      Number(Boolean(successToInput.trim()));

    return 2 + extraFilters;
  }, [
    idAgent,
    idMerchant,
    idSettlement,
    merchantTrxId,
    partnerTrxId,
    storeName,
    nmid,
    platformTrxId,
    rrn,
    status,
    successFromInput,
    successToInput,
  ]);

  const restoreSnapshot = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (platformTrxIdRef.current) platformTrxIdRef.current.value = snapshot.platformTrxId;
    if (merchantTrxIdRef.current) merchantTrxIdRef.current.value = snapshot.merchantTrxId;
    if (partnerTrxIdRef.current) partnerTrxIdRef.current.value = snapshot.partnerTrxId;
    if (storeNameRef.current) storeNameRef.current.value = snapshot.storeName;
    if (nmidRef.current) nmidRef.current.value = snapshot.nmid;
    if (idMerchantRef.current) idMerchantRef.current.value = snapshot.idMerchant;
    if (idAgentRef.current) idAgentRef.current.value = snapshot.idAgent;
    setIdMerchantDraft(snapshot.idMerchant);
    setIdAgentDraft(snapshot.idAgent);
    if (rrnRef.current) rrnRef.current.value = snapshot.rrn;
    if (idSettlementRef.current) idSettlementRef.current.value = snapshot.idSettlement;
    setStatusDraft(snapshot.status);
    onCreatedFromChange(snapshot.createdFromInput);
    onCreatedToChange(snapshot.createdToInput);
    onCreatedFromTimeChange(snapshot.createdFromTimeInput);
    onCreatedToTimeChange(snapshot.createdToTimeInput);
    onSuccessFromChange(snapshot.successFromInput);
    onSuccessToChange(snapshot.successToInput);
  }, [
    idAgentRef,
    idMerchantRef,
    idSettlementRef,
    merchantTrxIdRef,
    onCreatedFromChange,
    onCreatedToChange,
    onCreatedFromTimeChange,
    onCreatedToTimeChange,
    onSuccessFromChange,
    onSuccessToChange,
    partnerTrxIdRef,
    platformTrxIdRef,
    rrnRef,
    storeNameRef,
    nmidRef,
  ]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        appliedRef.current = false;
        setStatusDraft(status);
        setIdMerchantDraft(idMerchantRef.current?.value ?? idMerchant);
        setIdAgentDraft(idAgentRef.current?.value ?? idAgent);
        snapshotRef.current = {
          platformTrxId: platformTrxIdRef.current?.value ?? platformTrxId,
          merchantTrxId: merchantTrxIdRef.current?.value ?? merchantTrxId,
          partnerTrxId: partnerTrxIdRef.current?.value ?? partnerTrxId,
          storeName: storeNameRef.current?.value ?? storeName,
          nmid: nmidRef.current?.value ?? nmid,
          idMerchant: idMerchantRef.current?.value ?? idMerchant,
          idAgent: idAgentRef.current?.value ?? idAgent,
          rrn: rrnRef.current?.value ?? rrn,
          idSettlement: idSettlementRef.current?.value ?? idSettlement,
          status,
          createdFromInput,
          createdToInput,
          createdFromTimeInput,
          createdToTimeInput,
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
      createdFromTimeInput,
      createdToTimeInput,
      idAgent,
      idAgentRef,
      idMerchant,
      idMerchantRef,
      idSettlement,
      idSettlementRef,
      merchantTrxId,
      merchantTrxIdRef,
      partnerTrxId,
      partnerTrxIdRef,
      platformTrxId,
      platformTrxIdRef,
      rrn,
      rrnRef,
      restoreSnapshot,
      status,
      successFromInput,
      successToInput,
    ],
  );

  return (
    <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2 max-md:self-start">
        <CardTitle className="max-[480px]:leading-[1.5]">{t('payin.cardTitle')}</CardTitle>
        <CardDescription>{t('payin.cardDescription')}</CardDescription>
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
              aria-label={t('payin.filters.columns')}
            >
              <Filter className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
            <DropdownMenuLabel className="font-medium">{t('payin.filters.toggleColumns')}</DropdownMenuLabel>
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
              {t('payin.filters.title')}
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>{t('payin.filters.title')}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-platform-trx-id">{t('payin.filters.platformTrxId')}</Label>
                  <Input
                    key={`platform-${filterResetKey}`}
                    id="payin-filter-platform-trx-id"
                    defaultValue={platformTrxId}
                    ref={platformTrxIdRef}
                    placeholder={t('payin.filters.platformTrxIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-merchant-trx-id">{t('payin.filters.merchantTrxId')}</Label>
                  <Input
                    key={`merchant-trx-${filterResetKey}`}
                    id="payin-filter-merchant-trx-id"
                    defaultValue={merchantTrxId}
                    ref={merchantTrxIdRef}
                    placeholder={t('payin.filters.merchantTrxIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-partner-trx-id">{t('payin.filters.partnerTrxId')}</Label>
                  <Input
                    key={`partner-trx-${filterResetKey}`}
                    id="payin-filter-partner-trx-id"
                    defaultValue={partnerTrxId}
                    ref={partnerTrxIdRef}
                    placeholder={t('payin.filters.partnerTrxIdPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-store-name">{t('payin.filters.storeName')}</Label>
                  <Input
                    key={`store-name-${filterResetKey}`}
                    id="payin-filter-store-name"
                    defaultValue={storeName}
                    ref={storeNameRef}
                    placeholder={t('payin.filters.storeNamePlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-nmid">{t('payin.filters.nmid')}</Label>
                  <Input
                    key={`nmid-${filterResetKey}`}
                    id="payin-filter-nmid"
                    defaultValue={nmid}
                    ref={nmidRef}
                    placeholder={t('payin.filters.nmidPlaceholder')}
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-merchant-id">{t('payin.filters.merchantId')}</Label>
                  <Input key={`merchant-hidden-${filterResetKey}`} defaultValue={idMerchant} ref={idMerchantRef} className="hidden" />
                  <Select
                    key={`merchant-${filterResetKey}`}
                    value={idMerchantDraft || 'all'}
                    onValueChange={(value) => {
                      const normalizedValue = value === 'all' ? '' : value;
                      setIdMerchantDraft(normalizedValue);
                      if (idMerchantRef.current) idMerchantRef.current.value = normalizedValue;
                    }}
                    disabled={isLoadingMerchants}
                  >
                    <SelectTrigger id="payin-filter-merchant-id" className="bg-background">
                      <SelectValue placeholder={t('payin.filters.merchantIdPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('payin.filters.merchantIdAll')}</SelectItem>
                      {merchants.map((merchant) => (
                        <SelectItem key={merchant.id} value={String(merchant.id)}>
                          {merchant.id} - {merchant.name ?? '-'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-agent-id">{t('payin.filters.agentId')}</Label>
                  <Input key={`agent-hidden-${filterResetKey}`} defaultValue={idAgent} ref={idAgentRef} className="hidden" />
                  <Select
                    key={`agent-${filterResetKey}`}
                    value={idAgentDraft || 'all'}
                    onValueChange={(value) => {
                      const normalizedValue = value === 'all' ? '' : value;
                      setIdAgentDraft(normalizedValue);
                      if (idAgentRef.current) idAgentRef.current.value = normalizedValue;
                    }}
                    disabled={isLoadingMerchants}
                  >
                    <SelectTrigger id="payin-filter-agent-id" className="bg-background">
                      <SelectValue placeholder={t('payin.filters.agentIdPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('payin.filters.agentIdAll')}</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>
                          {agent.id} - {agent.name ?? '-'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-status">{t('payin.filters.status')}</Label>
                  <Select
                    key={`status-${filterResetKey}`}
                    value={statusDraft}
                    onValueChange={setStatusDraft}
                  >
                    <SelectTrigger id="payin-filter-status" className="bg-background">
                      <SelectValue placeholder={t('payin.filters.statusPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('payin.filters.statusAll')}</SelectItem>
                      {PAYIN_STATUS_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`payin.status.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Label htmlFor="payin-filter-rrn">{t('payin.filters.rrn')}</Label>
                  <Input
                    key={`rrn-${filterResetKey}`}
                    id="payin-filter-rrn"
                    defaultValue={rrn}
                    ref={rrnRef}
                    placeholder={t('payin.filters.rrnPlaceholder')}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-end gap-2">
                  <DatePickerField
                    label={t('payin.filters.createdFrom')}
                    value={createdFromInput}
                    onChange={onCreatedFromChange}
                    onApply={(value) => onDatePickerApply(value, 'from')}
                    onClose={onDatePickerClose}
                  />
                  <TimePickerField label="From Time" value={createdFromTimeInput} onChange={onCreatedFromTimeChange} />
                </div>
                <div className="flex items-end gap-2">
                  <DatePickerField
                    label={t('payin.filters.createdTo')}
                    value={createdToInput}
                    onChange={onCreatedToChange}
                    onApply={(value) => onDatePickerApply(value, 'to')}
                    onClose={onDatePickerClose}
                  />
                  <TimePickerField label="To Time" value={createdToTimeInput} onChange={onCreatedToTimeChange} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DatePickerField
                  label={t('payin.filters.successFrom')}
                  value={successFromInput}
                  onChange={onSuccessFromChange}
                  onApply={(value) => onSuccessDatePickerApply(value, 'from')}
                  onClose={onSuccessDatePickerClose}
                />
                <DatePickerField
                  label={t('payin.filters.successTo')}
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
        {canExport && (
          <Button
            className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2"
            onClick={onExport}
            disabled={isExporting}
            aria-label={t('payin.export.title')}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('payin.export.exporting')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden />
                {t('payin.export.title')}
              </>
            )}
          </Button>
        )}
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

const PayinTable = memo(function PayinTable({
  payins,
  visibleColumnConfigs,
  calculatedMinTableWidth,
  isLoading,
  tableWrapperRef,
}: {
  payins: PayinItem[];
  visibleColumnConfigs: PayinColumnConfig[];
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
              <TableHead className="whitespace-nowrap">{t('payin.table.noColumns')}</TableHead>
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
          ) : payins.length === 0 ? (
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
                    <div className="text-base font-medium text-foreground">{t('payin.empty.title')}</div>
                    <div>{t('payin.empty.description')}</div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            payins.map((payin) => (
              <TableRow key={payin.id}>
                {visibleColumnConfigs.map((column) => (
                  <TableCell
                    key={column.id}
                    data-label={column.label}
                    className={column.cellClassName ?? 'whitespace-nowrap'}
                  >
                    {column.render(payin)}
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

const PayinTableShell = memo(function PayinTableShell({
  payins,
  visibleColumnConfigs,
  calculatedMinTableWidth,
  isLoading,
  tableWrapperRef,
}: {
  payins: PayinItem[];
  visibleColumnConfigs: PayinColumnConfig[];
  calculatedMinTableWidth: string;
  isLoading: boolean;
  tableWrapperRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="relative">
      <PayinTable
        payins={payins}
        visibleColumnConfigs={visibleColumnConfigs}
        calculatedMinTableWidth={calculatedMinTableWidth}
        isLoading={isLoading}
        tableWrapperRef={tableWrapperRef}
      />
    </div>
  );
});

const PayinPagination = memo(function PayinPagination({
  page,
  limit,
  totalPages,
  totalItems,
  pageOptions,
  payinsLength,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number | undefined;
  pageOptions: number[];
  payinsLength: number;
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
          {totalItems ?? payinsLength} transactions
        </div>
      </div>

      {payinsLength > 0 && (
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

export function AdminPayinPage() {
  const { t } = useLanguage();
  const [payins, setPayins] = useState<PayinItem[]>([]);
  const deferredPayins = useDeferredValue(payins);
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [platformTrxId, setPlatformTrxId] = useState('');
  const [merchantTrxId, setMerchantTrxId] = useState('');
  const [partnerTrxId, setPartnerTrxId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [nmid, setNmid] = useState('');
  const [idMerchant, setIdMerchant] = useState('');
  const [idAgent, setIdAgent] = useState('');
  const [rrn, setRrn] = useState('');
  const [idSettlement, setIdSettlement] = useState('');
  const [status, setStatus] = useState('success');
  const [createdFromDate, setCreatedFromDate] = useState(getDefaultCreatedFromDate());
  const [createdToDate, setCreatedToDate] = useState(getDateOnlyString(new Date()));
  const [createdFromInput, setCreatedFromInput] = useState(getDefaultCreatedFromDate());
  const [createdToInput, setCreatedToInput] = useState(getDateOnlyString(new Date()));
  const [createdFromTimeInput, setCreatedFromTimeInput] = useState('00:00');
  const [createdToTimeInput, setCreatedToTimeInput] = useState('23:59');
  const [successFromDate, setSuccessFromDate] = useState('');
  const [successToDate, setSuccessToDate] = useState('');
  const [successFromInput, setSuccessFromInput] = useState('');
  const [successToInput, setSuccessToInput] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | undefined>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<PayinSummary | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<PayinColumnId>>(new Set());
  const [filterResetKey, setFilterResetKey] = useState(0);
  const platformTrxIdRef = useRef<HTMLInputElement | null>(null);
  const merchantTrxIdRef = useRef<HTMLInputElement | null>(null);
  const partnerTrxIdRef = useRef<HTMLInputElement | null>(null);
  const storeNameRef = useRef<HTMLInputElement | null>(null);
  const nmidRef = useRef<HTMLInputElement | null>(null);
  const idMerchantRef = useRef<HTMLInputElement | null>(null);
  const idAgentRef = useRef<HTMLInputElement | null>(null);
  const rrnRef = useRef<HTMLInputElement | null>(null);
  const idSettlementRef = useRef<HTMLInputElement | null>(null);
  const skipAutoFetchRef = useRef(false);
  const isTableBusy = isLoading || isPending;
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isActionColumnStuck, setIsActionColumnStuck] = useState(false);
  const [callbackDialogOpen, setCallbackDialogOpen] = useState(false);
  const [callbackItem, setCallbackItem] = useState<PayinItem | null>(null);
  const [isCallbackSubmitting, setIsCallbackSubmitting] = useState(false);
  const canResendCallback = useMemo(() => getStoredUserPermissions().includes('trx:resendCallback'), []);
  const canExport = useMemo(() => getStoredUserPermissions().includes('payin:export'), []);

  const handleCallbackOpen = useCallback((item: PayinItem) => {
    setCallbackItem(item);
    setCallbackDialogOpen(true);
  }, []);

  const handleCallbackClose = useCallback(() => {
    setCallbackDialogOpen(false);
    setCallbackItem(null);
  }, []);

  const resetFilters = useCallback(() => {
    const today = getDateOnlyString(new Date());
    const defaultFromDate = getDefaultCreatedFromDate();
    setPlatformTrxId('');
    setMerchantTrxId('');
    setPartnerTrxId('');
    setStoreName('');
    setNmid('');
    setIdMerchant('');
    setIdAgent('');
    setRrn('');
    setIdSettlement('');
    setStatus('success');
    setCreatedFromDate(defaultFromDate);
    setCreatedToDate(today);
    setCreatedFromInput(defaultFromDate);
    setCreatedToInput(today);
    setCreatedFromTimeInput('00:00');
    setCreatedToTimeInput('23:59');
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

  const columnConfigs = useMemo<PayinColumnConfig[]>(
    () => [
      {
        id: 'id',
        label: t('payin.table.id'),
        headerClassName: 'w-[100px] whitespace-nowrap',
        cellClassName: 'font-medium whitespace-nowrap',
        render: (payin) => payin.id ?? '-',
      },
      {
        id: 'platformTrxId',
        label: t('payin.table.platformTrxId'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.platformTrxId ?? '-',
      },
      {
        id: 'merchantTrxId',
        label: t('payin.table.merchantTrxId'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.merchantTrxId ?? '-',
      },
      {
        id: 'partnerTrxId',
        label: t('payin.table.partnerTrxId'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.partnerTrxId ?? '-',
      },
      {
        id: 'merchantInfo',
        label: t('payin.table.merchantInfo'),
        headerClassName: 'w-[220px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => formatEntityInfo(payin.idMerchant, payin.merchantName),
      },
      {
        id: 'jenis',
        label: t('payin.table.type'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.jenis ?? '-',
      },
      {
        id: 'channelName',
        label: t('payin.table.channelName'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.channelName ?? '-',
      },
      {
        id: 'storeName',
        label: t('payin.table.storeName'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.storeName ?? '-',
      },
      {
        id: 'nmid',
        label: t('payin.table.nmid'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.nmid ?? '-',
      },
      {
        id: 'agentInfo',
        label: t('payin.table.agentInfo'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => formatEntityInfo(payin.idAgent, payin.agentName),
      },
      {
        id: 'amount',
        label: t('payin.table.amount'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => formatAmount(payin.amount),
      },
      {
        id: 'rate',
        label: t('payin.table.rate'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => formatRate(payin.feePercentage, payin.feeFixed),
      },
      {
        id: 'biayaChannel',
        label: t('payin.table.channelFee'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => formatAmount(payin.biayaChannel),
      },
      {
        id: 'biayaAgent',
        label: t('payin.table.agentFee'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => formatAmount(payin.biayaAgent),
      },
      {
        id: 'netAmount',
        label: t('payin.table.netAmount'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => formatAmount(payin.netAmount),
      },
      {
        id: 'status',
        label: t('payin.table.status'),
        headerClassName: 'w-[120px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => (
          <Badge variant={payin.status === 'failed' ? 'destructive' : 'outline'}>{payin.status ?? '-'}</Badge>
        ),
      },
      {
        id: 'rrn',
        label: t('payin.table.rrn'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.rrn ?? '-',
      },
      {
        id: 'idSettlement',
        label: t('payin.table.settlementId'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.idSettlement ?? '-',
      },
      {
        id: 'updateBy',
        label: t('payin.table.updatedBy'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.updateBy ?? '-',
      },
      {
        id: 'created_at',
        label: t('payin.table.createdAt'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.created_at ?? '-',
      },
      {
        id: 'success_at',
        label: t('payin.table.successAt'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.success_at ?? '-',
      },
      {
        id: 'updated_at',
        label: t('payin.table.updatedAt'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (payin) => payin.updated_at ?? '-',
      },
      {
        id: 'action',
        label: t('payin.table.action'),
        headerClassName: cn(
          'sticky right-0 z-10 bg-background text-center w-[160px] whitespace-nowrap',
          isActionColumnStuck && 'border-l border-border',
        ),
        cellClassName: cn(
          'sticky right-0 z-10 sm:bg-background sm:text-center w-[160px] sm:group-hover:bg-muted w-full sm:w-fit',
          isActionColumnStuck && 'border-l border-border',
        ),
        render: (payin) => (
          <div className="flex w-full items-center justify-end sm:justify-center">
            {canResendCallback && !['pending', 'failed'].includes(payin.status?.toLowerCase() ?? '') && (
              <Button
                size="sm"
                className="w-full max-w-[120px] bg-primary text-white hover:bg-primary/90 active:bg-primary/80"
                onClick={() => handleCallbackOpen(payin)}
              >
                {t('payin.actions.callback')}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canResendCallback, handleCallbackOpen, isActionColumnStuck, t],
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

  const toggleColumnVisibility = useCallback((columnId: PayinColumnId, isVisible: boolean) => {
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

  const fetchPayins = useCallback(
    async (
      controller?: AbortController,
      overrides?: Partial<{
        page: number;
        limit: number;
        platformTrxId: string;
        merchantTrxId: string;
        partnerTrxId: string;
        storeName: string;
        nmid: string;
        idMerchant: string;
        idAgent: string;
        rrn: string;
        idSettlement: string;
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
      const nextStoreName = overrides?.storeName ?? storeName;
      const nextNmid = overrides?.nmid ?? nmid;
      const nextIdMerchant = overrides?.idMerchant ?? idMerchant;
      const nextIdAgent = overrides?.idAgent ?? idAgent;
      const nextRrn = overrides?.rrn ?? rrn;
      const nextIdSettlement = overrides?.idSettlement ?? idSettlement;
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
        const response = await apiFetch<PayinListResponse>('/transaction/payin/list', {
          method: 'POST',
          body: {
            page: nextPage,
            limit: nextLimit,
            ...(nextPlatformTrxId.trim() ? { platformTrxId: nextPlatformTrxId.trim() } : {}),
            ...(nextMerchantTrxId.trim() ? { merchantTrxId: nextMerchantTrxId.trim() } : {}),
            ...(nextPartnerTrxId.trim() ? { partnerTrxId: nextPartnerTrxId.trim() } : {}),
            ...(nextStoreName.trim() ? { storeName: nextStoreName.trim() } : {}),
            ...(nextNmid.trim() ? { nmid: nextNmid.trim() } : {}),
            ...(nextIdMerchant.trim() ? { idMerchant: nextIdMerchant.trim() } : {}),
            ...(nextIdAgent.trim() ? { idAgent: nextIdAgent.trim() } : {}),
            ...(nextRrn.trim() ? { rrn: nextRrn.trim() } : {}),
            ...(nextIdSettlement.trim() ? { idSettlement: nextIdSettlement.trim() } : {}),
            ...(nextStatus !== 'all' ? { status: nextStatus } : {}),
            createdFrom: getDateTimeString(new Date(nextCreatedFromDate), createdFromTimeInput, '00:00'),
            createdTo: getDateTimeString(new Date(nextCreatedToDate), createdToTimeInput, '23:59'),
            ...(nextSuccessFromDate.trim()
              ? { successFrom: getStartOfDayString(new Date(nextSuccessFromDate)) }
              : {}),
            ...(nextSuccessToDate.trim() ? { successTo: getEndOfDayString(new Date(nextSuccessToDate)) } : {}),
          },
          signal: activeController.signal,
        });

        const receivedPayins = Array.isArray(response.data) ? response.data : [];
        startTransition(() => {
          setPayins(receivedPayins);
          setTotalPages(response.pagination?.totalPages ?? 1);
          setTotalItems(response.pagination?.total ?? receivedPayins.length);
          setSummary(response.summary ?? null);
        });
      } catch (error) {
        if (error instanceof ApiAuthError) {
          toast.error(t('auth.sessionExpired'), {
            duration: 1500,
            style: errorToastStyle,
          });
        } else {
          toast.error(error instanceof Error ? error.message : t('payin.toast.loadError'), {
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
      idSettlement,
      limit,
      merchantTrxId,
      page,
      partnerTrxId,
      platformTrxId,
      rrn,
      status,
      successFromDate,
      successToDate,
    ],
  );

  // export current payin list respecting applied filters
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    const toastId = toast.loading(t('common.loading'));

    try {
      const apiRoot = import.meta.env.VITE_API_ROOT as string;
      if (!apiRoot) {
        throw new Error('API root URL is not configured');
      }

      const storedToken = getStoredAuthToken();
      
      // use native fetch to receive raw CSV text, calling the API server directly like other menus
      const response = await fetch(`${apiRoot.replace(/\/$/, '')}/transaction/payin/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        },
        body: JSON.stringify({
          page,
          limit,
          ...(platformTrxId.trim() ? { platformTrxId: platformTrxId.trim() } : {}),
          ...(merchantTrxId.trim() ? { merchantTrxId: merchantTrxId.trim() } : {}),
          ...(partnerTrxId.trim() ? { partnerTrxId: partnerTrxId.trim() } : {}),
          ...(storeName.trim() ? { storeName: storeName.trim() } : {}),
          ...(nmid.trim() ? { nmid: nmid.trim() } : {}),
          ...(idMerchant.trim() ? { idMerchant: idMerchant.trim() } : {}),
          ...(idAgent.trim() ? { idAgent: idAgent.trim() } : {}),
          ...(rrn.trim() ? { rrn: rrn.trim() } : {}),
          ...(idSettlement.trim() ? { idSettlement: idSettlement.trim() } : {}),
          ...(status !== 'all' ? { status } : {}),
          createdFrom: getDateTimeString(new Date(createdFromDate), createdFromTimeInput, '00:00'),
          createdTo: getDateTimeString(new Date(createdToDate), createdToTimeInput, '23:59'),
          ...(successFromDate.trim()
            ? { successFrom: getStartOfDayString(new Date(successFromDate)) }
            : {}),
          ...(successToDate.trim() ? { successTo: getEndOfDayString(new Date(successToDate)) } : {}),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errMsg = text;
        try {
          const json = JSON.parse(text) as { message?: string };
          if (json?.message) errMsg = json.message;
        } catch {
          /* keep text as-is */
        }
        throw new Error(errMsg);
      }

      const csvText = await response.text();
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payin_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('payin.toast.exportSuccess'), {
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />, // green check
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payin.toast.exportError'));
    } finally {
      toast.dismiss(toastId);
      setIsExporting(false);
    }
  }, [page, limit, platformTrxId, merchantTrxId, partnerTrxId, storeName, nmid, idMerchant, idAgent, rrn, idSettlement, status, createdFromDate, createdToDate, successFromDate, successToDate, t]);

  const triggerPayinSearch = useCallback(
    (
      overrides?: Partial<{
        page: number;
        platformTrxId: string;
        merchantTrxId: string;
        partnerTrxId: string;
       storeName: string;
       nmid: string;
        idMerchant: string;
        idAgent: string;
        rrn: string;
        idSettlement: string;
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
      const nextRrn = overrides?.rrn ?? rrn;
      const nextIdSettlement = overrides?.idSettlement ?? idSettlement;
      const nextStatus = overrides?.status ?? status;
      const nextStoreName = overrides?.storeName ?? storeName;
      const nextNmid = overrides?.nmid ?? nmid;
      const nextCreatedFromDate = overrides?.createdFromDate ?? createdFromDate;
      const nextCreatedToDate = overrides?.createdToDate ?? createdToDate;
      const nextSuccessFromDate = overrides?.successFromDate ?? successFromDate;
      const nextSuccessToDate = overrides?.successToDate ?? successToDate;

      skipAutoFetchRef.current = true;
      setPage(nextPage);
      setPlatformTrxId(nextPlatformTrxId);
      setMerchantTrxId(nextMerchantTrxId);
      setPartnerTrxId(nextPartnerTrxId);
      setStoreName(nextStoreName);
      setNmid(nextNmid);
      setIdMerchant(nextIdMerchant);
      setIdAgent(nextIdAgent);
      setRrn(nextRrn);
      setIdSettlement(nextIdSettlement);
      setStatus(nextStatus);
      setCreatedFromDate(nextCreatedFromDate);
      setCreatedToDate(nextCreatedToDate);
      setSuccessFromDate(nextSuccessFromDate);
      setSuccessToDate(nextSuccessToDate);

      void fetchPayins(undefined, {
        page: nextPage,
        limit,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        storeName: nextStoreName,
        nmid: nextNmid,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        rrn: nextRrn,
        idSettlement: nextIdSettlement,
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
      fetchPayins,
      idAgent,
      idMerchant,
      idSettlement,
      limit,
      merchantTrxId,
      page,
      partnerTrxId,
      platformTrxId,
      rrn,
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
      const nextStoreName = storeNameRef.current?.value ?? storeName;
      const nextNmid = nmidRef.current?.value ?? nmid;
      const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
      const nextIdAgent = idAgentRef.current?.value ?? idAgent;
      const nextRrn = rrnRef.current?.value ?? rrn;
      const nextIdSettlement = idSettlementRef.current?.value ?? idSettlement;
      triggerPayinSearch({
        page: 1,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        storeName: nextStoreName,
        nmid: nextNmid,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        rrn: nextRrn,
        idSettlement: nextIdSettlement,
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
      idSettlement,
      merchantTrxId,
      partnerTrxId,
      platformTrxId,
      rrn,
      status,
      successFromInput,
      successToInput,
      triggerPayinSearch,
    ],
  );

  const handleDatePickerClose = useCallback(() => {
    const nextPlatformTrxId = platformTrxIdRef.current?.value ?? platformTrxId;
    const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? merchantTrxId;
    const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? partnerTrxId;
    const nextStoreName = storeNameRef.current?.value ?? storeName;
    const nextNmid = nmidRef.current?.value ?? nmid;
    const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
    const nextIdAgent = idAgentRef.current?.value ?? idAgent;
    const nextRrn = rrnRef.current?.value ?? rrn;
    const nextIdSettlement = idSettlementRef.current?.value ?? idSettlement;
    triggerPayinSearch({
      page: 1,
      platformTrxId: nextPlatformTrxId,
      merchantTrxId: nextMerchantTrxId,
      partnerTrxId: nextPartnerTrxId,
      storeName: nextStoreName,
      nmid: nextNmid,
      idMerchant: nextIdMerchant,
      idAgent: nextIdAgent,
      rrn: nextRrn,
      idSettlement: nextIdSettlement,
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
    idSettlement,
    merchantTrxId,
    partnerTrxId,
    platformTrxId,
    rrn,
    status,
    successFromInput,
    successToInput,
    triggerPayinSearch,
  ]);

  const handleSuccessDatePickerApply = useCallback(
    (nextValue: string, field: 'from' | 'to') => {
      const nextPlatformTrxId = platformTrxIdRef.current?.value ?? platformTrxId;
      const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? merchantTrxId;
      const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? partnerTrxId;
      const nextStoreName = storeNameRef.current?.value ?? storeName;
      const nextNmid = nmidRef.current?.value ?? nmid;
      const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
      const nextIdAgent = idAgentRef.current?.value ?? idAgent;
      const nextRrn = rrnRef.current?.value ?? rrn;
      const nextIdSettlement = idSettlementRef.current?.value ?? idSettlement;
      triggerPayinSearch({
        page: 1,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        storeName: nextStoreName,
        nmid: nextNmid,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        rrn: nextRrn,
        idSettlement: nextIdSettlement,
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
      idSettlement,
      merchantTrxId,
      partnerTrxId,
      platformTrxId,
      rrn,
      status,
      successFromInput,
      successToInput,
      triggerPayinSearch,
    ],
  );

  const handleSuccessDatePickerClose = useCallback(() => {
    const nextPlatformTrxId = platformTrxIdRef.current?.value ?? platformTrxId;
    const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? merchantTrxId;
    const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? partnerTrxId;
    const nextStoreName = storeNameRef.current?.value ?? storeName;
    const nextNmid = nmidRef.current?.value ?? nmid;
    const nextIdMerchant = idMerchantRef.current?.value ?? idMerchant;
    const nextIdAgent = idAgentRef.current?.value ?? idAgent;
    const nextRrn = rrnRef.current?.value ?? rrn;
    const nextIdSettlement = idSettlementRef.current?.value ?? idSettlement;
    triggerPayinSearch({
      page: 1,
      platformTrxId: nextPlatformTrxId,
      merchantTrxId: nextMerchantTrxId,
      partnerTrxId: nextPartnerTrxId,
      storeName: nextStoreName,
      nmid: nextNmid,
      idMerchant: nextIdMerchant,
      idAgent: nextIdAgent,
      rrn: nextRrn,
      idSettlement: nextIdSettlement,
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
    idSettlement,
    merchantTrxId,
    partnerTrxId,
    platformTrxId,
    rrn,
    status,
    successFromInput,
    successToInput,
    triggerPayinSearch,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchPayins();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchPayins]);

  const handleSendCallback = useCallback(async () => {
    if (!callbackItem?.platformTrxId) {
      toast.error(t('payin.toast.callbackMissingId'));
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
        toast.success(t('payin.toast.callbackSuccess'), {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        });
      } else {
        toast.error(t('payin.toast.callbackError'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payin.toast.callbackError'));
    } finally {
      setIsCallbackSubmitting(false);
    }
  }, [callbackItem?.platformTrxId, handleCallbackClose, t]);

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
      void fetchPayins(undefined, { page: nextPage, limit });
    },
    [fetchPayins, limit],
  );

  const handleLimitChange = useCallback(
    (nextLimit: number) => {
      skipAutoFetchRef.current = true;
      setLimit(nextLimit);
      setPage(1);
      void fetchPayins(undefined, { page: 1, limit: nextLimit });
    },
    [fetchPayins],
  );

  const handleSearch = useCallback(
    ({ status: nextStatus }: { status: string }) => {
      const nextPlatformTrxId = platformTrxIdRef.current?.value ?? '';
      const nextMerchantTrxId = merchantTrxIdRef.current?.value ?? '';
      const nextPartnerTrxId = partnerTrxIdRef.current?.value ?? '';
      const nextStoreName = storeNameRef.current?.value ?? '';
      const nextNmid = nmidRef.current?.value ?? '';
      const nextIdMerchant = idMerchantRef.current?.value ?? '';
      const nextIdAgent = idAgentRef.current?.value ?? '';
      const nextRrn = rrnRef.current?.value ?? '';
      const nextIdSettlement = idSettlementRef.current?.value ?? '';
      triggerPayinSearch({
        page: 1,
        platformTrxId: nextPlatformTrxId,
        merchantTrxId: nextMerchantTrxId,
        partnerTrxId: nextPartnerTrxId,
        storeName: nextStoreName,
        nmid: nextNmid,
        idMerchant: nextIdMerchant,
        idAgent: nextIdAgent,
        rrn: nextRrn,
        idSettlement: nextIdSettlement,
        status: nextStatus,
        createdFromDate: createdFromInput,
        createdToDate: createdToInput,
        successFromDate: successFromInput,
        successToDate: successToInput,
      });
    },
    [createdFromInput, createdToInput, successFromInput, successToInput, triggerPayinSearch],
  );

  useEffect(() => {
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    fetchPayins(controller);

    return () => controller.abort();
  }, [fetchPayins]);

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
        <h1 className="text-3xl font-semibold leading-tight">{t('payin.pageTitle')}</h1>
      </div>

      <PayinSummaryCards summary={summary} isLoading={isLoading} />
      <div className="flex justify-start">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-primary bg-primary/90 px-3 py-1.5 text-xs font-medium text-white">
          <Info className="h-4 w-4" aria-hidden />
          <span>{t('payin.summary.caption')}</span>
        </div>
      </div>

      <Card>
        <PayinFilters
          platformTrxId={platformTrxId}
          merchantTrxId={merchantTrxId}
          partnerTrxId={partnerTrxId}
          storeName={storeName}
          nmid={nmid}
          idMerchant={idMerchant}
          idAgent={idAgent}
          rrn={rrn}
          idSettlement={idSettlement}
          status={status}
          filterResetKey={filterResetKey}
          platformTrxIdRef={platformTrxIdRef}
          merchantTrxIdRef={merchantTrxIdRef}
          partnerTrxIdRef={partnerTrxIdRef}
          storeNameRef={storeNameRef}
          nmidRef={nmidRef}
          idMerchantRef={idMerchantRef}
          idAgentRef={idAgentRef}
          rrnRef={rrnRef}
          idSettlementRef={idSettlementRef}
          createdFromInput={createdFromInput}
          createdToInput={createdToInput}
          createdFromTimeInput={createdFromTimeInput}
          createdToTimeInput={createdToTimeInput}
          successFromInput={successFromInput}
          successToInput={successToInput}
          columnConfigs={columnConfigs}
          visibleColumns={visibleColumns}
          isRefreshing={isRefreshing}
          onSearch={handleSearch}
          onRefresh={handleRefresh}
          onReset={handleResetFilters}
          onExport={handleExport}
          isExporting={isExporting}
          canExport={canExport}
          onDatePickerApply={handleDatePickerApply}
          onDatePickerClose={handleDatePickerClose}
          onSuccessDatePickerApply={handleSuccessDatePickerApply}
          onSuccessDatePickerClose={handleSuccessDatePickerClose}
          onCreatedFromChange={setCreatedFromInput}
          onCreatedToChange={setCreatedToInput}
          onCreatedFromTimeChange={setCreatedFromTimeInput}
          onCreatedToTimeChange={setCreatedToTimeInput}
          onSuccessFromChange={setSuccessFromInput}
          onSuccessToChange={setSuccessToInput}
          onToggleColumnVisibility={toggleColumnVisibility}
        />
        <Separator />
        <CardContent className="flex flex-col gap-4 px-5 py-4 md:gap-5 md:px-6">
          <PayinTableShell
            payins={deferredPayins}
            visibleColumnConfigs={visibleColumnConfigs}
            calculatedMinTableWidth={calculatedMinTableWidth}
            isLoading={isTableBusy}
            tableWrapperRef={tableWrapperRef}
          />

          <PayinPagination
            page={page}
            limit={limit}
            totalPages={totalPages}
            totalItems={totalItems}
            pageOptions={pageOptions}
            payinsLength={payins.length}
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
            <DialogTitle>{t('payin.callback.title')}</DialogTitle>
            <DialogDescription>{t('payin.callback.description')}</DialogDescription>
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
              {isCallbackSubmitting ? t('common.loading') : t('payin.actions.confirmCallback')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPayinPage;
