import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Inbox, Plus, RefreshCcw, SlidersHorizontal } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiAuthError, ApiResponseError, apiFetch } from '@/lib/api';
import { useLanguage } from '@/i18n/language-provider';

interface ChannelItem {
  id: number;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

type ChannelConfig = Record<string, string>;
type AvailableChannelConfig = ChannelConfig | null;

interface ChannelListResponse {
  status: boolean;
  data?: ChannelItem[];
}

interface ChannelDetailResponse {
  status: boolean;
  data?: ChannelItem & {
    configJson?: ChannelConfig;
  };
  availableConfig?: ChannelConfig;
}

interface ApiMessageResponse {
  status: boolean;
  message?: string;
}

type ChannelConfigErrorResponse = {
  errors?: Array<{
    path?: string;
    message?: string;
  }>;
};

const errorToastStyle = {
  border: '2px solid #fda4af',
  background: '#fff1f2',
  color: '#f43f5e',
  boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
  padding: '0.5rem',
} as const;
const CHANNEL_NAME_MIN_LENGTH = 3;
const CHANNEL_NAME_MAX_LENGTH = 10;

export function AdminChannelPage() {
  const { t } = useLanguage();
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null);
  const [isLoadingChannelDetail, setIsLoadingChannelDetail] = useState(false);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '' });
  const [editForm, setEditForm] = useState({ name: '', configJson: {} as ChannelConfig });
  const [availableConfig, setAvailableConfig] = useState<AvailableChannelConfig>({});
  const [formErrors, setFormErrors] = useState<{ name?: string; configJson?: Record<string, string> }>({});
  const [filters, setFilters] = useState({ name: '' });
  const [filterNameInput, setFilterNameInput] = useState('');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);

  const sortedChannels = useMemo(() => [...channels].sort((a, b) => a.id - b.id), [channels]);
  const activeFilterCount = useMemo(() => {
    const trimmedName = filters.name.trim();
    return trimmedName ? 1 : 0;
  }, [filters.name]);

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

  const fetchChannels = useCallback(
    async (
      abortController?: AbortController,
      overrideFilters?: {
        name: string;
      },
    ) => {
      const controller = abortController ?? new AbortController();

      const startTime = Date.now();
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        const activeFilters = overrideFilters ?? filters;
        const trimmedName = activeFilters.name.trim();
        if (trimmedName) params.set('name', trimmedName);
        const queryString = params.toString();

        const response = await apiFetch<ChannelListResponse>(`channel${queryString ? `?${queryString}` : ''}`, {
          method: 'GET',
          signal: controller.signal,
        });

        setChannels(response.data ?? []);
      } catch (error) {
        if (handleAuthError(error)) return;
        toast.error(error instanceof Error ? error.message : t('channel.toast.loadError'), {
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
    [filters.name, handleAuthError],
  );

  useEffect(() => {
    const abortController = new AbortController();
    void fetchChannels(abortController);

    return () => abortController.abort();
  }, [fetchChannels]);

  const resetForm = () => {
    setCreateForm({ name: '' });
    setEditForm({ name: '', configJson: {} });
    setAvailableConfig({});
    setFormErrors({});
  };

  const resetFilters = () => {
    setFilters({ name: '' });
    setFilterNameInput('');
  };

  const handleResetFilters = () => {
    resetFilters();
    void fetchChannels(undefined, { name: '' });
  };

  const handleSearch = () => {
    const nextFilters = { name: filterNameInput };
    setFilters(nextFilters);
    void fetchChannels(undefined, nextFilters);
  };

  const handleFilterDialogChange = (open: boolean) => {
    if (open) {
      setFilterNameInput(filters.name);
    }
    if (!open && !appliedRef.current) {
      setFilterNameInput(filters.name);
    }
    appliedRef.current = false;
    setIsFilterDialogOpen(open);
  };

  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((message, [placeholder, value]) => {
      return message.replace(`{${placeholder}}`, String(value));
    }, t(key));

  const getChannelNameError = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return t('channel.validation.nameRequired');
    }
    if (trimmedName.length < CHANNEL_NAME_MIN_LENGTH) {
      return formatMessage('channel.validation.nameMin', { count: CHANNEL_NAME_MIN_LENGTH });
    }
    if (trimmedName.length > CHANNEL_NAME_MAX_LENGTH) {
      return formatMessage('channel.validation.nameMax', { count: CHANNEL_NAME_MAX_LENGTH });
    }
    return undefined;
  };

  const getConfigError = (value: string, label: string) => {
    if (!value.trim()) {
      return formatMessage('channel.validation.configRequired', { label });
    }
    return undefined;
  };

  const validateForm = (payload: { name: string }) => {
    const errors: { name?: string } = {};

    errors.name = getChannelNameError(payload.name);

    setFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const validateEditForm = (payload: { name: string; configJson: ChannelConfig }) => {
    const errors: { name?: string; configJson?: Record<string, string> } = {};

    errors.name = getChannelNameError(payload.name);
    if (availableConfig && Object.keys(availableConfig).length > 0) {
      const configErrors = Object.keys(availableConfig).reduce<Record<string, string>>((accumulator, key) => {
        const error = getConfigError(payload.configJson[key] ?? '', key);
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
    const nameError = getChannelNameError(createForm.name);
    return Boolean(nameError);
  }, [createForm.name]);
  const isEditSubmitDisabled = useMemo(() => {
    const nameError = getChannelNameError(editForm.name);
    if (availableConfig === null) {
      return true;
    }
    const configKeys = Object.keys(availableConfig);
    const hasEmptyConfig = configKeys.some((key) => !(editForm.configJson[key] ?? '').trim());
    return Boolean(nameError || (configKeys.length > 0 && hasEmptyConfig));
  }, [availableConfig, editForm.configJson, editForm.name]);

  const handleCreateChannel = async () => {
    if (!validateForm(createForm)) return;

    setIsSavingChannel(true);
    try {
      const response = await apiFetch<ApiMessageResponse>('channel/add', {
        method: 'POST',
        body: {
          name: createForm.name.trim(),
        },
      });

      toast.success(response.message ?? t('channel.toast.createSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      setCreateDialogOpen(false);
      resetForm();
      await fetchChannels();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channel.toast.createError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleOpenEditDialog = async (channelId: number) => {
    setEditingChannelId(channelId);
    setEditDialogOpen(true);
    setIsLoadingChannelDetail(true);
    setFormErrors({});

    try {
      const response = await apiFetch<ChannelDetailResponse>(`channel/${channelId}`);
      if (response.data) {
        setEditForm({
          name: response.data.name ?? '',
          configJson: response.data.configJson ?? {},
        });
      }
      setAvailableConfig(response.availableConfig === null ? null : (response.availableConfig ?? {}));
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('channel.toast.detailError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingChannelDetail(false);
    }
  };

  const handleUpdateChannel = async () => {
    if (!editingChannelId) return;
    if (!validateEditForm(editForm)) return;
    if (availableConfig === null) return;

    setIsSavingChannel(true);
    try {
      const configKeys = Object.keys(availableConfig);
      const configJson = configKeys.reduce<ChannelConfig>((accumulator, key) => {
        accumulator[key] = editForm.configJson[key] ?? '';
        return accumulator;
      }, {});
      const response = await apiFetch<ApiMessageResponse>(`channel/update/${editingChannelId}`, {
        method: 'POST',
        body: {
          name: editForm.name.trim(),
          configJson,
        },
      });

      setEditDialogOpen(false);
      setEditingChannelId(null);
      resetForm();
      toast.success(response.message ?? t('channel.toast.updateSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      await fetchChannels();
    } catch (error) {
      if (handleAuthError(error)) return;
      if (error instanceof ApiResponseError) {
        const responseBody = error.responseBody as ChannelConfigErrorResponse | null;
        const formattedErrors = responseBody?.errors
          ?.map((entry) => {
            const path = entry.path ?? 'field';
            const rawMessage = entry.message ?? 'is invalid';
            const cleanedMessage = rawMessage.replace(/"/g, '').trim();
            const messageWithoutPath = cleanedMessage.replace(new RegExp(`^${path}\\s*`, 'i'), '').trim();
            return `- ${path} ${messageWithoutPath || 'is invalid'}`;
          })
          .filter(Boolean);
        if (formattedErrors && formattedErrors.length > 0) {
          toast.error(
            <div className="space-y-1">
              {formattedErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>,
            {
            duration: 3000,
            style: errorToastStyle,
            },
          );
        } else {
          toast.error(error.message || t('channel.toast.updateError'), {
            duration: 1500,
            style: errorToastStyle,
          });
        }
      } else {
        toast.error(error instanceof Error ? error.message : t('channel.toast.updateError'), {
          duration: 1500,
          style: errorToastStyle,
        });
      }
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    const MIN_SPIN_DURATION_MS = 500;

    setIsRefreshing(true);
    const start = Date.now();

    try {
      await fetchChannels();
    } finally {
      const elapsed = Date.now() - start;

      if (elapsed < MIN_SPIN_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_DURATION_MS - elapsed));
      }

      setIsRefreshing(false);
    }
  }, [fetchChannels]);

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('channel.pageTitle')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('channel.cardTitle')}</CardTitle>
            <CardDescription>{t('channel.cardDescription')}</CardDescription>
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
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>{t('common.filters')}</DialogTitle>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="channel-filter-name">{t('channel.filterNameLabel')}</Label>
                    <Input
                      id="channel-filter-name"
                      placeholder={t('channel.filterNamePlaceholder')}
                      value={filterNameInput}
                      onChange={(event) => setFilterNameInput(event.target.value)}
                    />
                  </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      appliedRef.current = false;
                      setFilterNameInput(filters.name);
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
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={resetForm}
                  className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 md:self-stretch"
                >
                  <Plus className="h-4 w-4" />
                  {t('common.add')}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-lg sm:max-w-[480px] sm:rounded-lg">
                <DialogHeader>
                  <DialogTitle>{t('channel.addTitle')}</DialogTitle>
                  <DialogDescription>{t('channel.addDescription')}</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="channel-name">{t('channel.nameLabel')}</Label>
                    <Input
                      id="channel-name"
                      placeholder={t('channel.namePlaceholder')}
                      value={createForm.name}
                      maxLength={CHANNEL_NAME_MAX_LENGTH}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((state) => ({ ...state, name: value }));
                        setFormErrors((prev) => ({ ...prev, name: getChannelNameError(value) }));
                      }}
                    />
                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
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
                    className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto"
                    onClick={() => void handleCreateChannel()}
                    disabled={isSavingChannel || isCreateSubmitDisabled}
                  >
                    {isSavingChannel ? t('common.saving') : t('common.save')}
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
          <div className="relative overflow-x-auto sm:rounded-md sm:border sm:border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">{t('common.id')}</TableHead>
                  <TableHead>{t('channel.table.name')}</TableHead>
                  <TableHead>{t('channel.table.created')}</TableHead>
                  <TableHead>{t('channel.table.updated')}</TableHead>
                  <TableHead className="w-[120px] text-right">{t('channel.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 10 }).map((_, rowIndex) => (
                      <TableRow key={`skeleton-${rowIndex}`}>
                        <TableCell data-label={t('common.id')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channel.table.name')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channel.table.created')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channel.table.updated')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell data-label={t('channel.table.actions')}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : sortedChannels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      <div className="flex flex-col items-center gap-2">
                        <Inbox className="h-6 w-6" />
                        <span>{t('channel.empty')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedChannels.map((channel) => (
                    <TableRow key={channel.id}>
                      <TableCell data-label={t('common.id')}>{channel.id}</TableCell>
                      <TableCell data-label={t('channel.table.name')} className="font-medium">
                        {channel.name}
                      </TableCell>
                      <TableCell data-label={t('channel.table.created')} className="text-sm text-muted-foreground">
                        {channel.created_at ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channel.table.updated')} className="text-sm text-muted-foreground">
                        {channel.updated_at ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('channel.table.actions')} className="text-right">
                        <Button
                          size="sm"
                          onClick={() => void handleOpenEditDialog(channel.id)}
                          disabled={isSavingChannel}
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
            setEditingChannelId(null);
            setAvailableConfig({});
            setFormErrors({});
          }
        }}
      >
        <DialogContent className="rounded-lg sm:max-w-[480px] sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>{t('channel.editTitle')}</DialogTitle>
            <DialogDescription>{t('channel.editDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            {isLoadingChannelDetail ? (
              <p className="text-muted-foreground">{t('channel.loadingDetail')}</p>
            ) : availableConfig === null ? (
              <p className="text-muted-foreground">{t('channel.edit.noEditableFields')}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-channel-name">{t('channel.nameLabel')}</Label>
                  <Input
                    id="edit-channel-name"
                    placeholder={t('channel.namePlaceholder')}
                    value={editForm.name}
                    maxLength={CHANNEL_NAME_MAX_LENGTH}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEditForm((state) => ({ ...state, name: value }));
                      setFormErrors((prev) => ({ ...prev, name: getChannelNameError(value) }));
                    }}
                  />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>
                {Object.keys(availableConfig).map((configKey) => (
                  <div key={configKey} className="space-y-2">
                    <Label htmlFor={`edit-channel-config-${configKey}`}>{configKey}</Label>
                    <Input
                      id={`edit-channel-config-${configKey}`}
                      value={editForm.configJson[configKey] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setEditForm((state) => ({
                          ...state,
                          configJson: {
                            ...state.configJson,
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
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={() => void handleUpdateChannel()}
              disabled={isSavingChannel || isLoadingChannelDetail || isEditSubmitDisabled}
            >
              {isSavingChannel ? t('common.saving') : t('channel.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
