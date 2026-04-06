import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Filter, Plus, RefreshCcw, SlidersHorizontal } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { getStoredUserPermissions } from '@/lib/auth';
import { useLanguage } from '@/i18n/language-provider';
import { cn } from '@/lib/utils';

type MerchantStatus = 'active' | 'inactive' | '' | undefined;

interface MerchantItem {
  id: number | string;
  name?: string;
  ownerEmail?: string;
  saldo?: number;
  feePercentage?: number;
  feeFixed?: number;
  biayaPayout?: number;
  ipPayin?: string;
  ipPayout?: string;
  idAgent?: number | string;
  status?: MerchantStatus | string;
  payinStatus?: string;
  payoutStatus?: string;
  created_at?: string;
  updated_at?: string;
}

interface MerchantDetailResponse {
  status: boolean;
  data?: MerchantItem;
}

interface MerchantListResponse {
  status: boolean;
  message?: string;
  data?: MerchantItem[] | { data?: MerchantItem[]; pagination?: MerchantPagination };
  pagination?: MerchantPagination;
}

interface MerchantPagination {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

interface AgentItem {
  id: number | string;
  name?: string;
  email?: string;
  role?: string;
}

interface AgentListResponse {
  status: boolean;
  message?: string;
  data?: AgentItem[];
  pagination?: MerchantPagination;
}

interface MerchantChannelConfigItem {
  channelId: number;
  channelName: string;
  channelProdukName: string;
  channelProdukJenis: string;
  channelProdukId: number;
  status: number;
  priority: number;
}

interface MerchantChannelDisbursementConfigItem {
  channelDisbursementId: number;
  channelName: string;
  isActive: number;
  priority: number;
}

interface MerchantConfigListResponse<T> {
  status: boolean;
  message?: string;
  data?: T[];
}

const STATUS_OPTIONS: { label: string; value: MerchantStatus | string }[] = [
  { label: 'All status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const MERCHANT_NAME_MIN_LENGTH = 5;
const MERCHANT_NAME_MAX_LENGTH = 30;
const FEE_PATTERN = /^\d+(\.\d+)?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatCurrency = (value?: number) =>
  typeof value === 'number' ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';
const formatPercent = (value?: number) => (typeof value === 'number' ? `${value.toFixed(2)}%` : '-');

type MerchantColumnId =
  | 'name'
  | 'ownerEmail'
  | 'id'
  | 'saldo'
  | 'feePercentage'
  | 'feeFixed'
  | 'biayaPayout'
  | 'idAgent'
  | 'payinStatus'
  | 'payoutStatus'
  | 'created_at'
  | 'updated_at'
  | 'actions';

interface MerchantColumnConfig {
  id: MerchantColumnId;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (merchant: MerchantItem) => ReactNode;
}

export function AdminEngineListPage() {
  const { t } = useLanguage();
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [filters, setFilters] = useState({
    name: '',
    idAgent: '',
    payinStatus: '' as MerchantStatus | string,
    payoutStatus: '' as MerchantStatus | string,
  });
  const [filterInputs, setFilterInputs] = useState({
    name: '',
    idAgent: '',
    payinStatus: 'all',
    payoutStatus: 'all',
  });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [merchantDialogOpen, setMerchantDialogOpen] = useState(false);
  const [createMerchantDialogOpen, setCreateMerchantDialogOpen] = useState(false);
  const [isLoadingMerchantDetail, setIsLoadingMerchantDetail] = useState(false);
  const [isSavingMerchant, setIsSavingMerchant] = useState(false);
  const [isCreatingMerchant, setIsCreatingMerchant] = useState(false);
  const [editingMerchantId, setEditingMerchantId] = useState<number | string | null>(null);
  const [merchantDetail, setMerchantDetail] = useState<MerchantItem | null>(null);
  const [merchantForm, setMerchantForm] = useState({
    name: '',
    ownerEmail: '',
    feePercentage: '',
    feeFixed: '',
    biayaPayout: '',
    ipPayin: '',
    ipPayout: '',
    idAgent: '',
    status: 'active' as MerchantStatus | string,
    payinStatus: 'active' as MerchantStatus | string,
    payoutStatus: 'active' as MerchantStatus | string,
  });
  const [createMerchantForm, setCreateMerchantForm] = useState({
    name: '',
    email: '',
    feePercentage: '',
    feeFixed: '',
    biayaPayout: '',
    idAgent: '',
  });
  const [createMerchantErrors, setCreateMerchantErrors] = useState<{
    name?: string;
    email?: string;
    feePercentage?: string;
    feeFixed?: string;
    biayaPayout?: string;
    idAgent?: string;
  }>({});
  const [merchantErrors, setMerchantErrors] = useState<{
    name?: string;
    feePercentage?: string;
    feeFixed?: string;
    biayaPayout?: string;
    ipPayin?: string;
    ipPayout?: string;
    idAgent?: string;
  }>({});
  const [isIpPayinTouched, setIsIpPayinTouched] = useState(false);
  const [isIpPayoutTouched, setIsIpPayoutTouched] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<MerchantColumnId>>(new Set());
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceAction, setBalanceAction] = useState<'topup' | 'deduct' | null>(null);
  const [balanceMerchantId, setBalanceMerchantId] = useState<number | string | null>(null);
  const [balanceMerchantName, setBalanceMerchantName] = useState('');
  const [balanceForm, setBalanceForm] = useState({ amount: '', password: '' });
  const [balanceErrors, setBalanceErrors] = useState<{ amount?: string; password?: string }>({});
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [showBalancePassword, setShowBalancePassword] = useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelMerchantId, setChannelMerchantId] = useState<number | string | null>(null);
  const [channelMerchantName, setChannelMerchantName] = useState('');
  const [merchantChannels, setMerchantChannels] = useState<MerchantChannelConfigItem[]>([]);
  const [merchantChannelDisbursements, setMerchantChannelDisbursements] = useState<MerchantChannelDisbursementConfigItem[]>([]);
  const [isLoadingChannelConfig, setIsLoadingChannelConfig] = useState(false);
  const [isSavingChannelConfig, setIsSavingChannelConfig] = useState(false);
  const permissions = useMemo(() => new Set(getStoredUserPermissions()), []);
  const canTopup = permissions.has('merchant:topup');
  const canDeduct = permissions.has('merchant:deduct');

  const formatMessage = useCallback(
    (key: string, values: Record<string, string | number>) =>
      Object.entries(values).reduce((message, [placeholder, value]) => {
        return message.replace(`{${placeholder}}`, String(value));
      }, t(key)),
    [t],
  );

  const pageOptions = useMemo(() => {
    const computedPages = Math.max(1, totalPages || Math.ceil((totalItems || 0) / limit) || 1);
    return Array.from({ length: computedPages }, (_, index) => index + 1);
  }, [limit, totalItems, totalPages]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.name.trim()) count += 1;
    if (filters.idAgent.trim()) count += 1;
    if (filters.payinStatus) count += 1;
    if (filters.payoutStatus) count += 1;
    return count;
  }, [filters.idAgent, filters.name, filters.payinStatus, filters.payoutStatus]);

  const extractMerchants = (response: MerchantListResponse) => {
    const payload = response.data as MerchantListResponse['data'];

    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;

    return [] as MerchantItem[];
  };

  const extractPagination = (response: MerchantListResponse) => {
    const payload = response.data as MerchantListResponse['data'];
    const pagination = response.pagination ?? (payload && 'pagination' in payload ? payload.pagination : undefined);

    return pagination;
  };

  const fetchMerchants = useCallback(
    async (
      abortController?: AbortController,
      overrideFilters?: {
        name: string;
        idAgent: string;
        payinStatus: MerchantStatus | '';
        payoutStatus: MerchantStatus | '';
      },
      overridePage?: number,
      overrideLimit?: number,
    ) => {
      const controller = abortController ?? new AbortController();
      const errorToastStyle = {
        border: '2px solid #fda4af',
        background: '#fff1f2',
        color: '#f43f5e',
        boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
        padding: '0.5rem',
      } as const;

      const startTime = Date.now();
      try {
        setIsLoading(true);
        const activeFilters = overrideFilters ?? filters;
        const activePage = overridePage ?? page;
        const activeLimit = overrideLimit ?? limit;
        const params = new URLSearchParams({
          page: String(activePage),
          limit: String(activeLimit),
        });

        if (activeFilters.name.trim()) params.set('name', activeFilters.name.trim());
        if (activeFilters.idAgent.trim()) params.set('idAgent', activeFilters.idAgent.trim());
        if (activeFilters.payinStatus) params.set('payinStatus', String(activeFilters.payinStatus));
        if (activeFilters.payoutStatus) params.set('payoutStatus', String(activeFilters.payoutStatus));

        const response = await apiFetch<MerchantListResponse>(`merchant?${params.toString()}`, {
          method: 'GET',
          signal: controller.signal,
        });

        const receivedMerchants = extractMerchants(response);
        const pagination = extractPagination(response);

        const calculatedTotalItems = pagination?.total ?? receivedMerchants.length;
        const calculatedTotalPages =
          pagination?.totalPages ??
          Math.max(1, Math.ceil((pagination?.total ?? receivedMerchants.length) / (activeLimit || 1)));

        setMerchants(receivedMerchants);
        setTotalItems(calculatedTotalItems);
        setTotalPages(calculatedTotalPages);
      } catch (error) {
        if (error instanceof ApiAuthError) {
          toast.error(t('auth.sessionExpired'), {
            duration: 1500,
            style: errorToastStyle,
          });
        } else {
          toast.error(error instanceof Error ? error.message : t('merchants.toast.loadError'), {
            duration: 1500,
            style: errorToastStyle,
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
    [filters.idAgent, filters.name, filters.payinStatus, filters.payoutStatus, limit, page, t],
  );

  const fetchAgents = useCallback(async (abortController?: AbortController) => {
    const controller = abortController ?? new AbortController();
    const errorToastStyle = {
      border: '2px solid #fda4af',
      background: '#fff1f2',
      color: '#f43f5e',
      boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
      padding: '0.5rem',
    } as const;

    setIsLoadingAgents(true);
    try {
      const response = await apiFetch<AgentListResponse>('user?email=&name=&role=agent&idMerchant=&limit=1000', {
        method: 'GET',
        signal: controller.signal,
      });
      const agentList = Array.isArray(response.data) ? response.data : [];
      setAgents(agentList.filter((agent) => agent.role === 'agent'));
    } catch (error) {
      if (error instanceof ApiAuthError) {
        toast.error(t('auth.sessionExpired'), {
          duration: 1500,
          style: errorToastStyle,
        });
      } else {
        toast.error(error instanceof Error ? error.message : t('merchants.toast.loadError'), {
          duration: 1500,
          style: errorToastStyle,
        });
      }
    } finally {
      setIsLoadingAgents(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchMerchants(controller);
    return () => controller.abort();
  }, [fetchMerchants]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAgents(controller);
    return () => controller.abort();
  }, [fetchAgents]);

  const handleSearch = () => {
    const nextFilters = {
      name: filterInputs.name,
      idAgent: filterInputs.idAgent,
      payinStatus: filterInputs.payinStatus === 'all' ? '' : filterInputs.payinStatus,
      payoutStatus: filterInputs.payoutStatus === 'all' ? '' : filterInputs.payoutStatus,
    };
    setPage(1);
    setFilters(nextFilters);
    void fetchMerchants(undefined, nextFilters, 1, limit);
  };

  const getMerchantNameError = useCallback(
    (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return t('merchants.validation.nameRequired');
    }
    if (trimmedName.length < MERCHANT_NAME_MIN_LENGTH) {
      return formatMessage('merchants.validation.nameMin', { count: MERCHANT_NAME_MIN_LENGTH });
    }
    if (trimmedName.length > MERCHANT_NAME_MAX_LENGTH) {
      return formatMessage('merchants.validation.nameMax', { count: MERCHANT_NAME_MAX_LENGTH });
    }
      return undefined;
    },
    [formatMessage, t],
  );

  const getFeeError = useCallback(
    (value: string, label: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        return formatMessage('merchants.validation.feeRequired', { label });
    }
    if (!FEE_PATTERN.test(trimmedValue)) {
      return formatMessage('merchants.validation.feeNumber', { label });
    }
      return undefined;
    },
    [formatMessage],
  );

  const getEmailError = useCallback(
    (email: string) => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        return t('merchants.validation.emailRequired');
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return t('merchants.validation.emailInvalid');
    }
      return undefined;
    },
    [t],
  );

  const getAgentIdError = useCallback(
    (value: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        return undefined;
    }
    const parsedValue = Number(trimmedValue);
    if (!Number.isInteger(parsedValue)) {
      return t('merchants.validation.agentIdNumber');
    }
      return undefined;
    },
    [t],
  );

  const getIpPayinError = useCallback(
    (value: string) => {
      if (!value.trim()) {
        return t('merchants.validation.ipPayinRequired');
      }
      return undefined;
    },
    [t],
  );

  const getIpPayoutError = useCallback(
    (value: string) => {
      if (!value.trim()) {
        return t('merchants.validation.ipPayoutRequired');
      }
      return undefined;
    },
    [t],
  );

  const getBalanceAmountError = useCallback(
    (value: string) => {
      if (!value.trim()) {
        return t('merchants.balance.validation.amountRequired');
      }
      if (!FEE_PATTERN.test(value.trim())) {
        return t('merchants.balance.validation.amountNumber');
      }
      return undefined;
    },
    [t],
  );

  const getBalancePasswordError = useCallback(
    (value: string) => {
      if (!value.trim()) {
        return t('merchants.balance.validation.passwordRequired');
      }
      return undefined;
    },
    [t],
  );

  const isCreateMerchantSubmitDisabled = useMemo(() => {
    const nameError = getMerchantNameError(createMerchantForm.name);
    const emailError = getEmailError(createMerchantForm.email);
    const feePercentageError = getFeeError(createMerchantForm.feePercentage, t('merchants.fields.feePercentage'));
    const feeFixedError = getFeeError(createMerchantForm.feeFixed, t('merchants.fields.feeFixed'));
    const biayaPayoutError = getFeeError(createMerchantForm.biayaPayout, t('merchants.fields.biayaPayout'));
    const idAgentError = getAgentIdError(createMerchantForm.idAgent);
    return Boolean(nameError || emailError || feePercentageError || feeFixedError || biayaPayoutError || idAgentError);
  }, [
    createMerchantForm.feeFixed,
    createMerchantForm.feePercentage,
    createMerchantForm.biayaPayout,
    createMerchantForm.email,
    createMerchantForm.idAgent,
    createMerchantForm.name,
    t,
  ]);

  const isEditMerchantSubmitDisabled = useMemo(() => {
    const nameError = getMerchantNameError(merchantForm.name);
    const feePercentageError = getFeeError(merchantForm.feePercentage, t('merchants.fields.feePercentage'));
    const feeFixedError = getFeeError(merchantForm.feeFixed, t('merchants.fields.feeFixed'));
    const biayaPayoutError = getFeeError(merchantForm.biayaPayout, t('merchants.fields.biayaPayout'));
    const ipPayinError = getIpPayinError(merchantForm.ipPayin);
    const ipPayoutError = getIpPayoutError(merchantForm.ipPayout);
    const idAgentError = getAgentIdError(merchantForm.idAgent);
    return Boolean(
      nameError || feePercentageError || feeFixedError || biayaPayoutError || ipPayinError || ipPayoutError || idAgentError,
    );
  }, [
    merchantForm.feeFixed,
    merchantForm.feePercentage,
    merchantForm.biayaPayout,
    merchantForm.ipPayin,
    merchantForm.ipPayout,
    merchantForm.idAgent,
    merchantForm.name,
    t,
  ]);

  const isBalanceSubmitDisabled = useMemo(() => {
    const amountError = getBalanceAmountError(balanceForm.amount);
    const passwordError = getBalancePasswordError(balanceForm.password);
    return Boolean(amountError || passwordError);
  }, [balanceForm.amount, balanceForm.password, t]);

  const resetFilters = () => {
    setFilters({ name: '', idAgent: '', payinStatus: '', payoutStatus: '' });
    setFilterInputs({ name: '', idAgent: '', payinStatus: 'all', payoutStatus: 'all' });
    setPage(1);
  };

  const handleResetFilters = () => {
    resetFilters();
    void fetchMerchants(undefined, { name: '', idAgent: '', payinStatus: '', payoutStatus: '' }, 1, limit);
  };

  const handleFilterDialogChange = (open: boolean) => {
    if (open) {
      setFilterInputs({
        name: filters.name,
        idAgent: filters.idAgent,
        payinStatus: filters.payinStatus ? String(filters.payinStatus) : 'all',
        payoutStatus: filters.payoutStatus ? String(filters.payoutStatus) : 'all',
      });
    }
    if (!open && !appliedRef.current) {
      setFilterInputs({
        name: filters.name,
        idAgent: filters.idAgent,
        payinStatus: filters.payinStatus ? String(filters.payinStatus) : 'all',
        payoutStatus: filters.payoutStatus ? String(filters.payoutStatus) : 'all',
      });
    }
    appliedRef.current = false;
    setIsFilterDialogOpen(open);
  };

  const handleRefresh = useCallback(async () => {
    const MIN_SPIN_DURATION_MS = 500;

    setIsRefreshing(true);
    const start = Date.now();

    try {
      await fetchMerchants();
      tableScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    } finally {
      const elapsed = Date.now() - start;

      if (elapsed < MIN_SPIN_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_DURATION_MS - elapsed));
      }

      setIsRefreshing(false);
    }
  }, [fetchMerchants]);

  const handleBalanceDialogChange = (open: boolean) => {
    if (!open) {
      setBalanceAction(null);
      setBalanceMerchantId(null);
      setBalanceMerchantName('');
      setBalanceForm({ amount: '', password: '' });
      setBalanceErrors({});
      setShowBalancePassword(false);
    }
    setBalanceDialogOpen(open);
  };

  const handleOpenBalanceDialog = useCallback((merchant: MerchantItem, action: 'topup' | 'deduct') => {
    setBalanceDialogOpen(true);
    setBalanceAction(action);
    setBalanceMerchantId(merchant.id);
    setBalanceMerchantName(merchant.name ?? '');
    setBalanceForm({ amount: '', password: '' });
    setBalanceErrors({});
    setShowBalancePassword(false);
  }, []);

  const handleChannelDialogChange = (open: boolean) => {
    if (!open) {
      setChannelMerchantId(null);
      setChannelMerchantName('');
      setMerchantChannels([]);
      setMerchantChannelDisbursements([]);
    }
    setChannelDialogOpen(open);
  };

  const handleOpenChannelDialog = useCallback(async (merchant: MerchantItem) => {
    if (!merchant?.id) return;
    setChannelDialogOpen(true);
    setChannelMerchantId(merchant.id);
    setChannelMerchantName(merchant.name ?? '-');
    setIsLoadingChannelConfig(true);

    try {
      const [channelResponse, channelDisbursementResponse] = await Promise.all([
        apiFetch<MerchantConfigListResponse<MerchantChannelConfigItem>>(`merchant/${merchant.id}/channels`, { method: 'GET' }),
        apiFetch<MerchantConfigListResponse<MerchantChannelDisbursementConfigItem>>(`merchant/${merchant.id}/channel-disbursement`, { method: 'GET' }),
      ]);
      setMerchantChannels(channelResponse.data ?? []);
      setMerchantChannelDisbursements(channelDisbursementResponse.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('merchants.channelConfig.toast.loadError'));
      setChannelDialogOpen(false);
    } finally {
      setIsLoadingChannelConfig(false);
    }
  }, [t]);

  const handleSaveChannelConfig = async () => {
    if (!channelMerchantId) return;
    setIsSavingChannelConfig(true);
    try {
      await Promise.all([
        apiFetch(`merchant/${channelMerchantId}/channels`, {
          method: 'POST',
          body: {
            channels: merchantChannels.map((channel) => ({
              channelProdukId: channel.channelProdukId,
              isActive: Boolean(channel.status),
              priority: Number(channel.priority) || 0,
            })),
          },
        }),
        apiFetch(`merchant/${channelMerchantId}/channel-disbursement`, {
          method: 'POST',
          body: {
            channels: merchantChannelDisbursements.map((channel) => ({
              channelDisbursementId: channel.channelDisbursementId,
              isActive: Boolean(channel.isActive),
              priority: Number(channel.priority) || 0,
            })),
          },
        }),
      ]);
      toast.success(t('merchants.channelConfig.toast.saveSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      handleChannelDialogChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('merchants.channelConfig.toast.saveError'));
    } finally {
      setIsSavingChannelConfig(false);
    }
  };

  const handleOpenEditDialog = useCallback(
    (merchant: MerchantItem) => {
      setMerchantDialogOpen(true);
      setEditingMerchantId(merchant.id);
      setMerchantDetail(null);
      setIsLoadingMerchantDetail(true);
      setMerchantErrors({});
      setIsIpPayinTouched(false);
      setIsIpPayoutTouched(false);

      const loadMerchantDetail = async () => {
        try {
          const response = await apiFetch<MerchantDetailResponse>(`merchant/${merchant.id}`);
          const detail = response.data ?? null;
          setMerchantDetail(detail);
          setMerchantForm({
            name: detail?.name ?? '',
                ownerEmail: detail?.ownerEmail ?? '',
            feePercentage: detail?.feePercentage !== undefined ? String(detail.feePercentage) : '',
            feeFixed: detail?.feeFixed !== undefined ? String(detail.feeFixed) : '',
            biayaPayout: detail?.biayaPayout !== undefined ? String(detail.biayaPayout) : '',
            ipPayin: detail?.ipPayin ?? '',
            ipPayout: detail?.ipPayout ?? '',
            idAgent: detail?.idAgent != null ? String(detail.idAgent) : '',
            status: detail?.status ?? 'active',
            payinStatus: detail?.payinStatus ?? 'active',
            payoutStatus: detail?.payoutStatus ?? 'active',
          });
          setMerchantErrors({
            name: getMerchantNameError(detail?.name ?? ''),
            feePercentage: getFeeError(
              detail?.feePercentage !== undefined ? String(detail.feePercentage) : '',
              t('merchants.fields.feePercentage'),
            ),
            feeFixed: getFeeError(
              detail?.feeFixed !== undefined ? String(detail.feeFixed) : '',
              t('merchants.fields.feeFixed'),
            ),
            biayaPayout: getFeeError(
              detail?.biayaPayout !== undefined ? String(detail.biayaPayout) : '',
              t('merchants.fields.biayaPayout'),
            ),
            ipPayin: getIpPayinError(detail?.ipPayin ?? ''),
            ipPayout: getIpPayoutError(detail?.ipPayout ?? ''),
            idAgent: getAgentIdError(detail?.idAgent != null ? String(detail.idAgent) : ''),
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t('merchants.toast.detailError'));
        } finally {
          setIsLoadingMerchantDetail(false);
        }
      };

      void loadMerchantDetail();
    },
    [getAgentIdError, getFeeError, getIpPayinError, getIpPayoutError, getMerchantNameError, t],
  );

  const handleSaveBalance = async () => {
    if (!balanceMerchantId || !balanceAction) return;
    const action = balanceAction;
    const merchantId = balanceMerchantId;

    const amountError = getBalanceAmountError(balanceForm.amount);
    const passwordError = getBalancePasswordError(balanceForm.password);
    if (amountError || passwordError) {
      setBalanceErrors({ amount: amountError, password: passwordError });
      return;
    }

    setIsSavingBalance(true);
    setBalanceDialogOpen(false);

    try {
      await apiFetch(`merchant/${action}/${merchantId}`, {
        method: 'POST',
        body: {
          amount: Number(balanceForm.amount),
          password: balanceForm.password,
        },
      });

      toast.success(
        t(action === 'topup' ? 'merchants.balance.topup.success' : 'merchants.balance.deduct.success'),
        {
          duration: 1500,
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        },
      );

      await fetchMerchants();
      tableScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    } catch {
      toast.error(t(action === 'topup' ? 'merchants.balance.topup.error' : 'merchants.balance.deduct.error'));
    } finally {
      setBalanceAction(null);
      setBalanceMerchantId(null);
      setBalanceMerchantName('');
      setBalanceForm({ amount: '', password: '' });
      setBalanceErrors({});
      setShowBalancePassword(false);
      setIsSavingBalance(false);
    }
  };

  const handleSaveMerchant = async () => {
    if (!editingMerchantId) return;

    const errors: {
      name?: string;
      feePercentage?: string;
      feeFixed?: string;
      biayaPayout?: string;
      ipPayin?: string;
      ipPayout?: string;
      idAgent?: string;
    } = {};
    errors.name = getMerchantNameError(merchantForm.name);
    errors.feePercentage = getFeeError(merchantForm.feePercentage, t('merchants.fields.feePercentage'));
    errors.feeFixed = getFeeError(merchantForm.feeFixed, t('merchants.fields.feeFixed'));
    errors.biayaPayout = getFeeError(merchantForm.biayaPayout, t('merchants.fields.biayaPayout'));
    errors.ipPayin = getIpPayinError(merchantForm.ipPayin);
    errors.ipPayout = getIpPayoutError(merchantForm.ipPayout);
    errors.idAgent = getAgentIdError(merchantForm.idAgent);

    if (Object.values(errors).some(Boolean)) {
      setMerchantErrors(errors);
      return;
    }

    setIsSavingMerchant(true);
    setIsLoading(true);
    setMerchantDialogOpen(false);

    try {
      const feePercentageValue = Number(merchantForm.feePercentage);
      const feeFixedValue = Number(merchantForm.feeFixed);
      const biayaPayoutValue = Number(merchantForm.biayaPayout);
      const agentValue = merchantForm.idAgent !== '' ? Number(merchantForm.idAgent) : undefined;

        await apiFetch(`merchant/update/${editingMerchantId}`, {
          method: 'POST',
          body: {
            name: merchantForm.name.trim(),
            feePercentage: feePercentageValue,
            feeFixed: feeFixedValue,
            biayaPayout: biayaPayoutValue,
            ipPayin: merchantForm.ipPayin.trim(),
            ipPayout: merchantForm.ipPayout.trim(),
            ...(agentValue !== undefined ? { idAgent: agentValue } : {}),
            status: merchantForm.status || 'inactive',
            payinStatus: merchantForm.payinStatus || 'inactive',
            payoutStatus: merchantForm.payoutStatus || 'inactive',
          },
        });

      toast.success(t('merchants.toast.updateSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      await fetchMerchants();
      setMerchantDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('merchants.toast.updateError'));
    } finally {
      setIsLoading(false);
      setIsSavingMerchant(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateMerchantDialogOpen(true);
    setCreateMerchantForm({
      name: '',
      email: '',
      feePercentage: '',
      feeFixed: '',
      biayaPayout: '',
      idAgent: '',
    });
    setCreateMerchantErrors({});
  };

  const handleCreateMerchant = async () => {
    const errors: {
      name?: string;
      email?: string;
      feePercentage?: string;
      feeFixed?: string;
      biayaPayout?: string;
      idAgent?: string;
    } = {};

    errors.name = getMerchantNameError(createMerchantForm.name);
    errors.email = getEmailError(createMerchantForm.email);
    errors.feePercentage = getFeeError(createMerchantForm.feePercentage, t('merchants.fields.feePercentage'));
    errors.feeFixed = getFeeError(createMerchantForm.feeFixed, t('merchants.fields.feeFixed'));
    errors.biayaPayout = getFeeError(createMerchantForm.biayaPayout, t('merchants.fields.biayaPayout'));
    errors.idAgent = getAgentIdError(createMerchantForm.idAgent);

    if (Object.values(errors).some(Boolean)) {
      setCreateMerchantErrors(errors);
      return;
    }

    const feePercentageValue = Number(createMerchantForm.feePercentage);
    const feeFixedValue = Number(createMerchantForm.feeFixed);
    const biayaPayoutValue = Number(createMerchantForm.biayaPayout);
    const parsedAgent = createMerchantForm.idAgent.trim() ? Number(createMerchantForm.idAgent.trim()) : undefined;

    const payload: {
      name: string;
      email: string;
      feePercentage: number;
      feeFixed: number;
      biayaPayout: number;
      idAgent?: number;
    } = {
      name: createMerchantForm.name.trim(),
      email: createMerchantForm.email.trim(),
      feePercentage: feePercentageValue,
      feeFixed: feeFixedValue,
      biayaPayout: biayaPayoutValue,
    };

    if (parsedAgent !== undefined && !Number.isNaN(parsedAgent)) {
      payload.idAgent = parsedAgent;
    }

    setIsCreatingMerchant(true);
    setIsLoading(true);
    setCreateMerchantDialogOpen(false);

    try {
      await apiFetch('merchant/add', {
        method: 'POST',
        body: payload,
      });

      toast.success(t('merchants.toast.createSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });

      await fetchMerchants();
      setCreateMerchantErrors({});
      setCreateMerchantDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('merchants.toast.createError'));
    } finally {
      setIsLoading(false);
      setIsCreatingMerchant(false);
    }
  };

  const statusBadgeVariant = useCallback((status?: MerchantStatus | string) => {
    const normalized = typeof status === 'string' ? status.toLowerCase() : status;
    if (normalized === 'active') return 'default' as const;
    if (normalized === 'inactive') return 'destructive' as const;
    return 'secondary' as const;
  }, []);

  const columnConfigs = useMemo<MerchantColumnConfig[]>(
    () => [
      {
        id: 'name',
        label: t('merchants.table.name'),
        headerClassName: 'whitespace-nowrap min-w-[200px]',
        cellClassName: 'font-medium whitespace-nowrap min-w-[200px]',
        render: (merchant) => merchant.name || '-',
      },
      {
        id: 'ownerEmail',
        label: t('merchants.table.ownerEmail'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (merchant) => merchant.ownerEmail ?? '-',
      },
      {
        id: 'id',
        label: t('merchants.table.id'),
        headerClassName: 'whitespace-nowrap',
        render: (merchant) => merchant.id ?? '-',
      },
      {
        id: 'saldo',
        label: t('merchants.table.balance'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (merchant) => formatCurrency(merchant.saldo),
      },
      {
        id: 'feePercentage',
        label: t('merchants.table.feePercentage'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (merchant) => formatPercent(merchant.feePercentage),
      },
      {
        id: 'feeFixed',
        label: t('merchants.table.feeFixed'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (merchant) => formatCurrency(merchant.feeFixed),
      },
      {
        id: 'biayaPayout',
        label: t('merchants.table.biayaPayout'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (merchant) => formatCurrency(merchant.biayaPayout),
      },
      {
        id: 'idAgent',
        label: t('merchants.table.agentId'),
        headerClassName: 'whitespace-nowrap',
        render: (merchant) => merchant.idAgent ?? '-',
      },
      {
        id: 'payinStatus',
        label: t('merchants.table.payinStatus'),
        headerClassName: 'whitespace-nowrap',
        render: (merchant) => {
          const normalized = merchant.payinStatus?.toLowerCase();
          const isActive = normalized === 'active';

          return (
            <Badge
              variant={statusBadgeVariant(merchant.payinStatus)}
              className={cn(
                'w-[110px] justify-center rounded-md px-2 py-0.5 uppercase',
                isActive &&
                  'text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                !isActive && normalized === 'inactive' && 'bg-rose-400 text-white',
              )}
            >
              {normalized ? t(`merchants.status.${normalized}`) : t('merchants.status.unknown')}
            </Badge>
          );
        },
      },
      {
        id: 'payoutStatus',
        label: t('merchants.table.payoutStatus'),
        headerClassName: 'whitespace-nowrap',
        render: (merchant) => {
          const normalized = merchant.payoutStatus?.toLowerCase();
          const isActive = normalized === 'active';

          return (
            <Badge
              variant={statusBadgeVariant(merchant.payoutStatus)}
              className={cn(
                'w-[110px] justify-center rounded-md px-2 py-0.5 uppercase',
                isActive &&
                  'text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                !isActive && normalized === 'inactive' && 'bg-rose-400 text-white',
              )}
            >
              {normalized ? t(`merchants.status.${normalized}`) : t('merchants.status.unknown')}
            </Badge>
          );
        },
      },
      {
        id: 'created_at',
        label: t('merchants.table.createdAt'),
        headerClassName: 'whitespace-nowrap',
        render: (merchant) => merchant.created_at ?? '-',
      },
      {
        id: 'updated_at',
        label: t('merchants.table.updatedAt'),
        headerClassName: 'whitespace-nowrap',
        render: (merchant) => merchant.updated_at ?? '-',
      },
      {
        id: 'actions',
        label: t('merchants.table.actions'),
        headerClassName: 'whitespace-nowrap text-left w-fit',
        cellClassName: 'whitespace-nowrap text-right w-fit',
        render: (merchant) => (
          <div className="flex flex-nowrap items-center justify-end gap-2">
            <Button
              size="sm"
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => void handleOpenChannelDialog(merchant)}
            >
              {t('merchants.actions.channel')}
            </Button>
            {canTopup && (
              <Button
                size="sm"
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => handleOpenBalanceDialog(merchant, 'topup')}
                disabled={isSavingBalance}
              >
                {t('merchants.actions.topup')}
              </Button>
            )}
            {canDeduct && (
              <Button
                size="sm"
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => handleOpenBalanceDialog(merchant, 'deduct')}
                disabled={isSavingBalance}
              >
                {t('merchants.actions.deduct')}
              </Button>
            )}
            <Button
              size="sm"
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => handleOpenEditDialog(merchant)}
              disabled={isLoadingMerchantDetail}
            >
              {t('common.edit')}
            </Button>
          </div>
        ),
      },
    ],
    [
      canDeduct,
      canTopup,
      handleOpenBalanceDialog,
      handleOpenEditDialog,
      isLoadingMerchantDetail,
      isSavingBalance,
      statusBadgeVariant,
      t,
    ],
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
    () => `${Math.max(visibleColumnConfigs.length * 140, 1100)}px`,
    [visibleColumnConfigs.length],
  );

  const merchantTable = useMemo(
    () => (
      <div ref={tableScrollRef} className="relative overflow-x-auto sm:rounded-md sm:border">
        <Table style={{ minWidth: calculatedMinTableWidth }}>
          <TableHeader>
            <TableRow>
              {visibleColumnConfigs.length === 0 ? (
                <TableHead className="whitespace-nowrap">{t('merchants.table.noColumns')}</TableHead>
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

            {!isLoading && merchants.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={Math.max(visibleColumnConfigs.length, 1)}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {t('merchants.empty')}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              merchants.map((merchant) => (
                <TableRow key={merchant.id}>
                  {visibleColumnConfigs.map((column) => (
                    <TableCell
                      key={column.id}
                      data-label={column.label}
                      className={column.cellClassName ?? 'whitespace-nowrap'}
                    >
                      {column.render(merchant)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    ),
    [calculatedMinTableWidth, isLoading, merchants, t, visibleColumnConfigs],
  );

  const toggleColumnVisibility = useCallback((columnId: MerchantColumnId, isVisible: boolean) => {
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

  return (
    <div className="container space-y-6 pb-10 pt-4">
      <Dialog open={merchantDialogOpen} onOpenChange={setMerchantDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('merchants.edit.title')}</DialogTitle>
            <DialogDescription>{t('merchants.edit.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {isLoadingMerchantDetail && (
              <p className="text-sm text-muted-foreground">{t('merchants.edit.loading')}</p>
            )}

            {!isLoadingMerchantDetail && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="merchant-name-input" className="text-sm font-medium text-muted-foreground">
                    {t('merchants.fields.name')}
                  </Label>
                  <Input
                    id="merchant-name-input"
                    value={merchantForm.name}
                    maxLength={MERCHANT_NAME_MAX_LENGTH}
                    onChange={(event) => {
                      const value = event.target.value;
                      setMerchantForm((prev) => ({
                        ...prev,
                        name: value,
                      }));
                      setMerchantErrors((prev) => ({ ...prev, name: getMerchantNameError(value) }));
                    }}
                    placeholder={t('merchants.placeholders.name')}
                  />
                  {merchantErrors.name && <p className="text-sm text-destructive">{merchantErrors.name}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="merchant-owner-email" className="text-sm font-medium text-muted-foreground">
                    {t('merchants.fields.ownerEmail')}
                  </Label>
                  <Input
                    id="merchant-owner-email"
                    value={merchantForm.ownerEmail}
                    disabled
                    placeholder={t('merchants.placeholders.email')}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="merchant-fee-percentage" className="text-sm font-medium text-muted-foreground">
                      {t('merchants.fields.feePercentage')}
                    </Label>
                    <Input
                      id="merchant-fee-percentage"
                      inputMode="decimal"
                      value={merchantForm.feePercentage}
                      onChange={(event) => {
                        const value = event.target.value;
                        setMerchantForm((prev) => ({
                          ...prev,
                          feePercentage: value,
                        }));
                        setMerchantErrors((prev) => ({
                          ...prev,
                          feePercentage: getFeeError(value, t('merchants.fields.feePercentage')),
                        }));
                      }}
                      placeholder={t('merchants.placeholders.feePercentage')}
                    />
                    {merchantErrors.feePercentage && (
                      <p className="text-sm text-destructive">{merchantErrors.feePercentage}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="merchant-fee-fixed" className="text-sm font-medium text-muted-foreground">
                      {t('merchants.fields.feeFixed')}
                    </Label>
                    <Input
                      id="merchant-fee-fixed"
                      inputMode="decimal"
                      value={merchantForm.feeFixed}
                      onChange={(event) => {
                        const value = event.target.value;
                        setMerchantForm((prev) => ({
                          ...prev,
                          feeFixed: value,
                        }));
                        setMerchantErrors((prev) => ({
                          ...prev,
                          feeFixed: getFeeError(value, t('merchants.fields.feeFixed')),
                        }));
                      }}
                      placeholder={t('merchants.placeholders.feeFixed')}
                    />
                    {merchantErrors.feeFixed && (
                      <p className="text-sm text-destructive">{merchantErrors.feeFixed}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="merchant-biaya-payout" className="text-sm font-medium text-muted-foreground">
                      {t('merchants.fields.biayaPayout')}
                    </Label>
                    <Input
                      id="merchant-biaya-payout"
                      inputMode="decimal"
                      value={merchantForm.biayaPayout}
                      onChange={(event) => {
                        const value = event.target.value;
                        setMerchantForm((prev) => ({
                          ...prev,
                          biayaPayout: value,
                        }));
                        setMerchantErrors((prev) => ({
                          ...prev,
                          biayaPayout: getFeeError(value, t('merchants.fields.biayaPayout')),
                        }));
                      }}
                      placeholder={t('merchants.placeholders.biayaPayout')}
                    />
                    {merchantErrors.biayaPayout && (
                      <p className="text-sm text-destructive">{merchantErrors.biayaPayout}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="merchant-agent" className="text-sm font-medium text-muted-foreground">
                      {t('merchants.fields.agentId')}
                    </Label>
                    <Input
                      id="merchant-agent"
                      inputMode="numeric"
                      value={merchantForm.idAgent}
                      onChange={(event) => {
                        const value = event.target.value;
                        setMerchantForm((prev) => ({
                          ...prev,
                          idAgent: value,
                        }));
                        setMerchantErrors((prev) => ({ ...prev, idAgent: getAgentIdError(value) }));
                      }}
                      placeholder={t('merchants.placeholders.agentId')}
                    />
                    {merchantErrors.idAgent && <p className="text-sm text-destructive">{merchantErrors.idAgent}</p>}
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="merchant-ip-payin" className="text-sm font-medium text-muted-foreground">
                      {t('merchants.fields.ipPayin')}
                    </Label>
                    <Input
                      id="merchant-ip-payin"
                      value={merchantForm.ipPayin}
                      onChange={(event) => {
                        const value = event.target.value;
                        const shouldValidate = isIpPayinTouched || value.trim() !== '';
                        if (!isIpPayinTouched && shouldValidate) {
                          setIsIpPayinTouched(true);
                        }
                        setMerchantForm((prev) => ({
                          ...prev,
                          ipPayin: value,
                        }));
                        setMerchantErrors((prev) => ({
                          ...prev,
                          ipPayin: shouldValidate ? getIpPayinError(value) : prev.ipPayin,
                        }));
                      }}
                      onBlur={(event) => {
                        if (!isIpPayinTouched) {
                          setIsIpPayinTouched(true);
                        }
                        setMerchantErrors((prev) => ({
                          ...prev,
                          ipPayin: getIpPayinError(event.target.value),
                        }));
                      }}
                      placeholder={t('merchants.placeholders.ipPayin')}
                    />
                    {merchantErrors.ipPayin && (
                      <p className="text-sm text-destructive">{merchantErrors.ipPayin}</p>
                    )}
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="merchant-ip-payout" className="text-sm font-medium text-muted-foreground">
                      {t('merchants.fields.ipPayout')}
                    </Label>
                    <Input
                      id="merchant-ip-payout"
                      value={merchantForm.ipPayout}
                      onChange={(event) => {
                        const value = event.target.value;
                        const shouldValidate = isIpPayoutTouched || value.trim() !== '';
                        if (!isIpPayoutTouched && shouldValidate) {
                          setIsIpPayoutTouched(true);
                        }
                        setMerchantForm((prev) => ({
                          ...prev,
                          ipPayout: value,
                        }));
                        setMerchantErrors((prev) => ({
                          ...prev,
                          ipPayout: shouldValidate ? getIpPayoutError(value) : prev.ipPayout,
                        }));
                      }}
                      onBlur={(event) => {
                        if (!isIpPayoutTouched) {
                          setIsIpPayoutTouched(true);
                        }
                        setMerchantErrors((prev) => ({
                          ...prev,
                          ipPayout: getIpPayoutError(event.target.value),
                        }));
                      }}
                      placeholder={t('merchants.placeholders.ipPayout')}
                    />
                    {merchantErrors.ipPayout && (
                      <p className="text-sm text-destructive">{merchantErrors.ipPayout}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">{t('merchants.fields.status')}</Label>
                    <Select
                      value={merchantForm.status ? String(merchantForm.status) : 'active'}
                      onValueChange={(value) =>
                        setMerchantForm((prev) => ({
                          ...prev,
                          status: value as MerchantStatus,
                        }))
                      }
                    >
                      <SelectTrigger id="merchant-status" className="bg-background">
                        <SelectValue placeholder={t('merchants.placeholders.status')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('merchants.status.active')}</SelectItem>
                        <SelectItem value="inactive">{t('merchants.status.inactive')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">{t('merchants.fields.payinStatus')}</Label>
                    <Select
                      value={merchantForm.payinStatus ? String(merchantForm.payinStatus) : 'active'}
                      onValueChange={(value) =>
                        setMerchantForm((prev) => ({
                          ...prev,
                          payinStatus: value as MerchantStatus,
                        }))
                      }
                    >
                      <SelectTrigger id="merchant-payin-status" className="bg-background">
                        <SelectValue placeholder={t('merchants.placeholders.payinStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('merchants.status.active')}</SelectItem>
                        <SelectItem value="inactive">{t('merchants.status.inactive')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">{t('merchants.fields.payoutStatus')}</Label>
                    <Select
                      value={merchantForm.payoutStatus ? String(merchantForm.payoutStatus) : 'active'}
                      onValueChange={(value) =>
                        setMerchantForm((prev) => ({
                          ...prev,
                          payoutStatus: value as MerchantStatus,
                        }))
                      }
                    >
                      <SelectTrigger id="merchant-payout-status" className="bg-background">
                        <SelectValue placeholder={t('merchants.placeholders.payoutStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('merchants.status.active')}</SelectItem>
                        <SelectItem value="inactive">{t('merchants.status.inactive')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setMerchantDialogOpen(false)}
              disabled={isSavingMerchant}
            >
              {t('common.cancel')}
            </Button>
                    <Button
                      className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      onClick={handleSaveMerchant}
                      disabled={isSavingMerchant || isLoadingMerchantDetail || isEditMerchantSubmitDisabled}
                    >
              {isSavingMerchant ? t('common.saving') : t('merchants.edit.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={channelDialogOpen} onOpenChange={handleChannelDialogChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('merchants.channelConfig.title')}</DialogTitle>
            <DialogDescription>{t('merchants.channelConfig.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span>{t('merchants.channelConfig.merchantName')} </span>
              <span className="font-medium text-foreground">{channelMerchantName || '-'}</span>
            </p>

            {isLoadingChannelConfig ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">{t('merchants.channelConfig.sections.channel')}</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('merchants.channelConfig.table.channel')}</TableHead>
                          <TableHead>{t('merchants.channelConfig.table.product')}</TableHead>
                          <TableHead>{t('merchants.channelConfig.table.type')}</TableHead>
                          <TableHead>{t('merchants.channelConfig.table.priority')}</TableHead>
                          <TableHead className="text-right">{t('merchants.channelConfig.table.isActive')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {merchantChannels.map((channel, index) => (
                          <TableRow key={`${channel.channelProdukId}-${index}`}>
                            <TableCell>{channel.channelName}</TableCell>
                            <TableCell>{channel.channelProdukName}</TableCell>
                            <TableCell>{channel.channelProdukJenis}</TableCell>
                            <TableCell className="w-[120px]">
                              <Input
                                type="number"
                                min={0}
                                value={channel.priority}
                                onChange={(event) => {
                                  const value = Number(event.target.value || 0);
                                  setMerchantChannels((previous) =>
                                    previous.map((item, itemIndex) => (itemIndex === index ? { ...item, priority: value } : item)),
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={Boolean(channel.status)}
                                onCheckedChange={(checked) => {
                                  setMerchantChannels((previous) =>
                                    previous.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, status: checked ? 1 : 0 } : item,
                                    ),
                                  );
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-semibold">{t('merchants.channelConfig.sections.disbursement')}</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('merchants.channelConfig.table.channel')}</TableHead>
                          <TableHead>{t('merchants.channelConfig.table.priority')}</TableHead>
                          <TableHead className="text-right">{t('merchants.channelConfig.table.isActive')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {merchantChannelDisbursements.map((channel, index) => (
                          <TableRow key={`${channel.channelDisbursementId}-${index}`}>
                            <TableCell>{channel.channelName}</TableCell>
                            <TableCell className="w-[120px]">
                              <Input
                                type="number"
                                min={0}
                                value={channel.priority}
                                onChange={(event) => {
                                  const value = Number(event.target.value || 0);
                                  setMerchantChannelDisbursements((previous) =>
                                    previous.map((item, itemIndex) => (itemIndex === index ? { ...item, priority: value } : item)),
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={Boolean(channel.isActive)}
                                onCheckedChange={(checked) => {
                                  setMerchantChannelDisbursements((previous) =>
                                    previous.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, isActive: checked ? 1 : 0 } : item,
                                    ),
                                  );
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleChannelDialogChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={() => void handleSaveChannelConfig()}
              disabled={isLoadingChannelConfig || isSavingChannelConfig}
            >
              {isSavingChannelConfig ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={balanceDialogOpen} onOpenChange={handleBalanceDialogChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {balanceAction === 'topup' ? t('merchants.balance.topup.title') : t('merchants.balance.deduct.title')}
            </DialogTitle>
            <DialogDescription>
              {balanceAction === 'topup'
                ? t('merchants.balance.topup.description')
                : t('merchants.balance.deduct.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span>{t('merchants.balance.fields.merchantName')} </span>
              <span className="font-medium text-foreground">{balanceMerchantName || '-'}</span>
            </p>
            <div className="space-y-1">
              <Label htmlFor="merchant-balance-amount" className="text-sm font-medium text-muted-foreground">
                {t('merchants.balance.fields.amount')}
              </Label>
              <Input
                id="merchant-balance-amount"
                inputMode="decimal"
                name="merchant-balance-amount"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={balanceForm.amount}
                onChange={(event) => {
                  const value = event.target.value;
                  setBalanceForm((prev) => ({ ...prev, amount: value }));
                  setBalanceErrors((prev) => ({
                    ...prev,
                    amount: getBalanceAmountError(value),
                  }));
                }}
                placeholder={t('merchants.balance.placeholders.amount')}
              />
              {balanceErrors.amount && <p className="text-sm text-destructive">{balanceErrors.amount}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="merchant-balance-password" className="text-sm font-medium text-muted-foreground">
                {t('merchants.balance.fields.password')}
              </Label>
              <div className="relative">
                <Input
                  id="merchant-balance-password"
                  name="merchant-balance-password"
                  autoComplete={showBalancePassword ? 'off' : 'new-password'}
                  autoCorrect="off"
                  spellCheck={false}
                  type={showBalancePassword ? 'text' : 'password'}
                  value={balanceForm.password}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBalanceForm((prev) => ({ ...prev, password: value }));
                    setBalanceErrors((prev) => ({
                      ...prev,
                      password: getBalancePasswordError(value),
                    }));
                  }}
                  placeholder={t('merchants.balance.placeholders.password')}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showBalancePassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowBalancePassword((prev) => !prev)}
                >
                  {showBalancePassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {balanceErrors.password && <p className="text-sm text-destructive">{balanceErrors.password}</p>}
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => handleBalanceDialogChange(false)}
              disabled={isSavingBalance}
            >
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={handleSaveBalance}
              disabled={isSavingBalance || isBalanceSubmitDisabled}
            >
              {balanceAction === 'topup' ? t('merchants.balance.topup.action') : t('merchants.balance.deduct.action')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('merchants.pageTitle')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle className="max-[480px]:leading-[1.5]">{t('merchants.cardTitle')}</CardTitle>
            <CardDescription>
              {t('merchants.cardDescription')}
            </CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label={t('common.refresh')}
            >
              <RefreshCcw className={`h-4 w-4 transition ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="w-auto justify-center bg-primary text-white hover:bg-primary/90 flex items-center justify-center"
                  aria-label={t('merchants.filters.columns')}
                >
                  <Filter className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="font-medium">{t('merchants.filters.toggleColumns')}</DropdownMenuLabel>
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
                    <Label htmlFor="merchant-filter-name">{t('merchants.filters.name')}</Label>
                    <Input
                      id="merchant-filter-name"
                      placeholder={t('merchants.filters.namePlaceholder')}
                      value={filterInputs.name}
                      onChange={(event) => setFilterInputs((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="merchant-filter-agent">{t('merchants.filters.agentId')}</Label>
                    <Input
                      id="merchant-filter-agent"
                      inputMode="numeric"
                      placeholder={t('merchants.filters.agentIdPlaceholder')}
                      value={filterInputs.idAgent}
                      onChange={(event) => setFilterInputs((prev) => ({ ...prev, idAgent: event.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t('merchants.filters.payinStatus')}</Label>
                    <Select
                      value={filterInputs.payinStatus}
                      onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, payinStatus: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={t('merchants.filters.payinStatusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={`payin-${option.value || 'all'}`} value={String(option.value)}>
                            {option.value === 'all'
                              ? t('merchants.status.all')
                              : option.value === 'active'
                                ? t('merchants.status.active')
                                : t('merchants.status.inactive')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t('merchants.filters.payoutStatus')}</Label>
                    <Select
                      value={filterInputs.payoutStatus}
                      onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, payoutStatus: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={t('merchants.filters.payoutStatusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={`payout-${option.value || 'all'}`} value={String(option.value)}>
                            {option.value === 'all'
                              ? t('merchants.status.all')
                              : option.value === 'active'
                                ? t('merchants.status.active')
                                : t('merchants.status.inactive')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      appliedRef.current = false;
                      setFilterInputs({
                        name: filters.name,
                        idAgent: filters.idAgent,
                        payinStatus: filters.payinStatus ? String(filters.payinStatus) : 'all',
                        payoutStatus: filters.payoutStatus ? String(filters.payoutStatus) : 'all',
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
            <Dialog open={createMerchantDialogOpen} onOpenChange={setCreateMerchantDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="justify-center bg-primary text-white hover:bg-primary/90 active:bg-primary/80"
                  onClick={handleOpenCreateDialog}
                >
                  <Plus className="h-4 w-4" /> {t('common.add')}
                </Button>
              </DialogTrigger>
                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>{t('merchants.create.title')}</DialogTitle>
                      <DialogDescription>{t('merchants.create.description')}</DialogDescription>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <div className="space-y-1">
                        <Label htmlFor="create-merchant-name" className="text-sm font-medium text-muted-foreground">
                          {t('merchants.fields.name')}
                        </Label>
                        <Input
                          id="create-merchant-name"
                          value={createMerchantForm.name}
                          maxLength={MERCHANT_NAME_MAX_LENGTH}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCreateMerchantForm((prev) => ({
                              ...prev,
                              name: value,
                            }));
                            setCreateMerchantErrors((prev) => ({ ...prev, name: getMerchantNameError(value) }));
                          }}
                          placeholder={t('merchants.placeholders.name')}
                        />
                        {createMerchantErrors.name && (
                          <p className="text-sm text-destructive">{createMerchantErrors.name}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="create-merchant-email" className="text-sm font-medium text-muted-foreground">
                          {t('merchants.fields.email')}
                        </Label>
                        <Input
                          id="create-merchant-email"
                          type="email"
                          value={createMerchantForm.email}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCreateMerchantForm((prev) => ({
                              ...prev,
                              email: value,
                            }));
                            setCreateMerchantErrors((prev) => ({ ...prev, email: getEmailError(value) }));
                          }}
                          placeholder={t('merchants.placeholders.email')}
                        />
                        {createMerchantErrors.email && (
                          <p className="text-sm text-destructive">{createMerchantErrors.email}</p>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="create-merchant-fee-percentage"
                            className="text-sm font-medium text-muted-foreground"
                          >
                            {t('merchants.fields.feePercentage')}
                          </Label>
                          <Input
                            id="create-merchant-fee-percentage"
                            inputMode="decimal"
                            value={createMerchantForm.feePercentage}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCreateMerchantForm((prev) => ({
                                ...prev,
                                feePercentage: value,
                              }));
                              setCreateMerchantErrors((prev) => ({
                                ...prev,
                                feePercentage: getFeeError(value, t('merchants.fields.feePercentage')),
                              }));
                            }}
                            placeholder={t('merchants.placeholders.feePercentage')}
                          />
                          {createMerchantErrors.feePercentage && (
                            <p className="text-sm text-destructive">{createMerchantErrors.feePercentage}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="create-merchant-fee-fixed" className="text-sm font-medium text-muted-foreground">
                            {t('merchants.fields.feeFixed')}
                          </Label>
                          <Input
                            id="create-merchant-fee-fixed"
                            inputMode="decimal"
                            value={createMerchantForm.feeFixed}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCreateMerchantForm((prev) => ({
                                ...prev,
                                feeFixed: value,
                              }));
                              setCreateMerchantErrors((prev) => ({
                                ...prev,
                                feeFixed: getFeeError(value, t('merchants.fields.feeFixed')),
                              }));
                            }}
                            placeholder={t('merchants.placeholders.feeFixed')}
                          />
                          {createMerchantErrors.feeFixed && (
                            <p className="text-sm text-destructive">{createMerchantErrors.feeFixed}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="create-merchant-biaya-payout" className="text-sm font-medium text-muted-foreground">
                            {t('merchants.fields.biayaPayout')}
                          </Label>
                          <Input
                            id="create-merchant-biaya-payout"
                            inputMode="decimal"
                            value={createMerchantForm.biayaPayout}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCreateMerchantForm((prev) => ({
                                ...prev,
                                biayaPayout: value,
                              }));
                              setCreateMerchantErrors((prev) => ({
                                ...prev,
                                biayaPayout: getFeeError(value, t('merchants.fields.biayaPayout')),
                              }));
                            }}
                            placeholder={t('merchants.placeholders.biayaPayout')}
                          />
                          {createMerchantErrors.biayaPayout && (
                            <p className="text-sm text-destructive">{createMerchantErrors.biayaPayout}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="create-merchant-agent" className="text-sm font-medium text-muted-foreground">
                          {t('merchants.fields.agentId')}
                        </Label>
                        <Select
                          value={createMerchantForm.idAgent || undefined}
                          onValueChange={(value) => {
                            const nextValue = value === 'none' ? '' : value;
                            setCreateMerchantForm((prev) => ({
                              ...prev,
                              idAgent: nextValue,
                            }));
                            setCreateMerchantErrors((prev) => ({ ...prev, idAgent: getAgentIdError(nextValue) }));
                          }}
                        >
                          <SelectTrigger id="create-merchant-agent" className="bg-background">
                            <SelectValue
                              placeholder={
                                isLoadingAgents
                                  ? t('common.loading')
                                  : t('merchants.placeholders.agentId')
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('merchants.agentBlank')}</SelectItem>
                            {agents.length === 0 ? (
                              <SelectItem value="no-agents" disabled>
                                {t('merchants.agentEmpty')}
                              </SelectItem>
                            ) : (
                              agents.map((agent) => (
                                <SelectItem key={agent.id} value={String(agent.id)}>
                                  {agent.id} - {agent.name || agent.email || t('merchants.agentFallback')}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {createMerchantErrors.idAgent && (
                          <p className="text-sm text-destructive">{createMerchantErrors.idAgent}</p>
                        )}
                      </div>
                    </DialogBody>
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setCreateMerchantDialogOpen(false)}
                        disabled={isCreatingMerchant}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        onClick={handleCreateMerchant}
                        disabled={isCreatingMerchant || isCreateMerchantSubmitDisabled}
                      >
                        {isCreatingMerchant ? t('common.saving') : t('merchants.create.action')}
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
          {merchantTable}

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
                {formatMessage('merchants.total', { count: totalItems })}
              </div>
            </div>

            {merchants.length > 0 && (
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
                  onClick={() => setPage((prevPage) => Math.min(totalPages || 1, prevPage + 1))}
                  disabled={(totalPages || 1) <= page}
                >
                  {t('common.next')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
