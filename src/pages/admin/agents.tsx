import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Filter, Inbox, Plus, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/i18n/language-provider';

interface AgentItem {
  id: number | string;
  name?: string;
  email?: string;
  role?: string;
  idMerchant?: number | string | null;
  merchantName?: string | null;
  saldo?: number;
  feePercentage?: number | null;
  feeFixed?: number | null;
  permissions?: string | null;
  biayaPayout?: number | null;
  created_at?: string;
  updated_at?: string | null;
}

interface AgentListResponse {
  status: boolean;
  data?: AgentItem[] | { data?: AgentItem[] };
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

interface MerchantItem {
  id: number;
  name: string;
}

interface MerchantListResponse {
  status: boolean;
  data?: MerchantItem[];
}

const formatCurrency = (value?: number) =>
  typeof value === 'number' ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

type AgentColumnId =
  | 'id'
  | 'name'
  | 'email'
  | 'idMerchant'
  | 'merchantName'
  | 'role'
  | 'saldo'
  | 'created_at'
  | 'updated_at'
  | 'actions';

interface AgentColumnConfig {
  id: AgentColumnId;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (agent: AgentItem) => ReactNode;
}

export function AdminAgentPage() {
  const { t } = useLanguage();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | undefined>(0);
  const [filters, setFilters] = useState({ name: '', email: '', idMerchant: '' });
  const [filterInputs, setFilterInputs] = useState({ name: '', email: '', idMerchant: '' });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
    idMerchant: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createUserErrors, setCreateUserErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    idMerchant?: string;
  }>({});
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [isFetchingUserDetail, setIsFetchingUserDetail] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | string | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    role: 'agent',
    idMerchant: '',
    feePercentage: '',
    feeFixed: '',
    biayaPayout: '',
  });
  const [editUserErrors, setEditUserErrors] = useState<{
    name?: string;
    email?: string;
    idMerchant?: string;
    feePercentage?: string;
    feeFixed?: string;
    biayaPayout?: string;
  }>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<AgentColumnId>>(new Set());

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((message, [placeholder, value]) => {
      return message.replace(`{${placeholder}}`, String(value));
    }, t(key));

  const getAgentNameError = (name: string) => {
    if (!name.trim()) {
      return t('agents.validation.nameRequired');
    }
    return undefined;
  };

  const getAgentEmailError = (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return t('agents.validation.emailRequired');
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return t('agents.validation.emailInvalid');
    }
    return undefined;
  };

  const getAgentPasswordError = (password: string) => {
    if (!password.trim()) {
      return t('agents.validation.passwordRequired');
    }
    return undefined;
  };

  const getMerchantIdError = (merchantId: string) => {
    if (!merchantId.trim()) {
      return t('agents.validation.merchantRequired');
    }
    if (Number.isNaN(Number(merchantId.trim()))) {
      return t('agents.validation.merchantInvalid');
    }
    return undefined;
  };

  const getFeeError = (value: string, label: string) => {
    if (!value.trim()) {
      return formatMessage('agents.validation.feeRequired', { label });
    }
    if (Number.isNaN(Number(value.trim()))) {
      return formatMessage('agents.validation.feeInvalid', { label: label.toLowerCase() });
    }
    return undefined;
  };

  const isCreateUserSubmitDisabled = useMemo(() => {
    const nameError = getAgentNameError(createUserForm.name);
    const emailError = getAgentEmailError(createUserForm.email);
    const passwordError = getAgentPasswordError(createUserForm.password);
    const roleError = createUserForm.role ? undefined : t('agents.validation.roleRequired');
    const merchantError =
      createUserForm.role === 'merchant' ? getMerchantIdError(createUserForm.idMerchant) : undefined;

    return Boolean(nameError || emailError || passwordError || roleError || merchantError);
  }, [
    createUserForm.email,
    createUserForm.idMerchant,
    createUserForm.name,
    createUserForm.password,
    createUserForm.role,
    t,
  ]);

  const isEditUserSubmitDisabled = useMemo(() => {
    const nameError = getAgentNameError(editUserForm.name);
    const emailError = getAgentEmailError(editUserForm.email);
    const merchantError =
      editUserForm.role === 'merchant' ? getMerchantIdError(editUserForm.idMerchant) : undefined;
    const feePercentageError =
      editUserForm.role === 'agent'
        ? getFeeError(editUserForm.feePercentage, t('agents.fields.feePercentage'))
        : undefined;
    const feeFixedError =
      editUserForm.role === 'agent' ? getFeeError(editUserForm.feeFixed, t('agents.fields.feeFixed')) : undefined;
    const biayaPayoutError =
      editUserForm.role === 'agent'
        ? getFeeError(editUserForm.biayaPayout, t('agents.fields.biayaPayout'))
        : undefined;

    return Boolean(nameError || emailError || merchantError || feePercentageError || feeFixedError || biayaPayoutError);
  }, [
    editUserForm.feeFixed,
    editUserForm.feePercentage,
    editUserForm.biayaPayout,
    editUserForm.email,
    editUserForm.idMerchant,
    editUserForm.name,
    editUserForm.role,
    t,
  ]);

  const buildFilterParams = useCallback(
    (nextFilters: { name: string; email: string; idMerchant: string }, nextPage: number, nextLimit: number) => {
      const params = new URLSearchParams();
      if (nextFilters.email.trim()) params.set('email', nextFilters.email.trim());
      if (nextFilters.name.trim()) params.set('name', nextFilters.name.trim());
      if (nextFilters.idMerchant.trim()) params.set('idMerchant', nextFilters.idMerchant.trim());
      params.set('page', String(nextPage));
      params.set('limit', String(nextLimit));
      return params.toString();
    },
    [],
  );

  const extractAgents = (response: AgentListResponse) => {
    const payload = response.data as AgentListResponse['data'];

    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;

    return [] as AgentItem[];
  };

  const fetchAgents = useCallback(async (override?: { filters?: typeof filters; page?: number; limit?: number }) => {
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
      const activeFilters = override?.filters ?? filters;
      const activePage = override?.page ?? page;
      const activeLimit = override?.limit ?? limit;
      const filterParams = buildFilterParams(activeFilters, activePage, activeLimit);
      const query = filterParams ? `?${filterParams}` : '';
      const response = await apiFetch<AgentListResponse>(`user${query}`);
      const receivedAgents = extractAgents(response);
      setAgents(receivedAgents);
      setTotalPages(response.pagination?.totalPages ?? 1);
      setTotalItems(response.pagination?.total ?? receivedAgents.length ?? 0);
      if (response.pagination?.page) setPage(response.pagination.page);
      if (response.pagination?.limit) setLimit(response.pagination.limit);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('agents.toast.loadError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
      }
      setIsLoading(false);
    }
  }, [buildFilterParams, filters, limit, page, t]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const fetchMerchants = useCallback(async () => {
    setIsLoadingMerchants(true);
    try {
      const response = await apiFetch<MerchantListResponse>('/merchant?page=1&limit=1000');
      setMerchants(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('agents.toast.loadMerchantsError'), {
        duration: 1500,
        style: {
          border: '2px solid #fda4af',
          background: '#fff1f2',
          color: '#f43f5e',
          boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
          padding: '0.5rem',
        },
      });
      setMerchants([]);
    } finally {
      setIsLoadingMerchants(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchMerchants();
  }, [fetchMerchants]);

  const resetFilters = () => {
    setFilters({ name: '', email: '', idMerchant: '' });
    setFilterInputs({ name: '', email: '', idMerchant: '' });
    setPage(1);
  };

  const handleResetFilters = () => {
    resetFilters();
    void fetchAgents({ filters: { name: '', email: '', idMerchant: '' }, page: 1 });
  };

  const handleFilterDialogChange = (open: boolean) => {
    if (open) {
      setFilterInputs(filters);
    }
    if (!open && !appliedRef.current) {
      setFilterInputs(filters);
    }
    appliedRef.current = false;
    setIsFilterDialogOpen(open);
  };

  const handleSearch = () => {
    const nextFilters = {
      name: filterInputs.name,
      email: filterInputs.email,
      idMerchant: filterInputs.idMerchant,
    };
    setPage(1);
    setFilters(nextFilters);
    void fetchAgents({ filters: nextFilters, page: 1 });
  };

  const resetCreateUserForm = () => {
    setCreateUserForm({ name: '', email: '', password: '', role: 'agent', idMerchant: '' });
    setCreateUserErrors({});
  };

  const handleOpenCreateDialog = () => {
    resetCreateUserForm();
    setCreateUserDialogOpen(true);
  };

  const handleCreateUser = async () => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      idMerchant?: string;
    } = {};

    errors.name = getAgentNameError(createUserForm.name);
    errors.email = getAgentEmailError(createUserForm.email);
    errors.password = getAgentPasswordError(createUserForm.password);
    errors.role = createUserForm.role ? undefined : t('agents.validation.roleRequired');

    let parsedMerchantId: number | undefined;
    if (createUserForm.role === 'merchant') {
      errors.idMerchant = getMerchantIdError(createUserForm.idMerchant);
      parsedMerchantId = Number(createUserForm.idMerchant.trim());
    }

    if (Object.values(errors).some(Boolean)) {
      setCreateUserErrors(errors);
      return;
    }

    const payload: {
      name: string;
      email: string;
      password: string;
      role: string;
      idMerchant?: number;
    } = {
      name: createUserForm.name.trim(),
      email: createUserForm.email.trim(),
      password: createUserForm.password,
      role: createUserForm.role,
    };

    if (createUserForm.role === 'merchant' && parsedMerchantId !== undefined && !Number.isNaN(parsedMerchantId)) {
      payload.idMerchant = parsedMerchantId;
    }

    setIsCreatingUser(true);
    setIsLoading(true);
    setCreateUserDialogOpen(false);

    try {
      await apiFetch('user/add', {
        method: 'POST',
        body: payload,
      });

      toast.success(t('agents.toast.createSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });

      await fetchAgents();
      resetCreateUserForm();
      setCreateUserDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('agents.toast.createError'));
    } finally {
      setIsLoading(false);
      setIsCreatingUser(false);
    }
  };

  const resetEditUserForm = () => {
    setEditUserForm({
      name: '',
      email: '',
      role: 'agent',
      idMerchant: '',
      feePercentage: '',
      feeFixed: '',
      biayaPayout: '',
    });
    setEditUserErrors({});
    setEditingUserId(null);
  };

  const handleOpenEditDialog = async (userId: number | string) => {
    setEditUserDialogOpen(true);
    setEditingUserId(userId);
    setEditUserErrors({});
    setIsFetchingUserDetail(true);
    setEditUserForm({
      name: '',
      email: '',
      role: 'agent',
      idMerchant: '',
      feePercentage: '',
      feeFixed: '',
      biayaPayout: '',
    });

    try {
      const response = await apiFetch<{ status: boolean; data?: AgentItem & { komisi?: number } }>(`user/${userId}`);
      const detail = response.data;

      if (!detail) {
        throw new Error(t('agents.toast.detailNotFound'));
      }

      const role = detail.idMerchant ? 'merchant' : 'agent';

      setEditUserForm({
        name: detail.name ?? '',
        email: detail.email ?? '',
        role,
        idMerchant: detail.idMerchant ? String(detail.idMerchant) : '',
        feePercentage:
          detail.feePercentage !== undefined && detail.feePercentage !== null
            ? String(detail.feePercentage)
            : detail.komisi !== undefined && detail.komisi !== null
              ? String(detail.komisi)
              : '',
        feeFixed:
          detail.feeFixed !== undefined && detail.feeFixed !== null
            ? String(detail.feeFixed)
            : '',
        biayaPayout:
          detail.biayaPayout !== undefined && detail.biayaPayout !== null
            ? String(detail.biayaPayout)
            : '',
      });
      setEditUserErrors((prev) => ({
        ...prev,
        name: getAgentNameError(detail.name ?? ''),
        email: getAgentEmailError(detail.email ?? ''),
        idMerchant: role === 'merchant' ? getMerchantIdError(detail.idMerchant ? String(detail.idMerchant) : '') : undefined,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('agents.toast.detailError'));
      setEditUserDialogOpen(false);
    } finally {
      setIsFetchingUserDetail(false);
    }
  };

  const handleUpdateUser = async () => {
    const errors: {
      name?: string;
      email?: string;
      idMerchant?: string;
      feePercentage?: string;
      feeFixed?: string;
      biayaPayout?: string;
    } = {};

    errors.name = getAgentNameError(editUserForm.name);
    errors.email = getAgentEmailError(editUserForm.email);

    if (editUserForm.role === 'merchant') {
      errors.idMerchant = getMerchantIdError(editUserForm.idMerchant);
    } else {
      errors.feePercentage = getFeeError(editUserForm.feePercentage, t('agents.fields.feePercentage'));
      errors.feeFixed = getFeeError(editUserForm.feeFixed, t('agents.fields.feeFixed'));
      errors.biayaPayout = getFeeError(editUserForm.biayaPayout, t('agents.fields.biayaPayout'));
    }

    if (Object.values(errors).some(Boolean)) {
      setEditUserErrors(errors);
      return;
    }

    const payload: {
      name: string;
      feePercentage?: number;
      feeFixed?: number;
      biayaPayout?: number;
      idMerchant?: number;
    } = {
      name: editUserForm.name.trim(),
    };

    if (editUserForm.role === 'merchant') {
      payload.idMerchant = Number(editUserForm.idMerchant.trim());
    } else {
      payload.feePercentage = Number(editUserForm.feePercentage.trim());
      payload.feeFixed = Number(editUserForm.feeFixed.trim());
      payload.biayaPayout = Number(editUserForm.biayaPayout.trim());
    }

    if (!editingUserId) {
      toast.error(t('agents.toast.noUserSelected'));
      return;
    }

    setIsUpdatingUser(true);
    setIsLoading(true);
    setEditUserDialogOpen(false);

    try {
      await apiFetch(`user/update/${editingUserId}`, {
        method: 'POST',
        body: payload,
      });

      toast.success(t('agents.toast.updateSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });

      await fetchAgents();
      resetEditUserForm();
      setEditUserDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('agents.toast.updateError'));
    } finally {
      setIsLoading(false);
      setIsUpdatingUser(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    const MIN_SPIN_DURATION_MS = 500;

    setIsRefreshing(true);
    const start = Date.now();

    try {
      await fetchAgents();
    } finally {
      const elapsed = Date.now() - start;

      if (elapsed < MIN_SPIN_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_DURATION_MS - elapsed));
      }

      setIsRefreshing(false);
    }
  }, [fetchAgents]);

  const columnConfigs = useMemo<AgentColumnConfig[]>(
    () => [
      {
        id: 'id',
        label: t('common.id'),
        headerClassName: 'w-[120px] whitespace-nowrap',
        cellClassName: 'text-sm text-muted-foreground',
        render: (agent) => agent.id ?? '-',
      },
      {
        id: 'name',
        label: t('agents.table.name'),
        headerClassName: 'w-[180px] whitespace-nowrap',
        cellClassName: 'font-medium',
        render: (agent) => agent.name || '-',
      },
      {
        id: 'email',
        label: t('agents.table.email'),
        cellClassName: 'whitespace-nowrap',
        render: (agent) => agent.email || '-',
      },
      {
        id: 'idMerchant',
        label: t('agents.table.merchantId'),
        headerClassName: 'whitespace-nowrap',
        render: (agent) => agent.idMerchant ?? '-',
      },
      {
        id: 'merchantName',
        label: t('agents.table.merchantName'),
        headerClassName: 'whitespace-nowrap',
        render: (agent) => agent.merchantName ?? '-',
      },
      {
        id: 'role',
        label: t('agents.table.role'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap capitalize',
        render: (agent) =>
          agent.role === 'user'
            ? t('agents.roles.agent')
            : agent.role === 'merchant'
              ? t('agents.roles.merchant')
              : agent.role || '-',
      },
      {
        id: 'saldo',
        label: t('agents.table.balance'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (agent) => formatCurrency(agent.saldo),
      },
      {
        id: 'created_at',
        label: t('agents.table.createdAt'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap text-sm text-muted-foreground',
        render: (agent) => (agent.created_at ? new Date(agent.created_at).toLocaleString() : '-'),
      },
      {
        id: 'updated_at',
        label: t('agents.table.updatedAt'),
        headerClassName: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap text-sm text-muted-foreground',
        render: (agent) => (agent.updated_at ? new Date(agent.updated_at).toLocaleString() : '-'),
      },
      {
        id: 'actions',
        label: t('agents.table.actions'),
        headerClassName: 'w-[90px] text-right',
        cellClassName: 'text-right',
        render: (agent) => (
          <Button
            size="sm"
            className="bg-primary text-white hover:bg-primary/90"
            onClick={() => handleOpenEditDialog(agent.id)}
            disabled={isLoading}
          >
            {t('common.edit')}
          </Button>
        ),
      },
    ],
    [handleOpenEditDialog, isLoading, t],
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
    () => `${Math.max(visibleColumnConfigs.length * 140, 980)}px`,
    [visibleColumnConfigs.length],
  );

  const toggleColumnVisibility = useCallback((columnId: AgentColumnId, isVisible: boolean) => {
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

  const isEmpty = !isLoading && agents.length === 0;
  const pageOptions = useMemo(() => {
    const calculatedPages = Math.max(1, totalPages || Math.ceil((totalItems ?? 0) / limit) || 1);
    return Array.from({ length: calculatedPages }, (_, index) => index + 1);
  }, [limit, totalItems, totalPages]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.name.trim()) count += 1;
    if (filters.email.trim()) count += 1;
    if (filters.idMerchant.trim()) count += 1;
    return count;
  }, [filters.email, filters.idMerchant, filters.name]);

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('agents.pageTitle')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('agents.cardTitle')}</CardTitle>
            <CardDescription>{t('agents.cardDescription')}</CardDescription>
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
                  className="w-auto bg-primary text-white hover:bg-primary/90 flex items-center justify-center"
                  aria-label={t('agents.filters.columns')}
                >
                  <Filter className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="font-medium">{t('agents.filters.toggleColumns')}</DropdownMenuLabel>
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
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>{t('common.filters')}</DialogTitle>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="agent-filter-name">{t('agents.fields.name')}</Label>
                    <Input
                      id="agent-filter-name"
                      placeholder={t('agents.filters.namePlaceholder')}
                      value={filterInputs.name}
                      onChange={(event) => setFilterInputs((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="agent-filter-email">{t('agents.fields.email')}</Label>
                    <Input
                      id="agent-filter-email"
                      placeholder={t('agents.filters.emailPlaceholder')}
                      value={filterInputs.email}
                      onChange={(event) => setFilterInputs((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="agent-filter-merchant">{t('agents.fields.merchantId')}</Label>
                    <Select
                      value={filterInputs.idMerchant || 'all'}
                      onValueChange={(value) =>
                        setFilterInputs((prev) => ({ ...prev, idMerchant: value === 'all' ? '' : value }))
                      }
                      disabled={isLoadingMerchants}
                    >
                      <SelectTrigger id="agent-filter-merchant" className="bg-background">
                        <SelectValue
                          placeholder={
                            isLoadingMerchants
                              ? t('agents.placeholders.loadingMerchants')
                              : t('agents.filters.merchantIdPlaceholder')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('agents.filters.merchantAll')}</SelectItem>
                        {merchants.map((merchant) => (
                          <SelectItem key={merchant.id} value={String(merchant.id)}>
                            {merchant.id} - {merchant.name}
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
                      setFilterInputs(filters);
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
            <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80"
                  onClick={handleOpenCreateDialog}
                >
                  <Plus className="h-4 w-4" /> {t('common.add')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>{t('agents.create.title')}</DialogTitle>
                  <DialogDescription>{t('agents.create.description')}</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="create-user-name" className="text-sm font-medium text-muted-foreground">
                      {t('agents.fields.name')}
                    </Label>
                    <Input
                      id="create-user-name"
                      value={createUserForm.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateUserForm((prev) => ({ ...prev, name: value }));
                        setCreateUserErrors((prev) => ({ ...prev, name: getAgentNameError(value) }));
                      }}
                      placeholder={t('agents.placeholders.name')}
                    />
                    {createUserErrors.name && <p className="text-sm text-destructive">{createUserErrors.name}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="create-user-email" className="text-sm font-medium text-muted-foreground">
                          {t('agents.fields.email')}
                        </Label>
                        <Input
                          id="create-user-email"
                          type="email"
                          value={createUserForm.email}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCreateUserForm((prev) => ({ ...prev, email: value }));
                            setCreateUserErrors((prev) => ({ ...prev, email: getAgentEmailError(value) }));
                          }}
                          placeholder={t('agents.placeholders.email')}
                        />
                        {createUserErrors.email && <p className="text-sm text-destructive">{createUserErrors.email}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="create-user-password" className="text-sm font-medium text-muted-foreground">
                          {t('agents.fields.password')}
                        </Label>
                        <div className="relative">
                          <Input
                            id="create-user-password"
                            type={showCreatePassword ? 'text' : 'password'}
                            value={createUserForm.password}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCreateUserForm((prev) => ({ ...prev, password: value }));
                              setCreateUserErrors((prev) => ({ ...prev, password: getAgentPasswordError(value) }));
                            }}
                            placeholder={t('agents.placeholders.password')}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowCreatePassword((prev) => !prev)}
                          >
                            {showCreatePassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </Button>
                        </div>
                        {createUserErrors.password && <p className="text-sm text-destructive">{createUserErrors.password}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-sm font-medium text-muted-foreground">{t('agents.fields.role')}</Label>
                        <Select
                          value={createUserForm.role}
                          onValueChange={(value) => {
                            setCreateUserForm((prev) => {
                              const nextIdMerchant = value === 'merchant' ? prev.idMerchant : '';
                              setCreateUserErrors((prevErrors) => ({
                                ...prevErrors,
                                role: value ? undefined : t('agents.validation.roleRequired'),
                                idMerchant: undefined,
                              }));
                              return {
                                ...prev,
                                role: value,
                                idMerchant: nextIdMerchant,
                              };
                            });
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={t('agents.placeholders.role')} />
                          </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">{t('agents.roles.agent')}</SelectItem>
                        </SelectContent>
                      </Select>
                        {createUserErrors.role && <p className="text-sm text-destructive">{createUserErrors.role}</p>}
                      </div>

                      {createUserForm.role === 'merchant' && (
                        <div className="space-y-1">
                          <Label htmlFor="create-user-merchant" className="text-sm font-medium text-muted-foreground">
                            {t('agents.fields.merchantId')}
                          </Label>
                          <Select
                            value={createUserForm.idMerchant}
                            onValueChange={(value) => {
                              setCreateUserForm((prev) => ({ ...prev, idMerchant: value }));
                              setCreateUserErrors((prev) => ({ ...prev, idMerchant: getMerchantIdError(value) }));
                            }}
                            disabled={isLoadingMerchants}
                          >
                            <SelectTrigger id="create-user-merchant" className="bg-background">
                              <SelectValue
                                placeholder={
                                  isLoadingMerchants
                                    ? t('agents.placeholders.loadingMerchants')
                                    : t('agents.placeholders.merchant')
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {merchants.length === 0 ? (
                                <SelectItem value="empty" disabled>
                                  {t('agents.emptyMerchants')}
                                </SelectItem>
                              ) : (
                                merchants.map((merchant) => (
                                  <SelectItem key={merchant.id} value={String(merchant.id)}>
                                    {merchant.id} - {merchant.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {createUserErrors.idMerchant && (
                            <p className="text-sm text-destructive">{createUserErrors.idMerchant}</p>
                          )}
                        </div>
                      )}
                    </DialogBody>
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setCreateUserDialogOpen(false)}
                        disabled={isCreatingUser}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        className="w-full bg-primary text-white hover:bg-primary/90 active:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        onClick={handleCreateUser}
                        disabled={isCreatingUser || isCreateUserSubmitDisabled}
                      >
                        {isCreatingUser ? t('common.saving') : t('common.add')}
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
          <div className="relative overflow-x-auto sm:rounded-md sm:border">
            <Table style={{ minWidth: calculatedMinTableWidth }}>
              <TableHeader>
                <TableRow>
                  {visibleColumnConfigs.length === 0 ? (
                    <TableHead className="whitespace-nowrap">{t('agents.table.noColumns')}</TableHead>
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

                {!isLoading && isEmpty && (
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
                          <div className="text-base font-medium text-foreground">{t('agents.empty.title')}</div>
                          <div>{t('agents.empty.description')}</div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  agents.map((agent) => (
                    <TableRow key={agent.id}>
                      {visibleColumnConfigs.map((column) => (
                        <TableCell
                          key={column.id}
                          data-label={column.label}
                          className={column.cellClassName ?? 'whitespace-nowrap'}
                        >
                          {column.render(agent)}
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
                {t('agents.total').replace('{count}', String(totalItems ?? agents.length))}
              </div>
            </div>

            {agents.length > 0 && (
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

      <Dialog
        open={editUserDialogOpen}
        onOpenChange={(open) => {
          setEditUserDialogOpen(open);
          if (!open) {
            resetEditUserForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('agents.edit.title')}</DialogTitle>
            <DialogDescription>{t('agents.edit.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {isFetchingUserDetail ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{t('agents.edit.loading')}</div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="edit-user-name" className="text-sm font-medium text-muted-foreground">
                    {t('agents.fields.name')}
                  </Label>
                  <Input
                    id="edit-user-name"
                    value={editUserForm.name}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditUserForm((prev) => ({ ...prev, name: value }));
                      setEditUserErrors((prev) => ({ ...prev, name: getAgentNameError(value) }));
                    }}
                    placeholder={t('agents.placeholders.name')}
                    disabled={isUpdatingUser}
                  />
                  {editUserErrors.name && <p className="text-sm text-destructive">{editUserErrors.name}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-user-email" className="text-sm font-medium text-muted-foreground">
                    {t('agents.fields.email')}
                  </Label>
                  <Input id="edit-user-email" value={editUserForm.email} disabled readOnly className="bg-muted" />
                  {editUserErrors.email && <p className="text-sm text-destructive">{editUserErrors.email}</p>}
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">{t('agents.fields.role')}</Label>
                  <Input
                    value={
                      editUserForm.role === 'merchant'
                        ? t('agents.roles.merchant')
                        : editUserForm.role === 'agent'
                          ? t('agents.roles.agent')
                          : '-'
                    }
                    disabled
                    readOnly
                    className="bg-muted capitalize"
                  />
                </div>

                {editUserForm.role === 'merchant' && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="edit-user-merchant" className="text-sm font-medium text-muted-foreground">
                        {t('agents.fields.merchantId')}
                      </Label>
                      <Input
                        id="edit-user-merchant"
                        inputMode="numeric"
                        value={editUserForm.idMerchant}
                        onChange={(event) => {
                          const value = event.target.value;
                          setEditUserForm((prev) => ({ ...prev, idMerchant: value }));
                          setEditUserErrors((prev) => ({ ...prev, idMerchant: getMerchantIdError(value) }));
                        }}
                        placeholder={t('agents.placeholders.merchantId')}
                        disabled={isUpdatingUser}
                      />
                      {editUserErrors.idMerchant && (
                        <p className="text-sm text-destructive">{editUserErrors.idMerchant}</p>
                      )}
                    </div>
                  </>
                )}

                {editUserForm.role === 'agent' && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="edit-user-fee-percentage" className="text-sm font-medium text-muted-foreground">
                        {t('agents.fields.feePercentage')}
                      </Label>
                      <Input
                        id="edit-user-fee-percentage"
                        inputMode="decimal"
                        value={editUserForm.feePercentage}
                        onChange={(event) => {
                          const value = event.target.value;
                          setEditUserForm((prev) => ({ ...prev, feePercentage: value }));
                          setEditUserErrors((prev) => ({
                            ...prev,
                            feePercentage: getFeeError(value, t('agents.fields.feePercentage')),
                          }));
                        }}
                        placeholder={t('agents.placeholders.feePercentage')}
                        disabled={isUpdatingUser}
                      />
                      {editUserErrors.feePercentage && (
                        <p className="text-sm text-destructive">{editUserErrors.feePercentage}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="edit-user-fee-fixed" className="text-sm font-medium text-muted-foreground">
                        {t('agents.fields.feeFixed')}
                      </Label>
                      <Input
                        id="edit-user-fee-fixed"
                        inputMode="decimal"
                        value={editUserForm.feeFixed}
                        onChange={(event) => {
                          const value = event.target.value;
                          setEditUserForm((prev) => ({ ...prev, feeFixed: value }));
                          setEditUserErrors((prev) => ({
                            ...prev,
                            feeFixed: getFeeError(value, t('agents.fields.feeFixed')),
                          }));
                        }}
                        placeholder={t('agents.placeholders.feeFixed')}
                        disabled={isUpdatingUser}
                      />
                      {editUserErrors.feeFixed && (
                        <p className="text-sm text-destructive">{editUserErrors.feeFixed}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="edit-user-biaya-payout" className="text-sm font-medium text-muted-foreground">
                        {t('agents.fields.biayaPayout')}
                      </Label>
                      <Input
                        id="edit-user-biaya-payout"
                        inputMode="decimal"
                        value={editUserForm.biayaPayout}
                        onChange={(event) => {
                          const value = event.target.value;
                          setEditUserForm((prev) => ({ ...prev, biayaPayout: value }));
                          setEditUserErrors((prev) => ({
                            ...prev,
                            biayaPayout: getFeeError(value, t('agents.fields.biayaPayout')),
                          }));
                        }}
                        placeholder={t('agents.placeholders.biayaPayout')}
                        disabled={isUpdatingUser}
                      />
                      {editUserErrors.biayaPayout && (
                        <p className="text-sm text-destructive">{editUserErrors.biayaPayout}</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setEditUserDialogOpen(false);
                resetEditUserForm();
              }}
              disabled={isUpdatingUser}
            >
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={handleUpdateUser}
              disabled={isUpdatingUser || isFetchingUserDetail || isEditUserSubmitDisabled}
            >
              {isUpdatingUser ? t('common.saving') : t('agents.edit.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
