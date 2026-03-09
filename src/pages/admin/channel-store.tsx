import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Inbox, Plus, RefreshCcw, SlidersHorizontal } from 'lucide-react';
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
import { ApiAuthError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/language-provider';

type ChannelStoreStatus = 'active' | 'inactive';

interface ChannelOption {
  id: number;
  name: string;
}

interface ChannelStoreItem {
  id: number;
  idChannel: number;
  channelName?: string;
  storeId?: string;
  limitDaily?: number;
  status?: ChannelStoreStatus;
  created_at?: string;
  updated_at?: string | null;
}

interface ChannelStoreListResponse {
  status: boolean;
  data?: ChannelStoreItem[];
}

interface ChannelStoreDetailResponse {
  status: boolean;
  data?: ChannelStoreItem;
}

interface ChannelOptionsResponse {
  status: boolean;
  data?: ChannelOption[];
}

interface ApiMessageResponse {
  status: boolean;
  message?: string;
}

const errorToastStyle = {
  border: '2px solid #fda4af',
  background: '#fff1f2',
  color: '#f43f5e',
  boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
  padding: '0.5rem',
} as const;

const formatCurrency = (value?: number) =>
  typeof value === 'number' ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

const LIMIT_PATTERN = /^\d+$/;

export function AdminChannelStorePage() {
  const { t, locale } = useLanguage();
  const [storeList, setStoreList] = useState<ChannelStoreItem[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
  const [isLoadingStoreDetail, setIsLoadingStoreDetail] = useState(false);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    storeId?: string;
    idChannel?: string;
    limitDaily?: string;
    status?: string;
  }>({});
  const [createForm, setCreateForm] = useState({
    idChannel: '',
    storeId: '',
    limitDaily: '0',
    status: 'active' as ChannelStoreStatus,
  });
  const [editForm, setEditForm] = useState({
    idChannel: '',
    storeId: '',
    limitDaily: '0',
    status: 'active' as ChannelStoreStatus,
  });
  const [filters, setFilters] = useState({ idChannel: '', status: 'all' });
  const [filterInputs, setFilterInputs] = useState({ idChannel: '', status: 'all' });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);

  const sortedStores = useMemo(() => [...storeList].sort((a, b) => a.id - b.id), [storeList]);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.idChannel.trim()) count += 1;
    if (filters.status !== 'all') count += 1;
    return count;
  }, [filters.idChannel, filters.status]);

  const handleAuthError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiAuthError) {
        toast.error(t('auth.sessionExpired'), {
          duration: 1500,
          style: errorToastStyle,
        });
        return true;
      }

      return false;
    },
    [t],
  );

  const fetchChannels = useCallback(async () => {
    try {
      setIsLoadingChannels(true);
      const response = await apiFetch<ChannelOptionsResponse>('channel', { method: 'GET' });
      const fetchedChannels = response.data ?? [];
      setChannels(fetchedChannels);
      setCreateForm((prev) => {
        if (prev.idChannel || fetchedChannels.length === 0) {
          return prev;
        }
        return {
          ...prev,
          idChannel: String(fetchedChannels[0].id),
        };
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelStore.toast.loadChannelsError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingChannels(false);
    }
  }, [handleAuthError]);

  const fetchStoreList = useCallback(
    async (
      abortController?: AbortController,
      overrideFilters?: {
        idChannel: string;
        status: string;
      },
    ) => {
      const controller = abortController ?? new AbortController();

      const startTime = Date.now();
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        const activeFilters = overrideFilters ?? filters;
        const trimmedIdChannel = activeFilters.idChannel.trim();
        if (trimmedIdChannel) params.set('idChannel', trimmedIdChannel);
        if (activeFilters.status !== 'all') params.set('status', activeFilters.status);
        const queryString = params.toString();

        const response = await apiFetch<ChannelStoreListResponse>(
          `channel-store${queryString ? `?${queryString}` : ''}`,
          {
            method: 'GET',
            signal: controller.signal,
          },
        );

        setStoreList(response.data ?? []);
      } catch (error) {
        if (handleAuthError(error)) return;
        toast.error(error instanceof Error ? error.message : t('channelStore.toast.loadError'), {
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
    },
    [filters.idChannel, filters.status, handleAuthError],
  );

  useEffect(() => {
    const abortController = new AbortController();
    void fetchStoreList(abortController);
    void fetchChannels();

    return () => abortController.abort();
  }, [fetchStoreList, fetchChannels]);

  const resetForms = () => {
    const defaultChannel = channels[0];
    setCreateForm({
      idChannel: defaultChannel ? String(defaultChannel.id) : '',
      storeId: '',
      limitDaily: '0',
      status: 'active',
    });
    setEditForm({ idChannel: '', storeId: '', limitDaily: '0', status: 'active' });
    setFormErrors({});
  };

  const resetFilters = () => {
    setFilters({ idChannel: '', status: 'all' });
    setFilterInputs({ idChannel: '', status: 'all' });
  };

  const handleSearch = () => {
    const nextFilters = { ...filterInputs };
    setFilters(nextFilters);
    void fetchStoreList(undefined, nextFilters);
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

  const getChannelError = (idChannel: string) => {
    if (!idChannel.trim()) {
      return 'Channel is required.';
    }
    return undefined;
  };

  const getStoreIdError = (storeId: string) => {
    if (!storeId.trim()) {
      return 'Store ID is required.';
    }
    return undefined;
  };

  const getLimitDailyError = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return 'Limit daily is required.';
    }
    if (!LIMIT_PATTERN.test(trimmedValue)) {
      return 'Limit daily must be a number.';
    }
    return undefined;
  };

  const validateForm = (payload: {
    idChannel: string;
    storeId: string;
    limitDaily: string;
    status?: ChannelStoreStatus;
  }) => {
    const errors: {
      idChannel?: string;
      storeId?: string;
      limitDaily?: string;
      status?: string;
    } = {};

    errors.idChannel = getChannelError(payload.idChannel);
    errors.storeId = getStoreIdError(payload.storeId);
    errors.limitDaily = getLimitDailyError(payload.limitDaily);
    if (payload.status && !['active', 'inactive'].includes(payload.status)) {
      errors.status = 'Invalid status selected.';
    }

    setFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const validateEditForm = (payload: { limitDaily: string; status?: ChannelStoreStatus }) => {
    const errors: {
      limitDaily?: string;
      status?: string;
    } = {};

    errors.limitDaily = getLimitDailyError(payload.limitDaily);
    if (payload.status && !['active', 'inactive'].includes(payload.status)) {
      errors.status = 'Invalid status selected.';
    }

    setFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const isCreateSubmitDisabled = useMemo(() => {
    const channelError = getChannelError(createForm.idChannel);
    const storeIdError = getStoreIdError(createForm.storeId);
    const limitDailyError = getLimitDailyError(createForm.limitDaily);
    return Boolean(channelError || storeIdError || limitDailyError);
  }, [createForm.idChannel, createForm.limitDaily, createForm.storeId]);

  const isEditSubmitDisabled = useMemo(() => {
    const limitDailyError = getLimitDailyError(editForm.limitDaily);
    return Boolean(limitDailyError);
  }, [editForm.limitDaily]);

  const handleCreateStore = async () => {
    if (!validateForm(createForm)) return;

    setIsSavingStore(true);
    try {
      const response = await apiFetch<ApiMessageResponse>('channel-store/add', {
        method: 'POST',
        body: {
          idChannel: Number(createForm.idChannel),
          storeId: createForm.storeId.trim(),
          limitDaily: Number(createForm.limitDaily),
          status: createForm.status,
        },
      });

      const successMessage =
        locale === 'id'
          ? t('channelStore.toast.createSuccess')
          : response.message ?? t('channelStore.toast.createSuccess');
      toast.success(successMessage, {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      setCreateDialogOpen(false);
      resetForms();
      await fetchStoreList();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelStore.toast.createError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleOpenEditDialog = async (storeId: number) => {
    setEditingStoreId(storeId);
    setEditDialogOpen(true);
    setIsLoadingStoreDetail(true);
    setFormErrors({});

    try {
      const response = await apiFetch<ChannelStoreDetailResponse>(`channel-store/${storeId}`);
      if (response.data) {
        setEditForm({
          idChannel: String(response.data.idChannel ?? ''),
          storeId: response.data.storeId ?? '',
          limitDaily: response.data.limitDaily?.toString() ?? '0',
          status: (response.data.status as ChannelStoreStatus) ?? 'active',
        });
      }
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelStore.toast.detailError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingStoreDetail(false);
    }
  };

  const handleUpdateStore = async () => {
    if (!editingStoreId) return;
    if (!validateEditForm(editForm)) return;

    setIsSavingStore(true);
    try {
      const response = await apiFetch<ApiMessageResponse>(`channel-store/update/${editingStoreId}`, {
        method: 'POST',
        body: {
          status: editForm.status,
          limitDaily: Number(editForm.limitDaily),
        },
      });

      const successMessage =
        locale === 'id'
          ? t('channelStore.toast.updateSuccess')
          : response.message ?? t('channelStore.toast.updateSuccess');
      toast.success(successMessage, {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      setEditDialogOpen(false);
      setEditingStoreId(null);
      resetForms();
      await fetchStoreList();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelStore.toast.updateError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    const MIN_SPIN_DURATION_MS = 500;

    setIsRefreshing(true);
    const start = Date.now();

    try {
      await fetchStoreList();
    } finally {
      const elapsed = Date.now() - start;

      if (elapsed < MIN_SPIN_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_DURATION_MS - elapsed));
      }

      setIsRefreshing(false);
    }
  }, [fetchStoreList]);

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('channelStore.pageTitle')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('channelStore.cardTitle')}</CardTitle>
            <CardDescription>{t('channelStore.cardDescription')}</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
              aria-label={t('common.refresh')}
            >
              <RefreshCcw className={`h-4 w-4 transition ${isRefreshing ? 'animate-spin' : ''}`} />
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
                    <Label htmlFor="channel-store-id-channel">{t('channelStore.filters.channelId')}</Label>
                    <Input
                      id="channel-store-id-channel"
                      placeholder="e.g. 3"
                      inputMode="numeric"
                      value={filterInputs.idChannel}
                      onChange={(event) =>
                        setFilterInputs((prev) => ({ ...prev, idChannel: event.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t('channelStore.filters.status')}</Label>
                    <Select
                      value={filterInputs.status}
                      onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={t('channelStore.filters.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('channelStore.filters.statusAll')}</SelectItem>
                        <SelectItem value="active">{t('channelStore.filters.statusActive')}</SelectItem>
                        <SelectItem value="inactive">{t('channelStore.filters.statusInactive')}</SelectItem>
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
            <Dialog
              open={createDialogOpen}
              onOpenChange={(open) => {
                setCreateDialogOpen(open);
                if (!open) resetForms();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={resetForms}
                  className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 md:self-stretch"
                >
                  <Plus className="h-4 w-4" />
                  {t('common.add')}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-lg sm:max-w-[520px] sm:rounded-lg">
                <DialogHeader>
                  <DialogTitle>{t('channelStore.create.title')}</DialogTitle>
                  <DialogDescription>{t('channelStore.create.description')}</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('channelStore.form.channel')}</Label>
                    <Select
                      value={createForm.idChannel}
                      onValueChange={(value) => {
                        setCreateForm((state) => ({ ...state, idChannel: value }));
                        setFormErrors((prev) => ({ ...prev, idChannel: getChannelError(value) }));
                      }}
                      disabled={isLoadingChannels}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingChannels
                              ? t('channelStore.form.channelLoading')
                              : t('channelStore.form.channelPlaceholder')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((channel) => (
                          <SelectItem key={channel.id} value={String(channel.id)}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.idChannel && <p className="text-sm text-destructive">{formErrors.idChannel}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel-store-store-id">{t('channelStore.form.storeId')}</Label>
                    <Input
                      id="channel-store-store-id"
                      placeholder="LAVISKA1"
                      value={createForm.storeId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((state) => ({ ...state, storeId: value }));
                        setFormErrors((prev) => ({ ...prev, storeId: getStoreIdError(value) }));
                      }}
                    />
                    {formErrors.storeId && <p className="text-sm text-destructive">{formErrors.storeId}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel-store-limit">{t('channelStore.form.limitDaily')}</Label>
                    <Input
                      id="channel-store-limit"
                      placeholder="30000000"
                      value={createForm.limitDaily}
                      inputMode="numeric"
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((state) => ({ ...state, limitDaily: value }));
                        setFormErrors((prev) => ({ ...prev, limitDaily: getLimitDailyError(value) }));
                      }}
                    />
                    {formErrors.limitDaily && <p className="text-sm text-destructive">{formErrors.limitDaily}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('channelStore.form.status')}</Label>
                    <Select
                      value={createForm.status}
                      onValueChange={(value) =>
                        setCreateForm((state) => ({ ...state, status: value as ChannelStoreStatus }))
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={t('channelStore.form.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('channelStore.form.statusActive')}</SelectItem>
                        <SelectItem value="inactive">{t('channelStore.form.statusInactive')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    onClick={() => void handleCreateStore()}
                    disabled={isSavingStore || isCreateSubmitDisabled}
                  >
                    {isSavingStore ? t('common.saving') : t('common.save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                resetFilters();
                void fetchStoreList(undefined, { idChannel: '', status: 'all' });
              }}
              className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
            >
              {t('common.reset')}
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="flex flex-col gap-4 px-5 py-4 md:gap-5 md:px-6">
          <div className="relative overflow-x-auto sm:rounded-md sm:border sm:border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">{t('channelStore.table.id')}</TableHead>
                  <TableHead className="w-[120px]">{t('channelStore.table.channelId')}</TableHead>
                  <TableHead>{t('channelStore.table.channel')}</TableHead>
                  <TableHead>{t('channelStore.table.storeId')}</TableHead>
                  <TableHead>{t('channelStore.table.limitDaily')}</TableHead>
                  <TableHead>{t('channelStore.table.status')}</TableHead>
                  <TableHead className="w-[180px]">{t('channelStore.table.createdAt')}</TableHead>
                  <TableHead className="w-[180px]">{t('channelStore.table.updatedAt')}</TableHead>
                  <TableHead className="w-[120px] text-right">{t('channelStore.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 10 }).map((_, rowIndex) => (
                      <TableRow key={`skeleton-${rowIndex}`}>
                        <TableCell data-label={t('channelStore.table.id')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.channelId')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.channel')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.storeId')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.limitDaily')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.status')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.createdAt')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.updatedAt')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelStore.table.actions')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : sortedStores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      <div className="flex flex-col items-center gap-2">
                        <Inbox className="h-6 w-6" />
                        <span>{t('channelStore.empty.title')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedStores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell data-label={t('channelStore.table.id')}>{store.id}</TableCell>
                      <TableCell data-label={t('channelStore.table.channelId')}>
                        {store.idChannel ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelStore.table.channel')} className="font-medium">
                        {store.channelName ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelStore.table.storeId')}>
                        {store.storeId ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelStore.table.limitDaily')}>
                        {formatCurrency(store.limitDaily)}
                      </TableCell>
                      <TableCell data-label={t('channelStore.table.status')}>
                        {store.status ? (
                          <Badge
                            variant={store.status === 'active' ? 'default' : 'secondary'}
                            className={cn(
                              'w-[86px] justify-center capitalize',
                              store.status === 'active' &&
                                'rounded-md px-2 py-0.5 text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                              store.status === 'inactive' && 'rounded-md bg-rose-400 px-2 py-0.5 text-white',
                            )}
                          >
                            {store.status}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell
                        data-label={t('channelStore.table.createdAt')}
                        className="text-sm text-muted-foreground"
                      >
                        {store.created_at ?? '-'}
                      </TableCell>
                      <TableCell
                        data-label={t('channelStore.table.updatedAt')}
                        className="text-sm text-muted-foreground"
                      >
                        {store.updated_at ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelStore.table.actions')} className="text-right">
                        <Button
                          size="sm"
                          onClick={() => void handleOpenEditDialog(store.id)}
                          disabled={isSavingStore}
                          className="bg-primary text-white hover:bg-primary/90"
                        >
                          {t('common.edit')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingStoreId(null);
            setFormErrors({});
          }
        }}
      >
        <DialogContent className="rounded-lg sm:max-w-[520px] sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>{t('channelStore.edit.title')}</DialogTitle>
            <DialogDescription>{t('channelStore.edit.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {isLoadingStoreDetail ? (
              <p className="text-muted-foreground">{t('channelStore.edit.loading')}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t('channelStore.form.channel')}</Label>
                  <Select
                    value={editForm.idChannel}
                    onValueChange={(value) => setEditForm((state) => ({ ...state, idChannel: value }))}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('channelStore.form.channelPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={String(channel.id)}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-channel-store-store-id">{t('channelStore.form.storeId')}</Label>
                  <Input
                    id="edit-channel-store-store-id"
                    placeholder="Store ID"
                    value={editForm.storeId}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-channel-store-limit">{t('channelStore.form.limitDaily')}</Label>
                  <Input
                    id="edit-channel-store-limit"
                    placeholder="30000000"
                    value={editForm.limitDaily}
                    inputMode="numeric"
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditForm((state) => ({ ...state, limitDaily: value }));
                      setFormErrors((prev) => ({ ...prev, limitDaily: getLimitDailyError(value) }));
                    }}
                  />
                  {formErrors.limitDaily && <p className="text-sm text-destructive">{formErrors.limitDaily}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('channelStore.form.status')}</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm((state) => ({ ...state, status: value as ChannelStoreStatus }))
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={t('channelStore.form.statusPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('channelStore.form.statusActive')}</SelectItem>
                      <SelectItem value="inactive">{t('channelStore.form.statusInactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.status && <p className="text-sm text-destructive">{formErrors.status}</p>}
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={() => void handleUpdateStore()}
              disabled={isSavingStore || isLoadingStoreDetail || isEditSubmitDisabled}
            >
              {isSavingStore ? t('common.saving') : t('channelStore.edit.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminChannelStorePage;
