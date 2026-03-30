import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getStoredUserPermissions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Inbox, Plus, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/language-provider';

interface Operator {
  id: string | number;
  name: string;
  email?: string;
  password?: string;
  permissions?: string | null;
  isOwner?: boolean;
  roleId?: string;
  status?: 'Active' | 'Suspended';
  createdAt?: string;
  updatedAt?: string | null;
}

type OperatorListResponse = {
  status: boolean;
  message?: string;
  data: Array<{
    id: number;
    name: string;
    email: string;
    permissions: string | null;
    isOwner?: string | boolean | null;
    created_at: string;
    updated_at: string | null;
  }>;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

type OperatorDetailResponse = {
  status: boolean;
  data: {
    id: number;
    email: string;
    name: string;
    permissions: string | null;
  };
};

type PermissionItem = {
  key: string;
  labelKey: string;
  descriptionKey?: string;
};

type PermissionGroup = {
  nameKey: string;
  permissions: PermissionItem[];
};

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    nameKey: 'operators.permissions.group.operators',
    permissions: [
      {
        key: 'operator:list',
        labelKey: 'operators.permissions.operator.list',
        descriptionKey: 'operators.permissions.operator.listDescription',
      },
      {
        key: 'operator:add',
        labelKey: 'operators.permissions.operator.add',
        descriptionKey: 'operators.permissions.operator.addDescription',
      },
      {
        key: 'operator:update',
        labelKey: 'operators.permissions.operator.update',
        descriptionKey: 'operators.permissions.operator.updateDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.channels',
    permissions: [
      {
        key: 'channel:list',
        labelKey: 'operators.permissions.channel.list',
        descriptionKey: 'operators.permissions.channel.listDescription',
      },
      {
        key: 'channel:add',
        labelKey: 'operators.permissions.channel.add',
        descriptionKey: 'operators.permissions.channel.addDescription',
      },
      {
        key: 'channel:update',
        labelKey: 'operators.permissions.channel.update',
        descriptionKey: 'operators.permissions.channel.updateDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.channelProducts',
    permissions: [
      {
        key: 'channelProduk:list',
        labelKey: 'operators.permissions.channelProduct.list',
        descriptionKey: 'operators.permissions.channelProduct.listDescription',
      },
      {
        key: 'channelProduk:add',
        labelKey: 'operators.permissions.channelProduct.add',
        descriptionKey: 'operators.permissions.channelProduct.addDescription',
      },
      {
        key: 'channelProduk:update',
        labelKey: 'operators.permissions.channelProduct.update',
        descriptionKey: 'operators.permissions.channelProduct.updateDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.channelStore',
    permissions: [
      {
        key: 'channelStore:list',
        labelKey: 'operators.permissions.channelStore.list',
        descriptionKey: 'operators.permissions.channelStore.listDescription',
      },
      {
        key: 'channelStore:add',
        labelKey: 'operators.permissions.channelStore.add',
        descriptionKey: 'operators.permissions.channelStore.addDescription',
      },
      {
        key: 'channelStore:update',
        labelKey: 'operators.permissions.channelStore.update',
        descriptionKey: 'operators.permissions.channelStore.updateDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.channelDisbursement',
    permissions: [
      {
        key: 'channelDisbursement:list',
        labelKey: 'operators.permissions.channelDisbursement.list',
        descriptionKey: 'operators.permissions.channelDisbursement.listDescription',
      },
      {
        key: 'channelDisbursement:add',
        labelKey: 'operators.permissions.channelDisbursement.add',
        descriptionKey: 'operators.permissions.channelDisbursement.addDescription',
      },
      {
        key: 'channelDisbursement:update',
        labelKey: 'operators.permissions.channelDisbursement.update',
        descriptionKey: 'operators.permissions.channelDisbursement.updateDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.bankList',
    permissions: [
      {
        key: 'bankList:list',
        labelKey: 'operators.permissions.bankList.list',
        descriptionKey: 'operators.permissions.bankList.listDescription',
      },
      {
        key: 'bankList:add',
        labelKey: 'operators.permissions.bankList.add',
        descriptionKey: 'operators.permissions.bankList.addDescription',
      },
      {
        key: 'bankList:update',
        labelKey: 'operators.permissions.bankList.update',
        descriptionKey: 'operators.permissions.bankList.updateDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.merchants',
    permissions: [
      {
        key: 'merchant:list',
        labelKey: 'operators.permissions.merchant.list',
        descriptionKey: 'operators.permissions.merchant.listDescription',
      },
      {
        key: 'merchant:add',
        labelKey: 'operators.permissions.merchant.add',
        descriptionKey: 'operators.permissions.merchant.addDescription',
      },
      {
        key: 'merchant:update',
        labelKey: 'operators.permissions.merchant.update',
        descriptionKey: 'operators.permissions.merchant.updateDescription',
      },
      {
        key: 'merchant:topup',
        labelKey: 'operators.permissions.merchant.topup',
        descriptionKey: 'operators.permissions.merchant.topupDescription',
      },
      {
        key: 'merchant:deduct',
        labelKey: 'operators.permissions.merchant.deduct',
        descriptionKey: 'operators.permissions.merchant.deductDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.users',
    permissions: [
      {
        key: 'user:list',
        labelKey: 'operators.permissions.user.list',
        descriptionKey: 'operators.permissions.user.listDescription',
      },
      {
        key: 'user:add',
        labelKey: 'operators.permissions.user.add',
        descriptionKey: 'operators.permissions.user.addDescription',
      },
      {
        key: 'user:update',
        labelKey: 'operators.permissions.user.update',
        descriptionKey: 'operators.permissions.user.updateDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.reconciliation',
    permissions: [
      {
        key: 'recon:upload',
        labelKey: 'operators.permissions.reconciliation.upload',
        descriptionKey: 'operators.permissions.reconciliation.uploadDescription',
      },
      {
        key: 'recon:list',
        labelKey: 'operators.permissions.reconciliation.list',
        descriptionKey: 'operators.permissions.reconciliation.listDescription',
      },
      {
        key: 'recon:approve',
        labelKey: 'operators.permissions.reconciliation.approve',
        descriptionKey: 'operators.permissions.reconciliation.approveDescription',
      },
      {
        key: 'recon:reject',
        labelKey: 'operators.permissions.reconciliation.reject',
        descriptionKey: 'operators.permissions.reconciliation.rejectDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.payin',
    permissions: [
      {
        key: 'payin:list',
        labelKey: 'operators.permissions.payin.list',
        descriptionKey: 'operators.permissions.payin.listDescription',
      },
      {
        key: 'trx:resendCallback',
        labelKey: 'operators.permissions.transactions.resendCallback',
        descriptionKey: 'operators.permissions.transactions.resendCallbackDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.payout',
    permissions: [
      {
        key: 'disbursement:list',
        labelKey: 'operators.permissions.disbursement.list',
        descriptionKey: 'operators.permissions.disbursement.listDescription',
      },
      {
        key: 'disbursement:update:failed',
        labelKey: 'operators.permissions.disbursement.updateFailed',
        descriptionKey: 'operators.permissions.disbursement.updateFailedDescription',
      },
    ],
  },
  {
    nameKey: 'operators.permissions.group.reports',
    permissions: [
      {
        key: 'report:merchant-summary',
        labelKey: 'operators.permissions.report.merchantSummary',
        descriptionKey: 'operators.permissions.report.merchantSummaryDescription',
      },
    ],
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN_LENGTH = 5;
const NAME_MAX_LENGTH = 30;
const EMAIL_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 15;

export function AdminOperatorPage() {
  const { t } = useLanguage();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchNameInput, setSearchNameInput] = useState('');
  const [searchEmailInput, setSearchEmailInput] = useState('');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const appliedRef = useRef(false);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalOperators, setTotalOperators] = useState<number>(0);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [isLoadingOperatorDetails, setIsLoadingOperatorDetails] = useState(false);
  const [isLoadingPermissionDetails, setIsLoadingPermissionDetails] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [operatorForm, setOperatorForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showOperatorPassword, setShowOperatorPassword] = useState(false);
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [editingOperatorId, setEditingOperatorId] = useState<string | number | null>(null);
  const [permissionOperatorId, setPermissionOperatorId] = useState<string | number | null>(null);
  const [operatorErrors, setOperatorErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [operatorPermissions, setOperatorPermissions] = useState('');
  const [selectedPermissionSet, setSelectedPermissionSet] = useState<Set<string>>(new Set());
  const [createPermissionSet, setCreatePermissionSet] = useState<Set<string>>(new Set());
  const [permissionOperatorName, setPermissionOperatorName] = useState('');
  const [currentUserPermissions] = useState(() => new Set(getStoredUserPermissions()));
  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((message, [placeholder, value]) => {
      return message.replace(`{${placeholder}}`, String(value));
    }, t(key));
  const getOperatorErrors = useCallback(
    (form: { name: string; email: string; password: string }, isEditing: boolean) => {
      const errors: { name?: string; email?: string; password?: string } = {};
      const trimmedName = form.name.trim();
      const trimmedEmail = form.email.trim();

      if (!trimmedName) {
        errors.name = t('operators.validation.nameRequired');
      } else if (trimmedName.length < NAME_MIN_LENGTH) {
        errors.name = formatMessage('operators.validation.nameMin', { count: NAME_MIN_LENGTH });
      } else if (trimmedName.length > NAME_MAX_LENGTH) {
        errors.name = formatMessage('operators.validation.nameMax', { count: NAME_MAX_LENGTH });
      }

      if (!isEditing) {
        if (!trimmedEmail) {
          errors.email = t('operators.validation.emailRequired');
        } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
          errors.email = t('operators.validation.emailInvalid');
        } else if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
          errors.email = formatMessage('operators.validation.emailMax', { count: EMAIL_MAX_LENGTH });
        }

        // Password is intentionally hidden in Add Operator flow for now.
        // if (!trimmedPassword) {
        //   errors.password = t('operators.validation.passwordRequired');
        // } else if (trimmedPassword.length < PASSWORD_MIN_LENGTH) {
        //   errors.password = formatMessage('operators.validation.passwordMin', { count: PASSWORD_MIN_LENGTH });
        // } else if (trimmedPassword.length > PASSWORD_MAX_LENGTH) {
        //   errors.password = formatMessage('operators.validation.passwordMax', { count: PASSWORD_MAX_LENGTH });
        // }
      }

      return errors;
    },
    [formatMessage, t],
  );

  const operatorValidationErrors = useMemo(
    () => getOperatorErrors(operatorForm, Boolean(editingOperatorId)),
    [editingOperatorId, getOperatorErrors, operatorForm],
  );
  const hasOperatorValidationErrors = useMemo(
    () => Object.values(operatorValidationErrors).some(Boolean),
    [operatorValidationErrors],
  );
  const isOperatorSubmitDisabled = useMemo(() => {
    const hasName = Boolean(operatorForm.name.trim());
    if (editingOperatorId) {
      return !hasName || hasOperatorValidationErrors;
    }
    return (
      !hasName ||
      !operatorForm.email.trim() ||
      // !operatorForm.password.trim() ||
      hasOperatorValidationErrors
    );
    
  // }, [editingOperatorId, hasOperatorValidationErrors, operatorForm.email, operatorForm.name, operatorForm.password]);

  }, [editingOperatorId, hasOperatorValidationErrors, operatorForm.email, operatorForm.name]);

  const getOperatorFieldError = useCallback(
    (
      field: 'name' | 'email' | 'password',
      form: { name: string; email: string; password: string },
      isEditing: boolean,
    ) => {
      const trimmedValue = form[field].trim();

      if (field === 'name') {
        if (!trimmedValue) {
          return t('operators.validation.nameRequired');
        }
        if (trimmedValue.length < NAME_MIN_LENGTH) {
          return formatMessage('operators.validation.nameMin', { count: NAME_MIN_LENGTH });
        }
        if (trimmedValue.length > NAME_MAX_LENGTH) {
          return formatMessage('operators.validation.nameMax', { count: NAME_MAX_LENGTH });
        }
        return undefined;
      }

      if (isEditing) {
        return undefined;
      }

      if (field === 'email') {
        if (!trimmedValue) {
          return t('operators.validation.emailRequired');
        }
        if (!EMAIL_PATTERN.test(trimmedValue)) {
          return t('operators.validation.emailInvalid');
        }
        if (trimmedValue.length > EMAIL_MAX_LENGTH) {
          return formatMessage('operators.validation.emailMax', { count: EMAIL_MAX_LENGTH });
        }
        return undefined;
      }

      if (!trimmedValue) {
        return t('operators.validation.passwordRequired');
      }
      if (trimmedValue.length < PASSWORD_MIN_LENGTH) {
        return formatMessage('operators.validation.passwordMin', { count: PASSWORD_MIN_LENGTH });
      }
      if (trimmedValue.length > PASSWORD_MAX_LENGTH) {
        return formatMessage('operators.validation.passwordMax', { count: PASSWORD_MAX_LENGTH });
      }
      return undefined;
    },
    [formatMessage, t],
  );

  const allowedPermissionKeys = useMemo(
    () =>
      PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key)).filter((key) =>
        currentUserPermissions.has(key),
      ),
    [currentUserPermissions],
  );

  const filteredPermissionGroups = useMemo(() => {
    return PERMISSION_GROUPS.map((group) => {
      const permissions = group.permissions
        .filter((permission) => currentUserPermissions.has(permission.key))
        .map((permission) => ({
          ...permission,
          label: t(permission.labelKey),
          description: permission.descriptionKey ? t(permission.descriptionKey) : undefined,
        }));

      return {
        name: t(group.nameKey),
        permissions,
      };
    }).filter((group) => group.permissions.length > 0);
  }, [currentUserPermissions, t]);
  const createPermissionsPayload = useMemo(
    () => Array.from(createPermissionSet).sort().join(','),
    [createPermissionSet],
  );

  const permissionStringToSet = useCallback((permissions?: string | null) => {
    if (!permissions) return new Set<string>();
    return new Set(
      permissions
        .split(',')
        .map((permission) => permission.trim())
        .filter(Boolean),
    );
  }, []);

  const handleResetFilters = () => {
    setSearchName('');
    setSearchEmail('');
    setSearchNameInput('');
    setSearchEmailInput('');
    setPage(1);
    void fetchOperators(undefined, { searchName: '', searchEmail: '', page: 1, limit });
  };

  const handleSearch = () => {
    const nextSearchName = searchNameInput;
    const nextSearchEmail = searchEmailInput;
    setPage(1);
    setSearchName(nextSearchName);
    setSearchEmail(nextSearchEmail);
    void fetchOperators(undefined, {
      searchName: nextSearchName,
      searchEmail: nextSearchEmail,
      page: 1,
      limit,
    });
  };

  const handleFilterDialogChange = (open: boolean) => {
    if (open) {
      setSearchNameInput(searchName);
      setSearchEmailInput(searchEmail);
    }
    if (!open && !appliedRef.current) {
      setSearchNameInput(searchName);
      setSearchEmailInput(searchEmail);
    }
    appliedRef.current = false;
    setIsFilterDialogOpen(open);
  };

  const pageOptions = useMemo(() => {
    const calculatedPages = Math.max(1, totalPages || Math.ceil(totalOperators / limit) || 1);
    const groupSize = 10;
    const currentGroupStart = Math.floor((page - 1) / groupSize) * groupSize + 1;
    const currentGroupEnd = Math.min(calculatedPages, currentGroupStart + groupSize - 1);

    return Array.from({ length: currentGroupEnd - currentGroupStart + 1 }, (_, index) => currentGroupStart + index);
  }, [limit, page, totalOperators, totalPages]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchName.trim()) count += 1;
    if (searchEmail.trim()) count += 1;
    return count;
  }, [searchEmail, searchName]);

  const fetchOperators = useCallback(
    async (
      abortController?: AbortController,
      overrides?: {
        searchName?: string;
        searchEmail?: string;
        page?: number;
        limit?: number;
      },
    ) => {
      const controller = abortController ?? new AbortController();
      const startTime = Date.now();
      setIsLoadingOperators(true);
      setOperators([]);

      const activeSearchName = overrides?.searchName ?? searchName;
      const activeSearchEmail = overrides?.searchEmail ?? searchEmail;
      const activePage = overrides?.page ?? page;
      const activeLimit = overrides?.limit ?? limit;

      const params = new URLSearchParams({
        page: String(activePage),
        limit: String(activeLimit),
      });

      if (activeSearchName.trim()) params.append('name', activeSearchName.trim());
      if (activeSearchEmail.trim()) params.append('email', activeSearchEmail.trim());

      try {
        const response = await apiFetch<OperatorListResponse>(`/operator?${params.toString()}`, {
          signal: controller.signal,
        });

        const receivedOperators = Array.isArray(response.data) ? response.data : [];
        const mappedOperators: Operator[] = receivedOperators.map((operator) => ({
          id: operator.id,
          name: operator.name,
          email: operator.email,
          createdAt: operator.created_at,
          updatedAt: operator.updated_at,
          status: 'Active',
          permissions: operator.permissions,
          isOwner: String(operator.isOwner ?? '').toLowerCase() === 'true',
        }));

        setOperators(mappedOperators);
        const effectiveLimit = response.pagination?.limit ?? activeLimit;
        setTotalOperators(response.pagination?.total ?? mappedOperators.length ?? 0);
        const calculatedTotalPages = Math.max(
          1,
          Math.ceil((response.pagination?.total ?? 0) / (effectiveLimit || 1)),
        );
        setTotalPages(response.pagination?.totalPages ?? calculatedTotalPages);
        if (response.pagination?.page) setPage(response.pagination.page);
        if (response.pagination?.limit) setLimit(response.pagination.limit);
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : t('operators.toast.loadError'), {
            duration: 1500,
            style: {
              border: '2px solid #fda4af',
              background: '#fff1f2',
              color: '#f43f5e',
              boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
              padding: '0.5rem',
            },
          });
          setOperators([]);
          setTotalOperators(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          const elapsed = Date.now() - startTime;
          if (elapsed < 1000) {
            await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
          }
          setIsLoadingOperators(false);
        }
      }
    },
    [limit, page, searchEmail, searchName, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchOperators(controller);

    return () => controller.abort();
  }, [fetchOperators]);

  const resetOperatorForm = () => setOperatorForm({ name: '', email: '', password: '' });

  const handleRefresh = useCallback(async () => {
    const MIN_SPIN_DURATION_MS = 500;

    setIsRefreshing(true);
    const start = Date.now();

    try {
      await fetchOperators();
    } finally {
      const elapsed = Date.now() - start;

      if (elapsed < MIN_SPIN_DURATION_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_DURATION_MS - elapsed));
      }

      setIsRefreshing(false);
    }
  }, [fetchOperators]);

  const saveOperator = () => {
    const trimmedName = operatorForm.name.trim();
    const trimmedEmail = operatorForm.email.trim();
    // const trimmedPassword = operatorForm.password.trim();
    const permissionsPayload = operatorPermissions;
    const operatorId = editingOperatorId;
    const errors = getOperatorErrors(operatorForm, Boolean(editingOperatorId));

    if (Object.keys(errors).length) {
      setOperatorErrors(errors);
      return;
    }
    const persistOperator = async () => {
      handleOperatorDialogChange(false);
      setIsLoadingOperators(true);
      try {
        if (operatorId) {
          await apiFetch(`/operator/update/${operatorId}`, {
            method: 'POST',
            body: {
              name: trimmedName,
              permissions: permissionsPayload,
            },
          });

          toast.success(t('operators.toast.updateSuccess'), {
            duration: 1500,
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />, 
          });
        } else {
          await apiFetch('/operator/add', {
            method: 'POST',
            body: {
              name: trimmedName,
              email: trimmedEmail,
              // password: trimmedPassword,
              permissions: createPermissionsPayload,
            },
          });

          toast.success(t('operators.toast.createSuccess'), {
            duration: 1500,
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
          });
        }

        await fetchOperators();
        resetOperatorForm();
        setOperatorErrors({});
        setEditingOperatorId(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('operators.toast.saveError'), {
          duration: 1500,
          style: {
            border: '2px solid #fda4af',
            background: '#fff1f2',
            color: '#f43f5e',
            boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
            padding: '0.5rem',
          },
        });
      } finally {
        setIsLoadingOperators(false);
      }
    };

    void persistOperator();
  };

  const handleOpenOperatorDialog = (operator?: Operator) => {
    if (operator) {
      const loadOperatorDetails = async () => {
        setIsLoadingOperatorDetails(true);
        try {
          const response = await apiFetch<OperatorDetailResponse>(`/operator/${operator.id}`);
          const details = response?.data;

          setOperatorForm({
            name: details?.name ?? operator.name,
            email: details?.email ?? operator.email ?? '',
            password: '',
          });
          setOperatorPermissions(details?.permissions ?? operator.permissions ?? '');
          setEditingOperatorId(details?.id ?? operator.id);
          setOperatorErrors({});
          setOperatorDialogOpen(true);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t('operators.toast.detailError'), {
            duration: 1500,
            style: {
              border: '2px solid #fda4af',
              background: '#fff1f2',
              color: '#f43f5e',
              boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
              padding: '0.5rem',
            },
          });
        } finally {
          setIsLoadingOperatorDetails(false);
        }
      };

      void loadOperatorDetails();
    } else {
      resetOperatorForm();
      setEditingOperatorId(null);
      setOperatorErrors({});
      setCreatePermissionSet(new Set());
      setOperatorDialogOpen(true);
    }
  };

  const handleOperatorDialogChange = (open: boolean) => {
    setOperatorDialogOpen(open);
    if (!open) {
      resetOperatorForm();
      setEditingOperatorId(null);
      setOperatorErrors({});
      setOperatorPermissions('');
      setCreatePermissionSet(new Set());
    }
  };

  const handlePermissionDialogChange = (open: boolean) => {
    setPermissionDialogOpen(open);
    if (!open) {
      setPermissionOperatorId(null);
      setSelectedPermissionSet(new Set());
      setPermissionOperatorName('');
      setIsLoadingPermissionDetails(false);
    }
  };

  const handlePermissionToggle = (permissionKey: string) => {
    setSelectedPermissionSet((current) => {
      const updated = new Set(current);
      if (updated.has(permissionKey)) {
        updated.delete(permissionKey);
      } else {
        updated.add(permissionKey);
      }
      return updated;
    });
  };

  const handleCreatePermissionToggle = (permissionKey: string) => {
    setCreatePermissionSet((current) => {
      const updated = new Set(current);
      if (updated.has(permissionKey)) {
        updated.delete(permissionKey);
      } else {
        updated.add(permissionKey);
      }
      return updated;
    });
  };

  const handleOpenPermissionDialog = (operator: Operator) => {
    setPermissionDialogOpen(true);
    setPermissionOperatorId(operator.id);
    setPermissionOperatorName(operator.name);
    setIsLoadingPermissionDetails(true);

    const loadPermissions = async () => {
      try {
        const response = await apiFetch<OperatorDetailResponse>(`/operator/${operator.id}`);
        const details = response?.data;
        setPermissionOperatorName(details?.name ?? operator.name);
        setSelectedPermissionSet(permissionStringToSet(details?.permissions));
        setOperatorPermissions(details?.permissions ?? operator.permissions ?? '');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('operators.toast.permissionsLoadError'), {
          duration: 1500,
          style: {
            border: '2px solid #fda4af',
            background: '#fff1f2',
            color: '#f43f5e',
            boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
            padding: '0.5rem',
          },
        });
        setPermissionDialogOpen(false);
      } finally {
        setIsLoadingPermissionDetails(false);
      }
    };

    void loadPermissions();
  };

  const handleSavePermissions = () => {
    if (!permissionOperatorId) return;
    if (allowedPermissionKeys.length === 0) return;

    const savePermissions = async () => {
      setIsSavingPermissions(true);
      try {
        const allowedSelectedPermissions = allowedPermissionKeys.filter((key) => selectedPermissionSet.has(key));
        const preservedPermissions = operatorPermissions
          .split(',')
          .map((permission) => permission.trim())
          .filter((permission) => permission && !currentUserPermissions.has(permission));
        const permissionsPayload = Array.from(
          new Set([...preservedPermissions, ...allowedSelectedPermissions]),
        ).join(',');
        const operatorName = permissionOperatorName;
        handlePermissionDialogChange(false);
        setIsLoadingOperators(true);
        await apiFetch(`/operator/update/${permissionOperatorId}`, {
          method: 'POST',
          body: {
            name: operatorName,
            permissions: permissionsPayload,
          },
        });

        setOperatorPermissions(permissionsPayload);
        await fetchOperators();
        toast.success(t('operators.toast.permissionsUpdateSuccess'), {
          duration: 1500,
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('operators.toast.permissionsUpdateError'), {
          duration: 1500,
          style: {
            border: '2px solid #fda4af',
            background: '#fff1f2',
            color: '#f43f5e',
            boxShadow: '0 4px 10px rgba(244, 63, 94, 0.12)',
            padding: '0.5rem',
          },
        });
      } finally {
        setIsSavingPermissions(false);
        setIsLoadingOperators(false);
      }
    };

    void savePermissions();
  };

  return (
    <div className="container space-y-8 pb-10 pt-4">
      <Dialog open={permissionDialogOpen} onOpenChange={handlePermissionDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-hidden rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>{t('operators.permissions.title')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('operators.permissions.selectFor')}</p>
              <p className="text-lg font-semibold leading-tight">{permissionOperatorName || '-'}</p>
            </div>

            {isLoadingPermissionDetails ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {t('operators.permissions.loading')}
              </div>
            ) : (
              <ScrollArea className="h-[60vh] pr-2" viewportClassName="pr-1">
                {filteredPermissionGroups.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {t('operators.permissions.notAllowed')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPermissionGroups.map((group) => (
                      <div key={group.name} className="rounded-lg border p-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-medium">{group.name}</p>
                          <span className="text-xs text-muted-foreground">{t('operators.permissions.toggleAccess')}</span>
                        </div>
                        <div className="space-y-2">
                          {group.permissions.map((permission) => (
                            <div
                              key={permission.key}
                              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                            >
                              <div className="space-y-1 pr-4">
                                <p className="text-sm font-medium leading-tight">{permission.label}</p>
                                {permission.description && (
                                  <p className="text-xs text-muted-foreground">{permission.description}</p>
                                )}
                              </div>
                              <Switch
                                checked={selectedPermissionSet.has(permission.key)}
                                onCheckedChange={() => handlePermissionToggle(permission.key)}
                                disabled={isSavingPermissions}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </DialogBody>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => handlePermissionDialogChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto"
              onClick={handleSavePermissions}
              disabled={isSavingPermissions || isLoadingPermissionDetails || allowedPermissionKeys.length === 0}
            >
              {isSavingPermissions ? t('common.saving') : t('operators.permissions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('operators.pageTitle')}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pt-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 max-md:self-start">
            <CardTitle>{t('operators.cardTitle')}</CardTitle>
            <CardDescription>{t('operators.cardDescription')}</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              className="bg-primary text-white hover:bg-primary/90 active:bg-primary/80 flex items-center justify-center"
              onClick={handleRefresh}
              aria-label={t('common.refresh')}
              disabled={isRefreshing}
            >
              <RefreshCcw
                className={`h-4 w-4 transition ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden
              />
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
                    <Label htmlFor="operator-filter-name">{t('operators.fields.name')}</Label>
                    <Input
                      id="operator-filter-name"
                      placeholder={t('operators.filters.namePlaceholder')}
                      value={searchNameInput}
                      onChange={(event) => setSearchNameInput(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="operator-filter-email">{t('operators.fields.email')}</Label>
                    <Input
                      id="operator-filter-email"
                      placeholder={t('operators.filters.emailPlaceholder')}
                      value={searchEmailInput}
                      onChange={(event) => setSearchEmailInput(event.target.value)}
                    />
                  </div>
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      appliedRef.current = false;
                      setSearchNameInput(searchName);
                      setSearchEmailInput(searchEmail);
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
            <Dialog open={operatorDialogOpen} onOpenChange={handleOperatorDialogChange}>
              <DialogTrigger asChild>
                <Button
                  className="w-auto bg-primary text-white hover:bg-primary/90 active:bg-primary/80 md:self-stretch"
                  onClick={() => handleOpenOperatorDialog()}
                >
                  <Plus className="h-4 w-4" /> {t('common.add')}
                </Button>
              </DialogTrigger>
              <DialogContent
                className="rounded-lg sm:rounded-lg"
                onOpenAutoFocus={(event) => {
                  if (editingOperatorId) {
                    event.preventDefault();
                  }
                }}
              >
                    <DialogHeader>
                      <DialogTitle>
                        {editingOperatorId ? t('operators.edit.title') : t('operators.create.title')}
                      </DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <div className="space-y-1">
                        <Label htmlFor="operator-name" className="text-sm font-medium text-muted-foreground">
                          {t('operators.fields.name')}
                        </Label>
                        <Input
                          id="operator-name"
                          placeholder={t('operators.placeholders.name')}
                          value={operatorForm.name}
                          maxLength={NAME_MAX_LENGTH}
                          onChange={(event) => {
                            const value = event.target.value;
                            setOperatorForm((prev) => {
                              const nextForm = { ...prev, name: value };
                              setOperatorErrors((prevErrors) => ({
                                ...prevErrors,
                                name: getOperatorFieldError('name', nextForm, Boolean(editingOperatorId)),
                              }));
                              return nextForm;
                            });
                          }}
                        />
                        {operatorErrors.name && (
                          <p className="text-sm text-destructive">{operatorErrors.name}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="operator-email" className="text-sm font-medium text-muted-foreground">
                          {t('operators.fields.email')}
                        </Label>
                        <Input
                          id="operator-email"
                          placeholder={t('operators.placeholders.email')}
                          type="email"
                          value={operatorForm.email}
                          maxLength={EMAIL_MAX_LENGTH}
                          disabled={Boolean(editingOperatorId)}
                          readOnly={Boolean(editingOperatorId)}
                          onChange={(event) => {
                            const value = event.target.value;
                            setOperatorForm((prev) => {
                              const nextForm = { ...prev, email: value };
                              setOperatorErrors((prevErrors) => ({
                                ...prevErrors,
                                email: getOperatorFieldError('email', nextForm, Boolean(editingOperatorId)),
                              }));
                              return nextForm;
                            });
                          }}
                        />
                        {operatorErrors.email && (
                          <p className="text-sm text-destructive">{operatorErrors.email}</p>
                        )}
                      </div>
                      {/* {!editingOperatorId && (
                        <div className="space-y-1">
                          <Label htmlFor="operator-password" className="text-sm font-medium text-muted-foreground">
                            {t('operators.fields.password')}
                          </Label>
                          <div className="relative">
                            <Input
                              id="operator-password"
                              placeholder={t('operators.placeholders.password')}
                              type={showOperatorPassword ? 'text' : 'password'}
                              value={operatorForm.password}
                              maxLength={PASSWORD_MAX_LENGTH}
                              onChange={(event) => {
                                const value = event.target.value;
                                setOperatorForm((prev) => {
                                  const nextForm = { ...prev, password: value };
                                  setOperatorErrors((prevErrors) => ({
                                    ...prevErrors,
                                    password: getOperatorFieldError('password', nextForm, Boolean(editingOperatorId)),
                                  }));
                                  return nextForm;
                                });
                              }}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              aria-label={showOperatorPassword ? 'Hide password' : 'Show password'}
                              onClick={() => setShowOperatorPassword((prev) => !prev)}
                            >
                              {showOperatorPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </Button>
                          </div>
                          {operatorErrors.password && (
                            <p className="text-sm text-destructive">{operatorErrors.password}</p>
                          )}
                        </div>
                      )} */}
                      {!editingOperatorId && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">
                              {t('operators.fields.permissions')}
                            </Label>
                            <p className="text-xs text-muted-foreground">{t('operators.permissions.helper')}</p>
                          </div>
                          {filteredPermissionGroups.length === 0 ? (
                            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                              {t('operators.permissions.notAllowed')}
                            </div>
                          ) : (
                            <ScrollArea className="h-[180px] pr-2" viewportClassName="pr-1">
                              <div className="space-y-3">
                                {filteredPermissionGroups.map((group) => (
                                  <div key={group.name} className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">{group.name}</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {group.permissions.map((permission) => (
                                        <label
                                          key={permission.key}
                                          className="flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-xs text-foreground"
                                        >
                                          <input
                                            type="checkbox"
                                            className="mt-0.5 size-3.5 accent-primary"
                                            checked={createPermissionSet.has(permission.key)}
                                            onChange={() => handleCreatePermissionToggle(permission.key)}
                                          />
                                          <span className="leading-snug">
                                            <span className="font-medium">{permission.label}</span>
                                            {permission.description && (
                                              <span className="mt-1 block text-[11px] text-muted-foreground">
                                                {permission.description}
                                              </span>
                                            )}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      )}
                    </DialogBody>
                    <DialogFooter>
                      <Button
                        className="w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        onClick={saveOperator}
                        disabled={isOperatorSubmitDisabled}
                      >
                        {editingOperatorId ? t('operators.edit.save') : t('operators.create.save')}
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
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.id')}</TableHead>
                  <TableHead>{t('operators.table.name')}</TableHead>
                  <TableHead>{t('operators.table.email')}</TableHead>
                  <TableHead>{t('operators.table.createdAt')}</TableHead>
                  <TableHead>{t('operators.table.updatedAt')}</TableHead>
                  <TableHead className="w-[140px]">{t('operators.table.permissions')}</TableHead>
                  <TableHead className="w-[120px] text-right">{t('operators.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingOperators &&
                  Array.from({ length: 10 }).map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      <TableCell data-label={t('common.id')}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell data-label={t('operators.table.name')}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell data-label={t('operators.table.email')}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell data-label={t('operators.table.createdAt')}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell data-label={t('operators.table.updatedAt')}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell data-label={t('operators.table.permissions')}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell data-label={t('operators.table.actions')}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoadingOperators && operators.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                          <Inbox className="h-7 w-7" aria-hidden />
                        </div>
                        <div className="space-y-1">
                          <div className="text-base font-medium text-foreground">{t('operators.empty.title')}</div>
                          <div>{t('operators.empty.description')}</div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingOperators &&
                  operators.map((operator) => (
                    <TableRow key={operator.id}>
                      <TableCell data-label={t('common.id')} className="text-sm text-muted-foreground">
                        {operator.id}
                      </TableCell>
                      <TableCell data-label={t('operators.table.name')}>
                        <div className="font-medium">{operator.name}</div>
                      </TableCell>
                      <TableCell data-label={t('operators.table.email')}>
                        {operator.email ? (
                          <div className="text-sm text-muted-foreground">{operator.email}</div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell data-label={t('operators.table.createdAt')} className="text-sm text-muted-foreground">
                        {operator.createdAt ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('operators.table.updatedAt')} className="text-sm text-muted-foreground">
                        {operator.updatedAt ?? '-'}
                      </TableCell>
                      <TableCell data-label={t('operators.table.permissions')} className="text-left">
                        {operator.isOwner ? (
                          <span className="text-sm text-muted-foreground">-</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPermissionDialog(operator)}
                            className="bg-primary text-white hover:bg-primary/90"
                            disabled={isLoadingPermissionDetails}
                          >
                            {t('operators.table.permissions')}
                          </Button>
                          )}
                      </TableCell>
                      <TableCell data-label={t('operators.table.actions')} className="text-right">
                        {operator.isOwner ? (
                          <span className="text-sm text-muted-foreground">-</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenOperatorDialog(operator)}
                            disabled={isLoadingOperatorDetails}
                            className="bg-primary text-white hover:bg-primary/90"
                          >
                            {t('common.edit')}
                          </Button>
                        )}
                      </TableCell>
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
                  <SelectContent>
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
                    {[10, 20, 50].map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {t('common.perPage').replace('{count}', String(option))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                {t('operators.total').replace('{count}', String(totalOperators))}
              </div>
            </div>

            {operators.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
                  onClick={() => setPage((previousPage) => Math.max(1, previousPage - 1))}
                  disabled={page <= 1}
                >
                  {t('common.prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-colors hover:bg-transparent hover:text-foreground hover:border-input active:bg-muted/60"
                  onClick={() => setPage((previousPage) => Math.min(totalPages || 1, previousPage + 1))}
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
