import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Eye, EyeOff, Filter, Inbox, Loader2, Plus, RefreshCcw, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { getStoredAuthToken } from '@/lib/auth';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/language-provider';

interface ReconciliationItem {
  batch_id: number;
  idMerchant?: number;
  merchant_name?: string;
  trx_count?: number;
  total_amount?: number;
  status?: string;
  settlement_id?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string | null;
  rejected_at?: string | null;
  reason?: string | null;
}

interface ReconciliationListResponse {
  status: boolean;
  page?: number;
  limit?: number;
  data: ReconciliationItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  message?: string;
}

type ReconciliationColumnId =
  | 'batch_id'
  | 'merchant'
  | 'trx_count'
  | 'total_amount'
  | 'status'
  | 'settlement_id'
  | 'approved_by'
  | 'approved_at'
  | 'rejected_by'
  | 'rejected_at'
  | 'reason'
  | 'action';

interface ReconciliationColumnConfig {
  id: ReconciliationColumnId;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (item: ReconciliationItem) => ReactNode;
}

interface ReconciliationActionResponse {
  status: boolean;
  message?: string;
}

interface ReconciliationUploadSummary {
  totalUploaded: number;
  notFound: number;
  notSuccess: number;
  alreadySettled: number;
  okReady: number;
  amountInvalid: number;
}

interface ReconciliationUploadSample {
  orderId?: string;
  idSettlement?: string;
}

interface ReconciliationUploadSamples {
  notSuccess?: ReconciliationUploadSample[];
  notFound?: ReconciliationUploadSample[];
  alreadySettled?: ReconciliationUploadSample[];
  amountInvalid?: ReconciliationUploadSample[];
  okReady?: ReconciliationUploadSample[];
}

interface ReconciliationUploadResponse {
  logId?: string;
  status: boolean;
  message?: string;
  batchId?: number;
  summary?: ReconciliationUploadSummary;
  samples?: ReconciliationUploadSamples;
}

type ReconciliationActionType = 'approve' | 'reject';

const formatAmount = (amount?: number) =>
  typeof amount === 'number'
    ? amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })
    : '-';

const formatOptionalValue = (value?: string | number | null) =>
  value === null || value === undefined || value === '' ? '-' : String(value);

const ERROR_TOAST_STYLE = {
  border: '2px solid #fda4af',
  background: '#fff1f2',
  color: '#f43f5e',
  boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
  padding: '0.5rem',
} as const;

