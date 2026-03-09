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

type ChannelProdukStatus = 'active' | 'inactive';

interface ChannelOption {
  id: number;
  name: string;
  jenis?: string;
}

interface ChannelProdukItem {
  id: number;
  idChannel: number;
  channelName?: string;
  produkName?: string;
  name?: string;
  jenis?: string;
  feePercentage?: number;
  feeFixed?: number;
  status?: ChannelProdukStatus;
  created_at?: string;
  updated_at?: string | null;
}

interface ChannelProdukListResponse {
  status: boolean;
  data?: ChannelProdukItem[];
}

interface ChannelProdukDetailResponse {
  status: boolean;
  data?: ChannelProdukItem;
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

const PRODUK_NAME_MIN_LENGTH = 3;
const PRODUK_NAME_MAX_LENGTH = 10;
const FEE_PATTERN = /^\d+(\.\d+)?$/;
const PRODUK_TYPES = ['VA', 'QRIS'] as const;

const formatPercent = (value?: number) =>
  typeof value === 'number' ? `${value.toFixed(2)}%` : '-';
const formatCurrency = (value?: number) =>
  typeof value === 'number' ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-';

export function AdminChannelProdukPage() {
  const { t, locale } = useLanguage();
  const [produkList, setProdukList] = useState<ChannelProdukItem[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProdukId, setEditingProdukId] = useState<number | null>(null);
  const [isLoadingProdukDetail, setIsLoadingProdukDetail] = useState(false);
  const [isSavingProduk, setIsSavingProduk] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    idChannel?: string;
    jenis?: string;
    feePercentage?: string;
    feeFixed?: string;
    status?: string;
  }>({});
  const [createForm, setCreateForm] = useState({
    idChannel: '',
    name: '',
    jenis: 'VA',
    feePercentage: '',
    feeFixed: '',
  });
  const [editForm, setEditForm] = useState({
    idChannel: '',
    name: '',
    jenis: 'VA',
    feePercentage: '',
    feeFixed: '',
    status: 'active' as ChannelProdukStatus,
  });
  const [filters, setFilters] = useState({ idChannel: '', status: 'all' });
  const [filterInputs, setFilterInputs] = useState({ idChannel: '', status: 'all' });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);

  const sortedProduk = useMemo(() => [...produkList].sort((a, b) => a.id - b.id), [produkList]);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.idChannel.trim()) count += 1;
    if (filters.status !== 'all') count += 1;
    return count;
  }, [filters.idChannel, filters.status]);
  const channelJenisById = useMemo(
    () =>
      channels.reduce<Record<number, string>>((accumulator, channel) => {
        if (channel.jenis) {
          accumulator[channel.id] = channel.jenis;
        }
        return accumulator;
      }, {}),
    [channels],
  );

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
    [],
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
          jenis: fetchedChannels[0].jenis ?? prev.jenis,
        };
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelProduk.toast.loadChannelsError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingChannels(false);
    }
  }, [handleAuthError]);

  const fetchProdukList = useCallback(
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

        const response = await apiFetch<ChannelProdukListResponse>(
          `channel-produk${queryString ? `?${queryString}` : ''}`,
          {
          method: 'GET',
          signal: controller.signal,
          },
        );

        setProdukList(response.data ?? []);
      } catch (error) {
        if (handleAuthError(error)) return;
        toast.error(error instanceof Error ? error.message : t('channelProduk.toast.loadError'), {
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
    void fetchProdukList(abortController);
    void fetchChannels();

    return () => abortController.abort();
  }, [fetchProdukList, fetchChannels]);

  const resetForms = () => {
    const defaultChannel = channels[0];
    setCreateForm({
      idChannel: defaultChannel ? String(defaultChannel.id) : '',
      name: '',
      jenis: defaultChannel?.jenis ?? 'VA',
      feePercentage: '',
      feeFixed: '',
    });
    setEditForm({ idChannel: '', name: '', jenis: 'VA', feePercentage: '', feeFixed: '', status: 'active' });
    setFormErrors({});
  };

  const resetFilters = () => {
    setFilters({ idChannel: '', status: 'all' });
    setFilterInputs({ idChannel: '', status: 'all' });
  };

  const handleResetFilters = () => {
    resetFilters();
  };

  const handleSearch = () => {
    const nextFilters = { ...filterInputs };
    setFilters(nextFilters);
    void fetchProdukList(undefined, nextFilters);
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

  const getProdukNameError = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return 'Name is required.';
    }
    if (trimmedName.length < PRODUK_NAME_MIN_LENGTH) {
      return `Name must be at least ${PRODUK_NAME_MIN_LENGTH} characters.`;
    }
    if (trimmedName.length > PRODUK_NAME_MAX_LENGTH) {
      return `Name must be ${PRODUK_NAME_MAX_LENGTH} characters or less.`;
    }
    return undefined;
  };

  const getChannelError = (idChannel: string) => {
    if (!idChannel.trim()) {
      return 'Channel is required.';
    }
    return undefined;
  };

  const getProdukTypeError = (jenis: string) => {
    const trimmedJenis = jenis.trim();
    if (!trimmedJenis) {
      return 'Type is required.';
    }
    if (!PRODUK_TYPES.includes(trimmedJenis as (typeof PRODUK_TYPES)[number])) {
      return 'Type must be VA or QRIS.';
    }
    return undefined;
  };

  const getFeeError = (value: string, label: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return `${label} is required.`;
    }
    if (!FEE_PATTERN.test(trimmedValue)) {
      return `${label} must be a number.`;
    }
    return undefined;
  };

  const validateForm = (payload: {
    idChannel: string;
    name: string;
    jenis: string;
    feePercentage: string;
    feeFixed: string;
    status?: ChannelProdukStatus;
  }) => {
    const errors: {
      name?: string;
      idChannel?: string;
      jenis?: string;
      feePercentage?: string;
      feeFixed?: string;
      status?: string;
    } = {};

    errors.idChannel = getChannelError(payload.idChannel);
    errors.name = getProdukNameError(payload.name);
    errors.jenis = getProdukTypeError(payload.jenis);
    errors.feePercentage = getFeeError(payload.feePercentage, 'Percentage fee');
    errors.feeFixed = getFeeError(payload.feeFixed, 'Fixed fee');
    if (payload.status && !['active', 'inactive'].includes(payload.status)) errors.status = 'Invalid status selected.';

    setFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const validateEditForm = (payload: {
    name: string;
    feePercentage: string;
    feeFixed: string;
    status?: ChannelProdukStatus;
  }) => {
    const errors: {
      name?: string;
      feePercentage?: string;
      feeFixed?: string;
      status?: string;
    } = {};

    errors.name = getProdukNameError(payload.name);
    errors.feePercentage = getFeeError(payload.feePercentage, 'Percentage fee');
    errors.feeFixed = getFeeError(payload.feeFixed, 'Fixed fee');
    if (payload.status && !['active', 'inactive'].includes(payload.status)) errors.status = 'Invalid status selected.';

    setFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const isCreateSubmitDisabled = useMemo(() => {
    const channelError = getChannelError(createForm.idChannel);
    const nameError = getProdukNameError(createForm.name);
    const typeError = getProdukTypeError(createForm.jenis);
    const feePercentageError = getFeeError(createForm.feePercentage, 'Percentage fee');
    const feeFixedError = getFeeError(createForm.feeFixed, 'Fixed fee');
    return Boolean(channelError || nameError || typeError || feePercentageError || feeFixedError);
  }, [createForm.feeFixed, createForm.feePercentage, createForm.idChannel, createForm.jenis, createForm.name]);

  const isEditSubmitDisabled = useMemo(() => {
    const nameError = getProdukNameError(editForm.name);
    const feePercentageError = getFeeError(editForm.feePercentage, 'Percentage fee');
    const feeFixedError = getFeeError(editForm.feeFixed, 'Fixed fee');
    return Boolean(nameError || feePercentageError || feeFixedError);
  }, [editForm.feeFixed, editForm.feePercentage, editForm.name]);

  const handleCreateProduk = async () => {
    if (!validateForm(createForm)) return;

    setIsSavingProduk(true);
    try {
      const response = await apiFetch<ApiMessageResponse>('channel-produk/add', {
        method: 'POST',
        body: {
          idChannel: Number(createForm.idChannel),
          name: createForm.name.trim(),
          jenis: createForm.jenis.trim(),
          feePercentage: Number(createForm.feePercentage),
          feeFixed: Number(createForm.feeFixed),
        },
      });

      const successMessage =
        locale === 'id'
          ? response.message ?? t('channelProduk.toast.createSuccess')
          : t('channelProduk.toast.createSuccess');
      toast.success(successMessage, {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      setCreateDialogOpen(false);
      resetForms();
      await fetchProdukList();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelProduk.toast.createError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSavingProduk(false);
    }
  };

  const handleOpenEditDialog = async (produkId: number) => {
    setEditingProdukId(produkId);
    setEditDialogOpen(true);
    setIsLoadingProdukDetail(true);
    setFormErrors({});

    try {
      const response = await apiFetch<ChannelProdukDetailResponse>(`channel-produk/${produkId}`);
      if (response.data) {
        setEditForm({
          idChannel: String(response.data.idChannel ?? ''),
          name: response.data.name ?? response.data.produkName ?? '',
          jenis: response.data.jenis ?? 'VA',
          feePercentage: response.data.feePercentage?.toString() ?? '',
          feeFixed: response.data.feeFixed?.toString() ?? '',
          status: (response.data.status as ChannelProdukStatus) ?? 'active',
        });
      }
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelProduk.toast.detailError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingProdukDetail(false);
    }
  };

  const handleUpdateProduk = async () => {
    if (!editingProdukId) return;
    if (!validateEditForm(editForm)) return;

    setIsSavingProduk(true);
    try {
      const response = await apiFetch<ApiMessageResponse>(`channel-produk/update/${editingProdukId}`, {
        method: 'POST',
        body: {
          name: editForm.name.trim(),
          feePercentage: Number(editForm.feePercentage),
          feeFixed: Number(editForm.feeFixed),
          status: editForm.status,
        },
      });

      const successMessage =
        locale === 'id'
          ? response.message ?? t('channelProduk.toast.updateSuccess')
          : t('channelProduk.toast.updateSuccess');
      toast.success(successMessage, {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      setEditDialogOpen(false);
      setEditingProdukId(null);
      resetForms();
      await fetchProdukList();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channelProduk.toast.updateError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSavingProduk(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    const MIN_SPIN_DURATION_MS = 500;

    setIsRefreshing(true);
    const start = Date.now();

    try {
      await fetchProdukList();
    } finally {
      const elapsed = Date.now() - start;

      if (elapsed < MIN_SPIN_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_DURATION_MS - elapsed));
      }

      setIsRefreshing(false);
    }
  }, [fetchProdukList]);

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('channelProduk.pageTitle')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('channelProduk.cardTitle')}</CardTitle>
            <CardDescription>{t('channelProduk.cardDescription')}</CardDescription>
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
                    <Label htmlFor="channel-produk-id-channel">Channel ID</Label>
                    <Input
                      id="channel-produk-id-channel"
                      placeholder="e.g. 3"
                      inputMode="numeric"
                      value={filterInputs.idChannel}
                      onChange={(event) =>
                        setFilterInputs((prev) => ({ ...prev, idChannel: event.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Status</Label>
                    <Select
                      value={filterInputs.status}
                      onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="All status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
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
                  <DialogTitle>{t('channelProduk.create.title')}</DialogTitle>
                  <DialogDescription>Create a new channel produk entry.</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select
                      value={createForm.idChannel}
                      onValueChange={(value) => {
                        const selectedChannel = channels.find((channel) => String(channel.id) === value);
                        const nextJenis = selectedChannel?.jenis ?? createForm.jenis;
                        setCreateForm((state) => ({ ...state, idChannel: value, jenis: nextJenis }));
                        setFormErrors((prev) => ({ ...prev, idChannel: getChannelError(value) }));
                        if (selectedChannel?.jenis) {
                          setFormErrors((prev) => ({ ...prev, jenis: getProdukTypeError(nextJenis) }));
                        }
                      }}
                      disabled={isLoadingChannels}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingChannels ? 'Loading channels...' : 'Select channel'} />
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
                    <Label>Type</Label>
                    <Select
                      value={createForm.jenis}
                      onValueChange={(value) => {
                        setCreateForm((state) => ({ ...state, jenis: value }));
                        setFormErrors((prev) => ({ ...prev, jenis: getProdukTypeError(value) }));
                      }}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUK_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.jenis && <p className="text-sm text-destructive">{formErrors.jenis}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="produk-name">Product Name</Label>
                    <Input
                      id="produk-name"
                      placeholder="QRIS TEST"
                      value={createForm.name}
                      maxLength={PRODUK_NAME_MAX_LENGTH}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((state) => ({ ...state, name: value }));
                        setFormErrors((prev) => ({ ...prev, name: getProdukNameError(value) }));
                      }}
                    />
                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="produk-fee-percentage">Percentage Fee</Label>
                    <Input
                      id="produk-fee-percentage"
                      placeholder="0.7"
                      value={createForm.feePercentage}
                      inputMode="decimal"
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((state) => ({ ...state, feePercentage: value }));
                        setFormErrors((prev) => ({ ...prev, feePercentage: getFeeError(value, 'Percentage fee') }));
                      }}
                    />
                    {formErrors.feePercentage && (
                      <p className="text-sm text-destructive">{formErrors.feePercentage}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="produk-fee-fixed">Fixed Fee</Label>
                    <Input
                      id="produk-fee-fixed"
                      placeholder="1000"
                      value={createForm.feeFixed}
                      inputMode="decimal"
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((state) => ({ ...state, feeFixed: value }));
                        setFormErrors((prev) => ({ ...prev, feeFixed: getFeeError(value, 'Fixed fee') }));
                      }}
                    />
                    {formErrors.feeFixed && <p className="text-sm text-destructive">{formErrors.feeFixed}</p>}
                  </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    onClick={() => void handleCreateProduk()}
                    disabled={isSavingProduk || isCreateSubmitDisabled}
                  >
                    {isSavingProduk ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                resetFilters();
                void fetchProdukList(undefined, { idChannel: '', status: 'all' });
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
                  <TableHead className="w-[60px]">{t('channelProduk.table.id')}</TableHead>
                  <TableHead className="w-[120px]">{t('channelProduk.table.channelId')}</TableHead>
                  <TableHead>{t('channelProduk.table.channel')}</TableHead>
                  <TableHead>{t('channelProduk.table.type')}</TableHead>
                  <TableHead>{t('channelProduk.table.productName')}</TableHead>
                  <TableHead>{t('channelProduk.table.percentageFee')}</TableHead>
                  <TableHead>{t('channelProduk.table.fixedFee')}</TableHead>
                  <TableHead>{t('channelProduk.table.status')}</TableHead>
                  <TableHead className="w-[180px]">{t('channelProduk.table.createdAt')}</TableHead>
                  <TableHead className="w-[180px]">{t('channelProduk.table.updatedAt')}</TableHead>
                  <TableHead className="w-[120px] text-right">{t('channelProduk.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 10 }).map((_, rowIndex) => (
                      <TableRow key={`skeleton-${rowIndex}`}>
                        <TableCell data-label={t('channelProduk.table.id')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.channelId')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.channel')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.type')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.productName')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.percentageFee')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.fixedFee')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.status')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.createdAt')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.updatedAt')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channelProduk.table.actions')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : sortedProduk.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                      <div className="flex flex-col items-center gap-2">
                        <Inbox className="h-6 w-6" />
                        <span>{t('channelProduk.empty.title')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedProduk.map((produk) => (
                    <TableRow key={produk.id}>
                      <TableCell data-label={t('channelProduk.table.id')}>{produk.id}</TableCell>
                      <TableCell data-label={t('channelProduk.table.channelId')}>
                        {produk.idChannel ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelProduk.table.channel')} className="font-medium">
                        {produk.channelName ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelProduk.table.type')}>
                        {produk.jenis ?? channelJenisById[produk.idChannel] ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelProduk.table.productName')}>
                        {produk.produkName ?? produk.name ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelProduk.table.percentageFee')}>
                        {formatPercent(produk.feePercentage)}
                      </TableCell>
                      <TableCell data-label={t('channelProduk.table.fixedFee')}>
                        {formatCurrency(produk.feeFixed)}
                      </TableCell>
                      <TableCell data-label={t('channelProduk.table.status')}>
                        {produk.status ? (
                          <Badge
                            variant={produk.status === 'active' ? 'default' : 'secondary'}
                            className={cn(
                              'w-[86px] justify-center capitalize',
                              produk.status === 'active' &&
                                'rounded-md px-2 py-0.5 text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                              produk.status === 'inactive' && 'rounded-md bg-rose-400 px-2 py-0.5 text-white',
                            )}
                          >
                            {produk.status}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell
                        data-label={t('channelProduk.table.createdAt')}
                        className="text-sm text-muted-foreground"
                      >
                        {produk.created_at ?? '-'}
                      </TableCell>
                      <TableCell
                        data-label={t('channelProduk.table.updatedAt')}
                        className="text-sm text-muted-foreground"
                      >
                        {produk.updated_at ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channelProduk.table.actions')} className="text-right">
                        <Button
                          size="sm"
                          onClick={() => void handleOpenEditDialog(produk.id)}
                          disabled={isSavingProduk}
                          className="bg-primary text-white hover:bg-primary/90"
                        >
                          Edit
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
            setEditingProdukId(null);
            setFormErrors({});
          }
        }}
      >
        <DialogContent className="rounded-lg sm:max-w-[520px] sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>{t('channelProduk.edit.title')}</DialogTitle>
            <DialogDescription>Update the selected channel produk details.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {isLoadingProdukDetail ? (
              <p className="text-muted-foreground">Loading channel produk information...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select
                    value={editForm.idChannel}
                    onValueChange={(value) => setEditForm((state) => ({ ...state, idChannel: value }))}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
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
                  <Label htmlFor="edit-produk-name">Product Name</Label>
                  <Input
                    id="edit-produk-name"
                    placeholder="Product name"
                    value={editForm.name}
                    maxLength={PRODUK_NAME_MAX_LENGTH}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditForm((state) => ({ ...state, name: value }));
                      setFormErrors((prev) => ({ ...prev, name: getProdukNameError(value) }));
                    }}
                  />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-produk-fee-percentage">Percentage Fee</Label>
                  <Input
                    id="edit-produk-fee-percentage"
                    placeholder="0.7"
                    value={editForm.feePercentage}
                    inputMode="decimal"
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditForm((state) => ({ ...state, feePercentage: value }));
                      setFormErrors((prev) => ({ ...prev, feePercentage: getFeeError(value, 'Percentage fee') }));
                    }}
                  />
                  {formErrors.feePercentage && (
                    <p className="text-sm text-destructive">{formErrors.feePercentage}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-produk-fee-fixed">Fixed Fee</Label>
                  <Input
                    id="edit-produk-fee-fixed"
                    placeholder="1000"
                    value={editForm.feeFixed}
                    inputMode="decimal"
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditForm((state) => ({ ...state, feeFixed: value }));
                      setFormErrors((prev) => ({ ...prev, feeFixed: getFeeError(value, 'Fixed fee') }));
                    }}
                  />
                  {formErrors.feeFixed && <p className="text-sm text-destructive">{formErrors.feeFixed}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm((state) => ({ ...state, status: value as ChannelProdukStatus }))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.status && <p className="text-sm text-destructive">{formErrors.status}</p>}
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={() => void handleUpdateProduk()}
              disabled={isSavingProduk || isLoadingProdukDetail || isEditSubmitDisabled}
            >
              {isSavingProduk ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default AdminChannelProdukPage;
