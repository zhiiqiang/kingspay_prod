import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Inbox, Loader2, Plus, RefreshCcw, SlidersHorizontal } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiAuthError, ApiResponseError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/language-provider';

interface ChannelDisbursementItem {
  id: number;
  name: string;
  status: 'active' | 'inactive' | string;
  feePercentage: number;
  feeFixed: number;
  created_at?: string | null;
  updated_at?: string | null;
}

type ChannelConfig = Record<string, string>;
type AvailableChannelConfig = ChannelConfig | null;

interface ChannelDisbursementListResponse {
  status: boolean;
  message?: string;
  data: ChannelDisbursementItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

interface ChannelDisbursementDetailResponse {
  status: boolean;
  message?: string;
  data: ChannelDisbursementItem & {
    configJson?: ChannelConfig;
  };
  availableConfig?: ChannelConfig;
}

interface ApiMessageResponse {
  status: boolean;
  message?: string;
}

interface ChannelDisbursementConfigErrorResponse {
  availableConfig?: ChannelConfig;
}

const errorToastStyle = {
  border: '2px solid #fda4af',
  background: '#fff1f2',
  color: '#f43f5e',
  boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
  padding: '0.5rem',
} as const;

const STATUS_OPTIONS = ['all', 'active', 'inactive'] as const;

const NAME_MAX_LENGTH = 60;

export function AdminChannelDisbursementPage() {
  const { t } = useLanguage();
  const [channels, setChannels] = useState<ChannelDisbursementItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ name: '', status: 'all' });
  const [filterInputs, setFilterInputs] = useState({ name: '', status: 'all' });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    status: 'active',
    feePercentage: '',
    feeFixed: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    status: 'active',
    feePercentage: '',
    feeFixed: '',
    configJson: {} as ChannelConfig,
  });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    status?: string;
    feePercentage?: string;
    feeFixed?: string;
    configJson?: Record<string, string>;
  }>({});
  const [availableConfig, setAvailableConfig] = useState<AvailableChannelConfig>({});

  const pageOptions = useMemo(() => {
    const calculatedPages = Math.max(1, totalPages || Math.ceil(totalItems / limit) || 1);
    return Array.from({ length: calculatedPages }, (_, index) => index + 1);
  }, [limit, totalItems, totalPages]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.name.trim()) count += 1;
    if (filters.status !== 'all') count += 1;
    return count;
  }, [filters.name, filters.status]);

  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof ApiAuthError) {
      toast.error(t('auth.sessionExpired'), {
        duration: 1500,
        style: errorToastStyle,
      });
      return true;
    }

    return false;
  }, []);

  const fetchChannels = useCallback(
    async (
      abortController?: AbortController,
      overrideFilters?: {
        name: string;
        status: string;
      },
    ) => {
      const controller = abortController ?? new AbortController();

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        const activeFilters = overrideFilters ?? filters;
        const trimmedName = activeFilters.name.trim();
        if (trimmedName) params.set('name', trimmedName);
        if (activeFilters.status !== 'all') params.set('status', activeFilters.status);

        const response = await apiFetch<ChannelDisbursementListResponse>(
          `channel-disbursement?${params.toString()}`,
          {
            method: 'GET',
            signal: controller.signal,
          },
        );

        setChannels(response.data ?? []);
        setTotalItems(response.pagination?.total ?? response.data?.length ?? 0);
        setTotalPages(response.pagination?.totalPages ?? 1);
        if (response.pagination?.page) setPage(response.pagination.page);
      } catch (error) {
        if (handleAuthError(error)) return;
        toast.error(error instanceof Error ? error.message : t('channelDisbursement.toast.loadError'), {
          duration: 1500,
          style: errorToastStyle,
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters.name, filters.status, handleAuthError, limit, page],
  );

  useEffect(() => {
    const abortController = new AbortController();
    void fetchChannels(abortController);
    return () => abortController.abort();
  }, [fetchChannels]);

  const resetForms = () => {
    setCreateForm({ name: '', status: 'active', feePercentage: '', feeFixed: '' });
    setEditForm({ name: '', status: 'active', feePercentage: '', feeFixed: '', configJson: {} });
    setFormErrors({});
    setAvailableConfig({});
  };

  const resetFilters = () => {
    setFilters({ name: '', status: 'all' });
    setFilterInputs({ name: '', status: 'all' });
    setPage(1);
  };

  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((message, [placeholder, value]) => {
      return message.replace(`{${placeholder}}`, String(value));
    }, t(key));

  const getNameError = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return t('channelDisbursement.validation.nameRequired');
    if (trimmedName.length > NAME_MAX_LENGTH) {
      return formatMessage('channelDisbursement.validation.nameMax', { count: NAME_MAX_LENGTH });
    }
    return undefined;
  };

  const parseFeeValue = (value: string) => {
    if (!value.trim()) return NaN;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? NaN : parsed;
  };

  const getFeeError = (value: string, label: string) => {
    const parsed = parseFeeValue(value);
    if (Number.isNaN(parsed)) {
      return formatMessage('channelDisbursement.validation.feeRequired', { label });
    }
    if (parsed < 0) {
      return formatMessage('channelDisbursement.validation.feeMin', { label });
    }
    return undefined;
  };

  const getConfigError = (value: string, label: string) => {
    if (!value.trim()) {
      return formatMessage('channelDisbursement.validation.fieldRequired', { label });
    }
    return undefined;
  };

  const validateCreateForm = (form: { name: string; status: string; feePercentage: string; feeFixed: string }) => {
    const errors: { name?: string; status?: string; feePercentage?: string; feeFixed?: string } = {};
    errors.name = getNameError(form.name);
    errors.feePercentage = getFeeError(form.feePercentage, t('channelDisbursement.fields.feePercentage'));
    errors.feeFixed = getFeeError(form.feeFixed, t('channelDisbursement.fields.feeFixed'));
    if (!form.status) {
      errors.status = t('channelDisbursement.validation.statusRequired');
    }
    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const validateEditForm = (form: {
    name: string;
    status: string;
    feeFixed: string;
    configJson: ChannelConfig;
  }) => {
    const errors: {
      name?: string;
      status?: string;
      feeFixed?: string;
      configJson?: Record<string, string>;
    } = {};

    errors.name = getNameError(form.name);
    errors.feeFixed = getFeeError(form.feeFixed, t('channelDisbursement.fields.feeFixed'));
    if (!form.status) {
      errors.status = t('channelDisbursement.validation.statusRequired');
    }
    if (availableConfig && Object.keys(availableConfig).length > 0) {
      const configErrors = Object.keys(availableConfig).reduce<Record<string, string>>((accumulator, key) => {
        const error = getConfigError(form.configJson[key] ?? '', key);
        if (error) {
          accumulator[key] = error;
        }
        return accumulator;
      }, {});
      if (Object.keys(configErrors).length > 0) {
        errors.configJson = configErrors;
      }
    }

    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const isCreateSubmitDisabled = useMemo(() => {
    return Boolean(
      getNameError(createForm.name) ||
        getFeeError(createForm.feePercentage, t('channelDisbursement.fields.feePercentage')) ||
        getFeeError(createForm.feeFixed, t('channelDisbursement.fields.feeFixed')),
    );
  }, [createForm.feeFixed, createForm.feePercentage, createForm.name]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchChannels();
  };

  const handleSearch = () => {
    const nextFilters = {
      name: filterInputs.name.trim(),
      status: filterInputs.status,
    };
    setFilters(nextFilters);
    setPage(1);
    void fetchChannels(undefined, nextFilters);
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

  const handleCreateChannel = async () => {
    if (!validateCreateForm(createForm)) return;

    setCreateDialogOpen(false);
    setIsSaving(true);
    try {
      await apiFetch<ApiMessageResponse>('channel-disbursement/add', {
        method: 'POST',
        body: {
          name: createForm.name.trim(),
          status: createForm.status,
          feePercentage: parseFeeValue(createForm.feePercentage),
          feeFixed: parseFeeValue(createForm.feeFixed),
        },
      });
      toast.success(t('channelDisbursement.toast.createSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      resetForms();
      void fetchChannels();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelDisbursement.toast.createError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = async (channelId: number) => {
    setEditingChannelId(channelId);
    setEditDialogOpen(true);
    setIsLoadingDetail(true);
    setFormErrors({});
    try {
      const response = await apiFetch<ChannelDisbursementDetailResponse>(`channel-disbursement/${channelId}`, {
        method: 'GET',
      });
      const availableConfigKeys = Object.keys(response.availableConfig ?? response.data.configJson ?? {});
      const normalizedConfig = availableConfigKeys.reduce<ChannelConfig>((accumulator, key) => {
        const value = response.data.configJson?.[key];
        accumulator[key] = value === null || value === undefined ? '' : String(value);
        return accumulator;
      }, {});
      setEditForm({
        name: response.data.name ?? '',
        status: response.data.status ?? 'active',
        feePercentage: String(response.data.feePercentage ?? ''),
        feeFixed: String(response.data.feeFixed ?? ''),
        configJson: normalizedConfig,
      });
      setAvailableConfig(response.availableConfig === null ? null : (response.availableConfig ?? {}));
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelDisbursement.toast.detailError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdateChannel = async () => {
    if (!editingChannelId) return;
    if (!validateEditForm(editForm)) return;

    setEditDialogOpen(false);
    setIsSaving(true);
    try {
      const configKeys = availableConfig ? Object.keys(availableConfig) : [];
      const configJson = configKeys.reduce<ChannelConfig>((accumulator, key) => {
        accumulator[key] = editForm.configJson[key] ?? '';
        return accumulator;
      }, {});
      await apiFetch<ApiMessageResponse>(`channel-disbursement/update/${editingChannelId}`, {
        method: 'POST',
        body: {
          name: editForm.name.trim(),
          status: editForm.status,
          feePercentage: parseFeeValue(editForm.feePercentage),
          feeFixed: parseFeeValue(editForm.feeFixed),
          configJson,
        },
      });
      toast.success(t('channelDisbursement.toast.updateSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      resetForms();
      void fetchChannels();
    } catch (error) {
      if (handleAuthError(error)) return;
      if (error instanceof ApiResponseError) {
        const responseBody = error.responseBody as ChannelDisbursementConfigErrorResponse | null;
        if (responseBody?.availableConfig !== undefined) {
          setAvailableConfig(responseBody.availableConfig);
        }
      }
      toast.error(error instanceof Error ? error.message : t('channelDisbursement.toast.updateError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogChange = (open: boolean, type: 'create' | 'edit') => {
    if (!open) {
      resetForms();
      if (type === 'edit') setEditingChannelId(null);
    }
    if (type === 'create') setCreateDialogOpen(open);
    if (type === 'edit') setEditDialogOpen(open);
  };

  return (
    <div className="container space-y-6 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('channelDisbursement.pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('channelDisbursement.pageDescription')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('channelDisbursement.cardTitle')}</CardTitle>
            <CardDescription>{t('channelDisbursement.cardDescription')}</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
              onClick={handleRefresh}
              aria-label={t('common.refresh')}
            >
              <RefreshCcw className={cn('h-4 w-4 transition', isRefreshing && 'animate-spin')} aria-hidden />
            </Button>
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
                    <span className="text-sm font-medium text-muted-foreground">
                      {t('channelDisbursement.filters.name')}
                    </span>
                    <Input
                      value={filterInputs.name}
                      onChange={(event) => setFilterInputs((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder={t('channelDisbursement.filters.namePlaceholder')}
                      className="md:w-[220px]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t('channelDisbursement.filters.status')}
                    </span>
                    <Select
                      value={filterInputs.status}
                      onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="md:w-[180px]">
                        <SelectValue placeholder={t('channelDisbursement.filters.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`channelDisbursement.status.${option}`)}
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
            <Dialog open={createDialogOpen} onOpenChange={(open) => handleDialogChange(open, 'create')}>
              <DialogTrigger asChild>
                <Button className="w-auto bg-primary text-white hover:bg-primary/90 active:bg-primary/80 md:self-stretch">
                  <Plus className="size-4" />
                  {t('common.add')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('channelDisbursement.create.title')}</DialogTitle>
                  <DialogDescription>{t('channelDisbursement.create.description')}</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="channel-name">{t('channelDisbursement.fields.name')}</Label>
                  <Input
                    id="channel-name"
                    value={createForm.name}
                    maxLength={NAME_MAX_LENGTH}
                    onChange={(event) => {
                      const value = event.target.value;
                        setCreateForm((prev) => ({ ...prev, name: value }));
                        setFormErrors((prev) => ({ ...prev, name: getNameError(value) }));
                      }}
                      placeholder={t('channelDisbursement.fields.namePlaceholder')}
                    />
                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel-fee-percentage">{t('channelDisbursement.fields.feePercentage')}</Label>
                    <Input
                      id="channel-fee-percentage"
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.feePercentage}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((prev) => ({ ...prev, feePercentage: value }));
                        setFormErrors((prev) => ({
                          ...prev,
                          feePercentage: getFeeError(value, t('channelDisbursement.fields.feePercentage')),
                        }));
                      }}
                      placeholder={t('channelDisbursement.fields.feePercentagePlaceholder')}
                    />
                    {formErrors.feePercentage && (
                      <p className="text-sm text-destructive">{formErrors.feePercentage}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel-fee-fixed">{t('channelDisbursement.fields.feeFixed')}</Label>
                    <Input
                      id="channel-fee-fixed"
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.feeFixed}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((prev) => ({ ...prev, feeFixed: value }));
                        setFormErrors((prev) => ({
                          ...prev,
                          feeFixed: getFeeError(value, t('channelDisbursement.fields.feeFixed')),
                        }));
                      }}
                      placeholder={t('channelDisbursement.fields.feeFixedPlaceholder')}
                    />
                    {formErrors.feeFixed && <p className="text-sm text-destructive">{formErrors.feeFixed}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('channelDisbursement.fields.status')}</Label>
                    <Select
                      value={createForm.status}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('channelDisbursement.fields.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.filter((option) => option !== 'all').map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`channelDisbursement.status.${option}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.status && <p className="text-sm text-destructive">{formErrors.status}</p>}
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleDialogChange(false, 'create')}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateChannel}
                    disabled={isSaving || isCreateSubmitDisabled}
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    {isSaving ? 'Saving...' : 'Save channel'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                resetFilters();
                void fetchChannels(undefined, { name: '', status: 'all' });
              }}
              className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
            >
              {t('common.reset')}
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4">
          <div className="relative">
            <div className="overflow-x-auto sm:rounded-md sm:border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">{t('channelDisbursement.table.id')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('channelDisbursement.table.name')}</TableHead>
                    <TableHead className="w-[140px]">{t('channelDisbursement.table.status')}</TableHead>
                    <TableHead className="min-w-[150px]">{t('channelDisbursement.table.feePercentage')}</TableHead>
                    <TableHead className="min-w-[150px]">{t('channelDisbursement.table.feeFixed')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('channelDisbursement.table.createdAt')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('channelDisbursement.table.updatedAt')}</TableHead>
                    <TableHead className="w-[120px] text-right">{t('channelDisbursement.table.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 10 }).map((_, rowIndex) => (
                        <TableRow key={`skeleton-${rowIndex}`}>
                          <TableCell data-label={t('channelDisbursement.table.id')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('channelDisbursement.table.name')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('channelDisbursement.table.status')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('channelDisbursement.table.feePercentage')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('channelDisbursement.table.feeFixed')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('channelDisbursement.table.createdAt')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('channelDisbursement.table.updatedAt')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('channelDisbursement.table.action')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : channels.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                            <Inbox className="h-7 w-7" aria-hidden />
                          </div>
                          <div className="space-y-1">
                            <div className="text-base font-medium text-foreground">
                              {t('channelDisbursement.empty.title')}
                            </div>
                            <div>{t('channelDisbursement.empty.description')}</div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    channels.map((channel) => (
                      <TableRow key={channel.id}>
                        <TableCell data-label={t('channelDisbursement.table.id')} className="font-medium">
                          {channel.id}
                        </TableCell>
                        <TableCell data-label={t('channelDisbursement.table.name')}>{channel.name}</TableCell>
                        <TableCell data-label={t('channelDisbursement.table.status')}>
                          <Badge
                            variant={channel.status === 'active' ? 'default' : 'secondary'}
                            className={cn(
                              'w-[86px] justify-center capitalize',
                              channel.status === 'active' &&
                                'rounded-md px-2 py-0.5 text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                              channel.status === 'inactive' && 'rounded-md bg-rose-400 px-2 py-0.5 text-white',
                            )}
                          >
                            {channel.status}
                          </Badge>
                        </TableCell>
                        <TableCell data-label={t('channelDisbursement.table.feePercentage')}>
                          {channel.feePercentage ?? 0}
                        </TableCell>
                        <TableCell data-label={t('channelDisbursement.table.feeFixed')}>
                          {channel.feeFixed ?? 0}
                        </TableCell>
                        <TableCell data-label={t('channelDisbursement.table.createdAt')}>
                          {channel.created_at ?? '-'}
                        </TableCell>
                        <TableCell data-label={t('channelDisbursement.table.updatedAt')}>
                          {channel.updated_at ?? '-'}
                        </TableCell>
                        <TableCell data-label={t('channelDisbursement.table.action')} className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenEdit(channel.id)}
                            className="bg-primary text-white hover:bg-primary/90"
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Page</span>
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
                <span>Limit</span>
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
                        {option} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                {totalItems ?? channels.length} channels
              </div>
            </div>
            {channels.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
                  onClick={() => setPage((prev) => Math.min(totalPages || 1, prev + 1))}
                  disabled={(totalPages || 1) <= page}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={(open) => handleDialogChange(open, 'edit')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('channelDisbursement.edit.title')}</DialogTitle>
            <DialogDescription>{t('channelDisbursement.edit.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading details...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-channel-name">{t('channelDisbursement.fields.name')}</Label>
                  <Input
                    id="edit-channel-name"
                    value={editForm.name}
                    maxLength={NAME_MAX_LENGTH}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditForm((prev) => ({ ...prev, name: value }));
                      setFormErrors((prev) => ({ ...prev, name: getNameError(value) }));
                    }}
                  />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-fee-fixed">{t('channelDisbursement.fields.feeFixed')}</Label>
                  <Input
                    id="edit-fee-fixed"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.feeFixed}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditForm((prev) => ({ ...prev, feeFixed: value }));
                      setFormErrors((prev) => ({
                        ...prev,
                        feeFixed: getFeeError(value, t('channelDisbursement.fields.feeFixed')),
                      }));
                    }}
                  />
                  {formErrors.feeFixed && <p className="text-sm text-destructive">{formErrors.feeFixed}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('channelDisbursement.fields.status')}</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('channelDisbursement.fields.statusPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.filter((option) => option !== 'all').map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`channelDisbursement.status.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.status && <p className="text-sm text-destructive">{formErrors.status}</p>}
                </div>
                {Object.keys(availableConfig ?? {}).map((configKey) => (
                  <div key={configKey} className="space-y-2">
                    <Label htmlFor={`edit-channel-config-${configKey}`}>{configKey}</Label>
                    <Input
                      id={`edit-channel-config-${configKey}`}
                      value={editForm.configJson[configKey] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setEditForm((prev) => ({
                          ...prev,
                          configJson: {
                            ...prev.configJson,
                            [configKey]: value,
                          },
                        }));
                        setFormErrors((prev) => ({
                          ...prev,
                          configJson: {
                            ...(prev.configJson ?? {}),
                            [configKey]: getConfigError(value, configKey),
                          },
                        }));
                      }}
                    />
                    {formErrors.configJson?.[configKey] && (
                      <p className="text-sm text-destructive">{formErrors.configJson[configKey]}</p>
                    )}
                  </div>
                ))}
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false, 'edit')}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateChannel}
              disabled={isSaving || isLoadingDetail}
              className="bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving' : 'Save channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
