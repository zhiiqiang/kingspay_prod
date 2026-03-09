import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Inbox, Loader2, Plus, RefreshCcw, SlidersHorizontal } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { ApiAuthError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/language-provider';

interface BankItem {
  id: number;
  code: string;
  name: string;
  status: 'active' | 'inactive' | string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface BankListResponse {
  status: boolean;
  message?: string;
  data: BankItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

interface BankDetailResponse {
  status: boolean;
  message?: string;
  data: BankItem;
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

const STATUS_OPTIONS = ['all', 'active', 'inactive'] as const;

const CODE_MAX_LENGTH = 12;
const NAME_MAX_LENGTH = 60;

export function AdminBankListPage() {
  const { t } = useLanguage();
  const [banks, setBanks] = useState<BankItem[]>([]);
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
  const [editingBankId, setEditingBankId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ code: '', status: 'all' });
  const [filterInputs, setFilterInputs] = useState({ code: '', status: 'all' });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);
  const [createForm, setCreateForm] = useState({ code: '', name: '', status: 'active' });
  const [editForm, setEditForm] = useState({ code: '', name: '', status: 'active' });
  const [formErrors, setFormErrors] = useState<{ code?: string; name?: string; status?: string }>({});

  const pageOptions = useMemo(() => {
    const calculatedPages = Math.max(1, totalPages || Math.ceil(totalItems / limit) || 1);
    return Array.from({ length: calculatedPages }, (_, index) => index + 1);
  }, [limit, totalItems, totalPages]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.code.trim()) count += 1;
    if (filters.status !== 'all') count += 1;
    return count;
  }, [filters.code, filters.status]);

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

  const fetchBanks = useCallback(
    async (
      abortController?: AbortController,
      overrideFilters?: {
        code: string;
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
        const trimmedCode = activeFilters.code.trim();
        if (trimmedCode) params.set('code', trimmedCode);
        if (activeFilters.status !== 'all') params.set('status', activeFilters.status);

        const response = await apiFetch<BankListResponse>(`bank-list?${params.toString()}`, {
          method: 'GET',
          signal: controller.signal,
        });

        setBanks(response.data ?? []);
        setTotalItems(response.pagination?.total ?? response.data?.length ?? 0);
        setTotalPages(response.pagination?.totalPages ?? 1);
        if (response.pagination?.page) setPage(response.pagination.page);
      } catch (error) {
        if (handleAuthError(error)) return;
        toast.error(error instanceof Error ? error.message : t('bankList.toast.loadError'), {
          duration: 1500,
          style: errorToastStyle,
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters.code, filters.status, handleAuthError, limit, page],
  );

  useEffect(() => {
    const abortController = new AbortController();
    void fetchBanks(abortController);
    return () => abortController.abort();
  }, [fetchBanks]);

  const resetForms = () => {
    setCreateForm({ code: '', name: '', status: 'active' });
    setEditForm({ code: '', name: '', status: 'active' });
    setFormErrors({});
  };

  const resetFilters = () => {
    setFilters({ code: '', status: 'all' });
    setFilterInputs({ code: '', status: 'all' });
    setPage(1);
  };

  const getCodeError = (code: string, mode: 'create' | 'edit') => {
    if (mode === 'edit') return undefined;
    const trimmedCode = code.trim();
    if (!trimmedCode) return 'Code is required.';
    if (trimmedCode.length > CODE_MAX_LENGTH) {
      return `Code must be ${CODE_MAX_LENGTH} characters or less.`;
    }
    return undefined;
  };

  const getNameError = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return 'Name is required.';
    if (trimmedName.length > NAME_MAX_LENGTH) {
      return `Name must be ${NAME_MAX_LENGTH} characters or less.`;
    }
    return undefined;
  };

  const validateForm = (form: { code: string; name: string; status: string }, mode: 'create' | 'edit') => {
    const errors: { code?: string; name?: string; status?: string } = {};
    errors.code = getCodeError(form.code, mode);
    errors.name = getNameError(form.name);
    if (!form.status) {
      errors.status = 'Status is required.';
    }
    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const isCreateSubmitDisabled = useMemo(() => {
    return Boolean(getCodeError(createForm.code, 'create') || getNameError(createForm.name));
  }, [createForm.code, createForm.name]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchBanks();
  };

  const handleSearch = () => {
    const nextFilters = {
      code: filterInputs.code.trim(),
      status: filterInputs.status,
    };
    setFilters(nextFilters);
    setPage(1);
    void fetchBanks(undefined, nextFilters);
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

  const handleCreateBank = async () => {
    if (!validateForm(createForm, 'create')) return;

    setCreateDialogOpen(false);
    setIsSaving(true);
    try {
      await apiFetch<ApiMessageResponse>('bank-list/add', {
        method: 'POST',
        body: {
          code: createForm.code.trim(),
          name: createForm.name.trim(),
          status: createForm.status,
        },
      });
      toast.success(t('bankList.toast.createSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      resetForms();
      void fetchBanks();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('bankList.toast.createError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = async (bankId: number) => {
    setEditingBankId(bankId);
    setEditDialogOpen(true);
    setIsLoadingDetail(true);
    try {
      const response = await apiFetch<BankDetailResponse>(`bank-list/${bankId}`, { method: 'GET' });
      setEditForm({
        code: response.data.code ?? '',
        name: response.data.name ?? '',
        status: response.data.status ?? 'active',
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('bankList.toast.detailError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdateBank = async () => {
    if (!editingBankId) return;
    if (!validateForm(editForm, 'edit')) return;

    setEditDialogOpen(false);
    setIsSaving(true);
    try {
      await apiFetch<ApiMessageResponse>(`bank-list/update/${editingBankId}`, {
        method: 'POST',
        body: {
          name: editForm.name.trim(),
          status: editForm.status,
        },
      });
      toast.success(t('bankList.toast.updateSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      resetForms();
      void fetchBanks();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('bankList.toast.updateError'), {
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
      if (type === 'edit') setEditingBankId(null);
    }
    if (type === 'create') setCreateDialogOpen(open);
    if (type === 'edit') setEditDialogOpen(open);
  };

  return (
    <div className="container space-y-6 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('bankList.pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('bankList.pageDescription')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('bankList.cardTitle')}</CardTitle>
            <CardDescription>{t('bankList.cardDescription')}</CardDescription>
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
                    <span className="text-sm font-medium text-muted-foreground">{t('bankList.filters.code')}</span>
                    <Input
                      value={filterInputs.code}
                      onChange={(event) => setFilterInputs((prev) => ({ ...prev, code: event.target.value }))}
                      placeholder={t('bankList.filters.codePlaceholder')}
                      className="md:w-[220px]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('bankList.filters.status')}</span>
                    <Select
                      value={filterInputs.status}
                      onValueChange={(value) => setFilterInputs((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="md:w-[180px]">
                        <SelectValue placeholder={t('bankList.filters.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`bankList.status.${option}`)}
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
                  <DialogTitle>{t('bankList.create.title')}</DialogTitle>
                  <DialogDescription>{t('bankList.create.description')}</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-code">Bank code</Label>
                    <Input
                      id="bank-code"
                      value={createForm.code}
                      maxLength={CODE_MAX_LENGTH}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((prev) => ({ ...prev, code: value }));
                        setFormErrors((prev) => ({ ...prev, code: getCodeError(value, 'create') }));
                      }}
                      placeholder="e.g. BCA"
                    />
                    {formErrors.code && <p className="text-sm text-destructive">{formErrors.code}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bank name</Label>
                    <Input
                      id="bank-name"
                      value={createForm.name}
                      maxLength={NAME_MAX_LENGTH}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreateForm((prev) => ({ ...prev, name: value }));
                        setFormErrors((prev) => ({ ...prev, name: getNameError(value) }));
                      }}
                      placeholder="Bank BCA"
                    />
                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={createForm.status}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.filter((option) => option !== 'all').map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`bankList.status.${option}`)}
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
                    onClick={handleCreateBank}
                    disabled={isSaving || isCreateSubmitDisabled}
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    {isSaving ? 'Saving...' : 'Save bank'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                resetFilters();
                void fetchBanks(undefined, { code: '', status: 'all' });
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
                    <TableHead className="w-[80px]">{t('bankList.table.id')}</TableHead>
                    <TableHead className="min-w-[140px]">{t('bankList.table.code')}</TableHead>
                    <TableHead className="min-w-[200px]">{t('bankList.table.name')}</TableHead>
                    <TableHead className="w-[140px]">{t('bankList.table.status')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('bankList.table.createdAt')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('bankList.table.updatedAt')}</TableHead>
                    <TableHead className="w-[120px] text-right">{t('bankList.table.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 10 }).map((_, rowIndex) => (
                        <TableRow key={`skeleton-${rowIndex}`}>
                          <TableCell data-label={t('bankList.table.id')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('bankList.table.code')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('bankList.table.name')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('bankList.table.status')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('bankList.table.createdAt')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('bankList.table.updatedAt')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell data-label={t('bankList.table.action')}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : banks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                            <Inbox className="h-7 w-7" aria-hidden />
                          </div>
                          <div className="space-y-1">
                            <div className="text-base font-medium text-foreground">
                              {t('bankList.empty.title')}
                            </div>
                            <div>{t('bankList.empty.description')}</div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    banks.map((bank) => (
                      <TableRow key={bank.id}>
                        <TableCell data-label={t('bankList.table.id')} className="font-medium">
                          {bank.id}
                        </TableCell>
                        <TableCell data-label={t('bankList.table.code')}>{bank.code}</TableCell>
                        <TableCell data-label={t('bankList.table.name')}>{bank.name}</TableCell>
                        <TableCell data-label={t('bankList.table.status')}>
                          <Badge
                            variant={bank.status === 'active' ? 'default' : 'secondary'}
                            className={cn(
                              'w-[86px] justify-center capitalize',
                              bank.status === 'active' &&
                                'rounded-md px-2 py-0.5 text-[var(--color-success-accent,var(--color-green-800))] bg-[var(--color-success-soft,var(--color-green-100))] dark:bg-[var(--color-success-soft,var(--color-green-950))] dark:text-[var(--color-success-soft,var(--color-green-600))]',
                              bank.status === 'inactive' && 'rounded-md bg-rose-400 px-2 py-0.5 text-white',
                            )}
                          >
                            {bank.status}
                          </Badge>
                        </TableCell>
                        <TableCell data-label={t('bankList.table.createdAt')}>{bank.created_at ?? '-'}</TableCell>
                        <TableCell data-label={t('bankList.table.updatedAt')}>{bank.updated_at ?? '-'}</TableCell>
                        <TableCell data-label={t('bankList.table.action')} className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenEdit(bank.id)}
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
                {totalItems ?? banks.length} banks
              </div>
            </div>
            {banks.length > 0 && (
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
            <DialogTitle>{t('bankList.edit.title')}</DialogTitle>
            <DialogDescription>{t('bankList.edit.description')}</DialogDescription>
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
                  <Label>Bank code</Label>
                  <Input value={editForm.code} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-bank-name">Bank name</Label>
                  <Input
                    id="edit-bank-name"
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
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.filter((option) => option !== 'all').map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`bankList.status.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.status && <p className="text-sm text-destructive">{formErrors.status}</p>}
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false, 'edit')}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateBank}
              disabled={isSaving || isLoadingDetail}
              className="bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving' : 'Save bank'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
