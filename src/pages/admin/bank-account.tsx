import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Inbox, Loader2, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react';
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
import { ApiAuthError } from '@/lib/api';
import { getStoredUserPermissions } from '@/lib/auth';
import {
  createBankAccount,
  deleteBankAccount,
  fetchBankAccountById,
  fetchBankAccounts,
  updateBankAccount,
  type BankAccountItem,
} from '@/lib/bank-account-api';
import { fetchBankList, type BankListItem } from '@/lib/bank-list-api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/language-provider';

const errorToastStyle = {
  border: '2px solid #fda4af',
  background: '#fff1f2',
  color: '#f43f5e',
  boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
  padding: '0.5rem',
} as const;

export function AdminBankAccountPage() {
  const { t } = useLanguage();
  const permissionSet = useMemo(() => new Set(getStoredUserPermissions()), []);
  const canList = permissionSet.has('dataRekening:list');
  const canAdd = permissionSet.has('dataRekening:add');
  const canUpdate = permissionSet.has('dataRekening:update');
  const canDelete = permissionSet.has('dataRekening:delete');
  const [items, setItems] = useState<BankAccountItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<BankAccountItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({ bankCode: '', accountNo: '', accountName: '' });
  const [editForm, setEditForm] = useState({ bankCode: '', accountNo: '', accountName: '' });
  const [formErrors, setFormErrors] = useState<{ bankCode?: string; accountNo?: string; accountName?: string }>({});
  const [bankOptions, setBankOptions] = useState<BankListItem[]>([]);
  const [isBankOptionsLoading, setIsBankOptionsLoading] = useState(false);
  const [createBankSearch, setCreateBankSearch] = useState('');
  const [editBankSearch, setEditBankSearch] = useState('');

  const pageOptions = useMemo(() => {
    const calculatedPages = Math.max(1, totalPages || Math.ceil(totalItems / limit) || 1);
    return Array.from({ length: calculatedPages }, (_, index) => index + 1);
  }, [limit, totalItems, totalPages]);
  const editBankOptions = useMemo(() => {
    if (!editForm.bankCode) return bankOptions;
    if (bankOptions.some((bank) => bank.code === editForm.bankCode)) return bankOptions;
    return [
      ...bankOptions,
      {
        id: -1,
        code: editForm.bankCode,
        name: editForm.bankCode,
        status: 'inactive',
      },
    ];
  }, [bankOptions, editForm.bankCode]);


  const filteredCreateBankOptions = useMemo(() => {
    const keyword = createBankSearch.trim().toLowerCase();
    if (!keyword) return bankOptions;
    return bankOptions.filter((bank) => {
      const code = bank.code.toLowerCase();
      const name = bank.name.toLowerCase();
      return code.includes(keyword) || name.includes(keyword);
    });
  }, [bankOptions, createBankSearch]);

  const filteredEditBankOptions = useMemo(() => {
    const keyword = editBankSearch.trim().toLowerCase();
    if (!keyword) return editBankOptions;
    return editBankOptions.filter((bank) => {
      const code = bank.code.toLowerCase();
      const name = bank.name.toLowerCase();
      return code.includes(keyword) || name.includes(keyword);
    });
  }, [editBankOptions, editBankSearch]);

  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof ApiAuthError) {
      toast.error(t('auth.sessionExpired'), { duration: 1500, style: errorToastStyle });
      return true;
    }
    return false;
  }, [t]);

  const fetchData = useCallback(async () => {
    if (!canList) {
      setItems([]);
      setTotalItems(0);
      setTotalPages(1);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetchBankAccounts({
        page,
        limit,
      });
      setItems(res.data ?? []);
      setTotalItems(res.pagination?.total ?? res.data?.length ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
      if (res.pagination?.page) setPage(res.pagination.page);
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('bankAccount.toast.loadError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canList, handleAuthError, limit, page, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fetchBankOptions = useCallback(async () => {
    if (!canAdd && !canUpdate) {
      setBankOptions([]);
      return;
    }
    setIsBankOptionsLoading(true);
    try {
      const response = await fetchBankList({ page: 1, limit: 1000, status: 'active' });
      setBankOptions(response.data ?? []);
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('bankList.toast.loadError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsBankOptionsLoading(false);
    }
  }, [canAdd, canUpdate, handleAuthError, t]);

  useEffect(() => {
    void fetchBankOptions();
  }, [fetchBankOptions]);

  const getFieldError = (labelKey: string, value: string) => {
    if (!value.trim()) return t(`${labelKey}.required`);
    return undefined;
  };

  const validateForm = (form: { bankCode: string; accountNo: string; accountName: string }) => {
    const errors = {
      bankCode: getFieldError('bankAccount.validation.bankCode', form.bankCode),
      accountNo: getFieldError('bankAccount.validation.accountNo', form.accountNo),
      accountName: getFieldError('bankAccount.validation.accountName', form.accountName),
    };
    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const resetForms = () => {
    setCreateForm({ bankCode: '', accountNo: '', accountName: '' });
    setEditForm({ bankCode: '', accountNo: '', accountName: '' });
    setCreateBankSearch('');
    setEditBankSearch('');
    setFormErrors({});
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchData();
  };

  const handleCreate = async () => {
    if (!validateForm(createForm)) return;
    if (!canAdd) return;
    setCreateDialogOpen(false);
    setIsSaving(true);
    try {
      const response = await createBankAccount({
        bankCode: createForm.bankCode.trim(),
        accountNo: createForm.accountNo.trim(),
        accountName: createForm.accountName.trim(),
      });
      toast.success(response.message || t('bankAccount.toast.createSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      resetForms();
      void fetchData();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('bankAccount.toast.createError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = async (id: number) => {
    setEditingId(id);
    setEditDialogOpen(true);
    setIsLoadingDetail(true);
    try {
      const response = await fetchBankAccountById(id);
      setEditForm({
        bankCode: response.data.bankCode ?? '',
        accountNo: response.data.accountNo ?? '',
        accountName: response.data.accountName ?? '',
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error instanceof Error ? error.message : t('bankAccount.toast.detailError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!validateForm(editForm)) return;
    if (!canUpdate) return;
    setEditDialogOpen(false);
    setIsSaving(true);
    try {
      await updateBankAccount(editingId, {
        bankCode: editForm.bankCode.trim(),
        accountNo: editForm.accountNo.trim(),
        accountName: editForm.accountName.trim(),
      });
      toast.success(t('bankAccount.toast.updateSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      resetForms();
      void fetchData();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(t('bankAccount.toast.updateError'), {
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
      if (type === 'edit') setEditingId(null);
    }

    if (type === 'create' && open) {
      setCreateForm({ bankCode: '', accountNo: '', accountName: '' });
      setCreateBankSearch('');
      setFormErrors({});
    }

    if (type === 'edit' && open) {
      setEditBankSearch('');
      setFormErrors({});
    }

    if (type === 'create') setCreateDialogOpen(open);
    if (type === 'edit') setEditDialogOpen(open);
  };

  const handleOpenDelete = (item: BankAccountItem) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await deleteBankAccount(deletingItem.id);
      toast.success(t('bankAccount.toast.deleteSuccess'), {
        duration: 1500,
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      void fetchData();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(t('bankAccount.toast.deleteError'), {
        duration: 1500,
        style: errorToastStyle,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container space-y-6 pb-10 pt-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('bankAccount.pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('bankAccount.pageDescription')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('bankAccount.cardTitle')}</CardTitle>
            <CardDescription>{t('bankAccount.cardDescription')}</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
              onClick={handleRefresh}
              aria-label={t('common.refresh')}
            >
              <RefreshCcw className={cn('h-4 w-4 transition', isRefreshing && 'animate-spin')} aria-hidden />
            </Button>

            {canAdd && (
              <Dialog open={createDialogOpen} onOpenChange={(open) => handleDialogChange(open, 'create')}>
                <DialogTrigger asChild>
                  <Button className="w-auto bg-primary text-white hover:bg-primary/90 active:bg-primary/80 md:self-stretch">
                    <Plus className="size-4" />
                    {t('common.add')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('bankAccount.create.title')}</DialogTitle>
                  <DialogDescription>{t('bankAccount.create.description')}</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-account-bank-code">{t('bankAccount.form.bankCode')}</Label>
                    <Select
                      value={createForm.bankCode}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, bankCode: value }))}
                      onOpenChange={(open) => {
                        if (open) setCreateBankSearch('');
                      }}
                      disabled={isBankOptionsLoading}
                    >
                      <SelectTrigger id="bank-account-bank-code" className="w-full max-w-full min-w-0">
                        <SelectValue
                          placeholder={
                            isBankOptionsLoading ? t('common.loading') : t('bankAccount.form.bankCodePlaceholder')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent
                        searchable
                        searchValue={createBankSearch}
                        onSearchValueChange={setCreateBankSearch}
                        searchPlaceholder={t('profit.withdraw.bankCodeSearchPlaceholder')}
                      >
                        {filteredCreateBankOptions.map((bank) => (
                          <SelectItem key={bank.id} value={bank.code}>
                            {bank.code} - {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.bankCode && <p className="text-sm text-destructive">{formErrors.bankCode}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-account-account-no">{t('bankAccount.form.accountNo')}</Label>
                    <Input
                      id="bank-account-account-no"
                      value={createForm.accountNo}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, accountNo: event.target.value }))}
                      placeholder={t('bankAccount.form.accountNoPlaceholder')}
                    />
                    {formErrors.accountNo && <p className="text-sm text-destructive">{formErrors.accountNo}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-account-account-name">{t('bankAccount.form.accountName')}</Label>
                    <Input
                      id="bank-account-account-name"
                      value={createForm.accountName}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, accountName: event.target.value }))}
                      placeholder={t('bankAccount.form.accountNamePlaceholder')}
                    />
                    {formErrors.accountName && <p className="text-sm text-destructive">{formErrors.accountName}</p>}
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleDialogChange(false, 'create')}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={() => void handleCreate()} disabled={isSaving} className="bg-primary text-white hover:bg-primary/90">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
                  </Button>
                </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                void fetchData();
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
                    <TableHead className="w-[80px]">{t('bankAccount.table.id')}</TableHead>
                    <TableHead className="min-w-[120px]">{t('bankAccount.table.bankCode')}</TableHead>
                    <TableHead className="min-w-[160px]">{t('bankAccount.table.accountNo')}</TableHead>
                    <TableHead className="min-w-[200px]">{t('bankAccount.table.accountName')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('bankAccount.table.createdAt')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('bankAccount.table.updatedAt')}</TableHead>
                    <TableHead className="w-[120px] text-right">{t('bankAccount.table.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 10 }).map((_, rowIndex) => (
                        <TableRow key={`skeleton-${rowIndex}`}>
                          {Array.from({ length: 7 }).map((_, colIndex) => (
                            <TableCell key={colIndex}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                            <Inbox className="h-7 w-7" aria-hidden />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{t('bankAccount.empty.title')}</p>
                            <p>{t('bankAccount.empty.description')}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                      )}
                  {!isLoading &&
                    items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell data-label={t('bankAccount.table.id')}>{row.id}</TableCell>
                        <TableCell data-label={t('bankAccount.table.bankCode')}>{row.bankCode || '-'}</TableCell>
                        <TableCell data-label={t('bankAccount.table.accountNo')}>{row.accountNo || '-'}</TableCell>
                        <TableCell data-label={t('bankAccount.table.accountName')}>{row.accountName || '-'}</TableCell>
                        <TableCell data-label={t('bankAccount.table.createdAt')}>{row.created_at || '-'}</TableCell>
                        <TableCell data-label={t('bankAccount.table.updatedAt')}>{row.updated_at || '-'}</TableCell>
                        <TableCell data-label={t('bankAccount.table.action')} className="text-right">
                          <div className="flex justify-end gap-2">
                            {canUpdate && (
                              <Button
                                size="sm"
                                onClick={() => void handleOpenEdit(row.id)}
                                className="bg-primary text-white hover:bg-primary/90"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                {t('common.edit')}
                              </Button>
                            )}
                            {canDelete && (
                              <Button size="sm" variant="destructive" onClick={() => handleOpenDelete(row)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('common.delete')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t('pagination.info')
                .replace('{from}', String(totalItems ? (page - 1) * limit + 1 : 0))
                .replace('{to}', String(Math.min(page * limit, totalItems)))
                .replace('{count}', String(totalItems))}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t('common.prev')}
              </Button>
              <Select value={String(page)} onValueChange={(value) => setPage(Number(value))}>
                <SelectTrigger className="w-[100px]" disabled={isLoading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {canUpdate && (
        <Dialog open={editDialogOpen} onOpenChange={(open) => handleDialogChange(open, 'edit')}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('bankAccount.edit.title')}</DialogTitle>
            <DialogDescription>{t('bankAccount.edit.description')}</DialogDescription>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : (
            <>
              <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank-account-edit-bank-code">{t('bankAccount.form.bankCode')}</Label>
                  <Select
                    value={editForm.bankCode}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, bankCode: value }))}
                    onOpenChange={(open) => {
                      if (open) setEditBankSearch('');
                    }}
                    disabled={isBankOptionsLoading}
                  >
                    <SelectTrigger id="bank-account-edit-bank-code" className="w-full max-w-full min-w-0">
                      <SelectValue
                        placeholder={isBankOptionsLoading ? t('common.loading') : t('bankAccount.form.bankCodePlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent
                      searchable
                      searchValue={editBankSearch}
                      onSearchValueChange={setEditBankSearch}
                      searchPlaceholder={t('profit.withdraw.bankCodeSearchPlaceholder')}
                    >
                      {filteredEditBankOptions.map((bank) => (
                        <SelectItem key={bank.id} value={bank.code}>
                          {bank.code} - {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.bankCode && <p className="text-sm text-destructive">{formErrors.bankCode}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-account-edit-account-no">{t('bankAccount.form.accountNo')}</Label>
                  <Input
                    id="bank-account-edit-account-no"
                    value={editForm.accountNo}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, accountNo: event.target.value }))}
                    placeholder={t('bankAccount.form.accountNoPlaceholder')}
                  />
                  {formErrors.accountNo && <p className="text-sm text-destructive">{formErrors.accountNo}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-account-edit-account-name">{t('bankAccount.form.accountName')}</Label>
                  <Input
                    id="bank-account-edit-account-name"
                    value={editForm.accountName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, accountName: event.target.value }))}
                    placeholder={t('bankAccount.form.accountNamePlaceholder')}
                  />
                  {formErrors.accountName && <p className="text-sm text-destructive">{formErrors.accountName}</p>}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleDialogChange(false, 'edit')}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void handleUpdate()} disabled={isSaving} className="bg-primary text-white hover:bg-primary/90">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
                </Button>
              </DialogFooter>
            </>
          )}
          </DialogContent>
        </Dialog>
      )}

      {canDelete && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bankAccount.delete.title')}</DialogTitle>
            <DialogDescription>{t('bankAccount.delete.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.delete')}
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