export function ReconciliationListPage() {
  const { t } = useLanguage();
  const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPostUploadLoading, setIsPostUploadLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const [orderIdField, setOrderIdField] = useState('platformTrxId');
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<ReconciliationColumnId>>(new Set());
  const [isActionColumnStuck, setIsActionColumnStuck] = useState(false);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionItem, setActionItem] = useState<ReconciliationItem | null>(null);
  const [actionType, setActionType] = useState<ReconciliationActionType | null>(null);
  const [actionPassword, setActionPassword] = useState('');
  const [showActionPassword, setShowActionPassword] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [filterInputs, setFilterInputs] = useState({
    settlementId: '',
    status: 'all',
    idMerchant: '',
    batchId: '',
  });
  const [filters, setFilters] = useState({
    settlementId: '',
    status: '',
    idMerchant: '',
    batchId: '',
  });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);
  const [uploadResultDialogOpen, setUploadResultDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<ReconciliationUploadResponse | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const closeActionDialog = useCallback(() => {
    setActionDialogOpen(false);
    setActionItem(null);
    setActionType(null);
    setActionPassword('');
  }, []);

  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((message, [placeholder, value]) => {
      return message.replace(`{${placeholder}}`, String(value));
    }, t(key));

  const handleActionClick = useCallback((item: ReconciliationItem, type: ReconciliationActionType) => {
    setActionItem(item);
    setActionType(type);
    setActionPassword('');
    setActionDialogOpen(true);
  }, []);

  const columnConfigs = useMemo<ReconciliationColumnConfig[]>(
    () => [
      {
        id: 'batch_id',
        label: t('reconciliation.table.batchId'),
        headerClassName: 'w-[120px] whitespace-nowrap',
        cellClassName: 'font-medium whitespace-nowrap',
        render: (item) => formatOptionalValue(item.batch_id),
      },
      {
        id: 'trx_count',
        label: t('reconciliation.table.transactions'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatOptionalValue(item.trx_count),
      },
      {
        id: 'merchant',
        label: t('reconciliation.table.merchant'),
        headerClassName: 'min-w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => {
          const idValue = formatOptionalValue(item.idMerchant);
          const nameValue = formatOptionalValue(item.merchant_name);
          if (idValue === '-' && nameValue === '-') return '-';
          return `${idValue}. ${nameValue}`;
        },
      },
      {
        id: 'total_amount',
        label: t('reconciliation.table.totalAmount'),
        headerClassName: 'w-[160px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatAmount(item.total_amount),
      },
      {
        id: 'status',
        label: t('reconciliation.table.status'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => {
          const normalizedStatus = item.status?.toLowerCase();
          const statusClassName = cn(
            'w-[96px] justify-center uppercase border-transparent',
            normalizedStatus === 'rejected' && 'bg-[#FBE3EC] text-[#D61E1E]',
            normalizedStatus === 'pending' && 'bg-[#FCF7D4] text-[#B58A3E]',
            normalizedStatus === 'approved' && 'bg-[#E9FDF5] text-[#469575]',
          );

          return (
            <Badge variant="outline" className={statusClassName}>
              {normalizedStatus ? t(`reconciliation.status.${normalizedStatus}`) : formatOptionalValue(item.status)}
            </Badge>
          );
        },
      },
      {
        id: 'settlement_id',
        label: t('reconciliation.table.settlementId'),
        headerClassName: 'w-[200px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatOptionalValue(item.settlement_id),
      },
      {
        id: 'approved_by',
        label: t('reconciliation.table.approvedBy'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatOptionalValue(item.approved_by),
      },
      {
        id: 'approved_at',
        label: t('reconciliation.table.approvedAt'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatOptionalValue(item.approved_at),
      },
      {
        id: 'rejected_by',
        label: t('reconciliation.table.rejectedBy'),
        headerClassName: 'w-[140px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatOptionalValue(item.rejected_by),
      },
      {
        id: 'rejected_at',
        label: t('reconciliation.table.rejectedAt'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatOptionalValue(item.rejected_at),
      },
      {
        id: 'reason',
        label: t('reconciliation.table.reason'),
        headerClassName: 'min-w-[220px] whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (item) => formatOptionalValue(item.reason),
      },
      {
        id: 'action',
        label: t('reconciliation.table.action'),
        headerClassName: cn(
          'sticky right-0 z-10 bg-background text-center w-[170px]',
          isActionColumnStuck && 'border-l border-border',
        ),
        cellClassName: cn(
          'sticky right-0 z-10 sm:bg-background sm:text-center w-[170px] sm:group-hover:bg-muted w-full sm:w-fit',
          isActionColumnStuck && 'border-l border-border',
        ),
        render: (item) => {
          const isPending = item.status?.toLowerCase() === 'pending';
          if (!isPending) return '-';
          return (
            <div className="flex w-full self-end flex-col items-end sm:items-center sm:justify-center gap-2">
              <Button
                size="sm"
                className="w-full max-w-[140px] bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700"
                onClick={() => handleActionClick(item, 'approve')}
              >
                {t('reconciliation.actions.approve')}
              </Button>
              <Button
                size="sm"
                className="w-full max-w-[140px] bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800"
                onClick={() => handleActionClick(item, 'reject')}
              >
                {t('reconciliation.actions.reject')}
              </Button>
            </div>
          );
        },
      },
    ],
    [handleActionClick, isActionColumnStuck, t],
  );

  const allColumnIds = useMemo(() => columnConfigs.map((column) => column.id), [columnConfigs]);

  useEffect(() => {
    if (visibleColumns.size === 0 && allColumnIds.length > 0) {
      setVisibleColumns(new Set(allColumnIds));
    }
  }, [allColumnIds, visibleColumns.size]);

  const visibleColumnConfigs = useMemo(
    () => columnConfigs.filter((column) => visibleColumns.has(column.id)),
    [columnConfigs, visibleColumns],
  );

  const calculatedMinTableWidth = useMemo(
    () => `${Math.max(visibleColumnConfigs.length * 160, 900)}px`,
    [visibleColumnConfigs.length],
  );

  const toggleColumnVisibility = useCallback((columnId: ReconciliationColumnId, isVisible: boolean) => {
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

  const pageOptions = useMemo(
    () => Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1),
    [totalPages],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.settlementId.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.idMerchant.trim()) count += 1;
    if (filters.batchId.trim()) count += 1;
    return count;
  }, [filters.batchId, filters.idMerchant, filters.settlementId, filters.status]);

  const hasNextPage = page < totalPages;
  const sortedReconciliations = useMemo(
    () =>
      [...reconciliations].sort((current, next) => {
        if (current.batch_id === next.batch_id) return 0;
        return next.batch_id - current.batch_id;
      }),
    [reconciliations],
  );

  const fetchReconciliations = useCallback(
    async (
      controller?: AbortController,
      overrideFilters?: {
        settlementId: string;
        status: string;
        idMerchant: string;
        batchId: string;
      },
      overridePage?: number,
      overrideLimit?: number,
    ) => {
      const activeController = controller ?? new AbortController();

      const startTime = Date.now();
      try {
        setIsLoading(true);
        setReconciliations([]);
        const activeFilters = overrideFilters ?? filters;
        const activePage = overridePage ?? page;
        const activeLimit = overrideLimit ?? limit;
        const trimmedSettlementId = activeFilters.settlementId.trim();
        const trimmedIdMerchant = activeFilters.idMerchant.trim();
        const trimmedBatchId = activeFilters.batchId.trim();
        const payload: Record<string, string | number> = {
          page: activePage,
          limit: activeLimit,
        };
        if (trimmedSettlementId) payload.settlementId = trimmedSettlementId;
        if (activeFilters.status) payload.status = activeFilters.status;
        if (trimmedIdMerchant) payload.idMerchant = trimmedIdMerchant;
        if (trimmedBatchId) payload.batchId = trimmedBatchId;
        const response = await apiFetch<ReconciliationListResponse>('/recon/list', {
          method: 'POST',
          body: payload,
          signal: activeController.signal,
        });

        const receivedRows = Array.isArray(response.data) ? response.data : [];
        const effectiveLimit = response.pagination?.limit ?? response.limit ?? activeLimit;
        const receivedTotalItems = response.pagination?.total ?? receivedRows.length;
        const receivedTotalPages =
          response.pagination?.totalPages ??
          Math.max(1, Math.ceil(receivedTotalItems / (effectiveLimit || 1)));

        setReconciliations(receivedRows);
        setTotalItems(receivedTotalItems);
        setTotalPages(Math.max(1, receivedTotalPages));

        const effectivePage = response.pagination?.page ?? response.page;
        if (typeof effectivePage === 'number' && effectivePage !== page) {
          setPage(effectivePage);
        }

        if (typeof effectiveLimit === 'number' && effectiveLimit !== limit) {
          setLimit(effectiveLimit);
        }
      } catch (error) {
        if (error instanceof ApiAuthError) {
          toast.error(t('auth.sessionExpired'), {
            duration: 1500,
            style: ERROR_TOAST_STYLE,
          });
        } else {
          toast.error(error instanceof Error ? error.message : t('reconciliation.toast.loadError'), {
            duration: 1500,
            style: ERROR_TOAST_STYLE,
          });
        }
      } finally {
        const elapsed = Date.now() - startTime;
        if (elapsed < 1000) {
          await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
        }
        setIsLoading(false);
      }
    },
    [filters.batchId, filters.idMerchant, filters.settlementId, filters.status, limit, page, t],
  );

  const handleActionSubmit = useCallback(async () => {
    if (!actionItem || !actionType) {
      toast.error(t('reconciliation.toast.selectItem'), {
        duration: 1500,
        style: ERROR_TOAST_STYLE,
      });
      return;
    }

    const merchantId = actionItem.idMerchant;
    if (!merchantId) {
      toast.error(t('reconciliation.toast.missingMerchant'), {
        duration: 1500,
        style: ERROR_TOAST_STYLE,
      });
      return;
    }

    if (!actionPassword.trim()) {
      toast.error(t('reconciliation.toast.passwordRequired'), {
        duration: 1500,
        style: ERROR_TOAST_STYLE,
      });
      return;
    }

    setIsActionSubmitting(true);
    try {
      const response = await apiFetch<ReconciliationActionResponse>(
        `/recon/${actionItem.batch_id}/${actionType}`,
        {
          method: 'POST',
          body: {
            merchantIds: [merchantId],
            password: actionPassword.trim(),
          },
        },
      );

      toast.success(
        response.message ??
          formatMessage('reconciliation.toast.actionSuccess', {
            action: t(
              actionType === 'approve'
                ? 'reconciliation.actions.approved'
                : 'reconciliation.actions.rejected',
            ),
            merchantId,
          }),
        { duration: 1500, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
      );
      closeActionDialog();
      await fetchReconciliations();
    } catch (error) {
      if (error instanceof ApiAuthError) {
        toast.error(t('auth.sessionExpired'), {
          duration: 1500,
          style: ERROR_TOAST_STYLE,
        });
      } else {
        toast.error(error instanceof Error ? error.message : t('reconciliation.toast.updateError'), {
          duration: 1500,
          style: ERROR_TOAST_STYLE,
        });
      }
    } finally {
      setIsActionSubmitting(false);
    }
  }, [actionItem, actionPassword, actionType, closeActionDialog, fetchReconciliations, formatMessage, t]);

  const handleRefresh = useCallback(async () => {
    const MIN_SPIN_DURATION_MS = 500;

    setIsRefreshing(true);
    const start = Date.now();

    try {
      await fetchReconciliations();
    } finally {
      const elapsed = Date.now() - start;

      if (elapsed < MIN_SPIN_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_DURATION_MS - elapsed));
      }

      setIsRefreshing(false);
    }
  }, [fetchReconciliations]);

  useEffect(() => {
    const controller = new AbortController();
    fetchReconciliations(controller);

    return () => controller.abort();
  }, [fetchReconciliations]);

  const handleSearch = useCallback(() => {
    const nextFilters = {
      settlementId: filterInputs.settlementId,
      status: filterInputs.status === 'all' ? '' : filterInputs.status.toUpperCase(),
      idMerchant: filterInputs.idMerchant,
      batchId: filterInputs.batchId,
    };
    setPage(1);
    setFilters(nextFilters);
    void fetchReconciliations(undefined, nextFilters, 1, limit);
  }, [fetchReconciliations, filterInputs, limit]);

  const handleResetFilters = useCallback(() => {
    setFilterInputs({
      settlementId: '',
      status: 'all',
      idMerchant: '',
      batchId: '',
    });
    setFilters({
      settlementId: '',
      status: '',
      idMerchant: '',
      batchId: '',
    });
    setPage(1);
    void fetchReconciliations(undefined, {
      settlementId: '',
      status: '',
      idMerchant: '',
      batchId: '',
    }, 1, limit);
  }, [fetchReconciliations, limit]);

  const handleFilterDialogChange = (open: boolean) => {
    if (open) {
      setFilterInputs({
        settlementId: filters.settlementId,
        status: filters.status ? filters.status.toLowerCase() : 'all',
        idMerchant: filters.idMerchant,
        batchId: filters.batchId,
      });
    }
    if (!open && !appliedRef.current) {
      setFilterInputs({
        settlementId: filters.settlementId,
        status: filters.status ? filters.status.toLowerCase() : 'all',
        idMerchant: filters.idMerchant,
        batchId: filters.batchId,
      });
    }
    appliedRef.current = false;
    setIsFilterDialogOpen(open);
  };

  const handleUpload = useCallback(async () => {
    const fileToUpload = uploadFile;
    if (!fileToUpload) {
      toast.error(t('reconciliation.toast.fileRequired'), {
        duration: 1500,
        style: ERROR_TOAST_STYLE,
      });
      return;
    }

    const apiRoot = import.meta.env.VITE_API_ROOT as string | undefined;
    if (!apiRoot) {
      toast.error(t('reconciliation.toast.missingApiRoot'), {
        duration: 1500,
        style: ERROR_TOAST_STYLE,
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('orderIdType', orderIdField);

      const storedToken = getStoredAuthToken();
      const response = await fetch(`${apiRoot.replace(/\/$/, '')}/recon/upload`, {
        method: 'POST',
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : undefined,
        body: formData,
      });

      const contentType = response.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json');
      const parsedBody = isJson ? await response.json().catch(() => null) : null;
      const responseStatus = (parsedBody as { status?: boolean } | null)?.status;
      const responseMessage =
        (parsedBody as { message?: string } | null)?.message ?? `Request failed with status ${response.status}`;

      if (responseStatus === false) {
        if (responseMessage.toLowerCase().includes('invalid or expired access token')) {
          throw new ApiAuthError(responseMessage);
        }
        setUploadResult(parsedBody as ReconciliationUploadResponse);
        setUploadResultDialogOpen(true);
        setUploadDialogOpen(false);
        return;
      }

      if (!response.ok) {
        throw new Error(responseMessage);
      }

      toast.success(responseMessage || t('reconciliation.toast.uploadSuccess'), { duration: 1500 });
      setUploadFile(null);
      setUploadFileError(null);
      setOrderIdField('platformTrxId');
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      setUploadDialogOpen(false);
      setIsPostUploadLoading(true);
      await fetchReconciliations();
    } catch (error) {
      if (error instanceof ApiAuthError) {
        toast.error(t('auth.sessionExpired'), {
          duration: 1500,
          style: ERROR_TOAST_STYLE,
        });
      } else {
        toast.error(error instanceof Error ? error.message : t('reconciliation.toast.uploadError'), {
          duration: 1500,
          style: ERROR_TOAST_STYLE,
        });
      }
    } finally {
      setIsUploading(false);
      setIsPostUploadLoading(false);
    }
  }, [fetchReconciliations, orderIdField, uploadFile, t]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setUploadFile(null);
      setUploadFileError(null);
      return;
    }

    const isTxt = file.name.toLowerCase().endsWith('.txt');
    if (!isTxt) {
      setUploadFile(null);
      setUploadFileError(t('reconciliation.upload.invalidType'));
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      return;
    }

    setUploadFile(file);
    setUploadFileError(null);
  }, [t]);

  const handleClearUploadFile = useCallback(() => {
    setUploadFile(null);
    setUploadFileError(null);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }, []);

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

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('reconciliation.pageTitle')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle className="max-[480px]:leading-[1.5]">{t('reconciliation.cardTitle')}</CardTitle>
            <CardDescription>
              {t('reconciliation.cardDescription')}
            </CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto">
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
              onClick={handleRefresh}
              aria-label={t('common.refresh')}
              disabled={isRefreshing}
            >
              <RefreshCcw className={cn('h-4 w-4 transition', isRefreshing && 'animate-spin')} aria-hidden />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="w-auto bg-primary text-white hover:bg-primary/90 flex items-center justify-center"
                  aria-label={t('reconciliation.filters.columns')}
                >
                  <Filter className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="font-medium">{t('reconciliation.filters.toggleColumns')}</DropdownMenuLabel>
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
            <Dialog open={isFilterDialogOpen} onOpenChange={handleFilterDialogChange}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  {t('common.filters')}
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                    {activeFilterCount}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[620px]">
                <DialogHeader>
                  <DialogTitle>{t('common.filters')}</DialogTitle>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reconciliation-filter-settlement-id">{t('reconciliation.filters.settlementId')}</Label>
                    <Input
                      id="reconciliation-filter-settlement-id"
                      placeholder={t('reconciliation.filters.settlementIdPlaceholder')}
                      value={filterInputs.settlementId}
                      onChange={(event) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          settlementId: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t('reconciliation.filters.status')}</Label>
                    <Select
                      value={filterInputs.status}
                      onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={t('reconciliation.filters.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reconciliation.status.all')}</SelectItem>
                        <SelectItem value="APPROVED">{t('reconciliation.status.approved')}</SelectItem>
                        <SelectItem value="REJECTED">{t('reconciliation.status.rejected')}</SelectItem>
                        <SelectItem value="PENDING">{t('reconciliation.status.pending')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reconciliation-filter-merchant-id">{t('reconciliation.filters.merchantId')}</Label>
                    <Input
                      id="reconciliation-filter-merchant-id"
                      placeholder={t('reconciliation.filters.merchantIdPlaceholder')}
                      value={filterInputs.idMerchant}
                      onChange={(event) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          idMerchant: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reconciliation-filter-batch-id">{t('reconciliation.filters.batchId')}</Label>
                    <Input
                      id="reconciliation-filter-batch-id"
                      placeholder={t('reconciliation.filters.batchIdPlaceholder')}
                      value={filterInputs.batchId}
                      onChange={(event) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          batchId: event.target.value,
                        }))
                      }
                    />
                  </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      appliedRef.current = false;
                      setFilterInputs({
                        settlementId: filters.settlementId,
                        status: filters.status ? filters.status.toLowerCase() : 'all',
                        idMerchant: filters.idMerchant,
                        batchId: filters.batchId,
                      });
                      setIsFilterDialogOpen(false);
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 sm:w-auto"
                    onClick={() => {
                      appliedRef.current = true;
                      handleSearch();
                      setIsFilterDialogOpen(false);
                    }}
                  >
                    {t('common.search')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={uploadDialogOpen}
              onOpenChange={(open) => {
                setUploadDialogOpen(open);
                if (open) {
                  setUploadFile(null);
                  setUploadFileError(null);
                  setOrderIdField('platformTrxId');
                  if (uploadInputRef.current) {
                    uploadInputRef.current.value = '';
                  }
                } else {
                  setUploadFile(null);
                  setUploadFileError(null);
                  setOrderIdField('platformTrxId');
                  if (uploadInputRef.current) {
                    uploadInputRef.current.value = '';
                  }
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 md:self-stretch">
                  <Plus className="h-4 w-4" /> {t('common.add')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>{t('reconciliation.upload.title')}</DialogTitle>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('reconciliation.upload.orderIdField')}
                    </p>
                    <div className="space-y-2 mb-4">
                      <Select value={orderIdField} onValueChange={setOrderIdField}>
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="platformTrxId">{t('reconciliation.upload.orderId.platformTrxId')}</SelectItem>
                          <SelectItem value="partnerTrxId">{t('reconciliation.upload.orderId.partnerTrxId')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('reconciliation.upload.description')}
                    </p>
                    <Input
                      id="reconciliation-upload-file"
                      type="file"
                      accept=".txt"
                      ref={uploadInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {!uploadFile && (
                      <Button
                        type="button"
                        className="h-10 w-full justify-center rounded-md border border-input bg-background text-foreground hover:bg-muted"
                        onClick={() => uploadInputRef.current?.click()}
                      >
                        {t('reconciliation.upload.choose')}
                      </Button>
                    )}
                    {uploadFileError && (
                      <p className="text-sm text-destructive">{uploadFileError}</p>
                    )}
                    {uploadFile && (
                      <div className="flex h-10 items-center justify-between rounded-md border border-border bg-muted/40 px-3 text-sm">
                        <span className="truncate">{uploadFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleClearUploadFile}
                          aria-label={t('reconciliation.upload.removeFile')}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setUploadFile(null);
                      setUploadFileError(null);
                      setOrderIdField('platformTrxId');
                      if (uploadInputRef.current) {
                        uploadInputRef.current.value = '';
                      }
                      setUploadDialogOpen(false);
                    }}
                    disabled={isUploading}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 sm:w-auto"
                    onClick={handleUpload}
                    disabled={isUploading || !uploadFile}
                  >
                    {isUploading ? t('reconciliation.upload.uploading') : t('reconciliation.upload.action')}
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
        <CardContent className="flex flex-col gap-4 px-5 py-4 md:gap-5 md:px-6">
          <div className="relative overflow-x-auto sm:rounded-md sm:border" ref={tableWrapperRef}>
            <Table style={{ minWidth: calculatedMinTableWidth }}>
              <TableHeader>
                <TableRow>
                  {visibleColumnConfigs.length === 0 ? (
                    <TableHead className="whitespace-nowrap">{t('reconciliation.table.noColumns')}</TableHead>
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
                {isLoading &&
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
                  ))}
                {!isLoading && reconciliations.length === 0 && (
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
                          <div className="text-base font-medium text-foreground">{t('reconciliation.empty.title')}</div>
                          <div>{t('reconciliation.empty.description')}</div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  sortedReconciliations.map((item, index) => (
                    <TableRow key={`${item.batch_id}-${index}`} className="group">
                      {visibleColumnConfigs.map((column) => (
                        <TableCell
                          key={column.id}
                          data-label={column.label}
                          className={column.cellClassName ?? 'whitespace-nowrap'}
                        >
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
                <Select value={String(page)} onValueChange={(value) => setPage(Number(value))}>
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
                <Select
                  value={String(limit)}
                  onValueChange={(value) => {
                    setLimit(Number(value));
                    setPage(1);
                  }}
                >
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
                {formatMessage('reconciliation.total', { count: totalItems })}
              </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
                  onClick={() => setPage((prevPage) => Math.max(1, prevPage - 1))}
                  disabled={page <= 1}
                >
                  {t('common.prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
                  onClick={() => setPage((prevPage) => prevPage + 1)}
                  disabled={!hasNextPage}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>

      <Dialog
        open={actionDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeActionDialog();
          } else {
            setActionDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'reject' ? t('reconciliation.actions.rejectTitle') : t('reconciliation.actions.approveTitle')}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'reject'
                ? t('reconciliation.actions.rejectDescription')
                : t('reconciliation.actions.approveDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{t('reconciliation.table.batchId')}</span>
                <span className="font-medium text-foreground">
                  {formatOptionalValue(actionItem?.batch_id)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('reconciliation.filters.merchantId')}</span>
                <span className="font-medium text-foreground">
                  {formatOptionalValue(actionItem?.idMerchant)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('reconciliation.table.status')}</span>
                <span className="font-medium text-foreground">
                  {actionItem?.status ? t(`reconciliation.status.${actionItem.status.toLowerCase()}`) : '-'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reconciliation-action-password">{t('reconciliation.actions.passwordLabel')}</Label>
              <div className="relative">
                <Input
                  id="reconciliation-action-password"
                  type={showActionPassword ? 'text' : 'password'}
                  value={actionPassword}
                  onChange={(event) => setActionPassword(event.target.value)}
                  placeholder={t('reconciliation.actions.passwordPlaceholder')}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showActionPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowActionPassword((prev) => !prev)}
                >
                  {showActionPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeActionDialog} disabled={isActionSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button
              className={
                actionType === 'reject'
                  ? 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
              }
              onClick={handleActionSubmit}
              disabled={isActionSubmitting || !actionPassword.trim()}
            >
              {isActionSubmitting
                ? actionType === 'reject'
                  ? t('reconciliation.actions.rejecting')
                  : t('reconciliation.actions.approving')
                : actionType === 'reject'
                  ? t('reconciliation.actions.reject')
                  : t('reconciliation.actions.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPostUploadLoading}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-center">{t('reconciliation.upload.refreshingTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">{t('reconciliation.upload.refreshingDescription')}</p>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadResultDialogOpen} onOpenChange={setUploadResultDialogOpen}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{t('reconciliation.uploadResult.title')}</DialogTitle>
          </DialogHeader>
          {uploadResult && (
            <DialogBody className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Summary Section */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-foreground">
                  {t('reconciliation.uploadResult.summary')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('reconciliation.uploadResult.totalUploaded')}
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {uploadResult.summary?.totalUploaded ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('reconciliation.uploadResult.okReady')}
                    </p>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      {uploadResult.summary?.okReady ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('reconciliation.uploadResult.notSuccess')}
                    </p>
                    <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                      {uploadResult.summary?.notSuccess ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('reconciliation.uploadResult.notFound')}
                    </p>
                    <p className="text-lg font-semibold text-destructive dark:text-red-400">
                      {uploadResult.summary?.notFound ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('reconciliation.uploadResult.alreadySettled')}
                    </p>
                    <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {uploadResult.summary?.alreadySettled ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('reconciliation.uploadResult.amountInvalid')}
                    </p>
                    <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                      {uploadResult.summary?.amountInvalid ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {uploadResult.samples && Object.values(uploadResult.samples).some((arr) => arr && arr.length > 0) && (
                <div className="space-y-4">
                  {uploadResult.message && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                      <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">{uploadResult.message}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="font-medium text-sm text-foreground">
                      {t('reconciliation.uploadResult.details')}
                    </h3>

                    {/* Not Success Section */}
                    {uploadResult.samples.notSuccess && uploadResult.samples.notSuccess.length > 0 && (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => {
                              const next = new Set(prev);
                              if (next.has('notSuccess')) {
                                next.delete('notSuccess');
                              } else {
                                next.add('notSuccess');
                              }
                              return next;
                            });
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                        >
                          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                            {t('reconciliation.uploadResult.notSuccess')} ({uploadResult.samples.notSuccess.length})
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-amber-900 dark:text-amber-100 transition-transform',
                              expandedSections.has('notSuccess') && 'rotate-180',
                            )}
                          />
                        </button>
                        {expandedSections.has('notSuccess') && (
                          <div className="bg-muted/50 overflow-x-auto">
                            <Table className="text-sm max-sm:text-xs">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.orderId')}</TableHead>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.settlementId')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.samples.notSuccess.map((item, index) => (
                                  <TableRow key={`notSuccess-${index}`}>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.orderId ?? '-'}</TableCell>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.idSettlement ?? '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Not Found Section */}
                    {uploadResult.samples.notFound && uploadResult.samples.notFound.length > 0 && (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => {
                              const next = new Set(prev);
                              if (next.has('notFound')) {
                                next.delete('notFound');
                              } else {
                                next.add('notFound');
                              }
                              return next;
                            });
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                          <span className="text-sm font-medium text-red-900 dark:text-red-100">
                            {t('reconciliation.uploadResult.notFound')} ({uploadResult.samples.notFound.length})
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-red-900 dark:text-red-100 transition-transform',
                              expandedSections.has('notFound') && 'rotate-180',
                            )}
                          />
                        </button>
                        {expandedSections.has('notFound') && (
                          <div className="bg-muted/50 overflow-x-auto">
                            <Table className="text-sm max-sm:text-xs">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.orderId')}</TableHead>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.settlementId')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.samples.notFound.map((item, index) => (
                                  <TableRow key={`notFound-${index}`}>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.orderId ?? '-'}</TableCell>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.idSettlement ?? '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Already Settled Section */}
                    {uploadResult.samples.alreadySettled && uploadResult.samples.alreadySettled.length > 0 && (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => {
                              const next = new Set(prev);
                              if (next.has('alreadySettled')) {
                                next.delete('alreadySettled');
                              } else {
                                next.add('alreadySettled');
                              }
                              return next;
                            });
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {t('reconciliation.uploadResult.alreadySettled')} ({uploadResult.samples.alreadySettled.length})
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-blue-900 dark:text-blue-100 transition-transform',
                              expandedSections.has('alreadySettled') && 'rotate-180',
                            )}
                          />
                        </button>
                        {expandedSections.has('alreadySettled') && (
                          <div className="bg-muted/50 overflow-x-auto">
                            <Table className="text-sm max-sm:text-xs">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.orderId')}</TableHead>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.settlementId')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.samples.alreadySettled.map((item, index) => (
                                  <TableRow key={`alreadySettled-${index}`}>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.orderId ?? '-'}</TableCell>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.idSettlement ?? '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Amount Invalid Section */}
                    {uploadResult.samples.amountInvalid && uploadResult.samples.amountInvalid.length > 0 && (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => {
                            setExpandedSections((prev) => {
                              const next = new Set(prev);
                              if (next.has('amountInvalid')) {
                                next.delete('amountInvalid');
                              } else {
                                next.add('amountInvalid');
                              }
                              return next;
                            });
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                        >
                          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                            {t('reconciliation.uploadResult.amountInvalid')} ({uploadResult.samples.amountInvalid.length})
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-purple-900 dark:text-purple-100 transition-transform',
                              expandedSections.has('amountInvalid') && 'rotate-180',
                            )}
                          />
                        </button>
                        {expandedSections.has('amountInvalid') && (
                          <div className="bg-muted/50 overflow-x-auto">
                            <Table className="text-sm max-sm:text-xs">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.orderId')}</TableHead>
                                  <TableHead className="w-1/2">{t('reconciliation.uploadResult.settlementId')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.samples.amountInvalid.map((item, index) => (
                                  <TableRow key={`amountInvalid-${index}`}>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.orderId ?? '-'}</TableCell>
                                    <TableCell className="text-xs max-sm:text-[10px]">{item.idSettlement ?? '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DialogBody>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 sm:w-auto"
              onClick={() => {
                setUploadResultDialogOpen(false);
                setExpandedSections(new Set());
              }}
            >
              {t('reconciliation.uploadResult.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReconciliationListPage;
